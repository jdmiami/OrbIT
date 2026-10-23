# 11 · Checklist

Go through every line before you call orb work done: a change to the orb, a new page that hosts
it, a new brain, a pilot change, a browser change. Report which lines you checked.

## The orb itself

- [ ] Nothing positions the orb by hand. Pages mark what they want (`data-orb-focus`,
      `data-orb-spot` + `data-orb-size`, a `.btn.primary` / `button[type=submit]`) and the orb finds it.
- [ ] It sits beside its target and never covers it, another control, or text being read
      (`coversControl`).
- [ ] Every new number (a spring, a threshold, a timing) is in [04](04-physics.md) or the chapter
      that owns it. Springs are `spring(response, dampingRatio)`; no ad-hoc easing in the frame loop.
- [ ] Anything that must ignore the orb uses `selfEl()` (the shadow host when embedded), never
      `layer.current`.
- [ ] It works at motion **Full**, **Lite** and **Off**: at Off it jumps and nothing animates;
      at Lite there is no squash.
- [ ] Without WebGL the face still shows (the CSS sphere through `data-fallback`).
- [ ] With `brain={null}` everything physical still works, and the face is sleepy in the panel.
- [ ] It never talks on its own: captions come from `orb:say`, a step's `why`, or a hover label.
      What a page wants to tell the person goes in an `orbNote`.

## Styles

- [ ] Orb styles live in `orb.css` under `.orb-layer` and use only `--o-*` tokens. Theming goes
      through the `--orb-*` inputs. No orb rule targets the page except the attribute-keyed rules
      in `orb-page.css`.
- [ ] Controls in the panel use `.orb-btn` / `.orb-icon-btn` / `.orb-chip` / `.orb-input`, never a
      page's `.btn`.
- [ ] Checked on a page with hostile CSS (the playground site has its own `--accent` and `.btn`):
      neither side changes the other.
- [ ] The magazine skin (`data-skin="o5"`) and the plain skin both look right, in dark and light.

## The pilot

- [ ] Every action is done visibly: the orb flies there, the control lights up, a caption says why.
- [ ] Hard-to-undo steps ask first (`needsConfirm`); new risky words are added there with a unit test.
- [ ] Private fields: values never appear in a `PageView`, and typing into one is refused.
- [ ] Only http(s) addresses open (`safeUrl`).
- [ ] Page text is treated as data: nothing in a page can change the goal.
- [ ] Stop, Escape and a shake stop a run at any step, and the orb goes home.
- [ ] `runPilot` unit tests cover the change; an e2e step on the playground covers the hands.

## The browser

- [ ] The key and every model call stay in the main process. Nothing secret crosses to a page.
- [ ] Every IPC handler checks `event.sender`.
- [ ] Views keep `contextIsolation`, `sandbox`, no `nodeIntegration`. The page orb's shadow root is
      closed outside tests.
- [ ] A run survives page loads (the e2e test proves it), and a new page's orb shows the run
      (`setDriving`).

## Phones, accessibility, words

- [ ] 390 × 844 with the keyboard open: the panel and the ask box stay reachable; touch targets
      are at least 44 px; the ask box is 16 px text (no zoom on focus).
- [ ] The orb button has a meaningful `aria-label` (it changes while listening and driving); the
      caption is `role="status"`; the panel is a `dialog`; confirm is an `alertdialog`.
- [ ] Keyboard: Enter/Space on the orb, Shift+Enter for the panel, Ctrl+Shift+Space anywhere,
      Escape stops a run.
- [ ] Plain words in every string. No vendor, model, machine or token names in the orb's own UI.

## Before merging

- [ ] `npm run typecheck`, `npm test` and `npm run e2e` (under `xvfb-run -a` without a display)
      are all green.
- [ ] Screenshots of anything visual (the e2e suite can take them; see [12](12-development.md)).
- [ ] The docs say what the code now does, including a "Changed from OrbitDesign" note where it
      differs from the source.

See also: [12 · Development](12-development.md) · [01 · The orb](01-the-orb.md)
