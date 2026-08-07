import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'
import type { FidelityMetric, VerifyReport } from './types.ts' 

export interface VerifyOptions {
  sourceUrl: string
  replicaDir: string
  port?: number
}

export async function verifyReplica(opts: VerifyOptions): Promise<VerifyReport> {
  const port = await startVite(opts.replicaDir, opts.port)
  const replicaUrl = `http://localhost:${port}`
  const browser = await chromium.launch({ headless: true })
  try {
    const src = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await src.goto(opts.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await src.waitForTimeout(500)
    const a = await snapshot(src)

    const rep = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await rep.goto(replicaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await rep.waitForTimeout(500)
    const b = await snapshot(rep)

    const metrics = buildMetrics(a, b)
    const passed = metrics.filter((m) => m.pass).length
    const score = Math.round((passed / metrics.length) * 100)
    return { url: opts.sourceUrl, replicaDir: opts.replicaDir, score, metrics }
  } finally {
    await browser.close()
    await kill(port)
  }
}

interface Snap {
  title: string
  themeColor: string
  bodyBg: string
  heading: { text: string; fontSize: number; fontFamily: string; fontStyle: string }
  bodyFontSize: number
  bodyFontFamily: string
  nav: { present: boolean; position: string; top: string; bg: string }
  canvas: { present: boolean; diffPer400ms: number | null }
  scrollRatio: number
  heroWords: number
}

async function snapshot(page: Page): Promise<Snap> {
  return page.evaluate(async () => {
    const gs = (e: Element) => getComputedStyle(e)
    const headingEl = [...document.querySelectorAll<HTMLElement>('h1,h2,h3,p')]
      .map((e) => ({ e, fs: parseFloat(gs(e).fontSize) }))
      .sort((a, b) => b.fs - a.fs)[0]
    const heading = headingEl
      ? {
          text: headingEl.e.textContent!.trim().slice(0, 40),
          fontSize: headingEl.fs,
          fontFamily: gs(headingEl.e).fontFamily.split(',')[0].replace(/["']/g, ''),
          fontStyle: gs(headingEl.e).fontStyle,
        }
      : { text: '', fontSize: 0, fontFamily: '', fontStyle: '' }

    const bodyEl = [...document.querySelectorAll<HTMLElement>('p,span,li,div')].find((e) => {
      const t = e.textContent!.trim()
      const d = [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE)
      return t.length > 30 && d && e.querySelectorAll('*').length < 4
    })
    const bodyFontSize = bodyEl ? parseFloat(gs(bodyEl).fontSize) : 0
    const bodyFontFamily = bodyEl ? gs(bodyEl).fontFamily.split(',')[0].replace(/["']/g, '') : ''

    const navEl = document.querySelector('header nav, nav')
    const nav = navEl
      ? {
          present: true,
          position: gs(navEl).position,
          top: gs(navEl).top,
          bg: gs(navEl).backgroundColor,
        }
      : { present: false, position: '', top: '', bg: '' }

    const canv = document.querySelector('canvas')
    let canvas = { present: !!canv, diffPer400ms: null as number | null }
    if (canv) {
      try {
        const ctx = canv.getContext('2d')
        if (ctx) {
          const cw = canv.width, ch = canv.height
          const x = Math.max(0, Math.floor(cw / 2) - 50), y = Math.max(0, Math.floor(ch / 2) - 50)
          const bufA = ctx.getImageData(x, y, 100, 100).data
          await new Promise((r) => setTimeout(r, 400))
          const bufB = ctx.getImageData(x, y, 100, 100).data
          let diff = 0, n = 0
          for (let i = 0; i < bufA.length; i += 4) {
            diff += Math.abs(bufA[i] - bufB[i]); n++
          }
          canvas.diffPer400ms = Math.round((diff / n) * 1000) / 1000
        }
      } catch {
        // cross-origin taint -> leave null
      }
    }

    const big = [...document.querySelectorAll<HTMLElement>('h1,h2,h3,p')]
      .map((e) => ({ e, fs: parseFloat(gs(e).fontSize) }))
      .sort((a, b) => b.fs - a.fs)[0]
    const heroWords = big && big.fs >= 40 ? big.e.querySelectorAll('span').length : 0

    return {
      title: document.title,
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? '',
      bodyBg: gs(document.body).backgroundColor,
      heading,
      bodyFontSize,
      bodyFontFamily,
      nav,
      canvas,
      scrollRatio: Math.round((document.documentElement.scrollHeight / window.innerHeight) * 100) / 100,
      heroWords,
    }
  })
}

function near(a: number, b: number, tol: number): boolean {
  if (!a || !b) return a === b
  return Math.abs(a - b) / Math.max(a, b) <= tol
}

function buildMetrics(a: Snap, b: Snap): FidelityMetric[] {
  const headTol = 0.25
  const metrics: FidelityMetric[] = [
    { key: 'title', label: 'Page title', source: a.title, replica: b.title, pass: a.title.trim() !== '' },
    {
      key: 'themeColor',
      label: 'Theme color',
      source: a.themeColor,
      replica: b.themeColor,
      pass: a.themeColor.toLowerCase().replace('#', '') === b.themeColor.toLowerCase().replace('#', '') || !a.themeColor,
    },
    {
      key: 'bodyBg',
      label: 'Body background',
      source: a.bodyBg,
      replica: b.bodyBg,
      pass: a.bodyBg === b.bodyBg || !a.bodyBg,
    },
    {
      key: 'headingSize',
      label: 'Heading font size',
      source: a.heading.fontSize,
      replica: b.heading.fontSize,
      pass: near(a.heading.fontSize, b.heading.fontSize, headTol),
      note: `${a.heading.fontSize}px vs ${b.heading.fontSize}px`,
    },
    {
      key: 'headingFont',
      label: 'Heading font family',
      source: a.heading.fontFamily,
      replica: b.heading.fontFamily,
      pass: norm(a.heading.fontFamily) === norm(b.heading.fontFamily) || a.heading.fontFamily === '',
      note: `${a.heading.fontFamily} vs ${b.heading.fontFamily}`,
    },
    {
      key: 'headingStyle',
      label: 'Heading italic',
      source: a.heading.fontStyle,
      replica: b.heading.fontStyle,
      pass: a.heading.fontStyle === b.heading.fontStyle || !a.heading.fontStyle,
    },
    {
      key: 'bodySize',
      label: 'Body font size',
      source: a.bodyFontSize,
      replica: b.bodyFontSize,
      pass: near(a.bodyFontSize, b.bodyFontSize, headTol),
      note: `${a.bodyFontSize}px vs ${b.bodyFontSize}px`,
    },
    {
      key: 'bodyFont',
      label: 'Body font family',
      source: a.bodyFontFamily,
      replica: b.bodyFontFamily,
      pass: norm(a.bodyFontFamily) === norm(b.bodyFontFamily) || a.bodyFontFamily === '',
      note: `${a.bodyFontFamily} vs ${b.bodyFontFamily}`,
    },
    {
      key: 'navPosition',
      label: 'Nav position',
      source: a.nav.position,
      replica: b.nav.position,
      pass: a.nav.position === b.nav.position || !a.nav.position,
    },
    {
      key: 'navTop',
      label: 'Nav top offset',
      source: a.nav.top,
      replica: b.nav.top,
      pass: a.nav.top === b.nav.top || !a.nav.present,
      note: `${a.nav.top} vs ${b.nav.top}`,
    },
    {
      key: 'navBg',
      label: 'Nav transparency',
      source: a.nav.bg,
      replica: b.nav.bg,
      pass: a.nav.bg === b.nav.bg || !a.nav.present,
      note: `${a.nav.bg} vs ${b.nav.bg}`,
    },
    {
      key: 'canvasDiff',
      label: 'Background canvas speed',
      source: a.canvas.diffPer400ms ?? 0,
      replica: b.canvas.diffPer400ms ?? 0,
      pass: !a.canvas.present || (a.canvas.diffPer400ms !== null && b.canvas.diffPer400ms !== null && near(a.canvas.diffPer400ms, b.canvas.diffPer400ms, 0.4)),
      note: a.canvas.present ? `${a.canvas.diffPer400ms} vs ${b.canvas.diffPer400ms}` : 'no canvas on source',
    },
    {
      key: 'heroWords',
      label: 'Hero word count',
      source: a.heroWords,
      replica: b.heroWords,
      pass: !a.heroWords || a.heroWords === b.heroWords,
      note: `${a.heroWords} vs ${b.heroWords}`,
    },
  ]
  return metrics
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/["']/g, '')
}

async function startVite(dir: string, preferredPort?: number): Promise<number> {
  const vite = join(dir, 'node_modules', 'vite', 'bin', 'vite.js')
  const port = preferredPort ?? 5190 + Math.floor(Math.random() * 400)
  const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: dir,
    stdio: 'ignore',
    detached: true,
  })
  servers.set(port, child)
  await waitFor(port)
  return port
}

const servers = new Map<number, ReturnType<typeof spawn>>()

async function waitFor(port: number, tries = 60): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) })
      if (r.ok || r.status === 200) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Vite dev server on port ${port} did not become ready`)
}

async function kill(port: number): Promise<void> {
  const child = servers.get(port)
  if (!child) return
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else child.kill('SIGTERM')
  } catch {
    // ignore
  }
  servers.delete(port)
}
