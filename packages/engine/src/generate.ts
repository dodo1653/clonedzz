import { mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ComponentSpec, GenerateOptions, GenerateResult, Recipe, TokenSiteData } from './types.ts'
import { slugify, isDark } from './util.ts'
import {
  appTsx,
  cssTokens,
  cssUtilities,
  indexHtml,
  jsString,
  jsStringList,
  lightOverrides,
  mainTsx,
  navTsx,
  packageJson,
  particleFieldTsx,
  revealTsx,
  staticIndexHtml,
  staticServeMjs,
  tsconfig,
  viteConfig,
  viteEnvDts,
} from './templates.ts'
import { buildGatekiller, injectGatekiller } from './gatekiller.ts'

export async function generateProject(opts: GenerateOptions): Promise<GenerateResult> {
  const { recipe, token } = opts
  const name = slugify(opts.name || recipe.name)
  const dir = join(opts.targetDir, name)
  const warnings: string[] = []
  const files: string[] = []

  const hasCanvas = !!recipe.canvas?.present

  const write = async (rel: string, content: string) => {
    const p = join(dir, rel)
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, content, 'utf8')
    files.push(rel)
  }

  if (!!recipe.pageHtml || (!!recipe.bodyHtml && recipe.bodyHtml.length > 200)) {
    for (const stale of ['package.json', 'vite.config.ts', 'tsconfig.json', 'index.html', 'src']) {
      await rm(join(dir, stale), { force: true, recursive: true })
    }
    const raw = recipe.pageHtml || ''
    let html = ''
    if (raw.length > 200) {
      html = raw
      warnings.push('mirror: copied the site\'s own HTML + JS + CSS — every tab/animation/effect runs like the original')
    } else {
      const css = recipe.rawCss ? sanitizeCss(recipe.rawCss) : ''
      html = staticIndexHtml(recipe, recipe.bodyHtml ?? '', css)
      warnings.push('mirror: served the captured page as a static replica (source had no server HTML)')
    }
    const origin = new URL('/', recipe.sourceUrl).href.replace(/\/$/, '')
    if (opts.removeGates) {
      try {
        const gk = await buildGatekiller(html, origin)
        if (gk) {
          html = injectGatekiller(html, gk.script)
          warnings.push(`gatekiller: bypassed ${gk.detected.length} login/wallet gate(s): ${gk.detected.map((g) => g.id.slice(0, 8)).join(', ')}`)
        } else {
          warnings.push('gatekiller: no wallet/login gate patterns detected in the site\'s JS - nothing to bypass')
        }
      } catch (e) {
        warnings.push(`gatekiller: detection failed (${String(e)}) - leaving gates intact`)
      }
    }
    await write('index.html', html)
    await write('serve.mjs', staticServeMjs(origin))
    await write('static.json', JSON.stringify({ sourceUrl: recipe.sourceUrl, generatedAt: new Date().toISOString() }, null, 2))
    if (token) {
      const baked = await bakeTokenAssets(dir, origin)
      const patched = await patchTokenFiles(dir, baked, recipe, token)
      warnings.push(
        `token factory: mirrored the live site and swapped in your token — ${patched} file(s) patched for CA/ticker/X${baked.length ? ` (${baked.length} assets baked locally)` : ''}`,
      )
    }
    return { dir, files, warnings }
  }

  const hasNav = !!recipe.nav?.present
  const reveal = recipe.reveal?.scrollReveal ?? false

  for (const stale of ['static.json', 'serve.mjs']) {
    await rm(join(dir, stale), { force: true })
  }

  const content = buildContent(recipe, token)
  const sectionsTsx = buildSectionsTsx(recipe, reveal)

  await write('package.json', packageJson(name))
  await write('vite.config.ts', viteConfig())
  await write('tsconfig.json', tsconfig())
  await write('index.html', indexHtml(recipe, recipe.fonts))
  await write('src/vite-env.d.ts', viteEnvDts())
  await write('src/main.tsx', mainTsx())
  await write('src/App.tsx', appTsx(hasNav, hasCanvas, isDark(recipe.background)))
  await write('src/index.css', `@import "tailwindcss";\n\n${cssTokens(recipe, recipe.fonts)}\n${cssUtilities(recipe)}${isDark(recipe.background) ? '' : lightOverrides()}${siteCss(recipe)}`)
  await write('src/data/content.ts', content)
  await write('src/lib/reveal.tsx', revealTsx(recipe.reveal))
  await write('src/components/sections.tsx', sectionsTsx)
  if (hasNav) await write('src/components/Nav.tsx', navTsx(recipe.nav, true))
  if (hasCanvas) await write('src/components/ParticleField.tsx', particleFieldTsx(recipe))
  await write('src/pages/Home.tsx', buildHomeTsx(recipe, hasNav, hasCanvas))

  return { dir, files, warnings }
}

function sanitizeBodyHtml(html: string, baseUrl: string): string {
  let h = html
  h = h.replace(/<!--[\s\S]*?-->/g, '')
  h = h.replace(/<script[\s\S]*?<\/script>/gi, '')
  h = h.replace(/<script[^>]*\/?>/gi, '')
  h = h.replace(/<style[\s\S]*?<\/style>/gi, '')
  h = h.replace(/<link\b[^>]*\/?>/gi, '')
  h = h.replace(/<meta\b[^>]*\/?>/gi, '')
  h = h.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  h = h.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  h = h.replace(/<iframe[^>]*\/?>/gi, '')
  h = h.replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
  h = h.replace(/<canvas[^>]*\/?>/gi, '')
  h = h.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  return absolutizeUrls(h, baseUrl)
}

function absolutizeUrls(html: string, baseUrl: string): string {
  const base = new URL(baseUrl)
  const abs = (v: string): string => {
    const v2 = v.trim()
    if (!v2) return v
    if (/^(https?:|data:|mailto:|tel:|blob:)/i.test(v2)) return v
    if (v2.startsWith('#')) return v
    if (v2.startsWith('//')) return 'https:' + v2
    if (v2.startsWith('/')) return base.origin + v2
    try {
      return new URL(v2, base).href
    } catch {
      return v
    }
  }
  return html
    .replace(
      /(\s(?:src|href|poster|data-src|data-href)\s*=\s*)(["'])([\s\S]*?)\2/gi,
      (_m: string, pre: string, q: string, val: string) => `${pre}${q}${abs(val)}${q}`,
    )
    .replace(
      /(\ssrcset\s*=\s*)(["'])([\s\S]*?)\2/gi,
      (_m: string, pre: string, q: string, val: string) => {
        const parts = val
          .split(',')
          .map((p) => {
            const bits = p.trim().split(/\s+/)
            if (bits.length && bits[0]) bits[0] = abs(bits[0])
            return bits.join(' ')
          })
          .join(', ')
        return `${pre}${q}${parts}${q}`
      },
    )
}

function sanitizeCss(css: string): string {
  let c = css.replace(/@charset[^;]*;?/gi, '').replace(/@import\b[^;]*;?/gi, '')
  return c.slice(0, 350000)
}

function buildContent(recipe: Recipe, token: TokenSiteData | null | undefined): string {
  const hero = recipe.components.find((c) => c.type === 'Hero')
  const ca = token?.ca ?? recipe.contractAddresses[0] ?? null

  const ctas: { text: string; href: string; style: string }[] = []
  if (token?.ca) {
    ctas.push({ text: `BUY ON PUMP.FUN`, href: `https://pump.fun/coin/${token.ca}`, style: 'glass' })
  }
  for (const c of recipe.components) {
    for (const b of c.blocks) {
      if (b.tag === 'a' && b.text.length > 2 && b.text.length < 40) {
        const cls = b.cls
        const style = /bg-white/.test(cls) ? 'white' : /liquid-glass|pill/.test(cls) ? 'glass' : 'text'
        if (ctas.length < 4 && !ctas.some((x) => x.text === b.text)) {
          const href = b.href && b.href.startsWith('http') ? b.href : '#'
          ctas.push({ text: b.text, href, style })
        }
      }
    }
  }
  for (const b of recipe.nav?.buttons ?? []) {
    if (ctas.length < 4 && !ctas.some((x) => x.text === b.text)) {
      ctas.push({ text: b.text, href: b.href, style: /bg-white/.test(b.cls) ? 'white' : 'glass' })
    }
  }

  const stats = hero?.blocks.filter((b) => /^[\d.,$%]/.test(b.text)).map((b) => {
    const parts = b.text.split(/\s+/)
    return { num: parts[0], sub: parts.slice(1).join(' ') }
  }) ?? []

  const stripItems: string[] = []
  for (const c of recipe.components) {
    if (c.type === 'LogoStrip') {
      for (const b of c.blocks) if (b.text.length < 40 && b.fontSize >= 18) stripItems.push(b.text)
    }
  }

  const quote =
    recipe.components
      .find((c) => c.type === 'Quote')
      ?.blocks.filter((b) => b.fontSize < 24 && b.text.length > 10)
      .map((b) => b.text)[0] ?? null

  const video = recipe.components.find((c) => c.type === 'Video')?.media?.[0] ?? null

  const socials = token
    ? [
        ...(token.x ? [{ label: 'x', href: token.x }] : []),
        ...(token.telegram ? [{ label: 'telegram', href: token.telegram }] : []),
        ...(token.community ? [{ label: 'community', href: token.community }] : []),
      ]
    : recipe.socials

  const headline = hero?.headline ?? token?.name ?? recipe.title
  const sub = hero?.body?.[0] ?? token?.description ?? ''
  const images = recipe.images?.slice(0, 30) ?? []

  const sections = recipe.components
    .filter((c) => c.type !== 'Nav')
    .map((c) => buildSectionData(c))

  const tokenObj = token
    ? {
        name: token.name,
        ticker: token.ticker,
        ca: token.ca,
        x: token.x ?? null,
        telegram: token.telegram ?? null,
        community: token.community ?? null,
      }
    : null

  const lines = [
    `export interface Cta { text: string; href: string; style: 'white' | 'glass' | 'text' }`,
    `export interface SectionData { type: string; label: string; headline?: string; bodies: string[]; items: { title: string; body: string }[]; media: string[]; bg?: string; align?: string; textColor?: string }`,
    ``,
    `export const SITE = {`,
    `  name: ${jsString(recipe.name)},`,
    `  title: ${jsString(recipe.title)},`,
    `  background: ${jsString(recipe.background)},`,
    `  headline: ${jsString(headline)},`,
    `  headingItalic: ${recipe.heroItalic},`,
    `  sub: ${jsString(sub)},`,
    `  ctas: [${ctas.map((c) => `{ text: ${jsString(c.text)}, href: ${jsString(c.href)}, style: ${jsString(c.style)} }`).join(', ')}],`,
    `  stats: [${stats.map((s) => `{ num: ${jsString(s.num)}, sub: ${jsString(s.sub)} }`).join(', ')}],`,
    `  strip: ${jsStringList(stripItems)},`,
    `  quote: ${jsString(quote ?? '')},`,
    `  video: ${jsString(video ?? '')},`,
    `  images: ${jsStringList(images)},`,
    `  ca: ${jsString(ca ?? '')},`,
    `  socials: [${socials.map((s) => `{ label: ${jsString(s.label)}, href: ${jsString(s.href)} }`).join(', ')}],`,
    `  navLinks: [${(recipe.nav?.links ?? []).map((l) => `{ text: ${jsString(l.text)}, href: ${jsString(l.href)} }`).join(', ')}],`,
    `  token: ${tokenObj ? JSON.stringify(tokenObj, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:') : 'null'},`,
    `}`,
    ``,
    `export const SECTIONS: SectionData[] = ${JSON.stringify(sections, null, 2)}`,
    ``,
  ]
  return lines.join('\n')
}

function buildSectionData(c: ComponentSpec) {
  const label = c.blocks.find((b) => /^\/\//.test(b.text))?.text ?? `// section ${c.index + 1}`
  return {
    type: c.type,
    label,
    headline: c.headline ?? undefined,
    bodies: c.body ?? [],
    items: c.items ?? [],
    media: c.media ?? [],
    bg: c.bg ?? undefined,
    align: c.align ?? undefined,
    textColor: c.textColor ?? undefined,
  }
}

function siteCss(recipe: Recipe): string {
  const comps = recipe.components.filter((c) => c.type !== 'Nav')
  const rules: string[] = []
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i]
    const sel = `.sec-${i}`
    const props: string[] = []
    if (c.bg) props.push(`background: ${c.bg};`)
    if (c.align) props.push(`text-align: ${c.align};`)
    if (props.length) rules.push(`${sel} { ${props.join(' ')} }`)
    const t = c.textColor
    if (t && t !== 'rgba(0, 0, 0, 0)' && !/^(oklab|lab)/i.test(t)) {
      rules.push(`${sel} h1, ${sel} h2, ${sel} h3, ${sel} .display, ${sel} .quote, ${sel} .stat-num { color: ${t}; }`)
      rules.push(`${sel} p, ${sel} .card-body, ${sel} .card-title, ${sel} .faq-a, ${sel} .stat-sub, ${sel} .mono-label { color: ${t}; }`)
    }
  }
  return rules.length ? `\n${rules.join('\n')}\n` : ''
}

function buildSectionsTsx(recipe: Recipe, reveal: boolean): string {
  return `import { useState, type ReactNode } from 'react'
import { StaggerText, Reveal } from '../lib/reveal'
import { SITE, SECTIONS, type SectionData } from '../data/content'

function Hero({ d }: { d: SectionData }) {
  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden">
      {SITE.video ? (
        <video className="absolute left-1/2 top-0 z-0 h-[120vh] -translate-x-1/2 object-cover" src={SITE.video} autoPlay muted playsInline />
      ) : null}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pt-32 sm:px-10">
        <h1 className={'display max-w-[12ch] text-[56px] leading-[0.8] tracking-[-4px] text-white sm:text-[88px]' + (SITE.headingItalic ? ' italic' : '')}>
          <StaggerText text={d.headline ?? SITE.headline} />
        </h1>
        {d.bodies[0] || SITE.sub ? (
          <Reveal y={24} delay={150}>
            <div className="mt-8 max-w-2xl space-y-4">
              {d.bodies.length ? d.bodies.map((b, i) => (
                <p key={i} className="text-base font-light leading-relaxed text-white/90">{b}</p>
              )) : <p className="text-base font-light leading-relaxed text-white/90">{SITE.sub}</p>}
            </div>
          </Reveal>
        ) : null}
        <Reveal y={24} delay={300}>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            {SITE.ctas.map((c, i) =>
              c.style === 'white' ? (
                <a key={i} href={c.href} target="_blank" rel="noopener noreferrer" className="btn-white">{c.text}</a>
              ) : c.style === 'glass' ? (
                <a key={i} href={c.href} target="_blank" rel="noopener noreferrer" className="liquid-glass-strong pill btn-glass">{c.text}</a>
              ) : (
                <a key={i} href={c.href} className="btn-text">{c.text}</a>
              ),
            )}
          </div>
        </Reveal>
      </div>
      {SITE.stats.length ? (
        <Reveal y={24} delay={450}>
          <div className="relative z-10 flex w-full items-center justify-center gap-16 pb-16 pt-10">
            {SITE.stats.map((s, i) => (
              <div key={i}>
                <div className="stat-num text-4xl">{s.num}</div>
                <div className="stat-sub mt-2">{s.sub}</div>
              </div>
            ))}
          </div>
        </Reveal>
      ) : null}
    </section>
  )
}

function Cards({ d }: { d: SectionData }) {
  const items = d.items.length ? d.items : d.bodies.map((b, i) => ({ title: 'Item ' + (i + 1), body: b }))
  return (
    <section className="relative">
      <div className="section-wrap">
        {d.headline ? (
          <div className="mb-12">
            <Reveal y={24}><div className="mono-label">{d.label}</div></Reveal>
            <StaggerText text={d.headline} className="display max-w-[10ch] text-[52px] text-white sm:text-[72px]" />
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-8">
          {items.map((it, i) => (
            <Reveal key={i} y={24} delay={i * 80}>
              <div className="liquid-glass glass-card">
                <h3 className="card-title">{it.title}</h3>
                <p className="card-body mt-3 max-w-xl">{it.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Stats({ d }: { d: SectionData }) {
  return (
    <section className="relative">
      <div className="section-wrap">
        {d.headline ? (
          <div className="mb-12">
            <Reveal y={24}><div className="mono-label">{d.label}</div></Reveal>
            <StaggerText text={d.headline} className="display max-w-[12ch] text-[52px] text-white sm:text-[72px]" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-16">
          {SITE.stats.length ? SITE.stats.map((s, i) => (
            <div key={i}>
              <div className="stat-num text-5xl">{s.num}</div>
              <div className="stat-sub mt-2">{s.sub}</div>
            </div>
          )) : d.bodies.map((b, i) => (
            <div key={i} className="stat-sub max-w-[220px]">{b}</div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Quote({ d }: { d: SectionData }) {
  const text = SITE.quote || d.headline || d.bodies[0] || ''
  return (
    <section className="relative">
      <div className="section-wrap">
        <Reveal y={24}>
          <figure className="quote max-w-[68ch]">{text}</figure>
        </Reveal>
      </div>
    </section>
  )
}

function LogoStrip() {
  if (!SITE.strip.length) return null
  return (
    <section className="relative">
      <div className="section-wrap">
        <Reveal y={24}>
          <div className="liquid-glass scroll-x flex items-center gap-12 py-5">
            {SITE.strip.map((n) => (
              <span key={n} className="display whitespace-nowrap text-3xl text-white/80">{n}</span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Video({ d }: { d: SectionData }) {
  const src = d.media[0] || SITE.video
  if (!src) return null
  return (
    <section className="relative" id="demo">
      <div className="section-wrap">
        <div className="mb-12">
          <Reveal y={24}><div className="mono-label">{d.label}</div></Reveal>
          {d.headline ? <StaggerText text={d.headline} className="display max-w-[10ch] text-[52px] text-white sm:text-[72px]" /> : null}
        </div>
        <Reveal y={24} delay={100}>
          <div className="liquid-glass video-frame">
            <video src={src} muted loop playsInline autoPlay />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Faq({ d }: { d: SectionData }) {
  const [open, setOpen] = useState(0)
  return (
    <section className="relative" id="detect">
      <div className="section-wrap">
        <div className="mb-12">
          <Reveal y={24}><div className="mono-label">{d.label}</div></Reveal>
          {d.headline ? <StaggerText text={d.headline} className="display max-w-[12ch] text-[52px] text-white sm:text-[72px]" /> : null}
        </div>
        <Reveal y={24} delay={100}>
          <div className="liquid-glass glass-card divide-y">
            {d.items.map((f, i) => (
              <div key={i} className="faq-item">
                <button type="button" className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                  {f.title}
                  <span className="font-mono text-sm text-white/60">{open === i ? '−' : '+'}</span>
                </button>
                <div className="faq-a" style={{ maxHeight: open === i ? 240 : 0, transition: 'max-height 0.28s ease' }}>
                  <div className="pb-6 pr-6">{f.body}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function TokenBar() {
  if (!SITE.ca) return null
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(SITE.ca)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <section className="relative">
      <div className="section-wrap">
        <Reveal y={24}>
          <div className="liquid-glass flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="min-w-0">
              <div className="mono-label mb-1 !text-[11px]">// contract address</div>
              <button type="button" onClick={copy} className="max-w-[42ch] truncate font-mono text-sm text-white" title={SITE.ca}>
                {copied ? 'copied ✓' : SITE.ca}
              </button>
            </div>
            <div className="flex items-center gap-3">
              {SITE.socials.slice(0, 2).map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="btn-glass liquid-glass-strong pill">
                  {s.label.toUpperCase()}
                </a>
              ))}
              <a href={\`https://pump.fun/coin/\${SITE.ca}\`} target="_blank" rel="noopener noreferrer" className="btn-white">BUY</a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Footer({ d }: { d: SectionData }) {
  const copy = () => {
    if (SITE.ca) navigator.clipboard.writeText(SITE.ca)
  }
  return (
    <footer className="relative">
      <div className="section-wrap">
        <Reveal y={24}>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
            <div className="min-w-0">
              {SITE.ca ? (
                <>
                  <div className="mono-label mb-1 !text-[11px]">// contract address</div>
                  <button type="button" onClick={copy} className="max-w-[42ch] truncate font-mono text-sm text-white" title={SITE.ca}>
                    {SITE.ca}
                  </button>
                </>
              ) : (
                <span className="display text-2xl text-white">{SITE.name}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {SITE.socials.map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="btn-white">{s.label.toUpperCase()}</a>
              ))}
            </div>
          </div>
          <p className="mt-8 text-center font-body text-sm font-light text-white/50">
            {d.bodies[0] || 'Made with CloneDzz. Not financial advice.'}
          </p>
        </Reveal>
      </div>
    </footer>
  )
}

function Custom({ d }: { d: SectionData }) {
  return (
    <section className="relative">
      <div className="section-wrap">
        {d.headline ? (
          <div className="mb-12">
            <Reveal y={24}><div className="mono-label">{d.label}</div></Reveal>
            <StaggerText text={d.headline} className="display max-w-[12ch] text-[52px] text-white sm:text-[72px]" />
          </div>
        ) : null}
        <div className="max-w-[68ch] space-y-4">
          {d.bodies.map((b, i) => (
            <Reveal key={i} y={24} delay={i * 100}>
              <p className="text-[15px] font-light leading-relaxed text-white/80">{b}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Gallery() {
  return (
    <section className="relative">
      <div className="section-wrap">
        <Reveal y={24}>
          <div className="liquid-glass scroll-x flex items-center gap-6 py-5">
            {SITE.images.map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" className="h-36 max-w-[280px] shrink-0 object-contain" />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const MAP: Record<string, (d: SectionData) => ReactNode> = {
  Hero, Cards, Stats, Quote, LogoStrip, Video, Faq, TokenBar, Footer, Custom,
}

export default function Sections() {
  return (
    <>
      {SECTIONS.map((d, i) => {
        const Comp = MAP[d.type] ?? Custom
        return (
          <div key={i} className={'sec-' + i}>
            <Comp d={d} />
          </div>
        )
      })}
      {SITE.images.length ? <Gallery /> : null}
    </>
  )
}
`
}

function buildHomeTsx(recipe: Recipe, hasNav: boolean, hasCanvas: boolean): string {
  return `import Sections from '../components/sections'

export default function Home() {
  return (
    <>
      <Sections />
    </>
  )
}
`
}

const TOKEN_ASSET_EXT = /\.(?:mp4|webm|mp3|wav|ogg|jpg|jpeg|png|gif|webp|svg|avif|woff2?|ttf|eot|glb|gltf|json|js|mjs|css|txt)$/i

async function bakeTokenAssets(dir: string, origin: string): Promise<string[]> {
  const baked: string[] = []
  const seen = new Set<string>()
  const queue: string[] = []
  const originHost = new URL(origin).host
  const localIndex = join(dir, 'index.html')
  let indexHtml: string | null = null
  try {
    indexHtml = await readFile(localIndex, 'utf8')
  } catch {
    // fall back to fetching from origin
  }
  if (indexHtml === null) {
    try {
      const r = await fetch(new URL('/index.html', origin).href, { signal: AbortSignal.timeout(60000) })
      if (r.ok) {
        indexHtml = await r.text()
        await mkdir(dir, { recursive: true })
        await writeFile(localIndex, indexHtml)
      }
    } catch {
      // ignore
    }
  }
  if (indexHtml !== null) {
    baked.push('/index.html')
    for (const ref of extractAssetRefs(indexHtml)) {
      const resolved = resolveRef(ref, '/index.html', originHost)
      if (resolved && !seen.has(resolved)) queue.push(resolved)
    }
  }
  while (queue.length) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)
    const clean = path.split('?')[0]
    let buf: Buffer
    try {
      const r = await fetch(new URL(path, origin).href, { signal: AbortSignal.timeout(60000) })
      if (!r.ok) continue
      buf = Buffer.from(await r.arrayBuffer())
    } catch {
      continue
    }
    const local = join(dir, clean.replace(/^\//, ''))
    await mkdir(dirname(local), { recursive: true })
    await writeFile(local, buf)
    baked.push(clean)
    const ext = clean.split('.').pop()?.toLowerCase() || ''
    if (['html', 'js', 'mjs', 'css'].includes(ext)) {
      for (const ref of extractAssetRefs(buf.toString('utf8'))) {
        const resolved = resolveRef(ref, clean, originHost)
        if (resolved && !seen.has(resolved)) queue.push(resolved)
      }
    }
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
  if (!TOKEN_ASSET_EXT.test(path) || /[\s,;]/.test(path)) return null
  return path
}

async function patchTokenFiles(dir: string, baked: string[], recipe: Recipe, token: TokenSiteData): Promise<number> {
  const textFiles = baked.filter((p) => /\.(html|js|mjs|css|json|txt)$/i.test(p))
  const all = await joinTextFiles(dir, textFiles)
  const htmlCorpus = extractHtmlCorpus(all)
  const quotedCorpus = extractQuotedCorpus(all)
  const scanCorpus = quotedCorpus + '\n' + htmlCorpus

  const oldCA = recipe.contractAddresses[0] || detectCA(all) || null
  const oldX =
    (recipe.socials.find((s) => /x\.com|twitter\.com/i.test(s.href))?.href) ||
    (all.match(/https?:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_/]+/) || [])[0] ||
    null
  const oldTicker = detectTicker(scanCorpus, recipe)
  const oldName = detectName(scanCorpus, recipe)

  let changed = 0
  for (const p of textFiles) {
    const path = join(dir, p.replace(/^\//, ''))
    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch {
      continue
    }
    const isHtml = /\.html$/i.test(p)
    let out = text
    if (oldCA && token.ca) out = out.split(oldCA).join(token.ca)
    if (oldX && token.x) out = out.split(oldX).join(token.x)
    if (oldTicker && token.ticker) out = replaceTicker(out, oldTicker, token.ticker, isHtml)
    if (oldName && token.name) out = replaceNameSafe(out, oldName, token.name, isHtml)
    if (out !== text) {
      await writeFile(path, out)
      changed++
    }
  }
  return changed
}

function extractQuotedCorpus(all: string): string {
  const parts: string[] = []
  const re = /["']([^"'\n]{2,})["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(all))) parts.push(m[1])
  return parts.join('\n')
}

function detectCA(all: string): string | null {
  const evm = all.match(/\b0x[a-fA-F0-9]{40}\b/)
  if (evm) return evm[0]
  const re = /["']([1-9A-HJ-NP-Za-km-z]{32,44})["']/g
  const candidates: { value: string; before: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(all))) {
    const value = m[1]
    if (!/[A-Z]/.test(value)) continue
    candidates.push({ value, before: all.slice(Math.max(0, m.index - 90), m.index) })
  }
  if (!candidates.length) return null
  const byContext = candidates.find(
    (c) => /pump$/.test(c.value) || /(?:ca|contract|address|mint|token)\s*[:=]?\s*$/i.test(c.before),
  )
  if (byContext) return byContext.value
  candidates.sort((a, b) => b.value.length - a.value.length)
  return candidates[0].value
}

function detectName(corpus: string, recipe: Recipe): string | null {
  const name = (recipe.name || '').trim()
  if (!name) return null
  const re = new RegExp(`(?:^|[^A-Za-z0-9_])${escapeRegExp(name)}(?:[^A-Za-z0-9_]|$)`, 'i')
  return re.test(corpus) ? name : null
}

async function joinTextFiles(dir: string, textFiles: string[]): Promise<string> {
  let all = ''
  for (const p of textFiles) {
    try {
      all += '\n' + (await readFile(join(dir, p.replace(/^\//, '')), 'utf8'))
    } catch {
      // skip unreadable
    }
  }
  return all
}

function extractHtmlCorpus(all: string): string {
  const htmlIdx = all.search(/<!doctype html|<html[\s>]/i)
  const htmlEnd = all.search(/<\/html[\s>]/i)
  const html = htmlIdx >= 0 ? all.slice(htmlIdx, htmlEnd >= 0 ? htmlEnd + 7 : undefined) : all.slice(0, htmlEnd >= 0 ? htmlEnd + 7 : undefined)
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const parts: string[] = []
  for (const m of stripped.match(/[^<>]*/g) || []) {
    if (m.trim()) parts.push(m)
  }
  for (const m of html.match(/\s(?:content|title|alt|aria-label|placeholder|data-[a-z-]+)\s*=\s*"([^"]+)"/gi) || []) {
    const v = m.replace(/^[^=]*=\s*"/, '').replace(/"$/, '')
    if (v) parts.push(v)
  }
  return parts.join('\n')
}

function detectTicker(corpus: string, recipe: Recipe): string | null {
  const reserved = new Set([
    'typeof', 'instanceof', 'of', 'in', 'new', 'return', 'this', 'true', 'false', 'null', 'undefined',
    'function', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
    'continue', 'default', 'try', 'catch', 'finally', 'throw', 'class', 'extends', 'super', 'yield',
    'await', 'async', 'import', 'export', 'from', 'as', 'delete', 'void', 'debugger', 'static', 'get', 'set',
  ])
  const counts = new Map<string, number>()
  const re = /\$([A-Za-z][A-Za-z0-9_]{1,12})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(corpus))) {
    const t = m[1].toLowerCase()
    if (reserved.has(t)) continue
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  const nameLower = recipe.name.toLowerCase()
  let best: string | null = null
  let bestScore = 0
  for (const [t, c] of counts) {
    const score = c + (nameLower === t ? 10 : nameLower.includes(t) ? 5 : 0)
    if (score > bestScore) {
      best = t
      bestScore = score
    }
  }
  if (best) return best
  const caTicker = recipe.contractAddresses[0] ? nameLower.split(/\s+/)[0].toLowerCase() : null
  if (caTicker && caTicker.length >= 2 && caTicker.length <= 14 && new RegExp(`\\b\\$?${escapeRegExp(caTicker)}\\b`, 'i').test(corpus)) {
    return caTicker
  }
  return null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceWord(s: string, oldWord: string, newWord: string): string {
  return s.replace(new RegExp(`\\b${escapeRegExp(oldWord)}\\b`, 'gi'), (w) => {
    if (w === w.toUpperCase()) return newWord.toUpperCase()
    if (w[0] === w[0].toUpperCase()) return newWord[0].toUpperCase() + newWord.slice(1)
    return newWord
  })
}

function replaceTicker(text: string, oldTicker: string, newTicker: string, isHtml: boolean): string {
  const ot = oldTicker.toLowerCase()
  const nt = newTicker
  let out = text.replace(new RegExp(`\\$${escapeRegExp(ot)}(?![A-Za-z0-9_])`, 'gi'), `$${nt}`)
  out = out.replace(new RegExp(`\\$${escapeRegExp(ot).toUpperCase()}(?![A-Za-z0-9_])`, 'gi'), () => `$${nt.toUpperCase()}`)
  if (!isHtml) return out
  const safeAttrs = ['content', 'title', 'alt', 'aria-label', 'placeholder', 'data-title']
  const attrRe = new RegExp(`(\\b(?:${safeAttrs.join('|')})\\s*=\\s*["'])([^"']*)(["'])`, 'gi')
  out = out.replace(attrRe, (_m, pre: string, val: string, post: string) => pre + replaceWord(val, ot, nt) + post)
  const textRe = new RegExp(`(>)([^<]*\\b${escapeRegExp(ot)}\\b[^<]*)(<)`, 'gi')
  out = out.replace(textRe, (_m, pre: string, val: string, post: string) => pre + replaceWord(val, ot, nt) + post)
  return out
}

function replaceNameSafe(text: string, oldName: string, newName: string, isHtml: boolean): string {
  const on = oldName
  const nn = newName
  if (isHtml) {
    const safeAttrs = ['content', 'title', 'alt', 'aria-label', 'placeholder', 'data-title']
    const attrRe = new RegExp(`(\\b(?:${safeAttrs.join('|')})\\s*=\\s*["'])([^"']*)(["'])`, 'gi')
    let out = text.replace(attrRe, (_m, pre: string, val: string, post: string) => pre + replaceWord(val, on, nn) + post)
    const textRe = new RegExp(`(>)([^<]*\\b${escapeRegExp(on)}\\b[^<]*)(<)`, 'gi')
    out = out.replace(textRe, (_m, pre: string, val: string, post: string) => pre + replaceWord(val, on, nn) + post)
    return out
  }
  const quotedRe = new RegExp(`([^=.(\\[{?]|^)(["'])${escapeRegExp(on)}(["'])`, 'gi')
  return text.replace(quotedRe, (_m, pre: string, q: string, q2: string) => pre + q + nn + q2)
}
