# Upstream Upgrade Provider Channel Review

本页记录 `Group 1 / Chunk 2: provider-and-channel-surfaces` 的 review 结论。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

当前规模：

- `505` 个文件
- `24174` 行新增
- `78` 行删除

## 结论

这块 upstream 变化的主线，不是某一两个 provider 的模型表更新，而是 3 条线同时推进：

1. `plugin-sdk` 公共子路径继续扩大，并开始通过 facades 更系统地对外暴露。
2. bundled capability runtime 开始把 speech、media、provider runtime、channel runtime 等能力抽成统一运行面。
3. 各 provider/channel 扩展继续向“contracts + config-ui-hints + runtime surface”标准化收敛。

换句话说，这块的关键不是“新增了几个 provider”，而是 upstream 正在把 extension/plugin surface 明确成更稳定的公共契约层。

## 主要热点

按目录看，这块最重的热点是：

- `src/plugin-sdk/**`: `94`
- `src/plugins/**`: `23`
- `extensions/discord/**`: `19`
- `extensions/telegram/**`: `16`
- `extensions/openai/**`: `13`
- `extensions/msteams/**`: `13`
- `extensions/matrix/**`: `13`
- `extensions/slack/**`: `12`
- `extensions/whatsapp/**`: `11`
- `extensions/ollama/**`: `11`
- `extensions/google/**`: `11`
- `extensions/bluebubbles/**`: `11`

这说明真正的中心并不是某个单点 provider，而是：

- plugin-sdk surface
- bundled plugin runtime
- 多个 channel/provider 的统一约定

## 关键入口

关键入口文件：

- `scripts/lib/plugin-sdk-facades.mjs`
- `src/plugins/bundled-capability-runtime.ts`
- `src/plugin-sdk/browser-support.ts`
- `extensions/chutes/api.ts`
- `extensions/bluebubbles/src/conversation-bindings.ts`
- `extensions/discord/src/config-ui-hints.ts`

## 主要变化面

### 1. plugin-sdk facades 明显系统化

`scripts/lib/plugin-sdk-facades.mjs` 不再只是少量 alias，而是开始系统列出大量 `subpath -> extension api/runtime-api` 的 facade 映射。

从这份生成输入可以直接看出上游意图：

- extension 面向外部时，应通过 `openclaw/plugin-sdk/<subpath>` 访问
- 具体实现继续放在 `extensions/<id>/api.ts` 或 `runtime-api.ts`
- `browser`、`discord-runtime-surface`、`byteplus`、`chutes` 等都已经纳入这套机制

这跟我们之前本地做的“extension 只走 plugin-sdk 公共 surface，不直接伸进 core `src/**`”方向是一致的。

### 2. bundled capability runtime 开始成型

`src/plugins/bundled-capability-runtime.ts` 是这块最关键的 core seam。

它做的事情不是简单加载插件，而是：

- 根据 bundled plugin 清单构建 runtime config
- 用 alias/jiti 按公共 subpath 加载 capability plugin
- 兼容 Vitest 下的 capability runtime shim
- 捕获和记录插件注册行为

这说明 upstream 已经在把 bundled capability plugin 当作一个独立运行层，而不是“和普通 extension 混着靠约定运行”。

### 3. provider surface 扩张明显

这一轮 provider 面的新增，不只是模型 ID 更新，而是更完整的 `api.ts` / `models.ts` / `onboard.ts` / contract tests。

比较明显的例子包括：

- `extensions/chutes/api.ts`
- `extensions/byteplus/models.ts`
- `extensions/huggingface/models.ts`
- `extensions/venice/models.ts`
- `extensions/vercel-ai-gateway/models.ts`
- `extensions/ollama/src/setup.ts`

其中不少 provider 已经有：

- 默认模型定义
- catalog/discovery
- provider config patch/onboard
- contract tests

也就是说，上游正在把 provider 扩展统一成“可发现、可 onboarding、可 contract 校验”的固定结构。

### 4. channel surface 向统一 contract 收敛

channel 这块最明显的信号有两个：

1. conversation / thread binding 逐步进入 channel runtime 正式能力  
   例如 `extensions/bluebubbles/src/conversation-bindings.ts`

2. config UI hints 和 channel contract tests 明显增多  
   例如 `extensions/discord/src/config-ui-hints.ts`

这说明 upstream 正在把 channel 的“配置说明、thread/session 行为、contract 测试”都纳入统一框架，而不是继续靠每个 channel 自己散着实现。

### 5. speech/media/image runtime 继续能力化

这块虽然不如 provider/channel 面显眼，但也很重要。

典型信号：

- `extensions/speech-core/src/tts.ts`
- `extensions/image-generation-core/src/runtime.ts`
- `extensions/media-understanding-core/src/runtime.ts`
- `src/plugins/contracts/tts.contract.test.ts`

说明 upstream 在把这些能力当作标准 capability surface，而不是“某几个 provider 自带的额外功能”。

## 对本地仓库的意义

这块对我们本地最重要的，不是直接代码冲突，而是公共接缝在变化：

1. `plugin-sdk` 的公共 surface 明显变宽了。  
   我们本地 fork 扩展，特别是 `extensions/wecom/**`、`extensions/mysql-readonly/**`、`extensions/superBrower/**`、`extensions/zentao/**`，后续应该优先复用这些上游子路径，而不是继续自己开隐形接缝。

2. bundled capability runtime 越来越正式。  
   这意味着我们本地任何“把 extension 当半内置能力跑”的做法，后续都应该对齐这层 runtime，而不是单独造一套加载语义。

3. channel contract 和 config-ui-hints 变成主线。  
   如果后续要维护私有 channel/plugin，最好跟上这套结构，不然每次升级都要补大量适配。

4. provider onboarding 和 model catalog 结构基本定型。  
   这会影响我们对 MiniMax、OpenAI、Moonshot、Ollama 等 provider 接入的后续审查方式。

## 建议的后续人工核对点

建议后续人工 review 时，优先看：

1. `src/plugin-sdk/**` 里哪些新 subpath 能替代我们本地 fork 里的私有 helper。
2. `src/plugins/bundled-capability-runtime.ts` 是否改变了 bundled plugin 的加载和测试语义。
3. `extensions/discord/**`、`extensions/telegram/**`、`extensions/matrix/**`、`extensions/slack/**` 这些 channel contract 的变化，是否会影响我们现有的 gateway/绑定理解。
4. `extensions/minimax/**`、`extensions/openai/**`、`extensions/moonshot/**`、`extensions/ollama/**` 这些 provider 面，是否引入了新的默认模型/发现/onboard 行为。
