// Keyboard and mouse input. Held keys give pitch/roll/throttle; one-shot
// presses (start, restart, pause, gear, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse steers too: move it left/right to bank,
// up/down to pitch, and hold the left button for throttle up.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GEAR = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const ROLL_LEFT = new Set(['ArrowLeft', 'KeyA']);
const ROLL_RIGHT = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'KeyE']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'KeyQ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const GEAR = new Set(['KeyG']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let mouseThrottle = false;

  window.addEventListener('keydown', (event) => {
    if (PITCH_UP.has(event.code) || PITCH_DOWN.has(event.code) || ROLL_LEFT.has(event.code) ||
        ROLL_RIGHT.has(event.code) || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (GEAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_GEAR;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseActive = false;
    mouseThrottle = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - r.left) / r.width) * 2 - 1;
    mouseY = ((event.clientY - r.top) / r.height) * 2 - 1;
    mouseActive = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      mouseThrottle = true;
      actions |= ACTION_CONFIRM;
    }
  });
  canvas.addEventListener('pointerup', () => {
    mouseThrottle = false;
  });
  canvas.addEventListener('pointerleave', () => {
    mouseActive = false;
  });

  const has = (...codes) => codes.some((c) => held.has(c));

  return {
    /** Steering for this frame: { pitch, roll, throttle } in -1..1. */
    control() {
      let pitch = (has('ArrowUp', 'KeyW') ? 1 : 0) - (has('ArrowDown', 'KeyS') ? 1 : 0);
      let roll = (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0);
      let throttle = (has('ShiftLeft', 'ShiftRight', 'KeyE') ? 1 : 0) - (has('ControlLeft', 'ControlRight', 'KeyQ') ? 1 : 0);
      if (mouseActive) {
        // Mouse steers gently: the keyboard always wins when both are held.
        if (pitch === 0) pitch = Math.max(-1, Math.min(1, -mouseY * 1.4));
        if (roll === 0) roll = Math.max(-1, Math.min(1, mouseX * 1.4));
      }
      if (mouseThrottle && throttle === 0) throttle = 0.6;
      return { pitch, roll, throttle };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
