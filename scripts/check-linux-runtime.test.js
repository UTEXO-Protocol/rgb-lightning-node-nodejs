'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { validateGlibcVersions } = require('./check-linux-runtime')

test('GNU artifacts must remain compatible with the Ubuntu 22.04 baseline', () => {
  for (const target of ['linux-arm64-gnu', 'linux-x64-gnu']) {
    assert.equal(validateGlibcVersions('GLIBC_2.2.5 GLIBC_2.34 GLIBC_2.17 GLIBC_2.34', target), '2.34')
    assert.equal(validateGlibcVersions('GLIBC_2.35', target), '2.35')
    for (const version of ['2.36', '2.38', '2.100', '3.0']) {
      assert.throws(() => validateGlibcVersions(`GLIBC_${version}`, target), /baseline/)
    }
    assert.throws(() => validateGlibcVersions('', target), /no glibc/)
  }
})

test('musl artifacts cannot accidentally link against glibc', () => {
  assert.equal(validateGlibcVersions('No version information found in this file.', 'linux-x64-musl'), null)
  assert.throws(() => validateGlibcVersions('GLIBC_2.2.5', 'linux-x64-musl'), /references glibc/)
  assert.throws(() => validateGlibcVersions('', 'darwin-arm64'), /Unsupported/)
})
