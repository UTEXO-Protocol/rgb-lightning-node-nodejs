'use strict'

// Candidate qualification only. Publication retains its independent all-target gate.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { readConfig, platformSuffix, verifyAddonAdmission } = require('./install-overlay-addon')
const root = path.resolve(__dirname, '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rln-packed-consumer-'))
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json'], { cwd: root, encoding: 'utf8' }))
  assert.equal(packed.length, 1)
  const tarball = path.join(root, packed[0].filename)
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', temporary, tarball], {
    stdio: 'inherit'
  })
  const installed = path.join(temporary, 'node_modules', '@utexo', 'rgb-lightning-node-nodejs')
  const suffix = platformSuffix()
  const config = readConfig()
  verifyAddonAdmission(installed, config, suffix)
  // Run the same actual native lifecycle/VSS canary through the installed archive,
  // resolving every package import inside the clean consumer, never the checkout.
  let canary = fs.readFileSync(path.join(root, 'test.js'), 'utf8')
  for (const relative of ['./index', './scripts/install-overlay-addon', './scripts/test-vss-safety-host']) {
    const original = `require('${relative}')`
    assert.ok(canary.includes(original), `Missing reviewed canary import: ${relative}`)
    canary = canary.replaceAll(original, `require(${JSON.stringify(path.join(installed, relative))})`)
  }
  const entry = path.join(temporary, 'consumer.cjs')
  fs.writeFileSync(entry, canary)
  execFileSync(process.execPath, [entry], { cwd: temporary, stdio: 'inherit' })
  const info = JSON.parse(execFileSync(process.execPath, ['-e',
    `process.stdout.write(JSON.stringify(require(${JSON.stringify(installed)}).getRuntimeInfo()))`], { encoding: 'utf8' }))
  assert.equal(info.rln_commit, config.commit)
  assert.equal(info.rgb_lib_commit, config.rgbLibCommit)
  assert.equal(info.lightning_commit, config.lightningCommit)
  assert.equal(info.adapter_sha256, config.patchSha256)
  const original = path.join(root, `index-${suffix}.node`)
  const copied = path.join(installed, `index-${suffix}.node`)
  assert.equal(digest(copied), digest(original))
  fs.writeFileSync(path.join(root, 'packed-consumer-evidence.json'), JSON.stringify({
    // Docker's /candidate is owned by the runner, not the container's root UID.
    // Trust only this exact source root for this read; do not persist global trust.
    sourceCommit: execFileSync('git', ['-c', `safe.directory=${root}`, 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    target: suffix, tarball: path.basename(tarball), tarballSha256: digest(tarball),
    nativeSha256: digest(copied), info,
    scope: 'Actual clean npm archive install/native load, exact identities, VSS admission, signer persistence/reopen and lifecycle; no funded network or mobile claim'
  }, null, 2) + '\n')
  console.log('Clean packed native consumer passed: ' + suffix)
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
