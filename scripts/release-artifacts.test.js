'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { TARGETS, identity, readConfig } = require('./install-overlay-addon')
const { sha256 } = require('./release-contract')
const { verifyReleaseArtifacts } = require('./verify-release-artifacts')

test('publication requires all five matching release artifacts and rejects corruption', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rln-publication-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const expected = identity(readConfig())
  assert.throws(() => verifyReleaseArtifacts(root), /ENOENT/)
  for (const [suffix, target] of Object.entries(TARGETS)) {
    const artifact = path.join(root, `index-${suffix}.node`)
    fs.writeFileSync(artifact, `fixture-${suffix}`)
    fs.writeFileSync(path.join(root, `index-${suffix}.provenance.json`), JSON.stringify({
      ...expected, target, profile: 'release', addonSha256: sha256(artifact)
    }))
  }
  assert.doesNotThrow(() => verifyReleaseArtifacts(root))
  fs.appendFileSync(path.join(root, 'index-linux-x64-musl.node'), 'modified')
  assert.throws(() => verifyReleaseArtifacts(root), /linux-x64-musl/)
})
