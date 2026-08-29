import { join, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { spawn, exec } from 'node:child_process'
import express from 'express'
import cors from 'cors'
import { analyzeUrl, generateProject, verifyReplica, type Recipe, type TokenSiteData } from '@clonedzz/engine'

// In the packaged desktop app these point at resourcesPath / userData; in dev they fall back to the repo layout.
const ROOT = process.env.CLONEDZZ_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const LIBRARY = process.env.CLONEDZZ_LIBRARY || join(ROOT, 'library')
const THEMES_DIR = join(LIBRARY, 'themes')
const TOKENS_DIR = join(LIBRARY, 'tokens')
const SESSIONS_DIR = join(LIBRARY, 'sessions')
const OUTPUTS_DIR = process.env.CLONEDZZ_OUTPUTS || join(ROOT, 'outputs')
for (const d of [THEMES_DIR, TOKENS_DIR, SESSIONS_DIR, OUTPUTS_DIR]) mkdirSync(d, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, library: LIBRARY, outputs: OUTPUTS_DIR })
})

app.post('/api/analyze', async (req, res) => {
  try {
    const { url, name } = req.body as { url: string; name?: string }
    if (!url?.startsWith('http')) {
      res.status(400).json({ error: 'url must start with http(s)' })
      return
    }
    const recipe = await analyzeUrl(url, name)
    const id = slug(Date.now() + '-' + recipe.name)
    const dir = join(SESSIONS_DIR, id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'recipe.json'), JSON.stringify(recipe, null, 2))
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ id, sourceUrl: url, createdAt: new Date().toISOString() }, null, 2))
    res.json({ id, recipe })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post('/api/generate', async (req, res) => {
  try {
    const body = req.body as {
      sessionId?: string
      recipe?: Recipe
      name: string
      token?: TokenSiteData | null
      install?: boolean
      removeGates?: boolean
      bakeAssets?: boolean
    }
    const recipe = body.recipe ?? (body.sessionId ? readRecipe(body.sessionId) : null)
    if (!recipe) {
      res.status(400).json({ error: 'recipe or sessionId required' })
      return
    }
    const baked = body.bakeAssets === true
    const result = await generateProject({
      targetDir: OUTPUTS_DIR,
      name: body.name || recipe.name,
      recipe,
      token: body.token ?? null,
      removeGates: body.removeGates === true,
      bakeAssets: baked,
    })
    writeFileSync(
      join(result.dir, '.clonedzz.json'),
      JSON.stringify({ sourceUrl: recipe.sourceUrl, title: recipe.title, name: recipe.name, createdAt: new Date().toISOString(), baked }, null, 2),
    )
    if (body.install !== false && !existsSync(join(result.dir, 'static.json'))) {
      await run('npm', ['install', '--no-audit', '--no-fund'], result.dir)
    }
    if (body.sessionId) {
      const metaFile = join(SESSIONS_DIR, body.sessionId, 'meta.json')
      if (existsSync(metaFile)) {
        try {
          const meta = JSON.parse(readFileSync(metaFile, 'utf8'))
          meta.outputDir = result.dir
          meta.baked = baked
          meta.removeGates = body.removeGates === true
          meta.generatedAt = new Date().toISOString()
          writeFileSync(metaFile, JSON.stringify(meta, null, 2))
        } catch {
          // keep session meta untouched
        }
      }
    }
    res.json({ ...result, installStarted: body.install !== false })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post('/api/verify', async (req, res) => {
  try {
    const { sourceUrl, replicaDir } = req.body as { sourceUrl: string; replicaDir: string }
    if (existsSync(join(replicaDir, 'static.json'))) {
      res.json({ url: sourceUrl, replicaDir, score: null, metrics: [], note: 'static mirror — content is copied verbatim, no metric comparison needed' })
      return
    }
    if (!existsSync(join(replicaDir, 'node_modules'))) {
      await run('npm', ['install', '--no-audit', '--no-fund'], replicaDir)
    }
    const report = await verifyReplica({ sourceUrl, replicaDir })
    res.json(report)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- preview (dev server lifecycle) ---
// Ports are derived deterministically from the output dir so a dev server started
// for a clone survives app restarts: the same port is reused, and if the (detached)
// child is still alive we adopt it instead of spawning a duplicate.
interface PreviewEntry {
  dir: string
  child: ReturnType<typeof spawn> | { pid: -1 }
  static: boolean
}
const previews = new Map<number, PreviewEntry>()
function previewAlive(child: PreviewEntry['child']): boolean {
  if ('exitCode' in child) return !child.exitCode && !child.signalCode
  return true
}
function devPort(dir: string, base: number, span: number): number {
  let h = 0
  for (const ch of dir) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return base + (h % span)
}
async function probePort(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(800) })
    return r.status < 500
  } catch {
    return false
  }
}
app.post('/api/preview', async (req, res) => {
  try {
    const { dir } = req.body as { dir: string }
    const staticMode = existsSync(join(dir, 'static.json'))
    const port = staticMode ? devPort(dir, 5690, 300) : devPort(dir, 5290, 400)
    const existing = previews.get(port)
    if (existing && previewAlive(existing.child)) {
      res.json({ url: `http://localhost:${port}`, port, static: existing.static, reused: true })
      return
    }
    if (await probePort(port)) {
      previews.set(port, { dir, child: { pid: -1 }, static: staticMode })
      res.json({ url: `http://localhost:${port}`, port, static: staticMode, reused: true })
      return
    }
    let preview: { port: number | null; child: ReturnType<typeof spawn> | null }
    if (staticMode) {
      preview = await startStatic(dir, port)
      if (!preview.port || !preview.child) throw new Error('static preview server failed to start')
    } else {
      if (!existsSync(join(dir, 'node_modules', 'vite'))) {
        await run('npm', ['install', '--no-audit', '--no-fund'], dir)
      }
      preview = await startPreview(dir, port)
      if (!preview.port) {
        await run('npm', ['install', '--no-audit', '--no-fund'], dir)
        preview = await startPreview(dir, port)
      }
      if (!preview.port || !preview.child) {
        if (preview.child) killTree(preview.child)
        throw new Error('preview server failed to start, even after reinstalling dependencies')
      }
    }
    previews.set(port, { dir, child: preview.child, static: staticMode })
    res.json({ url: `http://localhost:${port}`, port, static: staticMode, reused: false })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})
app.get('/api/previews', (_req, res) => {
  const items: { port: number; dir: string; url: string; static: boolean }[] = []
  for (const [port, p] of previews) {
    if (previewAlive(p.child))
      items.push({ port, dir: p.dir, url: `http://localhost:${port}`, static: p.static })
  }
  res.json(items)
})
app.post('/api/preview/stop', (req, res) => {
  const { port } = req.body as { port: number }
  const entry = previews.get(port)
  const child = entry?.child
  if (child) {
    if ('exitCode' in child) {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
      else child.kill('SIGTERM')
    } else {
      exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`)
    }
  }
  previews.delete(port)
  res.json({ ok: true })
})

// --- themes ---
app.get('/api/themes', (_req, res) => {
  const items = listJson(THEMES_DIR).map((f) => ({ name: f, recipe: JSON.parse(readFileSync(join(THEMES_DIR, f), 'utf8')) }))
  res.json(items)
})
app.post('/api/themes', (req, res) => {
  try {
    const { name, recipe } = req.body as { name: string; recipe: Recipe }
    if (!name || !recipe) {
      res.status(400).json({ error: 'name and recipe required' })
      return
    }
    const file = slug(name) + '.json'
    writeFileSync(join(THEMES_DIR, file), JSON.stringify(recipe, null, 2))
    res.json({ name: file })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})
app.delete('/api/themes/:name', (req, res) => {
  try {
    rmSync(join(THEMES_DIR, req.params.name), { force: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- token presets ---
app.get('/api/tokens', (_req, res) => {
  const items = listJson(TOKENS_DIR).map((f) => ({ id: f.replace('.json', ''), data: JSON.parse(readFileSync(join(TOKENS_DIR, f), 'utf8')) }))
  res.json(items)
})
app.post('/api/tokens', (req, res) => {
  try {
    const data = req.body as TokenSiteData
    if (!data?.ca) {
      res.status(400).json({ error: 'ca required' })
      return
    }
    const id = slug(data.ticker || data.name || data.ca.slice(0, 6))
    writeFileSync(join(TOKENS_DIR, id + '.json'), JSON.stringify(data, null, 2))
    res.json({ id })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})
app.delete('/api/tokens/:id', (req, res) => {
  try {
    rmSync(join(TOKENS_DIR, req.params.id + '.json'), { force: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- sessions / outputs ---
app.get('/api/sessions', (_req, res) => {
  const items = readdirSync(SESSIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      try {
        const meta = JSON.parse(readFileSync(join(SESSIONS_DIR, e.name, 'meta.json'), 'utf8'))
        const recipe = JSON.parse(readFileSync(join(SESSIONS_DIR, e.name, 'recipe.json'), 'utf8'))
        let outDir = meta.outputDir && existsSync(meta.outputDir) ? meta.outputDir : null
        if (!outDir) {
          const slugName = slug(recipe.name || '')
          const candidate = join(OUTPUTS_DIR, slugName)
          if (existsSync(join(candidate, 'package.json')) || existsSync(join(candidate, 'static.json')))
            outDir = candidate
        }
        return { id: e.name, meta: { ...meta, outputDir: outDir }, summary: summarize(recipe) }
      } catch {
        return null
      }
    })
    .filter(Boolean)
  res.json(items)
})
app.get('/api/sessions/:id', (req, res) => {
  try {
    const recipe = readRecipe(req.params.id)
    res.json(recipe)
  } catch {
    res.status(404).json({ error: 'not found' })
  }
})
app.patch('/api/sessions/:id', (req, res) => {
  try {
    const { name } = req.body as { name?: string }
    const id = req.params.id
    const metaFile = join(SESSIONS_DIR, id, 'meta.json')
    if (!existsSync(metaFile)) throw new Error('not found')
    const meta = JSON.parse(readFileSync(metaFile, 'utf8'))
    meta.name = typeof name === 'string' && name.trim() ? name.trim() : undefined
    writeFileSync(metaFile, JSON.stringify(meta, null, 2))
    res.json({ ok: true, id, name: meta.name })
  } catch (e) {
    res.status(404).json({ error: String(e) })
  }
})
app.delete('/api/sessions/:id', (req, res) => {
  try {
    const dir = join(SESSIONS_DIR, req.params.id)
    if (!existsSync(dir)) throw new Error('not found')
    rmSync(dir, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(404).json({ error: String(e) })
  }
})
app.post('/api/push', async (req, res) => {
  try {
    const { dir, repo, branch = 'main', token, message = 'Deploy from clonedzz' } = req.body as {
      dir?: string
      repo?: string
      branch?: string
      token?: string
      message?: string
    }
    if (!dir || !repo) throw new Error('dir and repo (owner/name) are required')
    const target = resolve(OUTPUTS_DIR, dir)
    if (!target.startsWith(resolve(OUTPUTS_DIR) + sep)) throw new Error('invalid output dir')
    if (!existsSync(target)) throw new Error(`output dir not found: ${target}`)
    const m = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(repo.trim())
    if (!m) throw new Error('repo must be owner/name, e.g. dodo1653/AFK')
    const clean = `${m[1]}/${m[2]}`
    if (!/^[A-Za-z0-9_.-]+$/.test(branch)) throw new Error('invalid branch name')
    const isStatic = existsSync(join(target, 'static.json'))
    const notes: string[] = []

    if (isStatic) {
      notes.push('static mirror: baking local assets so the push is self-contained')
      const baked = await bakeStaticAssets(target)
      notes.push(baked.length ? `baked ${baked.length} local asset file(s)` : 'no extra assets needed to bake')
    }

    const gi = join(target, '.gitignore')
    const ignore = isStatic
      ? ['node_modules/', 'dist/', 'serve.mjs', 'static.json']
      : ['node_modules/', 'dist/', '*.log']
    if (!existsSync(gi)) writeFileSync(gi, ignore.join('\n') + '\n')

    await runOut('git', ['init', '-b', branch], target)
    await runOut('git', ['config', 'user.name', 'clonedzz'], target)
    await runOut('git', ['config', 'user.email', 'clonedzz@users.noreply.github.com'], target)
    await runOut('git', ['add', '-A'], target)
    const dirty = (await runOut('git', ['status', '--porcelain'], target)).trim()
    if (dirty) await runOut('git', ['commit', '-m', message], target)
    else notes.push('no file changes to commit')

    await runOut('git', ['remote', 'remove', 'origin'], target).catch(() => {})
    await runOut('git', ['remote', 'add', 'origin', `https://github.com/${clean}.git`], target)

    if (token) {
      await runOut('git', ['remote', 'set-url', 'origin', `https://x-access-token:${token}@github.com/${clean}.git`], target)
      await runOut('git', ['push', '-u', 'origin', branch], target)
      await runOut('git', ['remote', 'set-url', 'origin', `https://github.com/${clean}.git`], target)
    } else {
      await runOut('git', ['push', '-u', 'origin', branch], target)
    }
    const sha = (await runOut('git', ['rev-parse', 'HEAD'], target)).trim()
    res.json({
      ok: true,
      repo: clean,
      branch,
      commit: sha,
      url: `https://github.com/${clean}`,
      commitUrl: `https://github.com/${clean}/commit/${sha}`,
      notes,
    })
  } catch (e) {
    res.status(400).json({ error: String(e) })
  }
})

app.get('/api/outputs', (_req, res) => {
  const items = readdirSync(OUTPUTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(OUTPUTS_DIR, e.name, 'package.json')))
    .map((e) => {
      const pkg = JSON.parse(readFileSync(join(OUTPUTS_DIR, e.name, 'package.json'), 'utf8'))
      const installed = existsSync(join(OUTPUTS_DIR, e.name, 'node_modules'))
      const metaFile = join(OUTPUTS_DIR, e.name, '.clonedzz.json')
      const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : null
      const staticFile = join(OUTPUTS_DIR, e.name, 'static.json')
      const staticCfg = existsSync(staticFile) ? JSON.parse(readFileSync(staticFile, 'utf8')) : null
      return {
        name: e.name,
        title: pkg.name,
        installed,
        path: join(OUTPUTS_DIR, e.name),
        sourceUrl: meta?.sourceUrl ?? null,
        baked: meta?.baked === true || staticCfg?.baked === true,
        static: !!staticCfg,
      }
    })
  res.json(items)
})

// --- static web (production) ---
const WEB_DIST = process.env.CLONEDZZ_WEB_DIR || join(ROOT, 'apps', 'web', 'dist')
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST))
  app.get('*', (_req, res) => {
    res.sendFile(join(WEB_DIST, 'index.html'))
  })
}

const PORT = Number(process.env.PORT || 4747)
app.listen(PORT, () => {
  console.log(`clonedzz server on http://localhost:${PORT}`)
  discoverSurvivingDevServers()
})

// --- helpers ---
function readRecipe(id: string): Recipe {
  return JSON.parse(readFileSync(join(SESSIONS_DIR, id, 'recipe.json'), 'utf8')) as Recipe
}

function summarize(r: Recipe) {
  return {
    name: r.name,
    title: r.title,
    background: r.background,
    fonts: r.fonts,
    sourceUrl: r.sourceUrl,
    components: r.components.map((c) => ({ type: c.type, headline: c.headline })),
    notes: r.notes,
  }
}

function listJson(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.json'))
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'
}

function runOut(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })
    child.stdout?.on('data', (d) => (stdout += d))
    child.stderr?.on('data', (d) => (stderr += d))
    child.on('exit', (code) => {
      if (code === 0) resolvePromise(stdout)
      else reject(new Error((stderr.trim() || stdout.trim()) || `${cmd} exited ${code}`))
    })
    child.on('error', reject)
  })
}

async function bakeStaticAssets(dir: string): Promise<string[]> {
  const baked: string[] = []
  const { port, child } = await startStatic(dir, devPort(dir, 5790, 100))
  if (!port) return baked
  const base = `http://127.0.0.1:${port}`
  let originHost = ''
  try {
    originHost = new URL((JSON.parse(readFileSync(join(dir, 'static.json'), 'utf8')).sourceUrl as string) || '', base).host
  } catch {
    // keep empty
  }
  const seen = new Set<string>()
  const queue = ['/index.html']
  try {
    while (queue.length) {
      const path = queue.shift()!
      if (seen.has(path)) continue
      seen.add(path)
      const cleanPath = path.split('?')[0]
      let buf: Buffer
      try {
        const r = await fetch(base + path, { signal: AbortSignal.timeout(60000) })
        if (!r.ok) continue
        buf = Buffer.from(await r.arrayBuffer())
      } catch {
        continue
      }
      const local = join(dir, cleanPath.replace(/^\//, ''))
      mkdirSync(dirname(local), { recursive: true })
      writeFileSync(local, buf)
      baked.push(cleanPath)
      const ext = cleanPath.split('.').pop()?.toLowerCase() || ''
      if (['html', 'js', 'mjs', 'css'].includes(ext)) {
        for (const ref of extractAssetRefs(buf.toString('utf8'))) {
          const resolved = resolveRef(ref, cleanPath, originHost)
          if (resolved && !seen.has(resolved)) queue.push(resolved)
        }
      }
    }
  } finally {
    if (child) killTree(child)
  }
  return baked
}

function extractAssetRefs(text: string): string[] {
  const out: string[] = []
  const attr = /(?:src|href|poster|data-src)\s*=\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = attr.exec(text))) out.push(m[1])
  const srcset = /srcset\s*=\s*["']([^"']+)["']/gi
  while ((m = srcset.exec(text))) {
    for (const part of m[1].split(',')) {
      const p = part.trim().split(/\s+/)[0]
      if (p) out.push(p)
    }
  }
  const url = /url\(\s*["']?([^"')]+)["']?\s*\)/gi
  while ((m = url.exec(text))) out.push(m[1])
  const strings = /["'](\/?[A-Za-z0-9_./-]+\.(?:mp4|webm|mp3|wav|ogg|jpg|jpeg|png|gif|webp|svg|avif|woff2?|ttf|eot|glb|gltf|json))["']/gi
  while ((m = strings.exec(text))) out.push(m[1])
  return out
}

const ASSET_EXT = /\.(?:mp4|webm|mp3|wav|ogg|jpg|jpeg|png|gif|webp|svg|avif|woff2?|ttf|eot|glb|gltf|json|js|mjs|css)$/i

function resolveRef(ref: string, basePath: string, originHost: string): string | null {
  const v = ref.trim()
  if (!v || v.startsWith('data:') || v.startsWith('#') || v.startsWith('//') || v.startsWith('blob:')) return null
  let path: string
  if (/^https?:\/\//i.test(v)) {
    try {
      if (new URL(v).host !== originHost) return null
    } catch {
      return null
    }
    path = new URL(v).pathname
  } else if (v.startsWith('/')) {
    path = v.split('?')[0]
  } else {
    const base = basePath.split('/').slice(0, -1).join('/')
    path = (base ? base + '/' : '/') + v.split('?')[0]
  }
  if (!ASSET_EXT.test(path) || /[\s,;]/.test(path)) return null
  return path
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'ignore', shell: process.platform === 'win32' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
    child.on('error', reject)
  })
}

async function waitFor(port: number, tries = 150): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) })
      if (r.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Vite dev server on port ${port} did not become ready`)
}

function killTree(child: ReturnType<typeof spawn>): void {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
  else child.kill('SIGTERM')
}

async function discoverSurvivingDevServers(): Promise<void> {
  // After an app restart, detached dev servers from the previous run are still
  // listening on their deterministic per-dir ports. Re-register them so the UI
  // shows them as running and can stop/reuse them instead of starting duplicates.
  let dirs: string[] = []
  try {
    dirs = readdirSync(OUTPUTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(OUTPUTS_DIR, e.name))
  } catch {
    return
  }
  const jobs = dirs.map(async (dir) => {
    const staticMode = existsSync(join(dir, 'static.json'))
    const port = staticMode ? devPort(dir, 5690, 300) : devPort(dir, 5290, 400)
    if (previews.has(port)) return
    if (!(await probePort(port))) return
    previews.set(port, { dir, child: { pid: -1 }, static: staticMode })
    console.log(`dev server discovered on :${port} (${dir})`)
  })
  await Promise.all(jobs)
}

function startPreview(dir: string, port: number): Promise<{ port: number | null; child: ReturnType<typeof spawn> | null }> {
  return new Promise((resolve) => {
    const vite = join(dir, 'node_modules', 'vite', 'bin', 'vite.js')
    if (!existsSync(vite)) {
      resolve({ port: null, child: null })
      return
    }
    const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
      cwd: dir,
      stdio: 'ignore',
      detached: true,
    })
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      if (!ok) killTree(child)
      resolve({ port: ok ? port : null, child })
    }
    child.on('exit', () => finish(false))
    child.on('error', () => finish(false))
    const timer = setTimeout(() => finish(false), 45000)
    waitFor(port)
      .then(() => {
        clearTimeout(timer)
        finish(true)
      })
      .catch(() => {})
  })
}

function startStatic(dir: string, port: number): Promise<{ port: number | null; child: ReturnType<typeof spawn> | null }> {
  return new Promise((resolve) => {
    const serve = join(dir, 'serve.mjs')
    if (!existsSync(serve)) {
      resolve({ port: null, child: null })
      return
    }
    let origin = ''
    let baked = false
    try {
      const cfg = JSON.parse(readFileSync(join(dir, 'static.json'), 'utf8'))
      origin = cfg.sourceUrl ?? ''
      baked = cfg.baked === true
    } catch {
      // leave empty
    }
    const child = spawn(process.execPath, [serve, dir, String(port), origin, baked ? '1' : '0'], {
      cwd: dir,
      stdio: 'ignore',
      detached: true,
    })
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      if (!ok) killTree(child)
      resolve({ port: ok ? port : null, child })
    }
    child.on('exit', () => finish(false))
    child.on('error', () => finish(false))
    const timer = setTimeout(() => finish(false), 20000)
    waitFor(port)
      .then(() => {
        clearTimeout(timer)
        finish(true)
      })
      .catch(() => {})
  })
}
