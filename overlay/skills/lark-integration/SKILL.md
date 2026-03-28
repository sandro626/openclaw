---
name: lark-integration
description: Connect Lark (Feishu) messaging to OpenClaw via webhook bridge. Supports text, rich text (post), and image messages bidirectionally. Use when setting up Lark/Feishu as a messaging channel, receiving messages with images, sending replies back to Lark, reading Lark documents/wikis/bitables, or troubleshooting Lark integration issues. Covers both Lark International (larksuite.com) and China Feishu (feishu.cn).
metadata: { "openclaw": { "requires": { "env": ["FEISHU_APP_ID"] } } }
---

# Lark Integration

Connect Lark (Feishu) to OpenClaw for bidirectional messaging with full rich content support.

## Quick Start

```bash
# 1. Export credentials or render them from runtime-templates/skills/*
export FEISHU_APP_ID="<your-app-id>"
export FEISHU_APP_SECRET_PATH="$HOME/.openclaw/secrets/feishu_app_secret"

# 2. Start bridge
cd overlay/skills/lark-integration/scripts
node bridge-webhook.mjs

# 3. Configure Lark webhook URL in developer console
# https://open.larksuite.com → Your App → Event Subscriptions
# URL: http://YOUR_SERVER_IP:3000/webhook
```

## Architecture

```
Lark App ──webhook──► Bridge (port 3000) ──WebSocket──► OpenClaw Gateway
                           │                                   │
                           ◄────────── Reply ──────────────────┘
```

## Supported Message Types

| Type    | Direction | Format                             |
| ------- | --------- | ---------------------------------- |
| `text`  | ↔ Both    | Plain text                         |
| `post`  | → Receive | Rich text with images, links       |
| `image` | → Receive | Single image                       |
| Reply   | ← Send    | Text (cards via feishu-card skill) |

## Platform Detection

The bridge auto-detects platform from URLs:

- `*.larksuite.com` → `https://open.larksuite.com` (International)
- `*.feishu.cn` → `https://open.feishu.cn` (China)

## Configuration

### Environment Variables

| Variable                       | Required | Description                                                               |
| ------------------------------ | -------- | ------------------------------------------------------------------------- |
| `FEISHU_APP_ID`                | Yes      | App ID from Lark Developer Console                                        |
| `FEISHU_APP_SECRET_PATH`       | No       | Path to secret file (default: `$OPENCLAW_HOME/secrets/feishu_app_secret`) |
| `WEBHOOK_PORT`                 | No       | Webhook listen port (default: 3000)                                       |
| `FEISHU_THINKING_THRESHOLD_MS` | No       | Delay before "Thinking..." placeholder (default: 2500)                    |
| `FEISHU_ENCRYPT_KEY`           | No       | Encryption key if enabled in Lark                                         |
| `OPENCLAW_AGENT_ID`            | No       | Agent to route messages to (default: main)                                |
| `OPENCLAW_HOME`                | No       | OpenClaw runtime root (default: `~/.openclaw`)                            |
| `OPENCLAW_CONFIG_PATH`         | No       | Explicit OpenClaw config path                                             |

### Lark App Permissions

Enable these scopes in Lark Developer Console → Permissions & Scopes:

**Messaging:**

- `im:message` - Send and receive messages
- `im:message:send_as_bot` - Send messages as bot
- `im:resource` - Download message resources (images)

**Documents (optional):**

- `docx:document:readonly` - Read documents
- `wiki:wiki:readonly` - Read wiki spaces
- `sheets:spreadsheet:readonly` - Read spreadsheets
- `bitable:bitable:readonly` - Read bitables
- `drive:drive:readonly` - Access drive files

## Scripts

### bridge-webhook.mjs

Main webhook bridge. Receives Lark events, forwards to OpenClaw, sends replies.

```bash
FEISHU_APP_ID=<your-app-id> node scripts/bridge-webhook.mjs
```

### setup-service.mjs

Generate a macOS `launchd` plist for auto-start:

```bash
node scripts/setup-service.mjs
# Creates ~/Library/LaunchAgents/com.openclaw.feishu-bridge.plist
```

For Linux, use the sample unit in `references/setup-guide.md` and substitute your own runtime paths.

## Image Handling

Images in messages are:

1. Detected from `post` content or `image` message type
2. Downloaded via Lark API using `message_id` and `image_key`
3. Converted to base64
4. Sent to OpenClaw Gateway as `attachments` parameter

```javascript
attachments: [{ mimeType: "image/png", content: "<base64>" }];
```

## Group Chat Behavior

In group chats, the bridge responds when:

- Bot is @mentioned
- Message ends with `?` or `？`
- Message contains trigger words: help, please, why, how, what, 帮, 请, 分析, etc.
- Message starts with bot name

Otherwise, messages are ignored to avoid noise.

## Reading Documents

Use the `feishu-doc` skill to read Lark documents:

```bash
node skills/feishu-doc/index.js fetch "https://xxx.larksuite.com/docx/TOKEN"
```

Supported URL types:

- `/docx/` - New documents
- `/wiki/` - Wiki pages (auto-resolves to underlying doc)
- `/sheets/` - Spreadsheets
- `/base/` - Bitables (multi-dimensional tables)

**Permission Note:** Documents must be shared with the bot, or the bot must have tenant-wide read permission.

## Troubleshooting

### "forBidden" error when reading docs

- Document not shared with bot → Add bot as collaborator
- Missing scope → Enable `docx:document:readonly` in console

### No messages received

- Check webhook URL is accessible: `curl http://YOUR_IP:3000/health`
- Verify webhook in Lark console shows "Verified"
- Check bridge logs: `journalctl -u lark-bridge -f`

### "must be string" error

- Old bridge version → Update to use `attachments` for images

### Images not received

- Missing `im:resource` scope → Enable in Lark console
- Token expired → Bridge auto-refreshes, restart if stuck

## Service Management

```bash
# Check status
systemctl status lark-bridge

# View logs
journalctl -u lark-bridge -f

# Restart
systemctl restart lark-bridge
```

## References

- [Lark Developer Console](https://open.larksuite.com/) (International)
- [Feishu Developer Console](https://open.feishu.cn/) (China)
- See `references/api-formats.md` for message format details
- See `references/setup-guide.md` for step-by-step setup
