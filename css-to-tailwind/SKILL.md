---
name: css-to-tailwind
description: Use this when the user asks to port vanilla css into TailwindCSS
---

# CSS to Tailwind (faithful port, zero restyle)

Goal: identical rendering. Nothing extra, nothing less. No redesign, no cleanup, no "improvements".

## 1. Setup (do first)
1. Tailwind v4 ONLY. NEVER emit v3 syntax, config, or directives. Confirm v4: `package.json` has `tailwindcss@^4`, CSS uses `@import "tailwindcss"`, theme via `@theme`. If project is v3, stop and ask before upgrading — do not port as v3.
2. List every selector/rule being ported. Keep source CSS untouched until verified.

## 2. Inventory before writing any class
For each element, record: computed `getComputedStyle` + applicable media queries + pseudo-states (`:hover :focus :active :disabled`) + animations/transitions.
- Map 1:1, declaration by declaration. If no exact token exists, use arbitrary values (`w-[347px]`, `text-[#1a1a1a]`, `bg-[rgb(0,0,0,0.5)]`, `grid-cols-[200px_1fr]`). Never snap to nearest token.
- Preserve: specificity order, cascade, `!important`, breakpoints, states, `calc()/clamp()/var()` verbatim inside brackets.

## 3. Port rules (constraints)
- NEVER add styling not in source. NEVER drop a declaration as "unnecessary". NEVER rename/restructure DOM to suit Tailwind. NEVER introduce new colors, spacing, fonts, shadows, radii, or responsive behavior.
- NEVER emit v3 syntax: no `@tailwind base/components/utilities`, no `tailwind.config.js`, no v3-only plugins. v4 only (`@import "tailwindcss"`, `@theme`).
- One class per declaration where possible. Merge only when provably identical shorthand.
- Keep non-portable CSS (complex `@keyframes`, exotic selectors) in `@layer` / inline `style` / arbitrary variants (`[&:nth-child(3)]:...`) rather than faking it.
- Unknown mapping → stop and keep original rule, flag it. Do not invent.

## 4. Verify (mandatory)
1. Screenshot before/after at same widths into `fixes/<slug>/` (`before-*`, `after-*`); follow `responsive-fixes` clamp rules (name by measured CSS width).
2. Diff computed styles on ported elements; any delta = fail, revert.
3. Report: file-by-file class mapping + any declarations kept as raw CSS and why.
