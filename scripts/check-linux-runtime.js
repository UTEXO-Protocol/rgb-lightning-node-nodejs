'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

function validateGlibcVersions (output, target) {
  assert.ok(['linux-arm64-gnu', 'linux-x64-gnu', 'linux-x64-musl'].includes(target), 'Unsupported Linux target')
  const versions = [...new Set([...output.matchAll(/\bGLIBC_([0-9]+\.[0-9]+(?:\.[0-9]+)?)/g)].map(match => match[1]))]
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const floor = versions.at(-1) || null
  if (target.endsWith('-musl')) {
    assert.equal(floor, null, 'musl artifact references glibc')
  } else {
    assert.ok(floor, 'GNU artifact has no glibc version requirements')
    assert.ok(floor.localeCompare('2.35', 'en', { numeric: true }) <= 0,
      `Artifact requires glibc ${floor}; the supported Ubuntu 22.04 baseline provides 2.35`)
  }
  return floor
}

function checkLinuxRuntime (target, root = path.resolve(__dirname, '..')) {
  assert.ok(['linux-arm64-gnu', 'linux-x64-gnu', 'linux-x64-musl'].includes(target), 'Unsupported Linux target')
  const file = path.join(root, `index-${target}.node`)
  const versions = execFileSync('readelf', ['--version-info', file], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  return { target, glibcFloor: validateGlibcVersions(versions, target) }
}

if (require.main === module) {
  const result = checkLinuxRuntime(process.argv[2])
  fs.writeFileSync('linux-runtime-compatibility.json', JSON.stringify(result, null, 2) + '\n')
  console.log(`Verified Linux libc compatibility: ${JSON.stringify(result)}`)
}

module.exports = { checkLinuxRuntime, validateGlibcVersions }
