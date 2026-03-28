# Server Config Archive

`server-config/` 不再承载活跃 runtime 真源。

当前目录只保留迁移入口说明，历史原件已归档到：

- `.artifacts/ops/archive/server-config-runtime-20260327T095906Z/`

归属规则：

- `openclaw.json`、`openclaw.local.json`
  迁到 `runtime-templates/config/` 的模板链路，部署时渲染到 `~/.openclaw/openclaw.json`
- `openclaw-feishu-accounts.json`
  迁到 host-local runtime `~/.openclaw/openclaw-feishu-accounts.json`
- `credentials/*.json`
  迁到 host-local runtime `~/.openclaw/credentials/`
- `exec-approvals.json`
  迁到 host-local runtime `~/.openclaw/exec-approvals.json`
- `update-check.json`
  迁到 host-local runtime `~/.openclaw/update-check.json`
- `browser-use-cli*`、`chandao/Skill/*`
  归档为历史运维脚本，不再作为源码层真源

示例结构见：

- `runtime-templates/state/`

不要再把真实账号、token、pairing state 或 host-local 配置重新提交到这里。
