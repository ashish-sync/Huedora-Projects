import { chromium } from 'playwright';

const BASE = process.env.CAMP_URL || 'http://localhost:5173';
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"], input[name="email"]', 'campadmin@tylo.local');
await page.fill('input[type="password"], input[name="password"]', 'CampDemoPass123!');
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

await page.goto(`${BASE}/camps/manage`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const text = await page.locator('#main-content').innerText();
const html = await page.locator('#main-content').innerHTML();

console.log('--- main-content text (first 500 chars) ---');
console.log(text.slice(0, 500) || '(empty)');
console.log('--- html length ---', html.length);
console.log('--- errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');

await browser.close();
process.exit(errors.length && !text.trim() ? 1 : 0);
