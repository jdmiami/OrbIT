/**
 * A planner from any OrbBrain (any chat model, cloud or local): it is asked for one JSON object in
 * plain text and the reply is parsed forgivingly. Models with tool use (Claude in the Orb Browser)
 * get the same prompt with STEP_TOOL instead; see browser/planner.ts.
 */
import type { OrbBrain } from '../orb/OrbCursor';
import { PILOT_PROMPT, parseStepText, planMessage } from './prompt';
import type { Planner, Step } from './types';

const JSON_RULE = `

Reply with ONE JSON object and nothing else, with exactly these keys:
{"action": "tap|type|scroll|go|back|wait|ask|answer|done", "target": number or null, "text": string or null, "url": string or null, "submit": true/false or null, "direction": "up|down" or null, "why": "short line"}`;

export function chatPlanner(brain: OrbBrain, { extraContext }: { extraContext?: () => string | undefined } = {}): Planner {
  return {
    async next(input, signal): Promise<Step> {
      const extra = extraContext?.();
      let reply = '';
      await brain.chat(
        [
          { role: 'system', content: PILOT_PROMPT + JSON_RULE + (extra ? `\n\n${extra}` : '') },
          { role: 'user', content: planMessage(input) },
        ],
        (d) => (reply += d),
        signal,
      );
      // A model that ignored the format still said something useful: treat it as the answer.
      return parseStepText(reply) ?? { action: 'answer', target: null, text: reply.trim() || 'I couldn’t work out what to do here.', url: null, submit: null, direction: null, why: '' };
    },
  };
}
