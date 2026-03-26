---
name: zentao
description: |
  Use Zentao tools to inspect and manage products, projects, executions, stories, tasks, testcases, and bugs.
  Activate when the user mentions Zentao, 禅道, project work items, bug tracking, requirements, or sprint/execution lookups.
---

# Zentao Skill

This extension ships the `zentao` skill, but the canonical skill definition now
lives in the shared top-level skills directory so every robot can use the same
instructions.

Use the shared version here:

- [`skills/zentao/SKILL.md`](/home/zhongle/dev/openclaw-main/skills/zentao/SKILL.md)

This extension-local file is intentionally kept as a thin wrapper to avoid
drift between:

- the plugin-bundled skill
- the global reusable skill

If you update the Zentao workflow, examples, or protocol notes, update the
shared skill first and keep this file minimal.
