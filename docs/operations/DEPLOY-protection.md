# OpenClaw Agent 记忆保护机制

## 概述

此机制确保部署操作不会清除 Agent 的记忆和会话数据。示例中的备份根目录使用 `${BACKUP_ROOT:-/srv/openclaw-backups/openclaw}`。

## 核心原则

1. **禁止删除**：部署时绝不删除 `sessions/`、`memory/`、`workspace/` 目录
2. **先备份后操作**：任何服务器操作前必须备份到 `/data/backup`
3. **保护 skillsSnapshot**：不清理 sessions.json 中的技能快照

## 受保护的目录

```
${OPENCLAW_HOME:-~/.openclaw}/
├── agents/{agent_id}/
│   └── sessions/       # 会话数据 - 禁止删除
├── workspace/{agent_id}/
│   ├── memory/         # 工作区记忆 - 禁止删除
│   └── ...             # 工作空间输出 - 禁止删除
├── memory/             # 全局记忆 - 禁止删除
└── openclaw.json       # 主配置 - 更新前备份
```

## 备份目录结构

```
${BACKUP_ROOT:-/srv/openclaw-backups/openclaw}/
├── agents/              # Agent 备份
│   ├── main_20260301/
│   ├── pc-pctester_20260301/
│   └── ...
├── config/              # 配置备份
│   ├── openclaw_20260301.json
│   └── ...
├── memory/              # 记忆备份
│   └── memory_20260301/
└── logs/                # 部署日志
    └── deploy.log
```

## 部署前操作清单

```bash
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/openclaw-backups/openclaw}"

# 1. 创建备份目录
mkdir -p "${BACKUP_ROOT}"/{agents,config,memory,logs}

# 2. 备份配置文件
cp "$OPENCLAW_HOME/openclaw.json" "${BACKUP_ROOT}/config/openclaw_$(date +%Y%m%d_%H%M%S).json"

# 3. 备份所有 agents 的会话数据
for agent_dir in "$OPENCLAW_HOME"/agents/*/; do
    agent_id=$(basename "$agent_dir")
    backup_dir="${BACKUP_ROOT}/agents/${agent_id}_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"

    # 只备份关键目录，不删除原文件
    [ -d "${agent_dir}/sessions" ] && cp -r "${agent_dir}/sessions" "$backup_dir/"
    [ -d "${OPENCLAW_HOME}/workspace/${agent_id}" ] && cp -r "${OPENCLAW_HOME}/workspace/${agent_id}" "$backup_dir/workspace"
done

# 4. 备份全局记忆
cp -r "$OPENCLAW_HOME/memory" "${BACKUP_ROOT}/memory_$(date +%Y%m%d_%H%M%S)/"

# 5. 记录部署日志
echo "$(date): Pre-deploy backup completed" >> "${BACKUP_ROOT}/logs/deploy.log"
```

## 部署后恢复（如需要）

```bash
# 恢复特定 agent 的会话数据
restore_agent() {
    local agent_id=$1
    local openclaw_home="${OPENCLAW_HOME:-$HOME/.openclaw}"
    local backup_root="${BACKUP_ROOT:-/srv/openclaw-backups/openclaw}"
    local agent_dir="${openclaw_home}/agents/${agent_id}"
    local workspace_dir="${openclaw_home}/workspace/${agent_id}"
    local backup_dir="${backup_root}/agents/${agent_id}_LATEST"

    # 只恢复不存在的目录，不覆盖现有数据
    [ ! -d "${agent_dir}/sessions" ] && [ -d "${backup_dir}/sessions" ] && cp -r "${backup_dir}/sessions" "${agent_dir}/"
    [ ! -d "${workspace_dir}" ] && [ -d "${backup_dir}/workspace" ] && cp -r "${backup_dir}/workspace" "${workspace_dir}"
}

# 恢复所有 agents
for agent in main cto dev tester ops pc-pm pc-backend pc-frontend pc-pctester pc-ceo_assistant pc-code_reviewer pc-devops; do
    restore_agent "$agent"
done
```

## 禁止的操作

```bash
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"

# ❌ 禁止：删除会话目录
rm -rf "${OPENCLAW_HOME}"/agents/*/sessions

# ❌ 禁止：删除记忆文件
rm -rf "${OPENCLAW_HOME}"/memory/*.sqlite

# ❌ 禁止：清空 sessions.json
echo '{}' > "${OPENCLAW_HOME}"/agents/*/sessions/sessions.json

# ❌ 禁止：不备份直接修改配置
# 必须先备份到 ${BACKUP_ROOT}
```

## 服务操作规范

### 重启网关

```bash
# 标准重启流程
pkill -9 -f openclaw-gateway || true
sleep 2
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

### 更新 openclaw

```bash
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/openclaw-backups/openclaw}"

# 1. 备份配置
cp "$OPENCLAW_HOME/openclaw.json" "${BACKUP_ROOT}/config/openclaw_$(date +%Y%m%d_%H%M%S).json"

# 2. 更新软件
sudo npm i -g openclaw@latest

# 3. 验证配置未丢失
openclaw skills list | grep -i browser

# 4. 重启网关
pkill -9 -f openclaw-gateway || true
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

## 服务器信息

- **网关主机**: `ssh user@gateway-host`
- **网关日志**: `/tmp/openclaw-gateway.log`
- **网关端口**: 18789
- **备份目录**: `${BACKUP_ROOT:-/srv/openclaw-backups/openclaw}`
