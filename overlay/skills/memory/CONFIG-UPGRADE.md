# Memory: True Background Agent Setup

Canonical skill name: `memory`
Legacy-compatible runtime agent id: `hippocampus`

## Current State (v1)

The memory system runs as part of the main session:

- Triggered 4x daily via cron (10am, 2pm, 6pm, 10pm)
- I process my own recent memories when triggered
- Works, but I'm encoding my own memories — not ideal separation

## Ideal State (v2)

A separate memory background agent that:

- Runs continuously or very frequently
- Monitors main session without being part of it
- Encodes memories independently
- True separation of concerns

## To Enable v2

Add to OpenClaw gateway config (`${OPENCLAW_HOME:-$HOME/.openclaw}/openclaw.json` or via `gateway config.patch`):

```yaml
agents:
  hippocampus:
    systemPrompt: |
      You are the agent's hippocampus — her background memory encoding system.

      Your job:
      1. Monitor the main session's conversation history
      2. Identify memory-worthy content
      3. Update memory/index.json with proper importance scores
      4. Reinforce existing memories when topics recur
      5. Apply decay to old memories

      Read: ${MEMORY_SKILL_DIR:-/path/to/overlay/skills/memory}/agents/hippocampus-agent.md

      You run silently. Don't output unless there's an error.
      After processing, just update the files.
    model: anthropic/claude-sonnet-4 # lighter model for background work
    sessionDefaults:
      kind: isolated
```

Then update cron to spawn the legacy-compatible `hippocampus` agent:

```yaml
schedule:
  kind: cron
  expr: "*/15 * * * *" # every 15 minutes
payload:
  kind: agentTurn
  message: "Process recent memories from main session"
sessionTarget: isolated
agentId: hippocampus
```

## For Now

v1 works. The cron job triggers main the agent to process her own memories.
It's not true background processing, but it achieves:

- ✅ Regular memory encoding
- ✅ Importance scoring
- ✅ Reinforcement on repetition
- ✅ Decay over time

When ready to upgrade, the user can add the agent config.
