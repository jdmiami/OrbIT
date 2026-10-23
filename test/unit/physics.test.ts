import { describe, expect, it } from 'vitest';
import { DEEP_PRESS, SPRINGS, ShakeDetector, SpringValue, VelocityTracker, landing, project, rubberBand, rubberClamp, spring, stretchFor } from '../../src/orb/physics';

describe('springs', () => {
  it('turns response and damping into stiffness and damping for a unit mass', () => {
    const s = spring(1, 1);
    expect(s.stiffness).toBeCloseTo((2 * Math.PI) ** 2);
    expect(s.damping).toBeCloseTo(4 * Math.PI);
  });

  it('a critically damped value settles on its target without overshooting', () => {
    const v = new SpringValue(0, spring(0.3, 1));
    v.target = 100;
    let max = 0;
    for (let i = 0; i < 120; i++) {
      v.step(1 / 60);
      max = Math.max(max, v.value);
    }
    expect(max).toBeLessThanOrEqual(100.01);
    expect(v.resting()).toBe(true);
  });

  it('a bouncy spring overshoots, then settles', () => {
    const v = new SpringValue(0, SPRINGS.jelly);
    v.target = 1;
    let max = 0;
    for (let i = 0; i < 240; i++) {
      v.step(1 / 60);
      max = Math.max(max, v.value);
    }
    expect(max).toBeGreaterThan(1.05);
    expect(v.resting(0.002)).toBe(true);
  });

  it('is stable at any frame rate (dt is capped and substepped)', () => {
    const v = new SpringValue(0, SPRINGS.track);
    v.target = 50;
    for (let i = 0; i < 30; i++) v.step(0.5);
    expect(v.value).toBeCloseTo(50, 1);
  });

  it('has the aim spring the pilot flies with', () => {
    expect(SPRINGS.aim).toEqual(spring(0.36, 0.84));
  });
});

describe('momentum, rubber band, landing', () => {
  it('projects where a throw coasts to', () => {
    expect(project(0)).toBe(0);
    expect(project(1000)).toBeCloseTo(499, 0);
  });

  it('rubber-bands past an edge, never further than the dimension', () => {
    expect(rubberBand(0, 100)).toBe(0);
    expect(rubberBand(50, 100)).toBeLessThan(50);
    expect(rubberBand(1e9, 100)).toBeLessThan(100);
    expect(rubberClamp(50, 0, 100, 100)).toBe(50);
    expect(rubberClamp(-40, 0, 100, 100)).toBeGreaterThan(-40);
  });

  it('snaps a throw to the nearer side and keeps the height', () => {
    const view = { x: 0, y: 0, w: 400, h: 800 };
    const left = landing({ x: 150, y: 300 }, { x: -800, y: 0 }, view, 56);
    expect(left.x).toBe(28);
    expect(left.tuck).toBe(false);
    const right = landing({ x: 250, y: 300 }, { x: 800, y: 0 }, view, 56);
    expect(right.x).toBe(372);
  });

  it('tucks it away after a hard throw off the bottom', () => {
    expect(landing({ x: 200, y: 700 }, { x: 0, y: 3000 }, { x: 0, y: 0, w: 400, h: 800 }, 56).tuck).toBe(true);
  });

  it('stretches along the speed, by at most 22%', () => {
    expect(stretchFor(0, 0).stretch).toBe(1);
    expect(stretchFor(1e6, 0).stretch).toBeCloseTo(1.22);
  });
});

describe('finger tracking and gestures', () => {
  it('measures finger speed from recent samples', () => {
    const t = new VelocityTracker();
    for (let i = 0; i <= 10; i++) t.add(i * 10, i * 10, 0); // 10 px every 10 ms = 1000 px/s
    expect(t.velocity().x).toBeCloseTo(1000, 0);
  });

  it('counts three reversing jolts as one shake, then cools down', () => {
    const s = new ShakeDetector();
    expect(s.push(0, 20, 0)).toBe(false);
    expect(s.push(100, -20, 0)).toBe(false);
    expect(s.push(200, 20, 0)).toBe(true);
    expect(s.push(300, -20, 0)).toBe(false);
  });

  it('keeps the deep press thresholds', () => {
    expect(DEEP_PRESS).toEqual({ force: 0.55, holdMs: 420, slopPx: 8 });
  });
});
