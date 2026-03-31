# Agency 转 OpenClaw Agent

本文档组用于评估并规划将 `agency-agents-main` 转换为本仓库可维护的 OpenClaw agent 资产。

相关文档：

- [Agency Compatibility Report](/agency/compatibility-report)
- [Agency OpenClaw Agent Conversion](/agency/openclaw-agent-conversion)
- [Agency First Batch Plan](/agency/first-batch-plan)
- [Agency Second Phase Overlap Resolution](/agency/second-phase-overlap-resolution)
- [Agency Second Batch Plan](/agency/second-batch-plan)
- [Agency Third Batch Plan](/agency/third-batch-plan)
- [Agency Fourth Batch Plan](/agency/fourth-batch-plan)
- [Agency Fifth Batch Plan](/agency/fifth-batch-plan)
- [Agency Sixth Batch Plan](/agency/sixth-batch-plan)
- [Agency Seventh Batch Plan](/agency/seventh-batch-plan)
- [Agency Eighth Batch Plan](/agency/eighth-batch-plan)
- [Agency Ninth Batch Plan](/agency/ninth-batch-plan)
- [Agency Tenth Batch Plan](/agency/tenth-batch-plan)
- [Agency Final Bulk Conversion](/agency/final-bulk-conversion)
- [Overlay Agents Migration](/operations/overlay-agents-migration)
- [Agents Asset Inventory](/operations/agents-asset-inventory)

当前结论：

- `agency-agents-main` 里的主体内容是角色 agent，不是 OpenClaw skill
- 大多数内容可以转成 OpenClaw agent，但不能原样当作 `overlay/skills/*`
- 正确落点应优先是 `overlay/agents/*` 与 `runtime-templates/agents/*`
- 不能直接使用对方仓库的 `scripts/install.sh --tool openclaw` 作为我们的正式导入方式，因为那会直接写入 runtime，绕过本仓库的 `core/upstream -> overlay -> runtime` 分层

建议执行顺序：

1. 先看兼容性报告，确认哪些目录适合直接迁、哪些必须适配
2. 再按转换方案，把第一批高兼容角色迁成 `overlay/agents/*`
3. 对与现有 `pc-*`、`yz-app-*` 重叠的角色，优先做合并吸收而不是新增 live agent
4. 继续按第二阶段重叠消解矩阵，把工程、产品、测试和应用 PM 角色吸收进现有业务 agent
5. 对设计、增长、销售、反馈综合、长内容、培训、测试分析、工具评估与流程优化等低冲突角色，继续按第二批到第十批计划转成新的 incubating `agency-*` agent
6. 余下未收口的 Agency 源角色，统一按 [Agency Final Bulk Conversion](/agency/final-bulk-conversion) 收成仓库内可装配的 incubating `agency-*` 或已吸收角色
