import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import express from 'express'
import cors from 'cors'
import { analyzeUrl, generateProject, verifyReplica, type Recipe, type TokenSiteData } from '@cloneforge/engine'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const LIBRARY = join(ROOT, 'library')
const THEMES_DIR = join(LIBRARY, 'themes')
const TOKENS_DIR = join(LIBRARY, 'tokens')
const SESSIONS_DIR = join(LIBRARY, 'sessions')
const OUTPUTS_DIR = join(ROOT, 'outputs')
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
    }
    const recipe = body.recipe ?? (body.sessionId ? readRecipe(body.sessionId) : null)
    if (!recipe) {
      res.status(400).json({ error: 'recipe or sessionId required' })
      return
    }
    const result = await generateProject({
      targetDir: OUTPUTS_DIR,
      name: body.name || recipe.name,
      recipe,
      token: body.token ?? null,
    })
    writeFileSync(
      join(result.dir, '.cloneforge.json'),
      JSON.stringify({ sourceUrl: recipe.sourceUrl, title: recipe.title, name: recipe.name, createdAt: new Date().toISOString() }, null, 2),
    )
    if (body.install !== false) {
      await run('npm', ['install', '--no-audit', '--no-fund'], result.dir)
    }
    res.json({ ...result, installStarted: body.install !== false })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post('/api/verify', async (req, res) => {
  try {
    const { sourceUrl, replicaDir } = req.body as { sourceUrl: string; replicaDir: string }
    if (!existsSync(join(replicaDir, 'node_modules'))) {
      await run('npm', ['install', '--no-audit', '--no-fund'], replicaDir)
    }
    const report = await verifyReplica({ sourceUrl, replicaDir })
    res.json(report)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// --- preview (vite dev server lifecycle) ---
const previews = new Map<number, ReturnType<typeof spawn>>()
app.post('/api/preview', async (req, res) => {
  try {
    const { dir } = req.body as { dir: string }
    if (!existsSync(join(dir, 'node_modules', 'vite'))) {
      await run('npm', ['install', '--no-audit', '--no-fund'], dir)
    }
    const port = 5290 + Math.floor(Math.random() * 400)
    const vite = join(dir, 'node_modules', 'vite', 'bin', 'vite.js')
    const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
      cwd: dir,
      stdio: 'ignore',
      detached: true,
    })
    previews.set(port, child)
    await waitFor(port)
    res.json({ url: `http://localhost:${port}`, port })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})
app.post('/api/preview/stop', (req, res) => {
  const { port } = req.body as { port: number }
  const child = previews.get(port)
  if (child) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else child.kill('SIGTERM')
    previews.delete(port)
  }
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
        return { id: e.name, meta, summary: summarize(recipe) }
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
app.get('/api/outputs', (_req, res) => {
  const items = readdirSync(OUTPUTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(OUTPUTS_DIR, e.name, 'package.json')))
    .map((e) => {
      const pkg = JSON.parse(readFileSync(join(OUTPUTS_DIR, e.name, 'package.json'), 'utf8'))
      const installed = existsSync(join(OUTPUTS_DIR, e.name, 'node_modules'))
      const metaFile = join(OUTPUTS_DIR, e.name, '.cloneforge.json')
      const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : null
      return {
        name: e.name,
        title: pkg.name,
        installed,
        path: join(OUTPUTS_DIR, e.name),
        sourceUrl: meta?.sourceUrl ?? null,
      }
    })
  res.json(items)
})

// --- static web (production) ---
const WEB_DIST = join(ROOT, 'apps', 'web', 'dist')
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST))
  app.get('*', (_req, res) => {
    res.sendFile(join(WEB_DIST, 'index.html'))
  })
}

const PORT = Number(process.env.PORT || 4747)
app.listen(PORT, () => {
  console.log(`cloneforge server on http://localhost:${PORT}`)
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
