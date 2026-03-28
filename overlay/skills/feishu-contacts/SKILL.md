---
name: feishu-contacts
description: "飞书通讯录管理和消息发送。用于：(1) 读取员工和群聊信息 (2) 发送消息给用户或群聊 (3) 查找用户信息。运行态凭据和路径应通过 runtime-templates/skills 注入。"
metadata:
  { "openclaw": { "emoji": "📞", "requires": { "env": ["FEISHU_APP_ID", "FEISHU_APP_SECRET"] } } }
---

# 飞书通讯录管理技能

## 技能说明

提供飞书通讯录管理和消息发送功能，所有机器人都可以使用。

## 主要功能

### 1. 读取通讯录

从飞书 API 或本地缓存读取员工信息、群聊信息。

### 2. 发送消息

- 发送消息给指定用户
- 发送消息到群聊
- 支持通过 Open ID 精准投递

### 3. 查找用户

通过姓名或 Open ID 查找用户信息。

### 4. 群聊管理

- 获取群聊列表
- 获取群成员信息
- 发送消息到群聊

## 配置要求

### 必需环境变量

```bash
FEISHU_APP_ID="<your-feishu-app-id>"
FEISHU_APP_SECRET="<your-feishu-app-secret>"
```

### 可选环境变量

```bash
FEISHU_API_BASE="https://open.feishu.cn/open-apis"
FEISHU_ACCOUNT="<account-id>"
FEISHU_ACCOUNTS_CONFIG="<path-to-openclaw-feishu-accounts.json>"
FEISHU_CONTACTS_DATA_DIR="<cache-dir>"
FEISHU_CONTACTS_SHARED_DIR="<shared-dir>"
FEISHU_CONTACTS_LOG_FILE="<log-file>"
FEISHU_CONTACTS_DOC_URL="<shared-feishu-doc-url>"
```

### 依赖工具

- `curl`
- `jq`
- `openclaw`

## 使用方式

### 读取通讯录

```bash
feishu_contacts fetch
feishu_contacts get
feishu_contacts summary
```

### 查找用户

```bash
feishu_contacts find "示例用户"
feishu_contacts find "ou_example_user_id"
feishu_contacts list
```

### 发送消息

```bash
feishu_contacts send "示例用户" "您好！"
feishu_contacts send "oc_example_chat_id" "通知"
feishu_contacts send "ou_example_user_id" "消息"
```

## 数据存储

### 本地缓存

- 通讯录缓存：`${FEISHU_CONTACTS_DATA_DIR}/users_all.json`
- 群聊缓存：`${FEISHU_CONTACTS_DATA_DIR}/chats_all.json`
- Open ID 映射：`${FEISHU_CONTACTS_DATA_DIR}/openid_name_map.txt`

### 共享资源

- 完整通讯录：`${FEISHU_CONTACTS_SHARED_DIR}/CONTACTS.md`
- 飞书文档：`${FEISHU_CONTACTS_DOC_URL}`

## API 限制

### 权限要求

- `contact:contact.base:readonly`
- `im:message`

## 示例场景

### 发送工作分派消息

```bash
USER_ID=$(feishu_contacts find "示例用户" open-id)
feishu_contacts send "$USER_ID" "今日工作已分配"
```

## 版本信息

- 创建日期：2026-03-03
- 版本：1.0.0
