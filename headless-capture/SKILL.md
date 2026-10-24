---
name: headless-capture
description: Use this to capture or inspect web pages with a headless Chromium. Use from any task that needs visual review of page rendering.
---

# Headless Capture

Self-contained headless browser harness. Playwright is installed in this skill's
`node_modules/` and its Chromium in `browsers/` (the script sets
`PLAYWRIGHT_BROWSERS_PATH` itself, so it runs from any cwd).

- NEVER use system `google-chrome`/`chromium` — not even `--version` or
  `command -v` checks. System-channel Chromium also does not work from WSL.
- Only `google-chrome --version`... → forbidden. Only `chromium.launch({ headless: true })`.
- ALWAYS headless (default here). NEVER launch headed/headful.

## 1. Paths & bootstrap (only if missing)
- Harness: `<this-skill-dir>/scripts/capture.mjs`
- If `node_modules/playwright` is missing: `cd <this-skill-dir> && npm install`
- If `browsers/` is missing: `cd <this-skill-dir> && npx playwright install chromium`

## 2. Screenshot at an exact viewport
```
node <this-skill-dir>/scripts/capture.mjs shoot URL OUT.png W H
```
- Forces `deviceScaleFactor: 1` → PNG pixel size == CSS viewport; hides scrollbars.
- Prints JSON: `requested` vs `measured` innerWidth/innerHeight.
- ALWAYS key file naming and decisions off the MEASURED width — Playwright
  honors the requested viewport exactly, but verify via the reported value.
  True <500px widths work (there is no system-Chrome 500px clamp here).

## 3. Overflow probe
```
node <this-skill-dir>/scripts/capture.mjs probe URL W H
```
Prints JSON: document `clientWidth`/`scrollWidth`, overall overflowX flag, and
up to 30 elements where `el.scrollWidth > documentElement.clientWidth` (tag,
class, scrollWidth, rect width).

## 4. Usage notes
- URL: running dev server (`http://localhost:PORT`) or `file://` path.
- Budget one launch per invocation; widths/heights are in CSS px.
- Parse the printed JSON with `jq` or read it directly; screenshot output path
  is echoed so the caller can `read` the PNG to inspect visually.
