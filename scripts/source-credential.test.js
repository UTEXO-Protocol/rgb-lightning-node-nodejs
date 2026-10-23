'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { credential } = require('./source-credential')

test('source credentials are limited to exact private repositories and never stored', () => {
  const input = 'protocol=https\nhost=github.com\npath=UTEXO-Protocol/rgb-lib-bfa.git\n'
  assert.match(credential('get', input, 'fixture-only'), /password=fixture-only/)
  for (const operation of ['store', 'erase']) assert.equal(credential(operation, input, 'fixture-only'), '')
  assert.equal(credential('get', input, undefined), '')
  for (const modified of [input.replace('https', 'http'), input.replace('github.com', 'github.com.attacker'),
    input.replace('rgb-lib-bfa', 'other-repo'), input.replace('rgb-lib-bfa', 'rgb-consensus-s-bfa'), input.replace('UTEXO-Protocol/', '')]) {
    assert.equal(credential('get', modified, 'fixture-only'), '')
  }
  assert.throws(() => credential('get', input, 'bad\ntoken'), /Invalid/)
})
