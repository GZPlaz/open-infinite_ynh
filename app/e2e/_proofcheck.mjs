import { chromium } from 'playwright-core';
import { preview } from 'vite';
const out = process.argv[2];
const server = await preview({ root: process.cwd(), preview: { port: 4399 }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForSelector('.preview .ws-page');
// start from an empty worksheet: delete starter sections
await page.getByRole('button', { name: '+ Add topics' }).click();
const dialog = page.locator('dialog[open]');
await dialog.locator('input[type=search]').fill('identit');
await dialog.locator('.picker-topic', { hasText: 'Verifying Trigonometric' }).locator('input').check();
await dialog.locator('input[type=search]').fill('proof');
await dialog.locator('.picker-subject-all input').first().check();
await dialog.getByRole('button', { name: /^Add \d+ topics?$/ }).click();
await page.waitForTimeout(1500);
for (const mode of ['Student', 'Answer key']) {
  await page.getByRole('radio', { name: mode }).click();
  await page.waitForTimeout(800);
  const res = await page.evaluate(() => {
    const bad = [];
    for (const p of document.querySelectorAll('.preview .ws-problem')) {
      const box = p.getBoundingClientRect();
      for (const k of p.querySelectorAll('.katex')) {
        const r = k.getBoundingClientRect();
        if (r.right > box.right + 2) bad.push(`${(p.querySelector('.ws-question')?.textContent ?? '').slice(0, 50)} overflow ${Math.round(r.right - box.right)}px`);
      }
    }
    const cols = getComputedStyle(document.querySelector('.preview .ws-problems, .preview .ws-section') ?? document.body).columnCount;
    return { n: document.querySelectorAll('.preview .ws-problem').length, bad: bad.slice(0, 15), badCount: bad.length, cols };
  });
  console.log(mode, JSON.stringify(res));
  const pages = page.locator('.preview .ws-page');
  const n = await pages.count();
  let k = 0;
  for (let i = 0; i < n && k < 3; i++) if ((await pages.nth(i).innerText()).includes('Given:')) await pages.nth(i).screenshot({ path: `${out}/${mode.replace(' ', '')}-proof-${++k}.png` });
}
await browser.close();
await server.close();
