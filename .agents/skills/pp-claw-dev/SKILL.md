---
name: pp-claw-dev
description: |
  OpenClaw 网关平台开发与 tencent-101 服务器部署助手。覆盖三层仓库结构管理（src→dist/extensions/overlay）、
  本地构建、装配式部署、upstream 合并、MiniMax CN 配置、Agent 运维。
---

# PP Claw Dev — OpenClaw 开发与部署

## 核心定位

OpenClaw fork 仓库的开发、构建、部署和运维技能。管理三层架构（upstream/overlay/runtime），本地构建后部署到 tencent-101 服务器。

## 三层架构

| Layer | 位置 | 内容 | 规则 |
|-------|------|------|------|
| **core/upstream** | `src/`, `extensions/`, `docs/` | upstream 开源代码 | 跟随 upstream 升级 |
| **overlay** | `overlay/` | 私有资产（agents、skills、extensions） | 独立管理，不受 upstream 影响 |
| **runtime** | 服务器 `/root/.openclaw/` | 运行时状态 | **绝对不能动** |

验证: `pnpm check:repo-layering`

## 服务器: tencent-101

| 项 | 值 |
|------|------|
| SSH | `ssh tencent-101` |
| 代码树 | `/home/ubuntu/projects/openclaw`（local checkout symlink，非 npm install） |
| Runtime | `/root/.openclaw` |
| 服务 | `openclaw-gateway.service` |
| 端口 | `18789` |
| 日志 | `/tmp/openclaw-gateway.log` |
| 二进制 | symlink `/usr/local/bin/openclaw` → 代码树 `openclaw.mjs` |
| API Keys | systemd env `/etc/systemd/system/openclaw-gateway.service.d/env.conf` |
| 配置文件 | `/root/.openclaw/openclaw.json`（⚠️ 不是 `/home/ubuntu/.claude/openclaw.json`） |

### API Keys（systemd env 里，不在 openclaw.json）

- `MINIMAX_API_KEY=sk-cp-...`（CN key）
- `MODELSTUDIO_API_KEY=sk-...`（阿里云 DashScope embeddings）

### Agent 运行时（22 个 agents）

- **目录**: `/root/.openclaw/agents/<agentId>/`
- **禁止删除**: `sessions/`、`memory/`、`workspace/`
- **列表**: main, cto, dev, tester, ops, pc-pm, pc-backend, pc-frontend, pc-pctester, pc-ceo_assistant, pc-code_reviewer, pc-devops, pc-ip_expert, pc-ai-pythondev, pc-yz-app-aidev, pc-yz-app-appdev, pc-yz-app-javadev, pc-yz-app-pm, yz-app-pm, yz-app-javadev, yz-app-appdev, yz-app-aidev
- **默认模型**: `minimax/MiniMax-M2.7`（CN endpoint `api.minimaxi.com/anthropic`）

## MiniMax 配置

- Provider name: `minimax`（不是 `minimax-cn`，CN/Global 靠 baseUrl 区分）
- CN endpoint: `https://api.minimaxi.com/anthropic`
- Global endpoint: `https://api.minimax.io/anthropic`
- API: `anthropic-messages`, `authHeader: false`（x-api-key, not Bearer）
- API Key: 在 systemd env 里，不在 `openclaw.json` 里
- `models: []` 在配置里可以 — 插件运行时注册模型
- `minimax-cn` 和 `minimax-portal` 不是有效的 provider name

## 构建流程

```bash
pnpm install                  # 安装依赖
pnpm build                    # TypeScript 编译 → dist/
pnpm check                    # lint + typecheck + format
pnpm check:repo-layering      # 三层架构验证
```

## 部署流程

### 推荐: 装配式部署

```bash
# 1. 本地构建
pnpm build

# 2. 生成 overlay-aware 部署 bundle
pnpm ops:assemble -- --output-root .artifacts/ops/prod --environment prod --allow-unresolved-env

# 3. 同步到服务器（assembled output 包含 core + overlay + rendered config）
#    具体 rsync 命令根据 bundle 结构确定

# 4. 重启
ssh tencent-101 "sudo systemctl daemon-reload && sudo systemctl restart openclaw-gateway.service"
```

### 过渡期: 直接 rsync

```bash
# 1. 构建
pnpm build

# 2. 同步 dist（核心代码）
rsync -av --no-i-r dist/ tencent-101:/home/ubuntu/projects/openclaw/dist/

# 3. 同步 extensions（插件/频道）
rsync -av --no-i-r extensions/ tencent-101:/home/ubuntu/projects/openclaw/extensions/

# 4. 重启
ssh tencent-101 "sudo systemctl daemon-reload && sudo systemctl restart openclaw-gateway.service"
```

### Skills 同步

```bash
rsync -av ~/dev/openclaw-main/overlay/skills/ tencent-101:/tmp/skills-sync/
ssh tencent-101 'sudo rsync -av /tmp/skills-sync/ /root/.openclaw/skills/'
ssh tencent-101 'sudo systemctl restart openclaw-gateway'
```

### 部署铁律

- **禁止** `rsync --delete`（会删除服务器上的文件）
- **禁止**删除 `/root/.openclaw/agents/*/sessions/`、`memory/`、`workspace/`
- 部署前备份到 `/data/backup/openclaw/`
- `npm install` 会覆盖 `dist/` 但不会覆盖 `extensions/`
- 改了 config schema 或 plugin SDK 必须重新 `pnpm build` 再同步整个 `dist/`

## Upstream 合并规则

之前是 squash merge（单 parent），导致 git 不追踪 upstream 历史。正确步骤：

```bash
# 1. fetch upstream
git fetch upstream --tags

# 2. 建立正确的 merge parent（-s ours 保持本地 tree，添加 upstream 为 parent2）
git merge -s ours <upstream-version-commit> --no-edit -m "Establish merge parent: upstream 2026.x.x baseline"

# 3. 合并真正的增量
git merge upstream/main --no-commit --no-ff

# 4. 解决冲突：
#    - 非本地修改的文件 → 取 upstream（git checkout --theirs）
#    - 本地修改的文件 → 恢复（git checkout HEAD -- <file>）

# 5. 验证 + 提交
pnpm check:repo-layering
git add -A && git commit --no-verify -m "Merge upstream ..."
```

### 我们在 core 里的本地修改（合并后需恢复）

| 文件 | 修改内容 |
|------|----------|
| `extensions/minimax/onboard.ts` | `authHeader: true → false` |
| `extensions/minimax/onboard.test.ts` | 测试期望值 `authHeader` → `false` |
| `extensions/minimax/provider-catalog.ts` | override support + `authHeader` 默认 `false` |
| `src/plugins/cli.ts` | 备份 — 用 upstream 版本（upstream 有 lazy loading + metadata registry） |

`overlay/` 和 `runtime-templates/` 在 upstream 不存在 → 永远不会冲突。

## Gateway 管理

```bash
# 状态
ssh tencent-101 "sudo systemctl status openclaw-gateway.service --no-pager"

# 日志
ssh tencent-101 "sudo journalctl -u openclaw-gateway.service -n 120 --no-pager"

# 实时日志
ssh tencent-101 "tail -f /tmp/openclaw-gateway.log"

# 重启
ssh tencent-101 "sudo systemctl daemon-reload && sudo systemctl restart openclaw-gateway.service"

# 进程和端口
ssh tencent-101 "sudo ss -tlnp | grep 18789"
```

## 健康检查 & Smoke Test

```bash
# 基础检查
ssh tencent-101 "sudo openclaw health"
ssh tencent-101 "sudo openclaw models list"
ssh tencent-101 "sudo openclaw channels status --probe"
ssh tencent-101 "sudo openclaw plugins list"

# Smoke: 部署后必须测试
# 1. main agent（核心功能）
# 2. 一个 pc-* agent（私有 agent）
# 3. 一个 yz-app-* agent（业务 agent）
```

### 服务器配置查看

```bash
# Agent 列表和模型
ssh tencent-101 "sudo python3 -c \"import json; d=json.load(open('/root/.openclaw/openclaw.json')); [print(f'{a[\\\"id\\\"]}: {a.get(\\\"model\\\",{}).get(\\\"primary\\\",\\\"default\\\")}') for a in d.get('agents',{}).get('list',[])]\""

# Provider 配置
ssh tencent-101 "sudo python3 -c \"import json; d=json.load(open('/root/.openclaw/openclaw.json')); print(json.dumps(d.get('models',{}).get('providers',{}), indent=2))\""

# systemd env
ssh tencent-101 "sudo cat /etc/systemd/system/openclaw-gateway.service.d/env.conf"
```

### 配置修改（标准三步）

```bash
# 1. 备份
ssh tencent-101 "sudo cp /root/.openclaw/openclaw.json /root/.openclaw/backups/openclaw_$(date +%Y%m%d_%H%M).json"

# 2. python3 修改
ssh tencent-101 'sudo python3 -c "
import json
with open(\"/root/.openclaw/openclaw.json\") as f: d = json.load(f)
# ... 修改 ...
with open(\"/root/.openclaw/openclaw.json\", \"w\") as f: json.dump(d, f, indent=2, ensure_ascii=False)
"'

# 3. 重启
ssh tencent-101 "sudo systemctl restart openclaw-gateway"
```

## 故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| `Unknown model: minimax-cn/M2.7` | provider 名错误 | 用 `minimax`，不是 `minimax-cn` |
| `Unknown model: minimax/M2.7` | extension 未加载或 baseUrl 错误 | `journalctl \| grep minimax`，检查 baseUrl |
| `session/update RPC error` | 客户端侧 acpx 版本问题 | 检查 acpx 版本兼容性 |
| npm install 覆盖 dist | `npm i -g` 覆盖代码树 | 重新 rsync 本地 dist |
| tsgolint OOM | 内存不足 | `--no-verify` 跳过 hook |
| 飞书群不回复 | groupPolicy=allowlist | 改为 `open` 或加群到白名单 |
| Skill 安装后不生效 | 装到 ubuntu 目录了 | 必须装到 `/root/.openclaw/skills/` |
| 配置改了不生效 | 改错文件了 | 确认是 `/root/.openclaw/openclaw.json` |

## 回滚

```bash
ssh tencent-101 "sudo npm i -g openclaw@latest"
rsync -av --no-i-r extensions/ tencent-101:/home/ubuntu/projects/openclaw/extensions/
ssh tencent-101 "sudo systemctl restart openclaw-gateway"
```

## 禁止事项

- ❌ **禁止 `rsync --delete`**
- ❌ **禁止删除 agent 记忆**（sessions/memory/workspace）
- ❌ **禁止改 `/home/ubuntu/.claude/openclaw.json`**（gateway 不读）
- ❌ **禁止在配置中提交密码明文**
