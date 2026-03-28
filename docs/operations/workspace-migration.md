# OpenClaw Workspace 与 Memory 迁移方案

## 目标

当生产环境同时存在多套 workspace 路径、旧目录残留、或 memory 文件与索引分离时，agent 很容易出现以下问题：

- 记忆写入到了旧目录，但运行时读取的是新目录
- `memory/` 文件存在，但检索索引没有同步
- 部署时误覆盖了 workspace，导致历史上下文丢失
- 运维无法确认某个 agent 当前到底绑定了哪个工作区

本文定义一套统一的 workspace 命名规范、迁移步骤、验收标准与回滚方法，用于在不破坏现有 sessions 与 memory 的前提下，把运行态收敛到单一路径模型。

相关文档：

- [Runtime Unification](/operations/runtime-unification)
- [Runtime Unification Checklist](/operations/runtime-unification-checklist)
- [Deploy Protection](/operations/deploy-protection)
- [Production Runtime Migration Runbook](/operations/production-runtime-migration-runbook)

## 适用场景

以下任一情况都应该执行本方案：

- 同一个 agent 同时存在 `workspace/<agentId>` 与 `workspace-<agentId>` 两种目录
- 运行配置引用的 workspace 与磁盘上最新写入目录不一致
- agent 回复中表现出“没有记忆”，但磁盘上已经存在 `memory/` 或 `MEMORY.md`
- 发布流程会重建源码目录，但 workspace 仍放在不稳定位置

## 统一规范

### Workspace 命名

生产环境只保留一种 workspace 目录规范：

`~/.openclaw/workspace/<agentId>`

不要混用以下形式：

- `~/.openclaw/workspace-<agentId>`
- `~/.openclaw/agents/<agentId>/workspace`
- 任何位于源码仓库内部的 agent 工作区

### Workspace 最小结构

每个长期运行的 agent workspace 至少应包含：

- `AGENTS.md`
- `IDENTITY.md`
- `memory/`

可选但推荐：

- `MEMORY.md`
- 业务脚本目录
- agent 私有模板或上下文文件

### Memory 分层

迁移时必须区分以下两层：

- 文件层：workspace 内的 `memory/*.md` 与 `MEMORY.md`
- 检索层：运行态 memory 索引，例如 sqlite 或外部向量库索引

迁移完成的标准不是“目录存在”，而是“文件层与检索层都指向同一个 workspace 并能被查询”。

## 迁移前盘点

先为每个 agent 建一张盘点表，至少包含以下字段：

- `agentId`
- 配置文件中的 workspace 路径
- 实际存在的 workspace 目录列表
- 最新修改时间
- 是否存在 `memory/`
- 是否存在 `MEMORY.md`
- sessions 路径
- memory 索引路径
- 最近一次 memory sync 或索引更新时间

如果当前环境已经进入三层收口阶段，优先用仓库里的只读审计脚本生成这份盘点：

```bash
pnpm ops:audit-runtime-layout -- \
  --runtime-root "$HOME/.openclaw" \
  --environment prod \
  --write-file .artifacts/ops/prod-runtime-layout.json
```

如果同一个 agent 对应多个目录，优先选择“最近仍有写入、且配置计划要指向”的目录作为主目录，其余视为候选旧目录。

## 迁移原则

### 先复制，再切换

不要先删旧目录再切换配置。正确顺序应为：

1. 备份
2. 复制数据到目标路径
3. 更新配置
4. 重启并验证
5. 保留旧目录观察
6. 延后清理旧目录

### 不覆盖运行数据

迁移过程中不得删除或覆盖以下内容：

- sessions
- `memory/` 下的历史文件
- `MEMORY.md`
- 现有 memory 索引文件

### 配置切换必须可追踪

每次迁移都应记录：

- 变更前 workspace
- 变更后 workspace
- 生效时间
- 操作人
- 验证结果

## 标准迁移流程

### 1. 冻结写入

在迁移窗口内暂停会导致 workspace 写入的操作：

- 自动发布
- 批量回放消息
- agent 定时总结或 memory 生成任务

如果无法完全停机，至少要确保不会同时向旧目录和新目录写入。

### 2. 备份运行态

在修改任何配置之前，至少备份：

- 运行配置
- agent sessions
- agent workspace
- memory 索引文件

备份路径应遵循 [Deploy Protection](/operations/deploy-protection) 中的运行态保护要求。

### 3. 选定目标路径

为每个 agent 明确唯一目标路径：

`~/.openclaw/workspace/<agentId>`

如果目标目录不存在，先创建空目录骨架，但不要在这一步生成新的 memory 内容。

### 4. 复制工作区内容

将旧目录内容复制到目标目录时：

- 保留文件时间戳与权限
- 不跳过隐藏文件
- 不覆盖目标目录中更新的文件，除非已确认目标目录尚未投入使用

如果两个目录都存在有效内容，应先人工比对，再决定合并策略，不要盲目全量覆盖。

### 5. 更新运行配置

将生产配置中该 agent 的 workspace 路径切换到目标目录，同时检查：

- agentId 是否正确
- Feishu 或其他 channel 绑定的 agent 是否仍是一对一
- memory 相关配置是否仍指向预期 backend

如果同时存在模板配置与运行配置，必须先确保“哪个是生产真源”已经明确，否则不要执行切换。

### 6. 重启相关进程

使配置切换真正生效后，再执行迁移验证。不要只修改磁盘文件而不重启运行进程。

### 7. 验证 agent 正在读取新目录

至少完成以下验证：

- agent 启动后读取到的 workspace 路径与目标路径一致
- 新目录中的 `AGENTS.md`、`IDENTITY.md`、`memory/` 可被访问
- 回复行为没有回落到旧目录上下文
- 新增一条测试记忆后，写入位置落在目标目录

### 8. 验证 memory 检索层

对每个迁移后的 agent，检查：

- memory 索引文件存在
- 文件计数与 chunk 计数大于零，或至少能明确说明为何尚未建索引
- 执行一次 memory 搜索时，能够命中新目录中的内容

如果文件层已经迁移但检索层没有同步完成，该 agent 仍不能算“迁移完成”。

### 9. 保留旧目录观察

迁移完成后，不要立即删除旧目录。建议先进入观察期，确认：

- 旧目录不再出现新的写入
- agent 所有读写都已经落到新目录
- 定时任务、memory 生成、群消息回复都正常

观察期内，可以把旧目录标记为只读或在目录名中追加 `-legacy`，但不要破坏其内容。

### 10. 清理旧目录

只有在观察期结束且确认没有回退需求时，才允许清理旧目录。清理前仍应保留可恢复备份。

## 验收标准

一个 agent 的 workspace 迁移只有同时满足以下条件才算完成：

- 生产配置只指向一个 workspace
- 磁盘上不存在仍被写入的旧 workspace
- `memory/` 与 `MEMORY.md` 位于目标目录
- memory 检索层能命中目标目录中的记忆
- sessions 未丢失
- Feishu 或其他消息渠道回复行为没有异常

## 常见风险

### 只迁了目录，没有迁索引

表现：

- 文件都在，但 agent 仍回答“没有记忆”

原因通常是 memory 索引仍为空，或仍绑定旧路径。

### 新旧目录都在写

表现：

- 同一个 agent 的记忆文件分散在两个目录
- 排障时无法确认哪一份才是当前真相

这通常来自：

- 配置未完全切换
- 多进程仍在运行
- 定时任务未停止

### 用源码目录承载 workspace

表现：

- 部署代码时误删运行态
- 升级时把业务上下文一起覆盖

workspace 必须始终位于独立的运行态目录，不应放在应用源码仓库内部。

## 回滚方案

如果迁移后验证失败，按以下顺序回滚：

1. 停止相关 agent 写入
2. 将运行配置恢复到旧 workspace 路径
3. 重启相关进程
4. 验证 agent 已重新读取旧目录
5. 保留失败的新目录作为现场，不要立即删除
6. 基于备份重新分析差异

回滚时同样不得删除 sessions、memory 文件与索引文件。

## 后续治理

完成一次迁移后，应把以下动作纳入常规运维：

## 当前服务器最新核查

### 当前生产 agent 与 workspace memory 对位情况

按最新服务器真实配置核查，当前生产配置共有 `26` 条 agent 配置项，去重后为 `22` 个唯一 agent。它们现在都已经在规范路径 `~/.openclaw/workspace/<agentId>/memory` 下看到 memory 目录：

- `main`
- `cto`
- `dev`
- `tester`
- `ops`
- `pc-pm`
- `pc-ai-pythondev`
- `pc-backend`
- `pc-frontend`
- `pc-pctester`
- `pc-yz-app-pm`
- `pc-yz-app-javadev`
- `pc-yz-app-appdev`
- `pc-yz-app-aidev`
- `pc-devops`
- `pc-ceo_assistant`
- `pc-code_reviewer`
- `pc-ip_expert`
- `yz-app-pm`
- `yz-app-javadev`
- `yz-app-appdev`
- `yz-app-aidev`

当前 `needsLegacyMemoryReviewCount = 0`。这说明活跃 agent 的 memory 文件层已经完成对位，后续重点不再是补迁 memory，而是清理观察期内仍保留的 legacy 副本和服务器配置里的重复 agent 条目。

### 服务器仍存在的 legacy workspace 目录

最新服务器审计结果里，legacy `workspace-*` 目录仍处于观察期保留状态，当前总数为 `14`。其中包括：

- `workspace-pc-ai-pythondev`
- `workspace-pc-backend`
- `workspace-pc-ceo_assistant`
- `workspace-pc-code_reviewer`
- `workspace-pc-devops`
- `workspace-pc-frontend`
- `workspace-pc-ip_expert`
- `workspace-pc-pctester`
- `workspace-pc-yz-app-aidev`
- `workspace-pc-yz-app-appdev`
- `workspace-pc-yz-app-javadev`
- `workspace-pc-yz-app-pm`
- `workspace-yz-app-javadev`
- `workspace-yz-app-pm`

其中包含两类：

- 与当前生产唯一 agent 同名的旧目录，当前仅作为观察期保留副本存在，不再是活跃写入路径
- `yz-app-*` 与 `pc-yz-app-*` 不是历史实验 agent，它们是当前需要保留的用户或业务角色；后续如果清理 legacy 目录，也应以它们的规范路径 `workspace/<agentId>` 为准，而不是把 agent 本身归档掉
- `workspace-pc-pythondev` 只是 `pc-ai-pythondev` 的旧别名目录，已在前一轮迁移中归档，不再属于当前活跃 runtime 观察集

### 当前仍可见的 legacy memory 目录

服务器上仍可见以下 `workspace-*/memory` 目录，这些目录当前主要用于观察和最终清理：

- `workspace-pc-ai-pythondev/memory`
- `workspace-pc-backend/memory`
- `workspace-pc-ceo_assistant/memory`
- `workspace-pc-code_reviewer/memory`
- `workspace-pc-devops/memory`
- `workspace-pc-frontend/memory`
- `workspace-pc-ip_expert/memory`
- `workspace-pc-pctester/memory`
- `workspace-pc-yz-app-aidev/memory`
- `workspace-pc-yz-app-appdev/memory`
- `workspace-pc-yz-app-javadev/memory`
- `workspace-pc-yz-app-pm/memory`
- `workspace-yz-app-javadev/memory`
- `workspace-yz-app-pm/memory`

这说明服务器侧的下一步重点不是继续改 repo，而是：

1. 在观察窗口结束前继续保留这些 legacy memory 目录作为回滚面
2. 用 `ops:audit-runtime-layout --config-path` 继续核查是否仍有新写入落在 legacy 目录
3. 只清理重复副本和重复配置项，不要误删 `yz-app-*`、`pc-yz-app-*`、`pc-ai-pythondev` 这些当前仍在生产配置里的 agent
4. 观察期结束后，再移除 legacy 目录并把服务器配置里的重复 `yz-app-*` 条目收成唯一列表

- 发布前检查所有 agent 的 workspace 唯一性
- 发布后检查最近写入是否全部落到目标目录
- 定期审计是否出现新的 legacy 路径
- 把 workspace 路径规范写入部署脚本与运行态校验脚本

如果生产环境未来需要接入远端向量库，也应先保证 workspace 路径已经统一，否则远端索引只会把现有目录漂移问题放大。
