export interface Fonts {
  display: string
  body: string
  mono?: string
}

export interface ComponentSpec {
  type: string
  index: number
  headline?: string
  body?: string[]
  sub?: string
  stats?: { value: string; label: string }[]
  items?: { title?: string; text: string }[]
  caption?: string
  speakers?: { name?: string; role?: string; text: string }[]
  links?: string[]
  video?: string
  image?: string
  src?: string
}

export interface Recipe {
  name: string
  title: string
  background: string
  accent: string
  themeColor: string
  fonts: Fonts
  sourceUrl: string
  components: ComponentSpec[]
  notes: string[]
}

export interface TokenSiteData {
  name: string
  ticker: string
  ca: string
  blurb?: string
  buys?: string[]
  sells?: string[]
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
  meta: { sourceUrl: string; createdAt: string }
  summary: { name: string; title: string; background: string; fonts: Fonts; components: { type: string; headline?: string }[] }
}

export interface OutputItem {
  name: string
  title: string
  installed: boolean
  path: string
  sourceUrl: string | null
}
