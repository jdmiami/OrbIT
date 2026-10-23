/**
 * The address bar is also how you talk to the orb: an address opens a page, anything else is a goal
 * for the orb ("find a train to Porto on Friday"). Shared by the chrome (for its hint) and main.
 */
export function looksLikeAddress(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  return /^(https?|file):\/\//i.test(t) || /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(t) || /^localhost(:\d+)?(\/\S*)?$/i.test(t);
}

/** An address the page view can open (a bare domain gets https://). */
export function toAddress(text: string): string {
  const t = text.trim();
  if (/^(https?|file):\/\//i.test(t)) return t;
  return /^localhost/i.test(t) ? `http://${t}` : `https://${t}`;
}
