# The Orb: master documentation

The orb is a small, physics-driven companion that floats over any screen. It helps **with** you:
it sits beside whatever the page wants next, becomes the caret while you type, and works as a
touch cursor you can drag onto a button to press it. It also works **for** you: give it a goal and
it carries it out one visible step at a time, on any website, in the Orb Browser.

It has no AI inside. Every bit of thinking comes through one adapter (`OrbBrain`), and planning
through one interface (`Planner`).

## Read in this order

| # | Chapter | Read it when you are… |
|---|---|---|
| 01 | [The orb](01-the-orb.md) | new here: what it is, the rules it lives by, the words we use |
| 02 | [Mounting](02-mounting.md) | putting the orb in an app or on any page; props, handle, theming |
| 03 | [Anatomy](03-anatomy.md) | changing how it looks: geometry, DOM, the face, every CSS rule |
| 04 | [Physics](04-physics.md) | changing how it moves: springs, momentum, squash, the frame loop |
| 05 | [Behaviour](05-behaviour.md) | changing where it goes: modes, transitions, attention, marking a page |
| 06 | [Caret and gestures](06-caret-and-gestures.md) | changing typing, drag, throw, pinch, shake, keyboard |
| 07 | [Events and the panel](07-events-and-panel.md) | talking to it from a page; the panel, notes, captions, energy |
| 08 | [The brain](08-brain.md) | plugging in a model: chat, voice, `drive`; Claude in the browser |
| 09 | [The pilot](09-pilot.md) | letting it navigate for you: the loop, the hands, planners, safety |
| 10 | [The Orb Browser](10-browser.md) | working on the browser: architecture, IPC, settings, running a goal |
| 11 | [Checklist](11-checklist.md) | about to say a change is done |
| 12 | [Development](12-development.md) | building, testing, conventions, what changed from OrbitDesign |

## In one minute

```tsx
// In a React app
import { OrbCursor } from './src/orb';
import './src/orb/face.css';
import './src/orb/orb.css';
import './src/orb/orb-page.css';

<OrbCursor brain={null} />                        // mount once, last in the tree
```

```html
<!-- On any page -->
<script src="dist/embed/orb.js"></script>
<script>OrbEmbed.mountOrb({ brain: null });</script>
```

```ts
// Let it navigate for you, with any chat model
const brain = { ...OrbEmbed.httpChatBrain({ url: '/api/chat', model: 'my-model' }) };
brain.drive = OrbEmbed.driveWith(OrbEmbed.chatPlanner(brain));
OrbEmbed.mountOrb({ brain });
```

```bash
# The Orb Browser
npm install && ANTHROPIC_API_KEY=… npm run browser
```

A page tells the orb what matters with attributes, never coordinates:

```html
<button data-orb-focus>Continue</button>                    <!-- it waits beside this -->
<span data-orb-spot data-orb-size="52"></span>              <!-- it sits on this, grown to 52 px -->
<html data-orb-context="The visitor is on the checkout page.">
```
