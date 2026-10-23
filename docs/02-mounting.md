# 02 · Mounting

How to put the orb on a screen: inside a React app, or on any page through the embed. Then every
prop, the handle a host gets back, theming, and what each file in `src/orb/` is.

---

## In a React app

```tsx
import { OrbCursor, type OrbBrain } from './orb';
import './orb/face.css';      // 1. the CSS sphere and the GPU canvas's sizing
import './orb/orb.css';       // 2. the orb itself (must come after face.css)
import './orb/orb-page.css';  // 3. the page-level rules: hover outline, press, hidden field caret

const brain: OrbBrain | null = null; // or an adapter: docs/08-brain.md

<OrbCursor brain={brain} settings={{ follow: true, sound: true, haptics: true, level: 'full' }} />
```

Mount it once, last in the tree. The layer is `position: fixed` over the whole viewport with
`pointer-events: none`, so it blocks nothing. Only the ball and the panel take pointer events.

The three CSS files must load in this order. `orb.css` sizes and rounds the cursor's face, and must
beat the `.ai-orb-gpu` rule in `face.css`.

## On any page (the embed)

```ts
import { mountOrb } from './embed/mount';

const orb = mountOrb({ brain });        // returns at once
const handle = await orb.ready;         // OrbHandle
orb.update({ settings: { sound: true } });
orb.unmount();
```

Or with no build step, from the bundle `dist/embed/orb.js` (global `OrbEmbed`):

```html
<script src="orb.js"></script>
<script>
  const brain = OrbEmbed.httpChatBrain({ url: '/api/chat', model: 'my-model' });
  brain.drive = OrbEmbed.driveWith(OrbEmbed.chatPlanner(brain));
  OrbEmbed.mountOrb({ brain });
</script>
```

What `mountOrb` does:

1. Adds `orb-page.css` to the document once, as `<style id="orb-companion-page-css">` in `<head>`
   (or `<html>` if there is no head).
2. Creates one `<orb-companion>` element with
   `all: initial; position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 2147483000;`.
3. Attaches a shadow root, `mode: options.shadowMode ?? 'closed'`. Inside it go one `<style>` with
   `face.css` then `orb.css`, and the React root.
4. Appends the host to `options.parent ?? document.documentElement`. On `<html>`, a page that
   replaces `<body>` keeps the orb.
5. Watches the parent with a `MutationObserver` (`childList`). If the host is removed, it is put back.

The page's CSS cannot reach the orb, and the orb's CSS cannot reach the page. Only the
attribute-keyed rules in `orb-page.css` touch the page.

`shadowMode: 'open'` is for tests and devtools only. Closed keeps page scripts out of the orb.

### `MountOptions`

Every `OrbCursor` prop except `brain` and `onReady`, plus:

| Option | Type | Default | Meaning |
|---|---|---|---|
| `brain` | `OrbBrain \| null` | `null` | The adapter. |
| `parent` | `Element` | `document.documentElement` | Where the host element goes. |
| `shadowMode` | `ShadowRootMode` | `'closed'` | `'open'` lets tests look inside. |

### `MountedOrb`

| Field | Type | Meaning |
|---|---|---|
| `ready` | `Promise<OrbHandle>` | Resolves once the orb is drawn (from `onReady`). |
| `update(next)` | `(Partial<MountOptions>) => void` | Merge props and re-render (settings, brain, theme…). |
| `unmount()` | `() => void` | Stop watching, unmount React, remove the host. |
| `host` | `HTMLElement` | The `<orb-companion>` element. |

---

## `OrbCursor` props

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `brain` | `OrbBrain \| null` | required | The adapter. `null` = no intelligence. |
| `settings.follow` | `boolean` | `true` | Follow what matters. `false` = it stays where it is put. |
| `settings.sound` | `boolean` | `false` | Play the synthesised cues. |
| `settings.haptics` | `boolean` | `false` | Vibrate on cues, and `tick()` when passing over a control. |
| `settings.level` | `'full' \| 'lite' \| 'off'` | `'full'` | Motion level: springs + squash + GPU face / springs + CSS face with eyes / jumps, no face. |
| `settings.textScale` | `number` | `1` | The current text scale (0.9…1.3) a pinch steps from. |
| `onTextScale` | `(scale: number) => void` | — | A pinch landed on a new scale. When absent, the orb sets `--text-scale` on `<html>`. |
| `hidden` | `boolean` | `false` | Hide it. A dialog with `aria-modal="true"` hides it on its own. |
| `suggestions` | `string[]` | `['Explain this screen', 'What can I do here?']` | Chips in an empty panel. |
| `explainPrompt` | `string` | `EXPLAIN_PROMPT` | System prompt for "explain this screen". `data-orb-context` is appended. |
| `askPrompt` | `string` | `ASK_PROMPT` | System prompt for any other question when the brain cannot drive. |
| `theme` | `'dark' \| 'light' \| 'auto'` | `'dark'` | Colours. `auto` follows `prefers-color-scheme`. |
| `skin` | `'o5' \| 'plain'` | `'o5'` | `o5`: the magazine skin (square corners, display title, ink buttons). `plain`: rounded glass. |
| `placeholder` | `string` | `'Ask me, or tell me what to do…'` | The ask box's placeholder. |
| `onReady` | `(orb: OrbHandle) => void` | — | Called once after mounting with the handle. |

`settings.sound` and `settings.haptics` go to `configureFeedback` whenever they change.

Changed from OrbitDesign: `theme`, `skin`, `placeholder` and `onReady` are new. `skin` was read
from `<html data-skin>`; now it is a prop written to the layer. The placeholder was
"Ask about this screen…".

### `OrbHandle`

What a host can do with a mounted orb. One stable object; its methods always reach the latest state.

| Member | Meaning |
|---|---|
| `hands` | The pilot's hands for this page: `look`, `perform`, `confirm`, `ask`, `say`, `log` ([09](09-pilot.md)). |
| `say(line)` | A caption, and a line in the panel's log. |
| `setDriving(d)` | `{ goal, stop() }` shows a goal being carried out: the dashed spinning ring, and "Working on" with a Stop button in the panel. `null` clears it. |
| `open()` / `close()` | Open or close the panel. `close()` also answers a pending confirm `false` and a pending question `null`. |

---

## Theming

The orb defines all its colours on `.orb-layer`, so nothing leaks into the page. Theme it from
outside by setting these input tokens on any ancestor or on `:root`:

| Input token | Default |
|---|---|
| `--orb-accent` | `#6c7cff` |
| `--orb-font-ui` | `'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `--orb-font-display` | `'Fraunces Variable', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif` |
| `--orb-text-scale` | `1` |
| `--orb-z` | `2147483000` |

Inside, the stylesheet works from internal `--o-*` tokens (`--o-accent`, `--o-surface`,
`--o-surface-2`, `--o-surface-3`, `--o-border`, `--o-border-strong`, `--o-text`, `--o-text-2`,
`--o-text-3`, `--o-on-accent`, `--o-accent-soft`, `--o-hair`, `--o-fs-sm`, `--o-fs-md`). Do not set
those from outside. Use the inputs, `data-theme` and `data-skin`.

`orb-page.css` uses literal colours with an `--orb-accent` override, because the page has none of
the orb's tokens.

Changed from OrbitDesign: the orb used the app's global tokens (`--accent`, `--surface`, `--text`…)
from `:root` and the app's `.btn`, `.chip`, `.input`, `.icon-btn`. Now it carries its own tokens and
its own controls (`.orb-btn`, `.orb-chip`, `.orb-input`, `.orb-icon-btn`), so it works in a shadow
root on any website.

---

## The files

| File | What it is | From OrbitDesign |
|---|---|---|
| `OrbCursor.tsx` | The component: frame loop, modes, attention, caret, gestures, captions, notes, panel, and the pilot's hands. | `src/orb/OrbCursor.tsx`, plus `selfEl`, theme/skin, the hands, `drive`, ask/confirm for the pilot, `OrbHandle`. |
| `OrbFace.tsx` | The drawn face: WebGL shader, CSS fallback. | `src/orb/OrbFace.tsx`, unchanged. |
| `physics.ts` | Springs, momentum, rubber band, squash, landing, shake, deep press. | `src/orb/physics.ts`, plus `SPRINGS.aim`. |
| `attention.ts` | Where to go: `findFocus`, `besideRect`, `coversControl`, `restSpot`. | unchanged. |
| `caret.ts` | Measuring the text caret: `caretField`, `caretOf`, `caretsAt`, `caretAt`, `offsetAt`. | unchanged. |
| `write.ts` | `labelOf`, `privateField`, `writable`, `textOf`, `caretAtEnd`, `selectionIn`, `insertText`. | `src/orb/write.ts`, minus the unported writing-help prompts (ghost text, rewrites). |
| `screen.ts` | `screenText`, `snapshot`, `isExplain`, `EXPLAIN_PROMPT`. | `src/orb/screen.ts`; `EXPLAIN_PROMPT` no longer names Orbit. |
| `events.tsx` | Typed helpers for the window events, and `OrbSpot`. | `src/orb/events.tsx`. |
| `feedback.ts` | `cue()`, `tick()`, `configureFeedback()`. | `src/motion/feedback.ts`. |
| `level.ts` | `MotionLevel`, `systemLevel()`. | the type from `src/motion/level.ts`; `systemLevel` is new. |
| `orb.css` | The orb's stylesheet, self-contained. | `src/orb/orb.css`, rewritten (own tokens and controls, page rules moved out, unported rules removed). |
| `orb-page.css` | The page-level rules (caret hiding, hover outline, press). | new: split out of `orb.css`. |
| `face.css` | The CSS sphere, the GPU canvas's sizing, the WebGL fallback. | `src/orb/face.css`, plus the `[data-fallback]` rule. |
| `index.ts` | Re-exports. | — |

Left behind on purpose: the flow engine, the components, the motion provider, the app stylesheets
and the example app. The orb needs none of them.

See also: [01 · The orb](01-the-orb.md) · [03 · Anatomy](03-anatomy.md) · [08 · The brain](08-brain.md)
