#!/usr/bin/env node
// Self-contained headless-capture harness (bundled Playwright — no system Chrome).
// usage: node capture.mjs shoot URL OUT.png WIDTH HEIGHT
//        node capture.mjs probe URL WIDTH HEIGHT
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(SKILL_ROOT, 'browsers');

const [cmd, url, out, wArg, hArg] = process.argv.slice(2);
const W = Number(wArg);
const H = Number(hArg);

function usage() {
  console.error('usage: capture.mjs shoot URL OUT.png W H\n       capture.mjs probe URL W H');
  process.exit(2);
}
if (!cmd || !url || (cmd !== 'shoot' && cmd !== 'probe')) usage();
if (cmd === 'shoot' && (!out || !W || !H)) usage();
if (cmd === 'probe' && (!W || !H)) usage();

const HIDE_SCROLLBARS = `
  document.head?.insertAdjacentHTML('beforeend',
    '<style>html{scrollbar-width:none}::-webkit-scrollbar{display:none!important}</style>');
`;

try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1, // PNG pixels == CSS px
  });
  await ctx.addInitScript(HIDE_SCROLLBARS);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(300); // settle fonts/layout after load

  const measured = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));

  if (cmd === 'shoot') {
    await page.screenshot({ path: out, fullPage: false });
    console.log(JSON.stringify({ cmd, screenshot: out, requested: { width: W, height: H }, measured }));
  } else {
    const report = await page.evaluate(() => {
      const de = document.documentElement;
      const elements = [];
      for (const el of document.querySelectorAll('*')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && el.scrollWidth > de.clientWidth) {
          elements.push({
            tag: el.tagName.toLowerCase(),
            cls: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
            scrollWidth: el.scrollWidth,
            rectWidth: Math.round(rect.width),
          });
          if (elements.length >= 30) break;
        }
      }
      return {
        clientWidth: de.clientWidth,
        scrollWidth: de.scrollWidth,
        overflowX: de.scrollWidth > de.clientWidth,
        elements,
      };
    });
    console.log(JSON.stringify({ cmd, requested: { width: W, height: H }, measured, report }));
  }

  await browser.close();
} catch (err) {
  const msg = String(err?.message ?? err);
  console.error(msg);
  if (/Executable doesn't exist|browserType\.launch: Failed/i.test(msg)) {
    console.error('Chromium missing. Bootstrap: cd ' + SKILL_ROOT +
      ' && npm install && npx playwright install chromium');
  }
  process.exit(1);
}
