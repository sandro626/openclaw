# MySQL Readonly

Read-only MySQL plugin and skill for OpenClaw.

It is designed for production-safe querying with a least-privileged MySQL user.

## What it provides

Tool:

- `mysql_readonly`

Skill:

- `mysql-readonly`

## Config

```json
{
  "plugins": {
    "entries": {
      "mysql-readonly": {
        "enabled": true,
        "config": {
          "host": "127.0.0.1",
          "port": 3306,
          "user": "openclaw_ro",
          "password": "${MYSQL_READONLY_PASSWORD}",
          "database": "app_db",
          "allowedTables": ["orders", "users"],
          "connectTimeoutMs": 10000,
          "queryTimeoutMs": 15000,
          "maxRows": 200,
          "ssl": false
        }
      }
    }
  }
}
```

## Guardrails

- only `SELECT`, `SHOW`, `DESCRIBE`, `DESC`, `EXPLAIN`, and `WITH` queries are allowed
- SQL comments are rejected
- multiple statements are rejected
- obvious write and DDL keywords are rejected
- if `allowedTables` is configured, only those tables can be listed or queried
- result rows are capped to `maxRows`

## Actions

- `list_tables`
- `describe_table`
- `query`

Each action also accepts an optional `database` field. If omitted, the plugin
uses the configured default database.
Users may provide a table name in chat, and the agent can use that name directly
with `describe_table` or a scoped `query`.

If `allowedTables` is configured, `list_tables` only returns whitelisted tables,
`describe_table` requires the table to be whitelisted, and `query` must reference
whitelisted tables with explicit `FROM` or `JOIN` clauses.

## Example

```json
{
  "database": "znxf_sclist_com",
  "action": "query",
  "sql": "SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 20"
}
```
