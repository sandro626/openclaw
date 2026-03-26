# OpenClaw Runtime 统一执行清单

## 适用范围

适用于以下情况：

- 本地仓库与生产主机代码已经分叉
- 生产主机同时保存了大量运行态数据
- 需要先统一代码与配置，再恢复可升级的发布流程

总方案见 [Runtime Unification](/operations/runtime-unification)。

## 结果定义

执行完成后，应达到以下状态：

1. 生产主机不再直接手改 OpenClaw 源码
2. 本地仓库成为唯一真源码
3. 业务定制被拆到 overlay 层
4. 运行态数据与源码分离
5. 后续升级 OpenClaw 只需要验证 overlay 兼容性

## 阶段 0：冻结现状

### 目标

先停止新的无序漂移。

### 操作

1. 暂停在生产主机直接修改源码
2. 暂停直接手改生产配置文件，除非为了故障止血
3. 约定后续所有改动先回到本地

### 完成标准

- 团队内明确：生产主机只允许部署，不允许继续开发

## 阶段 1：回收生产真相

### 目标

把当前生产上的程序、配置、定制全部导回本地，形成可分析基线。

### 必须回收的内容

#### 程序层

- 生产主机当前 OpenClaw 程序目录
- 当前 extensions 目录
- 当前 skills 目录
- 当前自定义 scripts 目录

#### 配置层

- 当前实际生效的 `openclaw.json`
- 当前部署脚本
- 当前环境依赖说明

#### 运行态层

运行态不直接并入源码，但需要做结构归档：

- `~/.openclaw/agents/`
- `~/.openclaw/workspace*/`
- `~/.openclaw/memory/`

### 不要直接并入源码仓库的内容

- `sessions/*.jsonl`
- `sessions/sessions.json`
- `memory/*.sqlite`
- workspace 中的临时产物
- 运行日志

### 建议落地方式

在本地建立一个恢复目录，例如：

```text
recovery/
├── app-snapshot/
├── config-snapshot/
└── runtime-audit/
```

### 完成标准

- 本地已经拥有一份完整的生产快照
- 可以离线分析，无需再依赖生产主机做 diff

## 阶段 2：建立对比基线

### 目标

把差异定位清楚，不再凭印象判断。

### 对比对象

必须同时做三向对比：

1. 本地当前开发仓库
2. 生产程序快照
3. 官方 OpenClaw upstream 基线

### 输出物

建议产出一份表格，列出每一类差异：

| 差异位置         | 生产存在 | 本地存在 | upstream 存在 | 分类 | 处理方式       |
| ---------------- | -------- | -------- | ------------- | ---- | -------------- |
| `extensions/...` | yes      | no       | no            | B    | 搬到 overlay   |
| `src/...`        | yes      | yes      | no            | A/B  | 判断是否上游化 |
| `openclaw.json`  | yes      | yes      | n/a           | C    | 改成模板       |

### 差异分类规则

#### A 类：通用修复

满足以下任一条件：

- 对所有环境都有意义
- 与业务无关
- 未来希望随 upstream 一起演进

处理方式：

- 收敛到 fork
- 尽量保留为最小 patch

#### B 类：业务定制

满足以下任一条件：

- 与 Feishu 业务流程强相关
- 与你们的 agent 体系强相关
- 与你们的 memory / 报表 / 定时任务强相关

处理方式：

- 迁移到 overlay

#### C 类：运行配置

满足以下任一条件：

- 只描述环境差异
- 只描述密钥、路径、账号、模型

处理方式：

- 迁移到模板和变量注入

#### D 类：历史残留

满足以下任一条件：

- 旧目录
- 旧脚本
- 临时 debug 代码
- 已无引用逻辑

处理方式：

- 删除或归档

### 完成标准

- 所有生产与本地的差异都已经有类别和归宿

## 阶段 3：拆分仓库与目录职责

### 目标

建立长期可维护结构。

### 推荐结构

#### 程序仓库

```text
openclaw-fork/
```

职责：

- 跟进 OpenClaw upstream
- 仅保留必要 patch

#### Overlay 仓库

```text
openclaw-overlay/
├── extensions/
├── skills/
├── scripts/
├── config-templates/
└── patches/
```

职责：

- 保存业务定制
- 保存环境模板
- 保存部署逻辑

#### 运行态目录

```text
~/.openclaw/
```

职责：

- 保存生产配置
- 保存 session、workspace、memory

### 必须迁移出 core 的内容

- 自定义 Feishu 定制逻辑
- 报表生成脚本
- 业务 cron 脚本
- 自定义 memory 策略
- 主机环境特定路径

### 完成标准

- 你们能回答每一个文件“它属于程序、overlay，还是 runtime”

## 阶段 4：整理配置管理

### 目标

让配置成为可渲染、可审计、可回滚的对象。

### 推荐拆法

#### 基础模板

```text
config-templates/openclaw.base.json
```

#### 环境覆盖

```text
config-templates/environments/prod.json
config-templates/environments/staging.json
```

#### 敏感值注入

通过环境变量或 secret 管理注入：

- Feishu 密钥
- OSS 密钥
- 第三方服务 token

### 禁止事项

- 不要把生产密钥长期明文保存在源码仓库
- 不要让生产 `openclaw.json` 成为唯一配置来源

### 完成标准

- 生产配置可以由模板 + 环境变量重新生成

## 阶段 5：建立部署流程

### 目标

以后所有变更都通过同一条发布链路上线。

### 推荐流程

1. 更新 `openclaw-fork`
2. 应用 `openclaw-overlay`
3. 构建程序
4. 渲染目标环境配置
5. 备份生产运行态
6. 部署程序文件
7. 差异化更新配置
8. 重启 gateway
9. 运行 smoke test

### 部署时允许覆盖的内容

- 程序安装目录
- overlay 中的插件、skills、脚本

### 部署时禁止覆盖的内容

- `~/.openclaw/agents/*/sessions/`
- `~/.openclaw/workspace*/`
- `~/.openclaw/memory/*.sqlite`

配套保护规则见 [Deploy Protection](/operations/deploy-protection)。

### 完成标准

- 生产发布不再依赖手工 rsync 某几个目录

## 阶段 6：整理 workspace 与 memory

### 目标

消除路径漂移，让 memory 行为可解释。

### 必查项

对每个 agent 列出：

- `agentId`
- 配置中的 workspace
- 实际存在的 workspace 目录
- 是否存在旧路径
- 是否存在 `memory/`
- 是否存在 `MEMORY.md`
- 对应的 sqlite memory 文件

### 迁移规则

1. 先选定唯一 workspace 命名规范
2. 旧路径先复制，不直接删除
3. 改配置指向新路径
4. 验证 agent 实际读到的是新路径
5. 稳定后再清理旧目录

### 完成标准

- 不再存在同一 agent 多套 workspace 命名并行的情况

## 阶段 7：建立升级验证机制

### 目标

把“升级”变成可重复动作，而不是一次次人工合并生产手改。

### 每次升级前

1. 拉取 upstream 新版本
2. 尝试应用现有 overlay
3. 统计冲突点
4. 判断是否需要调整 overlay

### 每次升级后

1. 校验 gateway 是否正常启动
2. 校验 Feishu 账号绑定
3. 校验 workspace 路径
4. 校验 sessions 未丢失
5. 校验 memory sqlite 未丢失

### 完成标准

- 团队可以独立回答“升级失败是 upstream 变更导致，还是 overlay 设计过重导致”

## 立即可执行的任务清单

以下是建议优先级。

### P0

- 冻结生产源码手改
- 导回生产程序快照
- 导回生产配置脱敏版本
- 建立三向 diff 表
- 明确唯一真配置源

### P1

- 创建 overlay 仓库或目录
- 把业务脚本迁移到 overlay
- 把配置改成模板 + 注入
- 整理 workspace 命名规范

### P2

- 减少 core patch 数量
- 设计远端 memory backend 抽象
- 建立标准化 smoke test

## 哪些文件应该进 repo

应该进 repo 的文件：

- 插件源码
- skills
- 部署脚本
- 配置模板
- 文档
- 小范围 patch

不应该进 repo 的文件：

- 生产密钥
- sessions 数据
- sqlite memory 数据库
- 临时产物
- 主机本地日志

## 验收标准

当以下问题都能稳定回答时，说明统一工作基本完成：

- 生产程序来自哪个 commit
- 生产配置由哪份模板渲染出来
- 哪些改动属于 OpenClaw 核心，哪些属于 overlay
- 哪个目录才是某个 agent 的唯一 workspace
- 部署是否会覆盖 sessions 和 memory
- 升级时需要修改的是 upstream 还是 overlay

## 下一步建议

完成本清单后，建议继续补两份文档：

- `workspace-migration`：专门定义 workspace 迁移规则
- `runtime-audit`：专门记录生产运行态真实布局与校验方法
