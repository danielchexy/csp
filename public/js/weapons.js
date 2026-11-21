/** Gun catalog + loadout persistence (shop). */

/** @typedef {{ id: string, name: string, slot: string, price: number, desc: string, mag: number, reserve: number, fireCooldown: number, reload: number, damage: number, hsMul: number, adsMul: number, pattern: number[][], baseSpread: number, moveSpread: number, spraySpread: number, jumpSpread: number, automatic: boolean, style: object }} WeaponDef */

/** Shared short SMG/rifle patterns scaled later */
function riflePattern(scale = 1) {
  const base = [
    [0.018, 0],
    [0.022, 0.004],
    [0.026, -0.006],
    [0.03, 0.01],
    [0.032, -0.014],
    [0.034, 0.016],
    [0.036, -0.02],
    [0.038, 0.018],
    [0.04, -0.022],
    [0.04, 0.024],
    [0.038, -0.026],
    [0.036, 0.02],
    [0.034, -0.018],
    [0.032, 0.022],
    [0.03, -0.02],
    [0.028, 0.016],
    [0.026, -0.014],
    [0.024, 0.012],
    [0.022, -0.01],
    [0.02, 0.01],
    [0.018, -0.008],
    [0.016, 0.008],
    [0.015, -0.006],
    [0.014, 0.006],
    [0.013, -0.005],
    [0.012, 0.005],
    [0.011, -0.004],
    [0.01, 0.004],
    [0.01, -0.003],
    [0.009, 0.003],
  ];
  return base.map(([p, y]) => [p * scale, y * scale]);
}

function pistolPattern(scale = 1) {
  return [
    [0.012, 0],
    [0.016, 0.006],
    [0.02, -0.008],
    [0.022, 0.01],
    [0.024, -0.012],
    [0.02, 0.008],
    [0.018, -0.006],
    [0.016, 0.005],
  ].map(([p, y]) => [p * scale, y * scale]);
}

/** @type {WeaponDef[]} */
export const WEAPONS = [
  {
    id: "glock",
    name: "Glock-18",
    slot: "pistol",
    price: 0,
    desc: "Starter pistol · fast · light kick",
    mag: 20,
    reserve: 120,
    fireCooldown: 0.12,
    reload: 1.9,
    damage: 18,
    hsMul: 2.2,
    adsMul: 0.7,
    pattern: pistolPattern(0.85),
    baseSpread: 0.01,
    moveSpread: 0.014,
    spraySpread: 0.0025,
    jumpSpread: 0.04,
    automatic: true,
    style: { length: 0.72, color: 0x3a4048, optic: false, stock: false },
  },
  {
    id: "usp",
    name: "USP-S",
    slot: "pistol",
    price: 200,
    desc: "Accurate CT sidearm · silenced",
    mag: 12,
    reserve: 24,
    fireCooldown: 0.17,
    reload: 2.1,
    damage: 24,
    hsMul: 2.5,
    adsMul: 0.55,
    pattern: pistolPattern(0.7),
    baseSpread: 0.006,
    moveSpread: 0.012,
    spraySpread: 0.002,
    jumpSpread: 0.035,
    automatic: false,
    style: { length: 0.78, color: 0x2a3038, optic: false, stock: false, suppressor: true },
  },
  {
    id: "deagle",
    name: "Desert Eagle",
    slot: "pistol",
    price: 700,
    desc: "Heavy pistol · hard punch",
    mag: 7,
    reserve: 35,
    fireCooldown: 0.28,
    reload: 2.2,
    damage: 48,
    hsMul: 2.8,
    adsMul: 0.6,
    pattern: pistolPattern(1.55),
    baseSpread: 0.014,
    moveSpread: 0.022,
    spraySpread: 0.004,
    jumpSpread: 0.05,
    automatic: false,
    style: { length: 0.7, color: 0x5a5040, optic: false, stock: false, thick: true },
  },
  {
    id: "mp9",
    name: "MP9",
    slot: "smg",
    price: 1250,
    desc: "SMG · laser spray · run-and-gun",
    mag: 30,
    reserve: 120,
    fireCooldown: 0.07,
    reload: 2.0,
    damage: 16,
    hsMul: 2.0,
    adsMul: 0.65,
    pattern: riflePattern(0.55),
    baseSpread: 0.01,
    moveSpread: 0.01,
    spraySpread: 0.0015,
    jumpSpread: 0.03,
    automatic: true,
    style: { length: 0.7, color: 0x4a5560, optic: true, stock: true, compact: true },
  },
  {
    id: "mac10",
    name: "MAC-10",
    slot: "smg",
    price: 1050,
    desc: "T SMG · wild spray · cheap",
    mag: 30,
    reserve: 100,
    fireCooldown: 0.065,
    reload: 2.15,
    damage: 17,
    hsMul: 2.0,
    adsMul: 0.7,
    pattern: riflePattern(0.75),
    baseSpread: 0.014,
    moveSpread: 0.012,
    spraySpread: 0.0022,
    jumpSpread: 0.032,
    automatic: true,
    style: { length: 0.62, color: 0x3a3a3a, optic: false, stock: false, compact: true },
  },
  {
    id: "ak47",
    name: "AK-47",
    slot: "rifle",
    price: 2700,
    desc: "T rifle · hard climb · one-tap HS",
    mag: 30,
    reserve: 90,
    fireCooldown: 0.1,
    reload: 2.4,
    damage: 28,
    hsMul: 3.2,
    adsMul: 0.55,
    pattern: riflePattern(1.15),
    baseSpread: 0.007,
    moveSpread: 0.02,
    spraySpread: 0.002,
    jumpSpread: 0.04,
    automatic: true,
    style: { length: 1.0, color: 0x4a4030, wood: true, optic: false, stock: true },
  },
  {
    id: "m4a4",
    name: "M4A4",
    slot: "rifle",
    price: 3100,
    desc: "CT rifle · controllable spray",
    mag: 30,
    reserve: 90,
    fireCooldown: 0.09,
    reload: 2.35,
    damage: 24,
    hsMul: 2.9,
    adsMul: 0.5,
    pattern: riflePattern(0.9),
    baseSpread: 0.006,
    moveSpread: 0.018,
    spraySpread: 0.0016,
    jumpSpread: 0.035,
    automatic: true,
    style: { length: 0.95, color: 0x3a444c, optic: true, stock: true },
  },
  {
    id: "galil",
    name: "Galil AR",
    slot: "rifle",
    price: 1800,
    desc: "Budget rifle · solid mid",
    mag: 35,
    reserve: 90,
    fireCooldown: 0.095,
    reload: 2.5,
    damage: 22,
    hsMul: 2.7,
    adsMul: 0.58,
    pattern: riflePattern(1.0),
    baseSpread: 0.008,
    moveSpread: 0.019,
    spraySpread: 0.0019,
    jumpSpread: 0.038,
    automatic: true,
    style: { length: 0.92, color: 0x3a4a3a, optic: false, stock: true },
  },
  {
    id: "awp",
    name: "AWP",
    slot: "sniper",
    price: 4750,
    desc: "Bolt sniper · one shot · slow",
    mag: 10,
    reserve: 30,
    fireCooldown: 1.45,
    reload: 3.5,
    damage: 110,
    hsMul: 1.0,
    adsMul: 0.25,
    pattern: [[0.055, 0], [0.04, 0.01], [0.035, -0.008]],
    baseSpread: 0.002,
    moveSpread: 0.05,
    spraySpread: 0.01,
    jumpSpread: 0.08,
    automatic: false,
    style: { length: 1.25, color: 0x2a3830, optic: true, stock: true, sniper: true },
  },
  {
    id: "nova",
    name: "Nova",
    slot: "shotgun",
    price: 1050,
    desc: "Pump shotgun · close range",
    mag: 8,
    reserve: 32,
    fireCooldown: 0.85,
    reload: 0.55, // per-shell feel handled as full reload for now
    damage: 22, // per pellet abstracted as burst damage
    hsMul: 1.4,
    adsMul: 0.75,
    pattern: [[0.04, 0], [0.035, 0.012], [0.03, -0.01]],
    baseSpread: 0.045,
    moveSpread: 0.02,
    spraySpread: 0.005,
    jumpSpread: 0.06,
    automatic: false,
    style: { length: 0.85, color: 0x5a4838, optic: false, stock: true, shotgun: true },
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

const STORE_KEY = "csp-loadout";
const STORE_KEY_LEGACY = "csp-relay-loadout";

export function defaultLoadout() {
  return {
    coins: 50000, // enough to buy the whole shop many times
    owned: ["glock"],
    equipped: "glock",
  };
}

export function loadLoadout() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(STORE_KEY_LEGACY);
    const d = defaultLoadout();
    if (!raw) return { ...d };
    const parsed = JSON.parse(raw);
    const owned = Array.isArray(parsed.owned) ? parsed.owned.filter((id) => WEAPON_BY_ID[id]) : d.owned;
    if (!owned.includes("glock")) owned.unshift("glock");
    let equipped = parsed.equipped;
    if (!owned.includes(equipped)) equipped = owned[0];
    return {
      coins: Math.max(0, Number(parsed.coins) ?? d.coins),
      owned,
      equipped,
    };
  } catch {
    return defaultLoadout();
  }
}

export function saveLoadout(loadout) {
  localStorage.setItem(STORE_KEY, JSON.stringify(loadout));
}

export function buyWeapon(loadout, weaponId) {
  const w = WEAPON_BY_ID[weaponId];
  if (!w) return { ok: false, reason: "Unknown gun" };
  if (loadout.owned.includes(weaponId)) return { ok: false, reason: "Already owned" };
  if (loadout.coins < w.price) return { ok: false, reason: "Not enough coins" };
  loadout.coins -= w.price;
  loadout.owned.push(weaponId);
  loadout.equipped = weaponId;
  saveLoadout(loadout);
  return { ok: true };
}

export function equipWeapon(loadout, weaponId) {
  if (!loadout.owned.includes(weaponId)) return { ok: false, reason: "Not owned" };
  loadout.equipped = weaponId;
  saveLoadout(loadout);
  return { ok: true };
}

export function getEquippedWeapon(loadout) {
  return WEAPON_BY_ID[loadout.equipped] || WEAPON_BY_ID.glock;
}
