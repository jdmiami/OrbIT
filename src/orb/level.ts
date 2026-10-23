/**
 * How much the orb animates. 'full': springs, squash and stretch, the GPU face. 'lite': springs, no
 * squash, the CSS face with eyes. 'off': no animation, it jumps (Reduce Motion).
 */
export type MotionLevel = 'full' | 'lite' | 'off';

/** The level the device asks for: 'off' under Reduce Motion, else 'full'. */
export function systemLevel(): MotionLevel {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'full';
  } catch {
    return 'full';
  }
}
