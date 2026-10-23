# 04 · Physics

Everything that moves the orb: the springs, momentum, the rubber band, squash and stretch, the pinch
curve, the shake detector, the deep press, and the frame loop. Units are CSS pixels and seconds.

All of `src/orb/physics.ts` is plain math with no DOM, and is unit-tested
(`test/unit/physics.test.ts`).

---

## Springs

```
spring(response, dampingRatio) → { stiffness: w², damping: 2·ζ·w }    w = 2π / response, unit mass
```

`response` is roughly how long a move takes. `dampingRatio` 1 = no overshoot, lower = more bounce.

| Name | response | damping | For | Defined in |
|---|---|---|---|---|
| `SPRINGS.track` | 0.09 | 0.92 | under the finger while dragging | physics.ts |
| `SPRINGS.follow` | 0.62 | 0.86 | drifting to what matters (`moveTo` default) | physics.ts |
| `SPRINGS.land` | 0.42 | 0.68 | after a throw or drop; `rest()` when not following; `activate()` | physics.ts |
| `SPRINGS.press` | 0.16 | 0.58 | the `depth` value (sinking under a press) | physics.ts |
| `SPRINGS.jelly` | 0.32 | 0.38 | squash/stretch recovery; loose so the wobble shows | physics.ts |
| `SPRINGS.summon` | 0.5 | 0.55 | a shake brings it to the middle with energy | physics.ts |
| `SPRINGS.aim` | 0.36 | 0.84 | the pilot flying to a control it is about to press or type into (`flyTo`) | physics.ts |
| `CARET` | 0.075 | 1 | riding the caret letter by letter; never overshoots | OrbCursor.tsx |
| `MORPH` | 0.34 | 0.9 | the ball ⇄ caret shape value | OrbCursor.tsx |
| `GLIDE` | 0.48 | 0.96 | gliding over to become the caret, home afterwards, onto and off a stage | OrbCursor.tsx |
| `GROW` | 0.55 | 0.72 | growing into a spot or stage, and back | OrbCursor.tsx |
| `PINCH_TRACK` | 0.09 | 1 | pinch size follows the fingers | OrbCursor.tsx |
| `BOUNCE` | 0.6 | 0.34 | let go of a pinch: bounces back to size, overshooting a few times | OrbCursor.tsx |

Changed from OrbitDesign: `SPRINGS.aim` existed only in the source app (as `AIM`) for its agent and
was not ported. It is back, for the pilot.

## `SpringValue`

One value with `value`, `velocity`, `target`, `spring`.

- `step(dt)`: semi-implicit Euler in substeps of `1/240` s, `dt` capped at `0.064` s:
  `a = −stiffness·(value − target) − damping·velocity; velocity += a·h; value += velocity·h`.
- `resting(eps = 0.05)`: `|value − target| < eps && |velocity| < eps·20`.
- `set(v)`: jump, no animation (velocity 0).

## `VelocityTracker(windowMs = 100)`

Keeps the finger samples of the last 100 ms (always at least 2) and returns the least-squares slope
in px/s. That ignores single-frame jitter and the slow-down just before lift-off. `reset()` clears
it on each pointer down.

## Momentum and landing

- `DECELERATION = 0.998` (per ms).
- `project(v, rate)` = `(v/1000 · rate) / (1 − rate)`: where something at `v` px/s would coast to.
- `landing(pos, vel, bounds, size)`:

```
px = pos.x + project(vel.x);  py = pos.y + project(vel.y);  r = size/2
minX = bounds.x + r;  maxX = bounds.x + bounds.w − r      (same for y)
tuck = vel.y > 2400 && py > maxY + size                    // a hard throw off the bottom
y = clamp(py, minY, maxY)
x = px < bounds.x + bounds.w/2 ? minX : maxX               // the nearer side, height kept
```

## Rubber band

```
rubberBand(overshoot, dimension, c = 0.55) = (1 − 1/((overshoot·c)/dimension + 1)) · dimension
rubberClamp(v, min, max, dimension): inside → v; below → min − rubberBand(min − v); above → max + rubberBand(v − max)
```

While dragging: `x.target = rubberClamp(tx, v.x + 28, v.x + v.w − 28, v.w·0.25)`, and the same for y
with `v.h·0.25`.

## Squash and stretch

`stretchFor(vx, vy, max = 0.22)` → `stretch = 1 + min(0.22, speed / 5200)`, `angle = atan2(vy, vx)`.
Applied only at `level === 'full'` and not in caret mode. The loop clamps `s = max(0.6, jelly.value)`.

## Pinch size and text zoom

```
stretchOf(r):  s = r^0.75;  s > 2 ? 2 + (s − 2)·0.2 : s < 0.5 ? 0.5 − (0.5 − s)·0.2 : s
ZOOM = { min: 0.9, max: 1.3, step: 0.05, per: 1.2 }
zoomFor(r, now):  steps = round(ln r / ln 1.2);  clamp(round((now + steps·0.05)·100)/100, 0.9, 1.3)
```

`r` = finger distance now / at the start. One text step per 1.2× of finger distance.

## `ShakeDetector(threshold = 13, needed = 3, windowMs = 800, cooldownMs = 1200)`

Fed `(t, ax, ay, az)` in m/s² without gravity. Ignores `|a| < 13`. Takes the sign of the dominant
axis (x if `|ax| ≥ |ay|`, else y), and records a peak only when the sign reverses. Three such peaks
within 800 ms is one shake, then 1200 ms of cooldown.

## `DEEP_PRESS`

`{ force: 0.55, holdMs: 420, slopPx: 8 }`. A press is deep when pointer pressure reaches 0.55, or
when it is held 420 ms without moving more than 8 px.

---

## The frame loop

Runs on `requestAnimationFrame` only while something moves. `kick()` starts it; it stops itself.

```
dt = last ? min(0.05, (t − last)/1000) : 1/60
x.step, y.step, depth.step
if flight:                                  // on the way to become the caret
  d = |target − value|;  p = 1 − min(1, d / flight.d0)
  k = clamp((p − 0.45) / 0.55, 0, 1);  morph.target = k²·(3 − 2k)    // round for 45 % of the trip, then narrows
  if d < 0.75: flight = null; morph.target = 1; x.spring = y.spring = CARET
morph.step, grow.step, pinch.step
v = mode === 'drag' ? tracker.velocity() : (x.velocity, y.velocity)
{stretch, angle} = full && mode !== 'caret' ? stretchFor(v) : {1, 0}
jelly.target = stretch; jelly.step
s = max(0.6, jelly.value);  press = 1 − max(0, depth.value)·0.16
m = clamp(morph.value, 0, 1.15);  g = max(0.2, grow.value · pinch.value)
cw = (1 + (2.5/56 − 1)·m)·g;  ch = (1 + (caretH/56 − 1)·m)·g
transform = translate3d(x−28, y−28, 0) scale(cw, ch) rotate(angle) scale(s·press, press/s) rotate(−angle)
--depth = max(0, depth.value)
--orb-x, --orb-y on the layer;  data-slim = morph.value > 0.2;  data-flying = !!flight
still = !flight && x.resting() && y.resting() && depth.resting(0.002) && jelly.resting(0.002)
        && morph.resting(0.002) && grow.resting(0.002) && pinch.resting(0.002)
next frame if mode === 'drag' || !still
```

`moveTo(px, py, spring = SPRINGS.follow)` sets both springs and targets and kicks. At
`level === 'off'` it uses `set()`, so it jumps. `jelly.velocity += n` is the "nod" used throughout.
The amounts are in the gesture and transition tables.

### Motion levels

| Level | Movement | Squash | Face |
|---|---|---|---|
| `full` | springs | yes | WebGL shader |
| `lite` | springs | no | CSS sphere with eyes |
| `off` | jumps (`set()`), the pilot's waits drop to 0 | no | CSS sphere, no face |

`systemLevel()` (in `level.ts`) returns `'off'` under `prefers-reduced-motion: reduce`, else `'full'`.

See also: [03 · Anatomy](03-anatomy.md) · [05 · Behaviour](05-behaviour.md) · [06 · Caret and gestures](06-caret-and-gestures.md)
