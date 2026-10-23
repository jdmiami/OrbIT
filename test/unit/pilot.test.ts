import { describe, expect, it } from 'vitest';
import { PILOT_LINES, runPilot } from '../../src/pilot/run';
import { needsConfirm, safeUrl } from '../../src/pilot/safety';
import { describeHistory, describePage, parseStepText, toStep } from '../../src/pilot/prompt';
import type { Hands, PageView, Planner, Step } from '../../src/pilot/types';

const step = (s: Partial<Step>): Step => ({ action: 'done', target: null, text: null, url: null, submit: null, direction: null, why: '', ...s });
const PAGE: PageView = {
  url: 'https://shop.example/',
  title: 'Shop',
  items: [
    { id: 1, role: 'field', label: 'Search', value: 'boots' },
    { id: 2, role: 'button', label: 'Buy now' },
    { id: 3, role: 'link', label: 'Help', offscreen: true },
  ],
  text: 'Welcome to the shop',
  scroll: { at: 0, more: true },
};

function fakeHands(over: Partial<Hands> = {}) {
  const did: Step[] = [];
  const said: string[] = [];
  const hands: Hands = {
    look: async () => PAGE,
    perform: async (s) => (did.push(s), { ok: true, note: `did ${s.action}` }),
    confirm: async () => true,
    ask: async () => 'Friday',
    say: (l) => said.push(l),
    ...over,
  };
  return { hands, did, said };
}
const scripted = (steps: Partial<Step>[]): Planner => {
  let i = 0;
  return { next: async () => step(steps[i++] ?? { action: 'done', text: 'end' }) };
};
const go = (planner: Planner, hands: Hands, extra = {}) => runPilot('goal', { planner, hands, signal: new AbortController().signal, ...extra });

describe('runPilot', () => {
  it('does each step until done, and returns the closing line', async () => {
    const { hands, did } = fakeHands();
    const line = await go(scripted([{ action: 'type', target: 1, text: 'shoes', submit: true }, { action: 'scroll', direction: 'down' }, { action: 'done', text: 'Found them.' }]), hands);
    expect(line).toBe('Found them.');
    expect(did.map((s) => s.action)).toEqual(['type', 'scroll']);
  });

  it('an answer ends the run without touching the page', async () => {
    const { hands, did } = fakeHands();
    expect(await go(scripted([{ action: 'answer', text: 'It is a shop.' }]), hands)).toBe('It is a shop.');
    expect(did).toEqual([]);
  });

  it('asks before a risky press, and stops if the person says no', async () => {
    const asked: string[] = [];
    const { hands, did } = fakeHands({ confirm: async (q) => (asked.push(q), false) });
    expect(await go(scripted([{ action: 'tap', target: 2 }]), hands)).toBe(PILOT_LINES.declined);
    expect(asked).toEqual(['Press “Buy now”?']);
    expect(did).toEqual([]);
  });

  it('passes the person’s answer to the planner as history', async () => {
    const { hands } = fakeHands();
    let seen = '';
    const planner: Planner = {
      next: async ({ history }) => {
        if (!history.length) return step({ action: 'ask', text: 'Which day?' });
        seen = history[0].result.note;
        return step({ action: 'done', text: 'ok' });
      },
    };
    await go(planner, hands);
    expect(seen).toBe('They said: Friday');
  });

  it('closing the question stops the run', async () => {
    const { hands } = fakeHands({ ask: async () => null });
    expect(await go(scripted([{ action: 'ask', text: '?' }]), hands)).toBe(PILOT_LINES.noAnswer);
  });

  it('gives up after three failures in a row', async () => {
    const { hands } = fakeHands({ perform: async () => ({ ok: false, note: 'no such item' }) });
    expect(await go(scripted(Array(5).fill({ action: 'tap', target: 9 })), hands)).toBe(PILOT_LINES.stuck('no such item'));
  });

  it('never opens a non-web address', async () => {
    const { hands, did } = fakeHands();
    let note = '';
    await go(scripted([{ action: 'go', url: 'javascript:alert(1)' }]), hands, { onStep: (d: { result: { note: string } }) => (note = d.result.note), maxFailures: 1 });
    expect(did).toEqual([]);
    expect(note).toContain('not a web address');
  });

  it('stops when aborted', async () => {
    const ctrl = new AbortController();
    const { hands } = fakeHands({ perform: async () => (ctrl.abort(), { ok: true, note: '' }) });
    expect(await runPilot('g', { planner: scripted(Array(5).fill({ action: 'scroll' })), hands, signal: ctrl.signal })).toBe(PILOT_LINES.stopped);
  });

  it('stops after the step budget', async () => {
    const { hands } = fakeHands();
    expect(await go(scripted(Array(10).fill({ action: 'wait' })), hands, { maxSteps: 3 })).toBe(PILOT_LINES.outOfSteps);
  });
});

describe('safety', () => {
  it('flags hard-to-undo presses', () => {
    expect(needsConfirm(step({ action: 'tap', target: 2 }), { id: 2, role: 'button', label: 'Place order' })).toBe('Press “Place order”?');
    expect(needsConfirm(step({ action: 'tap', target: 2 }), { id: 2, role: 'button', label: 'Delete account' })).not.toBeNull();
    expect(needsConfirm(step({ action: 'tap', target: 2 }), { id: 2, role: 'link', label: 'Next page' })).toBeNull();
    expect(needsConfirm(step({ action: 'tap', target: 2 }), { id: 2, role: 'button', label: 'Sign in' })).toBeNull();
  });

  it('allows only http(s) addresses, adding https to a bare domain', () => {
    expect(safeUrl('example.com')).toBe('https://example.com/');
    expect(safeUrl('http://a.b/c')).toBe('http://a.b/c');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('file:///etc/passwd')).toBeNull();
    expect(safeUrl('data:text/html,hi')).toBeNull();
  });
});

describe('prompt', () => {
  it('writes the page out with numbers, values and off-screen marks', () => {
    const t = describePage(PAGE);
    expect(t).toContain('[1] field "Search" = "boots"');
    expect(t).toContain('[3] link "Help" (off screen: scrolled to first)');
    expect(t).toContain('more below');
    expect(t).toContain('Welcome to the shop');
  });

  it('writes the history one line per step', () => {
    expect(describeHistory([])).toContain('first step');
    expect(describeHistory([{ step: step({ action: 'tap', target: 2 }), result: { ok: false, note: 'gone' } }])).toBe('1. tap [2] → FAILED: gone');
  });

  it('reads a step from forgiving JSON', () => {
    expect(toStep({ do: 'TAP', target: '4' })).toMatchObject({ action: 'tap', target: 4 });
    expect(toStep({ action: 'tap' })).toBeNull();
    expect(toStep({ action: 'fly' })).toBeNull();
    expect(toStep({ action: 'scroll' })?.direction).toBe('down');
    expect(parseStepText('<think>hmm</think>Sure: {"action":"type","target":1,"text":"a \\"b\\" }","why":"x"} trailing')).toMatchObject({ action: 'type', text: 'a "b" }' });
    expect(parseStepText('no json here')).toBeNull();
  });
});
