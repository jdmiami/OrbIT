/**
 * The orb. Mount `<OrbCursor brain={…} />` once, last in your app, and load face.css, orb.css and
 * orb-page.css (or call mountOrb() from src/embed to put it on any page). Pages mark what matters with
 * data-orb-* attributes and talk to the orb with the helpers in events.tsx. See docs/README.md.
 */
export { OrbCursor } from './OrbCursor';
export type { OrbBrain, OrbSettings, OrbCursorProps, OrbHandle } from './OrbCursor';
export { OrbSpot, orbSay, orbNote, orbThink, orbHome, orbRun, onOrbAct } from './events';
export type { OrbNote, OrbAct } from './events';
export { OrbFace } from './OrbFace';
export type { OrbFaceState } from './OrbFace';
export type { MotionLevel } from './level';
export { systemLevel } from './level';
export { configureFeedback, cue, tick } from './feedback';
export * from './physics';
export { findFocus, restSpot, besideRect, coversControl } from './attention';
export type { Focus } from './attention';
export { caretField, caretOf, caretAt, caretsAt, offsetAt } from './caret';
export type { Caret } from './caret';
export { insertText, writable, textOf, caretAtEnd, selectionIn, privateField, labelOf } from './write';
export type { Field } from './write';
export { screenText, snapshot, isExplain, EXPLAIN_PROMPT } from './screen';
export type { PageItem } from './screen';
