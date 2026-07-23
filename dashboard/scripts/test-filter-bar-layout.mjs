/**
 * Layout smoke test: with aggressive filter selections the control strip
 * must stay a single row (no wrap). Scroll is OK; multi-line wrap is not.
 */
import { chromium } from 'playwright';

const BASE = process.env.FILTER_TEST_URL || 'http://127.0.0.1:4173';
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 900 },
];

const CASES = [
  { name: 'idle', query: '' },
  { name: 'district', query: '?district=Colombo' },
  { name: 'source', query: '?source=ikman' },
  { name: 'price-min', query: '?min_price=50600000' },
  { name: 'price-range', query: '?min_price=10000000&max_price=75000000' },
  { name: 'rooms', query: '?min_beds=3&min_baths=2' },
  { name: 'size-land', query: '?type=land&min_size_p=10&max_size_p=40' },
  { name: 'size-house', query: '?type=house&min_size_sqft=1500&max_size_sqft=3500' },
  { name: 'sort-asc', query: '?sort=price_asc' },
  { name: 'sort-desc', query: '?sort=price_desc' },
  {
    name: 'all-active',
    query:
      '?district=Colombo&type=apartment&listing_type=sale&source=ikman' +
      '&min_price=50600000&max_price=150000000&min_beds=3&min_baths=2' +
      '&min_size_sqft=1200&max_size_sqft=4500&sort=price_desc',
  },
  {
    name: 'long-district',
    query:
      '?district=Nuwara%20Eliya&source=lamudi&min_price=25000000&min_beds=5&min_baths=3&sort=price_asc',
  },
];

function assertSingleRow(box, label) {
  if (!box) throw new Error(`${label}: element missing`);
  // One text line + chevrons ≈ 20–28px; allow padding/meta up to ~40px.
  if (box.height > 40) {
    throw new Error(`${label}: wrapped — height ${box.height.toFixed(1)}px > 40px`);
  }
}

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: vp });
    for (const c of CASES) {
      const url = `${BASE}/${c.query}#listings`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForSelector('[data-testid="filter-controls"]', { timeout: 20_000 });
      // Settle layout / fonts
      await page.waitForTimeout(250);

      const controls = await page.locator('[data-testid="filter-controls"]').boundingBox();
      const bar = await page.locator('[data-testid="filter-bar"]').boundingBox();
      const label = `${vp.name}/${c.name}`;
      try {
        assertSingleRow(controls, `${label} controls`);
        assertSingleRow(bar, `${label} bar`);
        // Children must share one row: max bottom - min top ≈ single-line height
        const childBoxes = await page.locator('[data-testid="filter-controls"] > *').evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, height: r.height };
          })
        );
        if (childBoxes.length) {
          const top = Math.min(...childBoxes.map((b) => b.top));
          const bottom = Math.max(...childBoxes.map((b) => b.bottom));
          const span = bottom - top;
          if (span > 40) {
            throw new Error(`${label}: control children span ${span.toFixed(1)}px (wrapped)`);
          }
        }
        console.log(`OK  ${label}  h=${controls.height.toFixed(1)}`);
      } catch (err) {
        failures.push(String(err.message || err));
        console.error(`FAIL ${label}: ${err.message || err}`);
        await page.screenshot({
          path: `/tmp/filter-bar-fail-${vp.name}-${c.name}.png`,
          fullPage: false,
        });
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`\nAll ${VIEWPORTS.length * CASES.length} cases passed`);
