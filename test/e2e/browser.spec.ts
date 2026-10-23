import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { site } from './helpers';

// The Orb Browser, launched for real. The planner is a script (ORB_TEST_STEPS) so no model is
// needed; everything else is real: the address bar, the pilot loop in the main process, the IPC to
// each page's orb, three page loads, the confirm in the page, the orb's hands doing every step.
const STEPS = [
  { action: 'type', label: 'Search books', text: 'lisbon', submit: true, why: 'Searching for Lisbon' },
  { action: 'tap', label: 'Lisbon in the Rain', why: 'Opening the book' },
  { action: 'type', label: 'Format', text: 'Hardback', why: 'Choosing the hardback' },
  { action: 'tap', label: 'Buy now', why: 'Buying it' },
  { action: 'done', text: 'Bought the hardback of Lisbon in the Rain.' },
];

let app: ElectronApplication;

async function view(match: RegExp): Promise<Page> {
  for (let i = 0; i < 100; i++) {
    const p = app.windows().find((w) => match.test(w.url()));
    if (p) return p;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no view matching ${match}`);
}

test.beforeAll(async () => {
  app = await electron.launch({
    args: ['--no-sandbox', '.'],
    env: {
      ...process.env,
      ORB_START_URL: site('index.html'),
      ORB_TEST_STEPS: JSON.stringify(STEPS),
      ORB_USER_DATA: mkdtempSync(path.join(os.tmpdir(), 'orb-test-')),
    },
  });
});
test.afterAll(async () => app?.close());

test('the orb is on every page, and a goal in the address bar drives across pages', async () => {
  const chrome = await view(/chrome\/index\.html$/);
  const page = await view(/playground\/site\/index\.html$/);
  await expect(page.locator('orb-companion .orb-cursor')).toBeVisible();
  await expect(chrome.locator('.mark')).toHaveText('Orb');

  // A sentence, not an address: it goes to the orb.
  await chrome.locator('.omni .field').fill('Buy the hardback of Lisbon in the Rain');
  await expect(chrome.locator('.hint-go')).toHaveText('↵ Ask the orb');
  await chrome.locator('.omni .field').press('Enter');
  await expect(chrome.locator('.driving')).toContainText('Buy the hardback of Lisbon in the Rain');

  // It searched, opened the book, chose the format, and now asks before buying.
  await page.waitForURL(/item\.html\?id=lisbon/, { timeout: 30_000 });
  const confirm = page.locator('orb-companion .orb-confirm');
  await expect(confirm.locator('p')).toHaveText('Press “Buy now”?', { timeout: 20_000 });
  await expect(page.locator('#format')).toHaveValue('Hardback');
  await expect(page.locator('orb-companion .orb-layer')).toHaveAttribute('data-driving', '');
  await confirm.locator('button', { hasText: 'Yes, do it' }).click();

  await expect(page.locator('#basket')).toHaveText('Order placed: Lisbon in the Rain (Hardback).');
  await expect(chrome.locator('.driving')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('orb-companion .orb-caption')).toHaveText('Bought the hardback of Lisbon in the Rain.');
  await expect(page.locator('orb-companion .orb-layer')).not.toHaveAttribute('data-driving', '');
});

test('an address in the address bar just opens it', async () => {
  const chrome = await view(/chrome\/index\.html$/);
  const page = await view(/playground\/site\//);
  await chrome.locator('.omni .field').fill(`${site('search.html')}?q=fiction`);
  await chrome.locator('.omni .field').press('Enter');
  await page.waitForURL(/search\.html\?q=fiction/);
  await expect(page.locator('#heading')).toHaveText('Books matching “fiction”');
  await expect(page.locator('orb-companion .orb-cursor')).toBeVisible();
});
