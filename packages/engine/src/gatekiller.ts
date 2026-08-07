import { fetchText, absoluteUrl } from './util.ts'

export interface GateFn {
  id: string
  field: string
}

const FN_REG_RE = /([A-Za-z_$][\w$]*)\s*=\s*\w+\(\{method:\s*`POST`\}\)\.handler\(\w+\(`([0-9a-f]{64})`\)\)/g

const FN_ID_RE = /[0-9a-f]{64}/g

const AWAIT_CALL_RE = /\(await\s+([A-Za-z_$][\w$]*)\s*\(/g

const ALIAS_RE = /([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)\)/g

const GATE_FIELD_RE = /\.(isHolder|isMember|isWhitelisted|isVerified|isOwner|hasAccess|isEligible|holds|holding|owns)\b/g

const GATE_ERROR_RE = /access\s+denied|does\s+not\s+hold|doesn'?t\s+hold|login\s+failed|invalid\s+wallet|not\s+authorized|unauthorized|not\s+whitelisted|not\s+eligible|connect\s+wallet|log\s+in\s+to\s+continue/gi

export function detectGateFns(js: string): GateFn[] {
  const out: GateFn[] = []

  const registrations = new Map<string, string>()
  let m: RegExpExecArray | null
  FN_REG_RE.lastIndex = 0
  while ((m = FN_REG_RE.exec(js))) registrations.set(m[1], m[2])

  const aliases = new Map<string, string>()
  ALIAS_RE.lastIndex = 0
  while ((m = ALIAS_RE.exec(js))) {
    if (!registrations.has(m[1]) && (registrations.has(m[3]) || aliases.has(m[3]))) aliases.set(m[1], m[3])
  }

  const resolve = (name: string): string | null => {
    const seen = new Set<string>()
    let cur: string | null = name
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      if (registrations.has(cur)) return registrations.get(cur)!
      cur = aliases.get(cur) ?? null
    }
    return null
  }

  const fieldHits: { field: string; pos: number; varName: string | null }[] = []
  GATE_FIELD_RE.lastIndex = 0
  while ((m = GATE_FIELD_RE.exec(js))) {
    const before = js.slice(Math.max(0, m.index - 120), m.index)
    if (!/await|\)\)|\}|\]/.test(before)) continue
    const call = AWAIT_CALL_RE.exec(before)
    AWAIT_CALL_RE.lastIndex = 0
    fieldHits.push({ field: m[1], pos: m.index, varName: call ? call[1] : null })
  }

  for (const h of fieldHits) {
    const id = h.varName ? resolve(h.varName) : null
    if (id && !out.some((g) => g.id === id)) out.push({ id, field: h.field })
  }

  if (out.length) return out

  const errHits: number[] = []
  GATE_ERROR_RE.lastIndex = 0
  while ((m = GATE_ERROR_RE.exec(js))) errHits.push(m.index)

  const ids: { id: string; pos: number }[] = []
  FN_ID_RE.lastIndex = 0
  while ((m = FN_ID_RE.exec(js))) ids.push({ id: m[0], pos: m.index })
  const nearestId = (pos: number): string | null => {
    let best: { id: string; pos: number } | null = null
    for (const id of ids) {
      if (id.pos < pos && pos - id.pos < 12000 && (!best || id.pos > best.pos)) best = id
    }
    return best?.id ?? null
  }
  for (const ep of errHits) {
    const id = nearestId(ep)
    if (id && !out.some((g) => g.id === id)) out.push({ id, field: 'isHolder' })
  }

  return out
}

export function buildGatekillerScript(gates: GateFn[]): string {
  const map = JSON.stringify(Object.fromEntries(gates.map((g) => [g.id, g.field])))
  return `<script>(function(){var M=${map},O=window.fetch.bind(window);window.fetch=function(u,o){var s=String(u),q=s.indexOf('?');if(q!==-1)s=s.slice(0,q);if(o&&o.method==='POST'&&s.indexOf('/_serverFn/')===0){var id=s.slice('/_serverFn/'.length);if(M[id]){var r={};r[M[id]]=true;return Promise.resolve(new Response(JSON.stringify({result:r}),{status:200,headers:{'content-type':'application/json'}}))}}return O(u,o)}})();</script>`
}

export function injectGatekiller(html: string, script: string): string {
  if (html.includes('<head>')) return html.replace('<head>', '<head>' + script)
  if (/<html[^>]*>/.test(html)) return html.replace(/<html[^>]*>/, '$&' + script)
  return script + html
}

export function extractScriptSrcs(html: string): string[] {
  const out: string[] = []
  const srcRe = /<script\b[^>]*\bsrc=["']([^"']+)["']/gi
  const preloadRe = /<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = srcRe.exec(html))) out.push(m[1])
  while ((m = preloadRe.exec(html))) out.push(m[1])
  return [...new Set(out)]
}

export async function buildGatekiller(
  html: string,
  origin: string,
): Promise<{ script: string; detected: GateFn[] } | null> {
  const srcs = extractScriptSrcs(html)
  const gates: GateFn[] = []
  for (const src of srcs) {
    try {
      const js = await fetchText(absoluteUrl(origin, src), 20000)
      gates.push(...detectGateFns(js))
    } catch {
      // skip unfetchable scripts
    }
  }
  if (!gates.length) return null
  const deduped: GateFn[] = []
  for (const g of gates) if (!deduped.some((d) => d.id === g.id)) deduped.push(g)
  return { script: buildGatekillerScript(deduped), detected: deduped }
}
