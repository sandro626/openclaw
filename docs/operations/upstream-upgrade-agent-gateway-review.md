# Upstream Upgrade Agent Gateway Review

本页记录 `Group 1 / Chunk 4: agent-gateway-runtime` 的 review 结论。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

当前规模：

- `173` 个文件
- `40943` 行新增
- `120` 行删除

## 结论

这块 upstream 变化不是单点 feature，而是 agent、gateway、channel setup、plugin approvals、conversation bindings、MCP bridge 一起往“统一 runtime control plane”方向收敛。

最关键的主线有 5 条：

1. agent 运行面更像正式 orchestrator，而不是单轮 CLI runner。
2. provider/model 解析与隐式发现继续向 runtime 自动化靠拢。
3. gateway 新增了成型的 plugin approval 请求/等待/解决流。
4. channel config metadata、setup flow、doctor、model picker 都在向统一配置控制面收敛。
5. conversation binding 和 MCP channel bridge 开始成为正式 runtime 能力，不再只是周边工具。

## 主要热点

按目录看，这块主要集中在：

- `src/agents/**`: `60`
- `src/gateway/**`: `24`
- `src/config/**`: `14`
- `src/auto-reply/**`: `14`
- `src/commands/**`: `13`
- `src/infra/**`: `12`
- `src/flows/**`: `10`
- `src/channels/**`: `6`
- `src/mcp/**`: `5`

这说明核心变化已经覆盖：

- agent runtime
- gateway server methods
- config/runtime metadata
- onboarding/setup flow
- outbound bindings / MCP bridge

## 关键入口

关键入口文件：

- `src/agents/models-config.providers.implicit.ts`
- `src/agents/subagent-registry-lifecycle.ts`
- `src/gateway/server-methods/plugin-approval.ts`
- `src/flows/channel-setup.ts`
- `src/config/channel-config-metadata.ts`
- `src/config/bundled-channel-config-runtime.ts`
- `src/infra/outbound/current-conversation-bindings.ts`
- `src/channels/conversation-binding-context.ts`
- `src/mcp/channel-server.ts`
- `src/infra/plugin-approvals.ts`

## 主要变化面

### 1. agent runtime 更偏 orchestrator

`src/agents/**` 这轮不仅是 runner 修补，而是整块往编排器发展：

- `cli-runner/*`
- `subagent-registry-*`
- `tool-display-exec*`
- `models-config.providers.*`
- `pi-embedded-runner/run/*`

从 `src/agents/subagent-registry-lifecycle.ts` 可以看出：

- subagent announce / completion / retry / expiry / cleanup 已经有完整生命周期控制
- completion freeze、deferred retry、cleanup bookkeeping、context engine 通知都开始显式建模

这说明 upstream 正在把 subagent/session orchestration 当正式 runtime 能力，而不是“派生副作用”。

### 2. provider/model 解析越来越自动化

`src/agents/models-config.providers.implicit.ts` 的主线很明确：

- plugin provider catalog 可以参与隐式 provider 发现
- 不同 discovery order 被显式区分
- live 场景下 discovery timeout / provider filter 也被运行时参数化
- core implicit provider 与 plugin implicit provider 合并

这意味着 provider 选择不再完全依赖静态 config，而是在往“显式配置 + 运行时发现 + auth profile store”混合模型走。

### 3. gateway plugin approvals 已成型

`src/gateway/server-methods/plugin-approval.ts` 和 `src/infra/plugin-approvals.ts` 显示：

- `plugin.approval.request`
- `plugin.approval.waitDecision`
- `plugin.approval.resolve`

已经形成一套完整流程，而且包含：

- server 端生成 approval id
- 超时与两阶段模式
- 广播 requested / resolved 事件
- optional forwarder
- 和 exec approval decision 体系对齐

这说明 plugin permission gating 已经不再是 UI 辅助能力，而是 gateway protocol 的正式部分。

### 4. channel config / setup / doctor 进入统一控制面

这轮 `src/config/**` 和 `src/flows/**` 的变化很重，尤其：

- `src/config/bundled-channel-config-metadata.generated.ts`
- `src/config/channel-config-metadata.ts`
- `src/config/bundled-channel-config-runtime.ts`
- `src/flows/channel-setup.ts`
- `src/flows/model-picker.ts`
- `src/commands/doctor/shared/bundled-plugin-load-paths.ts`

这说明 upstream 已经在做两件事：

1. 给 bundled channel/plugin 生成和聚合 schema/UI metadata
2. 把 onboarding/setup/doctor/model picker 统一到同一个 runtime config 控制面

其中 `src/config/channel-config-metadata.ts` 明确体现了“按 plugin origin 排序并去重 channel/plugin metadata”的逻辑，说明上游已经在认真处理 bundled/global/workspace/config 多源并存。

### 5. current conversation binding 和 MCP bridge 正式化

`src/infra/outbound/current-conversation-bindings.ts`、`src/channels/conversation-binding-context.ts`、`src/mcp/channel-server.ts` 这一组变化说明：

- current conversation binding 已有持久化文件、TTL、bind/unbind/touch 语义
- provider plugin 可以参与 command conversation / focused binding 解析
- channel MCP server 已经是正式 server + bridge + tool registration 组合

也就是说，channel/runtime 已经不只是“收消息再回消息”，而是开始有更强的 conversation state 和 MCP bridge 语义。

## 对本地仓库的意义

这块对我们本地最重要的意义有 4 条：

1. agent runtime 更重了。  
   后续本地 overlay/operations 设计不能把 agent 当静态 prompt + workspace 文件集合来理解，runtime orchestration 已经明显增强。

2. gateway 权限与 approval 面在扩。  
   我们后续如果接私有 plugin、私有 channel，最好顺着这套 plugin approval / exec approval 体系走。

3. 多源配置的 runtime 解析越来越正式。  
   这和我们现在做的 `core -> overlay -> runtime-templates` 分层是相关而不是冲突的；后续应优先复用上游多源归并逻辑。

4. current conversation binding / MCP bridge 可能会碰到我们现有的 channel/workflow 假设。  
   尤其是 thread 绑定、bound conversation、channel MCP 使用场景，后续需要避免在 overlay 层自己再造一套。

## 建议的后续人工核对点

建议后续人工 review 时，优先看：

1. `src/agents/subagent-registry-*` 是否改变了我们对 subagent 完成/清理/通知语义的理解。
2. `src/gateway/server-methods/plugin-approval.ts` 是否会影响现有 operator/client 授权流程。
3. `src/config/bundled-channel-config-runtime.ts` 与 `src/flows/channel-setup.ts` 是否会改变我们对 channel 配置装配和默认值的判断。
4. `src/infra/outbound/current-conversation-bindings.ts` 与 `src/channels/conversation-binding-context.ts` 是否和现有私有 channel/workflow 设计存在重叠。
5. `src/mcp/channel-server.ts` 是否会影响我们后续对 MCP channel 能力的接入方式。
