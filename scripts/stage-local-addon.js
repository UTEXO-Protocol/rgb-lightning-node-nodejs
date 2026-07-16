'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const generated = fs.readdirSync(root)
  .filter((name) => /^index\..+\.node$/.test(name))
  .map((name) => ({
    name,
    mtime: fs.statSync(path.join(root, name)).mtimeMs
  }))
  .sort((a, b) => b.mtime - a.mtime)

if (generated.length === 0) {
  throw new Error('napi-rs did not produce an index.<platform>.node addon')
}

const source = generated[0].name
const suffix = source.slice('index.'.length, -'.node'.length)
const destination = `index-${suffix}.node`

fs.copyFileSync(path.join(root, source), path.join(root, destination))
process.stdout.write(`Staged ${destination}\n`)
