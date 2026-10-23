# 05 · Behaviour

Where the orb is and why: its modes and every transition between them, how it decides what matters
on a screen, and how a page marks what it wants.

---

## Modes

`type Mode = 'follow' | 'parked' | 'tucked' | 'drag' | 'acting' | 'caret'`

| Mode | Meaning |
|---|---|
| `follow` | goes wherever `findFocus` says, re-checked every 700 ms and on page events |
| `parked` | stays where it was put (`spot`), or at `restSpot` when `spot` is null |
| `tucked` | sits half off the right edge (`x = right − R·0.5`, `y = bottom − 150`) |
| `drag` | under the finger |
| `acting` | moving on its own: a shake's summon, or the pilot flying to a control. Attention leaves it alone. |
| `caret` | it is the text caret; `caretMode` holds the mode to return to |

`rest()`: in `follow` → `refocus()`; otherwise `moveTo(spot ?? restSpot, SPRINGS.land)`.

### Every transition

| From | Trigger | To | Exact behaviour |
|---|---|---|---|
| (start) | mount | `follow` if `settings.follow !== false`, else `parked` | starts at `restSpot(viewport, 56)` |
| any | `settings.follow` changes | `follow` / `parked` | `refocus()` |
| `follow`/`parked`/`tucked` | pointer moves > 8 px before a deep press | `drag` | hold timer cleared; `sizeTo(1)`; `seat = null`; `onStage = false`; `depth.target = 0.12`; springs → `track` |
| `drag` | pointer up, finger **stopped** (> 150 ms since last move) over a control it hovered > 160 ms | `follow`/`parked` | `activate(el)` ([06](06-caret-and-gestures.md)) |
| `drag` | pointer up, speed `< 350` px/s | `parked` | target clamped inside `[v.x + R, v.x + v.w − R] × [v.y + R, v.y + v.h − R]`; springs → `land`; velocity = finger velocity (0 if stopped); `spot = target`; `cue('tap')` |
| `drag` | pointer up, speed `≥ 350`, `landing().tuck` false | `parked` | target = `landing()` (nearest side, height kept); `spot = target`; `cue('tap')` |
| `drag` | pointer up, `landing().tuck` true | `tucked` | target `(v.x + v.w − 14, v.y + v.h − 150)`; says "Tucked away. Tap the edge or shake to bring me back."; `spot = target`; `cue('tap')` |
| `drag` (after a pinch) | pointer up | `parked` | target clamped inside; `spot = target`; not a tap, not a throw |
| `drag` | pointer cancel | `parked` | pinch cancelled (`BOUNCE`, target 1); hover cleared; `depth.target = 0` |
| `tucked` | tap | `follow` / `parked` | `spot = null`; `jelly.velocity += 3`; `rest()` |
| `parked`/`tucked` | `orb:home` | `follow` | `spot = null`; `lastFocus = null`; `refocus()` |
| `caret` (returning to `parked`/`tucked`) | `orb:home` | stays `caret`; `caretMode = 'follow'` | it goes home when it stops being the caret |
| `follow`/`drag`/`acting`/`caret` | `orb:home` | no change | — |
| `follow`/`parked`/`tucked` | a field gets focus and `caretOf` returns a rect | `caret` | `caretMode = previous`; `data-orb-caret` on `<html>`; glide ([06](06-caret-and-gestures.md)) |
| `caret` | focus leaves / no rect | `caretMode ?? (follow ? 'follow' : 'parked')` | rounds out in place (`morph.target = 0`, targets = current values), then `rest()` once `morph ≤ 0.3` (polled every 40 ms), springs → `GLIDE` |
| any (not `drag`/`caret`/`acting`) | a `[data-orb-spot="stage"]` is visible | unchanged, `onStage = true` | `jelly.velocity += 1.2` on arrival; `seat = stage`; `sizeTo(size/56)`; `moveTo(centre, GLIDE)` |
| `onStage` | the stage goes away | `onStage = false` | `sizeTo(1)`; if not `follow`, `moveTo(spot ?? restSpot, GLIDE)` |
| any | shake | `acting` for 900 ms, then `follow`/`parked` | aborts a running answer and stops a drive (says "Stopped."); `cue('pop')`; `x.velocity += ±1400`; `y.velocity −= 900`; `jelly.velocity += 5`; `moveTo(v.x + v.w/2, v.y + v.h·0.42, SPRINGS.summon)`; after 900 ms `spot = null`, `rest()` |
| `drag` | `activate()` on a dropped control | `follow`/`parked` | springs → `land`; `depth.target = 0.9` then `0` after 140 ms; `jelly.velocity += 2`; `cue('tap')`; after a press (not a text box) `rest()` after 320 ms if mode is `follow` or `parked` |
| any (incl. `caret`) | the pilot's `perform` (tap/type) → `flyTo(el)` | `acting` | scrolls `el` into view first if needed (450 ms); `dropCaret()`; `sizeTo(1)`; `seat = null`; `onStage = false`; at `full` `jelly.velocity += 1.6`; `moveTo(centre of el, clamped inside, SPRINGS.aim)`; waits until within 6 px (at most 1400 ms); lights `el` up (`setHover`) |
| `acting` (pilot) | after the 260 ms beat on the control | `follow`/`parked` | `activate(el)`: pressed, or dropped into the box to type ([09](09-pilot.md)) |
| `acting` (pilot) | the step is aborted during the flight | `follow`/`parked` | `rest()`; the step reports "Stopped." |
| after an answer or a drive finishes | `run()` finally | `before` (or `follow`/`parked` if `before` was `acting`/`drag`) | after 250 ms: `rest()` then `syncCaret()` |

`dropCaret()` leaves caret mode on the spot, with no drift home first: `caretMode`, the field and
`flight` are cleared, `data-orb-caret` is removed, `morph.target = 0`, `leaving = false`.

Changed from OrbitDesign: the pilot rows are new. The caret's "home" step (after rounding out) now
returns early, and clears `leaving`, when the mode has become `acting` meanwhile, so it does not
fight a pilot flight. A shake also stops a drive.

---

## Attention (`attention.ts`)

`refocus()` runs every **700 ms**, and, debounced by **120 ms**, on `resize`, `visualViewport`
`resize`/`scroll`, any `scroll` (capture), `focusin`, `focusout` and `click` (capture). It first
computes `hidden` (an `aria-modal="true"` dialog that is not the orb's and has no
`[data-orb-spot="stage"]`, or the `hidden` prop). It returns early while `leaving` (rounding out
after caret mode).

### The orb's own element: `selfEl()`

Everything that must ignore the orb (`findFocus`, `coversControl`, the hover hit test, `snapshot`,
`caretField`, the modal check) asks `selfEl()`. In an app that is the layer. Inside a shadow root it
is the **shadow host**, because `elementsFromPoint`, `document.activeElement` and `querySelector` on
the page all stop at the host. Never compare against `layer.current` for this.

Changed from OrbitDesign: the source compared against the layer, which in a shadow root made the orb
hover and avoid itself.

### `findFocus(view, size, self)` — priorities

Returns `{ x, y, el, kind, size? }`. First hit wins.

| # | kind | What | Placement |
|---|---|---|---|
| 0 | `stage` | the first visible `[data-orb-spot="stage"]` | centred, grown to `data-orb-size` (px) or its width |
| 1 | `marked` | `[data-orb-focus]`, newest first | beside it |
| 2 | `typing` | `document.activeElement` if a textarea, an input not button/checkbox/radio/range/submit, or contenteditable, not inside the orb | beside it |
| 3 | `spot` | the first visible `[data-orb-spot]:not([data-orb-spot="stage"])` | centred, grown to `data-orb-size` or its width |
| 4 | `action` | `'[data-orb-focus], .btn.primary, button[type="submit"], .ai-make, .ai-send'`, not disabled, not in the orb, lowest on screen first | beside it |
| 5 | `latest` | `'.ai-msg-assistant, .ag-msg, .sr-shot, .o5-step'`, newest first, last 4 only | beside it |
| 6 | `rest` | `restSpot(view, size)` | `x = view.x + view.w − size/2 − 14`, `y = view.y + view.h − size/2 − 96` |

On a website, `button[type="submit"]` (priority 4) is what usually catches it: the orb waits beside
the form's button.

### `visible(el, view)`

Null unless: width and height ≥ 4; `bottom ≥ view.y + 8`, `top ≤ view.y + view.h − 8`, `right ≥ 0`,
`left ≤ view.w`; `visibility` not hidden, `display` not none, `opacity` not 0; not inside `[inert]`,
`[aria-hidden="true"]` or `[data-hidden="true"]`. A spot or stage must also be on top at its centre
(`elementsFromPoint`, ignoring the orb, returns it or something inside it).

### `besideRect(r, view, size, avoid)`

`gap = 10`, `half = size/2`. Candidates in order: right, top-aligned `(r.right + 10 + half, r.top + half)`;
above, right end `(r.right − half, r.top − 10 − half)`; left `(r.left − 10 − half, r.top + half)`;
below, right end `(r.right − half, r.bottom + 10 + half)`. A candidate must be inside the view with a
4 px margin and `avoid(x, y)` must be false. Null if none fits.

### `coversControl(x, y, size, self)`

Samples the centre and four points `q = size·0.38` away. True if any hit (ignoring the orb) is inside
`button, a, input, textarea, select, [role="button"], [contenteditable="true"]`, or inside
`p, h1, h2, h3, h4, li, blockquote` with text.

### In `refocus()`

- A stage wins whatever the mode, as long as the orb is free (not `drag`/`caret`/`acting`).
- Not `follow`: only resets `grow` to 1 if free and grown.
- `follow`: if `f.el` changed, `lastFocus = f.el` and, at `full`, a nod `jelly.velocity += 1.6`.
  `seat = f.kind === 'spot' ? f.el : null`; `sizeTo(spot size/56 or 1)`; `moveTo(f.x, f.y)` with `SPRINGS.follow`.

---

## Marking a page

| Attribute | On | Value | Effect |
|---|---|---|---|
| `data-orb-focus` | any element | none | priority 1: the orb waits beside it (newest first). Also in the primary list. |
| `data-orb-spot` | an empty element (`OrbSpot`) | `""` or any non-`stage` value | priority 3: the orb sits centred on it, grown to its size |
| `data-orb-spot` | a dialog's orb button | `"stage"` | priority 0: the orb becomes that element whatever its mode; a tap clicks it if it is a `<button>`; an `aria-modal` dialog containing it does not hide the orb; `orb:energy` drives its glow |
| `data-orb-size` | with `data-orb-spot` | px | how big it grows there (`grow = size/56`); defaults to the element's width |
| `data-orb-context` | `<html>` | text | appended after the system prompt of every brain call |
| `data-own-caret` | a field or ancestor | none | the orb never becomes this field's caret |
| `data-no-write-help` | a field or ancestor | none | `writable()` returns null |
| `data-private` | a field or ancestor | none | never read by `screenText`/`snapshot`; `writable()` null; the pilot never types into it |
| `data-hidden` | any | `"true"` | invisible to attention |
| `.btn.primary`, `button[type="submit"]` | buttons | — | priority 4 |

Set by the orb (read-only for the page):

| Attribute | On | When |
|---|---|---|
| `data-orb-caret` | `<html>` | the orb is the caret (the page CSS hides the field's own caret) |
| `data-orb-hover` | the control under a dragged or flying orb | while over it |
| `data-orb-pressed` | the control it was dropped on | 260 ms |
| `--text-scale` | `<html>` | after a pinch, when there is no `onTextScale` |

### Examples

A headline the orb waits beside:

```tsx
<div className="st-qwrap">
  <h2 className="st-q">Where <em>to?</em></h2>
  <OrbSpot />   {/* <span class="st-orb-spot" data-orb-spot="" data-orb-size="52" role="presentation"> */}
</div>
```
```css
.st-qwrap { position: relative; }
.st-orb-spot { position: absolute; top: 0; right: 4px; width: 52px; height: 52px; }
```

A primary button needs nothing: `<button type="submit" class="btn primary">Save the plan</button>`.

A stage (a voice mode; the orb becomes the voice orb and the page drives its glow):

```tsx
<div className="voice" role="dialog" aria-modal="true" aria-label="Voice chat">
  <button type="button" data-orb-spot="stage" data-orb-size="180" onClick={tapOrb} aria-label="Voice orb" />
</div>
```
```ts
useEffect(() => { orbThink(energy); }, [energy]);   // 0.75 speaking, 0.5 thinking, 0.15 paused
useEffect(() => () => orbThink(null), []);
```

Telling the orb what the page is:

```ts
document.documentElement.dataset.orbContext = 'You are the guide inside Compass, which plans a trip one question at a time. The person is at "Where to?".';
```

See also: [04 · Physics](04-physics.md) · [06 · Caret and gestures](06-caret-and-gestures.md) · [09 · The pilot](09-pilot.md)
