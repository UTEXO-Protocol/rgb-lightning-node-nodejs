#!/bin/bash
set -euo pipefail

# Fetches the napi addon prebuild that matches the host platform from
# the GitHub Release for this package version. Runs via npm postinstall.
# Mirrors @utexo/rgb-lightning-node-bare/scripts/download-libs.sh.

REPO_DEFAULT="UTEXO-Protocol/rgb-lightning-node-nodejs"
REPO="${RLN_NODE_RELEASE_REPO:-$REPO_DEFAULT}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION="v$(node -p 'require("./package.json").version')"

# Detect (platform, arch, libc) — match the suffixes in index.js.
NODE_PLATFORM=$(node -p 'process.platform')
NODE_ARCH=$(node -p 'process.arch')

case "$NODE_PLATFORM-$NODE_ARCH" in
  darwin-arm64)  SUFFIX="darwin-arm64" ;;
  darwin-x64)    SUFFIX="darwin-x64" ;;
  linux-x64)
    if [ -f /etc/alpine-release ]; then SUFFIX="linux-x64-musl"; else SUFFIX="linux-x64-gnu"; fi
    ;;
  linux-arm64)   SUFFIX="linux-arm64-gnu" ;;
  *)
    echo "[@utexo/rgb-lightning-node-nodejs] Unsupported host platform: $NODE_PLATFORM-$NODE_ARCH"
    echo "  This package supports: darwin-arm64, darwin-x64, linux-x64-(gnu|musl), linux-arm64-gnu."
    exit 1
    ;;
esac

ASSET="index-$SUFFIX.node"
LOCAL_PATH="$PKG_DIR/$ASSET"

if [ -f "$LOCAL_PATH" ]; then
  echo "[@utexo/rgb-lightning-node-nodejs] $ASSET already present, skipping download."
  exit 0
fi

cd "$PKG_DIR"
echo "[@utexo/rgb-lightning-node-nodejs] Downloading $ASSET from $REPO@$VERSION..."

if command -v gh &>/dev/null; then
  gh release download "$VERSION" \
    --repo "$REPO" \
    --pattern "$ASSET" \
    --output "$LOCAL_PATH" \
    --clobber
else
  URL="https://github.com/$REPO/releases/download/$VERSION/$ASSET"
  echo "  ↓ $URL"
  curl -fSL "$URL" -o "$LOCAL_PATH"
fi

if [ -f "$LOCAL_PATH" ]; then
  SIZE=$(ls -lh "$LOCAL_PATH" | awk '{print $5}')
  echo "[@utexo/rgb-lightning-node-nodejs] ✓ $ASSET ($SIZE)"
else
  echo "[@utexo/rgb-lightning-node-nodejs] ✗ Failed to download $ASSET"
  exit 1
fi
