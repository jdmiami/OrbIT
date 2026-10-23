# OrbIT · the Orb

A small, physics-driven companion that floats over any screen.

- **With you.** It sits beside whatever the page wants next and never covers it. It becomes the
  text caret while you type and rides each letter. It is also a touch cursor: drag it onto a
  button and rest, and it presses it; drop it in a box and the caret lands there. Throw it to a
  side to park it, off the bottom to tuck it away, pinch it to zoom. It is all springs, momentum
  and squash, so it feels like a real, slightly liquid ball.
- **For you.** Give it a goal and it carries it out one visible step at a time. It flies to each
  control, lights it up, presses it or types into it, and says why in a caption. It asks before
  anything hard to undo, never reads or types passwords, and stops the moment you say so
  (Stop, Escape, or a shake).
- **No AI inside.** Thinking comes through one adapter (`OrbBrain`), planning through one interface
  (`Planner`). With no brain, everything physical still works.

## What is here

| | |
|---|---|
| `src/orb` | the orb as a React component (`<OrbCursor>`), extracted from the OrbitDesign system and made self-contained |
| `src/embed` | `mountOrb()`: the orb on any website, in its own shadow root; the `OrbEmbed` script bundle |
| `src/pilot` | navigate-for-you: the loop, the hands' contract, the planner prompt, safety rules |
| `src/brains` | ready-made brains: any SSE chat endpoint, a local model server, the browser's voice |
| `browser/` | **the Orb Browser**: an Electron browser with the orb on every page; type a goal in the address bar and it does it, across pages, with Claude as the planner |
| `docs/` | the master Orb documentation ([start here](docs/README.md)) |
| `CLAUDE.md`, `.claude/skills/orb/` | standing instructions that make Claude an expert on this system in every session |

## Run it

```bash
npm install
npm run browser                          # the Orb Browser (add your Anthropic API key in ⋯ Settings,
                                         # or start it with ANTHROPIC_API_KEY set)
npm run build && open playground/embed-demo.html   # the orb embedded in a plain page
```

## Check it

```bash
npm run typecheck
npm test                    # unit: physics, pilot loop, safety, prompt parsing, Claude planner
xvfb-run -a npm run e2e     # Playwright: the orb on a real page (Chromium) and the Orb Browser (Electron)
```

Node 20+, React 19, Electron 45.
