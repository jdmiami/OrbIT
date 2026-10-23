/**
 * What the pilot must never do on its own, and what it must ask about first. Plain functions, so
 * they are unit-tested and shared by every planner and host.
 */
import type { ItemView, Step } from './types';

/**
 * Words on a control that mean "this is hard to undo": money, sending, deleting, publishing,
 * signing, accounts. The orb asks before pressing one of these (and before submitting a box with Enter
 * when the form's own button would be one).
 */
const RISKY =
  /\b(pay|payment|buy|purchase|place (an |the |my |your )?order|order now|checkout|check out|book|reserve|subscribe|donate|transfer|send|submit|post|publish|tweet|delete|remove|erase|destroy|cancel (my |your |the )?(account|subscription|order|booking)|close (my |your )?account|unsubscribe|confirm|sign up|register|agree|install|authori[sz]e|grant access)\b/i;

/** A question to ask before this step, or null if it may go ahead. */
export function needsConfirm(step: Step, item: ItemView | undefined): string | null {
  if (step.action === 'tap' && item && RISKY.test(item.label)) return `Press “${item.label}”?`;
  if (step.action === 'type' && step.submit && item && RISKY.test(item.label)) return `Send “${clip(step.text ?? '', 40)}” with “${item.label}”?`;
  return null;
}

/** Only ordinary web pages: never javascript:, data:, file: or the browser's own pages. */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
