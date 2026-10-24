---
name: responsive-fixes
description: Use this when user asks to fix responsiveness issues on a website.
---

# Responsive Fixes

## 1. Setup (do first)
1. Find how site serves: read `package.json`, Vite/Next/Astro config. Start dev server if not running, note local URL.
2. Verify `<meta name="viewport" content="width=device-width, initial-scale=1">` exists. If missing, fix that first.
3. Determine widths to test: grep `tailwind.config.*screens`, `@media`, `breakpoints`. Use those + defaults: `360x800, 390x844, 768x1024, 1024x768, 1280x800, 1440x900`.

## 2. Baseline (headless only)
- NEVER launch headed/headful browser. Only `--headless=new` or Playwright `headless:true`.
- NEVER run `google-chrome --version`, `chromium --version`, or bare `google-chrome` to "check if it exists" — that opens Chrome on the desktop. Check with `command -v google-chrome` only (no execution).
- Capture directly to `fixes/<slug>/` in the project root (one subdir per fix). Create it first, then convert path for Windows Chrome:
  `mkdir -p fixes/<slug> && WIN_OUT=$(wslpath -w "$PWD/fixes/<slug>/before-W.png")`
  `google-chrome --headless=new --disable-gpu --hide-scrollbars --screenshot="$WIN_OUT" --window-size=W,H URL`
  Fallback: `chromium`, `chrome.exe` (same `wslpath -w` rule), or `npx playwright screenshot --viewport-size "W,H" URL fixes/<slug>/before-W.png` (requires `npx playwright install chromium`; system-channel reuse does not work from WSL).
- KNOWN CLAMP: Windows Chrome enforces ~500px minimum window width even headless. `--window-size=360,800` yields ~504px CSS viewport (verified: file is 360px wide but `window.innerWidth` reports ~504). So NEVER trust the requested width.
- Rules: (a) stamp/verify actual CSS width via `window.innerWidth` (render it in-page or dump via `--dump-dom` probe) and NAME files by MEASURED width (`after-600.png`, not `after-360.png`); (b) default mobile proxy is 600px wide (below Tailwind `sm:640`, same layout phones get); (c) for true <500px proof use a narrow-container simulation (e.g. wrap app in 340px container) or Playwright device emulation (`--device "iPhone 12"` / viewport `360,800`) where Chromium is installed.
- Read each screenshot with `read` to inspect visually. Keep before/after pairs in their fix subdir.

## 3. Diagnose
For each broken width:
1. Run overflow probe in console/script: elements where `el.scrollWidth > document.documentElement.clientWidth`.
2. Check in order: fixed `width:px` vs `max-width:100%`, missing `flex-wrap`, `grid` without `minmax(0,1fr)`, `overflow-hidden` clipping, `img/video{max-width:100%;height:auto}`, `whitespace-nowrap`, long unbreakable strings, missing `44px` tap targets, type without `clamp()`.
3. Fix one issue at a time with smallest mobile-first change. Prefer fluid units (`%, rem, vw, clamp(), min(), max()`).

## 4. Verify
1. Re-capture same widths + one desktop width for regression, saving `after-W.png` next to its `before-W.png` in `fixes/<slug>/`.
2. Confirm: no horizontal scroll, no overlap/clipping, nav/menu usable, tap targets >=44px.
3. Mandatory: every fix MUST end with `fixes/<slug>/` containing its before/after images. Report the paths.
