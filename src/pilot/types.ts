/**
 * The pilot: the orb navigating for you. A goal ("find a flight to Lisbon on Friday") is carried out
 * one step at a time: the orb LOOKS at the screen, a PLANNER (any model) picks ONE step, the orb's
 * HANDS do it (it flies there, lights the control up, presses it or types into it as the caret),
 * and the loop looks again. These are the only shapes that cross between the three.
 *
 * Nothing here knows about a model, a browser or React: an app runs the loop in its own page, the
 * Orb Browser runs it in its main process (so it survives page loads) and talks to each page's orb
 * over IPC. See docs/09-pilot.md.
 */

/** What the orb can do in one step. */
export type Action =
  /** Press a control (a button, link, tab, checkbox, option). Needs `target`. */
  | 'tap'
  /** Put `text` into a field (replacing what is there), or choose the option named `text` in a select. Needs `target`. `submit` presses Enter after. */
  | 'type'
  /** Scroll the page `direction` up or down by most of a screen. */
  | 'scroll'
  /** Open `url` (http or https only). */
  | 'go'
  /** Go back one page. */
  | 'back'
  /** Wait a moment for the page to finish loading or updating. */
  | 'wait'
  /** Ask the person something only they can answer (`text` is the question). The run waits for their answer. */
  | 'ask'
  /** Answer the person in words, without touching the page (`text`). Ends the run. */
  | 'answer'
  /** The goal is reached (or cannot be). `text` is the closing line. Ends the run. */
  | 'done';

export interface Step {
  action: Action;
  /** The number of an item in the page view (tap, type). */
  target: number | null;
  /** What to type; the option to choose; the question; the answer; the closing line. */
  text: string | null;
  /** For `go`. */
  url: string | null;
  /** For `type`: press Enter after typing. */
  submit: boolean | null;
  /** For `scroll`. */
  direction: 'up' | 'down' | null;
  /** One short line, shown as the orb's caption while it does this ("Opening the flights tab"). */
  why: string;
}

/** One thing on screen a person could use, as a planner sees it. */
export interface ItemView {
  id: number;
  role: 'button' | 'link' | 'field' | 'tab' | 'option' | 'switch';
  label: string;
  /** What is typed in it now (never for private fields: passwords, codes, card numbers). */
  value?: string;
  /** Scrolled out of view: the orb scrolls to it first. */
  offscreen?: boolean;
}

/** What the orb sees: where it is, what can be used, and what can be read. */
export interface PageView {
  url: string;
  title: string;
  items: ItemView[];
  /** The visible text, top to bottom (private fields left out). */
  text: string;
  /** How far down the page is scrolled, 0…1, and whether there is more below. */
  scroll: { at: number; more: boolean };
}

export interface StepResult {
  ok: boolean;
  /** Plain words for the history: "Tapped “Search”", "There is no item 12 on screen now." */
  note: string;
}

export interface Done {
  step: Step;
  result: StepResult;
  /** Where the orb was after the step (a tap can open a new page). */
  url?: string;
}

/** A picture of the screen, for a planner that can see. */
export interface Screenshot {
  mediaType: 'image/jpeg' | 'image/png';
  /** Base64, no data: prefix. */
  data: string;
}

export interface PlanInput {
  goal: string;
  page: PageView;
  history: Done[];
  screenshot?: Screenshot;
}

/** Picks the next step. Any model can be one (see chatPlanner, and the Orb Browser's Claude planner). */
export interface Planner {
  next(input: PlanInput, signal: AbortSignal): Promise<Step>;
}

/**
 * What the orb exposes to a pilot loop. In an app the loop calls these directly; in the Orb Browser
 * they are reached over IPC, and `look`/`perform` go to whichever page is showing now.
 */
export interface Hands {
  look(): Promise<PageView>;
  perform(step: Step, signal: AbortSignal): Promise<StepResult>;
  /** Ask before something that is hard to undo. Resolves false if they say no or close the panel. */
  confirm(question: string): Promise<boolean>;
  /** Ask the person a question; resolves with what they typed or said, or null if they closed the panel. */
  ask(question: string): Promise<string | null>;
  /** One line as a caption and in the panel's log. */
  say(line: string): void;
  /** A step line in the log (what it just did). */
  log?(line: string): void;
  /** A picture of the screen, if the host can take one. */
  screenshot?(): Promise<Screenshot | null>;
}
