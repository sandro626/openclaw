#!/bin/bash
# 飞书通讯录管理脚本
# 支持：多账户、读取通讯录、查找用户、发送消息

set -euo pipefail

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
ACCOUNTS_CONFIG="${FEISHU_ACCOUNTS_CONFIG:-}"
DATA_DIR="${FEISHU_CONTACTS_DATA_DIR:-}"
SHARED_DIR="${FEISHU_CONTACTS_SHARED_DIR:-}"
LOG_FILE="${FEISHU_CONTACTS_LOG_FILE:-}"
FEISHU_DOC_URL="${FEISHU_CONTACTS_DOC_URL:-}"

if [ -z "$ACCOUNTS_CONFIG" ]; then
    ACCOUNTS_CONFIG="$OPENCLAW_HOME/openclaw-feishu-accounts.json"
fi

if [ -z "$DATA_DIR" ]; then
    DATA_DIR="$OPENCLAW_HOME/cache/feishu-contacts"
fi

if [ -z "$SHARED_DIR" ]; then
    SHARED_DIR="$OPENCLAW_HOME/shared"
fi

if [ -z "$LOG_FILE" ]; then
    LOG_FILE="$OPENCLAW_HOME/logs/feishu-contacts.log"
fi

CACHE_USERS="$DATA_DIR/users_all.json"
CACHE_CHATS="$DATA_DIR/chats_all.json"
CACHE_MAP="$DATA_DIR/openid_name_map.txt"
SHARED_CONTACTS="$SHARED_DIR/CONTACTS.md"
DEFAULT_FEISHU_API_BASE="https://open.feishu.cn/open-apis"

mkdir -p "$DATA_DIR" "$(dirname "$LOG_FILE")"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" >> "$LOG_FILE"
}

print_available_accounts() {
    if [ ! -f "$ACCOUNTS_CONFIG" ]; then
        echo "  - 未找到账户配置文件：$ACCOUNTS_CONFIG"
        return
    fi

    jq -r '.accounts | keys[]' "$ACCOUNTS_CONFIG" | sed 's/^/  - /'
}

get_account_info() {
    local requested_account="${FEISHU_ACCOUNT:-}"
    local app_info="{}"

    if [ -f "$ACCOUNTS_CONFIG" ]; then
        if [ -z "$requested_account" ]; then
            requested_account=$(
                jq -r '.defaultAccount // (.accounts | keys[0] // empty)' "$ACCOUNTS_CONFIG" 2>/dev/null || true
            )
        fi

        if [ -n "$requested_account" ]; then
            app_info=$(
                jq -c --arg account "$requested_account" '.accounts[$account] // {}' "$ACCOUNTS_CONFIG" 2>/dev/null ||
                    echo "{}"
            )
            if [ "$app_info" = "{}" ]; then
                echo "❌ 错误：账户 '$requested_account' 不存在" >&2
                echo "可用账户：" >&2
                print_available_accounts >&2
                exit 1
            fi
        fi
    fi

    FEISHU_ACCOUNT="${requested_account:-${FEISHU_ACCOUNT:-default}}"
    FEISHU_APP_ID="${FEISHU_APP_ID:-$(echo "$app_info" | jq -r '.appId // empty')}"
    FEISHU_APP_SECRET="${FEISHU_APP_SECRET:-$(echo "$app_info" | jq -r '.appSecret // empty')}"

    if [ -z "${FEISHU_APP_SECRET:-}" ] && [ -n "${FEISHU_APP_SECRET_PATH:-}" ] && [ -f "$FEISHU_APP_SECRET_PATH" ]; then
        FEISHU_APP_SECRET="$(tr -d '\r\n' < "$FEISHU_APP_SECRET_PATH")"
    fi

    ACCOUNT_NAME="$(echo "$app_info" | jq -r '.name // empty')"
    ACCOUNT_NAME="${ACCOUNT_NAME:-$FEISHU_ACCOUNT}"
    FEISHU_API_BASE="${FEISHU_API_BASE:-$DEFAULT_FEISHU_API_BASE}"

    if [ -z "$FEISHU_APP_ID" ] || [ -z "$FEISHU_APP_SECRET" ]; then
        echo "❌ 错误：缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET。" >&2
        echo "请通过环境变量、FEISHU_APP_SECRET_PATH 或账户文件配置凭据。" >&2
        echo "账户文件: $ACCOUNTS_CONFIG" >&2
        echo "可用账户：" >&2
        print_available_accounts >&2
        exit 1
    fi

    log "使用账户: $ACCOUNT_NAME ($FEISHU_ACCOUNT)"
}

require_cache() {
    local cache_file="$1"
    if [ ! -f "$cache_file" ]; then
        echo "⚠️  本地缓存不存在，请先运行：feishu_contacts fetch"
        exit 1
    fi
}

get_token() {
    get_account_info

    TOKEN_RESPONSE=$(curl -sS -X POST \
        "$FEISHU_API_BASE/auth/v3/tenant_access_token/internal" \
        -H "Content-Type: application/json" \
        -d "{
            \"app_id\": \"$FEISHU_APP_ID\",
            \"app_secret\": \"$FEISHU_APP_SECRET\"
        }")

    TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.tenant_access_token')

    if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
        log "错误：无法获取 token，账户: $ACCOUNT_NAME"
        echo "❌ 错误：无法获取 token" >&2
        exit 1
    fi

    echo "$TOKEN"
}

fetch_contacts() {
    TOKEN=$(get_token)
    log "从飞书 API 获取通讯录，账户: $ACCOUNT_NAME"

    echo "获取用户列表..."
    USERS_RESPONSE=$(curl -sS -X GET \
        "$FEISHU_API_BASE/contact/v3/users?department_id=0&page_size=100&user_id_type=open_id" \
        -H "Authorization: Bearer $TOKEN")

    echo "$USERS_RESPONSE" | jq '.' > "$CACHE_USERS"
    echo "$USERS_RESPONSE" | jq -r '.data.items[] | "\(.open_id): \(.name)"' > "$CACHE_MAP"

    echo "获取群聊列表..."
    CHATS_RESPONSE=$(curl -sS -X GET \
        "$FEISHU_API_BASE/im/v1/chats?page_size=50&user_id_type=open_id" \
        -H "Authorization: Bearer $TOKEN")

    echo "$CHATS_RESPONSE" | jq '.' > "$CACHE_CHATS"

    USER_COUNT=$(echo "$USERS_RESPONSE" | jq '.data.items | length // 0')
    CHAT_COUNT=$(echo "$CHATS_RESPONSE" | jq '.data.items | length // 0')

    log "获取完成：$USER_COUNT 个用户，$CHAT_COUNT 个群聊"
    echo "✅ 通讯录已更新：$USER_COUNT 个用户，$CHAT_COUNT 个群聊（账户: $ACCOUNT_NAME）"
}

get_contacts() {
    require_cache "$CACHE_USERS"
    cat "$CACHE_USERS"
}

find_user() {
    local query="$1"
    local format="${2:-text}"
    local result=""

    require_cache "$CACHE_USERS"

    if [[ "$query" == ou_* ]]; then
        result=$(jq -c --arg query "$query" '.data.items[] | select(.open_id == $query)' "$CACHE_USERS")
    else
        result=$(jq -c --arg query "$query" '.data.items[] | select(.name | contains($query))' "$CACHE_USERS")
    fi

    if [ -z "$result" ]; then
        echo "❌ 未找到用户：$query"
        exit 1
    fi

    case "$format" in
        json)
            echo "$result" | jq '.'
            ;;
        open-id)
            echo "$result" | jq -r '.open_id'
            ;;
        name)
            echo "$result" | jq -r '.name'
            ;;
        *)
            echo "姓名: $(echo "$result" | jq -r '.name')"
            echo "Open ID: $(echo "$result" | jq -r '.open_id')"
            ;;
    esac
}

send_message() {
    local target="$1"
    local message="$2"
    local open_id=""

    if [ -z "$message" ]; then
        echo "❌ 错误：消息内容不能为空"
        exit 1
    fi

    get_account_info

    if [[ "$target" == oc_* ]]; then
        log "发送消息到群聊：$target（账户: $ACCOUNT_NAME）"
        openclaw message send \
            --channel feishu \
            --account "$ACCOUNT_NAME" \
            --target "$target" \
            --message "$message"
        return
    fi

    if [[ "$target" == ou_* ]]; then
        open_id="$target"
    else
        require_cache "$CACHE_USERS"
        open_id=$(
            jq -r --arg target "$target" '.data.items[] | select(.name == $target) | .open_id' "$CACHE_USERS" 2>/dev/null ||
                echo ""
        )

        if [ -z "$open_id" ]; then
            echo "❌ 未找到用户：$target"
            exit 1
        fi
    fi

    log "发送消息给用户：$target（账户: $ACCOUNT_NAME）"
    openclaw message send \
        --channel feishu \
        --account "$ACCOUNT_NAME" \
        --target "$open_id" \
        --message "$message"
}

list_users() {
    require_cache "$CACHE_USERS"
    echo "=== 用户列表 ==="
    jq -r '.data.items[] | "\(.name) | \(.open_id)"' "$CACHE_USERS" | nl
}

list_groups() {
    require_cache "$CACHE_CHATS"
    echo "=== 群聊列表 ==="
    jq -r '.data.items[] | "\(.name // "未命名") | \(.chat_id)"' "$CACHE_CHATS" | nl
}

show_summary() {
    local account_label="未配置"
    local doc_label="未配置"

    echo "=== 飞书通讯录摘要 ==="
    echo ""

    if get_account_info >/dev/null 2>&1; then
        account_label="${ACCOUNT_NAME:-$FEISHU_ACCOUNT}"
    fi
    if [ -n "$FEISHU_DOC_URL" ]; then
        doc_label="$FEISHU_DOC_URL"
    fi

    echo "当前账户: $account_label"
    echo ""

    if [ -f "$CACHE_USERS" ]; then
        USER_COUNT=$(jq '.data.items | length // 0' "$CACHE_USERS")
        echo "用户数量: $USER_COUNT"
    else
        echo "用户数量: 未缓存"
    fi

    if [ -f "$CACHE_CHATS" ]; then
        CHAT_COUNT=$(jq '.data.items | length // 0' "$CACHE_CHATS")
        echo "群聊数量: $CHAT_COUNT"
    else
        echo "群聊数量: 未缓存"
    fi

    echo ""
    echo "数据目录: $DATA_DIR"
    echo "共享文档: $SHARED_CONTACTS"
    echo "飞书文档: $doc_label"
}

get_group_members() {
    local group_id="$1"

    require_cache "$CACHE_CHATS"

    TOKEN=$(get_token)
    log "获取群成员：$group_id（账户: $ACCOUNT_NAME）"

    MEMBERS_RESPONSE=$(curl -sS -X GET \
        "$FEISHU_API_BASE/im/v1/chats/$group_id/members?page_size=50&user_id_type=open_id" \
        -H "Authorization: Bearer $TOKEN")

    MEMBER_COUNT=$(echo "$MEMBERS_RESPONSE" | jq '.data.items | length // 0')

    echo "群成员（$MEMBER_COUNT 人）："
    jq -r '.data.items[] | "\(.name // "未知") | \(.member_id)"' <<< "$MEMBERS_RESPONSE" | nl
}

show_help() {
    cat << EOF
飞书通讯录管理工具（支持多账户）

用法: $0 <命令> [参数]

环境变量:
  FEISHU_ACCOUNT              指定使用的飞书账户；未指定时优先读取账户文件默认项
  FEISHU_APP_ID               直接提供 App ID
  FEISHU_APP_SECRET           直接提供 App Secret
  FEISHU_APP_SECRET_PATH      从文件读取 App Secret
  FEISHU_ACCOUNTS_CONFIG      账户文件路径（默认: $ACCOUNTS_CONFIG）
  FEISHU_CONTACTS_DATA_DIR    缓存目录（默认: $DATA_DIR）
  FEISHU_CONTACTS_SHARED_DIR  共享目录（默认: $SHARED_DIR）
  FEISHU_CONTACTS_LOG_FILE    日志文件（默认: $LOG_FILE）
  FEISHU_CONTACTS_DOC_URL     共享飞书文档 URL（可选）

命令:
  fetch                       从飞书 API 获取最新通讯录
  get                         从本地缓存读取通讯录
  find <查询> [格式]          查找用户（支持姓名或 Open ID）
                              格式: text|json|open-id|name (默认: text)
  send <目标> <消息>          发送消息
                              目标可以是姓名、Open ID 或群聊 ID
  list                        列出所有用户
  groups                      列出所有群聊
  group-members <群ID>        获取群成员
  summary                     显示摘要信息
  accounts                    列出所有可用账户
  help                        显示帮助信息

示例:
  $0 fetch
  $0 find "示例用户"
  $0 find "ou_example_user_id" open-id
  $0 send "示例用户" "您好，这是一条测试消息。"
  $0 send "oc_example_chat_id" "团队通知"
  $0 group-members "oc_example_chat_id"
  $0 summary

  # 使用指定账户
  FEISHU_ACCOUNT=team-bot $0 fetch
  FEISHU_ACCOUNT=ops-bot $0 send "示例用户" "请确认任务状态。"

共享资源:
  共享通讯录: $SHARED_CONTACTS
  飞书文档: ${FEISHU_DOC_URL:-未配置，可通过 FEISHU_CONTACTS_DOC_URL 注入}
EOF
}

list_accounts() {
    if [ ! -f "$ACCOUNTS_CONFIG" ]; then
        echo "⚠️  未找到账户配置文件：$ACCOUNTS_CONFIG"
        echo "当前可通过 FEISHU_APP_ID / FEISHU_APP_SECRET 直接使用此技能。"
        return
    fi

    echo "=== 可用账户 ==="
    jq -r '.accounts | keys[]' "$ACCOUNTS_CONFIG" | nl
}

case "${1:-}" in
    fetch)
        fetch_contacts
        ;;
    get)
        get_contacts
        ;;
    find)
        if [ -z "${2:-}" ]; then
            echo "❌ 错误：请提供查询参数"
            show_help
            exit 1
        fi
        find_user "$2" "${3:-text}"
        ;;
    send)
        if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
            echo "❌ 错误：请提供目标和消息"
            show_help
            exit 1
        fi
        send_message "$2" "$3"
        ;;
    list)
        list_users
        ;;
    groups)
        list_groups
        ;;
    group-members)
        if [ -z "${2:-}" ]; then
            echo "❌ 错误：请提供群 ID"
            show_help
            exit 1
        fi
        get_group_members "$2"
        ;;
    summary)
        show_summary
        ;;
    accounts)
        list_accounts
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo "❌ 错误：未知命令 '$1'"
        echo ""
        show_help
        exit 1
        ;;
esac
