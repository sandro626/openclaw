#!/usr/bin/env python3
"""
Patch browser-use for MiniMax compatibility.

MiniMax models output thinking content that breaks JSON parsing:
- XML-style tags: <thinking>...</thinking>, <minimax:thinking>...</minimax:thinking>
- Plain text thinking before JSON content

This patch:
1. Removes XML-style thinking tags
2. Extracts JSON from response if there's prefix text (like thinking)

Target file: browser_use/llm/openai/chat.py
Location: After the markdown cleanup, before model_validate_json
"""

import re
import sys


def get_thinking_cleanup_code():
    """Return the thinking tag cleanup and JSON extraction code."""
    # Code uses 4 tabs indentation to match surrounding code
    return '''\t\t\t\t# Clean thinking content (MiniMax, etc.) - extract JSON from response
\t\t\t\t# Remove XML-style thinking tags
\t\t\t\tjson_content = re.sub(r"<thinking>.*?</thinking>", "", json_content, flags=re.DOTALL)
\t\t\t\tjson_content = re.sub(r"<minimax:thinking>.*?</minimax:thinking>", "", json_content, flags=re.DOTALL)
\t\t\t\tjson_content = re.sub(r"<minimax:tool_call>.*?</minimax:tool_call>", "", json_content, flags=re.DOTALL)
\t\t\t\tjson_content = re.sub(r"</?thinkin>", "", json_content)
\t\t\t\t# Extract JSON if content has prefix text (MiniMax thinking without tags)
\t\t\t\tjson_content = json_content.strip()
\t\t\t\tif json_content and not json_content.startswith("{") and not json_content.startswith("["):
\t\t\t\t\t# Find first JSON object or array
\t\t\t\t\tmatch = re.search(r"[\\[\\{]", json_content)
\t\t\t\t\tif match:
\t\t\t\t\t\tjson_content = json_content[match.start():]
\t\t\t\t\t\t# Find matching closing bracket
\t\t\t\t\t\topen_bracket = json_content[0]
\t\t\t\t\t\tclose_bracket = "]" if open_bracket == "[" else "}"
\t\t\t\t\t\tdepth = 0
\t\t\t\t\t\tfor idx, c in enumerate(json_content):
\t\t\t\t\t\t\tif c == open_bracket:
\t\t\t\t\t\t\t\tdepth += 1
\t\t\t\t\t\t\telif c == close_bracket:
\t\t\t\t\t\t\t\tdepth -= 1
\t\t\t\t\t\t\t\tif depth == 0:
\t\t\t\t\t\t\t\t\tjson_content = json_content[:idx+1]
\t\t\t\t\t\t\t\t\tbreak
\t\t\t\t\tjson_content = json_content.strip()
'''


def apply_patch(file_path: str) -> bool:
    """Apply the patch to the specified file."""
    try:
        with open(file_path, "r") as f:
            content = f.read()

        # Check if already patched with new version
        if "Extract JSON if content has prefix text" in content:
            print("MiniMax thinking patch already applied (with JSON extraction)")
            return True

        # Check if old version is applied
        if "Clean MiniMax thinking tags" in content:
            print("Old MiniMax patch found, need to remove first")
            if not remove_patch(file_path):
                return False
            # Re-read after removal
            with open(file_path, "r") as f:
                content = f.read()

        # Find the location to insert (after json_content.strip() in GLM cleanup)
        lines = content.split('\n')
        new_lines = []
        inserted = False

        for i, line in enumerate(lines):
            new_lines.append(line)
            # Insert after the first json_content.strip() in the GLM cleanup section
            if not inserted and 'json_content.strip()' in line and i > 0:
                # Check if this is in the GLM cleanup context
                prev_lines = '\n'.join(lines[max(0, i-5):i+1])
                if 'Clean markdown for GLM' in prev_lines:
                    new_lines.append(get_thinking_cleanup_code().rstrip('\n'))
                    inserted = True

        if inserted:
            content = '\n'.join(new_lines)
            with open(file_path, "w") as f:
                f.write(content)
            print("MiniMax thinking patch applied successfully (with JSON extraction)")
            return True
        else:
            print("Could not find insertion point for MiniMax patch")
            print("Make sure GLM markdown patch is applied first")
            return False

    except Exception as e:
        print(f"Error applying patch: {e}")
        return False


def remove_patch(file_path: str) -> bool:
    """Remove the MiniMax thinking patch."""
    try:
        with open(file_path, "r") as f:
            content = f.read()

        if "Clean MiniMax thinking tags" not in content and "Clean thinking content" not in content:
            print("MiniMax thinking patch not found")
            return True

        # Find and remove the thinking cleanup section (handles both old and new versions)
        lines = content.split('\n')
        new_lines = []
        skip_until_parsed = False

        for i, line in enumerate(lines):
            if "# Clean MiniMax thinking tags" in line or "# Clean thinking content" in line:
                skip_until_parsed = True
                continue
            if skip_until_parsed:
                if "parsed = output_format.model_validate_json" in line:
                    skip_until_parsed = False
                    new_lines.append(line)
                continue
            new_lines.append(line)

        content = '\n'.join(new_lines)
        with open(file_path, "w") as f:
            f.write(content)
        print("MiniMax thinking patch removed")
        return True

    except Exception as e:
        print(f"Error removing patch: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python patch-minimax-thinking.py <path-to-chat.py> [--remove]")
        print("Example: python patch-minimax-thinking.py /opt/browser-use-venv/lib/python3.12/site-packages/browser_use/llm/openai/chat.py")
        sys.exit(1)

    file_path = sys.argv[1]
    remove = "--remove" in sys.argv

    if remove:
        success = remove_patch(file_path)
    else:
        success = apply_patch(file_path)

    sys.exit(0 if success else 1)
