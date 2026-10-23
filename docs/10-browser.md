# 10 · The Orb Browser

A small desktop browser (Electron) whose every page has the orb in it. You browse as usual and the
orb is your companion on every site. Type a goal into the address bar instead of an address, and
the orb carries it out across pages while you watch.

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-… npm run browser      # or add the key later in Settings (⋯)
```

---

## 1. What you can do

| You | The orb |
|---|---|
| Type an address (`wikipedia.org`, `https://…`, `localhost:3000`) | opens it (bare domains get `https://`) |
| Type anything else ("find a cheap flight to Lisbon on Friday") | carries it out, one visible step at a time; the bar shows *The orb is working on …* with the latest step and **Stop** |
| Tap the orb | it opens its panel (Electron has no speech recognition, so tap-to-talk falls back to the panel) |
| Hold the orb (420 ms) | its panel: ask about the page, or give it a goal |
| Drag the orb onto a button and rest | presses it |
| Drop the orb in a text box | the caret lands there |
| Throw it to a side / off the bottom | it parks / tucks away |
| Pinch it (or Ctrl+scroll over it) | zooms the page (90 % to 130 %) |
| Escape, Stop (bar or panel) | stops whatever it is doing |
| ⋯ | Settings |

The address bar hints which it will do as you type (**↵ Open** or **↵ Ask the orb**).
Cmd/Ctrl+L focuses it.

---

## 2. Architecture

```
 Electron main process (browser/main.ts)
 ├─ settings + key (safeStorage)          ├─ Claude: claudeChat / claudePlanner (browser/claude.ts)
 ├─ runPilot(goal, remote hands)  ◄────── the loop lives here, so it survives page loads
 └─ PageLink: calls into the current page's orb (orb:call / orb:reply)
        │ IPC                                        │ IPC
        ▼                                            ▼
 chrome view (WebContentsView, 56 px)        page view (WebContentsView)
 browser/chrome/chrome.tsx                   any website
 address bar, back/forward, settings         + browser/page-preload.ts (isolated world):
 via browser/chrome-preload.ts                  mountOrb() in a closed shadow root,
                                                a proxy brain (chat → main, drive → main),
                                                the hands answering main's calls
```

One `BaseWindow` holds two `WebContentsView`s. The chrome view is added last, so it is on top.
While Settings is open it grows to cover the whole window (`chrome:overlay`).

Both views run with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. The page
preload runs in the isolated world: a website's scripts share the DOM but cannot reach the orb's
code, the IPC bridge or the key. They see only one `<orb-companion>` element with a closed shadow
root.

New windows (`target=_blank`, `window.open`) open in the same view. Permission requests are
denied except clipboard writes and fullscreen.

---

## 3. IPC

### Page ↔ main

| Channel | Direction | Payload | Meaning |
|---|---|---|---|
| `orb:ready` | page → main | url | the orb is mounted on this document; main sends `settings` and, during a run, `setDriving` |
| `orb:call` | main → page | id, method, args | call the orb: `look`, `perform`, `abort`, `confirm`, `ask`, `say`, `log`, `setDriving`, `settings`, `open` |
| `orb:reply` | page → main | id, ok, value | the result (or the error message) |
| `brain:ready` | page → main (invoke) | | `true` when a key (or test script) is available |
| `brain:chat` | page → main (invoke) | id, messages | stream an answer; resolves when done |
| `brain:delta` | main → page | id, text | a piece of the answer |
| `brain:abort` | page → main | id | stop that answer |
| `pilot:start` | page → main | goal | run a goal (from the orb's panel) |
| `pilot:stop` | page → main | | stop the run (panel Stop, Escape, shake) |
| `pilot:end` | main → page | | the run ended (resolves the page's `drive`) |
| `orb:zoom` | page → main | scale | a pinch landed: `setZoomFactor`, clamped 0.9…1.3 |

Every handler checks `event.sender` is the page view (or the chrome view for `chrome:*`).

### Chrome ↔ main

`chrome:go` (address or goal), `chrome:back`, `chrome:forward`, `chrome:reload` (stops while
loading), `chrome:drive`, `chrome:stop`, `chrome:overlay`, `chrome:settings`, `chrome:key`
(invoke; encrypts with `safeStorage`, refuses when the OS has no keychain), `chrome:state?`.
Main pushes `chrome:state` (url, title, loading, canBack, canForward, driving `{ goal, line }`,
lastLine, hasKey, keySaved, settings) on every navigation, step and settings change.

---

## 4. A run, step by step

1. You type a goal in the bar (or the orb's panel); main's `startPilot(goal)` aborts any older run.
2. Main tells the page's orb `setDriving(goal)`.
3. `runPilot` with the remote hands (see [09 §6](09-pilot.md)): look (wait for load and the orb),
   screenshot, plan with Claude, confirm in the page if risky, perform in the page (or `loadURL`/
   `goBack` in main).
4. When a page is replaced, its orb is gone mid-call. The call fails with `Navigated`, which a tap
   treats as success. The next page's orb sends `orb:ready` and gets `setDriving(goal)` again.
5. At the end main waits briefly for the page to settle, then `setDriving(null)`, `say(line)`, and
   `pilot:end`. The bar shows the address again.

---

## 5. Settings (`orb-settings.json` in the profile folder)

| Setting | Values | Default |
|---|---|---|
| API key | encrypted with the OS keychain (`safeStorage`); else `ANTHROPIC_API_KEY` | none |
| Model | Opus 5.5, Sonnet 5.5, Haiku 5.5 | Opus 5.5 |
| Effort per step | Quick (`low`), Balanced (`medium`), Careful (`high`) | Balanced |
| Follows what matters | on/off (the orb's `settings.follow`) | on |
| Sounds | on/off | on |
| Motion | Full, Lite, Off | Full |
| Colours | Dark, Light (the bar and the orb) | Dark |

Without a key the orb still does everything physical. Asking or driving says what to do, and the
bar shows **Add a key**.

### Environment

| Variable | Use |
|---|---|
| `ANTHROPIC_API_KEY` | the key when none is saved |
| `ORB_START_URL` | the first page (default: `playground/site/index.html`) |
| `ORB_USER_DATA` | a profile folder (tests use a fresh temp folder) |
| `ORB_TEST_STEPS` | a JSON array of steps played back instead of a model (tests). A step may name its control with `label` instead of `target`. Also opens the page orb's shadow root so tests can press its buttons. |

---

## 6. Testing it

`test/e2e/browser.spec.ts` launches the real browser with Playwright's Electron support. It types
a goal into the bar and checks the whole run on the playground bookshop: search, open a book, pick
the hardback, confirm in the page, buy. That is three page loads with the loop in main. On a
Linux machine without a display, run it under `xvfb-run -a`. Without WebGL (as under Xvfb) the
orb's face falls back to the CSS sphere.

---

## 7. Next steps (not built yet)

- **Tabs.** Today there is one page view; the pilot always drives the visible one.
- **Trusted input.** Taps use `el.click()` and typing uses `execCommand`. A few sites check
  `isTrusted`; main could send real input with `webContents.sendInputEvent` at the coordinates the
  page reports.
- **Voice in.** Electron has no Web Speech recognition. Plug a speech-to-text service into
  `brain.listen`.
- **Packaging.** Add electron-builder (or Forge) for installers, code signing and auto-update.
- **Extension.** The same embed bundle and remote-hands design fit a Chrome extension (content
  script = page preload, service worker = main).

See also: [09 · The pilot](09-pilot.md) · [08 · The brain](08-brain.md) · [12 · Development](12-development.md)
