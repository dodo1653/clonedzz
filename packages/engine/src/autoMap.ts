import type {
  ComponentSpec,
  FontRoles,
  Recipe,
  RenderedAnalysis,
  Section,
  StaticAnalysis,
  TextBlock,
} from './types.ts' 
import { cleanText, slugify, staticEligible } from './util.ts' 

const COMMON_MONO = /mono/i
const COMMON_DISPLAY = /serif|display|playfair|instrument|space gro|major/i

export function buildRecipe(static_: StaticAnalysis, rendered: RenderedAnalysis, name?: string): Recipe {
  const fonts = pickFontRoles(static_, rendered)
  const background = pickBackground(static_, rendered)
  const notes: string[] = []

  if (rendered.reveal?.scrollReveal) notes.push('scroll-reveal detected: sections fade/slide in on scroll (IntersectionObserver)')
  if (rendered.canvases.some((c) => c.present)) notes.push('animated fixed canvas background detected')
  if (rendered.videos.length) notes.push(`${rendered.videos.length} video(s): ${rendered.videos.map((v) => v.src.split('/').pop()).join(', ')}`)
  if (rendered.scrollables.length) notes.push(`horizontal scroll strip(s): ${rendered.scrollables.length}`)
  if (rendered.glass.count) notes.push(`liquid-glass cards detected (${rendered.glass.count}, blur ${rendered.glass.blurs.join(', ')})`)
  if (rendered.contractAddresses.length) notes.push(`contract address(s) found: ${rendered.contractAddresses[0]}`)
  if (rendered.socials.length) notes.push(`socials: ${rendered.socials.map((s) => s.label).join(', ')}`)

  const navCTAs = rendered.nav?.buttons ?? []
  const heroCTAs = rendered.buttons
    .filter((b) => !navCTAs.some((n) => n.href === b.href && n.text === b.text))
    .slice(0, 4)

  const components: ComponentSpec[] = []
  for (const sec of rendered.sections) {
    components.push(mapSection(sec, rendered))
  }

  // merge consecutive small sections into a Footer / LogoStrip where sensible
  const final: ComponentSpec[] = []
  for (const c of components) {
    const prev = final[final.length - 1]
    if (c.type === 'LogoStrip' && prev && prev.type === 'LogoStrip') {
      final[final.length - 1] = { ...prev, index: prev.index }
      continue
    }
    if (c.type === 'Custom' && c.blocks.every((b) => b.fontSize < 22) && !c.headline) {
      if (prev) {
        const merged: ComponentSpec = {
          ...prev,
          body: [...(prev.body ?? []), ...(c.body ?? [])],
        }
        final[final.length - 1] = merged
        continue
      }
    }
    final.push(c)
  }

  // ensure footer exists
  if (!final.some((c) => c.type === 'Footer')) {
    final.push({ type: 'Footer', index: final.length, blocks: [] })
  }
  // ensure hero exists
  if (!final.some((c) => c.type === 'Hero')) {
    final.unshift({ type: 'Hero', index: 0, blocks: rendered.sections[0]?.blocks ?? [] })
  }
  // promote the first big-headline section to Hero and absorb preceding small sections (e.g. a fixed nav)
  const heroAt = final.findIndex((c) => (c.blocks ?? []).some((b) => b.fontSize >= 40))
  if (heroAt > 0) {
    const h = final[heroAt]
    const absorbed = final.slice(0, heroAt).flatMap((c) => c.blocks ?? [])
    const blocks = [...absorbed, ...(h.blocks ?? [])]
    h.type = 'Hero'
    h.index = 0
    h.blocks = blocks
    h.headline = headlineOf(blocks)
    h.body = blocks.filter((b) => b !== largestHeadline(blocks) && b.fontSize < 24 && b.text.length > 24).map((b) => b.text)
    final.splice(0, heroAt)
  }

  const hero = final.find((c) => c.type === 'Hero')
  const heroBlock = hero ? largestHeadline(hero.blocks ?? []) : undefined
  const heroItalic = heroBlock ? /italic/.test(heroBlock.fontStyle ?? '') : false

  const name_ = name ?? slugify(static_.title ?? new URL(static_.url).hostname)

  return {
    name: name_,
    sourceUrl: static_.url,
    title: static_.title ?? name_,
    themeColor: static_.themeColor,
    favicon: static_.favicon,
    background,
    tokens: static_.tokens,
    fonts,
    nav: rendered.nav,
    heroItalic,
    components: final,
    keyframes: static_.keyframes,
    canvas: rendered.canvases.find((c) => c.present) ?? null,
    reveal: rendered.reveal,
    images: [...new Set(rendered.images)].filter((u) => /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(u)).slice(0, 30),
    contractAddresses: rendered.contractAddresses,
    socials: rendered.socials,
    notes,
    bodyHtml: rendered.bodyHtml,
    rawCss: rendered.rawCss,
    staticMode: staticEligible(rendered.scripts, rendered.bodyHtml),
    pageHtml: rendered.pageHtml,
  }
}

function pickFontRoles(static_: StaticAnalysis, rendered: RenderedAnalysis): FontRoles {
  const used = rendered.fontsUsed
  const roles: FontRoles = { display: null, body: null, mono: null }
  for (const f of used) {
    if (f.role === 'mono' && !roles.mono) roles.mono = f.family
  }
  for (const f of used) {
    if (f.role === 'display' && !roles.display) roles.display = f.family
  }
  if (!roles.display) {
    const d = used.find((f) => COMMON_DISPLAY.test(f.family))
    if (d) roles.display = d.family
  }
  const body = used.find((f) => f.role === 'body' || f.role === 'mixed')
  roles.body = body?.family ?? used[0]?.family ?? null
  if (roles.body === roles.display) roles.body = used.find((f) => f.family !== roles.display)?.family ?? roles.body
  if (!roles.mono) {
    const m = used.find((f) => COMMON_MONO.test(f.family))
    roles.mono = m?.family ?? null
  }
  if (!roles.mono) {
    const ff = static_.fontFaces.find((f) => COMMON_MONO.test(f.family))
    if (ff) roles.mono = ff.family
  }
  if (!roles.display && static_.fontFaces.length) {
    const d = static_.fontFaces.find((f) => COMMON_DISPLAY.test(f.family))
    roles.display = d?.family ?? static_.fontFaces[0].family
  }
  return roles
}

function pickBackground(static_: StaticAnalysis, rendered: RenderedAnalysis): string {
  const tokens = static_.tokens
  const fromToken = tokens['--color-ground'] ?? tokens['--background'] ?? tokens['--color-bg']
  if (fromToken) return cleanHex(fromToken)
  if (rendered.bodyBg && rendered.bodyBg !== 'rgba(0, 0, 0, 0)') return rendered.bodyBg
  if (static_.themeColor) return cleanHex(static_.themeColor)
  return '#000000'
}

function cleanHex(s: string): string {
  const m = s.match(/#[0-9a-fA-F]{3,8}/)
  return m ? m[0] : s
}

function mapSection(sec: Section, rendered: RenderedAnalysis): ComponentSpec {
  const blocks = sec.blocks
  const headline = headlineOf(blocks)
  const headlineBlock = largestHeadline(blocks)
  const bodies = blocks.filter((b) => b !== headlineBlock && b.fontSize < 24 && b.text.length > 24)
  const allText = cleanText(blocks.map((b) => b.text).join(' '))

  const hasVideo = rendered.videos.some((v) => Math.abs(v.width / 2 - (sec.y + sec.h / 2)) < 400)
  const hasCA = rendered.contractAddresses.some((ca) => allText.includes(ca))
  const isMonoList = blocks.filter((b) => /mono/i.test(b.fontFamily)).length >= blocks.length * 0.5 && blocks.length >= 3
  const isFaq = blocks.length >= 4 && blocks.every((b) => b.fontSize <= 30) && blocks.length % 2 === 0
  const isLast = sec.index === rendered.sections.length - 1
  const isFirst = sec.index === 0

  let type: ComponentSpec['type'] = 'Custom'
  if (isFirst) type = 'Hero'
  else if (hasCA) type = 'TokenBar'
  else if (isLast && blocks.every((b) => b.fontSize < 18)) type = 'Footer'
  else if (hasVideo && headline) type = 'Video'
  else if (isMonoList) type = 'LogoStrip'
  else if (isFaq) type = 'FAQ'
  else if (headline && /([„"'])|quote|“/i.test(allText)) type = 'Quote'
  else if (headline && blocks.some((b) => /^\d|^[\d.,$%]/.test(b.text) && b.fontSize >= 24)) type = 'Stats'
  else if (headline && bodies.length >= 2) type = 'Cards'
  else if (headline) type = 'Custom'

  const items =
    type === 'Cards' || type === 'FAQ'
      ? extractItems(blocks)
      : undefined

  return {
    type,
    index: sec.index,
    blocks,
    headline,
    body: bodies.map((b) => b.text),
    items,
    media: hasVideo ? rendered.videos.filter((v) => Math.abs(v.width / 2 - (sec.y + sec.h / 2)) < 400).map((v) => v.src) : undefined,
    bg: sec.bg,
    align: sec.align,
    textColor: sec.textColor,
  }
}

function largestHeadline(blocks: TextBlock[]): TextBlock | undefined {
  if (!blocks.length) return undefined
  return blocks.reduce((a, b) => (b.fontSize > a.fontSize ? b : a))
}

function headlineOf(blocks: TextBlock[]): string | undefined {
  const max = Math.max(...blocks.map((b) => b.fontSize))
  if (max < 28) return undefined
  const words = blocks
    .filter((b) => b.fontSize >= max * 0.55)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((b) => b.text.trim())
  return words.join(' ').trim() || undefined
}

function extractItems(blocks: TextBlock[]): { title: string; body: string }[] {
  const items: { title: string; body: string }[] = []
  let cur: TextBlock | null = null
  for (const b of blocks) {
    if (b.fontSize >= 24) {
      if (cur && cur.body) items.push(cur)
      cur = { title: b.text, body: '' }
    } else if (cur && b.text.length > 20) {
      cur.body = (cur.body ? cur.body + ' ' : '') + b.text
    }
  }
  if (cur && cur.body) items.push(cur)
  return items
}
