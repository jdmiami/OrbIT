/**
 * The Orb Browser's intelligence, in the main process only (the key never reaches a page): Claude
 * as the pilot's planner (one strict `next_step` tool call per step, with a screenshot) and as the
 * orb's chat brain (streamed answers).
 */
import Anthropic from '@anthropic-ai/sdk';
import { PILOT_PROMPT, STEP_TOOL, planMessage, toStep } from '../src/pilot/prompt';
import type { Planner, PlanInput, Step } from '../src/pilot/types';

export type Effort = 'low' | 'medium' | 'high';

export interface ClaudeOptions {
  apiKey?: string;
  model?: string;
  effort?: Effort;
}

export const DEFAULT_MODEL = 'claude-opus-5-5';

function finish(text: string): Step {
  return { action: 'done', target: null, text, url: null, submit: null, direction: null, why: '' };
}

export function claudeClient({ apiKey }: ClaudeOptions): Anthropic {
  // With no key given the SDK still finds ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or a saved profile.
  return new Anthropic(apiKey ? { apiKey } : {});
}

export function claudePlanner(client: Anthropic, { model = DEFAULT_MODEL, effort = 'medium' }: ClaudeOptions = {}): Planner {
  return {
    async next(input: PlanInput, signal: AbortSignal): Promise<Step> {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (input.screenshot) content.push({ type: 'image', source: { type: 'base64', media_type: input.screenshot.mediaType, data: input.screenshot.data } });
      content.push({ type: 'text', text: planMessage(input) });
      const res = await client.beta.messages.create(
        {
          model,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          output_config: { effort },
          // Stable first (tool, then the prompt) so the prefix can be cached across steps.
          tools: [{ ...STEP_TOOL, strict: true }],
          tool_choice: { type: 'auto' },
          system: [{ type: 'text', text: PILOT_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content }],
        },
        { signal },
      );
      if (res.stop_reason === 'refusal') return finish('I can’t help with that one.');
      const call = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === STEP_TOOL.name);
      const step = call ? toStep(call.input) : null;
      if (step) return step;
      // No step: whatever it wrote is its answer to the person.
      const text = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      return { ...finish(text || 'I couldn’t work out the next step here.'), action: 'answer' };
    },
  };
}

/** Stream an answer to a question asked in the orb's panel. messages[0] may be the orb's system prompt. */
export async function claudeChat(
  client: Anthropic,
  { model = DEFAULT_MODEL }: ClaudeOptions,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  onText: (delta: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = messages.filter((m) => m.role !== 'system') as Anthropic.Beta.BetaMessageParam[];
  const stream = client.beta.messages.stream(
    {
      model,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      ...(system ? { system } : {}),
      messages: turns.length ? turns : [{ role: 'user', content: 'Hello' }],
    },
    { signal },
  );
  stream.on('text', onText);
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') onText('I can’t help with that one.');
}
