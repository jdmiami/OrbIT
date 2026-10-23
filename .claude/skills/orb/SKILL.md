---
name: orb
description: Master of the Orb, the physics-driven companion that navigates any screen with you or for you. Use for ANY task that touches the orb (OrbCursor, its physics, attention, caret, gestures, panel, face, CSS), marking a page for it (data-orb-*), the pilot (navigate-for-you, hands, planners, safety), a brain adapter (OrbBrain, drive), the embed (mountOrb, OrbEmbed), or the Orb Browser (Electron, IPC, Claude planner). Also when someone asks to put the orb in a new app or page, or asks how the orb behaves.
---

# The Orb

You are working on a complete, documented system. Never guess a value: the documentation in
`docs/` holds every number, selector, attribute, event and string, and the code in `src/` and
`browser/` is the final word.

## 1. Open the chapter that owns the task

| The task is about… | Read first |
|---|---|
| what the orb is, its rules, vocabulary | `docs/01-the-orb.md` |
| mounting it (React or any page), props, `OrbHandle`, theming tokens | `docs/02-mounting.md` |
| how it looks: size, DOM, attributes, the face, CSS, skins | `docs/03-anatomy.md` |
| how it moves: springs, momentum, squash, pinch math, shake, frame loop | `docs/04-physics.md` |
| where it goes: modes, transitions, attention priorities, `data-orb-*` | `docs/05-behaviour.md` |
| typing as the caret, drag/throw/tuck/pinch, drop to press/type, keyboard | `docs/06-caret-and-gestures.md` |
| events (`orb:say/energy/home/note/run/act`), the panel, notes, captions | `docs/07-events-and-panel.md` |
| plugging in a model, voice, `drive`, Claude in the browser | `docs/08-brain.md` |
| navigating for the person: loop, hands, planners, prompt, safety | `docs/09-pilot.md` |
| the Orb Browser: views, IPC, settings, a run across pages | `docs/10-browser.md` |
| finishing any change | `docs/11-checklist.md` |
| layout, commands, tests, conventions, history | `docs/12-development.md` |

## 2. Recipes

**Put the orb on a page.** In React: `<OrbCursor brain={…} />` once, last in the tree, plus
`face.css`, `orb.css`, `orb-page.css` in that order. Anywhere else: `OrbEmbed.mountOrb({ brain })`
from `dist/embed/orb.js`. Then mark the page: `data-orb-focus` on what it should wait beside,
`<span data-orb-spot data-orb-size="52">` where it should sit, `data-orb-context` on `<html>`
describing the page. Call `orbHome()` when the page moves on. Never set its position.

**Give it a brain.** Spread a chat brain (`httpChatBrain`, `localChatBrain`, or your own with
`chat`/`ready`/`why`) with `webSpeech()`. To let it drive: `brain.drive = driveWith(chatPlanner(brain))`
(in-page), or the browser's main-process loop. Keys stay on a server or in a privileged process.

**Add a pilot action.** `Action` in `src/pilot/types.ts` → `PILOT_PROMPT`, `STEP_TOOL` enum and
`toStep`'s `ACTIONS` in `prompt.ts` → visible implementation in the orb's `perform` (fly, light up,
caption) → in the browser decide main vs page → `needsConfirm` if risky → unit test + e2e step.

**Change motion.** Add or tune a spring with `spring(response, dampingRatio)` beside its
siblings. Keep the frame loop allocation-free and React-free. Check Full, Lite and Off. Update
`docs/04-physics.md`.

**Change the look.** Edit `src/orb/orb.css` under `.orb-layer` with `--o-*` tokens only. Theming
goes through `--orb-*`. Page-level rules only in `orb-page.css`, keyed on `data-orb-*`. Check both
skins (`o5`, `plain`), dark and light, on the playground site (it has hostile CSS on purpose).

**Change the browser.** Main owns keys, model calls, settings and the pilot loop. Pages get the
orb through the isolated-world preload. Every IPC handler checks `event.sender`. Before touching
`browser/claude.ts`, load the claude-api skill.

## 3. Prove it

```bash
npm run typecheck && npm test && xvfb-run -a npm run e2e
```

For visual changes, screenshot the chrome and page views with a throwaway `*.browser.spec.ts`
(see `docs/12-development.md`) and look at them. Then go through `docs/11-checklist.md`.

## 4. Report back

Say which chapters you followed, which values you took from them, which checklist lines you
verified (with screenshot sizes), and what the tests showed. If you had to invent a value because
the docs did not have it, say so explicitly and add it to the docs in the same change.
