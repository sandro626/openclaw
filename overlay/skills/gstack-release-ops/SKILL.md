---
name: gstack-release-ops
description: |
  发版与部署全流程：ship（测试/评审/PR/发版串联）、land-and-deploy（合并并部署）、
  canary（灰度验证）。默认 operator-only。
metadata:
  openclaw: {}
---

# gstack-release-ops

整合 gstack 的 ship、land-and-deploy、canary 三大流程及 setup-deploy 配置。
适用于 ops 和 dev agent。

**触发场景**: "发版"、"部署"、"上线"、"ship"、"发布"、"灰度"、"canary"

## Principles

1. `/ship` 完成代码到 PR 的全流程
2. `/land-and-deploy` 完成合并与部署验证
3. `/canary` 进行部署后灰度探针验证
4. `/setup-deploy` 配置部署目标元数据
5. 严格按流程顺序执行，不跳步、不省略质量门槛
6. 任何步骤失败时立即通知 operator，提供回退方案

## Recommended flow

1. `/setup-deploy` (首次部署前配置)
2. `/ship` (lint -> test -> review -> PR)
3. `/land-and-deploy` (merge -> deploy -> verify)
4. `/canary` (post-deploy 监控)

---

## 1. ship -- 测试/评审/PR/发版串联

### 1.1 Pre-flight

- 检查当前分支，不得在 base 分支上执行 ship
- `git status` + `git diff <base>...HEAD --stat` + `git log <base>..HEAD --oneline`
- 检测 base 分支: `gh pr view --json baseRefName` 或回退 `main`

### 1.2 Review Readiness

Eng Review 必须通过; CEO/Design/Adversarial 可选不阻塞:

```
REVIEW READINESS DASHBOARD
| Review        | Runs | Status  | Required |
|---------------|------|---------|----------|
| Eng Review    |  1   | CLEAR   | YES      |
| CEO Review    |  0   | -       | no       |
| Design Review |  0   | -       | no       |
```

### 1.3 Merge Base Branch

`git fetch origin <base> && git merge origin/<base> --no-edit`
简单冲突自动解决 (VERSION, CHANGELOG); 复杂冲突停止通知 operator。

### 1.4 Run Tests

检测运行时 (node/ruby/go/python)，运行测试套件。
测试失败区分: in-branch (阻塞) vs pre-existing (记录但不阻塞)。

### 1.5 Test Coverage Audit

追踪 diff 每条代码路径，生成 ASCII 覆盖图 (TESTED/GAP)。
为未覆盖路径自动生成测试 (上限 20)。回归测试必须编写 (IRON RULE)。

### 1.6 Pre-Landing Review

按 checklist 检查: SQL 安全、LLM 信任边界、结构问题。
前端文件触发 design review。问题分类 AUTO-FIX (自动) / ASK (需确认)。

### 1.7 Version & CHANGELOG

自动从 diff 大小决定: MICRO (<50行) / PATCH (50+) 自动; MINOR/MAJOR 询问。
CHANGELOG 从分支 commit 自动生成，不询问。

### 1.8 Commit & PR

按逻辑单元拆分 commit (bisectable)，最终 commit 含 VERSION + CHANGELOG。
`gh pr create` body 含 Summary / Coverage / Review / TODOS。

### 1.9 发版检查清单

- [ ] CHANGELOG 已更新
- [ ] VERSION 已 bump
- [ ] 所有测试通过
- [ ] Eng Review 已通过
- [ ] 迁移脚本已准备 (如涉及)
- [ ] 回滚方案已记录

---

## 2. land-and-deploy -- 合并并部署

### 2.1 Pre-flight

- 验证 `gh auth status`
- 检测 PR: `gh pr view --json number,state,mergeable`
- PR 必须 OPEN，无合并冲突

### 2.2 Pre-merge Checks

- CI 状态: `gh pr checks` -- 失败停止，等待最多 15 分钟
- 部署前 operator 确认:
  - [ ] 数据库迁移已准备
  - [ ] 环境变量已更新
  - [ ] 依赖变更已确认

### 2.3 合并策略

| 策略         | 适用场景               |
| ------------ | ---------------------- |
| squash       | 默认推荐，保持线性历史 |
| merge commit | 多人协作大型功能       |
| rebase       | 单人小型功能           |

优先 `gh pr merge --auto --delete-branch`，回退 `--squash`。

### 2.4 部署执行

构建: `pnpm build`。部署按平台自动选择:

| 平台                  | 验证方法                 |
| --------------------- | ------------------------ |
| Fly.io                | `fly status --app {app}` |
| Render/Vercel/Netlify | 轮询 URL 直到 200        |
| GitHub Actions        | `gh run view <id>`       |
| 自定义                | CLAUDE.md 配置的命令     |

健康检查: `curl -sf "{url}"`。超时 20 分钟告警。

### 2.5 回滚流程

部署失败或 canary 发现严重问题:

```bash
git revert <merge-commit-sha> --no-edit && git push origin <base>
```

受保护分支使用 revert PR 代替直接 push。

---

## 3. canary -- 灰度/探针验证

### 3.1 灰度策略

| 策略          | 实施方式                     |
| ------------- | ---------------------------- |
| 按比例 (默认) | 部署后监控 10min -> 全量确认 |
| 按用户组      | 内部 -> 早期采用者 -> 全量   |
| 按地域        | 单区域 -> 多区域 -> 全区域   |

### 3.2 探针验证指标

| 指标         | 告警阈值       | 级别     |
| ------------ | -------------- | -------- |
| 页面加载失败 | goto 超时/错误 | CRITICAL |
| 内容完整性   | 空白/错误页    | CRITICAL |
| HTTP 错误率  | 新增任何错误   | HIGH     |
| Console 错误 | 新增非 warning | HIGH     |
| 响应时间     | > 2x 基线      | MEDIUM   |

每 60s 检查一次 (`$B goto/console/perf/snapshot`)。
仅连续 2 次以上持续异常才告警 (避免瞬时抖动误报)。

### 3.3 自动回滚触发

| 条件                    | 动作               |
| ----------------------- | ------------------ |
| 页面无法加载 (CRITICAL) | 立即通知，建议回滚 |
| 新增错误 > 3 (HIGH)     | 通知，等待决策     |
| 响应时间 > 5x (HIGH)    | 通知，等待决策     |
| 单次瞬时 (MEDIUM)       | 记录，继续监控     |

### 3.4 全量发布判定

全部满足时 HEALTHY:

- 所有页面加载正常
- 无新增 console 错误
- 响应时间在基线 2x 内
- 无 CRITICAL/HIGH 告警
- 监控至少 10 分钟

---

## 4. setup-deploy -- 部署元数据配置

### 4.1 配置模板

首次 `/land-and-deploy` 前运行。持久化到 CLAUDE.md:

```markdown
## Deploy Configuration

- Platform: {platform}
- Production URL: {url}
- Deploy workflow: {file or "auto-deploy on push"}
- Deploy status: {command or "HTTP health check"}
- Merge method: squash/merge/rebase
- Project type: web app / API / CLI / library
- Health check: {URL or command}

### Custom deploy hooks

- Pre-merge: {command or "none"}
- Deploy trigger: {command or "automatic on push to main"}
```

自动检测: `fly.toml` / `render.yaml` / `vercel.json` / `netlify.toml` / `Procfile`

### 4.2 密钥管理 (禁止明文)

- 禁止将密钥/token/密码写入代码或配置文件
- 禁止在日志/输出中打印完整密钥
- 使用平台 secrets 管理; 本地用 `.env` (确认 `.gitignore` 包含)

---

## 5. 输出格式

### 5.1 发版计划

```
RELEASE PLAN -- {project}
Branch:     {branch} -> {base}
Version:    {old} -> {new}
Changes:    {commit summaries}
Checklist:  CHANGELOG / VERSION / Tests / Review / Migrations / Rollback
Risk:       Scope / Lines / Files / Breaking?
Timeline:   Ship + Merge + Deploy + Canary = Total
```

### 5.2 部署报告

```
LAND & DEPLOY REPORT
PR: #{number} -- {title}
Merged: {timestamp} ({method})  SHA: {sha}
Timing: CI {X}m | Queue {X}m | Deploy {X}m | Canary {X}m | Total {X}m
Status: CI PASSED | Deploy PASSED | Verification HEALTHY
VERDICT: DEPLOYED AND VERIFIED / REVERTED
```

### 5.3 灰度验证报告

```
CANARY REPORT -- {url}
Duration: {X}min | Pages: {N} | Checks: {N}
Status:   HEALTHY / DEGRADED / BROKEN

Per-Page:  / HEALTHY 0err 450ms | /dashboard DEGRADED 2new 1200ms
Alerts:    {N} (X critical, Y high, Z medium)
VERDICT:   DEPLOY IS HEALTHY / DEPLOY HAS ISSUES
```
