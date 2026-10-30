// Renders a campaign's video.html with headless Chromium.
//   node render.cjs preview CAMPAIGN_DIR OUT_DIR t1 t2 ...   PNG stills at those times (seconds)
//   node render.cjs frames  CAMPAIGN_DIR OUT_DIR [FPS=30]    every frame as JPEG
// The page must define window.renderAt(seconds) and window.TOTAL, and may set
// window.VIDEO_SIZE = {width, height} (default 1920x1080; 1080x1920 for vertical).
const path = require('path');
const { chromium } = require('./playwright.cjs');
const [mode, dir, out, ...rest] = process.argv.slice(2);
if (!['preview', 'frames'].includes(mode) || !dir || !out) {
  console.error('Usage: node render.cjs preview|frames CAMPAIGN_DIR OUT_DIR [...]');
  process.exit(1);
}
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(dir, 'video.html'));
  const size = await page.evaluate(() => window.VIDEO_SIZE || { width: 1920, height: 1080 });
  await page.setViewportSize(size);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  if (errors.length) { console.error('Page errors:', errors); process.exit(1); }
  if (mode === 'preview') {
    for (const t of rest.map(Number)) {
      await page.evaluate((x) => renderAt(x), t);
      await page.screenshot({ path: `${out}/t${t.toFixed(2)}.png` });
    }
  } else {
    const fps = Number(rest[0] || 30);
    const total = await page.evaluate(() => TOTAL);
    const n = Math.ceil(total * fps);
    for (let i = 0; i < n; i++) {
      await page.evaluate((x) => renderAt(x), i / fps);
      await page.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
      if (i % 300 === 0) console.log(`frame ${i}/${n}`);
    }
    console.log(`${n} frames, ${total.toFixed(2)} s at ${fps} fps`);
  }
  if (errors.length) console.error('Page errors:', errors);
  await browser.close();
})();
