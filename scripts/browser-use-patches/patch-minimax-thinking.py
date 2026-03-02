#!/usr/bin/env python3
"""
Patch browser-use for MiniMax compatibility.

MiniMax models output thinking tags that break JSON parsing:
<thinking>...</thinking>
<minimax:thinking>...</minimax:thinking>
<minimax:tool_call>...</minimax:tool_call>

This patch cleans these tags before JSON parsing.

Target file: browser_use/llm/openai/chat.py
Location: After the markdown cleanup, before model_validate_json
"""

import re
import sys


def get_thinking_cleanup_code():
    """Return the thinking tag cleanup code."""
    # Code to insert after json_content.strip() but before model_validate_json
    # Uses 3 tabs indentation to match surrounding code
    return """\t\t\t# Clean MiniMax thinking tags
\t\t\tjson_content = re.sub(r"<thinking>.*?</thinking>", "", json_content, flags=re.DOTALL)
\t\t\tjson_content = re.sub(r"<minimax:thinking>.*?</minimax:thinking>", "", json_content, flags=re.DOTALL)
\t\t\tjson_content = re.sub(r"<minimax:tool_call>.*?</minimax:tool_call>", "", json_content, flags=re.DOTALL)
\t\t\tjson_content = re.sub(r"<thinkin>|</thinkin>", "", json_content)
\t\t\tjson_content = json_content.strip()
"""


def apply_patch(file_path: str) -> bool:
    """Apply the patch to the specified file."""
    try:
        with open(file_path, "r") as f:
            content = f.read()

        # Check if already patched
        if "Clean MiniMax thinking tags" in content:
            print("MiniMax thinking patch already applied")
            return True

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
            print("MiniMax thinking patch applied successfully")
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

        if "Clean MiniMax thinking tags" not in content:
            print("MiniMax thinking patch not found")
            return True

        # Remove the thinking cleanup section
        pattern = r'\n\t\t\t# Clean MiniMax thinking tags\n\t\t\tjson_content = re\.sub\(r"<thinking>.*?</thinking>".*?\n\t\t\tjson_content = re\.sub\(r"<minimax:thinking>.*?</minimax:thinking>".*?\n\t\t\tjson_content = re\.sub\(r"<minimax:tool_call>.*?</minimax:tool_call>".*?\n\t\t\tjson_content = re\.sub\(r"<thinkin>\|</thinkin>".*?\n\t\t\tjson_content = json_content\.strip\(\)\n'

        content = re.sub(pattern, '', content, flags=re.DOTALL)

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
