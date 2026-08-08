// Builds the release bundle for the clonedzz Windows desktop app:
//   1. compile the server (tsc) 2. stage server-deps (express/cors/playwright + engine)  3. copy browsers
//   4. build web dist  5. generate icon.ico  6. run electron-builder (NSIS + portable)
// Usage: node apps/desktop/build-release.cjs [--dir]   (--dir = unpacked only, faster smoke test)
const { execSync } = require('node:child_process')
const { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } = require('node:fs')
const { join, dirname } = require('node:path')
const { spawn } = require('node:child_process')

const ROOT = join(__dirname, '..', '..')
const DESKTOP = __dirname
const BUILD = join(DESKTOP, 'build')
const DIST = join(DESKTOP, 'server-dist')
const DEPS = join(DESKTOP, 'server-deps')
const RELEASE = join(DESKTOP, 'release')
const ONLY_DIR = process.argv.includes('--dir')

const step = (m) => console.log(`\n=== ${m} ===`)

function sh(cmd, opts = {}) {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts })
}

step('1/6 compile server (tsc)')
sh('npx tsc -p apps/desktop/tsconfig.server.json')
writeFileSync(join(DIST, 'package.json'), JSON.stringify({ type: 'module' }, null, 2))

step('2/6 stage server deps (express, cors, playwright-core + engine)')
rmSync(DEPS, { recursive: true, force: true })
mkdirSync(DEPS, { recursive: true })
writeFileSync(
  join(DEPS, 'package.json'),
  JSON.stringify(
    {
      name: 'clonedzz-server-deps',
      version: '1.0.0',
      private: true,
      type: 'commonjs',
      dependencies: { express: '^4.19.0', cors: '^2.8.5', 'playwright-core': '1.62.1' },
    },
    null,
    2,
  ),
)
// install npm deps FIRST, then drop in the compiled engine package afterwards —
// npm prunes anything extraneous, so the engine must be added after the install.
sh('npm install --prefix apps/desktop/server-deps --no-audit --no-fund --omit=dev')
mkdirSync(join(DEPS, 'node_modules', '@clonedzz', 'engine', 'src'), { recursive: true })
cpSync(join(DIST, 'packages', 'engine', 'src'), join(DEPS, 'node_modules', '@clonedzz', 'engine', 'src'), { recursive: true })
writeFileSync(
  join(DEPS, 'node_modules', '@clonedzz', 'engine', 'package.json'),
  JSON.stringify({ name: '@clonedzz/engine', version: '1.0.0', type: 'module', main: 'src/index.js' }, null, 2),
)
// strip npm-package garbage from the staged node_modules (README/license/docs of deps — ~1-2MB of dead weight)
pruneNpmJunk(join(DEPS, 'node_modules'))

step('3/6 copy playwright browsers (headless shell)')
const BROW = join(DESKTOP, 'browsers')
rmSync(BROW, { recursive: true, force: true })
mkdirSync(BROW, { recursive: true })
const cache = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || '.', 'AppData', 'Local')
const ms = join(cache, 'ms-playwright')
const entries = existsSync(ms) ? readFileSync(join(ROOT, 'node_modules', 'playwright-core', 'browsers.json'), 'utf8') : '{}'
const browsers = JSON.parse(entries).browsers || []
const wanted = new Set()
for (const b of browsers) {
  if (b.name.startsWith('chromium_headless_shell')) wanted.add(b.name + '-' + b.revision)
}
if (!wanted.size) wanted.add('chromium_headless_shell-1234')
for (const w of wanted) {
  const from = join(ms, w)
  if (existsSync(from)) {
    cpSync(from, join(BROW, w), { recursive: true })
    trimBrowser(join(BROW, w))
    console.log(`copied + trimmed ${w}`)
  } else {
    throw new Error(`headless shell browser not found in Playwright cache: ${from}. Run 'npx playwright install chromium-headless-shell' first.`)
  }
}
const marker = { browsers: [...wanted], note: 'copy the whole folder next to the packaged app and set PLAYWRIGHT_BROWSERS_PATH to it' }
writeFileSync(join(BROW, 'README.txt'), JSON.stringify(marker, null, 2) + '\n')

step('4/6 build web dist')
sh('npm run build')

// --- helpers ---

// Remove dead weight from the chromium_headless_shell folder: keep only the en-US
// locale pack (it is the default Playwright launches with), drop hyphenation data
// for other languages, and delete marker/debug files. Binary + icudtl stay.
function trimBrowser(root) {
  const win = join(root, 'chrome-headless-shell-win64')
  if (!existsSync(win)) return
  const locales = join(win, 'locales')
  if (existsSync(locales)) {
    for (const f of readDirSyncSafe(locales)) {
      if (f !== 'en-US.pak') rmSync(join(locales, f), { recursive: true, force: true })
    }
    console.log('  locales -> en-US only')
  }
  const hyphens = join(win, 'hyphen-data')
  if (existsSync(hyphens)) {
    for (const f of readDirSyncSafe(hyphens)) {
      if (!/^hyph_en/i.test(f)) rmSync(join(hyphens, f), { recursive: true, force: true })
    }
    console.log('  hyphen-data -> en only')
  }
  // marker/debug files — never needed at runtime
  for (const junk of ['debug.log', 'INSTALLATION_COMPLETE', 'DEPENDENCIES_VALIDATED', 'ABOUT']) {
    const p = join(win, junk)
    if (existsSync(p)) rmSync(p, { recursive: true, force: true })
  }
}

function readDirSyncSafe(dir) {
  try {
    return require('node:fs').readdirSync(dir)
  } catch {
    return []
  }
}

// Delete README / CHANGELOG / HISTORY / NOTICE / AUTHORS / markdown docs from the staged
// dependency tree. LICENSE files are kept (required for redistribution).
function pruneNpmJunk(root) {
  const fs = require('node:fs')
  const path = require('node:path')
  let removed = 0
  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(md|markdown)$/i.test(e.name) || /^(readme|changelog|history|notice|authors)(\.[^.]+)?$/i.test(e.name)) {
        try {
          fs.unlinkSync(p)
          removed++
        } catch {}
      }
    }
  }
  walk(root)
  console.log(`  pruned ${removed} doc files from server-deps`)
}

step('5/6 icon: electron-builder converts build/icon.png to ICO automatically')

step('6/6 electron-builder' + (ONLY_DIR ? ' (--dir)' : ''))
const args = ['--win', ...(ONLY_DIR ? ['--dir'] : [])]
const r = spawn(join(ROOT, 'node_modules', '.bin', 'electron-builder'), args, {
  cwd: DESKTOP,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
})
r.on('exit', (code) => {
  if (code !== 0) process.exit(code)
  console.log('\n=== DONE ===')
  if (existsSync(RELEASE)) {
    for (const f of require('node:fs').readdirSync(RELEASE)) console.log('release/', f)
  }
})
