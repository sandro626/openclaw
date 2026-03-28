# Upstream Upgrade Memory Runtime Review

本页记录 `Group 1 / Chunk 3: memory-runtime-stack` 的 review 结论。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

当前规模：

- `156` 个文件
- `26068` 行新增

## 结论

这块 upstream 不是在原有 memory 功能上补几处检索逻辑，而是把 memory 运行面继续抽成了 3 层：

1. `packages/memory-host-sdk/**`
2. `extensions/memory-core/**`
3. `src/plugin-sdk/memory-*` + `src/plugins/memory-*`

也就是说，上游已经把 memory 当成一个独立 capability/runtime stack 来建设，而不再只是 core 里的一组内部 helper。

## 主要热点

按目录看，这块几乎完全被 4 个区域主导：

- `packages/memory-host-sdk/**`: `84`
- `extensions/memory-core/**`: `53`
- `src/plugin-sdk/memory-*`: `12`
- `src/plugins/memory-*`: `6`

这说明最重要的变化不是调用点，而是 memory 本身的运行契约和 host contract 被明确拆层了。

## 关键入口

关键入口文件：

- `packages/memory-host-sdk/package.json`
- `packages/memory-host-sdk/src/runtime.ts`
- `packages/memory-host-sdk/src/runtime-core.ts`
- `packages/memory-host-sdk/src/host/backend-config.ts`
- `packages/memory-host-sdk/src/host/internal.ts`
- `extensions/memory-core/runtime-api.ts`
- `extensions/memory-core/src/runtime-provider.ts`
- `extensions/memory-core/src/memory/qmd-manager.ts`
- `extensions/memory-core/src/memory/provider-adapters.ts`
- `src/plugins/memory-runtime.ts`
- `src/plugins/memory-embedding-providers.ts`
- `src/plugin-sdk/memory-core-host-runtime-core.ts`

## 主要变化面

### 1. memory-host-sdk 被正式抽成 workspace contract

`packages/memory-host-sdk/package.json` 已经把这个包定义成独立 workspace 包，并显式导出这些 subpath：

- `./runtime`
- `./runtime-core`
- `./runtime-cli`
- `./runtime-files`
- `./engine`
- `./engine-foundation`
- `./engine-storage`
- `./engine-embeddings`
- `./engine-qmd`
- `./multimodal`
- `./query`
- `./secret`
- `./status`

这说明 upstream 已经不再把 memory host 逻辑当作“只能从 core 内部相对路径 import 的实现细节”。

### 2. memory-core 退成 runtime facade + manager 层

`extensions/memory-core/runtime-api.ts` 和 `extensions/memory-core/src/runtime-provider.ts` 说明：

- `memory-core` 对外主要暴露 `MemoryIndexManager` / `getMemorySearchManager`
- runtime provider 负责把 manager/runtime seam 挂给 core
- backend config 解析本身已经交给 host runtime files 层

这意味着 `memory-core` 的角色更像“memory plugin runtime facade”，而不是包揽所有 host 细节的单体实现。

### 3. QMD manager 已经变成完整子系统

`extensions/memory-core/src/memory/qmd-manager.ts` 的规模和依赖关系都说明，这不是简单 adapter：

- 管理 QMD collections
- 处理 sessions export
- 管理 XDG config/cache/index 路径
- 处理 embed backoff、forced update、pending update
- 接上 `mcporter`
- 处理 query parsing / scope / snippets / output trimming

也就是说，QMD backend 在 upstream 里已经是 memory 的完整后端实现面，而不是“外挂搜索模式”。

### 4. embeddings 被继续抽成 provider adapter + batch runtime

`extensions/memory-core/src/memory/provider-adapters.ts` 和 `packages/memory-host-sdk/src/host/*embeddings*` 这一组文件说明：

- OpenAI / Gemini / Voyage / Mistral / Ollama / local embeddings 都被适配成统一接口
- batch embedding 成了正式能力，而不是额外优化
- multimodal embedding 支持已经出现在 provider adapter 选择里
- cache key data、error formatting、auto selection、doctor metadata 都开始纳入统一结构

这说明 upstream 正在把 memory embedding 面升级成正式 provider-runtime 子系统。

### 5. core 侧已经有统一 memory runtime bridge

`src/plugins/memory-runtime.ts` 和 `src/plugins/memory-embedding-providers.ts` 明确了 core 侧入口：

- core 通过 active memory runtime 获取当前 manager
- runtime plugin registry 会在需要时自动拉起 memory runtime
- embedding provider registry 也变成全局注册表，而不是 memory-core 私有状态

这对我们本地很重要，因为它意味着 memory 已经开始遵循和其他 bundled capability plugin 相同的 runtime 接入模式。

### 6. plugin-sdk 直接把 memory host seams 暴露出来了

`src/plugin-sdk/memory-core-host-runtime-core.ts` 直接 re-export `packages/memory-host-sdk/src/runtime-core.js`。

这个模式本身就说明了上游的设计意图：

- workspace 包承载 host/runtime contract
- `src/plugin-sdk/memory-*` 承载公开接缝
- extension 或 core 只应该走这些公开 seam

这和我们本地一直在推进的“extension 不要直接越界 import core 内部实现”方向是一致的。

## 对本地仓库的意义

这块对我们本地最重要的不是直接冲突，而是 memory 的长期归属被 upstream 明确了：

1. memory 不是普通 skill。  
   它正在变成 repo 内建 capability runtime。

2. memory host 相关逻辑已经开始有稳定 workspace contract。  
   我们后续如果要碰 memory，不该再把 host 逻辑塞回 overlay skill 或临时脚本。

3. memory runtime 与 provider runtime 进一步耦合。  
   尤其 embeddings、batch、multimodal、QMD 等能力，后面会更多依赖 provider surface 的统一约定。

4. 这块和我们本地 `overlay/skills/memory/**` 存在概念重叠，但层次不同。  
   upstream 这里是 capability/runtime/core seam；我们本地 skill 层更多是操作说明、工作流和运行包装。

## 建议的后续人工核对点

建议后续人工 review 时，优先看：

1. `packages/memory-host-sdk/**` 这些新 seam，哪些后续能替代我们本地 memory 相关私有 helper。
2. `extensions/memory-core/**` 的 runtime/provider facade，是否改变了 memory plugin 的职责边界。
3. `src/plugins/memory-runtime.ts` / `src/plugins/memory-embedding-providers.ts` 是否影响当前 memory 的自动启用和 provider 选择语义。
4. `overlay/skills/memory/**` 后续应继续作为“工作流/文档/运维层”，不要和 upstream 新的 memory runtime seam 混层。
