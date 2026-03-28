# Upstream Upgrade superBrower Convergence

本页记录 `Group 3` 中 `superBrower` 与 upstream `browser` 的职责重叠，以及后续收敛建议。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

## 结论

`superBrower` 不应该继续被理解成“另一套完整浏览器 runtime”。  
它更适合保留为：

- 站点 profile
- 登录/OTP 编排
- auth-state 解释
- post-login landing 恢复
- 诊断与 planner 包装

而通用浏览器运行面应优先让回 upstream `browser`。

## 当前两边分别是什么

### upstream `browser`

`browser` 现在是默认启用的 bundled plugin，而且同时提供：

- tool surface
- CLI
- gateway method `browser.request`
- runtime service

它支持的动作面是平台级的：

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

并且显式支持：

- `sandbox`
- `host`
- `node`

关键文件：

- `extensions/browser/openclaw.plugin.json`
- `extensions/browser/index.ts`
- `extensions/browser/src/browser-tool.schema.ts`

### `superBrower`

`superBrower` 当前只是单个 tool 插件，不带 CLI、gateway method 或 runtime service。它的动作面是站点流程导向的：

- `list_site_profiles`
- `get_site_profile`
- `navigate`
- `snapshot`
- `fill_fields`
- `toggle`
- `click`
- `type_otp`
- `wait_for`
- `plan_task`
- `execute_goal`
- `detect_state`
- `explain_auth_state`
- `recover_landing`
- `capture_diagnostics`
- `run_plan`

关键配置能力是：

- `siteProfiles`
- `fieldConfigs`
- `agreementSelectors`
- `submitSelectors`
- `otpSelectors`
- `successSignals`
- `failureSignals`
- `postLoginCandidates`
- 可选 planner

关键文件：

- `extensions/superBrower/openclaw.plugin.json`
- `extensions/superBrower/src/tool.ts`
- `extensions/superBrower/src/config-schema.ts`
- `extensions/superBrower/src/site-profiles.ts`

## 当前重叠面

两边的明显重叠在：

- 打开/导航页面
- 抓取快照
- 表单填写
- 点击/等待
- Playwright + CDP 执行链
- 浏览器会话生命周期

也就是说，`superBrower` 继续自己维护完整执行器和 runtime，会和 upstream `browser` 重复建设。

## `superBrower` 仍然有价值的部分

真正值得保留的，不是底层执行，而是这些站点流程能力：

1. site profile 匹配
2. OTP / MFA 定向处理
3. 登录成功/失败信号判断
4. auth-state 解释
5. 错误 landing 恢复
6. 诊断打包
7. 可选 planner 把目标转成站点流程 DSL

这几块目前 upstream `browser` 并没有等价能力。检索 `extensions/browser/**/*.ts`，没有发现：

- `detect_state`
- `explain_auth_state`
- `recover_landing`
- `capture_diagnostics`
- `plan_task`
- `execute_goal`
- `run_plan`

这说明 `superBrower` 的独特价值更接近“网站登录/诊断编排层”，不是“浏览器控制层”。

## 推荐的目标形态

推荐目标不是立刻删除 `superBrower`，而是逐步把它缩成更薄的一层：

### 1. upstream `browser` 负责

- 浏览器 runtime 生命周期
- tab/profile/runtime service
- 通用 act/snapshot/screenshot/navigation
- host/node/sandbox 三种执行面
- 通用 gateway/CLI/operator surface

### 2. `superBrower` 负责

- site profile 数据模型
- OTP/login/auth-state 规则
- 站点登录恢复与诊断逻辑
- planner 对站点流程 DSL 的包装
- 面向特定站点的高阶工作流

### 3. `overlay/skills/browser-use`

只作为外部 `browser-use-cli` wrapper 保留，不再承担 repo 内浏览器能力主线。

## 立即建议

### 1. 先不要删除 `superBrower`

当前它仍承载了 upstream `browser` 没有的站点流程能力。

### 2. 停止继续扩张 `superBrower` 的通用 runtime 面

后续如果要新增：

- 通用浏览器执行动作
- 通用截图/控制/文件/标签页能力
- 通用 browser runtime 管理

优先考虑 upstream `browser`，不要继续往 `superBrower` 里堆。

### 3. 把 `superBrower` 的新增工作尽量限制在高阶流程层

优先保留或新增：

- site profile
- auth-state rules
- diagnostics
- planner 包装
- 工作流级 skill 指南

### 4. 后续真正的收敛方向

下一阶段最理想的方向是把 `superBrower` 逐步收成：

- site profile / policy / workflow plugin
- 或更薄的 overlay skill + profile 数据层

而不是继续作为与 upstream `browser` 平行的一整套执行平台。
