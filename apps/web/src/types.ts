export type Theme = 'dark' | 'light' | 'dim' | 'ocean' | 'ember' | 'violet' | 'rose'

export const THEME_ORDER: Theme[] = ['dark', 'light', 'dim', 'ocean', 'ember', 'violet', 'rose']

export function nextTheme(t: Theme): Theme {
  return THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]
}

export interface Fonts {
  display: string
  body: string
  mono?: string
}

export interface NavLink {
  label?: string
  href?: string
}

export interface ComponentSpec {
  type: string
  index: number
  headline?: string
  body?: string[]
  media?: string[]
  items?: { title?: string; body?: string }[]
  links?: NavLink[]
  bg?: string
  align?: string
  textColor?: string
  delay?: number
}

export interface Recipe {
  name: string
  title: string
  background: string
  accent?: string
  themeColor?: string | null
  fonts: Fonts
  sourceUrl: string
  components: ComponentSpec[]
  notes: string[]
  tokens?: Record<string, string>
  favicon?: string | null
  nav?: { position?: string; top?: string; transparent?: boolean; links?: NavLink[] } | null
  images?: string[]
  socials?: { label: string; href: string }[]
}

export interface TokenSiteData {
  name: string
  ticker: string
  ca: string
  blurb?: string
  buys?: string[]
  sells?: string[]
  x?: string
  telegram?: string
  community?: string
}

export interface AnalyzeResponse {
  id: string
  recipe: Recipe
}

export interface GenerateResult {
  dir: string
  files: string[]
  installStarted: boolean
}

export interface VerifyItem {
  key: string
  label: string
  source: string | number
  replica: string | number
  pass: boolean
  note?: string
}

export interface VerifyReport {
  score: number
  metrics: VerifyItem[]
}

export interface PreviewInfo {
  url: string
  port: number
  static?: boolean
  reused?: boolean
}

export interface PreviewStatus {
  port: number
  dir: string
  url: string
  static: boolean
}

export interface ThemeItem {
  name: string
  recipe: Recipe
}

export interface TokenPreset {
  id: string
  data: TokenSiteData
}

export interface SessionItem {
  id: string
  meta: { sourceUrl: string; createdAt: string; name?: string; outputDir?: string | null }
  summary: { name: string; title: string; background: string; fonts: Fonts; components: { type: string; headline?: string }[] }
}

export interface OutputItem {
  name: string
  title: string
  installed: boolean
  path: string
  sourceUrl: string | null
  baked: boolean
  static: boolean
}

export interface PushResult {
  ok: boolean
  repo: string
  branch: string
  commit: string
  url: string
  commitUrl: string
  notes: string[]
}
