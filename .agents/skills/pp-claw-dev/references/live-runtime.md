# Live Runtime

Current server conventions for this repo:

- SSH alias: `tencent-101`
- Active code tree: `/home/ubuntu/projects/openclaw`
- Runtime root: `/root/.openclaw`
- Service: `openclaw-gateway.service`

Deploy rules:

1. Build locally first.
2. Back up server code and runtime config before editing live state.
3. Sync the local built result into the existing code tree.
4. If build output changed, sync the whole `dist/` tree.
5. Update live `openclaw.json` or systemd env only after backups exist.
6. `systemctl daemon-reload && systemctl restart openclaw-gateway.service`
7. Run smoke checks immediately.

Runtime rules:

- Live sessions, memory, and workspace state stay under `/root/.openclaw`.
- Do not create a parallel runtime root.
- Do not treat server-local state as repo source unless you are explicitly migrating static skill content back into `overlay/skills/*`.

MiniMax live rule:

- Use Anthropic-compatible requests.
- `CN` key -> `https://api.minimaxi.com/anthropic`
- `Global` key -> `https://api.minimax.io/anthropic`
- A model-not-found or auth failure often means the endpoint and key region do not match.

Useful live checks:

- `openclaw health`
- `openclaw models list`
- `openclaw channels status --probe`
- `openclaw plugins list`
- `systemctl status openclaw-gateway.service --no-pager`
- `journalctl -u openclaw-gateway.service -n 120 --no-pager`

Smoke pattern:

1. `main`
2. one `pc-*` agent
3. one `yz-app-*` agent

If the task changes providers or plugins, confirm both:

- live config is rendered the way local `runtime-templates/` expects
- server `dist/` matches the local built output
