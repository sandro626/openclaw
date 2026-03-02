# Browser-Use Patches for Chinese LLM Compatibility

These patches fix compatibility issues between browser-use and Chinese LLM providers.

## Patches

### 1. GLM Markdown Patch (`patch-glm-markdown.py`)

**Problem**: GLM models (like GLM-4.7) sometimes return JSON wrapped in markdown code blocks:
```
```json
{"action": "click", "index": 0}
```
```

**Solution**: Strip markdown formatting before JSON parsing.

### 2. MiniMax Thinking Patch (`patch-minimax-thinking.py`)

**Problem**: MiniMax models output thinking tags that break JSON parsing:
```xml
<minimax:thinking>
Let me analyze this webpage...
</minimax:thinking>
{"action": "click", "index": 0}
```

**Solution**: Remove thinking tags before JSON parsing.

## Usage

### Apply All Patches

```bash
# On the server with browser-use installed
./apply-patches.sh

# Or specify custom venv path
BROWSER_USE_VENV=/path/to/venv ./apply-patches.sh
```

### Apply Individual Patches

```bash
# GLM patch only
./apply-patches.sh --glm-only

# MiniMax patch only (requires GLM patch first)
./apply-patches.sh --minimax-only
```

### Remove Patches

```bash
# Remove MiniMax thinking patch
./apply-patches.sh --remove-minimax
```

## Configuration for Different Providers

### GLM-4.7 (Zhipu AI)

```python
from browser_use import Agent
from browser_use.llm.openai.chat import ChatOpenAI

llm = ChatOpenAI(
    model="glm-4.7",
    api_key="your-api-key",
    base_url="https://open.bigmodel.cn/api/paas/v4",
    temperature=0.1,
    add_schema_to_system_prompt=True,
    dont_force_structured_output=True,
)

agent = Agent(
    task="your task",
    llm=llm,
    use_vision=False,  # Required for GLM compatibility
)
```

### MiniMax M2.5

```python
from browser_use import Agent
from browser_use.llm.openai.chat import ChatOpenAI

llm = ChatOpenAI(
    model="MiniMax-M2.5",
    api_key="your-api-key",
    base_url="https://api.minimax.chat/v1",
    temperature=0.1,
    add_schema_to_system_prompt=True,
    dont_force_structured_output=True,
)

agent = Agent(
    task="your task",
    llm=llm,
    use_vision=True,  # MiniMax supports vision
)
```

## Files

| File | Description |
|------|-------------|
| `apply-patches.sh` | Main script to apply/remove patches |
| `patch-glm-markdown.py` | GLM markdown cleanup patch |
| `patch-minimax-thinking.py` | MiniMax thinking tag cleanup patch |
| `README.md` | This file |

## Troubleshooting

### Patch not applied

Check if the target file exists:
```bash
ls /opt/browser-use-venv/lib/python3.12/site-packages/browser_use/llm/openai/chat.py
```

### JSON parsing still fails

1. Check if patches are applied:
   ```bash
   grep -n "Clean markdown\|Clean MiniMax" /opt/browser-use-venv/lib/python3.12/site-packages/browser_use/llm/openai/chat.py
   ```

2. For GLM: Ensure `use_vision=False` is set in Agent config

3. For MiniMax: Check if thinking tags format matches the regex patterns

## Model Selection

### MiniMax M2.5 (Recommended - Faster & Cheaper)

MiniMax M2.5 is the default model for browser-use:
- **Faster**: ~30% faster than GLM-4.7
- **Cheaper**: Lower API costs
- **Stable**: Better JSON output formatting

```bash
# Default uses MiniMax M2.5
browser-use-cli "访问百度获取页面标题"

# Explicitly use MiniMax
browser-use-cli "访问百度" -m minimax
```

### GLM-4.7 (Fallback)

Use GLM-4.7 if MiniMax is unavailable:
```bash
browser-use-cli "访问百度" -m glm
```

## Configuration

### MiniMax API
- **Endpoint**: `https://api.minimaxi.com/v1`
- **Model**: `MiniMax-M2.5`
- **Config location**: `/usr/local/bin/browser-use-cli`

### GLM API
- **Endpoint**: `https://open.bigmodel.cn/api/paas/v4`
- **Model**: `glm-4.7`

## Deployment

When deploying to a new server:

1. Install browser-use in virtual environment
2. Copy this directory to the server
3. Run `./apply-patches.sh`
4. Update `/usr/local/bin/browser-use-cli` with desired model configuration
