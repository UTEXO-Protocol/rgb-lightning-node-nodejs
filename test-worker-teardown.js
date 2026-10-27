'use strict'
// rgb-lib-bfa requires fresh addresses; address reuse is explicitly unsupported.

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads')
const { NativeExternalSigner, SdkNode } = require('./index')

// Public deterministic offline fixture; this wallet must never be funded.
const entropy = '03'.repeat(32)

if (!isMainThread) {
  const { root, mode } = workerData
  global.signer = NativeExternalSigner.createWithStorage(entropy, 'regtest', path.join(root, 'signer'))
  const bootstrap = global.signer.bootstrap()
  if (mode !== 'signer-only') {
    global.node = SdkNode.create({
      storage_dir_path: path.join(root, 'node'),
      daemon_listening_port: 0,
      ldk_peer_listening_port: 0,
      network: 'regtest',
      max_media_upload_size_mb: 5,
      enable_virtual_channels_v0: false,
      reuse_addresses: false
    })
    global.node.initWithNativeExternalSigner(global.signer)
    global.node.attachNativeExternalSigner(global.signer)
    if (mode === 'early-host-free') {
      global.signer.destroy()
      global.signer = null
    } else if (mode === 'graceful') {
      global.node.shutdown()
      global.signer.shutdown()
      global.signer.destroy()
    }
  }
  // Retain the wrappers and keep the worker alive. The parent must terminate the
  // environment; this must not accidentally become an ordinary GC/drop test.
  setInterval(() => {}, 1000)
  parentPort.postMessage({ bootstrap })
} else {
  async function run () {
    for (const mode of ['signer-only', 'initialized', 'early-host-free', 'graceful']) {
      for (let cycle = 0; cycle < 3; cycle++) {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rln-node-env-teardown-'))
        try {
          const worker = new Worker(__filename, { workerData: { root, mode } })
          let ready
          try {
            ready = await new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Native worker startup timed out')), 30000)
              const finish = callback => value => {
                clearTimeout(timer)
                worker.removeAllListeners('message')
                worker.removeAllListeners('error')
                worker.removeAllListeners('exit')
                callback(value)
              }
              worker.once('message', finish(resolve))
              worker.once('error', finish(reject))
              worker.once('exit', finish(code => reject(new Error(`Worker exited before ready (${code})`))))
            })
          } finally {
            await worker.terminate()
          }
          let reopened
          try {
            // No GC request, sleep, retry or process restart between termination
            // and reopening the same signer store in this parent process.
            reopened = NativeExternalSigner.createWithStorage(entropy, 'regtest', path.join(root, 'signer'))
            assert.deepEqual(reopened.bootstrap(), ready.bootstrap, `${mode} cycle ${cycle}`)
          } finally {
            if (reopened) { reopened.shutdown(); reopened.destroy() }
          }
        } finally {
          fs.rmSync(root, { recursive: true, force: true })
        }
      }
    }
    console.log('12 offline terminated-worker signer reopen cases passed without GC, retries or process restart.')
  }
  run().catch(error => { console.error(error); process.exitCode = 1 })
}
