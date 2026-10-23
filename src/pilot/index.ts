/**
 * The pilot: the orb navigating for you, one step at a time. See docs/09-pilot.md.
 *
 *   const planner = chatPlanner(brain);                    // or any Planner
 *   const brain = { ...myBrain, drive: driveWith(planner) }; // the orb's panel now acts on goals
 */
export type { Action, Step, ItemView, PageView, StepResult, Done, Screenshot, PlanInput, Planner, Hands } from './types';
export { runPilot, PILOT_LINES, type PilotOptions } from './run';
export { needsConfirm, safeUrl, clip } from './safety';
export { PILOT_PROMPT, STEP_TOOL, describePage, describeHistory, planMessage, toStep, parseStepText } from './prompt';
export { chatPlanner } from './chatPlanner';
import { runPilot } from './run';
import type { Hands, Planner } from './types';

/** An OrbBrain `drive` that runs the pilot loop in this page with `planner`. */
export function driveWith(planner: Planner, opts: { maxSteps?: number } = {}) {
  return (goal: string, hands: Hands, signal: AbortSignal) => runPilot(goal, { planner, hands, signal, ...opts });
}
