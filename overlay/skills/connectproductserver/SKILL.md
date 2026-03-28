---
name: connectproductserver
description: 连接产品运行环境的 SSH 指南技能。用于通过跳板机连接日志主机或应用主机，查看日志、检查服务状态和执行只读排障。所有主机、用户和 SSH key 路径必须通过 runtime-templates/skills 注入。
metadata:
  openclaw:
    emoji: "🛰️"
    requires:
      env:
        - CONNECT_PRODUCT_JUMP_HOST
        - CONNECT_PRODUCT_JUMP_USER
        - CONNECT_PRODUCT_SSH_KEY_PATH
        - CONNECT_PRODUCT_LOG_HOST
        - CONNECT_PRODUCT_LOG_USER
        - CONNECT_PRODUCT_APP_HOST
        - CONNECT_PRODUCT_APP_USER
---

# Connect Product Server

这个技能提供连接产品运行环境的标准入口，适合查看日志、核对服务状态和执行只读排障。

## 使用原则

- 默认优先执行只读操作
- 跳板机、目标主机、用户和密钥路径全部来自环境变量
- 需要重启或变更服务时，先向用户确认

## 运行态配置

### 必需环境变量

```bash
CONNECT_PRODUCT_JUMP_HOST="<jump-host>"
CONNECT_PRODUCT_JUMP_USER="<jump-user>"
CONNECT_PRODUCT_SSH_KEY_PATH="<ssh-key-path>"
CONNECT_PRODUCT_LOG_HOST="<log-host>"
CONNECT_PRODUCT_LOG_USER="<log-user>"
CONNECT_PRODUCT_APP_HOST="<app-host>"
CONNECT_PRODUCT_APP_USER="<app-user>"
```

### 可选环境变量

```bash
CONNECT_PRODUCT_LOG_DIR="${CONNECT_PRODUCT_LOG_DIR:-/var/log/app}"
CONNECT_PRODUCT_APP_SERVICE="${CONNECT_PRODUCT_APP_SERVICE:-openclaw-app}"
```

## 常用命令

### 连接日志主机

```bash
ssh -J "${CONNECT_PRODUCT_JUMP_USER}@${CONNECT_PRODUCT_JUMP_HOST}" \
  -i "${CONNECT_PRODUCT_SSH_KEY_PATH}" \
  "${CONNECT_PRODUCT_LOG_USER}@${CONNECT_PRODUCT_LOG_HOST}"
```

### 查看日志目录

```bash
ssh -J "${CONNECT_PRODUCT_JUMP_USER}@${CONNECT_PRODUCT_JUMP_HOST}" \
  -i "${CONNECT_PRODUCT_SSH_KEY_PATH}" \
  "${CONNECT_PRODUCT_LOG_USER}@${CONNECT_PRODUCT_LOG_HOST}" \
  "ls -lah ${CONNECT_PRODUCT_LOG_DIR}"
```

### 跟随应用日志

```bash
ssh -J "${CONNECT_PRODUCT_JUMP_USER}@${CONNECT_PRODUCT_JUMP_HOST}" \
  -i "${CONNECT_PRODUCT_SSH_KEY_PATH}" \
  "${CONNECT_PRODUCT_LOG_USER}@${CONNECT_PRODUCT_LOG_HOST}" \
  "tail -100f ${CONNECT_PRODUCT_LOG_DIR}/*.log"
```

### 连接应用主机

```bash
ssh -J "${CONNECT_PRODUCT_JUMP_USER}@${CONNECT_PRODUCT_JUMP_HOST}" \
  -i "${CONNECT_PRODUCT_SSH_KEY_PATH}" \
  "${CONNECT_PRODUCT_APP_USER}@${CONNECT_PRODUCT_APP_HOST}"
```

### 查看服务状态

```bash
ssh -J "${CONNECT_PRODUCT_JUMP_USER}@${CONNECT_PRODUCT_JUMP_HOST}" \
  -i "${CONNECT_PRODUCT_SSH_KEY_PATH}" \
  "${CONNECT_PRODUCT_APP_USER}@${CONNECT_PRODUCT_APP_HOST}" \
  "sudo systemctl status ${CONNECT_PRODUCT_APP_SERVICE}"
```

### 查看服务日志

```bash
ssh -J "${CONNECT_PRODUCT_JUMP_USER}@${CONNECT_PRODUCT_JUMP_HOST}" \
  -i "${CONNECT_PRODUCT_SSH_KEY_PATH}" \
  "${CONNECT_PRODUCT_APP_USER}@${CONNECT_PRODUCT_APP_HOST}" \
  "journalctl -u ${CONNECT_PRODUCT_APP_SERVICE} -f"
```

## 推荐工作流

1. 先确认目标是查日志还是查服务状态
2. 日志问题优先走日志主机
3. 服务问题优先走应用主机并先执行只读检查
4. 需要重启、部署或修改配置时先征求确认

## 排障建议

- 连接失败时，先检查 `${CONNECT_PRODUCT_SSH_KEY_PATH}` 是否存在且权限正确
- 如果跳板机不可达，先验证到 `${CONNECT_PRODUCT_JUMP_HOST}` 的 SSH 连通性
- 如果日志目录为空，确认 `${CONNECT_PRODUCT_LOG_DIR}` 是否指向当前服务实际输出目录
