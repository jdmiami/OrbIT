# 08 · The brain (`OrbBrain`)

The orb contains no AI. Everything it thinks with comes through one object, the `brain`. Pass
`null` and the orb still does everything physical; it only cannot answer or drive.

```ts
export interface OrbBrain {
  /** Stream a reply. messages[0] may be a system prompt the orb builds from data-orb-context. */
  chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], onText: (delta: string) => void, signal?: AbortSignal): Promise<void>;
  /** Is there something to think with right now (else the orb shows as sleepy). */
  ready(): Promise<boolean>;
  /** Why it is asleep, for the panel. */
  why?: string;
  /** Optional: speak a line (text to speech). */
  speak?(text: string): void;
  /** Optional: listen (speech to text). */
  listen?(h: { onLevel?: (v: number) => void; onPartial?: (t: string) => void; onDone: (t: string) => void; onError?: (m: string) => void }): { finish(): void; cancel(): void };
  /** Optional: navigate for the person (the pilot). */
  drive?(goal: string, hands: Hands, signal: AbortSignal): Promise<string | void>;
}
```

`drive` is the field this package adds to the OrbitDesign adapter. Everything else is unchanged.

---

## 1. Field by field

### `chat(messages, onText, signal)`: required

| | |
|---|---|
| `messages` | A plain list. The orb always puts one `system` message first. For a free question it then adds up to 8 lines of the recent exchange as `user`/`assistant`, then the `user` question. "Explain this screen" sends only system + user (the question, then `Text on screen:` and up to 5000 characters of `screenText`). |
| `onText(delta)` | Call it with each piece of the reply as it streams. The orb shows the whole reply when the promise resolves, with any `<think>…</think>` block removed. No streaming? Call it once with the full text. |
| `signal` | Aborted when the person taps **Stop**, asks something else, or shakes the device. Pass it to `fetch`. Errors after an abort are ignored. |
| returns | Resolves when the reply is complete. To fail, reject with an `Error` whose `message` is one plain sentence: the orb says it, flashes a sad face (`data-face="error"`, 1800 ms) and plays the `error` cue. |

The system message is your `explainPrompt` or `askPrompt` (defaults in `src/orb/screen.ts` and
`OrbCursor.tsx`), then a blank line, then `<html data-orb-context>` if the page set it.

### `ready()`: required

Called when the panel opens (to choose the sleepy face) and before every question. Return `true`
when a reply is possible now. On `false` the orb says `why` instead of calling `chat`. Keep it
fast: cache network checks for about 5 s. Throwing counts as `false`.

### `why`: optional

What the orb says when `ready()` is false. Without it: *"There is nothing for me to think with
here yet."* Say what to do: *"I need an API key to think. Add one in Settings (the ⋯ button at
the top right)."* (the Orb Browser's line).

### `speak(text)`: optional

Text to speech. It is used only for answers to **spoken** questions, never for typed ones.

### `listen(handlers)`: optional

Speech to text. When present, a **tap** on the orb starts listening and the panel shows a mic
button; when absent, a tap opens the panel.

| Handler | What the orb does |
|---|---|
| `onLevel(v)` | Mic level 0…1 → face energy `0.25 + v·0.75` (at most every 70 ms) and a small swell (`depth.target = −v·0.25`). |
| `onPartial(text)` | Shown as the caption (empty → "Listening…"). |
| `onDone(text)` | Runs `text` as a spoken question (`run(text, true)`). |
| `onError(message)` | The orb says `message`. |

Return `{ finish(), cancel() }`: `finish()` stops and uses what was heard (a second tap calls it);
`cancel()` throws it away (called on unmount). Call exactly one of `onDone`/`onError`, once.

### `drive(goal, hands, signal)`: optional

When present, anything typed or spoken into the panel that is not an "explain" question
(`isExplain(goal)` false) is treated as a **goal**:

1. The orb sets its driving state (`data-driving` on the layer: dashed spinning ring; a *Working on*
   bar with **Stop** in the panel), closes the panel so the page is visible, and captions "On it…".
2. It calls `drive(goal, hands, signal)`. `hands` is the orb's pilot interface (look at this page,
   do one step, confirm, ask, say, log; see [09 · The pilot](09-pilot.md)). `signal` aborts on Stop,
   Escape or a shake.
3. A string result is said as the closing line, with the `done` cue and a happy flash. Resolve
   with nothing when a host says the line itself (the Orb Browser does).

Two ready-made `drive`s:

```ts
import { driveWith, chatPlanner } from './src/pilot';

brain.drive = driveWith(chatPlanner(brain));        // the pilot loop in this page, any chat model
```

and the Orb Browser's page proxy, which sends the goal to the browser's main process so the run
outlives the page (`browser/page-preload.ts`).

Without `drive`, a free question goes to `chat` with `askPrompt`.

---

## 2. What needs the brain

| Feature | Needs | Notes |
|---|---|---|
| Follow, spots, stages, notes, captions, `orb:say`, `orb:energy`, `orb:home` | nothing | |
| Caret mode, drop to type, drop to press, drag, throw, park, tuck, shake, pinch | nothing | |
| The panel, its log, "What can I do here?" | nothing | answered locally from `snapshot()` |
| The hands (`look`, `perform`, `confirm`, `ask`) | nothing | a host or test can drive the orb with no model at all (the e2e tests do) |
| "Explain this screen" | `chat` | |
| Any other question | `chat` | or `drive`, when present |
| Navigating for the person | `drive` (+ a planner) | |
| Voice in / out | `listen` / `speak` | |

With `brain` null a question gets *"There is nothing for me to think with here yet."*, and the
face is sleepy whenever the panel is open.

---

## 3. Telling the orb about the page

Set `data-orb-context` on `<html>`. It is appended to every system prompt, so the model knows
where the person is and what the page is for. Keep it short and current; clear it when the page
leaves.

```ts
useEffect(() => {
  document.documentElement.dataset.orbContext =
    `You are the guide inside ${site.name}. The visitor is on the "${step.title}" step. To move on they pick an answer or type their own.`;
  return () => void delete document.documentElement.dataset.orbContext;
}, [site.name, step.title]);
```

Hand the orb a request from anywhere on the page with `orbRun(text)`. The panel opens and the line
runs as if typed. To leave it something to say without a model, use `orbNote(text, { label, id })`
and `onOrbAct(id => …)` (see [07](07-events-and-panel.md)).

---

## 4. Ready-made brains (`src/brains/`)

| Export | What it is |
|---|---|
| `httpChatBrain({ url, model, key?, maxTokens = 500, temperature = 0.3 })` | Any HTTP "chat completions" endpoint that streams server-sent events. `ready()` checks `…/models` and caches for 5 s. |
| `localChatBrain({ base = 'http://localhost:11434', model })` | A local model server with `POST /api/chat` streaming NDJSON. `ready()` checks `/api/tags` lists the model. |
| `webSpeech()` | `{ speak, listen }` from the browser alone (Web Speech). `listen` only where the browser has recognition. Spread it over a chat brain. |
| `createSpeaker`, `speakable`, `canSpeak`, `canListen`, `unlockSpeech`, `listen` | The parts of `webSpeech`, for your own adapter. |

```ts
const brain: OrbBrain = { ...httpChatBrain({ url: '/api/chat', model: 'my-model' }), ...webSpeech() };
brain.drive = driveWith(chatPlanner(brain));
```

**Never put a secret key in page code.** Proxy it through a server you control, or keep it in a
privileged process (the Orb Browser keeps it in its main process, encrypted by the OS keychain).

---

## 5. Claude in the Orb Browser (`browser/claude.ts`)

The browser's brain lives in Electron's main process and uses the official SDK
(`@anthropic-ai/sdk`).

**Chat** (`claudeChat`): `client.beta.messages.stream` with the orb's system message(s) as
`system`, the rest as turns, `thinking: { type: 'adaptive' }`, `output_config: { effort: 'low' }`,
`max_tokens: 8000`, and server-side fallbacks (`betas: ['server-side-fallback-2026-07-01']`,
`fallbacks: 'default'`). Text deltas stream to the page over IPC (`brain:delta`).

**Planner** (`claudePlanner`): one `client.beta.messages.create` per step:

| Field | Value | Why |
|---|---|---|
| `model` | the Settings choice; default the current Opus | most capable default; Sonnet and Haiku are one tap away in Settings |
| `tools` | `[{ ...STEP_TOOL, strict: true }]` | the step's shape is guaranteed (every field required, nulls where unused) |
| `tool_choice` | `{ type: 'auto' }` | current models reject forced tool choice; the prompt says "choose exactly one next step with the next_step tool" |
| `system` | `PILOT_PROMPT`, with `cache_control: { type: 'ephemeral' }` | the tool and prompt stay identical every step, so the prefix can be cached |
| `messages` | one user turn: the **screenshot** (JPEG, at most 1280 px wide) first, then `planMessage(input)` | stateless per step: the history is written into the turn, so there is no growing conversation |
| `thinking` | `{ type: 'adaptive' }` | |
| `output_config.effort` | Settings: Quick `low`, Balanced `medium` (default), Careful `high` | |
| `fallbacks` | `'default'` with beta `server-side-fallback-2026-07-01` | a declined step is retried on the recommended fallback model server-side |

The response: `stop_reason === 'refusal'` → `done` ("I can’t help with that one."). A `next_step`
tool call → `toStep(input)`. Plain text only → an `answer` step with that text.

No sampling parameters (`temperature`, `top_p`) are sent; current models reject them.

---

## 6. Checklist for any brain

- `chat` streams through `onText`, resolves when done, rejects with one plain sentence, stops on `signal`.
- `ready` is fast and cached; `why` says what to do.
- Keys stay on a server or in a privileged process, never in page code.
- Pages set and clear `data-orb-context`.
- A `drive` stops promptly on `signal` and never presses anything hard to undo without `hands.confirm`.
- No vendor or model names in the orb's own UI strings.

See also: [07 · Events and the panel](07-events-and-panel.md) · [09 · The pilot](09-pilot.md) · [10 · The Orb Browser](10-browser.md)
