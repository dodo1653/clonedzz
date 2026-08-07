import type { StaticAnalysis } from './types.ts' 
import { absoluteUrl, fetchText, parseFontFaces, parseKeyframes, parseRootTokens } from './util.ts' 

export async function staticAnalysis(url: string): Promise<StaticAnalysis> {
  const html = await fetchText(url)
  const base = url

  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null
  const themeColor =
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i.exec(html)?.[1] ??
    null
  const favicon =
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i.exec(html)?.[1] ??
    null

  const cssFiles: string[] = []
  for (const m of html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)) {
    const href = /href=["']([^"']+)["']/i.exec(m[0])?.[1]
    if (href && !href.startsWith('data:')) cssFiles.push(absoluteUrl(base, href))
  }
  for (const m of html.matchAll(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    cssFiles.push(absoluteUrl(base, m[1]))
  }

  const tokens: Record<string, string> = {}
  const fontFaces: { family: string; url?: string; weight?: string; style?: string }[] = []
  const keyframes: { name: string; blocks: string[] }[] = []
  let bodyBg: string | null = null

  for (const inline of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = inline[1]
    Object.assign(tokens, parseRootTokens(css))
    fontFaces.push(...parseFontFaces(css))
    keyframes.push(...parseKeyframes(css))
  }

  for (const file of cssFiles.slice(0, 12)) {
    try {
      const css = await fetchText(file, 15000)
      Object.assign(tokens, parseRootTokens(css))
      fontFaces.push(...parseFontFaces(css))
      keyframes.push(...parseKeyframes(css))
      const bgb = parseRootTokens(css)['--color-ground']
      if (bgb) bodyBg = bgb
    } catch {
      // ignore unreadable css
    }
  }

  const framework = /__next|next\/dynamic|_next\/static/i.test(html)
    ? 'Next.js'
    : /data-reactroot|__react|react-dom/i.test(html)
      ? 'React'
      : /<nuxt|nuxt\/|__nuxt/i.test(html)
        ? 'Nuxt/Vue'
        : /ng-version=/i.test(html)
          ? 'Angular'
          : 'static/unknown'

  return {
    url,
    title,
    themeColor,
    favicon: favicon ? absoluteUrl(base, favicon) : null,
    framework,
    cssFiles,
    tokens,
    fontFaces,
    keyframes,
    bodyBg,
  }
}
