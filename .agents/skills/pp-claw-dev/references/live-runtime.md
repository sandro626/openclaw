# Live Runtime — tencent-101

## Server Access

- **SSH alias**: `tencent-101`
- **Active code tree**: `/home/ubuntu/projects/openclaw`
- **Runtime root**: `/root/.openclaw`
- **Service**: `openclaw-gateway.service`
- **Gateway port**: `18789`
- **Gateway log**: `/tmp/openclaw-gateway.log`

## Server Environment

- **OS**: Ubuntu on Tencent Cloud
- **Node**: v22+
- **openclaw binary**: symlink `/usr/local/bin/openclaw` → `/home/ubuntu/projects/openclaw/openclaw.mjs`
- **安装方式**: 本地 checkout（非 npm 全局安装），所以升级用 `git pull` + rsync，不是 `npm i -g`
- **systemd override**: `/etc/systemd/system/openclaw-gateway.service.d/env.conf`
  - `MINIMAX_API_KEY=sk-cp-...`（CN key）
  - `MODELSTUDIO_API_KEY=sk-...`（阿里云 DashScope）
- **配置文件**: `/root/.openclaw/openclaw.json`（runtime 层，不在代码树里）

## Agent Runtime State

- **Agent 目录**: `/root/.openclaw/agents/<agentId>/`
  - `sessions/` — 会话数据（**禁止删除**）
  - `memory/` — 记忆数据（**禁止删除**）
  - `workspace/` — 工作空间（**禁止删除**）
- **当前 agents**（22 个）: main, cto, dev, tester, ops, pc-pm, pc-backend, pc-frontend, pc-pctester, pc-ceo_assistant, pc-code_reviewer, pc-devops, pc-ip_expert, pc-ai-pythondev, pc-yz-app-aidev, pc-yz-app-appdev, pc-yz-app-javadev, pc-yz-app-pm, yz-app-pm, yz-app-javadev, yz-app-appdev, yz-app-aidev
- **所有 agent 默认模型**: `minimax/MiniMax-M2.7`（使用 CN endpoint `api.minimaxi.com/anthropic`）

## Three-Layer Architecture

| Layer             | Location                       | 内容                                   | 规则                                          |
| ----------------- | ------------------------------ | -------------------------------------- | --------------------------------------------- |
| **core/upstream** | `src/`, `extensions/`, `docs/` | upstream 开源代码                      | 跟随 upstream 升级，不做破坏性修改            |
| **overlay**       | `overlay/`                     | 私有资产（agents、skills、extensions） | 独立管理，不受 upstream 影响                  |
| **runtime**       | `/root/.openclaw/` on server   | 运行时状态                             | **绝对不能动**（sessions、memory、workspace） |

### Layering Verification

```bash
pnpm check:repo-layering
```

## Deploy Flow

### Recommended: Assembly-based deploy（推荐）

```bash
# 1. Build core
pnpm build

# 2. Generate overlay-aware bundle
pnpm ops:assemble -- --output-root .artifacts/ops/prod --environment prod --allow-unresolved-env

# 3. Sync assembled output to server
#    - core dist/ → server code tree
#    - overlay/ → server overlay
#    - rendered config → runtime config

# 4. Seed workspace static skeletons (不会覆盖 memory/sessions)
ssh tencent-101 "sudo rsync -av --no-i-r /home/ubuntu/projects/openclaw/overlay/ /root/.openclaw/overlay/ 2>/dev/null || true"

# 5. Restart and verify
ssh tencent-101 "sudo systemctl daemon-reload && sudo systemctl restart openclaw-gateway.service"
```

### Legacy: Direct rsync（过渡期）

```bash
# 1. Build locally
pnpm build

# 2. Sync dist (core code)
rsync -av --no-i-r dist/ tencent-101:/home/ubuntu/projects/openclaw/dist/

# 3. Sync extensions (plugins/channels)
rsync -av --no-i-r extensions/ tencent-101:/home/ubuntu/projects/openclaw/extensions/

# 4. Restart gateway
ssh tencent-101 "sudo systemctl daemon-reload && sudo systemctl restart openclaw-gateway.service"
```

### ⚠️ Deploy Rules

- **禁止** `rsync --delete`（会删除服务器上的文件）
- **禁止**删除 `/root/.openclaw/agents/*/sessions/`、`memory/`、`workspace/`
- 部署前**备份**到 `/data/backup/openclaw/`
- `npm install` 会覆盖 `dist/` 但**不会**覆盖 `extensions/`
- 如果改了 config schema 或 plugin SDK，必须 `pnpm build` 后同步整个 `dist/`

## Gateway Management

```bash
# Status
ssh tencent-101 "sudo systemctl status openclaw-gateway.service --no-pager"

# Logs
ssh tencent-101 "sudo journalctl -u openclaw-gateway.service -n 120 --no-pager"

# Restart
ssh tencent-101 "sudo systemctl daemon-reload && sudo systemctl restart openclaw-gateway.service"

# Check process
ssh tencent-101 "sudo ps aux | grep openclaw | grep -v grep"
ssh tencent-101 "sudo ss -tlnp | grep 18789"
```

## Health Checks

```bash
ssh tencent-101 "sudo openclaw health"
ssh tencent-101 "sudo openclaw models list"
ssh tencent-101 "sudo openclaw channels status --probe"
ssh tencent-101 "sudo openclaw plugins list"
```

## Smoke Pattern

After deploy, test:

1. `main` agent（核心功能）
2. one `pc-*` agent（私有 agent）
3. one `yz-app-*` agent（业务 agent）

## MiniMax Live Rule

- Provider: `minimax`（不是 `minimax-cn`）
- Base URL: `https://api.minimaxi.com/anthropic`（CN endpoint）
- API: `anthropic-messages`
- `authHeader: false`（Anthropic 兼容模式用 x-api-key，不用 Bearer）
- API Key: 在 systemd env override 里（`MINIMAX_API_KEY`），不在 `openclaw.json` 里
- Global key base URL: `https://api.minimax.io/anthropic`
- `models: []` in config is OK — plugin registers models at runtime

## Useful Live Checks

```bash
# Check provider config
ssh tencent-101 "sudo python3 -c \"import json; d=json.load(open('/root/.openclaw/openclaw.json')); print(json.dumps(d.get('models',{}).get('providers',{}), indent=2))\""

# Check agent list and models
ssh tencent-101 "sudo python3 -c \"import json; d=json.load(open('/root/.openclaw/openclaw.json')); [print(f'{a[\\\"id\\\"]}: {a.get(\\\"model\\\",{}).get(\\\"primary\\\",\\\"default\\\")}') for a in d.get('agents',{}).get('list',[])]\""

# Check systemd env
ssh tencent-101 "sudo cat /etc/systemd/system/openclaw-gateway.service.d/env.conf"

# Check gateway log for errors
ssh tencent-101 "sudo journalctl -u openclaw-gateway.service --since '5 min ago' --no-pager | grep -i error | tail -20"
```

## Troubleshooting

### "Unknown model: minimax-cn/MiniMax-M2.7"

Provider 名称不对。配置里应该用 `minimax`（不是 `minimax-cn`）。CN/Global 区别靠 `baseUrl`，不是 provider name。

### "Unknown model: minimax/MiniMax-M2.7"

1. 检查 minimax extension 是否加载：`journalctl | grep minimax`
2. 检查 `models: []` 是否为空（可以为空，插件运行时注册）
3. 检查 `baseUrl` 是否正确指向 CN endpoint

### session/update RPC error

客户端侧问题，检查 acpx 版本和 Claude Code 版本兼容性。

### npm install overwrites dist

`sudo npm i -g openclaw@latest` 会覆盖 `dist/`。之后需要重新 rsync 本地 dist。

## Rollback

```bash
# 恢复 npm 版本
ssh tencent-101 "sudo npm i -g openclaw@latest"

# 重新同步 extensions
rsync -av --no-i-r extensions/ tencent-101:/home/ubuntu/projects/openclaw/extensions/

# 重启
ssh tencent-101 "sudo systemctl restart openclaw-gateway.service"
```
