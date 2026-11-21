/** Tiny procedural SFX via Web Audio — no sound files */

let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function beep({ freq = 440, dur = 0.08, type = "square", gain = 0.04, slide = 0 }) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

export const SFX = {
  unlock() {
    ac();
  },
  shoot() {
    beep({ freq: 180, dur: 0.07, type: "sawtooth", gain: 0.05, slide: -120 });
    beep({ freq: 90, dur: 0.09, type: "square", gain: 0.03, slide: -40 });
  },
  reload() {
    // mag out → mag in → charge
    beep({ freq: 200, dur: 0.06, type: "triangle", gain: 0.03 });
    setTimeout(() => beep({ freq: 140, dur: 0.07, type: "square", gain: 0.025, slide: -40 }), 450);
    setTimeout(() => beep({ freq: 260, dur: 0.05, type: "triangle", gain: 0.03 }), 1100);
    setTimeout(() => beep({ freq: 320, dur: 0.04, type: "square", gain: 0.028 }), 1700);
    setTimeout(() => beep({ freq: 180, dur: 0.06, type: "triangle", gain: 0.03 }), 2100);
  },
  hit() {
    beep({ freq: 520, dur: 0.04, type: "square", gain: 0.025, slide: 80 });
  },
  hurt() {
    beep({ freq: 110, dur: 0.16, type: "sawtooth", gain: 0.05, slide: -70 });
  },
  relay() {
    beep({ freq: 440, dur: 0.12, type: "sine", gain: 0.04 });
    setTimeout(() => beep({ freq: 660, dur: 0.18, type: "sine", gain: 0.035 }), 90);
  },
  win() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => beep({ freq: f, dur: 0.2, type: "sine", gain: 0.04 }), i * 120));
  },
  click() {
    beep({ freq: 380, dur: 0.03, type: "square", gain: 0.02 });
  },
};
