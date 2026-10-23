# 03 · Anatomy

The orb's sizes, its DOM, how it is drawn each frame, its face, and its stylesheet section by
section. Every value is copied from `src/orb/OrbCursor.tsx`, `OrbFace.tsx`, `orb.css` and `face.css`.

---

## Geometry

| Constant | Value | Where |
|---|---|---|
| `SIZE` | `56` px | the ball's box (`.orb-cursor` is 56×56) |
| `R` | `SIZE / 2 = 28` | its radius; positions are centre points |
| `CARET_W` | `2.5` px | its width as the caret |
| ring | `inset: -5px`, border `1.5px` | `.orb-cursor-ring`, outside the ball |
| caption | 260 px wide, 130 px left of the orb's centre, 82 px above it | `.orb-caption` |
| panel | bottom sheet, `max-width: 460px` | `.orb-panel` |
| z-index | `var(--orb-z, 2147483000)` | `.orb-layer` |
| `MAX_ITEMS` | `150` | most controls one `look()` lists (on-screen first) |

Changed from OrbitDesign: the z-index was `70`. On any website the orb must sit above the page's
own overlays, so it is now near the top of the range and can be set with `--orb-z`.

---

## The layer

```html
<div class="orb-layer" data-theme="dark|light|auto" data-skin="o5|plain"
     data-caret? data-hidden? data-listening? data-running? data-driving? data-face="…"
     data-slim? data-flying? data-typing?
     style="--orb-x: …px; --orb-y: …px">
  <button class="orb-cursor" aria-label="…" aria-expanded="false" style="transform: …; --depth: 0">
    <canvas class="ai-orb ai-orb-gpu orb-cursor-face" />   <!-- or <div class="ai-orb orb-cursor-face"> -->
    <span class="orb-cursor-ring" aria-hidden />
  </button>
  <p class="orb-caption" role="status" aria-live="polite">…</p>        <!-- a caption, panel closed -->
  <div class="orb-panel" role="dialog" aria-label="Ask the orb">…</div> <!-- while open -->
</div>
```

In the embed, this sits inside the shadow root of `<orb-companion>` ([02](02-mounting.md)).

| Attribute | Set when |
|---|---|
| `data-theme` | always: the `theme` prop |
| `data-skin` | always: the `skin` prop |
| `data-caret` | mode is `caret` (React state `caretOn`) |
| `data-hidden` | an `aria-modal="true"` dialog is open that is not the orb's own and has no `[data-orb-spot="stage"]`, or the `hidden` prop is true |
| `data-listening` | the brain's `listen()` is running |
| `data-running` | a question or a goal started in this page is being worked on |
| `data-driving` | a goal is being carried out (`setDriving` was given one, here or by a host) |
| `data-face` | the current expression (below) |
| `data-slim` | `morph.value > 0.2`, written from the frame loop only when it changes |
| `data-flying` | gliding over to become the caret (`flight` is set) |
| `data-typing` | set on every `input` / `keydown` (capture), removed 650 ms after the last one |

The button's `aria-label` is "Orb: listening. Tap to stop." while listening; "Orb: working on
“goal”. Press Escape to stop." while driving (goal clipped to 60 characters); otherwise "Orb: tap
to talk, hold to ask it to do something".

---

## How it is drawn

Every frame the loop writes, on the button:

```
transform: translate3d(x − 28px, y − 28px, 0)
           scale(cw, ch)                                          ← caret morph × grow × pinch
           rotate(angle) scale(s·press, press/s) rotate(−angle)   ← squash along its velocity, press-in
--depth: max(0, depth)
```

and on the layer `--orb-x: x px`, `--orb-y: y px`, which the caption uses. A `useLayoutEffect`
writes the first transform and both variables before the first paint, so it never flashes in a
corner. `--tx` / `--ty` on `<html>` (the page's tilt, −1…1, optional) shift the face by 4 px each
and move the shader's light. The full loop is in [04](04-physics.md).

---

## The face (`OrbFace`)

| Prop | Type | Effect |
|---|---|---|
| `typing` | `boolean` | energy target `1` when true. The orb passes `running \|\| !!driving`. |
| `energy` | `number?` | overrides, clamped to `0.15…1`. The orb passes `energy ?? stageEnergy ?? (running \|\| driving ? 0.8 : undefined)`: mic level, then `orb:energy`, then 0.8 while it works. |
| `resolution` | `number` | `canvas.width = clientWidth × min(2, devicePixelRatio) × resolution`. The orb sets `g > 1.2 ? min(3.5, ceil(g·2)/2) : 1` from `grow`. |
| `face` | `OrbFaceState?` | `{ on, gaze: [x, y], mood (−1…1), talk, sleepy }` |
| `level` | `'full' \| 'lite' \| 'off'` | `full` + WebGL → the shader. Otherwise the CSS sphere; `lite` adds two eyes that follow `gaze` (`translate(gaze.x·18%, −gaze.y·14%)`) and blink; `off` has no eyes. |

Idle energy is `0.25`. The shader eases energy at `dt·6`, face-on at `dt·5`, gaze and mood at
`dt·7`, talk at `dt·10`, sleepy at `dt·3`. It blinks 1500–5000 ms after start, then every
2200–6200 ms; a blink lasts 160 ms (420 ms when sleepy > 0.5). Idle (energy < 0.4, no face) it draws
at most every 32 ms. It does not draw off screen or in a hidden tab. It sets `data-face="on"|"off"`
and `data-live="true"` on the canvas, and `data-fallback="true"` if WebGL fails.

### Expressions

First match wins. Written as `data-face` on the layer.

| `data-face` | When |
|---|---|
| `done` | `moodFlash > 0` (a happy flash, 1800 ms), e.g. after a finished drive |
| `error` | `moodFlash < 0` (a sad flash, 1800 ms), after a failed answer |
| `listening` | the mic is on |
| `thinking` | `running` (a question being answered) or `driving` (a goal being carried out, here or by a host) |
| `speaking` | `talking` (from `say()`, for `min(4000, 600 + len·40)` ms) |
| `sleepy` | the panel is open and the brain is missing or `ready()` returned false |
| `idle` | the panel is open |
| `off` | otherwise: no face is drawn |

```
busyFace = running || listening || !!driving
on     = expression !== 'off' && level !== 'off'
gaze   = running && !talking ? [0.35, 0.45] : [0, 0]      // thinking looks up and aside
mood   = moodFlash || (talking ? 0.35 : busyFace ? 0 : 0.15)
talk   = talking
sleepy = expression === 'sleepy'
```

Changed from OrbitDesign: `busyFace`, `typing` and the 0.8 energy also count `driving`, so the orb
stirs while a host drives it from another process.

---

## The stylesheet, section by section

**Tokens.** `.orb-layer` turns the input tokens into internal ones and defines the dark palette
(`--o-surface #141a2e`, `--o-surface-2 #1b2238`, `--o-surface-3 #232b45`, borders
`rgb(255 255 255 / 0.1)` and `/ 0.18`, text `#eef1fa`, `#b7bfd6`, `#8891ab`). `--o-accent-soft` is
the accent at 18 %, `--o-hair` the text at 12 %. `--o-fs-sm` is `13px × scale`, `--o-fs-md` is
`15px × scale`. `[data-theme='light']` (and `[data-theme='auto']` under
`prefers-color-scheme: light`) swap in `#ffffff`, `#f4f6fb`, `#e8ecf5`, `rgb(15 23 42 / 0.1)` and
`/ 0.2`, `#111827`, `#3d4659`, `#5d6679`. The layer is `position: fixed; inset: 0;
pointer-events: none` and every descendant is `box-sizing: border-box`. `[data-hidden]` fades the
ball and caption to 0 and removes the panel.

**The ball.** `.orb-cursor`: 56×56, round, no background, `pointer-events: auto`,
`touch-action: none`, no selection or callout, `cursor: grab`, `will-change: transform`, opacity
transition 0.25 s. Contact shadow:
`drop-shadow(0 calc(10px − depth·8px) calc(18px − depth·12px) rgb(0 0 0 / calc(0.32 + depth·0.18)))`.
`:focus-visible` shows the ring instead of an outline. `.orb-cursor-face` fills it and parallaxes
4 px with the tilt. `.orb-cursor-ring`: 1.5 px, accent mixed 70 % with white,
`opacity: depth·1.2`, `scale: 1 + depth·0.18`. Listening: it pulses (`orb-listen`, 1.4 s). Running
or driving: dashed and spinning (`orb-spin`, 2.4 s a turn).

**The caption.** 260 px, `left: clamp(12px, orb-x − 130px, 100vw − 272px)`,
`top: max(safe-top + 8px, orb-y − 82px)`, padding 10×14, radius 16, glass (`--o-surface` at 88 %,
`blur(18px) saturate(160%)`), 0.5 px border, rises in over 0.22 s.

**The panel.** 12 px (or the safe inset) from the sides, 8 px above the bottom inset, at most
460 px and centred; flex column, gap 10, padding 14, radius 22, glass (92 %,
`blur(24px) saturate(170%)`), shadow `0 24px 60px rgb(0 0 0 / 0.35)`; springs up over 0.28 s
(`cubic-bezier(0.2, 0.9, 0.25, 1.15)`). Then `.orb-panel-head`, `.orb-panel-title` (600, `--o-fs-md`),
`.orb-note`, `.orb-log` (max 32 vh, scrolls; `you` lines are soft accent bubbles on the right,
`orb` lines muted, `step` lines faint with a 5 px accent dot), `.orb-suggest`, `.orb-ask`,
`.orb-confirm`, `.orb-row` (buttons right-aligned).

**The pilot's bar.** `.orb-drive`: a row with the goal and a Stop button on `--o-accent-soft`,
radius 14; its `b` label is 11 px uppercase, 0.08 em tracking.

**Controls.** `.orb-btn`: 44 px tall, padding 0 16, radius 12, `--o-surface-3`, 600 weight,
presses to 0.97; `[data-kind='primary']` is the accent with `--o-on-accent` (hover: accent mixed
86 % with black); `[data-kind='ghost']` is transparent with a strong border. `.orb-icon-btn`: 44×44,
transparent. `.orb-chip`: 36 px tall pill, `--o-surface-3`, 12 px × scale, 600. `.orb-input`: 44 px
tall, radius 14, strong border, `--o-surface-2`, 16 px text so phones do not zoom, a 2 px accent
outline on focus.

**The magazine skin** (`[data-skin='o5']`, the default). Panel and caption radius 6. Title in the
display face, 400, `24px × scale`, −0.01 em. Buttons are pills on hairlines; primary is ink
(`--o-text` on `--o-surface`); ghost has no border. Icon buttons are round. Chips are outlined. The
input is underlined only (no box), the underline turns to `--o-text` on focus. The drive bar is
between two hairlines.

**Reduced motion.** Ring pulse and spin, panel and caption entrances, and the caret breathing stop.

**The caret.** In `[data-caret]` the ball takes no pointer events (`cursor: text`), and the caption
is hidden. In `[data-slim]` the glow swaps to a 3 px accent halo and the ring hides. Landed, slim
and not typing or flying, it breathes like a caret blink (`orb-caret-breathe`, 1.1 s, 0.4 s delay).

**The page rules** (`orb-page.css`, injected into the document):

```css
:root[data-orb-caret] :is(input, textarea, [contenteditable='true'], [contenteditable='']):focus { caret-color: transparent !important; }
:root[data-orb-caret] .cm-editor.cm-focused .cm-cursorLayer { visibility: hidden; }
:root[data-orb-caret] .xterm.focus .xterm-rows .xterm-cursor { /* transparent, no outline, no animation */ }
[data-orb-hover] { outline: 2px solid color-mix(in srgb, var(--orb-accent, #6c7cff) 60%, transparent) !important; outline-offset: 3px !important; }
[data-orb-pressed] { scale: 0.96; transition: scale 0.12s ease-out; }
```

Every selector is keyed on an attribute only the orb sets, so a page looks the same until the orb
acts on it.

**The face** (`face.css`). `.ai-orb`: a 64 px conic-gradient sphere, spinning 8 s and breathing 4 s.
`.ai-orb-gpu`: the 88 px canvas with −12 px margin and no CSS effects (overridden to 100 % inside
`.orb-cursor`). `.ai-orb-eyes`: the lite eyes, blinking every 4.6 s (sleepy: 7 s, `scaleY(0.45)`).
`.ai-orb-gpu[data-fallback]`: when WebGL fails, the canvas shows the same CSS sphere, round, spinning
and breathing.

Changed from OrbitDesign: the fallback rule is new. In the source port a failed WebGL context set
`data-fallback` but `.ai-orb-gpu` kept `background: none`, so the orb was invisible on machines
without WebGL (and in headless test runs). Removed: the writing-help (`.wh-*`) and "find"
(`.orb-found*`) rules, which belonged to features that were never ported.

See also: [02 · Mounting](02-mounting.md) · [04 · Physics](04-physics.md) · [07 · Events and the panel](07-events-and-panel.md)
