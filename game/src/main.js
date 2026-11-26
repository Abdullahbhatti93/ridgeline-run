// Ridgeline Run — the game loop: fixed-step simulation, rendering, screens
// and sound, wired together. `?shot=<name>&seed=1` stages one deterministic
// screenshot scene instead of the title screen (used for screenshots/).
import { FIELD, STEP, BEST_KEY } from './config.js';
import { createWorld, startFlight, stepWorld, STATE_TITLE, STATE_PLAY, STATE_PAUSED, STATE_CRASHED, STATE_LANDED } from './physics.js';
import { createCamera, draw } from './render.js';
import { townBuildings, makeClouds } from './terrain.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_GEAR, ACTION_MUTE, ACTION_RESTART } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

let world = createWorld(1);
try {
  world.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
} catch {
  world.best = 0;
}

const camera = createCamera();
const input = createInput(canvas);
const audio = createAudio();
const buildings = townBuildings();
const clouds = makeClouds();

let screen = STATE_TITLE;
let shotWorld = null;
let shotScreen = null;

if (shotName) {
  const staged = stageShot(shotName, world);
  shotWorld = staged.world;
  shotScreen = staged.screen;
  world = shotWorld;
  screen = shotScreen;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(FIELD.width * dpr);
  canvas.height = Math.floor(FIELD.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

function saveBest() {
  if (world.score > world.best) {
    world.best = world.score;
    try {
      localStorage.setItem(BEST_KEY, String(world.best));
    } catch {
      // Private mode: the best score simply does not persist.
    }
  }
}

let last = performance.now();
let acc = 0;
let lastState = world.state;

function tick(now) {
  requestAnimationFrame(tick);
  ui.now = now;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (!shotName) {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      ui.muted = muted;
    }
    if (screen === STATE_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        world = startFlight(world);
        screen = STATE_PLAY;
      }
    } else if (screen === STATE_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = STATE_PAUSED;
      } else {
        if (actions & ACTION_GEAR) {
          world.gearDown = !world.gearDown;
          audio.click();
        }
        if (actions & ACTION_RESTART) {
          world = startFlight(world);
        }
        acc += dt;
        while (acc >= STEP) {
          stepWorld(world, input.control());
          acc -= STEP;
        }
        if (world.state === STATE_CRASHED) {
          screen = STATE_CRASHED;
          audio.crash();
          saveBest();
        } else if (world.state === STATE_LANDED) {
          screen = STATE_LANDED;
          audio.land();
          saveBest();
        }
        if (world.ringChime) {
          world.ringChime = false;
          audio.ring();
        }
      }
    } else if (screen === STATE_PAUSED) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
        screen = STATE_PLAY;
        audio.click();
      }
    } else if (screen === STATE_CRASHED || screen === STATE_LANDED) {
      if (actions & ACTION_CONFIRM || actions & ACTION_RESTART) {
        audio.unlock();
        audio.click();
        world = startFlight(world);
        screen = STATE_PLAY;
      }
    }
  }

  camera.update(world, dt);
  audio.update(world.throttle, world.speed, screen === STATE_PLAY);
  draw(ctx, world, ui);
  if (world.state !== lastState) {
    lastState = world.state;
    statusEl.textContent =
      world.state === STATE_PLAY ? `Flying: score ${world.score}, rings ${world.ringsPassed} of 8` :
      world.state === STATE_CRASHED ? `Crashed. Score ${world.score}. Press R to fly again.` :
      world.state === STATE_LANDED ? `Landed! Score ${world.score}. Press R to fly again.` :
      'Ridgeline Run: press Enter to fly.';
  }
}

const ui = {
  get screen() {
    return screen;
  },
  camera,
  buildings,
  clouds,
  muted: false,
  now: 0,
};

requestAnimationFrame(tick);
