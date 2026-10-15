'use strict'

const fs = require('node:fs')

const repositories = new Set([
  'UTEXO-Protocol/rgb-consensus-s-bfa',
  'UTEXO-Protocol/rgb-ops-s-bfa',
  'UTEXO-Protocol/rgb-schemas-s-bfa'
])

function credential (operation, input, token) {
  if (operation !== 'get' || !token) return ''
  const fields = Object.fromEntries(input.split('\n').filter(line => line.includes('=')).map(line => {
    const index = line.indexOf('=')
    return [line.slice(0, index), line.slice(index + 1)]
  }))
  if (fields.protocol !== 'https' || fields.host !== 'github.com' ||
      !repositories.has((fields.path || '').replace(/\.git$/, ''))) return ''
  if (/[\r\n]/.test(token)) throw new Error('Invalid source credential')
  return `username=x-access-token\npassword=${token}\n\n`
}

if (require.main === module) {
  process.stdout.write(credential(process.argv[2], fs.readFileSync(0, 'utf8'), process.env.ORG_READ_TOKEN))
}
module.exports = { credential }
