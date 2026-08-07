export interface TokenSet {
  [k: string]: string
}

export interface FontFace {
  family: string
  url?: string
  weight?: string
  style?: string
}

export interface Keyframe {
  name: string
  blocks: string[]
}

export interface StaticAnalysis {
  url: string
  title: string | null
  themeColor: string | null
  favicon: string | null
  framework: string | null
  cssFiles: string[]
  tokens: TokenSet
  fontFaces: FontFace[]
  keyframes: Keyframe[]
  bodyBg: string | null
}

export interface TextBlock {
  text: string
  tag: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  color: string
  letterSpacing: string
  lineHeight: string
  x: number
  y: number
  w: number
  h: number
  align: string
  maxWidth: number
  cls: string
  href?: string
  bg?: string
}

export interface Section {
  index: number
  y: number
  h: number
  blocks: TextBlock[]
  bg?: string
  align?: string
  textColor?: string
}

export interface VideoInfo {
  src: string
  width: number
  height: number
  autoplay: boolean
  muted: boolean
  loop: boolean
  playsInline: boolean
  lazy: boolean
  objectFit: string | null
}

export interface NebulaStop {
  x: number
  y: number
  r: number
  rgb: string
  a: number
}

export interface CanvasAlgorithm {
  stars?: number
  minR?: number
  maxR?: number
  minA?: number
  maxA?: number
  nebula?: NebulaStop[]
  meteor?: boolean
  vxMin?: number
  vxMax?: number
  vyMin?: number
  vyMax?: number
}

export interface CanvasInfo {
  present: boolean
  w: number
  h: number
  zIndex: string
  position: string
  algorithm: CanvasAlgorithm | null
  diffPer400ms: number | null
  samples: { fx: number; fy: number; rgb: [number, number, number]; litPct: number }[]
}

export interface NavLink {
  text: string
  href: string
  cls: string
}

export interface NavInfo {
  present: boolean
  position: string
  top: string
  zIndex: string
  background: string
  backdropFilter: string
  paddingX: string
  height: number
  logo: { glass: boolean; hasSvg: boolean; svg: string | null; w: number; h: number } | null
  links: NavLink[]
  buttons: NavLink[]
}

export interface RevealInfo {
  heroWords: number
  heroStaggerMs: number
  heroSettleMs: number
  heroY: number
  sectionY: number
  labelY: number
  scrollReveal: boolean
  samples: number[][]
}

export interface ScrollableInfo {
  cls: string
  overflow: string
  scrollbarColor: string
  scrollbarWidth: string
}

export interface RenderedAnalysis {
  url: string
  viewport: { w: number; h: number }
  scrollHeight: number
  bodyBg: string
  fontsUsed: { family: string; count: number; sizes: number[]; role: string }[]
  nav: NavInfo | null
  sections: Section[]
  videos: VideoInfo[]
  images: string[]
  canvases: CanvasInfo[]
  fixedLayers: { tag: string; cls: string; z: string; w: number; h: number; bf: string }[]
  buttons: { text: string; href: string; cls: string }[]
  links: { text: string; href: string }[]
  scrollables: ScrollableInfo[]
  glass: { count: number; blurs: string[]; cls: string[] }
  reveal: RevealInfo | null
  contractAddresses: string[]
  socials: { label: string; href: string }[]
  bodyHtml: string
  rawCss: string
  scripts: { src: string; type: string }[]
  pageHtml: string
}

export type ComponentType =
  | 'Nav'
  | 'Hero'
  | 'LogoStrip'
  | 'Cards'
  | 'Quote'
  | 'Video'
  | 'Stats'
  | 'FAQ'
  | 'TokenBar'
  | 'Footer'
  | 'Gallery'
  | 'Custom'

export interface ComponentSpec {
  type: ComponentType
  index: number
  blocks: TextBlock[]
  headline?: string
  body?: string[]
  media?: string[]
  items?: { title: string; body: string }[]
  links?: NavLink[]
  delay?: number
  bg?: string
  align?: string
  textColor?: string
}

export interface FontRoles {
  display: string | null
  body: string | null
  mono: string | null
}

export interface Recipe {
  name: string
  sourceUrl: string
  title: string
  themeColor: string | null
  favicon: string | null
  background: string
  tokens: TokenSet
  fonts: FontRoles
  nav: NavInfo | null
  heroItalic: boolean
  components: ComponentSpec[]
  keyframes: Keyframe[]
  canvas: CanvasInfo | null
  reveal: RevealInfo | null
  images: string[]
  contractAddresses: string[]
  socials: { label: string; href: string }[]
  notes: string[]
  bodyHtml?: string
  rawCss?: string
  staticMode?: boolean
  pageHtml?: string
}

export interface TokenSiteData {
  name: string
  ticker: string
  ca: string
  image?: string
  x?: string
  telegram?: string
  community?: string
  description?: string
  themeName?: string
}

export interface GenerateOptions {
  targetDir: string
  name: string
  recipe: Recipe
  token?: TokenSiteData | null
  hotlinkMedia?: boolean
}

export interface GenerateResult {
  dir: string
  files: string[]
  warnings: string[]
}

export interface FidelityMetric {
  key: string
  label: string
  source: string | number
  replica: string | number
  pass: boolean
  note?: string
}

export interface VerifyReport {
  url: string
  replicaDir: string
  score: number
  metrics: FidelityMetric[]
}
