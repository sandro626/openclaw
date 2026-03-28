# 飞书通讯录技能使用示例

## 快速开始

### 首次拉取通讯录

```bash
feishu_contacts fetch
```

### 查看摘要

```bash
feishu_contacts summary
```

### 列出用户与群聊

```bash
feishu_contacts list
feishu_contacts groups
```

## 查找用户

### 通过姓名查找

```bash
feishu_contacts find "示例用户"
# 输出:
# 姓名: 示例用户
# Open ID: ou_example_user_id
```

### 获取 Open ID

```bash
USER_ID=$(feishu_contacts find "示例用户" open-id)
echo "$USER_ID"
```

### 通过 Open ID 查找

```bash
feishu_contacts find "ou_example_user_id"
```

### 获取 JSON 结果

```bash
feishu_contacts find "示例用户" json
```

## 发送消息

### 发送给指定用户

```bash
feishu_contacts send "示例用户" "您好！今日工作已分配。"
```

### 使用 Open ID 发送

```bash
feishu_contacts send "ou_example_user_id" "消息内容"
```

### 发送到群聊

```bash
feishu_contacts send "oc_example_chat_id" "通知内容"
```

## 场景示例

### 早间群通知

```bash
#!/bin/bash

GROUP_ID="oc_example_chat_id"
feishu_contacts send "$GROUP_ID" "早安，请查看今日任务板。"
```

### 通知指定角色

```bash
#!/bin/bash

PRODUCT_MANAGER_ID=$(feishu_contacts find "产品经理" open-id)
feishu_contacts send "$PRODUCT_MANAGER_ID" "新需求文档已发布，请查阅。"
```

### 批量提醒

```bash
#!/bin/bash

MEMBERS=("产品经理" "后端开发" "前端开发")

for member in "${MEMBERS[@]}"; do
    feishu_contacts send "$member" "会议将在 30 分钟后开始，请准时参加。"
    sleep 1
done
```

### 查看群成员

```bash
feishu_contacts group-members "oc_example_chat_id"
```

## 集成到其他脚本

### 在 Bash 脚本中调用

```bash
#!/bin/bash

USER_ID=$(feishu_contacts find "示例用户" open-id)
openclaw message send \
    --channel feishu \
    --account "${FEISHU_ACCOUNT:-default}" \
    --target "$USER_ID" \
    --message "消息内容"
```

### 在 Python 脚本中调用

```python
import subprocess

def send_feishu_message(user, message):
    cmd = ["feishu_contacts", "send", user, message]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0

send_feishu_message("示例用户", "您好！")
```

## 定时更新

```bash
# 每天凌晨 2 点更新通讯录
0 2 * * * feishu_contacts fetch
```

## 最佳实践

1. 定期刷新缓存，避免使用过期通讯录。
2. 自动化脚本优先使用 Open ID，避免姓名重名。
3. 把凭据、账户文件路径和共享文档 URL 放进 runtime 模板，不要写回源码目录。
4. 如需排障，优先查看 `FEISHU_CONTACTS_LOG_FILE` 指定的日志文件。

## 相关资源

- `SKILL.md`
- `README.md`
- `runtime-templates/skills/base.json`
- `runtime-templates/skills/env.example`
