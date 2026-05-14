'use strict'

// Platform detection — picks the napi prebuild that matches the host
// (`index-<platform>-<arch>.node`). Mirrors the pattern @napi-rs/cli
// generates so we can swap to its template later without breaking the
// JS surface. Postinstall (scripts/download-libs.sh) fetches the
// matching `.node` from the GitHub Release for this package version.

const os = require('os')
const path = require('path')
const fs = require('fs')

const platform = os.platform()
const arch = os.arch()

// Map Node's os.platform/arch to the (target_triple, libc) bucket the
// napi addon was built against. Keep names in lockstep with the GH
// Release asset names (see scripts/download-libs.sh).
function resolvePlatformSuffix () {
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64'
  if (platform === 'linux' && arch === 'x64') {
    // Detect glibc vs musl. Alpine ships /etc/os-release with ID=alpine
    // and no glibc; the simpler heuristic is to look for /etc/alpine-release.
    if (fs.existsSync('/etc/alpine-release')) return 'linux-x64-musl'
    return 'linux-x64-gnu'
  }
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64-gnu'
  return null
}

const suffix = resolvePlatformSuffix()
if (!suffix) {
  throw new Error(
    `[@utexo/rgb-lightning-node-nodejs] Unsupported platform: ${platform}-${arch}. ` +
    'Supported: darwin-arm64, darwin-x64, linux-x64-gnu, linux-x64-musl, linux-arm64-gnu.'
  )
}

const addonPath = path.join(__dirname, `index-${suffix}.node`)
if (!fs.existsSync(addonPath)) {
  throw new Error(
    `[@utexo/rgb-lightning-node-nodejs] Native addon not found at ${addonPath}. ` +
    'If the postinstall step was skipped (npm install --ignore-scripts), ' +
    'run `bash scripts/download-libs.sh` manually or rebuild from source via `npm run build`.'
  )
}

module.exports = require(addonPath)
