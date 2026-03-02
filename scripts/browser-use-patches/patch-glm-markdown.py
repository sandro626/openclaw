#!/usr/bin/env python3
"""
Patch browser-use for GLM compatibility.

GLM models sometimes return JSON wrapped in markdown code blocks:
```json
{"key": "value"}
```

This patch cleans the markdown before JSON parsing.

Target file: browser_use/llm/openai/chat.py
Location: Around line 284, inside the _structured_output method
"""

import sys

def get_patch_content():
    """Return the old and new code patterns."""
    # The original line (with 3 tabs indentation)
    old_line = "\t\t\tparsed = output_format.model_validate_json(choice.message.content)"

    # The replacement code (with proper indentation)
    new_code = """\t\t\t# Clean markdown for GLM compatibility
\t\t\tjson_content = choice.message.content or ""
\t\t\timport re
\t\t\tjson_content = re.sub(r"^```(?:json)?\\s*", "", json_content)
\t\t\tjson_content = re.sub(r"\\s*```$", "", json_content)
\t\t\tjson_content = json_content.strip()
\t\t\tparsed = output_format.model_validate_json(json_content)"""

    return old_line, new_code


def apply_patch(file_path: str) -> bool:
    """Apply the patch to the specified file."""
    try:
        with open(file_path, "r") as f:
            content = f.read()

        old_line, new_code = get_patch_content()

        if old_line in content:
            content = content.replace(old_line, new_code)
            with open(file_path, "w") as f:
                f.write(content)
            print("GLM markdown patch applied successfully")
            return True
        elif "Clean markdown for GLM" in content:
            print("GLM markdown patch already applied")
            return True
        else:
            print("Could not find target pattern for GLM patch")
            # Try to find alternative patterns
            for i, line in enumerate(content.split('\n'), 1):
                if 'model_validate_json' in line and 'choice.message.content' in line:
                    print(f"Found alternative at line {i}: {repr(line[:80])}")
            return False

    except Exception as e:
        print(f"Error applying patch: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python patch-glm-markdown.py <path-to-chat.py>")
        print("Example: python patch-glm-markdown.py /opt/browser-use-venv/lib/python3.12/site-packages/browser_use/llm/openai/chat.py")
        sys.exit(1)

    success = apply_patch(sys.argv[1])
    sys.exit(0 if success else 1)
