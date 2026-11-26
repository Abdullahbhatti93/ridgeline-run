// Ridgeline Run — the flight model and the mission state machine. Pure
// simulation: no DOM, no canvas, so the same code runs in the browser and
// in a headless test. Units are metres, seconds and radians; heading 0
// points north (+z), pitch positive climbs, roll positive banks right.
import { PLANE, SCORE, STEP, TRACK } from './config.js';
import { groundHeight, makeRings, onRunway } from './terrain.js';

export const STATE_TITLE = 'title';
export const STATE_PLAY = 'play';
export const STATE_PAUSED = 'paused';
export const STATE_CRASHED = 'crashed';
export const STATE_LANDED = 'landed';

/** A fresh flight: lined up on the valley floor, engine idling. */
export function createWorld(seed) {
  void seed;
  return {
    state: STATE_TITLE,
    time: 0,
    x: 0,
    y: groundHeight(0, 120) + 55,
    z: 120,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 34,
    throttle: 0.55,
    fuel: PLANE.fuel,
    gearDown: false,
    score: 0,
    ringsPassed: 0,
    rings: makeRings(),
    message: '',
    messageUntil: 0,
    verticalSpeed: 0,
    best: 0,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function showMessage(world, text, seconds) {
  world.message = text;
  world.messageUntil = world.time + seconds;
}

/**
 * One fixed step of flight. `ctl` is { pitch: -1..1, roll: -1..1,
 * throttle: -1..1 (change), gear: bool (toggle request, edge-triggered by
 * the caller) }. Returns nothing; the world mutates in place.
 */
export function stepWorld(world, ctl) {
  if (world.state !== STATE_PLAY) return;
  world.time += STEP;
  const dt = STEP;

  // Throttle: a lever the pilot moves, not a switch.
  world.throttle = clamp(world.throttle + ctl.throttle * dt * 0.9, 0, 1);
  if (world.fuel <= 0) world.throttle = 0;
  world.fuel = Math.max(0, world.fuel - world.throttle * PLANE.fuelBurn * dt);

  // Pitch and roll ease toward what the pilot asks for; the aeroplane
  // answers at every speed, but a stalled wing answers weakly.
  const authority = clamp((world.speed - 14) / 30, 0.25, 1);
  const targetPitch = ctl.pitch * PLANE.maxPitch * authority;
  const targetRoll = ctl.roll * PLANE.maxRoll * authority;
  world.pitch += (targetPitch - world.pitch) * Math.min(1, dt * 3.2);
  world.roll += (targetRoll - world.roll) * Math.min(1, dt * 3.6);

  // Speed chases the throttle setting; gear and a steep climb cost speed.
  const top = world.gearDown ? PLANE.maxSpeedGearDown : PLANE.maxSpeed;
  const climbDrag = Math.max(0, world.pitch) * 26;
  const targetSpeed = world.throttle * top - climbDrag;
  world.speed += (targetSpeed - world.speed) * Math.min(1, dt * 0.55);
  if (world.speed < 0) world.speed = 0;

  // A banked turn: heading follows the roll (bank right turns right, toward
  // +x), and the turn tightens with speed.
  world.heading += world.roll * world.speed * PLANE.turnRate * dt;

  // Lift: below stall speed the nose drops and the aeroplane sinks.
  let sink = 0;
  if (world.speed < PLANE.stallSpeed) {
    sink = (PLANE.stallSpeed - world.speed) * 0.55;
  }
  const climb = world.speed * Math.sin(world.pitch);
  world.verticalSpeed = climb - sink;
  world.y += world.verticalSpeed * dt;
  world.x += Math.sin(world.heading) * world.speed * dt;
  world.z += Math.cos(world.heading) * world.speed * dt;

  // Rings: crossing a ring's plane inside its circle scores.
  const ring = world.rings[world.ringsPassed];
  if (ring && world.z >= ring.z) {
    const dx = world.x - ring.x;
    const dy = world.y - ring.y;
    if (dx * dx + dy * dy <= ring.radius * ring.radius) {
      ring.passed = true;
      world.ringsPassed += 1;
      world.score += SCORE.ring;
      showMessage(world, `RING ${world.ringsPassed} / ${TRACK.ringCount}  +${SCORE.ring}`, 2.2);
      world.ringChime = true;
    } else {
      showMessage(world, 'RING MISSED — keep flying, the runway is still ahead', 2.5);
      world.ringsPassed += 1;
    }
  }

  // Low fuel is a decision, not a surprise.
  if (world.fuel < 20 && world.fuel > 0 && !world.lowFuelWarned) {
    world.lowFuelWarned = true;
    showMessage(world, 'LOW FUEL — ease the throttle or land soon', 3);
  }

  // The ground decides the ending.
  const ground = groundHeight(world.x, world.z);
  if (world.y <= ground + 1.2) {
    if (
      onRunway(world.x, world.z) &&
      world.gearDown &&
      world.speed < 55 &&
      world.verticalSpeed > -4.5 &&
      Math.abs(world.roll) < 0.35
    ) {
      world.y = TRACK.runwayElev + 1.2;
      world.state = STATE_LANDED;
      const timeBonus = Math.max(0, SCORE.maxTimeBonus - Math.floor(world.time) * SCORE.timeBonusPerSecond);
      world.score += SCORE.landing + timeBonus;
      world.timeBonus = timeBonus;
      showMessage(world, 'TOUCHDOWN — welcome to Ridgeline Field', 5);
    } else {
      world.state = STATE_CRASHED;
      world.y = ground + 1.2;
      showMessage(world, world.y <= ground + 1.2 && world.speed < PLANE.stallSpeed ? 'STALLED — the wing stopped flying' : 'TERRAIN — you flew into the ridge', 5);
    }
  }

  // Flying off the far end of the world without landing is a missed approach.
  if (world.z > TRACK.runwayZ + 900) {
    world.state = STATE_CRASHED;
    showMessage(world, 'OVERSHOT — you flew past the field', 5);
  }
}

/** Start a fresh flight from the title screen. */
export function startFlight(world) {
  const fresh = createWorld(1);
  fresh.best = world.best;
  fresh.state = STATE_PLAY;
  return fresh;
}
