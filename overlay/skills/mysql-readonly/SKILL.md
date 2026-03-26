---
name: mysql-readonly
description: 使用只读 MySQL 用户查询业务数据库。适合查询表结构、字段定义和只读 SQL 数据，要求 OpenClaw 已启用 mysql-readonly 插件并配置只读数据库账号。
---

# MySQL Readonly Skill

Use this skill when the user wants to inspect MySQL data without changing it.

This skill depends on the `mysql-readonly` plugin being enabled and configured
with a least-privileged read-only MySQL account.
If the plugin config defines `allowedTables`, stay within that table whitelist.

## Workflow

1. Use `mysql_readonly` with `list_tables` to discover table names.
2. Use `mysql_readonly` with `describe_table` before writing analytical SQL.
3. If the user names a specific database, pass it as `database`.
4. If the user names a specific table in chat, use that table directly, but only if it is in the configured whitelist.
5. Use `mysql_readonly` with `query` for read-only SQL only.
6. Keep queries scoped and prefer explicit `LIMIT`.

## Actions

- `list_tables`
- `describe_table`
- `query`

## Guardrails

- Only read-only SQL is allowed.
- If a table whitelist is configured, query only those tables.
- Do not attempt writes, DDL, or multi-statement SQL.
- Prefer `SELECT ... LIMIT n` to keep responses compact.

## Examples

List tables:

```json
{ "action": "list_tables", "database": "znxf_sclist_com" }
```

Describe a table:

```json
{ "action": "describe_table", "database": "znxf_sclist_com", "table": "orders" }
```

Run a query:

```json
{
  "database": "znxf_sclist_com",
  "action": "query",
  "sql": "SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 20"
}
```
