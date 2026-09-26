import { EFFECTS_KEY } from "./constants";

let ctx: AudioContext | null = null;

export function effectsOn(): boolean {
  try {
    return localStorage.getItem(EFFECTS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setEffectsOn(on: boolean) {
  try {
    localStorage.setItem(EFFECTS_KEY, on ? "on" : "off");
  } catch {
    // ignore
  }
}

export function unlockCues() {
  const Ctx = window.AudioContext;
  if (!Ctx) return;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx || !effectsOn()) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

export function playTick() {
  tone(880, 0, 0.07, "square", 0.07);
}

export function playPlus() {
  tone(523, 0, 0.1, "square", 0.09);
  tone(784, 0.09, 0.16, "square", 0.1);
}

export function playMiss() {
  tone(160, 0, 0.18, "sawtooth", 0.05);
}

export function playLevel() {
  tone(523, 0, 0.1, "square", 0.09);
  tone(659, 0.11, 0.1, "square", 0.09);
  tone(880, 0.22, 0.2, "square", 0.11);
}

export function playRank() {
  tone(698, 0, 0.08, "square", 0.07);
  tone(988, 0.08, 0.14, "square", 0.08);
}

export function buzz(pattern: number | number[]) {
  if (!effectsOn() || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
}
