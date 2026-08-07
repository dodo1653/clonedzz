import type { FontRoles, NavInfo, Recipe, RevealInfo, TokenSiteData } from './types.ts'
import { escapeHtml } from './util.ts'

export function jsString(s: string): string {
  return JSON.stringify(s ?? '')
}

export function jsStringList(arr: string[]): string {
  return `[${arr.map((s) => jsString(s)).join(', ')}]`
}

export function googleFontsUrl(family: string): string | null {
  const name = (family || '').trim()
  if (!name) return null
  if (/fallback|system-ui|ui-|Arial|Helvetica|sans-serif|Georgia|Times|serif$|monospace|emoji/i.test(name)) return null
  const italic = /serif|instrument/i.test(name)
  return `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}${italic ? ':ital,wght@0,400;1,400' : ''}&display=swap`
}

export function fontStack(fam: string | null, kind: 'display' | 'body' | 'mono'): string {
  const base = fam || (kind === 'mono' ? 'ui-monospace' : kind === 'display' ? 'Georgia' : 'system-ui')
  if (kind === 'mono') return `${base}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  if (kind === 'display') return `${base}, Georgia, serif`
  return `${base}, system-ui, -apple-system, sans-serif`
}

export function packageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: {
        'framer-motion': '^12.6.0',
        'lucide-react': '^0.487.0',
        react: '^19.1.0',
        'react-dom': '^19.1.0',
        'react-router-dom': '^7.5.0',
      },
      devDependencies: {
        '@tailwindcss/vite': '^4.1.0',
        '@types/react': '^19.1.0',
        '@types/react-dom': '^19.1.0',
        '@vitejs/plugin-react': '^4.4.0',
        tailwindcss: '^4.1.0',
        typescript: '^5.8.0',
        vite: '^6.3.0',
      },
    },
    null,
    2,
  )
}

export function viteConfig(): string {
  return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
`
}

export function tsconfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["src", "vite.config.ts"]
}
`
}

export function viteEnvDts(): string {
  return `/// <reference types="vite/client" />
`
}

export function mainTsx(): string {
  return `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
`
}

export function verbatimMainTsx(withSourceCss: boolean): string {
  const src = withSourceCss ? `import './source.css'\n` : ''
  return `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
${src}import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`
}

export function verbatimAppTsx(): string {
  return `import Verbatim from './components/Verbatim'

export default function App() {
  return <Verbatim />
}
`
}

export function verbatimTsx(hasCanvas: boolean): string {
  const canvas = hasCanvas ? `      <ParticleField />\n` : ''
  return `${hasCanvas ? "import ParticleField from './ParticleField'\n" : ''}import { SOURCE_HTML } from '../source.html'

export default function Verbatim() {
  return (
    <main className="relative min-h-screen">
${canvas}      <div className="relative z-10" dangerouslySetInnerHTML={{ __html: SOURCE_HTML }} />
    </main>
  )
}
`
}

export function appTsx(hasNav: boolean, hasCanvas: boolean, dark = true): string {
  const nav = hasNav ? `      <Nav />\n` : ''
  const canvas = hasCanvas ? `      <ParticleField />\n` : ''
  const rootCls = dark ? 'bg-black' : 'on-light bg-[var(--color-ground)]'
  return `import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
${hasNav ? "import Nav from './components/Nav'\n" : ''}${hasCanvas ? "import ParticleField from './components/ParticleField'\n" : ''}

export default function App() {
  return (
    <main className="${rootCls} relative min-h-screen">
${canvas}${nav}      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </main>
  )
}
`
}

export function indexHtml(recipe: Recipe, fonts: FontRoles): string {
  const fontUrls = new Set<string>()
  for (const f of [fonts.display, fonts.body, fonts.mono]) {
    const u = googleFontsUrl(f ?? '')
    if (u) fontUrls.add(u)
  }
  const links = [...fontUrls].map((u) => `    <link rel="preconnect" href="https://fonts.googleapis.com" />\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link rel="stylesheet" href="${u}" />`).join('\n')
  const theme = recipe.themeColor ?? recipe.background
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="${escapeHtml(theme)}" />
    <title>${escapeHtml(recipe.title)}</title>
${links ? `${links}\n` : ''}  </head>
  <body style="background: ${escapeHtml(recipe.background)}">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
}

export function cssTokens(recipe: Recipe, fonts: FontRoles): string {
  const t = recipe.tokens
  const colorVars = Object.entries(t)
    .filter(([k, v]) => /^--color|^--background|^--accent/i.test(k) && /#[0-9a-fA-F]{3,8}|rgba?\(/i.test(v))
    .slice(0, 12)
  const lines = colorVars.map(([k, v]) => `  ${k}: ${v};`).join('\n')
  return `:root {
  --color-ground: ${recipe.background};
  --font-heading: ${fontStack(fonts.display, 'display')};
  --font-body: ${fontStack(fonts.body, 'body')};
  --font-mono: ${fontStack(fonts.mono, 'mono')};
${lines ? `${lines}\n` : ''}  color-scheme: dark;
}
`
}

export function cssUtilities(recipe: Recipe): string {
  const keyframes = recipe.keyframes
    .slice(0, 6)
    .map((k) => `@keyframes ${k.name} {\n${k.blocks.map((b) => `  ${b}`).join('\n')}\n}`)
    .join('\n\n')
  const revealExtra =
    recipe.reveal?.scrollReveal
      ? `.reveal,
.stagger-word {
  opacity: 0;
  transform: translateY(var(--ry, 50px));
  transition:
    opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.is-in,
.stagger-word.is-in {
  opacity: 1;
  transform: none;
}
.stagger-word {
  display: block;
}`
      : ''
  return `html {
  scroll-behavior: smooth;
}

body {
  background: var(--color-ground);
  color: #fff;
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.font-heading { font-family: var(--font-heading); }
.font-body { font-family: var(--font-body); }
.font-mono { font-family: var(--font-mono); }

.display {
  font-family: var(--font-heading);
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 0.8;
}
.mono-label {
  font-family: var(--font-mono);
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.02em;
  margin-bottom: 16px;
}
.section-wrap {
  margin: 0 auto;
  width: 100%;
  max-width: 1200px;
  padding: clamp(64px, 10vw, 120px) clamp(20px, 4vw, 48px);
}

.pill { border-radius: 999px; }
.btn-glass {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}
.btn-white {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  border-radius: 999px;
  background: #fff;
  color: #000;
  padding: 10px 16px;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
}
.btn-text {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.liquid-glass {
  background-blend-mode: luminosity;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  background: #ffffff03;
  border: none;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 1px 1px #ffffff1a;
}
.liquid-glass:before {
  content: "";
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(#ffffff73 0%, #ffffff26 20%, #fff0 40% 60%, #ffffff26 80%, #ffffff73 100%);
  padding: 1.4px;
  position: absolute;
  inset: 0;
  -webkit-mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
  mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
  -webkit-mask-position: 0 0, 0 0;
  mask-position: 0 0, 0 0;
  -webkit-mask-size: auto, auto;
  mask-size: auto, auto;
  -webkit-mask-repeat: repeat, repeat;
  mask-repeat: repeat, repeat;
  -webkit-mask-clip: content-box, border-box;
  mask-clip: content-box, border-box;
  -webkit-mask-origin: content-box, border-box;
  mask-origin: content-box, border-box;
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
.liquid-glass-strong {
  background-blend-mode: luminosity;
  -webkit-backdrop-filter: blur(50px);
  backdrop-filter: blur(50px);
  background: #ffffff03;
  border: none;
  position: relative;
  overflow: hidden;
  box-shadow: 4px 4px 4px #0000000d, inset 0 1px 1px #ffffff26;
}
.liquid-glass-strong:before {
  content: "";
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(#ffffff80 0%, #fff3 20%, #fff0 40% 60%, #fff3 80%, #ffffff80 100%);
  padding: 1.4px;
  position: absolute;
  inset: 0;
  -webkit-mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
  mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
  -webkit-mask-position: 0 0, 0 0;
  mask-position: 0 0, 0 0;
  -webkit-mask-size: auto, auto;
  mask-size: auto, auto;
  -webkit-mask-repeat: repeat, repeat;
  mask-repeat: repeat, repeat;
  -webkit-mask-clip: content-box, border-box;
  mask-clip: content-box, border-box;
  -webkit-mask-origin: content-box, border-box;
  mask-origin: content-box, border-box;
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.glass-card { border-radius: 1.25rem; padding: 28px; }
.card-title {
  font-family: var(--font-heading);
  font-size: 30px;
  line-height: 1.05;
  color: #fff;
}
.card-body {
  font-family: var(--font-body);
  font-size: 15px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

.scroll-x {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: #ffffff2e transparent;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
}
.scroll-x::-webkit-scrollbar { height: 6px; }
.scroll-x::-webkit-scrollbar-thumb { background: #ffffff2e; border-radius: 3px; }

.stat-num {
  font-family: var(--font-heading);
  font-style: italic;
  line-height: 1;
  letter-spacing: -1px;
  color: #fff;
}
.stat-sub {
  font-family: var(--font-body);
  font-weight: 300;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.video-frame { border-radius: 1.25rem; overflow: hidden; }
.video-frame video { width: 100%; height: auto; display: block; }

.faq-item { border-top: 1px solid rgba(255, 255, 255, 0.12); }
.faq-item:last-child { border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
.faq-q {
  width: 100%;
  text-align: left;
  padding: 22px 4px;
  font-family: var(--font-heading);
  font-size: 24px;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  background: none;
  border: none;
}
.faq-a {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.75);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.55;
}

.quote {
  border-left: 2px solid rgba(255, 255, 255, 0.4);
  padding-left: 20px;
  font-family: var(--font-body);
  font-size: 15px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

::selection {
  background: var(--color-accent, #4dd8e8);
  color: #000;
}

${revealExtra}
${keyframes ? `\n${keyframes}\n` : ''}
`
}

export function lightOverrides(): string {
  return `
/* light-background adaptation */
.on-light body,
.on-light {
  color: #16181d;
}
.on-light h1,
.on-light h2,
.on-light h3,
.on-light .display,
.on-light .card-title,
.on-light .quote,
.on-light .stat-num,
.on-light .faq-q {
  color: #101318;
}
.on-light p,
.on-light .card-body,
.on-light .faq-a,
.on-light .stat-sub {
  color: rgba(16, 19, 24, 0.82);
}
.on-light .mono-label {
  color: rgba(16, 19, 24, 0.55);
}
.on-light .btn-text {
  color: #101318;
}
.on-light .btn-text:hover {
  color: #0b0d12;
}
.on-light .glass-card,
.on-light .liquid-glass {
  border-color: rgba(0, 0, 0, 0.12);
}
`
}

export function revealTsx(reveal: RevealInfo | null): string {
  if (!reveal?.scrollReveal) {
    return `export function Reveal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
export function StaggerText({ text }: { text: string }) {
  return <>{text}</>
}
`
  }
  return `import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true)
            io.disconnect()
          }
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return { ref, inView }
}

export function Reveal({
  children,
  y = ${reveal.sectionY ?? 50},
  delay = 0,
  className = '',
  style,
}: {
  children: ReactNode
  y?: number
  delay?: number
  className?: string
  style?: CSSProperties
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={\`reveal\${inView ? ' is-in' : ''} \${className}\`}
      style={{ '--ry': \`\${y}px\`, transitionDelay: delay ? \`\${delay}ms\` : undefined, ...style } as CSSProperties}
    >
      {children}
    </div>
  )
}

export function StaggerText({
  text,
  className = '',
  y = ${reveal.heroY ?? 50},
  stagger = ${reveal.heroStaggerMs ?? 120},
  style,
}: {
  text: string
  className?: string
  y?: number
  stagger?: number
  style?: CSSProperties
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={className} style={style}>
      {text.split(' ').map((w, i) => (
        <span
          key={\`\${w}-\${i}\`}
          className={\`stagger-word\${inView ? ' is-in' : ''}\`}
          style={{ '--ry': \`\${y}px\`, transitionDelay: \`\${i * stagger}ms\` } as CSSProperties}
        >
          {w}
        </span>
      ))}
    </div>
  )
}
`
}

export function particleFieldTsx(recipe: Recipe): string {
  const algo = recipe.canvas?.algorithm
  const stars = algo?.stars ?? 150
  const minR = algo?.minR ?? 0.4
  const maxR = algo?.maxR ?? 1.5
  const minA = algo?.minA ?? 0.12
  const maxA = algo?.maxA ?? 0.65
  const vxMin = algo?.vxMin ?? -0.004
  const vxMax = algo?.vxMax ?? -0.001
  const vyMin = algo?.vyMin ?? 0.0008
  const vyMax = algo?.vyMax ?? 0.003
  const meteor = algo?.meteor ?? true
  const nebula = algo?.nebula?.length
    ? algo.nebula
    : [
        { x: 0.18, y: 0.32, r: 0.55, rgb: '255,255,255', a: 0.05 },
        { x: 0.82, y: 0.68, r: 0.6, rgb: '77,216,232', a: 0.035 },
        { x: 0.55, y: 0.12, r: 0.45, rgb: '255,77,94', a: 0.02 },
      ]

  return `import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  a: number
  tw: number
  ph: number
  vx: number
  vy: number
}

interface Blob {
  x: number
  y: number
  r: number
  rgb: string
  a: number
  s: number
  p: number
}

export default function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let raf = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const rand = (min: number, max: number) => min + Math.random() * (max - min)

    const stars: Star[] = Array.from({ length: ${stars} }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: rand(${minR}, ${maxR}),
      a: rand(${minA}, ${maxA}),
      tw: rand(0.4, 1.8),
      ph: rand(0, Math.PI * 2),
      vx: rand(${vxMin}, ${vxMax}),
      vy: rand(${vyMin}, ${vyMax}),
    }))

    const blobs: Blob[] = ${JSON.stringify(
      nebula.map((n) => ({ ...n, s: 0.05, p: 0.5 })),
    ).replace(/"([a-z])":/g, '$1:')}

    let meteor: { x: number; y: number; vx: number; vy: number; life: number } | null = null
    let nextMeteorAt = 5
    let lastT: number | null = null

    const tick = (t: number) => {
      const sec = t / 1000
      const dt = lastT === null ? 0 : Math.min(sec - lastT, 0.05)
      lastT = sec

      ctx.clearRect(0, 0, w, h)

      for (const b of blobs) {
        const bx = (b.x + 0.07 * Math.sin(sec * b.s + b.p)) * w
        const by = (b.y + 0.07 * Math.cos(sec * b.s * 0.8 + b.p)) * h
        const br = b.r * Math.max(w, h) * 0.7
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br)
        g.addColorStop(0, \`rgba(\${b.rgb},\${b.a})\`)
        g.addColorStop(1, \`rgba(\${b.rgb},0)\`)
        ctx.fillStyle = g
        ctx.fillRect(bx - br, by - br, br * 2, br * 2)
      }

      ctx.fillStyle = '#fff'
      for (const s of stars) {
        if (!reduce) {
          s.x += s.vx * dt
          s.y += s.vy * dt
          if (s.x < -0.02) s.x = 1.02
          if (s.y > 1.02) s.y = -0.02
        }
        const twinkle = 0.55 + 0.45 * Math.sin(sec * s.tw + s.ph)
        ctx.globalAlpha = s.a * twinkle
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (!reduce && ${meteor}) {
        if (!meteor && sec > nextMeteorAt) {
          meteor = {
            x: rand(0.25, 0.95) * w,
            y: rand(0.05, 0.3) * h,
            vx: rand(-520, -320),
            vy: rand(140, 230),
            life: 0,
          }
        }
        if (meteor) {
          meteor.life += dt
          const mx = meteor.x + meteor.vx * meteor.life
          const my = meteor.y + meteor.vy * meteor.life
          const fade = meteor.life < 0.25 ? meteor.life / 0.25 : meteor.life > 1.1 ? Math.max(0, 1 - (meteor.life - 1.1) / 0.4) : 1
          const tx = mx - 0.22 * meteor.vx
          const ty = my - 0.22 * meteor.vy
          const trail = ctx.createLinearGradient(mx, my, tx, ty)
          trail.addColorStop(0, \`rgba(255,255,255,\${0.75 * fade})\`)
          trail.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.strokeStyle = trail
          ctx.lineWidth = 1.5
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(mx, my)
          ctx.lineTo(tx, ty)
          ctx.stroke()
          ctx.globalAlpha = 0.9 * fade
          ctx.beginPath()
          ctx.arc(mx, my, 1.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
          if (meteor.life > 1.5 || mx < -100 || my > h + 100) {
            meteor = null
            nextMeteorAt = sec + rand(6, 13)
          }
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0 h-full w-full" aria-hidden="true" />
}
`
}

function toJsxSvg(svg: string): string {
  return svg
    .replace(/\bclass=/g, 'className=')
    .replace(/\bstroke-width=/g, 'strokeWidth=')
    .replace(/\bstroke-linecap=/g, 'strokeLinecap=')
    .replace(/\bstroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/\bfill-opacity=/g, 'fillOpacity=')
    .replace(/\bstroke-opacity=/g, 'strokeOpacity=')
    .replace(/stroke="currentColor"/g, 'stroke="currentColor"')
}

export function navTsx(nav: NavInfo | null, hasNav: boolean): string {
  if (!hasNav || !nav) {
    return `export default function Nav() {
  return null
}
`
  }
  const logoSvg = toJsxSvg(
    nav.logo?.svg ??
      `<svg class="h-6 w-6" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="32" cy="32" r="30" stroke-width="2.5" />
      <circle cx="33.59" cy="33.59" r="23.25" stroke-width="1.9" />
      <circle cx="35.18" cy="35.18" r="17.5" stroke-width="1.7" />
      <circle cx="36.95" cy="36.95" r="12.5" stroke-width="1.5" />
      <circle cx="38.72" cy="38.72" r="8" stroke-width="1.3" />
      <circle cx="41.02" cy="41.02" r="3.25" fill="currentColor" stroke="none" />
    </svg>`,
  )
  const logo = nav.logo
    ? `<a href="#top" className="liquid-glass flex items-center justify-center rounded-full text-white" style={{ width: ${nav.logo.w || 48}, height: ${nav.logo.h || 48} }}>
          ${logoSvg}
        </a>`
    : ''
  const links = nav.links
    .map((l) => `<a key={${jsString(l.text)}} href={${jsString(l.href)}} className="px-3 py-2 font-body text-sm font-medium text-white/90 transition-colors hover:text-[#4dd8e8]">
            {${jsString(l.text)}}
          </a>`)
    .join('\n            ')
  const buttons = nav.buttons
    .map((b, i) =>
      i % 2 === 0
        ? `<a href={${jsString(b.href)}} className="flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-4 py-2.5 font-body text-sm font-medium text-black">
              {${jsString(b.text)}}
            </a>`
        : `<a href={${jsString(b.href)}} className="liquid-glass pill btn-glass">
              {${jsString(b.text)}}
            </a>`,
    )
    .join('\n            ')

  return `export default function Nav() {
  return (
    <nav className="fixed left-0 right-0 top-4 z-50 flex items-center justify-between px-5 sm:px-8 lg:px-16">
${logo ? `      ${logo}\n` : ''}      <div className="hidden items-center gap-1 md:flex">
        ${links}
      </div>
      <div className="flex items-center gap-3">
        ${buttons}
      </div>
    </nav>
  )
}
`
}
