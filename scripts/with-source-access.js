'use strict'

const { spawnSync } = require('node:child_process')
const path = require('node:path')

if (!process.env.ORG_READ_TOKEN) {
  throw new Error('Configure ORG_READ_TOKEN with read-only access to the three pinned BFA source repositories; public package consumers must use qualified prebuilds.')
}
const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('A build command is required')
const quote = text => "'" + text.replaceAll("'", "'\\''") + "'"
const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '3',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'credential.helper',
    GIT_CONFIG_VALUE_1: `!${quote(process.execPath)} ${quote(path.join(__dirname, 'source-credential.js'))}`,
    GIT_CONFIG_KEY_2: 'credential.useHttpPath',
    GIT_CONFIG_VALUE_2: 'true'
  }
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
