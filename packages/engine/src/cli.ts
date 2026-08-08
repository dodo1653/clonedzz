import { mkdtempSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { analyzeUrl } from './index.ts'
import { generateProject } from './generate.ts'
import { verifyReplica } from './verify.ts'
import type { TokenSiteData } from './types.ts'

const args = process.argv.slice(2)
const url = args[0]
const opt = (flag: string) => {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}
const has = (flag: string) => args.includes(flag)

if (!url) {
  console.error('usage: node cli.ts <url> [--name <name>] [--out <dir>] [--token-name <n> --token-ticker <t> --token-ca <ca>] [--gates] [--verify]')
  process.exit(1)
}

const name = opt('--name')
const out = opt('--out')
const verify = has('--verify')
const removeGates = has('--gates')

console.log(`\nCLONEDZZ — analyzing ${url}\n`)
const recipe = await analyzeUrl(url, name)

console.log(`NAME:        ${recipe.name}`)
console.log(`TITLE:       ${recipe.title}`)
console.log(`BACKGROUND:  ${recipe.background}`)
console.log(`FONTS:       display=${recipe.fonts.display} | body=${recipe.fonts.body} | mono=${recipe.fonts.mono}`)
console.log(`CANVAS:      ${recipe.canvas ? 'yes (stars=' + (recipe.canvas.algorithm?.stars ?? '?') + ')' : 'no'}`)
console.log(`REVEAL:      ${recipe.reveal?.scrollReveal ? `yes (${recipe.reveal.heroWords} hero words, settle ${recipe.reveal.heroSettleMs}ms)` : 'no'}`)
console.log(`CONTRACT:    ${recipe.contractAddresses[0] ?? 'none'}`)
console.log(`SOCIALS:     ${recipe.socials.map((s) => s.label).join(', ') || 'none'}`)
console.log(`\nSECTIONS (${recipe.components.length}):`)
for (const c of recipe.components) {
  console.log(`  ${c.index + 1}. ${c.type.padEnd(10)} ${(c.headline ?? '').slice(0, 60)}`)
}
console.log(`\nNOTES:`)
for (const n of recipe.notes) console.log(`  - ${n}`)

if (out) {
  const token: TokenSiteData | null =
    opt('--token-ca')
      ? {
          name: opt('--token-name') ?? recipe.name,
          ticker: opt('--token-ticker') ?? recipe.name.slice(0, 4).toUpperCase(),
          ca: opt('--token-ca')!,
        }
      : null

  console.log(`\nGenerating into ${out}${token ? ' (with token data)' : ''}...`)
  const result = await generateProject({
    targetDir: out,
    name: name ?? recipe.name,
    recipe,
    token,
    removeGates,
  })
  console.log(`Generated ${result.files.length} files in ${result.dir}`)
  for (const w of result.warnings) console.log(`  note: ${w}`)

  if (verify) {
    if (!existsSync(join(result.dir, 'node_modules'))) {
      console.log('Installing dependencies...')
      await run('npm', ['install', '--no-audit', '--no-fund'], result.dir)
    }
    console.log('\nVerifying...')
    const report = await verifyReplica({ sourceUrl: url, replicaDir: result.dir })
    console.log(`\nFIDELITY SCORE: ${report.score}%`)
    for (const m of report.metrics) {
      console.log(`  ${m.pass ? '✓' : '✗'} ${m.label.padEnd(24)} ${m.note ?? ''}`)
    }
  }
}

if (has('--dump')) {
  const tmp = join(mkdtempSync(join(tmpdir(), 'cf-')), 'recipe.json')
  writeFileSync(tmp, JSON.stringify(recipe, null, 2))
  console.log(`\nRecipe dumped to ${tmp}`)
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
    child.on('error', reject)
  })
}
