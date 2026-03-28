# 飞书通讯录管理技能

## 技能简介

为 OpenClaw 机器人提供统一的飞书通讯录读取、用户检索和消息发送能力。

此目录只保留脚本与说明，不再保存真实 App ID、App Secret、账户文件路径或具体业务联系人。运行态参数统一由 `runtime-templates/skills/*` 渲染进 `skills.entries.feishu-contacts.env`。

## 目录结构

```text
overlay/skills/feishu-contacts/
├── SKILL.md
├── README.md
├── EXAMPLES.md
└── feishu_contacts.sh
```

## 快速开始

```bash
feishu_contacts help
feishu_contacts fetch
feishu_contacts find "示例用户"
feishu_contacts send "示例用户" "消息内容"
```

## 运行态配置

必需环境变量：

```bash
FEISHU_APP_ID=
FEISHU_APP_SECRET=
```

常用可选变量：

```bash
FEISHU_ACCOUNT=
FEISHU_ACCOUNTS_CONFIG=
FEISHU_API_BASE=https://open.feishu.cn/open-apis
FEISHU_CONTACTS_DATA_DIR=
FEISHU_CONTACTS_SHARED_DIR=
FEISHU_CONTACTS_LOG_FILE=
FEISHU_CONTACTS_DOC_URL=
```

推荐把这些值写入：

- `runtime-templates/skills/base.json`
- `runtime-templates/skills/environments/<env>.json`
- 部署时对应的环境变量或密钥文件

## 默认路径行为

如果没有显式覆盖，脚本会使用：

- 账户文件：`$HOME/.openclaw/openclaw-feishu-accounts.json`
- 缓存目录：`$HOME/.openclaw/cache/feishu-contacts`
- 共享目录：`$HOME/.openclaw/shared`
- 日志文件：`$HOME/.openclaw/logs/feishu-contacts.log`

## 能力范围

- 从飞书 API 拉取用户和群聊缓存
- 通过姓名或 Open ID 查找用户
- 列出用户和群聊
- 查询群成员
- 通过 OpenClaw CLI 向用户或群聊发送消息

## 故障排除

### 无法获取 token

- 检查 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`
- 如果使用密钥文件，检查 `FEISHU_APP_SECRET_PATH`
- 查看日志文件 `FEISHU_CONTACTS_LOG_FILE`

### 找不到用户

- 先运行 `feishu_contacts fetch`
- 确认缓存目录 `FEISHU_CONTACTS_DATA_DIR` 正确
- 优先使用 Open ID 避免同名歧义

### 消息发送失败

- 确认飞书机器人权限完整
- 确认目标 Open ID 或 chat ID 正确
- 检查 `openclaw message send` 在当前 runtime 是否可用

## 相关资源

- `SKILL.md`
- `EXAMPLES.md`
- `runtime-templates/skills/base.json`
- `runtime-templates/skills/env.example`
- https://open.feishu.cn
