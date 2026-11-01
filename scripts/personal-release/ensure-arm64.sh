#!/usr/bin/env bash
set -euo pipefail

image="${1:?Pass the pinned ARM64 Node image.}"
log=$(mktemp)
trap 'rm -f -- "$log"' EXIT
probe=(docker run --rm --platform linux/arm64 "$image" node -e 'if (process.arch !== "arm64") throw new Error("Expected ARM64"); console.log("ARM64 execution verified.")')
if "${probe[@]}" >"$log" 2>&1; then
  cat "$log"
  exit 0
fi
cat "$log" >&2
if ! grep -q 'exec format error' "$log"; then
  exit 1
fi
docker run --privileged --rm \
  tonistiigi/binfmt@sha256:465d3fdd28d0f2b871ba4b4ec98bd183292e96167f00d9fd40bd249f8632d705 \
  --install arm64
"${probe[@]}"
