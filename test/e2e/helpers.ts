import type { Page } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const site = (file: string) => pathToFileURL(path.resolve('playground/site', file)).toString();

/** Open a bookshop page and put the orb on it (open shadow root so tests can look inside). */
export async function openWithOrb(page: Page, file = 'index.html', opts: Record<string, unknown> = {}) {
  await page.goto(site(file));
  await page.addScriptTag({ path: 'dist/embed/orb.js' });
  await page.evaluate(async (o) => {
    const w = window as unknown as { OrbEmbed: any; __orb: any; __mounted: any };
    w.__mounted = w.OrbEmbed.mountOrb({ brain: null, shadowMode: 'open', settings: { level: 'full' }, ...o });
    w.__orb = await w.__mounted.ready;
  }, opts);
  // The first refocus (a frame, then the 700 ms tick) has run.
  await page.waitForTimeout(900);
}

/** The orb ball's centre on screen. */
export async function orbCentre(page: Page) {
  const box = await page.locator('orb-companion .orb-cursor').boundingBox();
  if (!box) throw new Error('no orb');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Wait until the orb has come to rest (its centre moves less than 1 px over 150 ms). */
export async function orbAtRest(page: Page, timeoutMs = 5000) {
  const t0 = Date.now();
  let prev = await orbCentre(page);
  while (Date.now() - t0 < timeoutMs) {
    await page.waitForTimeout(150);
    const now = await orbCentre(page);
    if (Math.hypot(now.x - prev.x, now.y - prev.y) < 1) return now;
    prev = now;
  }
  throw new Error('the orb never came to rest');
}
