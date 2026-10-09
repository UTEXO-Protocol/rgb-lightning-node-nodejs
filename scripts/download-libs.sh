#!/usr/bin/env bash
set -euo pipefail
echo 'This candidate uses a verified source build, not legacy unverified downloads. Run npm run build.' >&2
exit 1
