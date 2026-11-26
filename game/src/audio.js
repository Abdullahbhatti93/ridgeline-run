// Ridgeline Run — every sound is synthesised with WebAudio: no audio files,
// nothing fetched. Engine hum, wind, a ring chime, a crash thud and a
// landing fanfare. Silent until the player first interacts (browser rule).
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      engineOsc.connect(lp);
      engineOsc2.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a band-pass filter.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      src.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      src.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    /** Call from the first user gesture; also resumes a suspended context. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    /** Continuous engine + wind, driven by throttle and speed each frame. */
    update(throttle, speed, flying) {
      if (!ctx || muted || !flying) {
        if (engineGain) engineGain.gain.value = 0;
        if (windGain) windGain.gain.value = 0;
        return;
      }
      const base = 52 + throttle * 66;
      engineOsc.frequency.value = base;
      engineOsc2.frequency.value = base * 0.5 + 3;
      engineGain.gain.value = 0.05 + throttle * 0.075;
      windFilter.frequency.value = 500 + speed * 9;
      windGain.gain.value = Math.min(0.09, speed * 0.0009);
    },
    ring() {
      tone(880, 0.18, 'sine', 0.22);
      tone(1318, 0.28, 'sine', 0.18, 0.09);
    },
    crash() {
      if (!ctx || muted) return;
      tone(70, 0.5, 'sine', 0.5);
      tone(45, 0.7, 'triangle', 0.4, 0.05);
    },
    land() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, i * 0.12));
    },
    click() {
      tone(660, 0.07, 'square', 0.08);
    },
    toggleMute() {
      muted = !muted;
      if (ctx && muted) {
        if (engineGain) engineGain.gain.value = 0;
        if (windGain) windGain.gain.value = 0;
      }
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
