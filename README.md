# CloneForge

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

## Notes

- Playwright browsers are shared with the system cache; if the first run can't find a browser, run `npx playwright install chromium`.
- Vite binds `::1` on Windows by default; verify/preview always use `--host 127.0.0.1`.
- Generated replicas are standalone projects — `cd outputs/<name> && npm run dev`.
