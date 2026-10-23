# 01 · The orb

What the orb is, the rules it lives by, and the words used for its parts in the rest of these docs.
Read this once per session. Every other chapter assumes it.

---

## What it is

The orb is a small round companion, 56 px across, that floats over every screen. It is one living
object. It sits beside whatever the screen says matters. It becomes the text caret while you type.
You can drag it, throw it, park it at an edge or tuck it away. You can pinch it to change the text
size, hold it to open a small panel, and tap it to talk. It glows while it works for you, and it
keeps what a page wants to tell you until you tap it.

It helps in two ways:

| | What it does | Where |
|---|---|---|
| **With you** | It follows what matters, becomes the caret, presses what you drop it on, types where you set it down, and keeps the page's notes for you. | [05](05-behaviour.md), [06](06-caret-and-gestures.md), [07](07-events-and-panel.md) |
| **For you** | The pilot. Given a goal ("buy the hardback of Lisbon in the Rain"), it looks at the screen, a planner picks one step, and the orb flies there and does it: it presses, or becomes the caret and types. Then it looks again, until it is done. | [09](09-pilot.md), [10](10-browser.md) |

Everything it does with you works with no AI at all. Answering a question and driving need a brain
([08](08-brain.md)).

---

## The rules

These come from OrbitDesign's philosophy and the orb's design intent. A change that breaks one of
them is a change to the orb, not a fix: propose it instead.

1. **A quiet companion.** It never talks on its own. A page leaves it a *note*, and the person sees
   it only when they tap the orb. Captions (one-line bubbles) appear only when a page asks
   (`orb:say`), while it hovers a control, during a pinch, or while the pilot works.
2. **It sits beside what the screen wants, never on it.** Each page marks the thing it wants next
   (`data-orb-focus`, `data-orb-spot`, a primary button). The orb waits beside it. It never covers
   that control, another control, or words being read.
3. **It is a real object.** All its movement is springs with momentum, rubber-banding at the edges,
   and squash-and-stretch along its speed. It reads as a slightly liquid ball, not a cursor.
4. **It is the caret.** In a text box it glides over, narrows into a sliver the height of the line,
   and rides each letter. The box's own caret is hidden.
5. **It is a touch cursor.** Drag it over a button and the button lights up. Set it down and the
   button is pressed. Set it down in a text box and the caret lands between the letters you chose.
6. **No AI inside.** All intelligence comes through one adapter, `OrbBrain`. With `brain={null}`
   everything except answering and driving still works, and its face is sleepy when the panel opens.
7. **The person always has the last word.** While it drives, Stop (in the panel and in the browser
   bar), Escape, and a shake all stop it at once. It asks before anything hard to undo (paying,
   sending, posting, deleting, agreeing), and it never types passwords, codes or card numbers.
8. **Phone first.** A 390 px wide screen with the keyboard open must work before anything else.
   Touch targets are at least 44 px.
9. **Plain words.** The interface never names a vendor, a model, a machine or a token.

---

## Glossary

| Word | Meaning |
|---|---|
| **mode** | What the orb is doing now: `follow`, `parked`, `tucked`, `drag`, `acting`, `caret` ([05](05-behaviour.md)). |
| **spot** | An empty element marked `data-orb-spot` where the orb sits centred, grown to its size. |
| **stage** | A spot marked `data-orb-spot="stage"`: the orb becomes that element (a voice orb), whatever its mode. |
| **seat** | The spot or stage it sits on now. A tap on the orb goes to the seat when the seat is a `<button>`. |
| **note** | What a page wants to say, kept until the orb is tapped (`orb:note`), optionally with a button. |
| **caption** | The one-line bubble above the orb. |
| **panel** | The bottom sheet "What should I do?": note, log, confirm, chips, ask box. |
| **hands** | What the orb exposes to a pilot: `look`, `perform`, `confirm`, `ask`, `say`, `log` (type `Hands`). |
| **pilot** | The loop that carries out a goal one step at a time (`runPilot`). |
| **planner** | Whatever picks the next step: any model, behind the `Planner` interface. |
| **brain** | The `OrbBrain` adapter: `chat`, `ready`, and optionally `speak`, `listen`, `drive`. |
| **host** | What mounts the orb and may run the pilot outside the page: an app, the embed, the Orb Browser. |

See also: [02 · Mounting](02-mounting.md) · [09 · The pilot](09-pilot.md) · [README](README.md)
