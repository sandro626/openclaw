# Upstream Upgrade WeCom Fork Strategy

本页记录 `Group 3` 中 `wecom` 的当前处理策略。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

## 结论

`wecom` 当前应继续保留为显式 overlay fork，但不能把它当成“无限制复制一整棵目录”。

正确理解是：

- `extensions/wecom/**` 是 upstream 对照与兼容基线
- `overlay/extensions/wecom/**` 是当前运行时默认加载的私有分叉
- 两边只应维持“窄差异”，而不是持续大面积漂移

## 当前真实状态

运行模板已经明确：

- `runtime-templates/extensions/base.json` 只显式加载 `overlay/extensions/wecom`
- `runtime-templates/extensions/wecom/README.md` 明确 `extensions/wecom/**` 只是基线

当前本地 fork 审计结果表明：

- 可比较文件数：`19`
- 完全相同：`14`
- 真正差异文件：`5`
- overlay-only 文件：`0`
- base-only 文件：`0`（忽略 `node_modules` 后）

也就是说，`wecom` 当前不是“整树分叉”，而是“窄差异分叉”。

当前差异文件集中在：

- `README.md`
- `src/channel.ts`
- `src/monitor.ts`
- `src/oss.ts`
- `src/robot.ts`

## 当前差异大致代表什么

从这 5 个文件的 diff 看，overlay fork 主要承载的是运行时行为差异，而不是结构性重写：

1. 机器人消息与 route 语义调整
2. webhook / monitor 流程中的实际运行修正
3. 机器人流式回复行为调整
4. OSS 上传 body 细节修正
5. README 中对“哪个目录是当前真源”的说明

这说明 `wecom` fork 仍然有现实价值，但差异面已经足够窄，适合被当成可审计 fork，而不是继续自由扩张。

## 处理原则

### 1. 保留 overlay 运行时真源

只要默认模板仍然显式加载 `overlay/extensions/wecom`，它就继续是当前运行时真源。

不要误把 `extensions/wecom/**` 当成活跃运行目录。

### 2. 保持窄差异

后续修改 `wecom` 时，优先判断属于哪一类：

- 通用基线能力：优先改 `extensions/wecom/**`
- 私有运行时行为：只改 `overlay/extensions/wecom/**`
- 两边都适用：先改基线，再决定 overlay 是否仍需保留补丁

不要无差别同时改两边整树。

### 3. 不允许零差异镜像长期存在

如果某一天 `overlay/extensions/wecom/**` 和 `extensions/wecom/**` 变成零差异：

- 就应退休 overlay 加载路径
- 或者重新引入明确且必要的私有差异

仓库 hook 现在已经会阻止“活跃 overlay fork 退化成零差异镜像”。

### 4. 审计结果应可重复

当前仓库已经新增：

- `scripts/audit-local-forks.mjs`
- `pnpm ops:audit-local-forks`

它会直接列出本地 overlay fork 和基线目录的实际差异，不需要再靠人工记忆。

## 推荐的下一步

`wecom` 后续不该优先做目录迁移，而应优先做差异收敛：

1. 继续把通用改动尽量回收到 `extensions/wecom/**`
2. 把 overlay 差异限制在确实需要的运行时行为
3. 如果差异继续缩小到接近零，再评估是否切回 bundled `extensions/wecom/**`
