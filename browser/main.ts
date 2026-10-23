/**
 * The Orb Browser: a small browser whose every page has the orb in it. The window holds two views:
 * the chrome (address bar, back/forward, settings) on top and the page below. A preload puts the orb
 * on every page (browser/page-preload.ts); the pilot loop lives HERE, so a goal keeps going while
 * pages load, and it reaches whichever page is showing through a PageLink. The key and the model
 * calls stay in this process; pages only ever see answers.
 *
 * Environment (all optional):
 *   ANTHROPIC_API_KEY   used when no key is saved in Settings
 *   ORB_START_URL       the first page (default: the bundled bookshop playground)
 *   ORB_TEST_STEPS      a JSON array of pilot steps, played back instead of asking a model (tests)
 *   ORB_USER_DATA       a profile folder (tests use a fresh one)
 */
import { app, BaseWindow, WebContentsView, ipcMain, safeStorage, shell, type WebContents } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runPilot } from '../src/pilot/run';
import { safeUrl } from '../src/pilot/safety';
import { toStep } from '../src/pilot/prompt';
import type { Hands, PageView, Planner, Step, StepResult } from '../src/pilot/types';
import { looksLikeAddress, toAddress } from './address';
import { claudeChat, claudeClient, claudePlanner, DEFAULT_MODEL, type Effort } from './claude';

if (process.env.ORB_USER_DATA) app.setPath('userData', process.env.ORB_USER_DATA);

const HERE = __dirname; // dist/browser
const CHROME_H = 56;

// ---------------------------------------------------------------- settings

interface Settings {
  model: string;
  effort: Effort;
  follow: boolean;
  sound: boolean;
  level: 'full' | 'lite' | 'off';
  theme: 'dark' | 'light';
  /** The API key, encrypted by the OS keychain (safeStorage), base64. */
  keyEnc?: string;
}
const DEFAULTS: Settings = { model: DEFAULT_MODEL, effort: 'medium', follow: true, sound: true, level: 'full', theme: 'dark' };
const settingsFile = () => path.join(app.getPath('userData'), 'orb-settings.json');
let settings: Settings = { ...DEFAULTS };
function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(readFileSync(settingsFile(), 'utf8')) };
  } catch {
    settings = { ...DEFAULTS };
  }
}
function saveSettings() {
  mkdirSync(path.dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}
function apiKey(): string | undefined {
  if (settings.keyEnc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(settings.keyEnc, 'base64'));
    } catch {
      /* the keychain changed: fall through to the environment */
    }
  }
  return process.env.ANTHROPIC_API_KEY || undefined;
}
const testSteps = process.env.ORB_TEST_STEPS ? (JSON.parse(process.env.ORB_TEST_STEPS) as unknown[]) : null;
const hasBrain = () => !!testSteps || !!apiKey() || !!process.env.ANTHROPIC_AUTH_TOKEN;
/** What the orb in a page is told about its settings. */
const orbSettings = () => ({ follow: settings.follow, sound: settings.sound, haptics: false, level: settings.level, theme: settings.theme });

// ---------------------------------------------------------------- the link to the page's orb

class Navigated extends Error {}

/**
 * Calls into the orb of whatever page the view shows now. A call made while the page navigates away
 * fails with Navigated (a tap that opened a new page did its job).
 */
class PageLink {
  ready = false;
  private seq = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer?: NodeJS.Timeout }>();
  constructor(readonly wc: WebContents, onReady: () => void) {
    wc.on('did-start-navigation', (e) => {
      if (e.isMainFrame && !e.isSameDocument) {
        this.ready = false;
        this.failAll(new Navigated('A new page opened.'));
      }
    });
    ipcMain.on('orb:ready', (e) => {
      if (e.sender !== wc) return;
      this.ready = true;
      onReady();
    });
    ipcMain.on('orb:reply', (e, id: number, ok: boolean, value: unknown) => {
      if (e.sender !== wc) return;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      clearTimeout(p.timer);
      if (ok) p.resolve(value);
      else p.reject(new Error(String(value)));
    });
  }
  call<T>(method: string, args: unknown[] = [], timeoutMs = 20000): Promise<T> {
    if (!this.ready) return Promise.reject(new Error('The orb is not on this page yet.'));
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      const timer = timeoutMs ? setTimeout(() => (this.pending.delete(id), reject(new Error('The page did not answer.'))), timeoutMs) : undefined;
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.wc.send('orb:call', id, method, args);
    });
  }
  /** Fire and forget. */
  tell(method: string, args: unknown[] = []) {
    this.call(method, args, 5000).catch(() => {});
  }
  private failAll(err: Error) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }
  /** Wait until the page has loaded and its orb is up (false if that does not happen in time). */
  async settled(timeoutMs = 15000): Promise<boolean> {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (!this.wc.isLoading() && this.ready) {
        await sleep(250);
        if (!this.wc.isLoading() && this.ready) return true;
      }
      await sleep(100);
    }
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- the window

let win: BaseWindow;
let chromeView: WebContentsView;
let pageView: WebContentsView;
let link: PageLink;
let overlay = false;

function layout() {
  const { width, height } = win.getContentBounds();
  chromeView.setBounds({ x: 0, y: 0, width, height: overlay ? height : CHROME_H });
  pageView.setBounds({ x: 0, y: CHROME_H, width, height: Math.max(0, height - CHROME_H) });
}

function startUrl(): string {
  if (process.env.ORB_START_URL) return process.env.ORB_START_URL;
  const local = path.join(HERE, '..', '..', 'playground', 'site', 'index.html');
  return existsSync(local) ? pathToFileURL(local).toString() : 'https://www.wikipedia.org/';
}

// ---------------------------------------------------------------- the pilot, run from here

let run: { goal: string; ctrl: AbortController; line?: string } | null = null;

function planner(): Planner {
  if (testSteps) {
    let i = 0;
    return {
      next: async ({ page }) => {
        const raw = { ...(testSteps[i++] as Record<string, unknown>) };
        // A test step may name its control by label (item numbers depend on the page's layout).
        if (typeof raw.label === 'string') raw.target = page.items.find((it) => it.label === raw.label)?.id ?? -1;
        return toStep(raw) ?? { action: 'done', target: null, text: 'The test script ran out.', url: null, submit: null, direction: null, why: '' };
      },
    };
  }
  return claudePlanner(claudeClient({ apiKey: apiKey() }), { model: settings.model, effort: settings.effort });
}

const verb = (s: Step) => (s.action === 'type' ? 'Typed' : s.action === 'tap' ? 'Tapped' : 'Done');

function blankView(): PageView {
  return { url: link.wc.getURL(), title: link.wc.getTitle(), items: [], text: '(The orb cannot see inside this page.)', scroll: { at: 0, more: false } };
}

const hands: Hands = {
  async look() {
    if (!(await link.settled())) return blankView();
    return link.call<PageView>('look').catch(() => blankView());
  },
  async perform(step, signal): Promise<StepResult> {
    const wc = link.wc;
    if (step.action === 'go') {
      const url = safeUrl(step.url);
      if (!url) return { ok: false, note: `“${step.url}” is not a web address I can open.` };
      link.tell('perform', [{ ...step, action: 'wait' }]); // shows the step's line while it loads
      try {
        await wc.loadURL(url);
      } catch (err) {
        return { ok: false, note: `That page did not open (${(err as Error).message.split(' (')[0]}).` };
      }
      await link.settled();
      return { ok: true, note: `Opened ${wc.getURL()}` };
    }
    if (step.action === 'back') {
      if (!wc.navigationHistory.canGoBack()) return { ok: false, note: 'There is no page to go back to.' };
      wc.navigationHistory.goBack();
      await sleep(300);
      await link.settled();
      return { ok: true, note: 'Went back.' };
    }
    const onAbort = () => link.tell('abort');
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const result = await link.call<StepResult>('perform', [step], 30000);
      // A tap often starts loading something: let it begin before looking again.
      await sleep(400);
      return result;
    } catch (err) {
      if (err instanceof Navigated) return { ok: true, note: `${verb(step)}; a new page opened.` };
      return { ok: false, note: (err as Error).message };
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  },
  async confirm(question) {
    await link.settled();
    return link.call<boolean>('confirm', [question], 0).catch(() => false);
  },
  async ask(question) {
    await link.settled();
    return link.call<string | null>('ask', [question], 0).catch(() => null);
  },
  say: (line) => link.tell('say', [line]),
  log: (line) => {
    if (run) run.line = line;
    pushState();
    link.tell('log', [line]);
  },
  async screenshot() {
    if (testSteps) return null;
    const img = await link.wc.capturePage();
    const size = img.getSize();
    if (!size.width) return null;
    const small = size.width > 1280 ? img.resize({ width: 1280 }) : img;
    return { mediaType: 'image/jpeg', data: small.toJPEG(72).toString('base64') };
  },
};

async function startPilot(goal: string) {
  goal = goal.trim();
  if (!goal) return;
  run?.ctrl.abort();
  const mine = { goal, ctrl: new AbortController() as AbortController, line: undefined as string | undefined };
  run = mine;
  pushState();
  link.tell('setDriving', [goal]);
  let line: string;
  try {
    line = hasBrain() ? await runPilot(goal, { planner: planner(), hands, signal: mine.ctrl.signal }) : 'I need an API key to do things for you. Add one in Settings (the ⋯ button).';
  } catch (err) {
    line = mine.ctrl.signal.aborted ? 'Stopped.' : `Something went wrong: ${(err as Error).message}`;
  }
  if (run !== mine) return; // a newer goal replaced this one
  run = null;
  await link.settled(4000);
  link.tell('setDriving', [null]);
  link.tell('say', [line]);
  link.wc.send('pilot:end');
  lastLine = line;
  pushState();
}
let lastLine = '';

function stopPilot() {
  run?.ctrl.abort();
}

// ---------------------------------------------------------------- the chrome's state

function pushState() {
  if (!chromeView || chromeView.webContents.isDestroyed()) return;
  const wc = pageView.webContents;
  chromeView.webContents.send('chrome:state', {
    url: wc.getURL(),
    title: wc.getTitle(),
    loading: wc.isLoading(),
    canBack: wc.navigationHistory.canGoBack(),
    canForward: wc.navigationHistory.canGoForward(),
    driving: run ? { goal: run.goal, line: run.line ?? null } : null,
    lastLine,
    hasKey: hasBrain(),
    keySaved: !!settings.keyEnc,
    settings: { model: settings.model, effort: settings.effort, follow: settings.follow, sound: settings.sound, level: settings.level, theme: settings.theme },
  });
}

// ---------------------------------------------------------------- wiring

function wire() {
  const wc = pageView.webContents;
  link = new PageLink(wc, () => {
    link.tell('settings', [orbSettings(), wc.getZoomFactor()]);
    if (run) link.tell('setDriving', [run.goal]);
  });
  for (const ev of ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated'] as const) wc.on(ev as 'did-stop-loading', pushState);
  // One page at a time: links that want a new window open here.
  wc.setWindowOpenHandler(({ url }) => {
    if (safeUrl(url)) void wc.loadURL(url);
    return { action: 'deny' };
  });
  wc.session.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write' || permission === 'fullscreen'));

  // From the orb in the page.
  ipcMain.handle('brain:ready', (e) => (e.sender === wc ? hasBrain() : false));
  const chats = new Map<number, AbortController>();
  ipcMain.handle('brain:chat', async (e, id: number, messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) => {
    if (e.sender !== wc) return;
    const ctrl = new AbortController();
    chats.set(id, ctrl);
    try {
      if (testSteps) e.sender.send('brain:delta', id, 'This is the test brain answering.');
      else await claudeChat(claudeClient({ apiKey: apiKey() }), { model: settings.model }, messages, (d) => e.sender.send('brain:delta', id, d), ctrl.signal);
    } finally {
      chats.delete(id);
    }
  });
  ipcMain.on('brain:abort', (_e, id: number) => chats.get(id)?.abort());
  ipcMain.on('pilot:start', (e, goal: string) => e.sender === wc && void startPilot(goal));
  ipcMain.on('pilot:stop', () => stopPilot());
  ipcMain.on('orb:zoom', (e, scale: number) => {
    if (e.sender === wc && Number.isFinite(scale)) wc.setZoomFactor(Math.min(1.3, Math.max(0.9, scale)));
  });

  // From the chrome.
  const fromChrome = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => e.sender === chromeView.webContents;
  // The address bar: an address opens, anything else is a goal for the orb.
  ipcMain.on('chrome:go', (e, text: string) => {
    if (!fromChrome(e) || !text.trim()) return;
    if (looksLikeAddress(text)) void wc.loadURL(toAddress(text)).catch(() => {});
    else void startPilot(text);
  });
  ipcMain.on('chrome:back', (e) => fromChrome(e) && wc.navigationHistory.canGoBack() && wc.navigationHistory.goBack());
  ipcMain.on('chrome:forward', (e) => fromChrome(e) && wc.navigationHistory.canGoForward() && wc.navigationHistory.goForward());
  ipcMain.on('chrome:reload', (e) => fromChrome(e) && (wc.isLoading() ? wc.stop() : wc.reload()));
  ipcMain.on('chrome:drive', (e, goal: string) => fromChrome(e) && void startPilot(goal));
  ipcMain.on('chrome:stop', (e) => fromChrome(e) && stopPilot());
  ipcMain.on('chrome:overlay', (e, on: boolean) => {
    if (!fromChrome(e)) return;
    overlay = !!on;
    layout();
  });
  ipcMain.on('chrome:state?', (e) => fromChrome(e) && pushState());
  ipcMain.on('chrome:settings', (e, next: Partial<Settings>) => {
    if (!fromChrome(e)) return;
    const { keyEnc: _ignored, ...allowed } = next;
    void _ignored;
    settings = { ...settings, ...allowed };
    saveSettings();
    link.tell('settings', [orbSettings(), wc.getZoomFactor()]);
    pushState();
  });
  ipcMain.handle('chrome:key', (e, key: string | null) => {
    if (!fromChrome(e)) return { ok: false, why: '' };
    if (!key) {
      delete settings.keyEnc;
      saveSettings();
      pushState();
      return { ok: true };
    }
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, why: 'This computer has no keychain to keep the key safe. Start the browser with ANTHROPIC_API_KEY set instead.' };
    settings.keyEnc = safeStorage.encryptString(key.trim()).toString('base64');
    saveSettings();
    pushState();
    return { ok: true };
  });
  ipcMain.on('chrome:open-external', (e, url: string) => fromChrome(e) && safeUrl(url) && void shell.openExternal(url));
}

app.whenReady().then(() => {
  loadSettings();
  win = new BaseWindow({ width: 1280, height: 860, minWidth: 420, minHeight: 480, backgroundColor: '#0b1020', title: 'Orb' });
  chromeView = new WebContentsView({
    webPreferences: { preload: path.join(HERE, 'chrome-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  chromeView.setBackgroundColor('#00000000');
  pageView = new WebContentsView({
    webPreferences: {
      preload: path.join(HERE, 'page-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      additionalArguments: testSteps ? ['--orb-test'] : [],
    },
  });
  // The page under the chrome: the chrome is added last so its settings sheet can cover the page.
  win.contentView.addChildView(pageView);
  win.contentView.addChildView(chromeView);
  layout();
  win.on('resize', layout);
  wire();
  void chromeView.webContents.loadFile(path.join(HERE, 'chrome', 'index.html'));
  void pageView.webContents.loadURL(startUrl());
  win.on('closed', () => app.quit());
});

app.on('window-all-closed', () => app.quit());
