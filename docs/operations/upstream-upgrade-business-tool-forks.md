# Upstream Upgrade Business Tool Forks

本页记录 `Group 3` 里 `mysql-readonly` 和 `zentao` 这两类业务工具扩展的处理原则。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

## 结论

`mysql-readonly` 和 `zentao` 当前都不需要再做目录层迁移。

它们已经具备我们想要的形态：

- 插件源码单真源在 `extensions/*`
- 运行态参数进入 `runtime-templates/extensions/*`
- 操作说明和 workflow 指南留在 `overlay/skills/*`

后续重点不是“继续搬目录”，而是：

- 保持单真源
- 沿 upstream 公共 seam 收敛
- 不再产生 overlay 同名源码副本

## `mysql-readonly`

### 当前状态

- 插件源码真源：`extensions/mysql-readonly/**`
- runtime 模板：`runtime-templates/extensions/mysql-readonly/**`
- skill 指南：`overlay/skills/mysql-readonly/SKILL.md`

README 和 runtime 模板已经明确了这条边界：

- `extensions/mysql-readonly/README.md`
- `runtime-templates/extensions/mysql-readonly/README.md`

### 为什么它应继续保留

`mysql-readonly` 不是通用上游能力，而是明显的业务工具型扩展：

- 只读数据库访问
- 明确的 SQL guardrails
- 以 allowlist、超时、结果上限为核心配置

这类能力即使以后继续向 upstream seam 靠拢，也仍然很可能继续作为本地扩展存在。

### 后续重点

后续不该再做的是：

- 重新把源码复制到 `overlay/extensions/mysql-readonly/**`
- 把真实数据库连接写回 repo
- 把 skill 指南误当成第二份源码真源

后续该做的是：

- 继续贴近 upstream plugin/tool contracts
- 让 config schema、guardrails、tests 跟上公共 seam
- 把环境值继续限制在 `runtime-templates/**` 和真实 runtime

## `zentao`

### 当前状态

- 插件源码真源：`extensions/zentao/**`
- runtime 模板：`runtime-templates/extensions/zentao/**`
- skill 指南：`overlay/skills/zentao/SKILL.md`

README 和 runtime 模板已经明确了这条边界：

- `extensions/zentao/README.md`
- `runtime-templates/extensions/zentao/README.md`

### 为什么它应继续保留

`zentao` 也是典型的业务系统集成扩展：

- 面向特定项目管理系统
- 需要 per-agent 账号映射
- 有明确的 write guards 和 scope allowlists

这类能力的关键价值不在目录位置，而在：

- plugin 级 guardrails
- agent 级 credential / account mapping
- skill 层的安全调用习惯

### 后续重点

后续不该再做的是：

- 重新长出 `overlay/extensions/zentao/**` 镜像源码
- 把 agent 凭据写回插件模板
- 把 repo 内 skill 指南和运行时参数混在一起

后续该做的是：

- 继续把 agent 账号密码留在 agent/runtime 配置
- 让插件代码尽量走 upstream 公共 seam
- 保持 `extensions/zentao/**` 单真源

## 对 `Group 3` 的意义

`mysql-readonly` 和 `zentao` 的定位，和 `wecom`、`superBrower` 不一样：

- 它们不是当前运行时显式 overlay 分叉
- 也不是和 upstream 新平台面强重叠的高优先级收敛目标

它们更像“已经收口成单真源的本地业务工具插件”。

因此后续处理原则应该是：

1. 不再继续改目录归属
2. 不再恢复 overlay 镜像源码
3. 主要做公共 seam、tests、config surface 的收敛

## 推荐的下一步

如果继续推进 `Group 3`：

1. `superBrower` 作为最高优先级收敛对象继续处理
2. `mysql-readonly` 和 `zentao` 只做 seam/test/config 面的跟进
3. `wecom` 保持当前显式 overlay fork，不做无意义统一
