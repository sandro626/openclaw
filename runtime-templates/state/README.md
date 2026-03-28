# Runtime State Examples

这个目录只存放 host-local runtime state 的结构样例，不参与 `scripts/assemble-runtime-bundle.mjs` 的渲染。

适合放在这里的内容：

- `~/.openclaw/openclaw-feishu-accounts.json` 的 example
- `~/.openclaw/credentials/*.json` 的 example
- `~/.openclaw/exec-approvals.json` 的 example
- `~/.openclaw/update-check.json` 的 example

不适合放在这里的内容：

- 真实 token / secret
- 真实 pairing code
- 真实 allowFrom 列表
- 真实 host path
- 真实 update state

规则：

- 这里只放 example，不放真数据
- 真数据只存在服务器 runtime 或独立备份里
- 可模板化配置继续放在 `runtime-templates/config/`
