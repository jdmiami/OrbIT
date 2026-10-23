# 06 · Caret and gestures

The orb as the text caret, and everything a finger, a mouse, a trackpad, a shaken phone or a keyboard
can do to it. Every number is from `caret.ts`, `write.ts` and `OrbCursor.tsx`.

---

## Caret mode

### Which fields (`caretField(el, skip)`)

Null if `el` is inside `skip` (`selfEl()`) or inside `[data-own-caret]`. Then:

- `<textarea class="xterm-helper-textarea">` (a terminal) → yes, even read-only
- `<textarea>` → yes unless `readOnly`
- `<input>` → yes if `type` is one of `text, search, url, email, tel, password, number, ""` and not `readOnly`
- `isContentEditable` → yes
- anything else → null

The orb's own ask box is never a caret field: focus inside the shadow root shows on the page as the
host, which is `selfEl()`.

### Measuring (`caretOf(el)`) → `{ x, y, h }`

- Null if the box is under 2×2.
- `h = min(lineHeight, box.height)`, `lineHeight` = computed `line-height` or `fontSize × 1.25`.
- Terminal: the hidden box's rect is the caret; null if outside `.xterm-screen` by more than 1 px.
- Code editor (`.cm-editor`): `.cm-cursor-primary` (or `.cm-cursor`); null if outside `.cm-scroller`.
- `<input>` / `<textarea>`: `caretAt(el, selectionEnd ?? value.length)`.
- contenteditable: the collapsed selection's rect; an empty line uses the line element's left (plus
  `padding-left`) and top; height `max(rect.height, h·0.8)`.

### `caretsAt(el, from, to)` — the hidden copy

A `div` laid out at the box's position copies `boxSizing, width, height, border*Width, padding*,
fontStyle, fontVariant, fontWeight, fontStretch, fontSize, fontFamily, lineHeight, textAlign,
textTransform, textIndent, letterSpacing, wordSpacing, tabSize, wordBreak, overflowWrap, direction`;
`position: fixed`, hidden, `overflow: hidden`, `white-space: pre` (input) or `pre-wrap` +
`overflow-wrap: break-word` (textarea). Passwords become `•` per character. A zero-width-space marker
goes before each position; surrogate pairs are never split.

Scaling fix: `sx = box.width / offsetWidth`, `sy = box.height / offsetHeight`; measured unscaled,
multiplied back.

Top of the line: input → `box.top + (borderTop + paddingTop + max(0, (offsetHeight − borders −
paddings − lineHeight)/2))·sy`; textarea → `box.top + (mark.top − box.top − scrollTop)·sy`.
`x = clamp(box.left + (mark.left − box.left − scrollLeft)·sx, box.left, box.right − 2)`;
`y = clamp(top, box.top, box.bottom − h)`.

### `offsetAt(el, x, y)` — where a dropped orb's caret goes

- RTL text (Hebrew/Arabic range, or `direction: rtl`): binary-search the line, measure every position
  on it, nearest by `|cx − x| + |cy + h/2 − y|·4`.
- Otherwise: binary search for the last position before the point in reading order, then the nearer
  of the two gaps on the same line (`|b.y − a.y| < 1`).

### `syncCaret()`

Called on the next frame after `focusin` (which also re-arms the MutationObserver), `focusout`,
`selectionchange`, `input` and `keydown` (capture; these also set `data-typing` for 650 ms), any
`scroll` (capture), `resize`, and `visualViewport` `resize`/`scroll`. The MutationObserver watches a
terminal's hidden textarea (`style`) and the code editor's `.cm-cursorLayer` (attributes, children,
subtree). While it is the caret, a frame loop also compares the field's rect (rounded to half pixels)
and calls `syncCaret()` when it moves.

With a caret rect `c` and the mode not `drag`/`acting`:

```
caretH = clamp(c.h, 12, 48);  sizeTo(1);  seat = null
cx = c.x + 2.5/2;  cy = c.y + c.h/2            // on the gap before the next letter, halfway down the line
level 'off':                     morph.set(1); x.set(cx); y.set(cy)
entering, or a different field:  flight = { d0: max(1, distance) }; springs → GLIDE; targets = (cx, cy)
already the caret, landed:       springs → CARET; morph.target = 1; targets = (cx, cy)
already the caret, still flying: targets = (cx, cy)
```

Leaving (no rect, mode `caret`): see [05](05-behaviour.md). `data-orb-caret` is removed from
`<html>` (also on unmount). The pilot leaves it on the spot instead, with `dropCaret()`.

### Text insertion (`insertText(el, text)`)

Puts text at the caret (or over the selection) the way typing would: `document.execCommand('insertText')`
when supported; otherwise the native value setter, `setSelectionRange` (skipped for email and number
boxes, which have no selection) and an `input` event; or a text node into the selection range for
contenteditable. Frameworks see it as typing. The pilot's `type` step uses it ([09](09-pilot.md)).

---

## Gestures

All on the `.orb-cursor` button with pointer events (`touch-action: none`; right-click suppressed).
`setPointerCapture` keeps the pointer.

### Pointer down (`button === 0` only)

1. `tracker.reset()`, first sample.
2. `press = { id, x0, y0, cx, cy, tMove, dx: x − clientX, dy: y − clientY, t0, moved: false, deep: false, pinching: false, pinched: false }`.
3. Bind the window-level second-finger listeners.
4. `depth.target = 0.35`.
5. Hold timer: after **420 ms** without moving → `deepPress()`.
6. Ask `DeviceMotionEvent.requestPermission()` where the browser has it (for shake).

### Pointer move

1. Track; update `cx, cy, tMove`.
2. Pinching → `pinchUpdate()`, return.
3. Pressure: `pressure > 0 && pressure !== 0.5` and not moved → `depth.target = 0.35 + pressure·0.6`; `≥ 0.55` → `deepPress()`.
4. Slop: not moved, distance from `(x0, y0)` > **8 px**, not deep → `moved = true`, hold timer cleared, mode `drag`, `sizeTo(1)`, `seat = null`, `onStage = false`, `depth.target = 0.12`, springs → `track`.
5. While moved: `tx = clientX + dx`, `ty = clientY + dy` (the grab offset is kept); `over = pressableAt(tx, ty)`; `setHover(over)`; magnet: if `over` is not a text box and is `< 240` wide and `< 120` tall, `tx += (centreX − tx)·0.3`, `ty += (centreY − ty)·0.3`; `x.target = rubberClamp(tx, v.x + 28, v.x + v.w − 28, v.w·0.25)`, same for y.

`pressableAt` uses `elementsFromPoint` ignoring `selfEl()`; a hit in `.cm-editor` resolves to its
`.cm-content`; else `closest('button, a[href], input, textarea, select, label, summary, [role="button"],
[role="tab"], [role="link"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"],
[role="radio"], [contenteditable="true"]')`; null if disabled, `aria-disabled="true"`, or inside
`[inert]`/`[aria-hidden="true"]`.

### Hover (`setHover(el)`)

Leaving the previous: remove `data-orb-hover`, dispatch `pointerout` + `mouseout` (bubbling,
`relatedTarget` = the new one). Entering: set `data-orb-hover`, dispatch `pointerover` + `mouseover`,
`tick()`, `grow.target = 1.12`, `jelly.velocity += 1.4`, and after **240 ms** a caption with the
control's `aria-label` / `placeholder` / text (whitespace collapsed; over 48 characters → first 47 +
"…"). Leaving everything: `grow.target = 1`, caption cleared. The pilot's `flyTo` uses the same hover.

### Deep press

Once per press: `deep = true`, `cue('pop')`, `depth.target = 0.9`, `jelly.velocity += 4`, open the
panel. A deep press is not a tap and not a drag.

### Pointer up

1. Clear the press, hold timer, second-finger listeners; `depth.target = 0`; remember `over`, `setHover(null)`.
2. After a pinch: `endPinch()`; if also moved, mode `parked`, target clamped inside, `spot = target`. Return.
3. Moved (a drag): `stopped = timeStamp − tMove > 150 ms`; `vel = stopped ? 0 : tracker.velocity()`.
   - Drop to press / drop to type: `over && stopped && now − over.since > 160 ms` → `activate(over.el, x.target, y.target)`. A throw that ends over a button never presses it.
   - Else springs → `land`, velocity = `vel`; speed `< 350` → set down (clamped, `parked`); else `landing()`: tuck → `tucked` at `(right − 14, bottom − 150)` with the tucked line; otherwise `parked` at the landing. `spot = target`; `cue('tap')`.
4. Deep → nothing more.
5. Tap: on a stage that is a `<button>` → `jelly.velocity += 2.5`, click it. `tucked` → mode `follow`/`parked`, `spot = null`, `jelly.velocity += 3`, `rest()`. Otherwise `jelly.velocity += 2.5`; a note and no mic running → open the panel; else `toggleVoice()` (which opens the panel when the brain has no `listen`).

### `activate(el, px, py)` — set down on something

Mode → `follow`/`parked`; springs → `land`; `depth.target = 0.9`, back to `0` after 140 ms;
`jelly.velocity += 2`; `cue('tap')`. Then:

- a text `<input>`/`<textarea>`: `at = offsetAt(el, px, py)` measured **before** focusing; `focus({ preventScroll: true })`; `setSelectionRange(at, at)` (ignored where unsupported). It becomes the caret from there.
- contenteditable: focus, then `caretPositionFromPoint` / `caretRangeFromPoint` at `(px, py)`; collapsed there if inside.
- anything else: `data-orb-pressed` for 260 ms; a `<select>` is focused and `showPicker()`ed (a failure is ignored: only a real gesture may open it); everything else `.click()`ed. After 320 ms, `rest()` if the mode is `follow` or `parked`.

### Pointer cancel

Clear the press and listeners; pinch cancelled (`BOUNCE`, target 1); hover cleared; `depth.target = 0`; `drag` → `parked`.

### Pinch (a second finger anywhere while one holds the orb)

- **down**: `preventDefault`, `stopPropagation`; `pinch = { id, x, y, d0: max(24, distance to the holding finger), r: 1 }`; `pinching = pinched = true`; hold timer and hover cleared; `depth.target = 0.2`.
- **move**: `r = max(0.2, distance / d0)`; `pinch.spring = PINCH_TRACK`; `pinch.target = stretchOf(r)`; caption "Zoom in · text N%" / "Zoom out · text N%", `N = zoomFor(r, textScale)·100`.
- **up/cancel** of that finger → `endPinch()`: `finishZoom(r)`, then swallow the next `click` for 500 ms.
- `touchmove` (non-passive), `gesturestart`, `gesturechange` are prevented while pinching or with more than one touch.

`finishZoom(r)`: `next = zoomFor(r, now)`; if changed, `onTextScale(next)` (or `--text-scale` on
`<html>`); `cue('pop')`; `pinch` → `BOUNCE`, target 1; `jelly.velocity += 2.5`; caption "Text N%",
or "Already the biggest text" / "Already the smallest text", cleared after 1600 ms. In the Orb
Browser `onTextScale` sets the page's zoom factor.

**Trackpad pinch / Ctrl+wheel over the orb**: `acc = clamp(acc·e^(−deltaY·0.01), 0.25, 4)`; same
tracking and caption; `finishZoom(acc)` 200 ms after the last wheel event, then `acc = 1`.

### Shake

`devicemotion` → `ShakeDetector.push(now, ax, ay, az)` → `summon()` ([05](05-behaviour.md)). It also
stops a drive.

### Keyboard

| Keys | Where | Does |
|---|---|---|
| Enter / Space | the orb focused | on a stage button → click it; else `toggleVoice()` |
| Shift + Enter / Space | the orb focused | open the panel |
| Ctrl + Shift + Space | anywhere (capture) | toggle the panel |
| Escape | anywhere, while driving, unless the page already handled it (`defaultPrevented`; listened to in the bubble phase so a page closing its own dialog keeps the run going) | stop the drive (`driving.stop()`) |

The orb's `onClick` ignores pointer clicks (taps go through the pointer handlers) and prevents
keyboard clicks (`detail === 0`), since `keydown` already acted.

Changed from OrbitDesign: Escape is new. The pilot always yields to the person.

See also: [05 · Behaviour](05-behaviour.md) · [07 · Events and the panel](07-events-and-panel.md) · [09 · The pilot](09-pilot.md)
