'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const contract = require('./release-contract')
const { verifyMachOFile } = require('./macho-linkedit')

const packageRoot = path.resolve(__dirname, '..')
const sourceRoot = path.join(packageRoot, '.native-source')
const TARGETS = Object.freeze({
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64-gnu': 'x86_64-unknown-linux-gnu',
  'linux-x64-musl': 'x86_64-unknown-linux-musl',
  'linux-arm64-gnu': 'aarch64-unknown-linux-gnu'
})
const WRAPPER_FILES = ['index.js', 'index.d.ts', 'json-boundary.js', 'src/lib.rs', 'build.rs', 'Cargo.toml']

function run (command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: packageRoot, stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (status ${result.status})`)
}

function readConfig () {
  const config = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'))).utexoNativeOverlay
  if (!config || config.repository !== 'https://github.com/UTEXO-Protocol/rgb-lightning-node.git') {
    throw new Error('Missing or unapproved native source repository')
  }
  const patchPath = path.resolve(packageRoot, config.patch)
  if (!patchPath.startsWith(path.join(packageRoot, 'patches') + path.sep)) throw new Error('Invalid adapter path')
  const result = Object.freeze({ ...config, patchPath })
  contract.validateAdapter(result)
  return result
}

function platformSuffix () {
  if (process.env.RLN_NODE_TARGET) {
    if (!TARGETS[process.env.RLN_NODE_TARGET]) throw new Error('Unsupported RLN_NODE_TARGET')
    return process.env.RLN_NODE_TARGET
  }
  let suffix = `${process.platform}-${process.arch}`
  if (process.platform === 'linux') {
    const glibc = process.report?.getReport().header.glibcVersionRuntime
    suffix += glibc ? '-gnu' : '-musl'
  }
  if (!TARGETS[suffix]) throw new Error(`Unsupported native target: ${suffix}`)
  return suffix
}

function addonPath () { return path.join(packageRoot, `index-${platformSuffix()}.node`) }
function manifestPath () { return path.join(packageRoot, `index-${platformSuffix()}.provenance.json`) }

function identity (config) {
  return {
    schemaVersion: 2,
    repository: config.repository,
    ref: config.ref,
    commit: config.commit,
    lightningCommit: config.lightningCommit,
    rgbLibRepository: config.rgbLibRepository,
    rgbLibCommit: config.rgbLibCommit,
    patchSha256: config.patchSha256,
    rustToolchain: config.rustToolchain,
    macosDeploymentTarget: '13.0',
    buildRecipeSha256: contract.wrapperSha256(packageRoot, ['scripts/install-overlay-addon.js', 'scripts/macho-linkedit.js']),
    target: TARGETS[platformSuffix()],
    wrapperSha256: contract.wrapperSha256(packageRoot, WRAPPER_FILES),
    lockSha256: contract.sha256(path.join(packageRoot, 'Cargo.lock')),
    profile: process.argv.includes('--debug') ? 'debug' : 'release'
  }
}

function manifestMatches (config, manifest, addonSha256) {
  return !!manifest && Object.entries(identity(config)).every(([key, value]) => manifest[key] === value) &&
    manifest.addonSha256 === addonSha256
}

// Admission is pure validation: never build, fetch or dlopen a native file.
// Development builds remain loadable only with complete matching provenance;
// publication separately requires every artifact to have release profile.
function verifyAddonAdmission (root, config, suffix) {
  if (!TARGETS[suffix]) throw new Error('Unsupported native admission target')
  const artifact = path.join(root, `index-${suffix}.node`)
  const sidecar = path.join(root, `index-${suffix}.provenance.json`)
  const manifest = JSON.parse(fs.readFileSync(sidecar, 'utf8'))
  if (!['release', 'debug'].includes(manifest.profile)) throw new Error('Unapproved native build profile')
  const expected = { ...identity(config), target: TARGETS[suffix], profile: manifest.profile }
  if (!Object.entries(expected).every(([key, value]) => manifest[key] === value) ||
      !fs.statSync(artifact).isFile() || fs.statSync(artifact).size === 0 ||
      manifest.addonSha256 !== contract.sha256(artifact)) {
    throw new Error('Native artifact admission failed: missing, stale or corrupt provenance; rebuild the package')
  }
  if (suffix.startsWith('darwin-')) verifyMachOFile(artifact, suffix)
  return expected
}

function existingAddonMatches (config) {
  try {
    if (platformSuffix().startsWith('darwin-')) verifyMachOFile(addonPath(), platformSuffix())
    return fs.statSync(addonPath()).size > 0 && manifestMatches(config,
      JSON.parse(fs.readFileSync(manifestPath())), contract.sha256(addonPath()))
  } catch { return false }
}

function recordAddonProvenance (config, descriptor) {
  if (!descriptor || JSON.stringify(descriptor) !== JSON.stringify(identity(config))) {
    throw new Error('Wrapper changed while native compilation was in progress; rebuild')
  }
  if (fs.statSync(addonPath()).size === 0) throw new Error('Empty native addon')
  if (platformSuffix().startsWith('darwin-')) verifyMachOFile(addonPath(), platformSuffix())
  fs.writeFileSync(manifestPath(), JSON.stringify({
    ...descriptor, addonSha256: contract.sha256(addonPath())
  }, null, 2) + '\n')
}

function prepareSource (config) {
  if (!fs.existsSync(sourceRoot)) {
    const source = process.env.RLN_NODE_SOURCE_DIR || config.repository
    run('git', ['clone', '--no-hardlinks', '--no-checkout', source, sourceRoot])
    run('git', ['-C', sourceRoot, 'checkout', '--detach', config.commit])
    run('git', ['-C', sourceRoot, 'submodule', 'update', '--init', '--recursive'])
  }
  contract.prepareSource(sourceRoot, config)
}

function buildAddon (config) {
  contract.verifyCargoGraph(path.join(packageRoot, 'Cargo.toml'), sourceRoot)
  const descriptor = identity(config)
  const apple = descriptor.target.includes('apple-darwin')
  const args = [apple ? 'rustc' : 'build', '--locked', '--target', descriptor.target]
  if (descriptor.profile === 'release') args.push('--release')
  // Rust 1.94's post-link objcopy stripping can misalign Mach-O LINKEDIT
  // on macOS 27. Apple ld performs equivalent local/debug symbol stripping
  // while maintaining loader alignment and the final code signature.
  if (apple) args.push('--', '-C', 'strip=none', '-C', 'link-arg=-Wl,-x', '-C', 'link-arg=-Wl,-S')
  run('cargo', args, { env: {
    ...process.env,
    RUSTUP_TOOLCHAIN: config.rustToolchain,
    ...(apple ? {
      MACOSX_DEPLOYMENT_TARGET: descriptor.macosDeploymentTarget,
      CFLAGS: `${process.env.CFLAGS || ''} -mmacosx-version-min=${descriptor.macosDeploymentTarget}`.trim(),
      CXXFLAGS: `${process.env.CXXFLAGS || ''} -mmacosx-version-min=${descriptor.macosDeploymentTarget}`.trim()
    } : {}),
    RLN_ADAPTER_SHA256: config.patchSha256,
    RLN_WRAPPER_SHA256: descriptor.wrapperSha256,
    RLN_LOCK_SHA256: descriptor.lockSha256
  } })
  contract.verifyPreparedSource(sourceRoot, config)
  const extension = descriptor.target.includes('apple') ? 'dylib' : 'so'
  const built = path.join(process.env.CARGO_TARGET_DIR || path.join(packageRoot, 'target'),
    descriptor.target, descriptor.profile, `librln_node.${extension}`)
  fs.copyFileSync(built, addonPath())
  recordAddonProvenance(config, descriptor)
}

function main () {
  const config = readConfig()
  if (!existingAddonMatches(config)) {
    prepareSource(config)
    if (process.argv.includes('--prepare-only')) return
    buildAddon(config)
  }
  if (!existingAddonMatches(config)) throw new Error('Native artifact failed provenance verification')
  process.stdout.write('Verified release-based native addon.\n')
}

if (require.main === module) main()
module.exports = { addonPath, existingAddonMatches, identity, manifestMatches, readConfig,
  recordAddonProvenance, prepareSource, buildAddon, TARGETS, platformSuffix, verifyAddonAdmission }
