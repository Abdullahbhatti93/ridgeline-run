// The screenshot scenes behind ?shot=cover|rings|runway|landed. Each one
// plays the real rules forward from a fresh flight for a fixed number of
// steps, steered by a simple autopilot (aim at the next ring, then at the
// runway centreline, flare and land), so the frame is what a real game
// looks like and the same seed always gives the same frame. If the
// autopilot fails to land, the landed scene honestly shows the crash it
// really flew into — the frame is never staged by hand.
import { STEP, TRACK } from './config.js';
import { createWorld, stepWorld, STATE_LANDED, STATE_CRASHED, STATE_PLAY } from './physics.js';

const SAMPLE = STEP;

/** Steer toward (tx, ty, tz): bank to the heading, pitch to the altitude. */
function autopilot(world) {
  const ring = world.rings[world.ringsPassed];
  let tx;
  let ty;
  let tz;
  let throttle = 0.72;
  if (ring) {
    tx = ring.x;
    ty = ring.y;
    tz = ring.z;
  } else {
    // Final approach: centreline, stepping down to the runway.
    tx = 0;
    tz = TRACK.runwayZ + 200;
    if (world.z < TRACK.runwayZ - 260) {
      ty = TRACK.runwayElev + 60;
      throttle = 0.55;
    } else if (world.z < TRACK.runwayZ) {
      ty = TRACK.runwayElev + 8;
      throttle = 0.45;
    } else {
      ty = TRACK.runwayElev + 1.5;
      throttle = 0.35;
    }
  }
  const dx = tx - world.x;
  const dz = Math.max(1, tz - world.z);
  const wantHeading = Math.atan2(dx, dz);
  let dh = wantHeading - world.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, dh * 2.4));
  const altErr = ty - world.y;
  const pitch = Math.max(-1, Math.min(1, altErr / 55));
  return { pitch, roll, throttle: (throttle - world.throttle) * 2.2 };
}

/** Run the world forward `seconds` under the autopilot. */
function fly(world, seconds) {
  for (let t = 0; t < seconds; t += SAMPLE) {
    if (world.state !== STATE_PLAY) break;
    if (!world.rings[world.ringsPassed] && world.z > TRACK.runwayZ - 420 && !world.gearDown) {
      world.gearDown = true;
    }
    stepWorld(world, autopilot(world));
  }
  return world;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * cover: mid-valley, ring ahead, town and river below.
 * rings: crossing ring 5, low over the river.
 * runway: short final, gear down, runway dead ahead.
 * landed: the autopilot flies the whole mission and lands on the runway.
 */
export function stageShot(name, world) {
  const fresh = createWorld(1);
  fresh.state = STATE_PLAY;
  if (name === 'cover') {
    fly(fresh, 13);
    return { world: fresh, screen: 'play' };
  }
  if (name === 'rings') {
    fly(fresh, 34);
    return { world: fresh, screen: 'play' };
  }
  if (name === 'runway') {
    fly(fresh, 78);
    if (fresh.state === STATE_PLAY && fresh.z < TRACK.runwayZ - 350) fly(fresh, 12);
    return { world: fresh, screen: 'play' };
  }
  // landed: fly the whole mission; the autopilot really lands it.
  fly(fresh, 240);
  if (fresh.state === STATE_LANDED) return { world: fresh, screen: 'landed' };
  if (fresh.state === STATE_CRASHED) return { world: fresh, screen: 'crashed' };
  return { world: fresh, screen: 'play' };
}
