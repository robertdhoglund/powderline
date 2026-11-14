// Smoke test: serves the game, lets the autopilot ride the whole mountain in fast-forward,
// and fails on any console error or if the run does not finish.
// Needs Playwright:  npm i -D playwright && npx playwright install chromium
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..'), types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  await page.goto(`http://localhost:${server.address().port}/?auto`);
  await page.waitForFunction(() => window.__pl);
  await page.click('#start');
  const run = await page.evaluate(() => {
    const { G, sim } = window.__pl;
    for (let i = 0; i < 1400 && G.mode === 'run'; i++) sim(0.25);
    return { mode: G.mode, score: G.score, stats: G.stats, totals: G.totals };
  });
  await page.keyboard.press('r');
  const again = await page.evaluate(() => ({ mode: window.__pl.G.mode, score: window.__pl.G.score }));
  await browser.close(); server.close();
  const fail = [];
  if (errors.length) fail.push(`console errors: ${errors.join(' | ')}`);
  if (run.mode !== 'finished') fail.push(`run did not finish (mode ${run.mode})`);
  if (run.stats.kills < 8) fail.push(`autopilot only hit ${run.stats.kills} targets`);
  if (run.stats.gates < 10) fail.push(`autopilot only made ${run.stats.gates} gates`);
  if (run.stats.ice < 3) fail.push(`only ${run.stats.ice} ice panels broke`);
  if (run.stats.time > 260) fail.push(`run took ${run.stats.time.toFixed(0)} s`);
  if (again.mode !== 'run' || again.score !== 0) fail.push('restart did not reset the run');
  console.log(JSON.stringify(run));
  if (fail.length) { console.error('FAIL\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('PASS');
})();
