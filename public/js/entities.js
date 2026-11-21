import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/**
 * Shared Quaternius SWAT / Soldier (CC0) — meshopt ~470KB.
 * Root×100 (cm). Natural bind + Idle_Gun only — no bone thicken/limb pads.
 */
const SOLDIER_URL = "./models/soldier.glb";

let soldierGltf = null;
let soldierPromise = null;

export function preloadSoldiers() {
  if (soldierGltf) return Promise.resolve(soldierGltf);
  if (soldierPromise) return soldierPromise;
  soldierPromise = new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 10000);
    const loader = new GLTFLoader();
    const startLoad = () => {
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      SOLDIER_URL,
      (gltf) => {
        clearTimeout(timer);
        soldierGltf = gltf;
        done(gltf);
      },
      undefined,
      () => {
        clearTimeout(timer);
        done(null);
      }
    );
    };
    const ready = MeshoptDecoder.ready;
    if (ready && typeof ready.then === "function") ready.then(startLoad, startLoad);
    else startLoad();
  });
  return soldierPromise;
}

/** Matte CS operator kit — T brown/camo vs CT navy/grey */
const MAT = {
  mask: new THREE.MeshStandardMaterial({ color: 0x1a1c18, roughness: 0.92, metalness: 0.04, envMapIntensity: 0.18 }),
  boot: new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.88, metalness: 0.06, envMapIntensity: 0.2 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x161814, roughness: 0.9, metalness: 0.03, envMapIntensity: 0.18 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.7, metalness: 0.28, envMapIntensity: 0.25 }),
  gunDark: new THREE.MeshStandardMaterial({ color: 0x121416, roughness: 0.75, metalness: 0.22, envMapIntensity: 0.2 }),
  tSuit: new THREE.MeshStandardMaterial({ color: 0x3f3428, roughness: 0.92, metalness: 0.02, envMapIntensity: 0.18 }),
  tPants: new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.94, metalness: 0.02, envMapIntensity: 0.16 }),
  tVest: new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 0.82, metalness: 0.1, envMapIntensity: 0.24 }),
  tHelm: new THREE.MeshStandardMaterial({ color: 0x242018, roughness: 0.78, metalness: 0.14, envMapIntensity: 0.26 }),
  ctSuit: new THREE.MeshStandardMaterial({ color: 0x243040, roughness: 0.9, metalness: 0.04, envMapIntensity: 0.2 }),
  ctPants: new THREE.MeshStandardMaterial({ color: 0x1a222c, roughness: 0.93, metalness: 0.03, envMapIntensity: 0.18 }),
  ctVest: new THREE.MeshStandardMaterial({ color: 0x1c2834, roughness: 0.78, metalness: 0.14, envMapIntensity: 0.28 }),
  ctHelm: new THREE.MeshStandardMaterial({ color: 0x161e28, roughness: 0.72, metalness: 0.2, envMapIntensity: 0.3 }),
  strap: new THREE.MeshStandardMaterial({ color: 0x141612, roughness: 0.88, metalness: 0.06, envMapIntensity: 0.2 }),
  plate: new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.55, metalness: 0.35, envMapIntensity: 0.35 }),
};

function rb(w, h, d, r = 0.012) {
  return new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w * 0.15, h * 0.15, d * 0.15));
}

function limb(radius, length, material, radial = 7) {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 2, radial),
    material
  );
}

function kitMats(team) {
  const isCT = team === "ct";
  return {
    isCT,
    // Mid-range CS read: T desert tan / CT navy
    body: new THREE.MeshStandardMaterial({
      color: isCT ? 0x3a4e64 : 0xb8925c,
      roughness: 0.82,
      metalness: 0.06,
      envMapIntensity: 0.38,
    }),
    pants: new THREE.MeshStandardMaterial({
      color: isCT ? 0x2a3848 : 0x6e5840,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.3,
    }),
    vest: new THREE.MeshStandardMaterial({
      color: isCT ? 0x455868 : 0x8a6e48,
      roughness: 0.7,
      metalness: 0.14,
      envMapIntensity: 0.4,
    }),
    helm: new THREE.MeshStandardMaterial({
      color: isCT ? 0x1c2834 : 0x3a3228,
      roughness: 0.58,
      metalness: 0.24,
      envMapIntensity: 0.42,
    }),
    mask: new THREE.MeshStandardMaterial({
      color: 0x1c1e1a,
      roughness: 0.88,
      metalness: 0.03,
      envMapIntensity: 0.2,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: isCT ? 0x3a7ab8 : 0xc9a040,
      emissive: isCT ? 0x102838 : 0x3a2808,
      emissiveIntensity: 0.12,
      roughness: 0.62,
      metalness: 0.08,
      envMapIntensity: 0.28,
    }),
    strap: new THREE.MeshStandardMaterial({
      color: 0x2a2824,
      roughness: 0.88,
      metalness: 0.05,
      envMapIntensity: 0.2,
    }),
    plate: new THREE.MeshStandardMaterial({
      color: isCT ? 0x3a4652 : 0x5a5248,
      roughness: 0.48,
      metalness: 0.38,
      envMapIntensity: 0.42,
    }),
    boot: MAT.boot,
    glove: MAT.glove,
    gun: MAT.gun,
    gunDark: MAT.gunDark,
  };
}

function findBone(root, re) {
  let found = null;
  root.traverse((o) => {
    if (!found && o.isBone && re.test(o.name)) found = o;
  });
  return found;
}

/** Hide prop weapons; paint suit T tan / CT navy; head → balaclava. No mesh scale hacks. */
function dressSoldierBase(root, team) {
  const isCT = team === "ct";
  const mk = (hex, rough = 0.78, metal = 0.06) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      roughness: rough,
      metalness: metal,
      envMapIntensity: 0.45,
      emissive: hex,
      emissiveIntensity: 0.04,
    });
  const suit = mk(isCT ? 0x3a5168 : 0xa88858, 0.8, 0.05);
  const pants = mk(isCT ? 0x2a3848 : 0x6a5640, 0.86, 0.04);
  const feet = mk(0x121416, 0.88, 0.06);
  const kit = mk(isCT ? 0x1c2834 : 0x3a3228, 0.62, 0.2);
  const balaclava = mk(0x141612, 0.9, 0.03);

  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = `${o.name || ""} ${o.material?.name || ""}`.toLowerCase();
    if (/revolver|sniper|pistol|smg|grenade|cannon|shotgun|rocket|ak|shovel|knife/.test(n)) {
      o.visible = false;
      return;
    }
    const meshName = (o.name || "").toLowerCase();
    // Whole-mesh paint — never map "hand/skin" slots to black (that made spider arms)
    let mat = suit;
    if (/soldier_head/.test(meshName)) mat = balaclava;
    else if (/soldier_feet/.test(meshName)) mat = feet;
    else if (/soldier_legs/.test(meshName)) mat = pants;
    else if (/soldier_body/.test(meshName)) mat = suit;
    else {
      const label = `${o.material?.name || ""} ${meshName}`.toLowerCase();
      if (/head|face/.test(label)) mat = balaclava;
      else if (/foot|boot/.test(label)) mat = feet;
      else if (/leg|pant/.test(label)) mat = pants;
      else mat = suit;
    }
    const count = Array.isArray(o.material) ? o.material.length : 1;
    o.material = count > 1 ? Array(count).fill(mat) : mat;
    if (o.geometry?.attributes?.color) o.geometry.deleteAttribute("color");
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
  });
}

/**
 * Light helm + vest only — no limb pads/bone scale (those made spider arms).
 * Bone-local cm (Root×100 → U=0.001 ≈ 0.1m world).
 */
function attachOperatorKit(root, team) {
  const k = kitMats(team);
  const chest =
    findBone(root, /torso|chest/i) || findBone(root, /spine/i) || findBone(root, /abdomen/i);
  const head = findBone(root, /^head$/i) || findBone(root, /head/i);
  const U = 0.001;

  if (head) {
    root.traverse((o) => {
      if (o.isMesh && /soldier_head|^head$/i.test(o.name || "")) o.visible = false;
    });
    const kitG = new THREE.Group();
    const helmM = new THREE.Mesh(rb(2.4 * U, 1.1 * U, 2.6 * U, 0.18 * U), k.helm);
    helmM.position.set(0, 1.0 * U, 0.1 * U);
    const mask = new THREE.Mesh(rb(2.0 * U, 1.5 * U, 1.7 * U, 0.22 * U), k.mask);
    mask.position.set(0, 0.1 * U, 0.2 * U);
    const goggles = new THREE.Mesh(rb(1.8 * U, 0.4 * U, 0.5 * U, 0.06 * U), k.gunDark);
    goggles.position.set(0, 0.5 * U, 1.0 * U);
    kitG.add(helmM, mask, goggles);
    kitG.position.set(0, 0.35 * U, 0);
    head.add(kitG);
  }

  if (chest) {
    const vest = new THREE.Group();
    const carrier = new THREE.Mesh(rb(2.2 * U, 2.4 * U, 0.9 * U, 0.12 * U), k.vest);
    carrier.position.set(0, 0.05 * U, 0.55 * U);
    const plate = new THREE.Mesh(rb(1.5 * U, 1.7 * U, 0.28 * U, 0.06 * U), k.plate);
    plate.position.set(0, 0.1 * U, 0.95 * U);
    vest.add(carrier, plate);
    vest.position.set(0, 0.2 * U, 0);
    chest.add(vest);
  }
}

function wireSoldierAnims(root, gltf) {
  const mixer = new THREE.AnimationMixer(root);
  const byShort = {};
  for (const clip of gltf.animations || []) {
    const short = (clip.name.split("|").pop() || clip.name).toLowerCase();
    byShort[short] = clip;
  }
  // Idle_Gun = gun-ready, arms down. Prefer over Idle/bind (T-pose).
  const idleClip = byShort.idle_gun || byShort.idle_gun_pointing || byShort.idle || gltf.animations?.[0];
  const walkClip = byShort.walk || byShort.run || idleClip;
  let current = null;
  let idleAction = null;
  const play = (key) => {
    const clip = key === "walk" ? walkClip : idleClip;
    if (!clip) return;
    if (current === clip.name) return;
    mixer.stopAllAction();
    const next = mixer.clipAction(clip);
    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.clampWhenFinished = false;
    next.enabled = true;
    next.play();
    current = clip.name;
    if (clip === idleClip) idleAction = next;
  };
  play("idle");
  // Bake Idle_Gun into skeleton immediately (avoid first-frame T-pose)
  for (let i = 0; i < 4; i++) mixer.update(0.08);
  return {
    mixer,
    setAnim: (name) => play(name === "walk" || name === true ? "walk" : "idle"),
    holdIdle: () => {
      play("idle");
      mixer.update(0.05);
    },
  };
}

/**
 * Default: procedural operators (readable human bulk mid-range).
 * Character Soldier GLB is rod-thin even with Idle_Gun + no bone scale — opt-in via #gltf=1.
 */
export function createBot(team = "t") {
  let wantGltf = false;
  try {
    wantGltf = new URLSearchParams(String(location.hash || "").replace(/^#/, "")).get("gltf") === "1";
  } catch {
    /* ignore */
  }
  if (wantGltf && soldierGltf) return createSoldierBot(team, soldierGltf);
  return createProceduralBot(team);
}

function createSoldierBot(team, gltf) {
  const g = new THREE.Group();
  const model = cloneSkinned(gltf.scene);
  model.scale.setScalar(1);
  g.add(model);

  dressSoldierBase(model, team);
  attachOperatorKit(model, team);
  const anim = wireSoldierAnims(model, gltf);

  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });

  const hit = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 1.15, 4, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.05;
  hit.name = "hitbox";
  g.add(hit);

  g.userData = {
    gltf: true,
    mixer: anim.mixer,
    setAnim: anim.setAnim,
    holdIdle: anim.holdIdle,
    team,
  };
  return g;
}

function createProceduralBot(team = "t") {
  const g = new THREE.Group();
  const k = kitMats(team);
  const suit = k.body;
  const pants = k.pants;
  const vest = k.vest;
  const helmM = k.helm;

  // Extra-chunky CS scale — legs/arms read as flesh not sticks at mid range
  const legL = limb(0.16, 0.9, pants, 10);
  legL.position.set(-0.17, 0.5, 0);
  legL.name = "legL";
  const legR = limb(0.16, 0.9, pants, 10);
  legR.position.set(0.17, 0.5, 0);
  legR.name = "legR";

  const thighPadL = new THREE.Mesh(rb(0.22, 0.28, 0.18, 0.03), vest);
  thighPadL.position.set(-0.17, 0.64, 0.05);
  const thighPadR = thighPadL.clone();
  thighPadR.position.x = 0.17;

  const kneeL = new THREE.Mesh(rb(0.18, 0.14, 0.16, 0.025), k.strap);
  kneeL.position.set(-0.17, 0.4, 0.04);
  const kneeR = kneeL.clone();
  kneeR.position.x = 0.17;

  const bootL = new THREE.Mesh(rb(0.18, 0.16, 0.36, 0.03), k.boot);
  bootL.position.set(-0.17, 0.09, 0.07);
  const bootR = bootL.clone();
  bootR.position.x = 0.17;

  const hips = new THREE.Mesh(rb(0.52, 0.24, 0.3, 0.04), pants);
  hips.position.set(0, 0.96, 0);
  const belt = new THREE.Mesh(rb(0.56, 0.08, 0.32, 0.015), k.strap);
  belt.position.set(0, 1.08, 0);

  const torso = new THREE.Mesh(rb(0.54, 0.52, 0.32, 0.05), suit);
  torso.position.set(0, 1.34, 0);
  torso.name = "torso";

  const carrier = new THREE.Mesh(rb(0.58, 0.5, 0.22, 0.03), vest);
  carrier.position.set(0, 1.36, 0.12);
  const plateFront = new THREE.Mesh(rb(0.38, 0.38, 0.08, 0.015), k.plate);
  plateFront.position.set(0, 1.38, 0.22);
  const plateBack = new THREE.Mesh(rb(0.5, 0.44, 0.12, 0.025), vest);
  plateBack.position.set(0, 1.34, -0.14);
  const teamBand = new THREE.Mesh(rb(0.6, 0.08, 0.22, 0.015), k.accent);
  teamBand.position.set(0, 1.14, 0.14);
  const strapL = new THREE.Mesh(rb(0.09, 0.4, 0.06, 0.012), k.strap);
  strapL.position.set(-0.16, 1.56, 0.02);
  const strapR = strapL.clone();
  strapR.position.x = 0.16;

  const pouchRow = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const p = new THREE.Mesh(rb(0.12, 0.14, 0.1, 0.015), k.strap);
    p.position.set(i * 0.14, 1.12, 0.24);
    pouchRow.add(p);
  }
  const radio = new THREE.Mesh(rb(0.08, 0.16, 0.06, 0.012), k.gunDark);
  radio.position.set(k.isCT ? 0.24 : -0.24, 1.26, -0.02);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), k.gun);
  antenna.position.set(radio.position.x, 1.42, -0.02);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 10), k.mask);
  neck.position.set(0, 1.62, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), k.mask);
  head.position.set(0, 1.8, 0);
  head.name = "head";
  head.scale.set(0.95, 1.1, 1);

  const helm = new THREE.Mesh(rb(0.4, 0.2, 0.42, 0.05), helmM);
  helm.position.set(0, 1.94, 0.02);
  const brim = new THREE.Mesh(rb(0.34, 0.05, 0.12, 0.015), helmM);
  brim.position.set(0, 1.84, 0.18);
  const visor = new THREE.Mesh(rb(0.32, 0.07, 0.08, 0.012), k.mask);
  visor.position.set(0, 1.82, 0.17);
  const nvg = new THREE.Mesh(rb(0.14, 0.07, 0.12, 0.015), k.gunDark);
  nvg.position.set(0, 1.98, 0.14);

  if (k.isCT) {
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), k.gunDark);
    mic.rotation.z = Math.PI / 2;
    mic.position.set(0.17, 1.74, 0.03);
    g.add(mic);
  } else {
    const wrap = new THREE.Mesh(rb(0.34, 0.1, 0.26, 0.04), k.accent);
    wrap.position.set(0, 1.64, -0.02);
    g.add(wrap);
  }

  const shoulderL = new THREE.Mesh(rb(0.2, 0.14, 0.22, 0.035), vest);
  shoulderL.position.set(-0.34, 1.56, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.34;

  const armband = new THREE.Mesh(rb(0.14, 0.12, 0.08, 0.015), k.accent);
  armband.position.set(k.isCT ? 0.42 : -0.42, 1.42, 0.02);

  const armL = new THREE.Group();
  armL.name = "armL";
  armL.position.set(-0.38, 1.52, 0);
  const upperL = limb(0.13, 0.42, suit, 10);
  upperL.position.y = -0.16;
  const lowerL = limb(0.115, 0.4, suit, 10);
  lowerL.position.y = -0.48;
  const handL = new THREE.Mesh(rb(0.11, 0.12, 0.14, 0.02), k.glove);
  handL.position.y = -0.7;
  armL.add(upperL, lowerL, handL);

  const armR = new THREE.Group();
  armR.name = "armR";
  armR.position.set(0.38, 1.52, 0);
  const upperR = limb(0.13, 0.42, suit, 10);
  upperR.position.y = -0.16;
  const lowerR = limb(0.115, 0.4, suit, 10);
  lowerR.position.y = -0.48;
  const handR = new THREE.Mesh(rb(0.11, 0.12, 0.14, 0.02), k.glove);
  handR.position.y = -0.7;

  const rifle = new THREE.Group();
  rifle.position.set(0.02, -0.55, 0.2);
  rifle.rotation.set(-0.1, 0.4, 0.08);
  const recv = new THREE.Mesh(rb(0.05, 0.07, 0.4, 0.008), k.gun);
  const upperRail = new THREE.Mesh(rb(0.045, 0.035, 0.32, 0.005), k.gunDark);
  upperRail.position.set(0, 0.05, -0.02);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.4, 8), k.gunDark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.34;
  const stock = new THREE.Mesh(rb(0.045, 0.06, 0.2, 0.01), k.gun);
  stock.position.z = -0.24;
  const mag = new THREE.Mesh(rb(0.035, 0.15, 0.05, 0.008), k.gunDark);
  mag.position.set(0, -0.09, 0.02);
  const grip = new THREE.Mesh(rb(0.04, 0.11, 0.055, 0.008), k.gunDark);
  grip.position.set(0, -0.09, 0.12);
  grip.rotation.x = 0.35;
  rifle.add(recv, upperRail, barrel, stock, mag, grip);
  armR.add(upperR, lowerR, handR, rifle);
  // Gun-ready idle — arms down at sides, not T-pose splay
  armL.rotation.x = 0.12;
  armR.rotation.x = -0.35;

  g.add(
    legL, legR, thighPadL, thighPadR, kneeL, kneeR, bootL, bootR,
    hips, belt, torso, carrier, plateFront, plateBack, teamBand,
    strapL, strapR, pouchRow, radio, antenna, armband,
    shoulderL, shoulderR, neck, head, helm, brim, visor, nvg,
    armL, armR
  );

  const hit = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.35, 4, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.1;
  hit.name = "hitbox";
  g.add(hit);

  g.userData = { legL, legR, armL, armR, head, rifle, team, gltf: false };
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      o.frustumCulled = true;
    }
  });
  return g;
}

/** Classic CS C4 — olive packs, grey tape, sharp keypad/LED/antenna (no textures) */
export function createC4Mesh() {
  const g = new THREE.Group();
  const olive = new THREE.MeshStandardMaterial({
    color: 0x4a5a32,
    roughness: 0.72,
    metalness: 0.06,
    envMapIntensity: 0.4,
  });
  const oliveDark = new THREE.MeshStandardMaterial({
    color: 0x3a4828,
    roughness: 0.76,
    metalness: 0.05,
    envMapIntensity: 0.36,
  });
  const tape = new THREE.MeshStandardMaterial({
    color: 0xa8a69c,
    roughness: 0.62,
    metalness: 0.1,
    envMapIntensity: 0.34,
  });
  const plastic = new THREE.MeshStandardMaterial({
    color: 0x101210,
    roughness: 0.45,
    metalness: 0.14,
    envMapIntensity: 0.35,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x6a7078,
    roughness: 0.32,
    metalness: 0.62,
    envMapIntensity: 0.5,
  });

  // Dual charge packs — classic CS brick silhouette
  const packL = new THREE.Mesh(rb(0.28, 0.11, 0.26, 0.018), olive);
  packL.position.set(-0.12, 0.065, 0);
  const packR = new THREE.Mesh(rb(0.28, 0.11, 0.26, 0.018), oliveDark);
  packR.position.set(0.14, 0.065, 0);
  const seam = new THREE.Mesh(rb(0.04, 0.1, 0.24, 0.008), olive);
  seam.position.set(0.01, 0.065, 0);

  // Grey duct-tape wraps (horizontal + vertical)
  const strapA = new THREE.Mesh(rb(0.62, 0.035, 0.065, 0.006), tape);
  strapA.position.set(0.01, 0.118, -0.055);
  const strapB = new THREE.Mesh(rb(0.62, 0.035, 0.065, 0.006), tape);
  strapB.position.set(0.01, 0.118, 0.06);
  const strapC = new THREE.Mesh(rb(0.06, 0.035, 0.28, 0.006), tape);
  strapC.position.set(-0.16, 0.118, 0);
  const strapD = new THREE.Mesh(rb(0.06, 0.035, 0.28, 0.006), tape);
  strapD.position.set(0.18, 0.118, 0);
  const strapMid = new THREE.Mesh(rb(0.06, 0.035, 0.28, 0.006), tape);
  strapMid.position.set(0.01, 0.118, 0);

  // Detonator: black housing + LCD lip + keypad grid
  const housing = new THREE.Mesh(rb(0.16, 0.055, 0.14, 0.008), plastic);
  housing.position.set(0.12, 0.148, 0.01);
  const lcd = new THREE.Mesh(
    rb(0.1, 0.012, 0.04, 0.004),
    new THREE.MeshStandardMaterial({
      color: 0x0a1810,
      emissive: 0x143020,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.1,
      toneMapped: false,
    })
  );
  lcd.position.set(0.12, 0.178, -0.03);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xff1a00,
    emissive: 0xff2200,
    emissiveIntensity: 1.6,
    roughness: 0.3,
    metalness: 0.08,
    toneMapped: false,
  });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), ledMat);
  led.position.set(0.175, 0.178, 0.05);
  const keys = new THREE.Group();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const key = new THREE.Mesh(rb(0.024, 0.01, 0.024, 0.003), metal);
      key.position.set(0.07 + c * 0.03, 0.175, -0.005 + r * 0.03);
      keys.add(key);
    }
  }

  // Antenna + base + wire
  const antBase = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.028, 10), metal);
  antBase.position.set(-0.18, 0.14, -0.08);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.007, 0.26, 8), metal);
  ant.position.set(-0.18, 0.28, -0.08);
  ant.rotation.z = 0.1;
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), plastic);
  antTip.position.set(-0.2, 0.4, -0.08);
  const wire = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.004, 6, 14, Math.PI), plastic);
  wire.rotation.y = Math.PI / 2;
  wire.position.set(-0.04, 0.135, -0.08);

  const light = new THREE.PointLight(0xff3300, 0.45, 3.2, 2);
  light.position.set(0.175, 0.2, 0.06);

  g.add(
    packL, packR, seam, strapA, strapB, strapC, strapD, strapMid,
    housing, lcd, led, keys, antBase, ant, antTip, wire, light
  );
  g.userData.light = light;
  g.userData.led = led;
  g.userData.ledMat = ledMat;
  g.rotation.set(0.05, 0.22, -0.02);
  return g;
}

export function updateBotPose(bot, dt, { moving, aiming, shootKick = 0 }) {
  const u = bot.userData;
  if (u.gltf && u.mixer) {
    // Prefer Idle_Gun whenever not clearly walking — avoids T-pose splay
    u.setAnim?.(moving ? "walk" : "idle");
    u.mixer.update(Math.min(0.05, dt));
    return;
  }
  const { legL, legR, armL, armR, head } = u;
  if (!legL) return;
  const t = performance.now() * 0.001;
  if (moving) {
    const swing = Math.sin(t * 9.5) * 0.4;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.55;
    armR.rotation.x = swing * 0.3 - (aiming ? 0.55 : 0.2);
  } else {
    legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 0.15);
    legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 0.15);
    armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, aiming ? -0.45 : 0.08, 0.12);
    armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, aiming ? -0.6 : -0.22, 0.12);
  }
  armR.rotation.x -= shootKick;
  if (head) head.rotation.x = aiming ? -0.1 : 0;
}

function vmMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.28,
    roughness: opts.roughness ?? 0.62,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    envMapIntensity: opts.envMapIntensity ?? 0.32,
  });
}

/**
 * Right-handed FPS viewmodel shaped by weapon style.
 */
export function createViewmodel(weapon) {
  const root = new THREE.Group();
  root.name = "viewmodel";
  const st = weapon?.style || {};
  const len = st.length ?? 1;
  const bodyColor = st.color ?? 0x3a4048;

  const dark = vmMat(bodyColor, { metalness: 0.32, roughness: 0.62, emissive: 0x060708, emissiveIntensity: 0.03 });
  const mid = vmMat(0x3e464e, { metalness: 0.38, roughness: 0.58 });
  const accent = vmMat(0x4a525a, { metalness: 0.4, roughness: 0.55 });
  const polymer = vmMat(0x1a1e24, { metalness: 0.06, roughness: 0.82 });
  const wood = vmMat(0x3e2e20, { metalness: 0.02, roughness: 0.85 });
  const glove = vmMat(0x161814, { metalness: 0.04, roughness: 0.88, envMapIntensity: 0.2 });
  const opticGlass = vmMat(0x081210, {
    metalness: 0.06,
    roughness: 0.5,
    emissive: st.sniper ? 0x0a1410 : 0x0c1210,
    emissiveIntensity: st.sniper ? 0.12 : 0.06,
    envMapIntensity: 0.28,
  });

  const gun = new THREE.Group();
  gun.name = "gun";
  gun.position.set(0.26, -0.2, -0.48);

  const rb = (w, h, d, r = 0.004) => new RoundedBoxGeometry(w, h, d, 1, r);
  const thick = st.thick ? 1.2 : st.compact ? 0.88 : 1;
  const recvL = 0.34 * (st.compact ? 0.85 : st.sniper ? 1.12 : 1);
  const receiver = new THREE.Mesh(rb(0.065 * thick, 0.09 * thick, recvL, 0.006), dark);
  const upper = new THREE.Mesh(rb(0.058 * thick, 0.042, recvL * 0.92, 0.004), st.wood ? wood : mid);
  upper.position.set(0, 0.058, -0.015);
  const dustCover = new THREE.Mesh(rb(0.05 * thick, 0.02, recvL * 0.55, 0.003), accent);
  dustCover.position.set(0, 0.085, -0.04);

  const hgLen = 0.2 + 0.2 * len;
  const handguard = new THREE.Mesh(
    rb(0.055 * thick, 0.07 * thick, hgLen, 0.006),
    st.shotgun ? wood : polymer
  );
  handguard.position.set(0, 0.01, -0.16 - hgLen * 0.4);

  const barrelLen = 0.26 + 0.24 * len;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(st.shotgun ? 0.026 : 0.012, st.shotgun ? 0.03 : 0.014, barrelLen, 10),
    accent
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.26 - hgLen * 0.45 - barrelLen * 0.22);

  const muzzleZ = barrel.position.z - barrelLen * 0.42;
  let tip;
  if (st.suppressor) {
    tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.13, 10), polymer);
  } else if (st.shotgun) {
    tip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 0.05, 10), mid);
  } else {
    tip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 0.055, 10), mid);
  }
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.03, muzzleZ);

  const mag = new THREE.Mesh(rb(0.04, st.compact ? 0.13 : 0.19, 0.06, 0.004), polymer);
  mag.position.set(0, -0.13, 0.015);
  mag.name = "mag";

  const grip = new THREE.Mesh(rb(0.045, 0.13, 0.06, 0.006), polymer);
  grip.position.set(0, -0.11, 0.13);
  grip.rotation.x = 0.42;

  const parts = [receiver, upper, dustCover, handguard, barrel, tip, mag, grip];

  if (st.stock !== false) {
    const stock = new THREE.Mesh(rb(0.05, 0.08, st.sniper ? 0.3 : 0.2, 0.008), st.wood ? wood : polymer);
    stock.position.set(0, -0.01, 0.26 + (st.sniper ? 0.05 : 0));
    const butt = new THREE.Mesh(rb(0.055, 0.1, 0.04, 0.006), polymer);
    butt.position.set(0, -0.01, stock.position.z + (st.sniper ? 0.15 : 0.1));
    parts.push(stock, butt);
  }

  if (st.optic || st.sniper) {
    const rail = new THREE.Mesh(rb(0.035, 0.015, 0.18, 0.002), accent);
    rail.position.set(0, 0.095, -0.06);
    const sight = new THREE.Mesh(
      rb(st.sniper ? 0.06 : 0.045, st.sniper ? 0.06 : 0.04, st.sniper ? 0.2 : 0.1, 0.004),
      opticGlass
    );
    sight.position.set(0, st.sniper ? 0.15 : 0.125, st.sniper ? -0.04 : -0.015);
    parts.push(rail, sight);
  }

  const charge = new THREE.Mesh(rb(0.025, 0.025, 0.06, 0.003), accent);
  charge.position.set(0.035, 0.065, 0.05);
  charge.name = "charge";
  parts.push(charge);

  // Gloved support hand — matches world operators
  const hand = new THREE.Group();
  hand.position.set(0.015, -0.09, 0.1);
  const palm = new THREE.Mesh(rb(0.07, 0.045, 0.09, 0.012), glove);
  const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.045, 2, 5), glove);
  finger.rotation.x = 1.05;
  finger.position.set(0.015, -0.015, 0.04);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.03, 2, 5), glove);
  thumb.rotation.set(0.4, 0, 1.1);
  thumb.position.set(-0.03, 0.0, 0.02);
  hand.add(palm, finger, thumb);
  parts.push(hand);

  const flash = new THREE.PointLight(0xffcc66, 0, 4.5, 2);
  flash.position.set(0, 0.03, muzzleZ - 0.08);
  parts.push(flash);

  const key = new THREE.DirectionalLight(0xffffff, 0.48);
  key.position.set(-0.3, 0.7, 0.5);
  const fill = new THREE.DirectionalLight(0xa8c4e0, 0.18);
  fill.position.set(0.5, 0.15, 0.35);

  gun.add(...parts);
  root.add(gun, key, fill);

  // Normal depth — walls occlude; near-wall hide is the anti-clip (not depthTest:false)
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.renderOrder = 10;
    o.castShadow = false;
    o.receiveShadow = false;
  });
  // Approx camera→muzzle length used by wall clearance (local -Z ahead)
  root.userData.muzzleLen = Math.abs(muzzleZ) + 0.52;

  root.userData = {
    ...root.userData,
    flash,
    gun,
    mag,
    charge,
    magHome: mag.position.clone(),
    chargeHome: charge.position.clone(),
    // Spring-damper kick (CS-like snappy settle)
    kick: {
      px: 0,
      py: 0,
      pz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      wrx: 0,
      wry: 0,
      wrz: 0,
    },
    shake: 0,
    slide: 0, // charging-handle / bolt slap
    bobPhase: 0,
    reloadT: 0,
    reloadDur: 0,
    ads: 0,
    wallPull: 0,
  };
  return root;
}

function springAxis(pos, vel, target, stiffness, damping, dt) {
  const force = (target - pos) * stiffness - vel * damping;
  vel += force * dt;
  pos += vel * dt;
  return [pos, vel];
}

export function updateViewmodel(vm, dt, { moving, sprinting, aiming, reloading, reloadDur, grounded, firing, wallPull = 0 }) {
  const u = vm.userData;
  const gun = u.gun;
  const mag = u.mag;
  const charge = u.charge;
  const k = u.kick;

  u.ads = THREE.MathUtils.lerp(u.ads, aiming ? 1 : 0, 1 - Math.pow(0.0008, dt));
  // Soft wall pull — ease both ways; never blank the viewmodel
  u.wallPull = THREE.MathUtils.lerp(u.wallPull, wallPull, 1 - Math.pow(0.012, dt));
  u.shake = Math.max(0, u.shake - dt * 6.5);
  u.slide = THREE.MathUtils.lerp(u.slide, 0, 1 - Math.pow(0.00005, dt));

  // Soft spring return — stiff enough to snap, damped enough to not buzz forever
  const stiff = 180;
  const damp = 18;
  [k.px, k.vx] = springAxis(k.px, k.vx, 0, stiff, damp, dt);
  [k.py, k.vy] = springAxis(k.py, k.vy, 0, stiff * 1.1, damp, dt);
  [k.pz, k.vz] = springAxis(k.pz, k.vz, 0, stiff * 0.95, damp * 1.05, dt);
  [k.rx, k.wrx] = springAxis(k.rx, k.wrx, 0, 140, 14, dt);
  [k.ry, k.wry] = springAxis(k.ry, k.wry, 0, 120, 13, dt);
  [k.rz, k.wrz] = springAxis(k.rz, k.wrz, 0, 130, 14, dt);

  if (moving && grounded) {
    u.bobPhase += dt * (sprinting ? 14 : 9);
  } else {
    u.bobPhase *= 0.9;
  }
  const bobAmp = 1 - u.ads * 0.8;
  const bobX = Math.sin(u.bobPhase) * 0.009 * bobAmp;
  const bobY = Math.abs(Math.sin(u.bobPhase * 2)) * 0.007 * bobAmp;
  // Idle micro-sway
  const t = performance.now() * 0.001;
  const swayX = Math.sin(t * 1.3) * 0.003 * (1 - u.ads * 0.7);
  const swayY = Math.cos(t * 1.1) * 0.002 * (1 - u.ads * 0.7);

  // High-freq fire shake (decays via u.shake)
  const sh = u.shake;
  const shakeX = (Math.sin(t * 90) + Math.sin(t * 140) * 0.5) * 0.004 * sh;
  const shakeY = (Math.cos(t * 110) + Math.sin(t * 160) * 0.4) * 0.005 * sh;
  const shakeRot = Math.sin(t * 100) * 0.03 * sh;

  const pull = u.wallPull;
  gun.visible = true;
  // Soft pull-back — gun stays mostly on-screen (no scale→0 / hide)
  const baseX = THREE.MathUtils.lerp(0.26, 0.02, u.ads) + pull * 0.12;
  const baseY = THREE.MathUtils.lerp(-0.2, -0.14, u.ads) - pull * 0.08;
  const baseZ = THREE.MathUtils.lerp(-0.48, -0.38, u.ads) + pull * 0.7;
  gun.scale.setScalar(THREE.MathUtils.lerp(1, 0.72, pull));

  let extraY = 0;
  let extraX = 0;
  let rotX = THREE.MathUtils.lerp(0.02, -0.02, u.ads) + pull * 0.22;
  let rotY = THREE.MathUtils.lerp(0.04, 0, u.ads) + pull * 0.7;
  let rotZ = pull * -0.12;

  if (reloading && reloadDur > 0) {
    const p = 1 - reloading / reloadDur;
    if (p < 0.2) {
      const q = p / 0.2;
      rotX += q * 0.5;
      extraY -= q * 0.07;
    } else if (p < 0.45) {
      rotX += 0.5;
      extraY -= 0.07;
      const q = (p - 0.2) / 0.25;
      mag.position.set(u.magHome.x, u.magHome.y - q * 0.32, u.magHome.z + q * 0.04);
      mag.rotation.x = q * 0.7;
    } else if (p < 0.55) {
      rotX += 0.45;
      mag.position.set(u.magHome.x, u.magHome.y - 0.4, u.magHome.z);
      mag.visible = p > 0.52;
      if (p > 0.52) mag.position.y = u.magHome.y - 0.32;
    } else if (p < 0.75) {
      rotX += 0.4;
      const q = (p - 0.55) / 0.2;
      mag.visible = true;
      mag.position.set(u.magHome.x, u.magHome.y - 0.32 * (1 - q), u.magHome.z);
      mag.rotation.x = (1 - q) * 0.55;
    } else if (p < 0.9) {
      const q = (p - 0.75) / 0.15;
      mag.position.copy(u.magHome);
      mag.rotation.x = 0;
      charge.position.z = u.chargeHome.z - q * 0.07;
      rotX += 0.12;
      extraX += 0.015;
    } else {
      const q = (p - 0.9) / 0.1;
      charge.position.copy(u.chargeHome);
      mag.position.copy(u.magHome);
      mag.rotation.x = 0;
      rotX += 0.12 * (1 - q);
    }
  } else {
    mag.visible = true;
    mag.position.copy(u.magHome);
    mag.rotation.x = 0;
    // Bolt slap on fire
    charge.position.z = u.chargeHome.z - u.slide * 0.06;
  }

  gun.position.set(
    baseX + bobX + swayX + shakeX + extraX + k.px,
    baseY + bobY + swayY + shakeY + extraY + k.py,
    baseZ + k.pz
  );
  gun.rotation.set(rotX + k.rx + shakeRot * 0.6, rotY + k.ry, rotZ + bobX * 1.6 + k.rz + shakeRot);
}

/** Impulse punch — stronger = harder kick. yawBias tips left/right like spray. */
export function punchViewmodel(vm, amount = 1, yawBias = 0) {
  const u = vm.userData;
  const k = u.kick;
  const a = Math.min(1.6, amount);
  // Velocity impulses (spring integrates → snappy kick then settle)
  k.vz += 0.55 * a;
  k.vy += 0.22 * a;
  k.vx += yawBias * 0.35;
  k.wrx += 2.8 * a;
  k.wry += yawBias * 3.2;
  k.wrz += (Math.random() - 0.5) * 1.2 * a;
  u.shake = Math.min(1.4, u.shake + 0.55 * a);
  u.slide = 1;
}
