# clonedzz

Replicate a website's visual style by URL and get a **runnable Vite + React replica** in one command — automatically. Built as a two-stage pipeline: a Playwright-based analysis engine that extracts a structured *recipe* from a live site, and a generator that scaffolds a complete frontend project from that recipe. A web dashboard wraps it all with a token-site factory, a theme library, and a fidelity verifier.

```
npm install
npm run dev        # server on :4747, web dashboard on :5174
```

The dashboard lets you:
- **Clone by URL** — analyze any site, review the extracted recipe, generate the replica, open a live preview, and run a Playwright fidelity comparison (source vs replica scorecard).
- **Token-site factory** — tick a checkbox, inject a Solana contract address + token content, and generate the replica as a token landing page (CA copy button, pump.fun BUY link, token blurb).
- **Theme library** — save any analyzed site as a theme JSON and re-generate clones from it; session history persists to `library/`.

## Structure

```
packages/engine   Node-native-TS engine (no tsx). CLI: node packages/engine/src/cli.ts <url>
apps/server       Express API (analyze / generate / verify / preview / themes / tokens / sessions)
apps/web          React dashboard (Vite)
library/          themes/, tokens/, sessions/ (JSON, created on first run)
outputs/          generated replicas (each is a standalone npm project)
```

## Engine (packages/engine)

Runs entirely under `node` with native TypeScript type-stripping — do **not** use tsx/ts-node (esbuild injects `__name` into Playwright `page.evaluate` callbacks and breaks them). Relative imports use explicit `.ts` extensions.

Pipeline per site:
1. **Static analysis** — fetch HTML/CSS: title, theme-color, favicon, framework detection, CSS custom-property tokens, `@font-face`/Google-font lists, keyframes.
2. **Rendered analysis** — headless Chromium (1440×900): text blocks with font metrics + geometry + hrefs, **per-block computed color + section background**, section clustering, nav/video/image/canvas/fixed-layer/glass/scrollable detection, contract-address + social extraction, hero stagger + scroll-reveal measurement.
3. **Canvas extraction** — scans downloaded `_next/static/chunks/*.js` for `getContext("2d")` to pull particle algorithms (star counts, radii, velocities, nebula blobs) and regenerate them as a parameterized React `ParticleField`.
4. **Auto-map** — turns the report into a `Recipe` (font roles, background, nav, ordered `ComponentSpec`s: Hero/Cards/Stats/Quote/LogoStrip/Video/FAQ/TokenBar/Footer/Custom). Each section carries its captured **background, text alignment, and text color**, emitted as `.sec-N` rules so the replica's UI rhythm (alternating section backgrounds, centering, text colors) mirrors the source instead of a one-size-fits-all theme.
5. **Generate** — writes the full Vite project (package.json, vite.config, tsconfig, index.html with theme-color + font links, `src/` with components, `data/content.ts`, `lib/reveal.tsx`, `components/ParticleField.tsx`).
6. **Verify** — boots the replica Vite server, snapshots source + replica headlessly, scores 13 fidelity metrics (title, theme-color, body bg, heading size/family/italic, body size/family, nav position/top/transparency, background canvas speed, hero word count).

### CLI

```bash
node packages/engine/src/cli.ts https://example.com                    # analyze + print recipe
node packages/engine/src/cli.ts <url> --out dir --name my-clone        # generate a replica
node packages/engine/src/cli.ts <url> --out dir --name my-clone --verify   # generate + auto-install deps + fidelity score
# token-site factory:
node packages/engine/src/cli.ts <url> --name my-token --token-name "Salary Cat" --token-ticker "SALARY" --token-ca "<solana-ca>"
```

## Server API (apps/server)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/analyze` `{url}` | run the pipeline, save a session, return `{id, recipe}` |
| POST | `/api/generate` `{sessionId\|recipe, name, token?}` | scaffold a replica into `outputs/`, kick off `npm install` |
| POST | `/api/verify` `{sourceUrl, replicaDir}` | fidelity scorecard (installs deps first if needed) |
| POST | `/api/preview` `{dir}` | start a Vite dev server, return `{url, port}` |
| POST | `/api/preview/stop` `{port}` | stop a preview |
| GET/POST/DELETE | `/api/themes` | theme library CRUD |
| GET/POST/DELETE | `/api/tokens` | token preset CRUD |
| GET | `/api/sessions`, `/api/sessions/:id` | session list / recipe fetch |
| GET | `/api/outputs` | generated projects |

When `apps/web/dist` exists the server also serves the dashboard statically on :4747.

## Windows desktop app

The dashboard ships as a frameless Electron desktop app (custom title bar, minimize/maximize/close
controls) that bundles its own server, web UI, and a trimmed headless Chromium — no system Node or
browser install needed.

### Build a release

```bash
npm run build -w apps/web                     # web dashboard
node apps/desktop/build-release.cjs --dir    # unpacked smoke build (fast)
node apps/desktop/build-release.cjs          # full release: NSIS installer + portable exe
```

The build script: compiles the server (tsc, no type-check) + engine, stages runtime deps
(express/cors/playwright-core) and the compiled engine into `apps/desktop/server-deps`,
`npm install`s them in a private prefix, copies the Playwright headless-shell browser and trims it
(locales to en-US, en hyphenation, marker files), builds the web bundle, and runs electron-builder
(`compression: maximum`, Electron locales trimmed to en-US, official icon embedded).

Artifacts land in `apps/desktop/release/`:

```
clonedzz Setup <ver>.exe  NSIS installer (per-user, optional desktop shortcut, changable dir)
clonedzz <ver>.exe        portable self-extracting exe
```

### How the packaged app runs

- `main.cjs` detects `app.isPackaged`; the packaged server is spawned on **Electron's embedded Node**
  (`ELECTRON_RUN_AS_NODE`) so end users need no system Node.
- Packaged paths: server + node_modules live in `resources/server`, web UI in `resources/web`,
  browsers in `resources/browsers` (`PLAYWRIGHT_BROWSERS_PATH`); sessions/library/outputs are
  written under Electron's `userData` dir (`%APPDATA%/@clonedzz/desktop/{library,outputs}`).
- The first launch of the packaged app builds the `browsers/` bundle — keep the `resources/browsers`
  folder next to the exe.

### Size notes

A release is roughly **143 MB** per artifact: Electron (~180 MB exe + runtimes) plus a headless
Chromium (~200 MB exe) are irreducible, but locales (44 MB browser + 41 MB Electron), the Playwright
CLI wrapper, hyphenation packs, and dep docs are stripped. LZMA `maximum` compression takes the
~470 MB payload down to ~143 MB installers.

## Notes

- Playwright browsers are shared with the system cache in dev; if the first run can't find a browser, run `npx playwright install chromium`. (The packaged app bundles its own.)
- Vite binds `::1` on Windows by default; verify/preview always use `--host 127.0.0.1`.
- Generated replicas are standalone projects — `cd outputs/<name> && npm run dev`.
