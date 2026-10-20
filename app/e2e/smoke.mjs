/**
 * End-to-end smoke test of the production build in headless Chromium.
 *
 *   npm run build && npm run e2e
 *
 * Uses playwright-core with an existing Chromium or Chrome (CHROMIUM_PATH, a
 * system browser, or `npx playwright-core install chromium`). Screenshots and
 * exported files go to e2e/output/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'output');
mkdirSync(out, { recursive: true });

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
  if (!ok) failures.push(msg);
};

const server = await preview({ root: join(here, '..'), preview: { port: 4321, strictPort: false }, logLevel: 'error' });
const url = server.resolvedUrls.local[0];
// An explicit CHROMIUM_PATH, a common system browser, or Playwright's own download.
const executablePath =
  process.env.CHROMIUM_PATH ||
  ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath });

try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  // with every topic on one worksheet (200+ topics, 2000+ problems, 260 pages) re-rendering takes a while
  page.setDefaultTimeout(180_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

  console.log(`Opening ${url}`);
  await page.goto(url);
  await page.waitForSelector('.preview .ws-page');
  await page.evaluate(() => document.fonts.ready);

  const problems = () => page.locator('.preview .ws-problem').count();
  check((await problems()) === 14, `starter worksheet shows 14 problems (got ${await problems()})`);
  check((await page.locator('.preview .katex-error').count()) === 0, 'no KaTeX errors');
  await page.screenshot({ path: join(out, '01-student.png'), fullPage: false });

  // answer key
  await page.getByRole('radio', { name: 'Answer key' }).click();
  await page.waitForSelector('.preview .ws-key-badge');
  check((await page.locator('.preview .ws-answer').count()) === 14, 'answer key shows 14 answers');
  check((await page.locator('.preview .ws-steps').count()) > 0, 'worked solutions are shown');
  await page.screenshot({ path: join(out, '02-teacher.png') });
  await page.getByRole('radio', { name: 'Student' }).click();

  // add every topic
  await page.getByRole('button', { name: '+ Add topics' }).click();
  const dialog = page.locator('dialog[open]');
  for (const tab of await dialog.getByRole('tab').all()) {
    await tab.click();
    await dialog.locator('.picker-subject-all input[type=checkbox]').check();
  }
  await dialog.getByRole('button', { name: /^Add \d+ topics$/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('.preview .ws-problem').length > 100);
  const total = await problems();
  check(total > 150, `all topics added (${total} problems)`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  check((await page.locator('.preview .katex-error').count()) === 0, 'no KaTeX errors across all topics');
  check((await page.locator('.preview svg.diagram').count()) > 10, 'geometry figures rendered');

  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.preview .ws-page-content')).filter((el) => el.scrollHeight > el.clientHeight + 1).length,
  );
  check(overflow === 0, `no page content is clipped (${overflow} overflowing pages)`);
  const previewPages = await page.locator('.preview .ws-page').count();
  check(previewPages > 3, `worksheet paginates into ${previewPages} pages`);
  await page.locator('.preview .ws-page').nth(2).screenshot({ path: join(out, '03-page3.png') });

  // teacher view of every page for visual review
  await page.getByRole('radio', { name: 'Answer key' }).click();
  await page.waitForTimeout(300);
  const keyPages = await page.locator('.preview .ws-page').count();
  for (let i = 0; i < Math.min(keyPages, 40); i++) await page.locator('.preview .ws-page').nth(i).screenshot({ path: join(out, `key-${String(i + 1).padStart(2, '0')}.png`) });
  const keyOverflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.preview .ws-page-content')).filter((el) => el.scrollHeight > el.clientHeight + 1).length,
  );
  check(keyOverflow === 0, `answer key pages are not clipped (${keyOverflow})`);
  await page.getByRole('radio', { name: 'Student' }).click();
  await page.waitForTimeout(200);

  // per-problem tools
  const first = page.locator('.preview .ws-problem').first();
  const q0 = await first.locator('.ws-question').innerText();
  await first.hover();
  await first.getByRole('button', { name: 'Regenerate problem 1' }).click();
  const q1 = await page.locator('.preview .ws-problem').first().locator('.ws-question').innerText();
  check(q0 !== q1, 'regenerate single problem changes it');

  const second = await page.locator('.preview .ws-problem').nth(1).locator('.ws-question').innerText();
  await page.locator('.preview .ws-problem').first().hover();
  await page.locator('.preview .ws-problem').first().getByRole('button', { name: 'Move problem 1 later' }).click();
  check((await page.locator('.preview .ws-problem').first().locator('.ws-question').innerText()) === second, 'move problem down reorders');

  await page.locator('.preview .ws-problem').first().hover();
  await page.locator('.preview .ws-problem').first().getByRole('button', { name: 'Edit problem 1' }).click();
  const editor = page.locator('dialog[open]');
  await editor.locator('textarea').first().fill('Solve $3x = 12$ (edited)');
  await editor.getByRole('button', { name: 'Save' }).click();
  check((await page.locator('.preview .ws-problem').first().locator('.ws-question').innerText()).includes('(edited)'), 'manual edit is applied');

  // undo restores
  await page.getByRole('button', { name: 'Undo' }).click();
  check(!(await page.locator('.preview .ws-problem').first().locator('.ws-question').innerText()).includes('(edited)'), 'undo reverts the edit');

  // drag and drop: drop problem 3 onto the left half of problem 1
  const third = await page.locator('.preview .ws-problem').nth(2).locator('.ws-question').innerText();
  await page.locator('.preview .ws-problem').nth(2).hover();
  await page
    .locator('.preview .ws-problem')
    .nth(2)
    .locator('.ws-drag')
    .dragTo(page.locator('.preview .ws-problem').nth(0), { targetPosition: { x: 12, y: 12 } });
  check((await page.locator('.preview .ws-problem').first().locator('.ws-question').innerText()) === third, 'drag and drop reorders problems');

  // multiple choice
  await page.locator('.section-card').first().getByRole('radio', { name: 'Multiple choice' }).click();
  check((await page.locator('.preview .ws-choices').count()) >= 8, 'multiple choice renders choices');

  // regenerate all
  const before = await page.locator('.preview .ws-question').first().innerText();
  await page.getByRole('button', { name: /Regenerate all/ }).click();
  check(before !== (await page.locator('.preview .ws-question').first().innerText()), 'regenerate all makes new problems');

  // browser print (print CSS)
  await page.emulateMedia({ media: 'print' });
  const printed = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  writeFileSync(join(out, 'print.pdf'), printed);
  const printedPages = (printed.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const shownPages = await page.locator('.preview .ws-page').count();
  check(printedPages === shownPages, `print produces exactly the previewed pages (${printedPages} vs ${shownPages})`);
  await page.emulateMedia({ media: 'screen' });

  // client-side PDF export
  await page.getByRole('button', { name: 'Export & print' }).click();
  await page.locator('dialog[open]').getByText('Worksheet', { exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300_000 }), page.locator('dialog[open]').getByRole('button', { name: 'Download PDF' }).click()]);
  const pdfPath = join(out, 'export.pdf');
  await download.saveAs(pdfPath);
  const pdf = readFileSync(pdfPath);
  const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check(pdf.length > 50_000 && pdfPages === shownPages, `jsPDF export: ${pdfPages} pages, ${Math.round(pdf.length / 1024)} KB`);

  // LaTeX + JSON exports
  for (const [label, file] of [
    ['LaTeX (.tex)', 'export.tex'],
    ['Worksheet file (.json)', 'export.json'],
  ]) {
    await page.getByRole('button', { name: 'Export & print' }).click();
    await page.locator('dialog[open]').getByText(label).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('dialog[open]').getByRole('button', { name: /^Download/ }).click()]);
    await dl.saveAs(join(out, file));
    check(readFileSync(join(out, file), 'utf8').length > 1000, `${label} export downloaded`);
  }

  // JSON round trip through the library dialog
  await page.getByRole('button', { name: 'My worksheets' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('dialog[open]').getByRole('button', { name: /Open a worksheet file/ }).click()]);
  await chooser.setFiles(join(out, 'export.json'));
  await page.waitForTimeout(300);
  check((await problems()) === total, `re-imported JSON has the same ${total} problems`);

  // autosave survives reload
  await page.reload();
  await page.waitForSelector('.preview .ws-page');
  check((await problems()) === total, 'worksheet persists across reloads');

  // phone layout: no horizontal scrolling
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(200);
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(!hscroll, 'no horizontal scroll at 375px');
  await page.screenshot({ path: join(out, '04-mobile-build.png') });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, '05-mobile-preview.png') });

  check(errors.length === 0, `no console/page errors${errors.length ? `:\n    ${errors.join('\n    ')}` : ''}`);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll end-to-end checks passed.');
