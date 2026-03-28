# Lark Integration Setup Guide

## Step 1: Create Lark App

1. Go to [Lark Developer Console](https://open.larksuite.com/) or [Feishu Console](https://open.feishu.cn/)
2. Click "Create App" → "Custom App"
3. Fill in app name and description
4. Note your **App ID** and **App Secret**

## Step 2: Configure Permissions

Navigate to **Permissions & Scopes** and add:

**Required:**

- `im:message` - Receive messages
- `im:message:send_as_bot` - Send messages
- `im:resource` - Download images

**Optional (for document reading):**

- `docx:document:readonly`
- `wiki:wiki:readonly`
- `sheets:spreadsheet:readonly`
- `bitable:bitable:readonly`

Click "Apply" after adding scopes.

## Step 3: Set Up Server

```bash
# Create secrets directory inside the OpenClaw runtime root
mkdir -p "$HOME/.openclaw/secrets"

# Save app secret (replace with your actual secret)
echo "<your-app-secret>" > "$HOME/.openclaw/secrets/feishu_app_secret"

# Export runtime variables or render them from runtime-templates/skills/*
export FEISHU_APP_ID="<your-app-id>"
export FEISHU_APP_SECRET_PATH="$HOME/.openclaw/secrets/feishu_app_secret"
```

## Step 4: Start Bridge

```bash
cd overlay/skills/lark-integration/scripts
FEISHU_APP_ID="<your-app-id>" node bridge-webhook.mjs
```

On macOS, generate and load a `launchd` plist:

```bash
node setup-service.mjs
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.openclaw.feishu-bridge.plist
```

On Linux, create a `systemd` unit manually using the sample below.

## Step 5: Configure Webhook in Lark

1. In Lark Developer Console, go to **Event Subscriptions**
2. Set Request URL: `http://YOUR_SERVER_IP:3000/webhook`
3. Click "Verify" - should show success
4. Add event: `im.message.receive_v1`
5. Save changes

## Step 6: Enable Bot

1. Go to **Bot** section in console
2. Enable bot capability
3. Go to **Version Management**
4. Create and publish a version

## Step 7: Test

1. Find your bot in Lark and start a chat
2. Send "Hello"
3. Should receive a response from OpenClaw

## Firewall Notes

Ensure port 3000 is accessible from Lark servers:

```bash
ufw allow 3000/tcp
```

## Systemd Service File

`/etc/systemd/system/lark-bridge.service`:

```ini
[Unit]
Description=Lark to OpenClaw Bridge
After=network.target

[Service]
Type=simple
User=openclaw
Environment=OPENCLAW_HOME=/home/openclaw/.openclaw
Environment=FEISHU_APP_ID=<your-app-id>
Environment=FEISHU_APP_SECRET_PATH=/home/openclaw/.openclaw/secrets/feishu_app_secret
WorkingDirectory=/opt/openclaw/overlay/skills/lark-integration/scripts
ExecStart=/usr/bin/node /opt/openclaw/overlay/skills/lark-integration/scripts/bridge-webhook.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
