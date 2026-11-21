import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Kenney CC0 blocky humans (not sci-fi Soldier.glb) — proper body scale */
const KENNEY_BASE =
  "https://cdn.jsdelivr.net/gh/shorepine/kenney@main/3d/blocky-characters/";
const KENNEY_T = "character-a.glb";
const KENNEY_CT = "character-m.glb";

let kenneyT = null;
let kenneyCT = null;
let soldierPromise = null;

export function preloadSoldiers() {
  if (kenneyT && kenneyCT) return Promise.resolve(kenneyT);
  if (soldierPromise) return soldierPromise;
  soldierPromise = new Promise((resolve) => {
    let left = 2;
    let settled = false;
    const done = () => {
      if (settled) return;
      if (--left > 0) return;
      settled = true;
      resolve(kenneyT || kenneyCT);
    };
    const timer = setTimeout(() => {
      settled = true;
      resolve(kenneyT || kenneyCT);
    }, 9000);
    const loadOne = (file, assign) => {
      const loader = new GLTFLoader();
      loader.setResourcePath(KENNEY_BASE);
      loader.load(
        KENNEY_BASE + file,
        (gltf) => {
          assign(gltf);
          clearTimeout(timer);
          done();
        },
        undefined,
        () => {
          clearTimeout(timer);
          done();
        }
      );
    };
    loadOne(KENNEY_T, (g) => {
      kenneyT = g;
    });
    loadOne(KENNEY_CT, (g) => {
      kenneyCT = g;
    });
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
    // Mid-range CS read: T desert tan / CT navy — solid, not black stickmen
    body: new THREE.MeshStandardMaterial({
      color: isCT ? 0x3d5168 : 0xa88860,
      roughness: 0.86,
      metalness: 0.04,
      envMapIntensity: 0.3,
    }),
    pants: new THREE.MeshStandardMaterial({
      color: isCT ? 0x2c3a4a : 0x6a5640,
      roughness: 0.9,
      metalness: 0.02,
      envMapIntensity: 0.24,
    }),
    vest: new THREE.MeshStandardMaterial({
      color: isCT ? 0x4a5c70 : 0x8a7048,
      roughness: 0.72,
      metalness: 0.12,
      envMapIntensity: 0.36,
    }),
    helm: new THREE.MeshStandardMaterial({
      color: isCT ? 0x1a2430 : 0x3a3228,
      roughness: 0.6,
      metalness: 0.22,
      envMapIntensity: 0.38,
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

function findNamed(root, name) {
  let found = null;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  return found;
}

/**
 * Paint Kenney human + tactical kit.
 * Kenney layout: root → legs + torso; arms/head are children of torso.
 * Torso mesh local Y∈[0.3,1.2] Z∈[-0.3,0.3]; head node scale 0.1.
 */
function dressKenneyOperator(root, team) {
  const k = kitMats(team);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = (o.name || "").toLowerCase();
    let mat = k.body;
    if (/leg/.test(n)) mat = k.pants;
    else if (/head/.test(n)) mat = k.mask;
    else if (/arm/.test(n)) mat = k.body;
    else if (/torso/.test(n)) mat = k.body;
    o.material = mat;
    o.castShadow = true;
    o.receiveShadow = true;
  });

  const torso = findNamed(root, "torso") || root;
  const head = findNamed(root, "head");
  const armR = findNamed(root, "arm-right");
  const armL = findNamed(root, "arm-left");
  const legL = findNamed(root, "leg-left");
  const legR = findNamed(root, "leg-right");
  const attach = findNamed(root, "root") || root;

  // Thicken limb silhouettes (Kenney boxes → operator bulk)
  if (legL) legL.scale.set(1.55, 1, 1.55);
  if (legR) legR.scale.set(1.55, 1, 1.55);
  if (armL) armL.scale.set(1.4, 1.05, 1.4);
  if (armR) armR.scale.set(1.4, 1.05, 1.4);
  if (torso) torso.scale.x = 1.12;
  // Shrink stock head into neck under helm (keep mass, lose cube silhouette)
  if (head) head.scale.set(0.06, 0.05, 0.06);

  // lookAt faces -Z at camera → chest kit on -Z, pack on +Z
  const vest = new THREE.Group();
  vest.add(new THREE.Mesh(rb(0.78, 0.62, 0.22, 0.03), k.vest));
  const plate = new THREE.Mesh(rb(0.52, 0.48, 0.1, 0.02), k.plate);
  plate.position.set(0, 0.02, -0.14);
  vest.add(plate);
  const band = new THREE.Mesh(rb(0.8, 0.11, 0.2, 0.015), k.accent);
  band.position.set(0, -0.26, -0.02);
  vest.add(band);
  for (let i = -1; i <= 1; i++) {
    const p = new THREE.Mesh(rb(0.15, 0.17, 0.13, 0.015), k.strap);
    p.position.set(i * 0.17, -0.28, -0.16);
    vest.add(p);
  }
  vest.position.set(0, 0.75, -0.44);
  torso.add(vest);

  const pack = new THREE.Mesh(rb(0.58, 0.48, 0.2, 0.025), k.vest);
  pack.position.set(0, 0.75, 0.48);
  torso.add(pack);

  // Helmet ABOVE head volume (head local top ≈ y 2.0)
  const helmG = new THREE.Group();
  const helm = new THREE.Mesh(rb(0.56, 0.28, 0.58, 0.05), k.helm);
  const brim = new THREE.Mesh(rb(0.48, 0.07, 0.16, 0.015), k.helm);
  brim.position.set(0, -0.12, -0.26);
  const visor = new THREE.Mesh(rb(0.46, 0.11, 0.12, 0.015), k.mask);
  visor.position.set(0, -0.16, -0.26);
  const nvg = new THREE.Mesh(rb(0.2, 0.1, 0.16, 0.015), k.gunDark);
  nvg.position.set(0, 0.1, -0.18);
  const maskShell = new THREE.Mesh(rb(0.48, 0.4, 0.44, 0.04), k.mask);
  maskShell.position.set(0, -0.36, -0.06);
  helmG.add(helm, brim, visor, nvg, maskShell);
  if (k.isCT) {
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.18, 6), k.gunDark);
    mic.rotation.z = Math.PI / 2;
    mic.position.set(0.28, -0.2, -0.05);
    helmG.add(mic);
  } else {
    const wrap = new THREE.Mesh(rb(0.58, 0.16, 0.4, 0.04), k.accent);
    wrap.position.set(0, -0.32, 0.05);
    helmG.add(wrap);
  }
  helmG.position.set(0, 2.28, -0.05);
  torso.add(helmG);

  // Boots at foot of each leg
  for (const leg of [legL, legR]) {
    if (!leg) continue;
    const boot = new THREE.Mesh(rb(0.28, 0.16, 0.4, 0.03), k.boot);
    boot.position.set(0, -0.95, 0.08);
    leg.add(boot);
  }

  if (armR) {
    const rifle = new THREE.Group();
    rifle.position.set(-0.05, -0.55, 0.35);
    rifle.rotation.set(-0.2, 0.5, 0.15);
    const recv = new THREE.Mesh(rb(0.07, 0.09, 0.48, 0.008), k.gun);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.42, 8), k.gunDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.4;
    const stock = new THREE.Mesh(rb(0.055, 0.08, 0.22, 0.01), k.gun);
    stock.position.z = -0.28;
    const mag = new THREE.Mesh(rb(0.045, 0.18, 0.055, 0.008), k.gunDark);
    mag.position.set(0, -0.11, 0.02);
    rifle.add(recv, barrel, stock, mag);
    armR.add(rifle);
  }

  if (armL) {
    const band2 = new THREE.Mesh(rb(0.16, 0.14, 0.1, 0.015), k.accent);
    band2.position.set(0.15, -0.25, 0.05);
    armL.add(band2);
  }

  // Shoulder pads on torso
  for (const side of [-1, 1]) {
    const pad = new THREE.Mesh(rb(0.22, 0.14, 0.28, 0.03), k.vest);
    pad.position.set(side * 0.48, 1.05, 0.05);
    torso.add(pad);
  }

  return { torso, head, armL, armR, helmG, attach };
}

function wireKenneyAnims(root, gltf) {
  const mixer = new THREE.AnimationMixer(root);
  const byName = {};
  for (const clip of gltf.animations || []) byName[clip.name] = clip;
  let current = null;
  const play = (name) => {
    const clip = byName[name] || byName.idle || gltf.animations?.[0];
    if (!clip || current === name) return;
    const next = mixer.clipAction(clip);
    next.reset().fadeIn(0.15).play();
    if (current) {
      const prev = mixer.clipAction(byName[current] || clip);
      prev.fadeOut(0.15);
    }
    current = name;
  };
  play("idle");
  return {
    mixer,
    setAnim: (name) => play(name === "walk" || name === true ? "walk" : "idle"),
  };
}

/** Kenney human operator (T tan / CT navy). Falls back to chunky procedural. */
export function createBot(team = "t") {
  const src = team === "ct" ? kenneyCT || kenneyT : kenneyT || kenneyCT;
  if (src) return createKenneyBot(team, src);
  return createProceduralBot(team);
}

function createKenneyBot(team, gltf) {
  const g = new THREE.Group();
  const model = gltf.scene.clone(true);
  // Kenney blocky humans are ~2 units tall; lookAt in spawn faces -Z at camera
  model.scale.setScalar(0.95);
  g.add(model);

  const parts = dressKenneyOperator(model, team);
  const anim = wireKenneyAnims(model, gltf);

  const hit = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 1.4, 4, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.1;
  hit.name = "hitbox";
  g.add(hit);

  g.userData = {
    gltf: true,
    mixer: anim.mixer,
    setAnim: anim.setAnim,
    legL: findNamed(model, "leg-left"),
    legR: findNamed(model, "leg-right"),
    armL: parts.armL,
    armR: parts.armR,
    head: parts.head,
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

  g.userData = { legL, legR, armL, armR, head, rifle, team };
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = true;
    }
  });
  return g;
}

/** Classic CS C4 — olive drab brick, grey duct tape, black keypad, red LED, antenna */
export function createC4Mesh() {
  const g = new THREE.Group();
  const olive = new THREE.MeshStandardMaterial({
    color: 0x3a452c,
    roughness: 0.84,
    metalness: 0.05,
    envMapIntensity: 0.22,
  });
  // Grey duct tape — not yellow
  const tape = new THREE.MeshStandardMaterial({
    color: 0x8a8880,
    roughness: 0.72,
    metalness: 0.08,
    envMapIntensity: 0.2,
  });
  const plastic = new THREE.MeshStandardMaterial({
    color: 0x141612,
    roughness: 0.5,
    metalness: 0.12,
    envMapIntensity: 0.28,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x5a6068,
    roughness: 0.38,
    metalness: 0.55,
    envMapIntensity: 0.4,
  });

  // Dual charge packs (CS silhouette)
  const body = new THREE.Mesh(rb(0.42, 0.13, 0.28, 0.015), olive);
  body.position.set(-0.02, 0.07, 0);
  const body2 = new THREE.Mesh(rb(0.2, 0.12, 0.26, 0.015), olive);
  body2.position.set(0.18, 0.068, 0);
  // Grey duct-tape wraps
  const strapA = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.07), tape);
  strapA.position.set(0.04, 0.125, -0.05);
  const strapB = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.07), tape);
  strapB.position.set(0.04, 0.125, 0.07);
  const strapC = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.3), tape);
  strapC.position.set(-0.14, 0.125, 0);
  const strapD = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.3), tape);
  strapD.position.set(0.12, 0.125, 0);
  // Black keypad / detonator panel
  const pad = new THREE.Mesh(rb(0.14, 0.045, 0.12, 0.006), plastic);
  pad.position.set(0.14, 0.15, 0.01);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xff2200,
    emissive: 0xff2200,
    emissiveIntensity: 1.4,
    roughness: 0.35,
    metalness: 0.1,
    toneMapped: false,
  });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.02), ledMat);
  led.position.set(0.18, 0.175, 0.045);
  const keys = new THREE.Group();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const key = new THREE.Mesh(rb(0.022, 0.008, 0.022, 0.003), metal);
      key.position.set(0.09 + c * 0.028, 0.172, -0.025 + r * 0.028);
      keys.add(key);
    }
  }
  const antBase = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.03, 8), metal);
  antBase.position.set(-0.14, 0.145, -0.08);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.22, 6), metal);
  ant.position.set(-0.14, 0.26, -0.08);
  ant.rotation.z = 0.12;
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.1, 5), plastic);
  wire.rotation.z = Math.PI / 2;
  wire.position.set(-0.02, 0.14, -0.08);

  const light = new THREE.PointLight(0xff3300, 0.35, 2.8, 2);
  light.position.set(0.18, 0.2, 0.05);

  g.add(body, body2, strapA, strapB, strapC, strapD, pad, led, keys, antBase, ant, wire, light);
  g.userData.light = light;
  g.userData.led = led;
  g.userData.ledMat = ledMat;
  g.rotation.set(0.06, 0.25, -0.03);
  return g;
}

export function updateBotPose(bot, dt, { moving, aiming, shootKick = 0 }) {
  const u = bot.userData;
  if (u.gltf && u.mixer) {
    u.setAnim?.(moving ? "walk" : "idle");
    u.mixer.update(dt);
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
