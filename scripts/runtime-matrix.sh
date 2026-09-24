#!/usr/bin/env bash
set -euo pipefail

# Run on the target architecture, never count a cross-build as runtime evidence.
node -e 'const assert = require("node:assert/strict"); const {platformSuffix} = require("./scripts/install-overlay-addon"); assert.equal(platformSuffix(), process.env.EXPECTED_TARGET)'
npm ci --ignore-scripts
npm run check:types
npm run test:unit
npm run build
node test.js
node scripts/test-native-adapter.js
npm pack --ignore-scripts
node -e '
  const fs = require("node:fs");
  const info = require("./index").getRuntimeInfo();
  fs.writeFileSync("runtime-evidence.json", JSON.stringify({
    target: process.env.EXPECTED_TARGET, node: process.version,
    platform: process.platform, arch: process.arch, info,
    scope: "optimized native load, identity, offline persistence/lifecycle, errors and adapter tests; not network or mobile qualification"
  }, null, 2) + "\n");
'
