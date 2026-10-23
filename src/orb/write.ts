/**
 * Text helpers the orb works with: what a box is called (labelOf), whether its contents must never
 * leave the page (privateField), whether help may write in it (writable), and putting text in at
 * the caret the way typing would (insertText, used by the pilot's `type` step). DOM only, no AI.
 */

export type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

const PLAIN_INPUTS = new Set(['text', 'search', '']);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** A box whose contents must never leave the page: passwords, one-time codes, card details. */
export function privateField(el: Element): boolean {
  if (el.closest('[data-private]')) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.type === 'password') return true;
  const ac = (el.autocomplete || '').toLowerCase();
  return /current-password|new-password|one-time-code|cc-/.test(ac);
}

/** The name a person would use for an element (what a screen reader would say). */
export function labelOf(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return clean(aria);
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    if (clean(t)) return clean(t);
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const lab = el.labels?.[0]?.textContent;
    if (lab && clean(lab)) return clean(lab);
    if ('placeholder' in el && el.placeholder) return clean(el.placeholder);
  }
  return clean(el.innerText || el.textContent || el.getAttribute('title') || '').slice(0, 80);
}

/** A box writing help may work in. */
export function writable(el: Element | null): Field | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el.closest('[data-no-write-help], .cm-editor, .xterm, [data-own-caret]')) return null;
  if (privateField(el)) return null;
  if (el instanceof HTMLTextAreaElement) return el.readOnly || el.disabled ? null : el;
  if (el instanceof HTMLInputElement) {
    if (!PLAIN_INPUTS.has(el.type) || el.readOnly || el.disabled) return null;
    // Names, addresses, codes: the browser's own autofill knows better than a guess.
    const ac = (el.autocomplete || '').toLowerCase();
    if (ac && ac !== 'off' && ac !== 'on') return null;
    return el;
  }
  return el.isContentEditable ? el : null;
}

export function textOf(el: Field): string {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : (el.innerText ?? '');
}

/** The caret is at the very end (where ghost text makes sense), with nothing selected. */
export function caretAtEnd(el: Field): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.selectionStart === el.selectionEnd && el.selectionEnd === el.value.length;
  }
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || !sel.rangeCount || !el.contains(sel.focusNode)) return false;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setStart(sel.focusNode!, sel.focusOffset);
  return r.toString().trim() === '';
}

/** The selected text inside `el`, or ''. */
export function selectionIn(el: Field): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const a = el.selectionStart ?? 0, b = el.selectionEnd ?? 0;
    return el.value.slice(Math.min(a, b), Math.max(a, b));
  }
  const sel = window.getSelection();
  return sel && sel.rangeCount && el.contains(sel.anchorNode) && el.contains(sel.focusNode) ? sel.toString() : '';
}

/** Put text in at the caret (or over the selection) the way typing would: undoable, and frameworks see it. */
export function insertText(el: Field, text: string) {
  el.focus();
  if (document.queryCommandSupported?.('insertText') && document.execCommand('insertText', false, text)) return;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    const next = el.value.slice(0, a) + text + el.value.slice(b);
    setter ? setter.call(el, next) : (el.value = next);
    try {
      el.setSelectionRange(a + text.length, a + text.length);
    } catch {
      /* email and number boxes have no selection */
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    r.insertNode(document.createTextNode(text));
    r.collapse(false);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
