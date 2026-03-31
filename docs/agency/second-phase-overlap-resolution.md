# Agency 第二阶段重叠消解

## 目标

第二阶段不再继续新增大量 `agency-*` agent，而是把与现有业务体系高度重叠的 Agency 角色吸收进当前 `pc-*`、`yz-app-*`、`ops` 与 `pc-ceo_assistant`。

这样做的目的：

- 保持 live `agents.list` 收敛，不引入第二套同质角色
- 让现有业务 agent 直接吸收更成熟的方法论、交付结构和工作边界
- 把外部人格资产收进本仓库的静态骨架，而不是继续依赖外部目录

## 当前结论

第二阶段分两条线推进：

- 已完成的业务角色吸收试跑：
  - `pc-ceo_assistant` -> 元小芯
  - `pc-pm` -> 元小宝
  - `ops` -> 元小运
- 本轮完成的现有角色静态增强：
  - `pc-backend`
  - `pc-frontend`
  - `pc-code_reviewer`
  - `pc-devops`
  - `pc-pctester`
  - `pc-ai-pythondev`
  - `yz-app-pm`
  - `pc-yz-app-pm`

这些增强仍然只落在：

- `overlay/agents/<id>/workspace/*`

不会因为静态骨架补全，就自动新增或替换生产配置。

## 吸收规则

每个 Agency 角色进入第二阶段前，都要先回答两个问题：

1. 它是否已经与现有业务 agent 高度重叠
2. 它更适合作为现有 agent 的方法论增强，还是必须保留为 net-new 角色

如果答案是“高度重叠”，就按吸收处理，而不是新建 live agent。

## 第二阶段映射矩阵

| Agency 源文件                                                | 目标 agent                           | 吸收内容                                          | 不直接复制的内容                          |
| ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------- | ----------------------------------------- |
| `product/product-feedback-synthesizer.md`                    | `pc-pm`, `yz-app-pm`, `pc-yz-app-pm` | 用户反馈归因、主题归类、优先级框架、VoC 摘要      | 外部 survey / dashboard / NLP 平台假设    |
| `product/product-manager.md`                                 | `pc-pm`, `yz-app-pm`, `pc-yz-app-pm` | 问题导向、PRD 结构、目标/非目标、度量与对齐       | 固定 PM 名字、外部 org 结构、泛化长模板   |
| `product/product-sprint-prioritizer.md`                      | `pc-pm`, `yz-app-pm`, `pc-yz-app-pm` | RICE / MoSCoW、冲刺切分、范围控制、交付节奏       | 绑定特定敏捷工具或流程套件                |
| `project-management/project-management-project-shepherd.md`  | `pc-pm`, `ops`, `pc-ceo_assistant`   | 任务推进、依赖跟踪、责任人和节奏控制              | 直接写外部项目系统或主目录文件            |
| `project-management/project-management-studio-operations.md` | `ops`, `pc-devops`                   | 运营节奏、流程可视化、SOP、资源协调               | 线下场地/设备/供应商管理假设              |
| `engineering/engineering-backend-architect.md`               | `pc-backend`                         | 接口契约、服务边界、数据模型、演进与兼容策略      | 固定框架、固定目录、固定云厂商架构        |
| `engineering/engineering-frontend-developer.md`              | `pc-frontend`                        | 交互实现、状态管理、前端性能、可访问性基线        | 专属 IDE 指令和项目私有脚本               |
| `engineering/engineering-code-reviewer.md`                   | `pc-code_reviewer`                   | 风险排序、正确性回归、可维护性审查、评论格式      | GitHub/GitLab 固定评论流程                |
| `engineering/engineering-security-engineer.md`               | `pc-code_reviewer`, `pc-devops`      | 威胁建模、配置风险、输入校验、安全优先级          | 渗透利用脚本、专有安全平台假设            |
| `engineering/engineering-git-workflow-master.md`             | `pc-code_reviewer`                   | 原子提交、rebase 纪律、变更边界意识               | 与本仓库策略冲突的 branching 建议         |
| `engineering/engineering-devops-automator.md`                | `pc-devops`                          | 自动化、发布流水线、监控、回滚、IaC 思维          | 绑定特定云服务与 CI 平台配置              |
| `engineering/engineering-ai-engineer.md`                     | `pc-ai-pythondev`                    | Python / AI 集成、数据流处理、工具原型化          | 固定模型提供商、固定 notebook / data path |
| `engineering/engineering-rapid-prototyper.md`                | `pc-ai-pythondev`                    | 快速验证、脚本化原型、演示级实现                  | 不可维护的 throwaway runtime 约定         |
| `engineering/engineering-technical-writer.md`                | `ops`                                | 技术文档、README、SOP、集成说明、运行手册         | 把它扩成独立 live 账户或假设专有文档平台  |
| `testing/testing-reality-checker.md`                         | `pc-pctester`                        | 默认怀疑、证据优先、端到端核实、拒绝幻想式通过    | 固定 screenshot 脚本和非本仓库 QA 命令    |
| `testing/testing-accessibility-auditor.md`                   | `pc-pctester`, `pc-frontend`         | WCAG 视角、键盘可用性、屏幕阅读器思维、包容性验证 | 对特定辅助工具和平台的硬编码要求          |
| `testing/testing-tool-evaluator.md`                          | `pc-pctester`                        | 工具评估框架、试点验证、成本与安全视角            | 泛化的 vendor/采购流程                    |

## 当前仓库落地范围

本轮第二阶段已经把以下 agent 从占位骨架提升为可用的静态角色骨架：

- `pc-backend`
- `pc-frontend`
- `pc-code_reviewer`
- `pc-devops`
- `pc-pctester`
- `pc-ai-pythondev`
- `yz-app-pm`
- `pc-yz-app-pm`

每个角色现在都应具备或开始具备：

- `IDENTITY.md`
- `AGENTS.md`
- `TOOLS.md`
- `USER.md`
- `CLAUDE.md -> AGENTS.md`

## 不在第二阶段做的事

第二阶段不会：

- 把 Agency 的工程角色原样复制成新的 live `agency-*` 技术 agent
- 把外部仓库的固定路径、记忆系统、专属 IDE 指令带进本仓库
- 修改生产 `agents.list`，除非后续明确批准
- 把任何 runtime 历史、真实 memory、真实 sessions 回流进 repo

## 验收标准

第二阶段被视为完成，需要同时满足：

1. `docs/agency` 有明确的重叠消解矩阵
2. 现有业务角色不再只有空白 `IDENTITY.md`
3. 新增静态文件仍然符合 `overlay/agents` 白名单
4. `pnpm check:repo-layering` 通过
5. `pnpm ops:assemble` 与 `pnpm ops:seed-workspaces --dry-run` 能正常渲染与补种

## 下一步

第二阶段完成后，下一步应继续做两件事：

1. 选择 `pc-backend`、`pc-frontend`、`pc-pctester` 或 `yz-app-pm` 中的 `1` 到 `2` 个角色，在 staging 做真实试跑
2. 再决定哪些吸收结果需要进入 live 行为模板，而不是只停留在静态骨架层
