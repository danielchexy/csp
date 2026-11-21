/** Global caps + quality presets for CSP */

export const CAPS = {
  MAX_ROOMS: 10,
  MAX_PLAYERS: 20,
};

export const QUALITY = {
  low: {
    label: "Low",
    pixelRatio: 1,
    shadows: false,
    fogNear: 40,
    fogFar: 110,
    drawDistance: 120,
    particles: false,
    enemyCount: 6,
  },
  med: {
    label: "Medium",
    pixelRatio: Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio : 1),
    shadows: true,
    fogNear: 55,
    fogFar: 150,
    drawDistance: 170,
    particles: true,
    enemyCount: 8,
  },
  high: {
    label: "High",
    pixelRatio: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1),
    shadows: true,
    fogNear: 70,
    fogFar: 190,
    drawDistance: 230,
    particles: true,
    enemyCount: 10,
  },
};

export const GAME = {
  mapSeed: 7741,
  playerSpeed: 6.8,
  sprintMul: 1.4,
  mouseSens: 0.0022,
  touchSens: 0.0034,
  maxHp: 100,
  magSize: 30,
  reserveAmmo: 90,
  fireCooldown: 0.095,
  reloadTime: 2.35,
  gravity: 22,
  jumpSpeed: 7.5,
  /** Walk the map freely — bots idle, no round end / damage */
  explore: true,
};

/** CS-style bomb round timings (seconds) */
export const BOMB = {
  plantTime: 3.2,
  defuseTime: 7,
  fuseTime: 40,
  roundTime: 9999,
  allyBots: 2,
  enemyBots: 3,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem("csp-settings") || localStorage.getItem("csp-relay-settings");
    const defaults = { quality: "high", sens: 1, invertY: false, lookV: 6 };
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    // Always reset Invert Y on this fix — it was flipping a already-correct axis
    if (parsed.lookV !== 6) {
      parsed.invertY = false;
      parsed.lookV = 6;
      localStorage.setItem("csp-settings", JSON.stringify({ ...defaults, ...parsed }));
    }
    return { ...defaults, ...parsed, invertY: false };
  } catch {
    return { quality: "med", sens: 1, invertY: false, lookV: 6 };
  }
}

export function saveSettings(settings) {
  localStorage.setItem("csp-settings", JSON.stringify(settings));
}

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[(Math.random() * alphabet.length) | 0];
  return code;
}
