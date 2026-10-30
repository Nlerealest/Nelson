// Captures Ndalama screens and individual cards (3x resolution) from the
// app's web build, using sample data, for videos, posters and store images.
// Usage: node capture.cjs OUT_DIR DATA_JSON
//   APP_URL  (default http://localhost:8090/)  where the web build is served
//   APP_DATE (default 2026-10-13T09:30:00)     the date the app thinks it is
const { chromium } = require('./playwright.cjs');
const out = process.argv[2];
const dataPath = process.argv[3];
if (!out || !dataPath) { console.error('Usage: node capture.cjs OUT_DIR DATA_JSON'); process.exit(1); }

// Nearest ancestor of the element containing `text` that looks like a card
// (radius 14) or an alert (4px left border). Returns its page rectangle.
const FIND = `(([text, kind, nth]) => {
  const all = [...document.querySelectorAll('div')].filter(d =>
    d.childElementCount === 0 && d.textContent.includes(text) && d.offsetParent !== null && (() => {
      const r = d.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit && (hit === d || d.contains(hit) || hit.contains(d));
    })());
  let el = all[nth || 0];
  while (el) {
    const cs = getComputedStyle(el);
    if (kind === 'alert' ? cs.borderLeftWidth === '4px' : kind === 'tiles'
        ? (cs.flexDirection === 'row' && cs.gap === '8px') : cs.borderTopLeftRadius === '14px') break;
    el = el.parentElement;
  }
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
})`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(process.env.APP_DATE || '2026-10-13T09:30:00') });
  await page.goto(process.env.APP_URL || 'http://localhost:8090/');
  await page.waitForTimeout(1500);
  const hide = () => page.evaluate(() => {
    // Hide the toast so it never appears in a capture.
    for (const d of document.querySelectorAll('div')) if (/loaded|saved|added/.test(d.textContent) && d.childElementCount === 0 && getComputedStyle(d.parentElement).position === 'absolute') d.parentElement.style.display = 'none';
  });
  const shot = async (name) => { await page.waitForTimeout(500); await hide(); await page.screenshot({ path: `${out}/${name}.png` }); };
  const tab = async (name) => { await page.getByRole('tab', { name }).click(); await page.waitForTimeout(500); };
  const card = async (name, text, kind, nth) => {
    await hide();
    const r = await page.evaluate(`${FIND}(${JSON.stringify([text, kind, nth])})`);
    if (!r) return console.log('MISSING', name);
    await page.screenshot({ path: `${out}/card-${name}.png`, clip: r });
  };

  await shot('screen-welcome');
  const data = require('fs').readFileSync(dataPath, 'utf8');
  await page.evaluate((d) => localStorage.setItem('ndalama:v1', d), data);
  await page.reload();
  await page.waitForTimeout(2000);
  await shot('screen-home');

  // Tall viewport so whole cards are on screen for the crops.
  await page.setViewportSize({ width: 390, height: 2400 });
  await page.waitForTimeout(600);
  await card('hero', 'Safe to spend today');
  await card('tiles', 'In (October)', 'tiles');
  await card('goal-alert', 'is off track', 'alert');
  await card('recent', 'Minibus');
  await tab('Budget'); await card('budget', 'Groceries');
  await tab('Goals'); await card('goal', 'New phone'); await card('goal2', 'school fees');
  await tab('Bills'); await card('bills', 'Water board');
  await tab('Loans'); await card('loan-lent', 'Chikondi'); await card('loan-owe', 'Village bank');
  await tab('Report'); await card('insights', 'You kept'); await card('report-cats', 'Budget K');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const t of ['Budget', 'Goals', 'Bills', 'Loans', 'Report']) { await tab(t); await shot(`screen-${t.toLowerCase()}`); }
  await tab('Home');

  // The add-entry sheet, filled in.
  await page.getByLabel('Add income or expense').first().click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder('K0').fill('3500');
  await page.getByText('Groceries', { exact: true }).last().click();
  await page.getByText('Transport', { exact: true }).last().click();
  await page.getByPlaceholder('e.g. Minibus to town').fill('Minibus to town');
  await page.getByText('Cash', { exact: true }).last().click();
  await page.getByText('Airtel Money', { exact: true }).last().click();
  await page.locator('input').first().blur();
  await shot('screen-add');
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
