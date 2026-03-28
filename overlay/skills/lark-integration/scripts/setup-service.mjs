/**
 * Generate a macOS launchd plist to keep the Feishu bridge running.
 *
 * Usage:
 *   FEISHU_APP_ID=<your-app-id> node setup-service.mjs
 *
 * Then:
 *   launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.openclaw.feishu-bridge.plist
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_ID = process.env.FEISHU_APP_ID;
if (!APP_ID) {
  console.error("Please set FEISHU_APP_ID environment variable");
  process.exit(1);
}

const HOME = os.homedir();
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || `${HOME}/.openclaw`;
const NODE_PATH = process.execPath; // e.g. /opt/homebrew/bin/node
const BRIDGE_PATH = path.resolve(import.meta.dirname, "bridge-webhook.mjs");
const WORK_DIR = path.resolve(import.meta.dirname);
const LABEL = "com.openclaw.feishu-bridge";
const SECRET_PATH =
  process.env.FEISHU_APP_SECRET_PATH || `${OPENCLAW_HOME}/secrets/feishu_app_secret`;
const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || `${OPENCLAW_HOME}/openclaw.json`;
const LOG_DIR = `${OPENCLAW_HOME}/logs`;

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
      <string>${NODE_PATH}</string>
      <string>${BRIDGE_PATH}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${WORK_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>EnvironmentVariables</key>
    <dict>
      <key>HOME</key>
      <string>${HOME}</string>
      <key>PATH</key>
      <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
      <key>OPENCLAW_HOME</key>
      <string>${OPENCLAW_HOME}</string>
      <key>FEISHU_APP_ID</key>
      <string>${APP_ID}</string>
      <key>FEISHU_APP_SECRET_PATH</key>
      <string>${SECRET_PATH}</string>
      <key>OPENCLAW_CONFIG_PATH</key>
      <string>${CONFIG_PATH}</string>
    </dict>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/feishu-bridge.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/feishu-bridge.err.log</string>
  </dict>
</plist>
`;

// Ensure logs dir
fs.mkdirSync(LOG_DIR, { recursive: true });

const outPath = path.join(HOME, "Library", "LaunchAgents", `${LABEL}.plist`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, plist);
console.log(`✅ Wrote: ${outPath}`);
console.log();
console.log("To start the service:");
console.log(`  launchctl bootstrap gui/$UID ${outPath}`);
console.log();
console.log("To stop:");
console.log(`  launchctl bootout gui/$UID/${LABEL}`);
