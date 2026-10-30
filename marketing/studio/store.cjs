// Renders the store listing graphics from store.html into OUT_DIR.
const { chromium } = require('./playwright.cjs');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const render = async (hash, w, h, file) => {
    await p.setViewportSize({ width: w, height: h });
    await p.goto(`file://${__dirname}/store.html?${hash}`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${file}`, clip: { x: 0, y: 0, width: w, height: h } });
  };
  for (let i = 0; i < 6; i++) await render(`shot${i}`, 1080, 1920, `screenshot-${i + 1}.png`);
  await render('feature', 1024, 500, 'feature-graphic-1024x500.png');
  await render('icon', 512, 512, 'icon-512.png');
  await b.close();
})();
