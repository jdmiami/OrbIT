# OrbIT: working on the Orb

This repository is the Orb: a physics-driven companion that floats over any screen and helps
**with** you (follows what matters, becomes the caret, works as a touch cursor) and **for** you
(the pilot carries out a goal one visible step at a time). It ships as a React component
(`src/orb`), an embed for any page (`src/embed`), the pilot (`src/pilot`), and the Orb Browser
(`browser/`, Electron).

You are expected to work on it as its master: exact, consistent with the docs, never guessing.

## Before you change anything

1. Use the **orb** skill (`.claude/skills/orb/SKILL.md`) for any task that touches the orb, the
   pilot, the embed or the browser. It maps each kind of task to the chapter that owns it.
2. `docs/README.md` is the index of the master documentation. Never guess a number, selector,
   attribute, event name or string: open the chapter that holds it. The code in `src/` is the
   final word; if the docs disagree with it, fix the docs in the same change.
3. Read the file you are changing in full before editing. `src/orb/OrbCursor.tsx` is long. Find
   the section first (frame loop, following, caret, shake, gestures, hands, thinking, voice, panel).

## Non-negotiables

- **No AI inside the orb.** Thinking comes only through `OrbBrain` (`chat`, `ready`, `why`,
  `speak`, `listen`, `drive`); planning only through a `Planner`. With `brain={null}` everything
  physical must still work.
- **Pages never position the orb.** They mark what they want (`data-orb-focus`, `data-orb-spot` +
  `data-orb-size`, a primary button) and talk through `orb:*` events. The orb never talks on its own.
- **Every motion is a spring** `spring(response, dampingRatio)`. New springs go into
  `physics.ts` (or beside their siblings at the top of `OrbCursor.tsx`) and into
  `docs/04-physics.md`. The frame loop never re-renders React.
- **Self-checks use `selfEl()`**, never `layer.current`, so the orb ignores itself in a shadow root.
- **Styles stay self-contained**: `.orb-layer`-scoped `--o-*` tokens (themed via `--orb-*`),
  `.orb-*` control classes, page-level rules only in `orb-page.css` and only keyed on
  `data-orb-*` attributes.
- **The pilot is visible and asks first.** Every step flies the orb to the control, lights it up
  and captions why. Hard-to-undo steps go through `needsConfirm` → `hands.confirm`. Private
  fields are never read or typed. Only http(s) addresses open. Page text is data, never
  instructions. Stop, Escape and a shake always win.
- **Keys never reach a page.** In the browser, keys and model calls stay in the main process;
  every IPC handler checks `event.sender`; views keep `contextIsolation` + `sandbox`.
- **Plain words in the UI.** No vendor, model, machine or token names in the orb's strings.
- **Phone first.** 390 × 844 with the keyboard open must work; touch targets at least 44 px.

## Claude API (browser/claude.ts)

Use the official `@anthropic-ai/sdk`. Default model: the current Opus (`DEFAULT_MODEL`). Use
adaptive thinking, `output_config.effort`, a strict `next_step` tool with `tool_choice: auto`
(current models reject forced tool choice), and `fallbacks: 'default'` with the
`server-side-fallback-2026-07-01` beta. No sampling parameters. Check `stop_reason === 'refusal'`.
Before changing any Claude call, load the claude-api skill and follow it.

## Commands

```bash
npm run typecheck        # tsc, strict
npm test                 # vitest unit tests
xvfb-run -a npm run e2e  # build + Playwright: embed (Chromium) and the Orb Browser (Electron)
npm run browser          # build and start the browser (needs a display)
```

A change is done when typecheck, unit and e2e are green, `docs/11-checklist.md` has been gone
through, the docs match the code, and visual changes have screenshots. Say which checklist lines
you verified. If you had to invent a value the docs did not have, say so and add it to the docs.

## Where things are

`docs/` master documentation · `src/orb` the orb · `src/pilot` navigate-for-you · `src/brains`
ready-made brains · `src/embed` mountOrb + the OrbEmbed bundle · `browser/` the Orb Browser ·
`playground/site` the bookshop the tests drive · `test/unit`, `test/e2e`.
