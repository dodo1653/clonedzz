import { chromium } from 'playwright'
import type {
  CanvasInfo,
  NavInfo,
  RenderedAnalysis,
  RevealInfo,
  ScrollableInfo,
  Section,
  TextBlock,
  VideoInfo,
} from './types.ts' 
import { detectSocial, isContractAddress } from './util.ts' 

export interface RenderedOptions {
  width?: number
  height?: number
}

const HEADLESS = process.env.CLONEFORGE_BROWSER_HEADLESS !== '0'

export async function renderedAnalysis(url: string, opts: RenderedOptions = {}): Promise<RenderedAnalysis> {
  const width = opts.width ?? 1440
  const height = opts.height ?? 900
  const browser = await chromium.launch({ headless: HEADLESS })
  try {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(400)

    const base = await page.evaluate(() => {
      const blocks: TextBlock[] = []
      const seen = new Set<string>()
      const all = document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,span,div,li,button,a,figcaption')
      for (const el of all) {
        const direct = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim().length >= 2)
        if (!direct) continue
        const text = el.textContent!.trim()
        if (text.length < 2 || text.length > 400) continue
        if (seen.has(text)) continue
        seen.add(text)
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        const s = getComputedStyle(el)
        const fs = parseFloat(s.fontSize)
        if (fs < 9) continue
        let bg: string | undefined
        let p = el.parentElement
        for (let i = 0; i < 6 && p; i++) {
          const pb = getComputedStyle(p).backgroundColor
          if (pb && pb !== 'rgba(0, 0, 0, 0)' && pb !== 'transparent') {
            bg = pb
            break
          }
          p = p.parentElement
        }
        blocks.push({
          text,
          tag: el.tagName.toLowerCase(),
          fontSize: fs,
          fontFamily: s.fontFamily.split(',')[0].replace(/["']/g, ''),
          fontWeight: s.fontWeight,
          fontStyle: s.fontStyle,
          color: s.color,
          letterSpacing: s.letterSpacing,
          lineHeight: s.lineHeight,
          x: Math.round(r.x),
          y: Math.round(r.y + window.scrollY),
          w: Math.round(r.width),
          h: Math.round(r.height),
          align: s.textAlign,
          maxWidth: Math.round(r.width),
          cls: el.className ? String(el.className) : '',
          href: el.tagName === 'A' ? (el as HTMLAnchorElement).href : undefined,
          bg,
        })
        if (blocks.length > 1400) break
      }
      return { blocks }
    })

    const viewport = { w: width, h: height }
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    const fontsUsed = computeFontsUsed(base.blocks)
    const sections = clusterSections(base.blocks)
    const nav = await readNav(page)
    const videos = await readVideos(page)
    const images = await readImages(page)
    const canvases = await readCanvases(page)
    const fixedLayers = await page.evaluate(() => {
      const out: { tag: string; cls: string; z: string; w: number; h: number; bf: string }[] = []
      for (const e of document.querySelectorAll('*')) {
        const s = getComputedStyle(e)
        if (s.position === 'fixed' && e.getBoundingClientRect().width > 0) {
          const r = e.getBoundingClientRect()
          out.push({
            tag: e.tagName.toLowerCase(),
            cls: e.className ? String(e.className).slice(0, 120) : '',
            z: s.zIndex,
            w: Math.round(r.width),
            h: Math.round(r.height),
            bf: s.backdropFilter.slice(0, 40),
          })
        }
      }
      return out
    })
    const buttons = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>('a,button')]
        .map((el) => {
          const href = (el as HTMLAnchorElement).href || ''
          const text = el.textContent!.trim().slice(0, 60)
          return { text, href, cls: el.className ? String(el.className).slice(0, 120) : '' }
        })
        .filter((b) => b.text),
    )
    const links = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLAnchorElement>('a')]
        .map((a) => ({ text: a.textContent!.trim().slice(0, 60), href: a.href }))
        .filter((l) => l.href.startsWith('http') || l.href.startsWith('/')),
    )
    const scrollables: ScrollableInfo[] = await page.evaluate(() => {
      const out: ScrollableInfo[] = []
      for (const e of document.querySelectorAll<HTMLElement>('*')) {
        if (e.scrollWidth > e.clientWidth + 4) {
          const s = getComputedStyle(e)
          if (/auto|scroll/.test(s.overflowX)) {
            out.push({
              cls: e.className ? String(e.className).slice(0, 120) : e.tagName.toLowerCase(),
              overflow: s.overflowX,
              scrollbarColor: s.scrollbarColor.slice(0, 40),
              scrollbarWidth: s.scrollbarWidth,
            })
          }
        }
      }
      return out.slice(0, 10)
    })
    const glass = await page.evaluate(() => {
      const cls = new Set<string>()
      const blurs = new Set<string>()
      let count = 0
      for (const e of document.querySelectorAll('*')) {
        const bf = getComputedStyle(e).backdropFilter
        if (bf && bf !== 'none') {
          count++
          blurs.add(bf.slice(0, 40))
          if (e.className) cls.add(String(e.className).split(' ')[0])
        }
      }
      return { count, blurs: [...blurs], cls: [...cls].slice(0, 8) }
    })

    const contractAddresses = new Set<string>()
    const socials = new Set<string>()
    const socialList: { label: string; href: string }[] = []
    for (const l of links) {
      const label = detectSocial(l.href)
      if (label && !socials.has(label)) {
        socials.add(label)
        socialList.push({ label, href: l.href })
      }
      const m = l.href.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)
      if (m && isContractAddress(m[0])) contractAddresses.add(m[0])
    }
    for (const b of base.blocks) {
      const words = b.text.split(/\s+/)
      for (const w of words) if (isContractAddress(w)) contractAddresses.add(w)
    }

    const reveal = await measureReveal(page, base.blocks)

    const bodyHtml = await page.evaluate(async () => {
      let prev = ''
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 600))
        const cur = document.body.innerHTML
        if (cur === prev) break
        prev = cur
      }
      const d = document.documentElement
      const h = d.scrollHeight
      const step = Math.max(window.innerHeight, 400)
      let y = 0
      let it = 0
      for (; y <= h && it < 40; y += step, it++) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 50))
      }
      window.scrollTo(0, 0)
      return document.body.innerHTML
    })
    await page.waitForTimeout(250)

    const cssParts: string[] = (await page.evaluate(() =>
      [...document.querySelectorAll('style')].map((s) => s.textContent || ''),
    ))
    const sheetUrls = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"],link[rel="preload"][as="style"]')]
        .map((l) => l.href)
        .filter((h) => h.startsWith('http')),
    )
    for (const u of sheetUrls.slice(0, 10)) {
      try {
        const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(15000) })
        if (res.ok) cssParts.push(await res.text())
      } catch {
        // ignore failed stylesheet fetches
      }
    }
    const rawCss = cssParts.join('\n').slice(0, 400000)

    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll('script')].map((s) => ({ src: s.src || '', type: s.type || '' })).filter((s) => s.src || s.type !== 'application/ld+json'),
    )

    return {
      url,
      viewport,
      scrollHeight,
      bodyBg,
      fontsUsed,
      nav,
      sections,
      videos,
      images,
      canvases,
      fixedLayers,
      buttons,
      links,
      scrollables,
      glass,
      reveal,
      contractAddresses: [...contractAddresses],
      socials: socialList,
      bodyHtml,
      rawCss,
      scripts,
    }
  } finally {
    await browser.close()
  }
}

function computeFontsUsed(blocks: TextBlock[]) {
  const byFamily = new Map<string, { count: number; sizes: number[]; isMono: boolean }>()
  for (const b of blocks) {
    const f = b.fontFamily || 'unknown'
    const e = byFamily.get(f) ?? { count: 0, sizes: [], isMono: /mono/i.test(f) }
    e.count++
    e.sizes.push(b.fontSize)
    byFamily.set(f, e)
  }
  return [...byFamily.entries()]
    .map(([family, v]) => {
      const sizes = v.sizes
      const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length
      const max = Math.max(...sizes)
      const role = v.isMono ? 'mono' : max >= 48 ? 'display' : avg <= 17 ? 'body' : 'mixed'
      return { family, count: v.count, sizes: [...new Set(sizes)].sort((a, b) => b - a).slice(0, 6), role }
    })
    .sort((a, b) => b.count - a.count)
}

function clusterSections(blocks: TextBlock[]): Section[] {
  const sorted = [...blocks].sort((a, b) => a.y - b.y)
  const sections: Section[] = []
  let cur: TextBlock[] = []
  let curY = 0
  let curH = 0
  for (const b of sorted) {
    const gap = b.y - (curY + curH)
    const isHeading = /^h[1-4]$/.test(b.tag)
    const isBig = b.fontSize >= 36
    if (cur.length && gap > 60) {
      sections.push(styleSection({ index: sections.length, y: curY, h: curH, blocks: cur }))
      cur = []
    } else if (cur.length && isHeading && gap > 24) {
      sections.push(styleSection({ index: sections.length, y: curY, h: curH, blocks: cur }))
      cur = []
    } else if (cur.length && isBig && gap > 90) {
      sections.push(styleSection({ index: sections.length, y: curY, h: curH, blocks: cur }))
      cur = []
    }
    cur.push(b)
    curY = cur.length === 1 ? b.y : Math.min(curY, b.y)
    curH = Math.max(curH, b.y + b.h - curY)
  }
  if (cur.length) sections.push(styleSection({ index: sections.length, y: curY, h: curH, blocks: cur }))
  return sections
}

function styleSection(s: Section): Section {
  const bgs = s.blocks.filter((b) => b.bg).map((b) => b.bg!)
  const bg = bgs[0] ?? undefined
  const aligns = s.blocks.map((b) => b.align).filter((a) => a && a !== 'start')
  const align = aligns.length > s.blocks.length / 2 ? (aligns[0] ?? 'left') : undefined
  const biggest = s.blocks.reduce((a, b) => (b.fontSize > a.fontSize ? b : a), s.blocks[0])
  const textColor = biggest?.color && biggest.color !== 'rgba(0, 0, 0, 0)' ? biggest.color : undefined
  return { ...s, bg, align, textColor }
}

async function readNav(page: import('playwright').Page): Promise<NavInfo | null> {
  return page.evaluate(() => {
    const navEl = document.querySelector('header nav, nav')
    if (!navEl) return null
    const s = getComputedStyle(navEl)
    const r = navEl.getBoundingClientRect()
    if (s.position !== 'fixed' || r.height > 120) return null
    const logoA = navEl.querySelector<HTMLAnchorElement>('a')
    const links: { text: string; href: string; cls: string }[] = []
    const buttons: { text: string; href: string; cls: string }[] = []
    for (const a of navEl.querySelectorAll<HTMLAnchorElement>('a')) {
      const txt = a.textContent!.trim()
      if (!txt) continue
      const item = { text: txt.slice(0, 40), href: a.href, cls: a.className ? String(a.className) : '' }
      if (/btn|bg-white|rounded-full|pill|liquid/.test(item.cls)) buttons.push(item)
      else links.push(item)
    }
    const svg = logoA?.querySelector('svg')
    return {
      present: true,
      position: s.position,
      top: s.top,
      zIndex: s.zIndex,
      background: s.backgroundColor,
      backdropFilter: s.backdropFilter || s.webkitBackdropFilter || 'none',
      paddingX: s.paddingLeft,
      height: Math.round(r.height),
      logo: logoA
        ? {
            glass: /liquid-glass/.test(String(logoA.className)),
            hasSvg: !!svg,
            svg: svg ? svg.outerHTML.slice(0, 600) : null,
            w: Math.round(logoA.getBoundingClientRect().width),
            h: Math.round(logoA.getBoundingClientRect().height),
          }
        : null,
      links,
      buttons,
    }
  })
}

async function readVideos(page: import('playwright').Page): Promise<VideoInfo[]> {
  return page.evaluate(async () => {
    const out: VideoInfo[] = []
    for (const v of document.querySelectorAll<HTMLVideoElement>('video')) {
      const r = v.getBoundingClientRect()
      out.push({
        src: v.currentSrc || v.src || '',
        width: v.videoWidth || Math.round(r.width),
        height: v.videoHeight || Math.round(r.height),
        autoplay: v.autoplay,
        muted: v.muted,
        loop: v.loop,
        playsInline: v.playsInline,
        lazy: !v.hasAttribute('src') && v.querySelectorAll('source').length === 0,
        objectFit: getComputedStyle(v).objectFit,
      })
    }
    return out
  })
}

async function readImages(page: import('playwright').Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>('img')]
      .map((i) => i.currentSrc || i.src)
      .filter((s) => s.startsWith('http')),
  )
}

async function readCanvases(page: import('playwright').Page): Promise<CanvasInfo[]> {
  const list = await page.evaluate(() =>
    [...document.querySelectorAll('canvas')].map((c) => {
      const r = c.getBoundingClientRect()
      const s = getComputedStyle(c)
      return {
        w: c.width,
        h: c.height,
        cw: Math.round(r.width),
        ch: Math.round(r.height),
        zIndex: s.zIndex,
        position: s.position,
        cls: c.className ? String(c.className) : '',
      }
    }),
  )
  const out: CanvasInfo[] = []
  for (const c of list.slice(0, 3)) {
    const info: CanvasInfo = {
      present: true,
      w: c.w,
      h: c.h,
      zIndex: c.zIndex,
      position: c.position,
      algorithm: null,
      diffPer400ms: null,
      samples: [],
    }
    try {
      const r = await page.evaluate(
        async (cw, ch) => {
          const c = [...document.querySelectorAll('canvas')].find((x) => x.width === cw && x.height === ch)
          if (!c) return null
          const ctx = c.getContext('2d') as CanvasRenderingContext2D | null
          if (!ctx) return null
          const region = (fx: number, fy: number) => {
            const x = Math.floor(fx * cw), y = Math.floor(fy * ch), sz = 32
            const d = ctx.getImageData(x, y, sz, sz).data
            let rr = 0, gg = 0, bb = 0, lit = 0
            const n = sz * sz
            for (let i = 0; i < d.length; i += 4) {
              rr += d[i]; gg += d[i + 1]; bb += d[i + 2]
              if (d[i] > 30) lit++
            }
            return { rgb: [Math.round(rr / n), Math.round(gg / n), Math.round(bb / n)] as [number, number, number], litPct: Math.round((lit / n) * 100) }
          }
          const samples = [
            { fx: 0.5, fy: 0.5, ...region(0.5, 0.5) },
            { fx: 0.18, fy: 0.32, ...region(0.18, 0.32) },
            { fx: 0.82, fy: 0.68, ...region(0.82, 0.68) },
            { fx: 0.55, fy: 0.12, ...region(0.55, 0.12) },
          ]
          const win = { x: Math.max(0, Math.floor(cw / 2) - 50), y: Math.max(0, Math.floor(ch / 2) - 50), w: 100, h: 100 }
          const safe = { x: Math.min(win.x, cw - win.w), y: Math.min(win.y, ch - win.h), w: Math.min(win.w, cw), h: Math.min(win.h, ch) }
          const bufA = ctx.getImageData(safe.x, safe.y, safe.w, safe.h).data
          await new Promise((r2) => setTimeout(r2, 400))
          const bufB = ctx.getImageData(safe.x, safe.y, safe.w, safe.h).data
          let diff = 0, n = 0
          for (let i = 0; i < bufA.length; i += 4) {
            diff += Math.abs(bufA[i] - bufB[i]); n++
          }
          return { samples, diffPer400ms: diff / n }
        },
        c.w,
        c.h,
      )
      if (r) {
        info.samples = r.samples.map((s) => ({ fx: s.fx, fy: s.fy, rgb: s.rgb, litPct: s.litPct }))
        info.diffPer400ms = Math.round(r.diffPer400ms * 1000) / 1000
      }
    } catch {
      // ignore canvas read errors (cross-origin taint etc.)
    }
    out.push(info)
  }
  return out
}

async function measureReveal(page: import('playwright').Page, blocks: TextBlock[]): Promise<RevealInfo | null> {
  const big = blocks.find((b) => b.fontSize >= 60 && /^[p,h]/i.test(b.tag))
  if (!big) return null

  const heroSamples = await page.evaluate(async () => {
    const bigEl = [...document.querySelectorAll<HTMLElement>('p, div, h1, h2')].find((e) => {
      const fs = parseFloat(getComputedStyle(e).fontSize)
      return fs >= 60 && e.children.length >= 5
    })
    if (!bigEl) return null
    const words = [...bigEl.children].slice(0, 4)
    const snap = () => words.map((w) => Math.round(parseFloat(getComputedStyle(w).opacity) * 100) / 100)
    const samples: number[][] = []
    for (const ms of [0, 150, 350, 600, 1000, 1600]) {
      samples.push(snap())
      if (ms > 0) await new Promise((r) => setTimeout(r, ms))
    }
    const n = bigEl.children.length
    const y = (() => {
      const s = getComputedStyle(bigEl.children[0])
      const m = s.transform.match(/matrix\(1, 0, 0, 1, 0, ([\d.-]+)\)/)
      return m ? Math.round(parseFloat(m[1]) * 10) / 10 : null
    })()
    return { samples, n, y }
  })

  const sectionReveal = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 100))
    const els = [...document.querySelectorAll<HTMLElement>('*')].filter((e) => {
      if (e.children.length) return false
      const t = e.textContent!.trim()
      if (t.length < 4 || t.length > 80) return false
      const s = getComputedStyle(e)
      return s.opacity === '0' && e.getBoundingClientRect().y > window.innerHeight * 0.7
    })
    if (!els.length) return { scrollReveal: false }
    const el = els[0]
    const before = parseFloat(getComputedStyle(el).opacity)
    const beforeY = (() => {
      const m = getComputedStyle(el).transform.match(/matrix\(1, 0, 0, 1, 0, ([\d.-]+)\)/)
      return m ? Math.round(parseFloat(m[1])) : null
    })()
    el.scrollIntoView({ block: 'center' })
    await new Promise((r) => setTimeout(r, 1200))
    const after = parseFloat(getComputedStyle(el).opacity)
    return { scrollReveal: before === 0 && after >= 0.9, beforeY }
  })

  const labelY = sectionReveal.beforeY ?? 24

  return {
    heroWords: heroSamples?.n ?? 0,
    heroStaggerMs: 120,
    heroSettleMs: 1000,
    heroY: heroSamples?.y ?? 50,
    sectionY: 50,
    labelY,
    scrollReveal: sectionReveal.scrollReveal,
    samples: heroSamples?.samples ?? [],
  }
}
