import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

/** Shared CDN soldier (~2MB once) — three.js example Soldier.glb */
const SOLDIER_URL = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb";

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
    // Don't hang start() if CDN stalls (plant/nav still need __csp)
    const timer = setTimeout(() => done(null), 8000);
    new GLTFLoader().load(
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

function tintSoldier(root, team) {
  // Multiply existing albedo — keep Soldier.glb texture detail readable
  const mul = new THREE.Color(team === "ct" ? 0x7a92b0 : 0xc4a574);
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const src = Array.isArray(o.material) ? o.material : [o.material];
    const next = src.map((m) => {
      const mat = m.clone();
      if (mat.color) mat.color.multiply(mul);
      mat.roughness = Math.min(0.92, Math.max(0.55, mat.roughness ?? 0.75));
      mat.metalness = Math.min(0.25, mat.metalness ?? 0.08);
      mat.envMapIntensity = 0.4;
      mat.needsUpdate = true;
      return mat;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
}

/** CDN GLTF soldier with T/CT tint; procedural fallback if load failed */
export function createBot(team = "t") {
  if (soldierGltf?.scene) {
    const g = new THREE.Group();
    const model = cloneSkinned(soldierGltf.scene);
    model.scale.setScalar(1.0);
    model.rotation.y = Math.PI; // face camera-forward convention
    tintSoldier(model, team);
    g.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const clips = soldierGltf.animations || [];
    const find = (name) => clips.find((c) => c.name.toLowerCase().includes(name));
    const idleClip = find("idle") || clips[0];
    const walkClip = find("walk") || find("run") || clips[1] || clips[0];
    const actions = {
      idle: idleClip ? mixer.clipAction(idleClip) : null,
      walk: walkClip ? mixer.clipAction(walkClip) : null,
    };
    if (actions.idle) {
      actions.idle.enabled = true;
      actions.idle.setEffectiveWeight(1);
      actions.idle.play();
      mixer.update(1 / 30); // leave bind/T-pose immediately
    }
    let current = "idle";

    const hit = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 1.25, 4, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 1.05;
    hit.name = "hitbox";
    g.add(hit);

    g.userData = {
      team,
      gltf: true,
      mixer,
      actions,
      current,
      setAnim(name) {
        if (name === g.userData.current) return;
        const next = actions[name];
        const prev = actions[g.userData.current];
        if (next) {
          next.reset().fadeIn(0.15).play();
          prev?.fadeOut(0.15);
          g.userData.current = name;
        }
      },
    };
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = true;
      }
    });
    return g;
  }
  return createProceduralBot(team);
}

/** Procedural fallback — gear silhouette if CDN soldier unavailable */
function createProceduralBot(team = "t") {
  const g = new THREE.Group();
  const isCT = team === "ct";
  const suit = isCT ? MAT.ctSuit : MAT.tSuit;
  const pants = isCT ? MAT.ctPants : MAT.tPants;
  const vest = isCT ? MAT.ctVest : MAT.tVest;
  const helmM = isCT ? MAT.ctHelm : MAT.tHelm;

  // Longer legs, tighter hips — less toy proportion
  const legL = limb(0.07, 0.86, pants, 7);
  legL.position.set(-0.1, 0.48, 0);
  legL.name = "legL";
  const legR = limb(0.07, 0.86, pants, 7);
  legR.position.set(0.1, 0.48, 0);
  legR.name = "legR";

  const kneeL = new THREE.Mesh(rb(0.09, 0.1, 0.1, 0.02), MAT.strap);
  kneeL.position.set(-0.1, 0.42, 0.02);
  const kneeR = kneeL.clone();
  kneeR.position.x = 0.1;

  const bootL = new THREE.Mesh(rb(0.1, 0.13, 0.28, 0.02), MAT.boot);
  bootL.position.set(-0.1, 0.07, 0.05);
  const bootR = bootL.clone();
  bootR.position.x = 0.1;

  const hips = new THREE.Mesh(rb(0.32, 0.16, 0.18, 0.025), pants);
  hips.position.set(0, 0.92, 0);
  const belt = new THREE.Mesh(rb(0.34, 0.05, 0.2, 0.01), MAT.strap);
  belt.position.set(0, 1.0, 0);

  const torso = new THREE.Mesh(rb(0.34, 0.4, 0.2, 0.03), suit);
  torso.position.set(0, 1.26, 0);
  torso.name = "torso";

  // Plate carrier + pouches (CS silhouette)
  const carrier = new THREE.Mesh(rb(0.33, 0.36, 0.12, 0.015), vest);
  carrier.position.set(0, 1.28, 0.11);
  const plateFront = new THREE.Mesh(rb(0.22, 0.26, 0.04, 0.008), MAT.plate);
  plateFront.position.set(0, 1.3, 0.17);
  const plateBack = new THREE.Mesh(rb(0.3, 0.32, 0.08, 0.015), vest);
  plateBack.position.set(0, 1.26, -0.11);
  const strapL = new THREE.Mesh(rb(0.05, 0.3, 0.035, 0.008), MAT.strap);
  strapL.position.set(-0.11, 1.48, 0.02);
  const strapR = strapL.clone();
  strapR.position.x = 0.11;

  const pouchRow = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const p = new THREE.Mesh(rb(0.07, 0.09, 0.05, 0.01), MAT.strap);
    p.position.set(i * 0.085, 1.08, 0.18);
    pouchRow.add(p);
  }
  const radio = new THREE.Mesh(rb(0.06, 0.12, 0.04, 0.01), MAT.gunDark);
  radio.position.set(isCT ? 0.16 : -0.16, 1.2, -0.02);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), MAT.gun);
  antenna.position.set(radio.position.x, 1.34, -0.02);

  // Head: balaclava + helm (T) or ops-core + headset (CT)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.09, 8), MAT.mask);
  neck.position.set(0, 1.5, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), MAT.mask);
  head.position.set(0, 1.66, 0);
  head.name = "head";
  head.scale.set(0.92, 1.08, 0.98);

  const helm = new THREE.Mesh(rb(0.24, 0.12, 0.27, 0.035), helmM);
  helm.position.set(0, 1.76, 0.01);
  const brim = new THREE.Mesh(rb(0.2, 0.03, 0.08, 0.01), helmM);
  brim.position.set(0, 1.7, 0.12);
  const visor = new THREE.Mesh(
    rb(0.2, 0.04, 0.06, 0.01),
    new THREE.MeshStandardMaterial({
      color: isCT ? 0x0e1418 : 0x12100e,
      roughness: 0.62,
      metalness: 0.08,
      envMapIntensity: 0.18,
    })
  );
  visor.position.set(0, 1.68, 0.11);

  if (isCT) {
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), MAT.gunDark);
    mic.rotation.z = Math.PI / 2;
    mic.position.set(0.14, 1.66, 0.02);
    g.add(mic);
  }

  const shoulderL = new THREE.Mesh(rb(0.11, 0.07, 0.13, 0.025), vest);
  shoulderL.position.set(-0.22, 1.46, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.22;

  const armL = new THREE.Group();
  armL.name = "armL";
  armL.position.set(-0.26, 1.42, 0);
  const upperL = limb(0.05, 0.36, suit, 7);
  upperL.position.y = -0.13;
  const lowerL = limb(0.045, 0.34, suit, 7);
  lowerL.position.y = -0.42;
  const handL = new THREE.Mesh(rb(0.065, 0.075, 0.095, 0.015), MAT.glove);
  handL.position.y = -0.6;
  armL.add(upperL, lowerL, handL);

  const armR = new THREE.Group();
  armR.name = "armR";
  armR.position.set(0.26, 1.42, 0);
  const upperR = limb(0.05, 0.36, suit, 7);
  upperR.position.y = -0.13;
  const lowerR = limb(0.045, 0.34, suit, 7);
  lowerR.position.y = -0.42;
  const handR = new THREE.Mesh(rb(0.065, 0.075, 0.095, 0.015), MAT.glove);
  handR.position.y = -0.6;

  const rifle = new THREE.Group();
  rifle.position.set(0.02, -0.5, 0.18);
  rifle.rotation.set(-0.12, 0.45, 0.1);
  const recv = new THREE.Mesh(rb(0.045, 0.065, 0.36, 0.006), MAT.gun);
  const upperRail = new THREE.Mesh(rb(0.04, 0.03, 0.3, 0.004), MAT.gunDark);
  upperRail.position.set(0, 0.045, -0.02);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.38, 8), MAT.gunDark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.32;
  const stock = new THREE.Mesh(rb(0.04, 0.055, 0.18, 0.008), MAT.gun);
  stock.position.z = -0.22;
  const mag = new THREE.Mesh(rb(0.032, 0.14, 0.045, 0.006), MAT.gunDark);
  mag.position.set(0, -0.08, 0.02);
  const grip = new THREE.Mesh(rb(0.035, 0.1, 0.05, 0.006), MAT.gunDark);
  grip.position.set(0, -0.08, 0.12);
  grip.rotation.x = 0.35;
  rifle.add(recv, upperRail, barrel, stock, mag, grip);
  armR.add(upperR, lowerR, handR, rifle);

  g.add(
    legL, legR, kneeL, kneeR, bootL, bootR,
    hips, belt, torso, carrier, plateFront, plateBack,
    strapL, strapR, pouchRow, radio, antenna,
    shoulderL, shoulderR, neck, head, helm, brim, visor,
    armL, armR
  );

  const hit = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 1.25, 4, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.05;
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
