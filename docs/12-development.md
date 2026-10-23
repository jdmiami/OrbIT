# 12 · Development

How the repository is laid out, how to build and test it, and how to change it without breaking
the orb.

## Layout

```
CLAUDE.md                     standing instructions for Claude in this repo (read first)
.claude/skills/orb/SKILL.md   the Orb skill: how to work on anything orb
docs/                         this documentation (README.md is the index)
src/
  orb/        the orb: OrbCursor (component, frame loop, modes, gestures, caret, panel, hands),
              OrbFace, physics, attention, caret, write, screen, events, feedback, level,
              orb.css, orb-page.css, face.css
  pilot/      navigating for you: types, run (the loop), prompt, safety, chatPlanner
  brains/     ready-made brains: httpChat, localChat, webSpeech
  embed/      mountOrb(): the orb on any page, in a shadow root; the OrbEmbed bundle entry
browser/      the Orb Browser (Electron): main, claude, address, page-preload, chrome-preload, chrome/
playground/   site/ (a small bookshop to try the orb on; the e2e tests use it), embed-demo.html
test/
  unit/       vitest: physics, pilot (loop, safety, prompt), the Claude planner and the address bar
  e2e/        Playwright: embed.spec.ts (Chromium), browser.spec.ts (Electron)
scripts/build.mjs   esbuild: dist/embed/orb.js and dist/browser/*
```

## Commands

| Command | What it does |
|---|---|
| `npm install` | dependencies (and Electron's binary) |
| `npm run build` | `dist/embed/orb.js` (IIFE, global `OrbEmbed`) and `dist/browser/*` |
| `npm run typecheck` | `tsc --noEmit` over everything |
| `npm test` | unit tests (vitest) |
| `npm run e2e` | build, then both Playwright suites. On Linux without a display: `xvfb-run -a npm run e2e` |
| `npm run browser` | build and start the Orb Browser |
| `npm run check` | typecheck + unit + e2e |

Requirements: Node 20+. React 19. Electron 45. TypeScript in strict mode with no unused locals or
parameters.

## Conventions

- **Match the surrounding code.** Comments explain *why* in plain sentences, at the density of
  `physics.ts` and `OrbCursor.tsx`. Names are plain words (`look`, `perform`, `flyTo`, `rest`).
- **The orb's physics never re-render React.** Springs live in refs and the frame loop writes
  `style.transform` and CSS variables directly. React state is only for what the DOM shows (panel,
  caption, attributes).
- **Every number has a home.** New constants go next to their siblings (springs in `physics.ts`
  or at the top of `OrbCursor.tsx`) and into the docs.
- **The page owns its markup, the orb owns itself.** Pages talk to the orb only through
  `data-orb-*` attributes and `orb:*` events. The orb touches the page only through attributes
  it sets (`data-orb-hover`, `data-orb-pressed`, `data-orb-caret`) and real input (clicks, typing).
- **No AI inside `src/orb`.** Intelligence comes through `OrbBrain`; planning through a `Planner`.
- **Plain words in the UI.** No vendor, model, machine or token names in the orb's strings.
- **No model identifiers** in commit messages or code comments; they belong only in configuration
  (`browser/claude.ts`, the Settings list).

## Testing a change

1. Unit-test pure logic (physics, pilot, safety, prompt parsing) in `test/unit`.
2. Cover the hands and the orb's behaviour on a real page in `test/e2e/embed.spec.ts`
   (`openWithOrb(page)` mounts the orb with an open shadow root and exposes the handle as
   `window.__orb`).
3. Cover anything crossing pages or the browser's IPC in `test/e2e/browser.spec.ts`, with a
   scripted planner (`ORB_TEST_STEPS`; steps may use `label` instead of `target`).
4. For visual changes, take screenshots. A throwaway Playwright spec can call
   `page.screenshot()` on the chrome and page views (name it `*.browser.spec.ts` so the
   Electron project picks it up), then delete it.

## What changed from OrbitDesign

This repository keeps only the orb from the OrbitDesign package. Removed: the flow engine,
screens and components, the page styles, the motion provider, and the example app. Rewritten or
added:

| Area | Change |
|---|---|
| Scope | `src/orb` keeps everything physical as it was. `feedback.ts` moved in from `motion/`; `level.ts` replaces the motion package's type. |
| Styles | Self-contained: tokens on `.orb-layer` (`--o-*`, themed through `--orb-*`), the panel's own controls (`.orb-btn`, …), `data-theme`/`data-skin` on the layer instead of `:root`. Page-level rules split into `orb-page.css`. The unported writing-help and find rules removed. |
| Embedding | `mountOrb()` puts the orb in a shadow root on any page. Self-checks use `selfEl()` (the shadow host). |
| Face | The WebGL fallback now shows the CSS sphere. Before, the orb was invisible without WebGL. |
| Pilot | New: `drive` on the brain, the hands (`look`, `perform`, `confirm`, `ask`), `SPRINGS.aim` for flying to a control, `data-driving`, *Working on* + Stop in the panel, Escape to stop, `src/pilot`. This replaces the do-it-for-me agent that OrbitDesign did not port. |
| Strings | The default explain prompt no longer names the source app; the ask box says "Ask me, or tell me what to do…". |
| `write.ts` | Only the text helpers the orb uses (labels, privacy, `insertText`); the unported writing-help prompts removed. |

See also: [11 · Checklist](11-checklist.md) · [README](README.md)
