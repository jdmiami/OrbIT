/**
 * The pilot loop: look → plan one step → (confirm) → do it → look again, until the planner says
 * `done` or `answer`, the person stops it, or it runs out of steps. It is the same loop in an app's
 * page and in the Orb Browser's main process; only `hands` differ.
 */
import { needsConfirm, safeUrl } from './safety';
import type { Done, Hands, Planner, Step, StepResult } from './types';

export interface PilotOptions {
  planner: Planner;
  hands: Hands;
  signal: AbortSignal;
  /** Most steps for one goal (default 30). */
  maxSteps?: number;
  /** Failed steps in a row before it gives up (default 3). */
  maxFailures?: number;
  /** Called after each step (for a host's progress UI or tests). */
  onStep?: (done: Done, index: number) => void;
}

export const PILOT_LINES = {
  stopped: 'Stopped.',
  declined: 'Okay, I stopped before that step. Nothing was pressed.',
  outOfSteps: 'That took more steps than I expected, so I stopped here. Tell me how to carry on.',
  stuck: (note: string) => `I got stuck: ${note}`,
  noAnswer: 'Okay, I stopped there.',
};

function aborted(signal: AbortSignal) {
  return signal.aborted;
}

/** Carry out `goal`. Resolves with the line the orb says at the end. */
export async function runPilot(goal: string, { planner, hands, signal, maxSteps = 30, maxFailures = 3, onStep }: PilotOptions): Promise<string> {
  const history: Done[] = [];
  let failures = 0;
  for (let i = 0; i < maxSteps; i++) {
    if (aborted(signal)) return PILOT_LINES.stopped;
    const page = await hands.look();
    if (aborted(signal)) return PILOT_LINES.stopped;
    const screenshot = (await hands.screenshot?.().catch(() => null)) ?? undefined;
    let step: Step;
    try {
      step = await planner.next({ goal, page, history, screenshot }, signal);
    } catch (err) {
      if (aborted(signal)) return PILOT_LINES.stopped;
      throw err;
    }
    if (aborted(signal)) return PILOT_LINES.stopped;

    if (step.action === 'done' || step.action === 'answer') return step.text?.trim() || 'Done.';

    let result: StepResult;
    if (step.action === 'ask') {
      const reply = await hands.ask(step.text?.trim() || 'What should I do next?');
      if (aborted(signal)) return PILOT_LINES.stopped;
      if (reply == null || !reply.trim()) return PILOT_LINES.noAnswer;
      result = { ok: true, note: `They said: ${reply.trim()}` };
    } else {
      if (step.action === 'go') {
        const url = safeUrl(step.url);
        if (!url) result = { ok: false, note: `“${step.url}” is not a web address I can open.` };
        else step = { ...step, url };
      }
      const item = step.target != null ? page.items.find((it) => it.id === step.target) : undefined;
      const question = needsConfirm(step, item);
      if (question && !(await hands.confirm(question))) return aborted(signal) ? PILOT_LINES.stopped : PILOT_LINES.declined;
      if (aborted(signal)) return PILOT_LINES.stopped;
      // A bad address is already a failed result; everything else goes to the hands.
      result ??= await hands.perform(step, signal);
    }
    const done: Done = { step, result };
    history.push(done);
    hands.log?.(result.note);
    onStep?.(done, i);
    failures = result.ok ? 0 : failures + 1;
    if (failures >= maxFailures) return PILOT_LINES.stuck(result.note);
  }
  return PILOT_LINES.outOfSteps;
}
