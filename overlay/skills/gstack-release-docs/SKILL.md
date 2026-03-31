---
name: gstack-release-docs
description: |
  发布后文档同步：release notes 生成、changelog 更新、文档同步检查、发布公告。
metadata:
  openclaw: {}
---

# gstack-release-docs

发布后文档同步技能。从 git 历史和 PR 列表自动生成 release notes、更新 changelog、检查文档一致性、生成多渠道发布公告。

**承载 agent**: pc-ceo_assistant, ops, dev
**触发场景**: "发版文档"、"release notes"、"更新日志"、"发布公告"、"changelog"

---

## 1. Release Notes 生成

### 数据源

```bash
# 版本间变更
git log --oneline v<PREV>..v<CURR>
# PR 列表（需 GitHub CLI）
gh pr list --state merged --search "merged:>=<DATE>" --json title,body,labels,author
```

### 分类规则

| 分类              | 匹配关键词 / 标签                              |
| ----------------- | ---------------------------------------------- |
| 新功能 (Added)    | `feat:`, `feature`, label `enhancement`        |
| 改进 (Changed)    | `refactor:`, `perf:`, `improve:`               |
| 修复 (Fixed)      | `fix:`, `bug`, label `bug`                     |
| 破坏性 (Breaking) | `BREAKING CHANGE`, `!:` 后缀, label `breaking` |

### 面向用户的语言

- 不要写"修复了消息发送偶发崩溃的 bug"，应写"消息发送现在更加稳定"
- 不要写"重构了配置加载模块"，应写"配置加载速度提升，启动更快"

### 中英双语模板

中文: `新功能 / 改进 / 修复 / 破坏性变更 / 升级指南`
English: `Added / Changed / Fixed / Breaking Changes / Upgrade Guide`

每个分类下列出条目，破坏性变更前加 ⚠️ 标记。

---

## 2. Changelog 更新

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/) 格式，版本号遵循语义化版本。

### Conventional Commits 提取

```bash
git log v<PREV>..v<CURR> --pretty=format:"%s" | \
  grep -oP '^\w+(\(.*?\))?!?:' | sort | uniq -c | sort -rn
```

### 版本号对齐验证

```bash
jq -r '.version' package.json          # package.json
git tag --sort=-v:refname | head -5     # git tag
head -5 CHANGELOG.md | grep -oP '\[\K[0-9.]+'  # CHANGELOG
```

三个来源必须完全一致，不一致时暂停并报告。

---

## 3. 文档同步检查

### 检查清单

| 检查项                         | 方法                            |
| ------------------------------ | ------------------------------- |
| API 文档与代码同步             | `pnpm plugin-sdk:api:check`     |
| 配置文档与 schema 同步         | `pnpm config:docs:check`        |
| README 版本号/安装命令是否最新 | 人工核对                        |
| CLI help 与实际命令一致        | `pnpm openclaw --help` 对比文档 |
| 迁移指南（有破坏性变更时）     | 确认 docs/ 下有对应指南         |
| i18n 文档重新生成              | `pnpm docs:check-i18n-glossary` |

### 破坏性变更迁移指南

包含：概述、变更前/后配置对比、迁移步骤。输出到 `docs/migration/<VERSION>.md`。

---

## 4. 发布公告

### 内部公告（企微 / 飞书）

包含：发布时间、版本号、新功能、改进、修复、注意事项、完整变更链接、升级指南链接。

### 外部公告（GitHub Release）

包含：What's Changed（New Features / Improvements / Bug Fixes / Breaking Changes）、Upgrade Guide（`npm i -g openclaw@<VERSION>`）、Full Changelog 链接。

### 升级指南模板

```markdown
## 升级到 <VERSION>

标准升级: sudo npm i -g openclaw@<VERSION>
本地构建升级: 参考 dev-openclaw 技能

### 配置变更

- 新增/废弃/移除的配置项说明

### 回滚

sudo npm i -g openclaw@<PREV>
```

---

## 5. 输出格式

### Release Notes

文件命名 `RELEASE-NOTES-<VERSION>.md`，中英双语，按第 1 节模板生成。

### Changelog 条目

追加到 `CHANGELOG.md` 对应版本段落**末尾**，不插入到段落开头。

### 文档同步检查清单

```markdown
| 检查项       | 状态              | 备注 |
| ------------ | ----------------- | ---- |
| API 文档同步 | pass / fail       | ...  |
| 配置文档同步 | pass / fail       | ...  |
| README 更新  | pass / fail       | ...  |
| 迁移指南     | pass / fail / N/A | ...  |
| i18n 生成    | pass / fail / N/A | ...  |
```

---

## 执行流程

1. 确认版本号（询问或从 package.json 读取）
2. 提取 git log / PR 列表，按分类规则整理
3. 生成中英双语 release notes
4. 更新 CHANGELOG.md（追加到对应版本段落末尾）
5. 执行文档同步检查清单
6. 生成内部公告和外部公告
7. 如有破坏性变更，生成迁移指南
8. 输出所有文件供人工审核

---

## 注意事项

- 版本号在 package.json / git tag / CHANGELOG 中不一致时，暂停并报告
- 禁止在 release notes 中提及内部 issue 编号或内部系统名称
- 禁止在公告中包含敏感信息（服务器地址、密钥、内部 IP）
- changelog 条目追加到段落末尾，不插入到段落开头
- 公告发送前必须经过人工审核
