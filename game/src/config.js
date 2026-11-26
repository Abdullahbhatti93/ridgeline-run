// Ridgeline Run — tuning, palette and world constants. One clear job: every
// number the game balances on lives here, so the rules can be tuned without
// touching the simulation or the renderer.
export const STEP = 1 / 60;
export const FIELD = { width: 1280, height: 720 };

// The flight corridor runs north (+z). The runway sits at the far end;
// eight target rings are strung along the valley before it.
export const TRACK = {
  runwayZ: 5200, // runway threshold (its far end is +420 m)
  runwayHalfWidth: 16,
  runwayElev: 40, // metres above sea level
  ringCount: 8,
  ringSpacing: 600,
  firstRingZ: 600,
  ringRadius: 20,
};

export const PLANE = {
  maxSpeed: 96, // m/s at full throttle, gear up
  maxSpeedGearDown: 68,
  stallSpeed: 26, // below this the wing stops flying and the nose drops
  climbRate: 1.0, // pitch authority, scaled by speed
  turnRate: 0.011, // heading change per radian of bank, per m/s
  maxPitch: 0.42,
  maxRoll: 0.95,
  fuel: 100,
  fuelBurn: 0.5, // per second at full throttle
};

export const SCORE = { ring: 100, landing: 500, timeBonusPerSecond: 2, maxTimeBonus: 600 };

export const PALETTE = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#cfe4f2',
  sun: '#fff3c4',
  cloud: '#ffffff',
  meadow: '#5da244',
  meadowDry: '#8aa84f',
  forest: '#2f6b2e',
  rock: '#8d8578',
  snow: '#eef2f5',
  river: '#3f8fd2',
  sand: '#d9c48a',
  townGround: '#b9a98c',
  runway: '#3a3f46',
  runwayMark: '#f4f6f8',
  ring: '#ffb020',
  ringNext: '#ffd34d',
  ringDone: '#7ddb6a',
  panel: '#14181f',
  panelEdge: '#2c3442',
  litGreen: '#39e585',
  litAmber: '#ffb020',
  litRed: '#ff5a4e',
  hudText: '#f2f6fa',
  hudDim: '#b9c6d4',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Best score / best time kept between visits (this browser only). */
export const BEST_KEY = 'ridgeline-run.best';
