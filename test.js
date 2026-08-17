'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const { NativeExternalSigner, SdkNode } = require('./index')

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rln-node-canary-'))
const signer = NativeExternalSigner.create('01'.repeat(32), 'regtest')
const node = SdkNode.create({
  storage_dir_path: dataDir,
  daemon_listening_port: 0,
  ldk_peer_listening_port: 0,
  network: 'regtest',
  max_media_upload_size_mb: 5,
  enable_virtual_channels_v0: false,
  reuse_addresses: true
})

try {
  for (const method of [
    'rotateAddress',
    'assetLinkCreate',
    'listTransactions',
    'listTransactionsByTxid',
    'listTransfers',
    'listTransfersByTxid',
    'verifyMessage'
  ]) {
    if (typeof node[method] !== 'function') throw new Error(`SdkNode.${method} is missing`)
  }

  node.initWithNativeExternalSigner(signer)
  const wrongSigner = NativeExternalSigner.create('02'.repeat(32), 'regtest')
  try {
    let mismatch
    try {
      node.unlockWithNativeExternalSigner(wrongSigner, {})
    } catch (error) {
      mismatch = error
    }
    if (!String(mismatch?.message ?? mismatch).includes('Rln(ExternalSignerMismatch)')) {
      throw new Error(`unexpected signer mismatch error: ${mismatch}`)
    }
  } finally {
    wrongSigner.destroy()
  }

  const result = node.verifyMessage(
    'is this compatible?',
    'rbgfioj114mh48d8egqx8o9qxqw4fmhe8jbeeabdioxnjk8z3t1ma1hu1fiswpakgucwwzwo6ofycffbsqusqdimugbh41n1g698hr9t'
  )
  if (!result || typeof result.valid !== 'boolean') {
    throw new Error('verifyMessage did not return { valid: boolean }')
  }

  const bootstrap = signer.bootstrap()
  if (typeof bootstrap.node_id !== 'string') throw new Error('signer bootstrap is missing node_id')
} finally {
  node.shutdown()
  signer.destroy()
  fs.rmSync(dataDir, { recursive: true, force: true })
}

console.log('Node binding canary passed')
