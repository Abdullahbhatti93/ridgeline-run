// Ridgeline Run — the world: procedural terrain, the winding river, the
// lakeside town, the runway and the target rings. Pure functions of (x, z)
// plus a fixed seed, so the physics, the renderer and the screenshot
// autopilot all see the same valley.
import { TRACK } from './config.js';
import { createRandom } from './random.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function smoothstep(a, b, t) {
  const u = clamp((t - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
}

/** The river's centre line meanders down the valley. */
export function riverX(z) {
  return 150 * Math.sin(z * 0.0011) + 70 * Math.sin(z * 0.0029 + 1.3) - 40;
}

/** Raw rolling hills: ridges rise away from the valley floor. */
function hills(x, z) {
  const ridge = 46 * Math.pow(clamp((Math.abs(x) - 240) / 420, 0, 1), 2);
  return (
    24 * Math.sin(x * 0.0055 + z * 0.0012) +
    13 * Math.sin(x * 0.013 - z * 0.0021 + 2.0) +
    7 * Math.sin(x * 0.031 + z * 0.0043 + 0.6) +
    ridge +
    22
  );
}

/** Ground height in metres at (x, z). Flattened near the river and the runway. */
export function groundHeight(x, z) {
  let h = hills(x, z);
  // Carve the river channel.
  const dRiver = Math.abs(x - riverX(z));
  h -= 9 * (1 - smoothstep(4, 26, dRiver));
  // Flatten the runway apron so a landing is possible.
  const dRun = Math.abs(x);
  const zIn = smoothstep(TRACK.runwayZ - 260, TRACK.runwayZ - 40, z) * (1 - smoothstep(TRACK.runwayZ + 460, TRACK.runwayZ + 680, z));
  const flat = 1 - smoothstep(24, 130, dRun);
  h = h * (1 - flat * zIn) + TRACK.runwayElev * (flat * zIn);
  return h;
}

/** Is (x, z) on the runway strip? */
export function onRunway(x, z) {
  return Math.abs(x) <= TRACK.runwayHalfWidth && z >= TRACK.runwayZ && z <= TRACK.runwayZ + 420;
}

/** Is (x, z) in the river? */
export function inRiver(x, z) {
  return Math.abs(x - riverX(z)) < 13;
}

/** The lakeside town: a fixed cluster of buildings west of the river. */
export function townBuildings() {
  const rand = createRandom(20261126);
  const list = [];
  const cx = -215;
  const cz = 2650;
  for (let i = 0; i < 16; i += 1) {
    const bx = cx + (rand() - 0.5) * 190;
    const bz = cz + (rand() - 0.5) * 240;
    const w = 16 + rand() * 22;
    const d = 16 + rand() * 22;
    const h = 12 + rand() * 26;
    list.push({ x: bx, z: bz, w, d, h, hue: rand() });
  }
  return list;
}

/** The eight target rings, strung along the valley with alternating offsets. */
export function makeRings() {
  const rings = [];
  for (let i = 0; i < TRACK.ringCount; i += 1) {
    const z = TRACK.firstRingZ + i * TRACK.ringSpacing;
    const x = i % 2 === 0 ? -95 - (i % 3) * 35 : 95 + (i % 3) * 30;
    const y = groundHeight(x, z) + 62 + (i % 3) * 14;
    rings.push({ x, y, z, radius: TRACK.ringRadius, passed: false });
  }
  return rings;
}

/** A few drifting clouds, fixed by seed so every run looks the same. */
export function makeClouds() {
  const rand = createRandom(77);
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: (rand() - 0.5) * 1600,
      y: 210 + rand() * 130,
      z: rand() * 6200,
      r: 34 + rand() * 66,
    });
  }
  return clouds;
}
