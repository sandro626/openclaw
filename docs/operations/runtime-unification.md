# OpenClaw Runtime 与源码统一方案

## 目标

适用于这样的场景：

- 本地开发仓库与生产网关主机上的源码已经出现差异
- 生产环境还保留了大量运行态数据，不能直接覆盖
- 后续仍希望持续跟进 OpenClaw 官方升级，而不是长期锁死在一台服务器上的手改版本

此方案的核心目标有三个：

1. 让生产环境重新回到“本地仓库可追溯、可发布、可回滚”的状态
2. 把业务定制从 OpenClaw 主程序中剥离出来，降低升级成本
3. 把运行态数据与源码彻底分层，避免部署时误覆盖 sessions、workspace、memory

配套的运行态保护规则见 [Deploy Protection](/operations/deploy-protection)。

## 核心原则

### 1. 不再把生产主机当作源码真相

生产主机上的代码只能是**部署结果**，不能继续作为唯一真源码。

### 2. 不再把运行态目录当作源码目录

以下内容属于运行态状态，不应直接纳入主程序源码仓库：

- `~/.openclaw/openclaw.json`
- `~/.openclaw/agents/*/sessions/`
- `~/.openclaw/agents/*/workspace/`
- `~/.openclaw/workspace*/`
- `~/.openclaw/memory/*.sqlite`

### 3. 优先用配置、插件、skills 承载定制

长期应优先使用下面这些定制方式：

1. 配置
2. skill
3. plugin / extension
4. 外部脚本
5. 小范围 patch
6. 直接修改 OpenClaw 核心源码

### 4. 部署只能覆盖程序，不覆盖记忆和会话

发布必须做到：

- 更新程序代码
- 保留运行态数据
- 保留现有 workspace
- 保留 sessions 和 memory 数据库

## 推荐目录模型

推荐把整体拆成三层。

### 第一层：Upstream 程序层

用于跟踪官方 OpenClaw：

```text
openclaw-upstream/
```

要求：

- 尽量接近官方仓库
- 尽量不放业务私有逻辑
- 用于吸收上游升级

### 第二层：Overlay 定制层

用于承载你们自己的定制：

```text
openclaw-overlay/
├── extensions/
├── skills/
├── scripts/
├── patches/
└── config-templates/
```

建议放入这里的内容：

- Feishu 相关业务定制
- 自定义 memory backend
- 定时任务脚本
- 部署脚本
- 配置模板

### 第三层：Runtime 运行态层

生产主机仅保存运行数据：

```text
~/.openclaw/
├── openclaw.json
├── agents/
├── workspace/
├── workspace-*
└── memory/
```

这一层不能再当作源码仓库使用。

## 推荐仓库模型

最稳妥的是双仓或三仓模式。

### 方案 A：双仓

```text
repo 1: openclaw-fork
repo 2: openclaw-deploy
```

其中：

- `openclaw-fork`：追踪官方 OpenClaw，必要时保留极少量 patch
- `openclaw-deploy`：保存 overlay、模板、部署脚本、环境约束

### 方案 B：三仓

```text
repo 1: openclaw-upstream-mirror
repo 2: openclaw-overlay
repo 3: openclaw-deploy
```

适合定制较多、环境较多的团队。

## 现状收敛步骤

在开始重构之前，先把现状完整收口。

### 第一步：冻结生产源码变更

先建立规则：

- 不再直接在生产主机修改 OpenClaw 源码
- 生产主机只能执行部署，不再执行开发

如果还允许在生产主机继续手改，差异会继续扩大，后续统一没有边界。

### 第二步：导回生产源码快照

从生产主机导回以下内容到本地隔离分支或恢复目录：

- 当前程序源码目录
- 当前启用的自定义 extensions
- 当前启用的 skills
- 自定义脚本目录
- 运行配置文件的脱敏版本

注意：

- 不要把整个 `~/.openclaw/` 直接当源码回收
- sessions、workspace、sqlite memory 只做归档，不直接混入源码树

### 第三步：建立三向对比

需要同时对比三份内容：

1. 本地当前开发仓库
2. 生产主机上的程序源码
3. 官方 OpenClaw upstream 基线

每一处差异都要分类。

## 差异分类方法

把所有差异分成四类。

### A 类：应该回归 upstream 的通用代码

这类改动如果对所有环境都有意义，应尽量：

- 收敛到 fork
- 能 upstream 就 upstream

### B 类：应该迁移到 overlay 的业务定制

这类改动通常包括：

- Feishu 业务流程定制
- memory 策略定制
- 自定义命令脚本
- 定时任务和报表生成逻辑

处理原则：

- 从核心源码中搬出
- 放到 plugin / skill / script

### C 类：运行态配置

例如：

- agent 列表
- Feishu account 绑定
- 模型配置
- 生产路径

这类内容应进入：

- 配置模板
- 环境变量
- 部署变量

不应继续硬编码在程序源码里。

### D 类：临时实验或历史残留

例如：

- 旧 workspace 路径
- 已废弃脚本
- 临时 debug 代码
- 临时补丁

处理原则：

- 删除
- 或归档
- 不进入长期维护链路

## 统一后的发布模型

统一完成后，发布流程应固定为：

1. 拉取指定的 OpenClaw upstream 版本
2. 应用 overlay 定制
3. 生成目标环境配置
4. 部署程序文件到目标主机
5. 验证运行态未被覆盖
6. 重启 gateway
7. 做 smoke test

## 建议的部署边界

部署时只更新程序目录，不直接覆盖运行态根目录。

### 可以被部署覆盖的内容

- 安装目录下的程序文件
- Overlay 中的插件、skills、脚本

### 不能被部署覆盖的内容

- `~/.openclaw/openclaw.json` 原文件
- `~/.openclaw/agents/*/sessions/`
- `~/.openclaw/agents/*/workspace/`
- `~/.openclaw/workspace*/`
- `~/.openclaw/memory/*.sqlite`

如果需要更新配置，应走：

- 模板渲染
- 差异比对
- 人工确认
- 再写入

而不是直接整文件覆盖。

## 建议的配置管理方式

把运行配置拆成三部分。

### 1. 基础模板

放在仓库中，例如：

```text
config-templates/openclaw.base.json
```

包含：

- 通用 gateway 配置
- 通用模型配置
- 通用插件开关

### 2. 环境覆盖

例如：

```text
config-templates/environments/prod.json
config-templates/environments/staging.json
```

包含：

- 主机相关路径
- 运行模式
- 日志级别

### 3. 敏感值注入

通过环境变量或 secret 系统注入：

- Feishu app secrets
- OSS 凭证
- 第三方 token

不要长期把敏感值明文保存在仓库或手写配置中。

## 对现有定制的迁移建议

### Feishu 相关定制

如果是路由、会话、bot 绑定层面的通用定制：

- 优先迁移到 extension
- 避免继续修改核心通道框架

参考文档：[Feishu](/channels/feishu)

### Memory 相关定制

如果需要长期保留自己的记忆策略：

- 优先做成独立 memory plugin
- 不要直接把业务逻辑写死到 builtin manager

### 定时任务与报表脚本

建议迁移到：

- overlay 脚本目录
- 或 workspace 初始化模板

不要把“生产业务任务脚本”直接混入 OpenClaw 核心目录。

## 生产主机统一检查清单

在统一过程中，每台生产主机都应跑一次如下检查。

### 源码层

- 当前程序目录来自哪一个 commit
- 是否存在未提交本地修改
- 是否存在手工新增文件

### 配置层

- 当前使用哪个 `openclaw.json`
- Feishu account 与 agent 绑定是否一对一
- workspace 路径是否唯一

### 运行态层

- sessions 是否存在
- workspace 是否存在
- memory sqlite 是否存在
- 最近一次发布是否误覆盖 workspace

### 升级层

- 是否能在不修改业务 overlay 的前提下升级 OpenClaw
- 是否有 patch 会在升级时反复冲突

## 一次性迁移实施清单

下面是推荐的落地顺序。

### 阶段 1：收口

1. 冻结生产源码手改
2. 导回生产源码快照
3. 导回配置脱敏模板
4. 归档运行态目录结构

### 阶段 2：分类

1. 建立本地恢复分支
2. 完成三向 diff
3. 把差异分类为 A/B/C/D 四类

### 阶段 3：拆层

1. 创建 overlay 仓库或目录
2. 把业务 extensions / skills / scripts 搬出核心程序
3. 把配置改成模板 + 注入

### 阶段 4：发布链路固定

1. 建立部署脚本
2. 建立配置渲染脚本
3. 建立 pre-deploy 备份
4. 建立 post-deploy smoke test

### 阶段 5：升级验证

1. 拉取新 upstream 版本
2. 应用 overlay
3. 验证 patch 是否减少
4. 验证运行态不丢失

## 不推荐的做法

以下做法会让升级越来越困难：

- 在生产主机直接改 OpenClaw 源码
- 把运行态目录当作源码仓库同步
- 把 sessions、workspace、memory sqlite 提交进主程序仓库
- 把业务脚本直接塞进核心 `src/`
- 每次升级靠 rsync 覆盖整棵 `~/.openclaw/`

## 推荐的最终状态

理想状态下，生产环境应该满足：

- 主程序可以按版本升级
- 业务定制有独立来源
- 运行态数据独立保存
- 配置可渲染、可追溯、可回滚
- 任何一台主机都可以通过同一套部署流程重建

达到这个状态后，OpenClaw 的升级问题会从“合并一台服务器上的手改代码”变成“验证 overlay 是否仍兼容新版本”，成本会低很多。

## 配套文档建议

在完成统一后，建议继续补齐这几类文档：

- `runtime-audit`：运行态真相与路径说明
- `workspace-migration`：workspace 命名与迁移规则
- `memory-health`：memory 生效判定标准
- `feishu-routing`：Feishu account、agent、群路由约束

这些文档应与本方案一起维护，作为后续升级和迁移的基线。
