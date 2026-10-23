import { expect, test } from '@playwright/test';
import { openWithOrb, orbAtRest, orbCentre } from './helpers';

test.describe('the orb on an ordinary page', () => {
  test('mounts in its own shadow root and leaves the page’s styles alone', async ({ page }) => {
    await openWithOrb(page);
    await expect(page.locator('orb-companion .orb-layer')).toHaveCount(1);
    await expect(page.locator('orb-companion .orb-cursor')).toBeVisible();
    // The page has its own .btn and --accent: they must be untouched, and the orb's must be its own.
    const searchBg = await page.locator('button[type=submit]', { hasText: 'Search' }).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(searchBg).toBe('rgb(194, 65, 12)');
    const layerFont = await page.locator('orb-companion .orb-layer').evaluate((el) => getComputedStyle(el).position);
    expect(layerFont).toBe('fixed');
  });

  test('sits beside the main action, not on it', async ({ page }) => {
    await openWithOrb(page);
    const c = await orbAtRest(page);
    const buttons = page.locator('button[type=submit]');
    let nearest = Infinity;
    for (const b of await buttons.all()) {
      const r = (await b.boundingBox())!;
      nearest = Math.min(nearest, Math.hypot(c.x - (r.x + r.width / 2), c.y - (r.y + r.height / 2)));
      // Never covering it.
      const inside = c.x > r.x && c.x < r.x + r.width && c.y > r.y && c.y < r.y + r.height;
      expect(inside).toBe(false);
    }
    expect(nearest).toBeLessThan(140);
  });

  test('looks: lists what can be used, never a private value', async ({ page }) => {
    await openWithOrb(page);
    await page.fill('#pw', 'hunter2');
    const view = await page.evaluate(() => (window as any).__orb.hands.look());
    const labels = view.items.map((i: any) => i.label);
    expect(labels).toEqual(expect.arrayContaining(['Travel', 'Fiction', 'Search books', 'Search', 'Your email', 'Password', 'Subscribe']));
    expect(view.items.find((i: any) => i.label === 'Password').value).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('hunter2');
    expect(view.items.find((i: any) => i.label === 'All books').offscreen).toBe(true);
    expect(view.text).toContain('Harbour Books');
  });

  test('types into a box as its caret, and Enter submits the form', async ({ page }) => {
    await openWithOrb(page);
    const id = await page.evaluate(async () => {
      const v = await (window as any).__orb.hands.look();
      return v.items.find((i: any) => i.label === 'Search books').id;
    });
    const result = await page.evaluate(
      (target) => (window as any).__orb.hands.perform({ action: 'type', target, text: 'lisbon', url: null, submit: false, direction: null, why: 'Searching' }, new AbortController().signal),
      id,
    );
    expect(result.ok).toBe(true);
    await expect(page.locator('input[name=q]')).toHaveValue('lisbon');
    // It is the caret of that box now.
    await expect(page.locator('html')).toHaveAttribute('data-orb-caret', '');
    const c = await orbCentre(page);
    const box = (await page.locator('input[name=q]').boundingBox())!;
    expect(c.x).toBeGreaterThan(box.x);
    expect(c.x).toBeLessThan(box.x + box.width);

    await Promise.all([
      page.waitForURL(/search\.html\?q=lisbon/),
      page.evaluate((target) => (window as any).__orb.hands.perform({ action: 'type', target, text: 'lisbon', url: null, submit: true, direction: null, why: '' }, new AbortController().signal), id),
    ]);
    await expect(page.locator('#heading')).toHaveText('Books matching “lisbon”');
  });

  test('refuses to type into a password box', async ({ page }) => {
    await openWithOrb(page);
    const r = await page.evaluate(async () => {
      const o = (window as any).__orb;
      const v = await o.hands.look();
      const target = v.items.find((i: any) => i.label === 'Password').id;
      return o.hands.perform({ action: 'type', target, text: 'secret', url: null, submit: false, direction: null, why: '' }, new AbortController().signal);
    });
    expect(r.ok).toBe(false);
    await expect(page.locator('#pw')).toHaveValue('');
  });

  test('a type step aimed at a button fails without pressing it', async ({ page }) => {
    await openWithOrb(page);
    const r = await page.evaluate(async () => {
      const o = (window as any).__orb;
      const v = await o.hands.look();
      const target = v.items.find((i: any) => i.label === 'Subscribe').id;
      return o.hands.perform({ action: 'type', target, text: 'x', url: null, submit: true, direction: null, why: '' }, new AbortController().signal);
    });
    expect(r.ok).toBe(false);
    await page.waitForTimeout(400);
    await expect(page.locator('#news-done')).toBeHidden();
  });

  test('scrolls the page', async ({ page }) => {
    await openWithOrb(page);
    const r = await page.evaluate(() => (window as any).__orb.hands.perform({ action: 'scroll', target: null, text: null, url: null, submit: null, direction: 'down', why: '' }, new AbortController().signal));
    expect(r.ok).toBe(true);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(200);
  });

  test('drives a goal end to end, asking before a risky press', async ({ page }) => {
    await openWithOrb(page);
    // A scripted planner: the loop, the hands, the confirm and the closing line are all real.
    const done = page.evaluate(async () => {
      const w = window as any;
      const steps = [
        { action: 'type', label: 'Your email', text: 'ana@example.com', submit: false, why: 'Filling in your email' },
        { action: 'tap', label: 'Subscribe', why: 'Subscribing' },
        { action: 'done', text: 'You are on the newsletter list.' },
      ];
      let i = 0;
      const planner = {
        next: async ({ page }: any) => {
          const s = { target: null, text: null, url: null, submit: null, direction: null, why: '', ...steps[i++] } as any;
          if (s.label) s.target = page.items.find((it: any) => it.label === s.label).id;
          return s;
        },
      };
      return w.OrbEmbed.runPilot('Sign me up for the newsletter', { planner, hands: w.__orb.hands, signal: new AbortController().signal });
    });
    // "Subscribe" is risky: the orb's panel asks first.
    const yes = page.locator('orb-companion .orb-confirm button', { hasText: 'Yes, do it' });
    await expect(page.locator('orb-companion .orb-confirm p')).toHaveText('Press “Subscribe”?');
    await expect(page.locator('#email')).toHaveValue('ana@example.com');
    await yes.click();
    expect(await done).toBe('You are on the newsletter list.');
    await expect(page.locator('#news-done')).toBeVisible();
  });

  test('saying no to a risky press stops the run and presses nothing', async ({ page }) => {
    await openWithOrb(page);
    const done = page.evaluate(async () => {
      const w = window as any;
      const planner = { next: async ({ page }: any) => ({ action: 'tap', target: page.items.find((it: any) => it.label === 'Subscribe').id, text: null, url: null, submit: null, direction: null, why: '' }) };
      return w.OrbEmbed.runPilot('Subscribe', { planner, hands: w.__orb.hands, signal: new AbortController().signal });
    });
    await page.locator('orb-companion .orb-confirm button', { hasText: 'No' }).click();
    expect(await done).toContain('stopped before that step');
    await expect(page.locator('#news-done')).toBeHidden();
  });

  test('dragged onto a box and set down, it lands the caret there', async ({ page }) => {
    await openWithOrb(page);
    const c = await orbCentre(page);
    const box = (await page.locator('#email').boundingBox())!;
    const tx = box.x + 30, ty = box.y + box.height / 2;
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(c.x + ((tx - c.x) * i) / 12, c.y + ((ty - c.y) * i) / 12);
    // The orb keeps the offset it was grabbed at: nudge the finger until the ball itself is over the box.
    await page.waitForTimeout(120);
    const now = await orbCentre(page);
    await page.mouse.move(tx + (tx - now.x), ty + (ty - now.y), { steps: 3 });
    await page.waitForTimeout(300); // rests on it: a set-down, not a throw
    await page.mouse.up();
    await expect(page.locator('#email')).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-orb-caret', '');
  });

  test('with no brain, a question gets a plain line and a sleepy face', async ({ page }) => {
    await openWithOrb(page);
    await page.evaluate(() => (window as any).__orb.open());
    await expect(page.locator('orb-companion .orb-layer')).toHaveAttribute('data-face', 'sleepy');
    await page.locator('orb-companion .orb-input').fill('What is this shop?');
    await page.locator('orb-companion .orb-ask button[type=submit]').click();
    await expect(page.locator('orb-companion .orb-log li[data-who=orb]')).toHaveText('There is nothing for me to think with here yet.');
  });
});
