import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { claudePlanner, DEFAULT_MODEL } from '../../browser/claude';
import { looksLikeAddress, toAddress } from '../../browser/address';
import type { PlanInput } from '../../src/pilot/types';

const INPUT: PlanInput = {
  goal: 'Find boots',
  page: { url: 'https://x.test/', title: 'X', items: [{ id: 1, role: 'button', label: 'Go' }], text: 'hi', scroll: { at: 0, more: false } },
  history: [],
  screenshot: { mediaType: 'image/jpeg', data: 'AAAA' },
};

function fakeClient(response: unknown) {
  const calls: any[] = [];
  const client = { beta: { messages: { create: async (params: unknown) => (calls.push(params), response) } } } as unknown as Anthropic;
  return { client, calls };
}

describe('the Claude planner', () => {
  it('asks with a strict step tool, auto tool choice, fallbacks, and the screenshot before the text', async () => {
    const { client, calls } = fakeClient({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'next_step', input: { action: 'tap', target: 1, text: null, url: null, submit: null, direction: null, why: 'Going' } }] });
    const step = await claudePlanner(client).next(INPUT, new AbortController().signal);
    expect(step).toMatchObject({ action: 'tap', target: 1, why: 'Going' });
    const p = calls[0];
    expect(p.model).toBe(DEFAULT_MODEL);
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.tool_choice).toEqual({ type: 'auto' });
    expect(p.tools[0]).toMatchObject({ name: 'next_step', strict: true });
    expect(p.tools[0].input_schema.additionalProperties).toBe(false);
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toContain('server-side-fallback-2026-07-01');
    expect(p.thinking).toEqual({ type: 'adaptive' });
    expect(p.messages[0].content[0].type).toBe('image');
    expect(p.messages[0].content[1].text).toContain('Find boots');
    expect(p.temperature).toBeUndefined();
  });

  it('a refusal ends the run politely', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', content: [] });
    expect((await claudePlanner(client).next(INPUT, new AbortController().signal)).action).toBe('done');
  });

  it('plain text without a step becomes the answer', async () => {
    const { client } = fakeClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'It is a shop.' }] });
    expect(await claudePlanner(client).next(INPUT, new AbortController().signal)).toMatchObject({ action: 'answer', text: 'It is a shop.' });
  });
});

describe('the address bar', () => {
  it('tells addresses from goals', () => {
    for (const a of ['example.com', 'https://a.b/c?d', 'localhost:3000', 'news.ycombinator.com/item?id=1']) expect(looksLikeAddress(a)).toBe(true);
    for (const g of ['find me a flight', 'buy boots', 'weather', '']) expect(looksLikeAddress(g)).toBe(false);
    expect(toAddress('example.com')).toBe('https://example.com');
    expect(toAddress('localhost:3000')).toBe('http://localhost:3000');
  });
});
