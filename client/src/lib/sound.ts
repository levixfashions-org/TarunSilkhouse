/**
 * Optional ambience + UI sounds, synthesised with WebAudio (no audio files to download).
 * Off by default; the toggle lives in the header. A soft tanpura-like drone (Sa–Pa–Sa) plus a pluck for UI.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let drone: { stop: () => void } | null = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, master: master! };
}

export function startAmbience() {
  const { ctx, master } = ensure();
  if (drone) return;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(master);
  const base = 130.81; // C3 as Sa
  const notes = [base * 1.5, base * 2, base * 2, base];
  const oscs: OscillatorNode[] = [];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'sawtooth' : 'triangle';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 4;
    const g = ctx.createGain();
    g.gain.value = 0;
    // each string swells in turn, like a tanpura cycle
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = ctx.createGain();
    lg.gain.value = 0.025;
    lfo.connect(lg).connect(g.gain);
    lfo.start(ctx.currentTime + i * 1.9);
    o.connect(g).connect(lp);
    o.start();
    oscs.push(o, lfo);
  });
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0.35, ctx.currentTime, 1.2);
  drone = {
    stop: () => {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      setTimeout(() => oscs.forEach((o) => o.stop()), 1500);
    },
  };
}

export function stopAmbience() {
  drone?.stop();
  drone = null;
}

let uiEnabled = false;
export const setUiSounds = (on: boolean) => {
  uiEnabled = on;
};

/** A short sitar-ish pluck. */
export function pluck(freq = 660) {
  if (!uiEnabled) return;
  const { ctx } = ensure();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * 0.98, ctx.currentTime + 0.4);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.65);
}

export function buzz(ms = 18) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
