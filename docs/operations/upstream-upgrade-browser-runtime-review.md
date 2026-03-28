# Upstream Upgrade Browser Runtime Review

本页记录 `Group 1 / Chunk 1: browser-runtime` 的 review 结论。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

当前规模：

- `241` 个文件
- `33951` 行新增
- 这不是对旧 browser 代码的小修，而是一次完整的新 bundled browser runtime 引入

## 结论

这次 upstream 引入的是一整套新的 `browser` bundled plugin，而不是在现有 core 里补几条 browser 命令。

从 review 角度看，最重要的结论有 5 个：

1. 上游新增了一个默认启用的 bundled browser plugin。
2. 这个 plugin 同时暴露了 tool、CLI、gateway method 和 service 四个入口。
3. browser 执行面不只支持本地 host 控制，还支持通过 node proxy 转发到远端 node。
4. runtime 已经把 profile、tab、snapshot、download、storage、PDF、upload、dialog、console、evaluate、batch act 这些能力整合成一个完整控制面。
5. 上游已经为这套能力补了非常重的测试面，所以后续本地整合时，应该把它视为一个“新平台面”，不是普通 plugin patch。

## 关键入口

关键入口文件：

- `extensions/browser/openclaw.plugin.json`
- `extensions/browser/index.ts`
- `extensions/browser/src/browser-tool.ts`
- `extensions/browser/src/browser-tool.schema.ts`
- `extensions/browser/src/gateway/browser-request.ts`
- `extensions/browser/src/node-host/invoke-browser.ts`
- `extensions/browser/src/control-service.ts`
- `extensions/browser/src/browser/server-context.ts`
- `extensions/browser/src/browser/routes/agent.act.ts`

## 主要变化面

### 1. 新的默认 browser plugin

`extensions/browser/openclaw.plugin.json` 把插件 id 固定为 `browser`，而且 `enabledByDefault=true`。  
`extensions/browser/index.ts` 显示它会同时注册：

- tool
- CLI 命令
- gateway method: `browser.request`
- browser runtime service

这意味着 browser 不再只是某个附属工具，而是上游默认能力面的一部分。

### 2. 新的 browser tool surface

`extensions/browser/src/browser-tool.schema.ts` 展示了新的 tool action 面，至少包括：

- `status`
- `start`
- `stop`
- `profiles`
- `tabs`
- `open`
- `focus`
- `close`
- `snapshot`
- `screenshot`
- `navigate`
- `console`
- `pdf`
- `upload`
- `dialog`
- `act`

而且它显式支持三种 target：

- `sandbox`
- `host`
- `node`

这说明上游已经把 browser tool 设计成“多执行面调度器”，不是单一路径实现。

### 3. node proxy + host control 双路径

`extensions/browser/src/gateway/browser-request.ts` 和 `extensions/browser/src/node-host/invoke-browser.ts` 是这次最重要的行为入口。

从这两处可以确认：

- gateway method `browser.request` 会优先尝试 browser-capable node
- 如果 node 可用且 allowlist 允许，则走 `browser.proxy`
- 否则回落到本地 browser control service
- proxy 路径会处理结果文件回传，并把返回 payload 里的本地路径重写成可消费路径

这意味着 browser runtime 已经天然是“本地 + 远端 node”双态设计。

### 4. profile/tab/runtime 生命周期

`extensions/browser/src/browser/server-context.ts` 把 profile 运行态抽象成了统一 context，至少覆盖：

- profile 解析
- running browser 可用性
- tab 列表和选择
- profile reset
- hot reload 配置刷新
- 默认 profile 与命名 profile 共存

同时它支持：

- Chrome MCP transport
- 传统 CDP transport

这说明上游不只是控制浏览器，而是在引入一个 profile-aware 的 browser runtime 管理层。

### 5. 高阶 act/snapshot 控制面

`extensions/browser/src/browser/routes/agent.act.ts`、`extensions/browser/src/browser/pw-session.ts`、`extensions/browser/src/browser/pw-tools-core.interactions.ts`、`extensions/browser/src/browser/routes/agent.snapshot.ts` 这一组文件说明：

- act 已支持 batch、selector/ref 双模式、drag/fill/resize/wait/evaluate
- snapshot 已变成单独路由和计划面
- page/session/tab 跟踪已经是 runtime 的一等能力
- 下载、存储、输出路径、截图、文件选择器等边界都被专门抽象出来了

这块本质上已经接近一个 repo 内置 browser automation platform。

## 安全与策略面

这次上游对 browser 并不是“先加功能，后补安全”，而是安全约束和功能一起进来的。

关键信号：

- `browser.request` 的 gateway 注册要求 `operator.write`
- `invoke-browser.ts` 对 node proxy profile 做 allowlist 检查
- `browser-request.ts` 明确禁止通过 gateway method 去做持久 profile mutation
- `server-context.ts` 接上了 SSRF 和导航 URL 校验
- `control-service.ts` 会自动确保 browser auth token 存在

这对我们本地的意义是：后面如果要把 browser 能力和私有 overlay skill 对接，优先走这些上游约束，不要自己绕开。

## 对本地仓库的影响

最值得关注的不是“是否要接收这个 chunk”，而是它会碰到哪些本地接缝：

1. `browser` 现在是默认启用的 bundled plugin。  
   这会影响我们对默认 plugin 集、插件装配和升级审查的理解。

2. 它和现有私有能力面可能有功能重叠。  
   特别是 `overlay/skills/browser-use/SKILL.md`、`extensions/superBrower/**`、`overlay/skills/superBrower/SKILL.md`。

3. 它引入了新的 node/browser proxy 语义。  
   这会影响我们对 node command allowlist、gateway policy、远端 runtime 路径的审查。

4. 它已经明显进入构建链。  
   我们前面修的 `scripts/stage-bundled-plugin-runtime-deps.mjs` 与 Playwright runtime deps staging，和这块直接相关。

## 建议的后续人工核对点

建议后续人工 review 时，优先核这几件事：

1. 默认启用的 `browser` 是否会和现有本地插件策略冲突。
2. `browser.request` / `browser.proxy` 的权限模型，是否符合我们当前网关和 node 使用方式。
3. `extensions/browser/**` 与 `extensions/superBrower/**`、`overlay/skills/browser-use/SKILL.md` 的职责边界，是否需要重新划分。
4. 如果未来保留 `superBrower`，它应被视作独立私有 fork，而不是上游 browser runtime 的替代品。
