---
name: researchclaw
description: 使用已安装在网关主机上的 ResearchClaw 研究流水线，对研究主题执行文献综述、实验设计、结果分析和论文草稿生成。
---

# researchclaw

Use this skill when the user asks to research a topic, draft a paper, or run the ResearchClaw autonomous research pipeline.

## Installed location

- Project root: `/home/ubuntu/projects/openclaw/external/AutoResearchClaw-main`
- Config file: `/home/ubuntu/projects/openclaw/external/AutoResearchClaw-main/config.yaml`
- CLI wrapper on PATH: `researchclaw`

## Rules

1. Run all `researchclaw` commands from `/home/ubuntu/projects/openclaw/external/AutoResearchClaw-main`.
2. Prefer the CLI over ad hoc Python unless a Python API call is clearly better.
3. Use `config.yaml` unless the user explicitly asks for another config.
4. Assume `MINIMAX_API_KEY` is provided by the gateway environment.
5. Before a full run, validate config first.

## Recommended flow

1. `cd /home/ubuntu/projects/openclaw/external/AutoResearchClaw-main`
2. `researchclaw validate --config config.yaml`
3. `researchclaw run --topic "<topic>" --config config.yaml --auto-approve`
4. Inspect `artifacts/` output and summarize stage results

## Useful commands

```bash
cd /home/ubuntu/projects/openclaw/external/AutoResearchClaw-main
researchclaw --help
researchclaw validate --config config.yaml
researchclaw run --topic "Your research topic" --config config.yaml --auto-approve
```

## Outputs

Research outputs are written under:

- `/home/ubuntu/projects/openclaw/external/AutoResearchClaw-main/artifacts/`

Summaries should mention:

- run id
- completed stages
- failed stages
- artifact paths
- final paper/report outputs
