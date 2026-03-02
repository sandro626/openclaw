#!/bin/bash
# Apply browser-use patches for Chinese LLM compatibility
#
# Usage:
#   ./apply-patches.sh                    # Apply all patches
#   ./apply-patches.sh --glm-only         # Apply only GLM markdown patch
#   ./apply-patches.sh --minimax-only     # Apply only MiniMax thinking patch
#   ./apply-patches.sh --remove-minimax   # Remove MiniMax thinking patch
#
# Environment variables:
#   BROWSER_USE_VENV - Path to browser-use virtual environment (default: /opt/browser-use-venv)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="${BROWSER_USE_VENV:-/opt/browser-use-venv}"
CHAT_PY="$VENV_PATH/lib/python3.12/site-packages/browser_use/llm/openai/chat.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_file() {
    if [ ! -f "$CHAT_PY" ]; then
        log_error "Target file not found: $CHAT_PY"
        log_info "Make sure browser-use is installed in: $VENV_PATH"
        exit 1
    fi
    log_info "Found target file: $CHAT_PY"
}

apply_glm_patch() {
    log_info "Applying GLM markdown patch..."
    python3 "$SCRIPT_DIR/patch-glm-markdown.py" "$CHAT_PY"
}

apply_minimax_patch() {
    log_info "Applying MiniMax thinking patch..."
    python3 "$SCRIPT_DIR/patch-minimax-thinking.py" "$CHAT_PY"
}

remove_minimax_patch() {
    log_info "Removing MiniMax thinking patch..."
    python3 "$SCRIPT_DIR/patch-minimax-thinking.py" "$CHAT_PY" --remove
}

# Main logic
case "${1:-all}" in
    --glm-only)
        check_file
        apply_glm_patch
        ;;
    --minimax-only)
        check_file
        apply_minimax_patch
        ;;
    --remove-minimax)
        check_file
        remove_minimax_patch
        ;;
    all|*)
        check_file
        apply_glm_patch
        apply_minimax_patch
        log_info "All patches applied!"
        ;;
esac
