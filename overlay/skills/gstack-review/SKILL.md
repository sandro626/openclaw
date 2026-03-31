---
name: gstack-review
description: |
  整合 gstack review 与 codex 对抗审查的 pre-landing code review 技能。分析 diff 对比 base branch，检查安全漏洞、逻辑缺陷、性能问题，输出结构化报告并支持第二意见模式。
metadata:
  openclaw: {}
---

# gstack-review: Pre-Landing Code Review

整合 gstack review 核心方法论与 codex 对抗审查能力的代码审查技能。

**承载 agent**: cto, dev, pc-code_reviewer

**触发场景**: "帮我 review 代码"、"代码审查"、"review 这个 PR"、"pre-landing review"、"检查 diff"

---

## Review 流程

```
1. 检测 base branch
2. 获取 diff (git diff origin/<base>)
3. 范围漂移检测 (scope drift)
4. 两轮审查 (critical → informational)
5. 输出结构化报告
6. 第二意见模式 (可选)
```

### Step 1: 检测 base branch

```bash
# 优先从 PR 获取
gh pr view --json baseRefName -q .baseRefName 2>/dev/null

# 无 PR 则用默认分支
gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null

# 都失败则回退 main
```

如果当前在 base branch 或无 diff，输出"无变更需要审查"并停止。

### Step 2: 获取 diff

```bash
git fetch origin <base> --quiet
git diff origin/<base>
```

读完 **整个 diff** 再开始审查，不要看到一半就下结论。

### Step 3: 范围漂移检测

确认 diff 做了预期的事，不多不少：

1. 从 PR 描述、commit message、TODOS.md 提取**预期意图**
2. 对比 diff 实际改动与预期意图
3. 输出判定：

```
Scope Check: [CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING]
Intent: <预期做了什么>
Delivered: <实际做了什么>
[漂移项列表]
[缺失项列表]
```

此步骤为**信息性**，不阻断后续审查。

### Step 4: 两轮审查

**Pass 1 — CRITICAL（安全相关，优先审查）：**

| 类别         | 检查要点                                                                    |
| ------------ | --------------------------------------------------------------------------- |
| SQL 注入     | 字符串拼接 SQL、未参数化查询、TOCTOU 竞态                                   |
| 并发竞态     | check-then-set 非原子操作、find-or-create 无唯一索引、状态转换无 WHERE 保护 |
| LLM 信任边界 | LLM 输出写入 DB 前无格式校验、结构化工具输出无类型检查                      |
| 枚举完整性   | 新增枚举值未在所有消费方处理（需 grep 全项目）                              |

**Pass 2 — INFORMATIONAL（逻辑与质量）：**

| 类别       | 检查要点                                                   |
| ---------- | ---------------------------------------------------------- |
| 条件副作用 | if 分支漏掉副作用、日志声称执行了但实际跳过                |
| 魔法数字   | 裸数字字面量、错误信息字符串跨文件耦合                     |
| 死代码     | 赋值未读取、注释描述旧行为、版本号不匹配                   |
| LLM Prompt | 0-indexed 列表、工具列表与实际不一致、token 限制重复声明   |
| 测试缺失   | 负路径缺少副作用断言、安全功能无集成测试                   |
| 性能影响   | 重依赖引入(moment.js/lodash full)、同步 script、请求瀑布流 |
| 类型边界   | 跨 JSON 序列化的类型变化、hash 输入未 normalize            |

### Step 5: 输出报告

```
Pre-Landing Review: N issues (X critical, Y informational)

**CRITICAL:**
1. [file:line] 问题描述
   修复建议: 具体修复方案

**INFORMATIONAL:**
1. [file:line] 问题描述
   修复建议: 具体修复方案

**AUTO-FIXED:**
- [file:line] 问题 → 已自动修复内容
```

无问题则输出: `Pre-Landing Review: No issues found.`

---

## 检查清单

快速参考，审查时逐项核对：

### 安全

- [ ] 无 SQL 字符串拼接，全部参数化
- [ ] 无 XSS 风险 (dangerouslySetInnerHTML / v-html / raw / |safe)
- [ ] 无命令注入 (exec/spawn 拼接用户输入)
- [ ] 敏感值使用 SecureRandom，非 rand()
- [ ] Secret/Token 使用常量时间比较
- [ ] LLM 输出写入 DB 前有格式校验

### 性能

- [ ] 无 N+1 查询 (missing eager loading)
- [ ] 新增依赖无 bundle 膨胀 (moment → date-fns, lodash full → per-function)
- [ ] 图片有 lazy loading / width+height
- [ ] 无请求瀑布流 (串行 fetch 可并行)
- [ ] 视图层无 O(n\*m) 查找 (Array.find in loop → Map/indexBy)

### 逻辑

- [ ] 状态转换原子性 (WHERE old_status = ? UPDATE SET new_status)
- [ ] find-or-create 有唯一索引保护
- [ ] 条件分支副作用完整 (每条路径都处理了副作用)
- [ ] 枚举/状态值新增后所有消费方已更新
- [ ] 错误路径不吞异常 (catch 后有 log/escalate)

### 边界

- [ ] 空/null/undefined 输入处理
- [ ] 空 collection 渲染
- [ ] 时间窗口一致性 (小时 vs 天级 key)
- [ ] 跨序列化类型保持 (numeric vs string hash)
- [ ] 并发请求处理 (幂等性、去重)

---

## 严重程度分级

```
CRITICAL — 必须修复，阻断合并
├── SQL 注入、XSS、命令注入
├── 竞态条件导致数据不一致
├── LLM 输出未校验直接入库
└── 枚举遗漏导致功能中断

INFORMATIONAL — 建议修复
├── 条件副作用遗漏
├── 死代码 / 过时注释
├── 性能可优化项
├── 测试覆盖缺口
└── 代码规范 / 一致性
```

---

## 第二意见模式（对抗审查）

当用户要求"对抗审查"、"第二意见"、"adversarial review"，或 diff 超过 200 行时自动触发。

### 触发逻辑

| diff 行数 | 模式                  |
| --------- | --------------------- |
| < 50 行   | 不触发                |
| 50-199 行 | 对抗挑战              |
| 200+ 行   | 结构化审查 + 对抗挑战 |

### 对抗审查角色设定

切换到攻击者 + 混沌工程师视角：

> 这段代码在生产环境怎么挂？找边界条件、竞态、安全漏洞、资源泄漏、静默数据损坏、吞异常的错误处理、信任边界违反。不要夸赞，只找问题。

对每个发现分类：

- **FIXABLE** — 知道怎么修
- **INVESTIGATE** — 需要人工判断

### 对抗审查输出格式

```
ADVERSARIAL REVIEW (第二意见):
════════════════════════════════════════════════════════════
  高置信度 (主审+对抗均发现): [列表]
  仅主审发现: [列表]
  仅对抗审查发现: [列表]
════════════════════════════════════════════════════════════
```

两个视角都发现的问题优先级最高。

---

## 修复优先级

审查完成后，问题按以下顺序处理：

1. **安全类** — SQL 注入、XSS、命令注入 → 立即修复
2. **数据一致性** — 竞态、枚举遗漏、LLM 未校验 → 立即修复
3. **逻辑缺陷** — 条件副作用、吞异常 → 本 PR 修复
4. **性能** — N+1、重依赖 → 本 PR 或后续
5. **代码质量** — 死代码、命名、规范 → 可后续处理

---

## 注意事项

- 读完全部 diff 再评论，不要看到一半就标记问题
- 只标记真实问题，跳过没问题的部分
- 每个问题一行描述 + 一行修复建议，不写废话
- diff 中已经处理了的问题不再标记
- 修复建议要具体到代码级别，不说"建议优化"
