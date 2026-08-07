import type { CanvasAlgorithm } from './types.ts' 
import { absoluteUrl, fetchText } from './util.ts' 

export async function extractCanvasFromJs(html: string, baseUrl: string): Promise<CanvasAlgorithm | null> {
  const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1])
  const urls = scriptSrcs.map((s) => absoluteUrl(baseUrl, s)).filter((u) => u.startsWith('http'))

  for (const url of urls.slice(0, 30)) {
    let js: string
    try {
      js = await fetchText(url, 15000)
    } catch {
      continue
    }
    const algo = scanChunk(js)
    if (algo) return algo
  }
  return null
}

function scanChunk(js: string): CanvasAlgorithm | null {
  const idx = js.indexOf('getContext("2d")')
  if (idx < 0) return null
  const ctx = js.slice(Math.max(0, idx - 2500), idx + 4500)

  const algo: CanvasAlgorithm = {}

  const stars = ctx.match(/length:(\d+)[,\}]\s*\}\),?\s*\{x:\s*Math\.random\(\)/)
  if (stars) algo.stars = parseInt(stars[1], 10)

  const blobRe = /\{\s*x:([\d.]+),y:([\d.]+),r:([\d.]+),rgb:"([\d,]+)",a:([\d.]+),s:([\d.]+),p:([\d.]+)\}/g
  let m: RegExpExecArray | null
  const nebula: NonNullable<CanvasAlgorithm['nebula']> = []
  while ((m = blobRe.exec(ctx))) {
    nebula.push({ x: +m[1], y: +m[2], r: +m[3], rgb: m[4], a: +m[5] })
  }
  if (nebula.length) algo.nebula = nebula

  const starSize = ctx.match(/r:\s*(?:l\()?([\d.]+)\s*,\s*([\d.]+)\)?/)
  if (starSize) {
    algo.minR = +starSize[1]
    algo.maxR = +starSize[2]
  }
  const alpha = ctx.match(/a:\s*(?:l\()?([\d.]+)\s*,\s*([\d.]+)\)?/)
  if (alpha) {
    algo.minA = +alpha[1]
    algo.maxA = +alpha[2]
  }
  const vx = ctx.match(/vx:\s*l\(([-\d.]+)\s*,\s*([-\d.]+)\)/)
  if (vx) {
    algo.vxMin = +vx[1]
    algo.vxMax = +vx[2]
  }
  const vy = ctx.match(/vy:\s*l\(([\d.]+)\s*,\s*([\d.]+)\)/)
  if (vy) {
    algo.vyMin = +vy[1]
    algo.vyMax = +vy[2]
  }
  algo.meteor = /vx:\s*l\(-5\d\d\s*,-3\d\d\)/.test(ctx) || /createLinearGradient\([^)]*\).*lineWidth\s*=\s*1\.5/s.test(ctx)

  if (algo.stars || algo.nebula?.length) return algo
  return null
}
