'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { TARGETS, identity, readConfig } = require('./install-overlay-addon')
const { sha256 } = require('./release-contract')

function verifyReleaseArtifacts (root = path.resolve(__dirname, '..')) {
  const config = readConfig()
  for (const [suffix, target] of Object.entries(TARGETS)) {
    const artifact = path.join(root, `index-${suffix}.node`)
    const manifest = JSON.parse(fs.readFileSync(path.join(root, `index-${suffix}.provenance.json`), 'utf8'))
    const expected = { ...identity(config), target, profile: 'release' }
    if (fs.statSync(artifact).size === 0 ||
        !Object.entries(expected).every(([key, value]) => manifest[key] === value) ||
        manifest.addonSha256 !== sha256(artifact)) {
      throw new Error(`Missing or stale release artifact: ${suffix}`)
    }
  }
}

if (require.main === module) {
  verifyReleaseArtifacts()
  console.log('Verified release artifacts for all five Node targets; publication is a separate action.')
}
module.exports = { verifyReleaseArtifacts }
