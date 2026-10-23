# 07 · Events and the panel

How a page talks to the orb and hears back, what the orb says and for how long, and its panel from
top to bottom, including how a goal uses it. Everything here is in `events.tsx` and `OrbCursor.tsx`.

---

## From the page to the orb

All `window` CustomEvents, so any framework (or none) can send them. The helpers in `events.tsx`
(also `OrbEmbed.orbSay` etc.) are typed wrappers.

| Event | Helper | `detail` | Behaviour |
|---|---|---|---|
| `orb:say` | `orbSay(line)` | `string` | trimmed, ignored if empty → `say(line)` |
| `orb:energy` | `orbThink(n)` | `number` (0…1) or `null` | the face's stage energy (`null` → idle) |
| `orb:home` | `orbHome()` | — | `parked`/`tucked` → `follow` with `spot = null`, `lastFocus = null`, `refocus()`. In `caret` mode returning to `parked`/`tucked`, it goes home after leaving the caret. Never pulls it out of a drag or a box being typed in. |
| `orb:note` | `orbNote(text, act?)` | `{ text, act?: { label, id } }` or `null` | kept as the note (ignored unless `text` is a non-empty string) |
| `orb:run` | `orbRun(goal)` | `string` | opens the panel and `run(goal)` (answered, or driven if the brain can drive) |

## From the orb to the page

| Event | `detail` | When |
|---|---|---|
| `orb:act` | the note's `act.id` | the note's button is pressed (the panel closes). Listen with `onOrbAct(handler)`. |
| `pointerover`/`mouseover`, `pointerout`/`mouseout` | — | on controls as a dragged or flying orb passes over them |
| `click` | — | on the control it is set down on or taps for the pilot; on a stage button when tapped |

In the embed and the Orb Browser the orb lives in a preload or shadow root, but these are DOM
events, so a page's listeners still hear them. In the Orb Browser's isolated world, object
`detail`s from page scripts may not cross; strings do.

## `say(text, spoken)`

- appends `{ who: 'orb', text }` to the log (keeps the last 30 + this one)
- `talking = true` for `min(4000, 600 + text.length·40)` ms
- caption = text for `min(9000, 2200 + text.length·45)` ms (replacing any pending caption timer)
- if `spoken` and the brain has `speak`, `brain.speak(text)`

Captions are hidden while the panel is open (`caption && !panel`) and in caret mode (CSS). The
pilot's `perform` shows each step's `why` as the caption (no log line); its result goes to the log
as a `step` line through `hands.log`.

---

## The panel

`role="dialog"`, `aria-label="Ask the orb"`. Top to bottom:

1. **Head.** `.orb-panel-title`: "What should I do?", or "One question" while the pilot is asking.
   A close button (`.orb-icon-btn`, `aria-label="Close"`).
2. **Drive bar** (while `driving`). `.orb-drive`, `role="status"`: "Working on" over the goal, and a
   Stop button (`.orb-btn`) that calls `driving.stop()` and aborts this page's own run.
3. **Note** (if any). `.orb-note`: its text, and an `.orb-btn[data-kind=primary]` with `act.label`
   that dispatches `orb:act` and closes the panel.
4. **Log** (if any lines). `.orb-log`, `aria-label="What happened"`: the last **8** lines,
   `<li data-who="you|orb|step">`. `step` lines are what the pilot just did ("Tapped “Search”.").
5. **Either** the confirm, `.orb-confirm`, `role="alertdialog"`: the question, then "No"
   (`data-kind=ghost`) and "Yes, do it" (`data-kind=primary`; it also closes the panel so the orb can
   carry on in view).
6. **Or**:
   - `.orb-suggest` chips (`.orb-chip`), only when the log is empty, there is no note and nothing is
     being asked. "What can I do here?" is answered locally (the first 8 labels from `snapshot()`:
     "On this screen: …. Ask me about any of it.", or "Ask me about this screen."). Any other chip
     goes to `run()`.
   - `.orb-ask` form: `.orb-input` (autofocus, `enterKeyHint="go"`, placeholder = the `placeholder`
     prop, or "Your answer…" while asking; its `aria-label` is the question while asking, else "Tell
     the orb what to do"). Then: while running and not asking, a "Stop" button; otherwise the mic
     `.orb-icon-btn` ("Say it instead", only if `brain.listen` exists and nothing is being asked) and
     the submit button, "Go" (or "Answer" while asking), disabled while the draft is blank.

**Opened by:** a deep press (hold 420 ms or pressure ≥ 0.55), a tap when there is a note, a tap when
the brain has no `listen`, Shift+Enter/Space on the orb, Ctrl+Shift+Space, `orb:run`, the pilot's
`confirm` or `ask`, a host's `open()`.

**Closed by:** its ✕, the note's button, the mic button (it closes and starts listening), "Yes, do
it", sending an answer, the start of a drive, a host's `close()`. Closing with ✕ (or `close()`)
answers a pending confirm `false` and a pending question `null`, which stops the pilot.

**Sleepy:** when the panel opens, `brain ? await brain.ready() : false`; false → the face's
expression is `sleepy`.

Changed from OrbitDesign: the drive bar, the "One question" state, `step` log lines, "Answer", and
"Yes, do it" closing the panel are new. Controls use the orb's own classes. The source's "find"
results list is gone.

---

## What a question or a goal does (`run`)

Sent from the ask box, a chip, the mic, or `orb:run`:

1. Abort any previous run; `running = true`; log `{ who: 'you', text }`.
2. No brain → "There is nothing for me to think with here yet." Brain not ready → `brain.why` (or
   the same line).
3. `isExplain(goal)` or no `brain.drive` → answered in words: "explain this screen" sends the
   visible text (`screenText(body, 5000)`) with `explainPrompt`; any other question sends the last 8
   log lines and `askPrompt`. The caption shows "Looking…" or "Thinking…". The answer is said with
   `<think>…</think>` stripped, or "I couldn’t make sense of this screen." / "I couldn’t work out how
   to answer that."
4. Otherwise it **drives**: `setDriving({ goal, stop: abort })`, the panel closes so the page is in
   view, the caption says "On it…", and `brain.drive(goal, hands, signal)` runs. If it resolves with
   a line, the orb says it, and (unless stopped) `cue('done')` and a happy flash. A host that runs
   the loop elsewhere resolves with nothing and says the line itself.
5. Errors (unless aborted): `cue('error')`, a sad flash, the message is said.
6. Finally: `running = false`, its own drive state is cleared, the mode is restored, and after
   250 ms `rest()` + `syncCaret()`.

A shake, Escape, or Stop aborts it ("Stopped.").

### The promises the pilot uses

| Hands call | What the person sees | Resolves |
|---|---|---|
| `hands.confirm(question)` | the panel opens on the confirm block | `true` on "Yes, do it"; `false` on "No", ✕ or `close()` |
| `hands.ask(question)` | the orb says the question; the panel opens as "One question" | the typed answer (the panel closes); `null` on ✕ or `close()` |

---

## Energy and the glow

- `orb:energy` (`orbThink(n)`) sets the face's stage energy: the liquid stirs faster
  (`speed = 0.25 + energy·0.9`), the sphere swells (`size = 0.86 + energy·0.1`).
- While listening, the mic level `v` drives `energy = 0.25 + v·0.75` (at most every 70 ms) and
  `depth.target = −v·0.25`.
- While running or driving: energy `0.8` and `typing` true.
- The ring shows with press depth, pulses while listening, and spins dashed while running or driving
  (`data-running` / `data-driving`).

See also: [06 · Caret and gestures](06-caret-and-gestures.md) · [08 · The brain](08-brain.md) · [09 · The pilot](09-pilot.md)
