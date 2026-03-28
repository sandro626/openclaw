# Upstream Upgrade Review: Contracts Tests And Apps

`Chunk 5: contracts-tests-and-apps` 当前基于 `upstream/main=ced88298d86fb7ddb011b26acce911a0791ffb3e` 审查。

规模：

- `47` 个文件
- `8146` 行新增
- `69` 行删除

这一块不是零散测试补丁。upstream 在这里做的是把前面几块 runtime 变化补成显式契约层：

- channel/provider/plugin 共享 contract helpers
- `openclaw mcp serve` 的文档与 Docker E2E harness
- bundled channel config metadata 的生成基线
- app side Gateway 协议模型与 session key 规则同步
- UI 对 approvals、skills、tool cards 这些 operator surface 的回归门禁

## 主要结论

### 1. upstream 正在把 plugin/channel/provider surface 拉成共享 contract suite

新增的大量 `test/helpers/channels/*` 和 `test/helpers/extensions/*` 不是单个功能测试，而是可复用 contract helpers。它们把以下内容变成统一门禁：

- channel catalog / inbound / outbound payload / session binding / DM policy / group policy
- provider discovery / runtime / auth / package manifest / plugin registration
- bundled web search fast path 和 media-understanding 这类 shared behavior

关键 seam：

- `test/helpers/channels/channel-catalog-contract.ts`
- `test/helpers/channels/inbound-contract.ts`
- `test/helpers/channels/outbound-payload-contract.ts`
- `test/helpers/channels/plugins-core-extension-contract.ts`
- `test/helpers/channels/session-binding-contract.ts`
- `test/helpers/extensions/provider-discovery-contract.ts`
- `test/helpers/extensions/provider-runtime-contract.ts`
- `test/helpers/extensions/provider-auth-contract.ts`
- `test/helpers/extensions/plugin-registration-contract.ts`

这意味着 upstream 已经不再满足于“每个 plugin 自己测自己”，而是开始要求各 channel/provider 满足统一 runtime contract。

### 2. MCP bridge 已经从实验路径提升到文档化 + E2E 化的 operator surface

`docs/cli/mcp.md` 和 `scripts/e2e/mcp-channels-*` 这一组说明了 `openclaw mcp serve` 不再只是隐藏能力，而是 upstream 明确支持的桥接面。文档里已经清楚定义：

- OpenClaw 作为 MCP server 的职责
- `conversations_list`、`messages_read`、`events_poll`、`events_wait`、`messages_send`
- Claude channel mode 的通知模型
- approval request / resolve 的桥接行为

对应的 harness 不是 smoke-only，而是完整验证：

- Gateway WebSocket connect
- seeded conversation discovery
- transcript and attachment fetch
- live event polling/waiting
- Claude notification and permission roundtrip

关键 seam：

- `docs/cli/mcp.md`
- `scripts/e2e/mcp-channels-harness.ts`
- `scripts/e2e/mcp-channels-docker-client.ts`
- `scripts/e2e/mcp-channels-seed.ts`
- `scripts/e2e/mcp-channels-docker.sh`

### 3. bundled channel config metadata 现在有了独立的生成与校验入口

`scripts/generate-bundled-channel-config-metadata.ts` 和相关 contract 测试表明，upstream 正在把 “bundled channel 的 config schema / label / description / uiHints” 变成生成物，而不是散落在 runtime discovery 里临时推导。

这和 `Chunk 2` 里看到的 channel config surface 标准化是一条线：runtime、生成脚本、测试基线开始闭环。

关键 seam：

- `scripts/generate-bundled-channel-config-metadata.ts`
- `vitest.contracts.config.ts`

### 4. app side 正在追着 Gateway 协议和 session key 规则一起收口

`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift` 和 `apps/macos/Sources/OpenClawProtocol/GatewayModels.swift` 都是自动生成的 Gateway 模型，这说明 app side 现在把协议模型当成明确产物同步，而不是手写临时兼容。

Android 测试进一步说明 upstream 正在固定 session key 规则，尤其是 node-scoped main session key 与当前 session 选择策略：

- `buildNodeMainSessionKey()` 生成稳定 device-scoped key
- `applyMainSessionKey()` 只在用户仍停留默认会话时移动当前会话

关键 seam：

- `apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`
- `apps/macos/Sources/OpenClawProtocol/GatewayModels.swift`
- `apps/android/app/src/test/java/ai/openclaw/app/SessionKeyTest.kt`
- `apps/android/app/src/test/java/ai/openclaw/app/chat/ChatControllerSessionPolicyTest.kt`

### 5. UI regression tests 开始覆盖 approvals 和 skills operator surface

`ui/src/ui/controllers/exec-approval.test.ts`、`ui/src/ui/views/skills.test.ts`、`ui/src/ui/chat/tool-cards.test.ts` 说明 upstream 已经开始给 operator-facing UI 加回归门禁，而不是只测底层 model/runtime。

其中比较重要的是：

- plugin approval payload shape 被显式固定
- skill detail dialog 的 modal/open/close 行为被固定
- tool card 展示行为被固定

这会影响后续任何 gateway approval schema 或 skill status surface 的改动。

## 对本地仓库的意义

### 1. 这块不是“可选测试”，而是 upstream 未来收敛 fork 差异的主要抓手

我们本地如果继续保留 `extensions/wecom` 等 fork 面，就不能只看 runtime build 是否通过，还要看这些共享 contract helper 是否已经把 upstream 的行为前提写死。

### 2. MCP bridge 现在已经具备明确的产品化约束

本地 overlay/runtime 设计后续如果涉及 MCP、approvals、conversation bindings，就不能再把 `openclaw mcp serve` 当作边缘能力处理；文档、docker harness、approval roundtrip 已经把它提升成稳定 surface。

### 3. 生成物与跨端协议模型不能再被私有逻辑绕开

`GatewayModels.swift` 和 bundled channel config metadata 都说明 upstream 正在强调 “schema 先行、生成物对位”。本地如果继续扩展 channel/config surface，优先应该补公共 schema / generator / contract，而不是在私有代码里隐式兼容。

### 4. app side 的 session key 语义已经变成 shared contract

如果我们服务器 runtime 或 overlay workflow 里仍有自定义的 main session key 假设，需要对照 Android 测试收口，避免后续跨端行为不一致。

## 建议的后续人工核对点

1. 对照 `test/helpers/channels/*` 和 `test/helpers/extensions/*`，确认本地 fork 扩展是否已经被这些共享 contract 隐式约束。
2. 对照 `docs/cli/mcp.md` 和 `scripts/e2e/mcp-channels-*`，确认我们现有的 MCP/operator 预期是否与 upstream 定义一致。
3. 对照 `scripts/generate-bundled-channel-config-metadata.ts`，确认本地 overlay/channel 配置面不要漂离生成型 metadata 流程。
4. 对照 `apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift` 和 `apps/macos/Sources/OpenClawProtocol/GatewayModels.swift`，确认任何私有 Gateway schema 改动都不会破坏 app side 生成模型。
5. 对照 Android session key tests，确认服务器端 main session key 和设备级会话策略与 upstream shared rule 一致。
