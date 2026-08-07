export function parseCSS(css: string): Map<string, string> {
  const rules = new Map<string, string>()
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const selector = m[1].replace(/\s+/g, ' ').trim()
    rules.set(selector, m[2])
  }
  return rules
}

export function parseRootTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  const rules = parseCSS(css)
  for (const [selector, body] of rules) {
    if (!/:root|^\*$|^html$/.test(selector)) continue
    const re = /(--[\w-]+)\s*:\s*([^;]+);/g
    let m: RegExpExecArray | null
    while ((m = re.exec(body))) tokens[m[1]] = m[2].trim()
  }
  return tokens
}

export function parseFontFaces(css: string): { family: string; url?: string; weight?: string; style?: string }[] {
  const out: { family: string; url?: string; weight?: string; style?: string }[] = []
  const re = /@font-face\s*\{([^{}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const body = m[1]
    const family = /font-family\s*:\s*["']?([^;"']+)["']?\s*;/.exec(body)?.[1]?.trim()
    const url = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(body)?.[1]
    const weight = /font-weight\s*:\s*([^;]+);/.exec(body)?.[1]?.trim()
    const style = /font-style\s*:\s*([^;]+);/.exec(body)?.[1]?.trim()
    if (family) out.push({ family, url, weight, style })
  }
  return out
}

export function parseKeyframes(css: string): { name: string; blocks: string[] }[] {
  const out: { name: string; blocks: string[] }[] = []
  const re = /@keyframes\s+([\w-]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const blocks = [...m[2].matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((b) => `${b[1].trim()} { ${b[2].trim()} }`)
    out.push({ name: m[1], blocks })
  }
  return out
}

export const PUMP_CA_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g

export const SOCIAL_DOMAINS: [RegExp, string][] = [
  [/x\.com|twitter\.com/i, 'x'],
  [/t\.me|telegram\.org|telegram\.me/i, 'telegram'],
  [/discord(\.gg|\.com)/i, 'discord'],
  [/github\.com/i, 'github'],
  [/dexscreener\.com/i, 'dexscreener'],
  [/birdeye\.so/i, 'birdeye'],
  [/pump\.fun/i, 'pumpfun'],
  [/raydium\.io/i, 'raydium'],
  [/jup(iter)?\.ag/i, 'jupiter'],
]

export function detectSocial(href: string): string | null {
  for (const [re, label] of SOCIAL_DOMAINS) if (re.test(href)) return label
  return null
}

export function isContractAddress(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && s.length >= 32
}

export async function fetchText(url: string, timeoutMs = 30000): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

export function absoluteUrl(base: string, ref: string): string {
  try {
    return new URL(ref, base).href
  } catch {
    return ref
  }
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site'
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export function isDark(background: string): boolean {
  const m = background.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (m) {
    const l = 0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])
    return l < 128
  }
  const h = background.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/)
  if (h) {
    const hex = h[1].length === 3 ? h[1].split('').map((c) => c + c).join('') : h[1]
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return 0.299 * r + 0.587 * g + 0.114 * b < 128
  }
  return true
}
