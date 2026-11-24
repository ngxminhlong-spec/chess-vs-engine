import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:8765/', { waitUntil: 'load' });
const click = (name) => page.$eval(`#board .sq[aria-label^="${name}"]`, el => el.click());
const waitStatus = async (re, ms = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.$eval('#status', el => el.textContent);
    if (re.test(s)) return s;
    await new Promise(r => setTimeout(r, 300));
  }
  return 'TIMEOUT; status=' + await page.$eval('#status', el => el.textContent);
};
await click('e2'); await click('e4');
console.log('after e4 status:', await waitStatus(/Your move|failed/));
console.log('moves:', await page.$eval('#moves', el => el.textContent));
// hint test
await page.click('#btn-hint');
console.log('hint status:', await waitStatus(/Your move|failed/));
console.log('hint highlighted squares:', await page.$$eval('#board .sq.hint', els => els.length));
// eval bar height changed from 50%?
console.log('eval fill height:', await page.$eval('#eval-fill', el => el.style.height));
// play a few moves to exercise engine more (Scholar-style)
await page.click('#btn-undo');
console.log('after undo moves:', JSON.stringify(await page.$eval('#moves', el => el.textContent)));
console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
