import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createAsphaltMaterial, createSkyMaterial, syncFogUniforms } from "./materials.js";
import {
  makeContainerTexture,
  makeContainerNormal,
  makePlasterTexture,
  makeFloorTexture,
  makeWoodTexture,
  makeMetalTexture,
} from "./textures.js";

const containerNormal = makeContainerNormal();
const plaster = makePlasterTexture();
const plasterInner = {
  map: plaster.map.clone(),
  normalMap: plaster.normalMap.clone(),
};
plasterInner.map.repeat.set(1.6, 1.6);
plasterInner.normalMap.repeat.set(1.6, 1.6);
const floorTex = makeFloorTexture();
const wood = makeWoodTexture();
const metalMap = makeMetalTexture();

/** Matte / lightly worn surfaces — glare reserved for metal accents only */
const SHARED = {
  wall: new THREE.MeshStandardMaterial({
    color: 0xf0ebe3,
    map: plaster.map,
    normalMap: plaster.normalMap,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.35,
  }),
  wallInner: new THREE.MeshStandardMaterial({
    color: 0xe8e2d8,
    map: plasterInner.map,
    normalMap: plasterInner.normalMap,
    normalScale: new THREE.Vector2(0.18, 0.18),
    roughness: 0.9,
    metalness: 0.02,
    envMapIntensity: 0.3,
  }),
  wallDark: new THREE.MeshStandardMaterial({
    color: 0x9a958c,
    map: plaster.map,
    normalMap: plaster.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.94,
    metalness: 0.04,
    envMapIntensity: 0.28,
  }),
  trim: new THREE.MeshStandardMaterial({
    color: 0x8a929a,
    map: metalMap,
    roughness: 0.72,
    metalness: 0.28,
    envMapIntensity: 0.35,
  }),
  pipe: new THREE.MeshStandardMaterial({
    color: 0x6a7278,
    roughness: 0.78,
    metalness: 0.22,
    envMapIntensity: 0.3,
  }),
  caution: new THREE.MeshStandardMaterial({
    color: 0xc9a22a,
    roughness: 0.88,
    metalness: 0.05,
    envMapIntensity: 0.2,
  }),
  floorIn: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTex.map,
    normalMap: floorTex.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.78,
    metalness: 0.06,
    envMapIntensity: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }),
  floorA: new THREE.MeshStandardMaterial({
    color: 0xe8d4c4,
    map: floorTex.map,
    normalMap: floorTex.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.8,
    metalness: 0.05,
    envMapIntensity: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }),
  floorB: new THREE.MeshStandardMaterial({
    color: 0xc8d4e0,
    map: floorTex.map,
    normalMap: floorTex.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.8,
    metalness: 0.05,
    envMapIntensity: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }),
  ceiling: new THREE.MeshStandardMaterial({
    color: 0xf2eee6,
    map: plaster.map,
    roughness: 0.95,
    metalness: 0.0,
    emissive: 0xfff6e8,
    emissiveIntensity: 0.04,
    envMapIntensity: 0.2,
  }),
  cover: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: wood.map,
    normalMap: wood.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.82,
    metalness: 0.02,
    envMapIntensity: 0.3,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x9eb8cc,
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    envMapIntensity: 0.6,
  }),
  doorFrame: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: wood.map,
    normalMap: wood.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 0.32,
    // Push jambs off wall plane — stops motion z-fight on door edges
    polygonOffset: true,
    polygonOffsetFactor: 4,
    polygonOffsetUnits: 4,
  }),
  sandbag: new THREE.MeshStandardMaterial({
    color: 0x8a7a58,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.2,
  }),
  barrel: new THREE.MeshStandardMaterial({
    color: 0x3a5a38,
    roughness: 0.55,
    metalness: 0.35,
    envMapIntensity: 0.55,
  }),
  concrete: new THREE.MeshStandardMaterial({
    color: 0xc8c2b8,
    map: plaster.map,
    roughness: 0.93,
    metalness: 0.02,
    envMapIntensity: 0.25,
  }),
};

function roundedBox(w, h, d, radius = 0.06, segments = 2) {
  const r = Math.min(radius, w * 0.2, h * 0.2, d * 0.2);
  return new RoundedBoxGeometry(w, h, d, segments, r);
}

function makeContainerMesh(w, h, d, color, quality) {
  const g = new THREE.Group();
  const map = makeContainerTexture(color);
  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap: containerNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    metalness: 0.35,
    roughness: 0.55,
    envMapIntensity: 0.55,
  });
  const body = new THREE.Mesh(roundedBox(w, h, d, 0.06, 2), mat);
  body.castShadow = quality.shadows;
  body.receiveShadow = true;
  g.add(body);
  return g;
}

/**
 * Compact bomb map — Dust2 / Mirage language (procedural, CDN-only).
 *
 *        [CT spawn]
 *     /      |      \
 *  [B] —— mid doors —— [A]  (Dust A van/boxes · Mirage arches mid)
 * banana/tunnels      long/cat
 *     \      mid      /
 *        [T spawn]
 */
export function createWorld(scene, quality) {
  const colliders = [];
  const shaderMats = [];
  const navNodes = []; // door mids + room hubs → bot waypoint graph
  const group = new THREE.Group();
  scene.add(group);

  const fogColor = new THREE.Color(0xb0c4d8);
  scene.fog = new THREE.Fog(fogColor, quality.fogNear + 20, quality.fogFar + 35);
  scene.background = new THREE.Color(0x87b0e0);

  const skyMat = createSkyMaterial();
  shaderMats.push(skyMat);
  // Inverted high-seg sphere + FrontSide = solid dome (no BackSide holes / faceting)
  const skyGeo = new THREE.SphereGeometry(160, 48, 32);
  skyGeo.scale(-1, 1, 1);
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -1000;
  group.add(skyMesh);
  // Horizon skirt — seals ground/sky join so no floating geo / gap ring
  const horizon = new THREE.Mesh(
    new THREE.CylinderGeometry(150, 150, 28, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xc8d6e8,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
  );
  horizon.position.y = 6;
  horizon.frustumCulled = false;
  horizon.renderOrder = -999;
  group.add(horizon);

  const ambient = new THREE.AmbientLight(0xfff4e8, 0.62);
  const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x8a7a60, 0.55);
  const sun = new THREE.DirectionalLight(0xfff5e6, 1.55);
  sun.position.set(35, 65, 20);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.set(quality.label === "High" ? 2048 : 1024, quality.label === "High" ? 2048 : 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 140;
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55 });
    sun.shadow.bias = -0.00008;
    sun.shadow.normalBias = 0.05;
  }
  const fill = new THREE.DirectionalLight(0xa8c8f0, 0.35);
  fill.position.set(-25, 20, -15);
  scene.add(ambient, hemi, sun, fill);

  const asphalt = createAsphaltMaterial();
  asphalt.uniforms.uRain.value = 0.06;
  asphalt.uniforms.uLightDir.value.set(0.4, 0.85, 0.25).normalize();
  syncFogUniforms(asphalt, fogColor, quality.fogNear + 20, quality.fogFar + 35);
  shaderMats.push(asphalt);
  // Single outdoor ground — no stacked transparent plane (that caused motion z-flicker)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 120), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  function addCollider(x, z, w, h, d, y = h / 2) {
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
    });
  }

  function box(x, y, z, w, h, d, mat, collide = true, round = true) {
    const geo = round
      ? roundedBox(w, h, d, Math.min(0.05, w * 0.12, h * 0.06, d * 0.12), quality.label === "Low" ? 1 : 2)
      : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = quality.shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) addCollider(x, z, w, h, d, y);
    return mesh;
  }

  function wall(x, z, w, d, h = 4.2, mat = SHARED.wall) {
    return box(x, h / 2, z, w, h, d, mat, true, true);
  }

  function floorPad(x, z, w, d, mat = SHARED.floorIn) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.08, z);
    // No receiveShadow — soft map blobs shimmered while strafing
    group.add(m);
  }

  function ceiling(x, z, w, d) {
    // Slight oversize seals wall/ceiling join (no sky hollow at corners)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.35, d + 0.35), SHARED.ceiling);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 4.18, z);
    group.add(m);
    if (quality.label !== "Low") {
      const lamp = new THREE.PointLight(0xfff2e0, 0.7, Math.max(w, d) * 1.15, 1.8);
      lamp.position.set(x, 3.55, z);
      group.add(lamp);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshStandardMaterial({
          color: 0xfff0d0,
          emissive: 0xffe0a8,
          emissiveIntensity: 0.9,
          toneMapped: false,
        })
      );
      bulb.position.set(x, 4.0, z);
      group.add(bulb);
    }
  }

  /** Interior-face jambs only — header wall is placed by wallWithGaps; frames never collide */
  function doorFrame(alongX, cx, cz, wallPos, lo, hi, h, t, inward, _mat) {
    const gap = hi - lo;
    const mid = (lo + hi) / 2;
    const jw = 0.16;
    const depth = 0.11;
    const doorH = Math.min(h - 0.6, 3.3);
    const face = wallPos + inward * (t * 0.5 + depth * 0.5 + 0.02);
    if (alongX) {
      box(cx + lo - jw / 2, doorH / 2, face, jw, doorH - 0.06, depth, SHARED.doorFrame, false, false);
      box(cx + hi + jw / 2, doorH / 2, face, jw, doorH - 0.06, depth, SHARED.doorFrame, false, false);
      box(cx + mid, doorH - 0.1, face, gap + jw, 0.2, depth, SHARED.doorFrame, false, false);
      box(cx + mid, doorH - 0.28, face + inward * 0.04, gap * 0.92, 0.06, depth * 0.55, SHARED.trim, false, false);
    } else {
      box(face, doorH / 2, cz + lo - jw / 2, depth, doorH - 0.06, jw, SHARED.doorFrame, false, false);
      box(face, doorH / 2, cz + hi + jw / 2, depth, doorH - 0.06, jw, SHARED.doorFrame, false, false);
      box(face, doorH - 0.1, cz + mid, depth, 0.2, gap + jw, SHARED.doorFrame, false, false);
      box(face + inward * 0.04, doorH - 0.28, cz + mid, depth * 0.55, 0.06, gap * 0.92, SHARED.trim, false, false);
    }
  }

  /** openings: [{side:'n'|'s'|'e'|'w', width, offset}] — multiple per side OK */
  function room(cx, cz, rw, rd, openings = [], h = 4.2) {
    floorPad(cx, cz, rw - 0.2, rd - 0.2);
    ceiling(cx, cz, rw - 0.2, rd - 0.2);
    const t = 0.4;

    function wallWithGaps(alongX, pos, fullLen, gaps, mat, inward) {
      const half = fullLen / 2;
      const intervals = (gaps || [])
        .filter((g) => g.width > 0)
        .map((g) => ({ lo: g.offset - g.width / 2, hi: g.offset + g.width / 2 }))
        .sort((a, b) => a.lo - b.lo);
      const merged = [];
      for (const g of intervals) {
        if (!merged.length || g.lo > merged[merged.length - 1].hi + 0.05) {
          merged.push({ lo: g.lo, hi: g.hi });
        } else {
          merged[merged.length - 1].hi = Math.max(merged[merged.length - 1].hi, g.hi);
        }
      }
      let cursor = -half;
      const edgePad = 0.04;
      const doorH = Math.min(h - 0.6, 3.3);
      const placeSeg = (a, b, height = h, yCenter = null) => {
        const len = b - a;
        if (len < 0.12) return;
        const mid = (a + b) / 2;
        const y = yCenter ?? height / 2;
        if (alongX) box(cx + mid, y, pos, len, height, t, mat, true, true);
        else box(pos, y, cz + mid, t, height, len, mat, true, true);
      };
      for (const g of merged) {
        const lo = Math.max(g.lo, -half);
        const hi = Math.min(g.hi, half);
        placeSeg(cursor, lo - edgePad);
        if (hi - lo > 0.4) {
          // Header wall above opening — continuous with ceiling (no sky/black hollow)
          const hh = h - doorH;
          placeSeg(lo, hi, hh, doorH + hh / 2);
          doorFrame(alongX, cx, cz, pos, lo, hi, h, t, inward, mat);
          if (alongX) navNodes.push({ x: cx + (lo + hi) / 2, z: pos + inward * 0.55 });
          else navNodes.push({ x: pos + inward * 0.55, z: cz + (lo + hi) / 2 });
        }
        cursor = hi + edgePad;
      }
      placeSeg(cursor, half);
    }

    const bySide = { n: [], s: [], e: [], w: [] };
    for (const o of openings) bySide[o.side]?.push(o);

    wallWithGaps(true, cz + rd / 2, rw, bySide.n, SHARED.wallInner, -1);
    wallWithGaps(true, cz - rd / 2, rw, bySide.s, SHARED.wallInner, 1);
    wallWithGaps(false, cx + rw / 2, rd, bySide.e, SHARED.wall, -1);
    wallWithGaps(false, cx - rw / 2, rd, bySide.w, SHARED.wall, 1);
  }

  function cover(x, z, w = 1.8, h = 1.2, d = 0.9) {
    box(x, h / 2, z, w, h, d, SHARED.cover);
  }

  /** Dust2-style van / truck body */
  function van(x, z, yaw = 0, color = 0xb8a078) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(roundedBox(2.4, 1.35, 5.2, 0.08, 2), new THREE.MeshStandardMaterial({
      color, roughness: 0.72, metalness: 0.18, envMapIntensity: 0.4,
    }));
    body.position.y = 1.05;
    const cab = new THREE.Mesh(roundedBox(2.35, 1.0, 1.6, 0.06, 2), new THREE.MeshStandardMaterial({
      color: 0x9a8a70, roughness: 0.7, metalness: 0.2, envMapIntensity: 0.38,
    }));
    cab.position.set(0, 1.55, -1.9);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 0.08), SHARED.glass);
    glass.position.set(0, 1.7, -2.65);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.05 });
    for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.6], [0.95, -1.6]]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10), wheelMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(wx, 0.38, wz);
      g.add(wh);
    }
    g.add(body, cab, glass);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = quality.shadows;
        o.receiveShadow = true;
      }
    });
    group.add(g);
    addCollider(x, z, 2.5, 1.8, 5.4, 0.9);
  }

  /** Mirage-style stone arch (decorative, non-colliding span) */
  function arch(x, z, alongX = true, span = 4.2, h = 3.4) {
    const postW = 0.45;
    const thick = 0.55;
    if (alongX) {
      box(x - span / 2, h / 2, z, postW, h, thick, SHARED.concrete, true, false);
      box(x + span / 2, h / 2, z, postW, h, thick, SHARED.concrete, true, false);
      box(x, h - 0.2, z, span + postW, 0.4, thick + 0.05, SHARED.concrete, false, false);
      box(x, h - 0.55, z, span * 0.55, 0.35, thick * 0.7, SHARED.concrete, false, true);
    } else {
      box(x, h / 2, z - span / 2, thick, h, postW, SHARED.concrete, true, false);
      box(x, h / 2, z + span / 2, thick, h, postW, SHARED.concrete, true, false);
      box(x, h - 0.2, z, thick + 0.05, 0.4, span + postW, SHARED.concrete, false, false);
      box(x, h - 0.55, z, thick * 0.7, 0.35, span * 0.55, SHARED.concrete, false, true);
    }
  }

  /** Stack of CS-style cardboard / wood boxes */
  function boxStack(x, z, n = 3) {
    for (let i = 0; i < n; i++) {
      const s = 0.85 - i * 0.05;
      box(x + (i % 2) * 0.1, 0.4 + i * 0.72, z + (i % 2) * -0.08, s, 0.7, s * 1.1, SHARED.cover, true, true);
    }
  }

  function crate(x, z, w, h, d, color) {
    const c = makeContainerMesh(w, h, d, color, quality);
    c.position.set(x, h / 2, z);
    group.add(c);
    addCollider(x, z, w, h, d, h / 2);
  }

  function barrel(x, z, color = 0x3a5a38) {
    const mat = SHARED.barrel.clone();
    mat.color.setHex(color);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 1.05, 12), mat);
    m.position.set(x, 0.52, z);
    m.castShadow = quality.shadows;
    m.receiveShadow = true;
    group.add(m);
    addCollider(x, z, 0.78, 1.05, 0.78, 0.52);
  }

  function sandbags(x, z, len = 2.4, alongX = true) {
    const n = Math.max(2, Math.round(len / 0.7));
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * 0.68;
      const px = alongX ? x + o : x;
      const pz = alongX ? z : z + o;
      box(px, 0.28, pz, alongX ? 0.65 : 0.4, 0.55, alongX ? 0.4 : 0.65, SHARED.sandbag, true, true);
      if (i % 2 === 0) {
        box(px, 0.72, pz, alongX ? 0.55 : 0.35, 0.4, alongX ? 0.35 : 0.55, SHARED.sandbag, true, true);
      }
    }
  }

  function lowWall(x, z, w, d, h = 1.35) {
    box(x, h / 2, z, w, h, d, SHARED.concrete);
  }

  function windowPane(x, z, w, h, alongX = true) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), SHARED.glass);
    if (alongX) m.position.set(x, 2.15, z);
    else {
      m.rotation.y = Math.PI / 2;
      m.position.set(x, 2.15, z);
    }
    group.add(m);
  }

  /** Decorative only — never collides (door frames stay passable) */
  function wallPipe(x, y, z, len, alongX = true) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), SHARED.pipe);
    if (alongX) {
      m.rotation.z = Math.PI / 2;
      m.position.set(x, y, z);
    } else {
      m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z);
    }
    group.add(m);
  }

  function baseTrim(x, z, w, d) {
    box(x, 0.12, z, w, 0.24, d, SHARED.trim, false, false);
  }

  function cautionBand(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), SHARED.caution);
    m.position.set(x, 0.1, z);
    group.add(m);
  }

  /** Lane paint on floor — readable route cue, no collision */
  function lanePaint(x, z, w, d, color = 0xc9a22a) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.09, z);
    group.add(m);
  }

  /** L-shaped cover corner for chokepoints */
  function cornerCover(x, z, facing = "ne") {
    const sx = facing.includes("e") ? 1 : facing.includes("w") ? -1 : 0;
    const sz = facing.includes("n") ? 1 : facing.includes("s") ? -1 : 0;
    cover(x, z, 1.6, 1.15, 0.55);
    cover(x + sx * 0.85, z + sz * 0.85, 0.55, 1.15, 1.6);
  }

  /** Short scaffold / loft for vertical sightlines — deck sits on posts (no float) */
  function loft(x, z, w = 3.2, d = 2.4, h = 1.85) {
    const post = 0.12;
    const deckT = 0.16;
    box(x - w * 0.4, h / 2, z - d * 0.4, post, h, post, SHARED.trim, true, false);
    box(x + w * 0.4, h / 2, z - d * 0.4, post, h, post, SHARED.trim, true, false);
    box(x - w * 0.4, h / 2, z + d * 0.4, post, h, post, SHARED.trim, true, false);
    box(x + w * 0.4, h / 2, z + d * 0.4, post, h, post, SHARED.trim, true, false);
    box(x, h + deckT / 2, z, w, deckT, d, SHARED.trim, true, false);
    // Ladder side — climbable as cover stack
    box(x - w * 0.48, 0.9, z, 0.35, 1.8, 0.7, SHARED.concrete, true, false);
  }

  function siteSign(x, z, label, color, faceYaw = 0) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = `#${new THREE.Color(color).getHexString()}`;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#0a1018";
    ctx.fillRect(16, 16, 224, 224);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 150px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 128, 138);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    // Mount on wall — never float in a doorway
    board.position.set(x, 2.35, z);
    board.rotation.y = faceYaw;
    group.add(board);
  }

  function siteMarker(x, z, label, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.2, 32),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        toneMapped: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.05, z);
    group.add(ring);
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 28),
      new THREE.MeshStandardMaterial({
        color: 0xb8b0a4,
        roughness: 0.75,
        metalness: 0.05,
        emissive: color,
        emissiveIntensity: 0.12,
      })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, 0.11, z);
    pad.material.polygonOffset = true;
    pad.material.polygonOffsetFactor = -2;
    pad.material.polygonOffsetUnits = -2;
    group.add(pad);
    // Plaque flush on north wall interior — not floating in doorways
    siteSign(x, z + 7.55, label, color, Math.PI);
    return { center: new THREE.Vector3(x, 0, z), radius: 3.2, name: label };
  }

  function tireStack(x, z) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.1, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.05 })
      );
      m.rotation.x = Math.PI / 2;
      m.position.set(x, 0.22 + i * 0.22, z);
      group.add(m);
    }
    addCollider(x, z, 0.8, 0.75, 0.8, 0.4);
  }

  // Outer fence
  wall(0, -52, 84, 1.5, 5, SHARED.wallDark);
  wall(0, 52, 84, 1.5, 5, SHARED.wallDark);
  wall(-42, 0, 1.5, 104, 5, SHARED.wallDark);
  wall(42, 0, 1.5, 104, 5, SHARED.wallDark);

  // === T SPAWN ===
  room(0, -40, 20, 12, [
    { side: "n", width: 3.8, offset: -5.5 },
    { side: "n", width: 3.8, offset: 5.5 },
  ]);
  crate(-6, -43, 2.2, 2.3, 4.2, 0xc08040);
  crate(6, -43, 2.2, 2.3, 4.2, 0x4a8ac8);
  cover(-2, -36, 2.0, 1.1, 0.9);
  barrel(3, -37, 0x4a6a40);
  barrel(4.1, -37.4, 0x5a3a28);

  // Banana (T → B)
  room(-14, -26, 9, 16, [
    { side: "s", width: 3.8, offset: 0 },
    { side: "n", width: 3.6, offset: 0 },
    { side: "e", width: 2.8, offset: 2 },
  ]);
  sandbags(-14, -22, 2.2, true);
  cover(-11, -28, 1.5, 1.1, 0.85);
  barrel(-16, -24);
  tireStack(-12, -20);
  cornerCover(-11.5, -22, "nw");
  lanePaint(-14, -26, 1.1, 12, 0x3a8a50);
  wallPipe(-17.5, 3.0, -26, 10, false);

  // Long (T → A)
  room(14, -26, 9, 16, [
    { side: "s", width: 3.8, offset: 0 },
    { side: "n", width: 3.6, offset: 0 },
    { side: "w", width: 2.8, offset: 2 },
  ]);
  sandbags(14, -22, 2.2, true);
  cover(11, -28, 1.5, 1.1, 0.85);
  crate(17, -30, 2.0, 2.2, 3.5, 0xd07040);
  lowWall(14, -18, 2.4, 0.55, 1.2);
  cornerCover(11.5, -22, "ne");
  lanePaint(14, -26, 1.1, 12, 0xc07040);
  loft(17, -24, 2.8, 2.0, 1.7);

  // Mid plaza — Mirage mid language: arches, double doors, underpass feel
  room(0, -14, 16, 14, [
    { side: "s", width: 4.4, offset: 0 },
    { side: "n", width: 4.2, offset: 0 },
    { side: "e", width: 3.4, offset: 0 },
    { side: "w", width: 3.4, offset: 0 },
  ]);
  arch(0, -20.8, true, 4.6, 3.5);
  arch(-7.8, -14, false, 3.8, 3.3);
  arch(7.8, -14, false, 3.8, 3.3);
  box(-3.5, 1.4, -14, 1.1, 2.8, 1.1, SHARED.concrete);
  box(3.5, 1.4, -12, 1.1, 2.8, 1.1, SHARED.concrete);
  cover(0, -11, 2.6, 1.25, 1.15);
  crate(-5, -17, 2.0, 2.2, 2.0, 0x3cb878);
  crate(5, -16, 2.0, 2.2, 2.0, 0x7a5ab8);
  boxStack(-2.2, -17.5, 3);
  boxStack(2.4, -15.8, 2);
  sandbags(0, -16.5, 2.8, true);
  windowPane(-8, -14, 2.2, 1.5, false);
  windowPane(8, -14, 2.2, 1.5, false);
  wallPipe(-6.5, 3.1, -14, 8, false);
  wallPipe(6.5, 3.1, -14, 8, false);
  baseTrim(0, -20.8, 14, 0.12);
  cautionBand(0, -14, 3.2, 0.35);
  cornerCover(-6, -10, "se");
  cornerCover(6, -10, "sw");
  loft(0, -17.5, 3.4, 2.2, 1.9);
  lanePaint(0, -14, 0.7, 10, 0xd0c040);

  // Side apartments off mid
  room(-18, -12, 8, 10, [
    { side: "e", width: 3.2, offset: 0 },
    { side: "n", width: 2.8, offset: 0 },
  ]);
  room(18, -12, 8, 10, [
    { side: "w", width: 3.2, offset: 0 },
    { side: "n", width: 2.8, offset: 0 },
  ]);
  crate(-18, -10, 2.0, 2.2, 3.5, 0x7a5ab8);
  crate(18, -14, 2.0, 2.2, 3.5, 0xd05060);
  cover(-16, -14, 1.4, 1.0, 0.8);
  cover(16, -10, 1.4, 1.0, 0.8);
  barrel(-20, -8, 0x8a3030);

  // Banana → B approach (shares wall plane with banana north / B south)
  room(-18, -8, 12, 20, [
    { side: "s", width: 3.6, offset: 4 },
    { side: "n", width: 3.6, offset: -4 },
    { side: "e", width: 2.8, offset: -4 },
  ]);
  cover(-16, -4, 1.6, 1.1, 0.9);
  sandbags(-20, -2, 2.2, false);
  barrel(-15, -10);
  lowWall(-18, -12, 2.5, 0.5, 1.3);

  // Long → A approach
  room(18, -8, 12, 20, [
    { side: "s", width: 3.6, offset: -4 },
    { side: "n", width: 3.6, offset: 4 },
    { side: "w", width: 2.8, offset: -4 },
  ]);
  cover(16, -4, 1.6, 1.1, 0.9);
  sandbags(20, -2, 2.2, false);
  crate(21, -12, 2.0, 2.2, 2.5, 0xc08040);
  lowWall(18, -12, 2.5, 0.5, 1.3);

  // Mid doors / connector (Mirage mid → sites)
  room(0, 2, 12, 12, [
    { side: "s", width: 4.0, offset: 0 },
    { side: "n", width: 3.8, offset: 0 },
    { side: "e", width: 3.6, offset: 0 },
    { side: "w", width: 3.6, offset: 0 },
  ]);
  arch(0, -3.8, true, 4.2, 3.4);
  cover(0, 2, 1.9, 1.2, 1.0);
  barrel(-2, 4, 0x3a5a38);
  barrel(2.2, 4.3, 0x5a4a28);
  boxStack(-1.5, 5.2, 2);
  lowWall(-4, 2, 0.5, 2.5, 1.4);
  lowWall(4, 2, 0.5, 2.5, 1.4);

  // === B SITE (Dust2 window / tunnel plant pocket) ===
  room(-22, 10, 16, 16, [
    { side: "s", width: 3.6, offset: 0 },
    { side: "e", width: 3.4, offset: -1 },
    { side: "n", width: 3.6, offset: 0 },
    { side: "w", width: 2.8, offset: 2 },
  ]);
  cover(-18, 8, 2.0, 1.2, 1.0);
  cover(-26, 14, 1.8, 1.15, 0.9);
  crate(-27, 6, 2.2, 2.3, 5.0, 0x3cb878);
  crate(-20, 16, 2.2, 2.3, 2.2, 0xd07040);
  boxStack(-19.5, 10.5, 4);
  boxStack(-24.5, 9.5, 3);
  sandbags(-22, 6, 3.0, true);
  sandbags(-15, 12, 2.2, false);
  barrel(-24, 12);
  barrel(-23, 12.8, 0x8a4040);
  tireStack(-19, 13);
  windowPane(-30, 10, 2.8, 1.6, false);
  wallPipe(-26, 3.0, 10, 10, false);
  baseTrim(-22, 4.2, 8, 0.12);
  cautionBand(-22, 10, 2.4, 0.3);
  floorPad(-22, 10, 10, 10, SHARED.floorB);
  cornerCover(-17, 7, "nw");
  cornerCover(-26, 13, "se");
  loft(-25, 7, 3.0, 2.2, 1.75);
  crate(-24, 16.5, 1.6, 1.4, 3.6, 0x2a5a88);
  barrel(-21, 8, 0x2a4a70);
  barrel(-20, 8.5, 0x2a4a70);
  const siteB = siteMarker(-22, 10, "B", 0x44aaff);

  // B back room (default plant pocket)
  room(-30, 18, 8, 8, [
    { side: "e", width: 2.8, offset: 0 },
    { side: "s", width: 2.8, offset: 0 },
  ]);
  cover(-30, 18, 1.6, 1.1, 0.85);
  barrel(-28, 20, 0x4a6a40);

  // === A SITE (Dust2 goose/van + box stacks) ===
  room(22, 10, 16, 16, [
    { side: "s", width: 3.6, offset: 0 },
    { side: "w", width: 3.4, offset: -1 },
    { side: "n", width: 3.6, offset: 0 },
    { side: "e", width: 2.8, offset: 2 },
  ]);
  cover(18, 8, 2.0, 1.2, 1.0);
  cover(26, 14, 1.8, 1.15, 0.9);
  crate(27, 6, 2.2, 2.3, 5.0, 0x4a9ad0);
  crate(20, 16, 2.2, 2.3, 2.2, 0xc0b040);
  van(24.5, 11.5, -0.4, 0xc4b090);
  boxStack(19.2, 11.5, 4);
  boxStack(26.5, 9.2, 3);
  // Ramp-ish box stack toward site
  box(22, 0.4, 4, 2.2, 0.8, 2.4, SHARED.concrete);
  box(22, 0.9, 5.2, 1.8, 0.7, 1.6, SHARED.concrete);
  sandbags(22, 6, 3.0, true);
  sandbags(15, 12, 2.2, false);
  barrel(24, 12, 0x3a5a88);
  tireStack(19, 13);
  windowPane(30, 10, 2.8, 1.6, false);
  wallPipe(26, 3.0, 10, 10, false);
  baseTrim(22, 4.2, 8, 0.12);
  cautionBand(22, 10, 2.4, 0.3);
  floorPad(22, 10, 10, 10, SHARED.floorA);
  cornerCover(17, 7, "ne");
  cornerCover(26, 13, "sw");
  loft(25, 7, 3.0, 2.2, 1.75);
  barrel(21, 8, 0xa05028);
  barrel(20, 8.5, 0xa05028);
  barrel(22.5, 7.2, 0x8a4020);
  const siteA = siteMarker(22, 10, "A", 0xff6644);

  // A loft / elevated default
  room(30, 18, 8, 8, [
    { side: "w", width: 2.8, offset: 0 },
    { side: "s", width: 2.8, offset: 0 },
  ]);
  box(30, 0.55, 16, 2.0, 1.1, 1.8, SHARED.cover);
  cover(30, 18, 1.6, 1.1, 0.85);

  // A/B → CT halls (share wall with site north / CT south)
  room(-22, 26, 12, 16, [
    { side: "s", width: 3.6, offset: 0 },
    { side: "n", width: 3.6, offset: 5 },
    { side: "e", width: 3.2, offset: 0 },
  ]);
  room(22, 26, 12, 16, [
    { side: "s", width: 3.6, offset: 0 },
    { side: "n", width: 3.6, offset: -5 },
    { side: "w", width: 3.2, offset: 0 },
  ]);
  cover(-22, 26, 1.6, 1.1, 0.9);
  cover(22, 26, 1.6, 1.1, 0.9);
  sandbags(-22, 30, 2.2, true);
  sandbags(22, 30, 2.2, true);
  barrel(-20, 24);
  crate(24, 28, 2.0, 2.2, 2.0, 0x5a7a98);

  // CT connector mid — north doors share plane with CT spawn
  room(0, 28, 16, 12, [
    { side: "s", width: 3.6, offset: 0 },
    { side: "n", width: 3.8, offset: -5.5 },
    { side: "n", width: 3.8, offset: 5.5 },
    { side: "e", width: 3.4, offset: 0 },
    { side: "w", width: 3.4, offset: 0 },
  ]);
  lowWall(0, 28, 2.4, 0.55, 1.25);
  cover(-4, 30, 1.4, 1.0, 0.8);
  cover(4, 26, 1.4, 1.0, 0.8);
  barrel(-2, 26, 0x3a5a68);

  // === CT SPAWN ===
  room(0, 40, 20, 12, [
    { side: "s", width: 3.8, offset: -5.5 },
    { side: "s", width: 3.8, offset: 5.5 },
  ]);
  crate(-6, 43, 2.2, 2.3, 4.0, 0x5a7a98);
  crate(6, 43, 2.2, 2.3, 4.0, 0x5a7a98);
  cover(0, 37, 2.4, 1.15, 1.0);
  sandbags(-3, 38, 2.4, true);
  barrel(3, 38, 0x3a5a68);

  // Outdoor yard toys
  crate(-34, -2, 2.4, 2.5, 6, 0x3a7ab0);
  crate(34, 0, 2.4, 2.5, 6, 0xa85a2f);
  crate(-34, 20, 2.4, 2.5, 4, 0x5a8a40);
  crate(34, 22, 2.4, 2.5, 4, 0xb06040);
  tireStack(-32, 8);
  tireStack(32, 8);
  sandbags(0, -32, 3.5, true);
  lowWall(-8, -32, 0.5, 3.0, 1.5);
  lowWall(8, -32, 0.5, 3.0, 1.5);

  // === Extra Dust2/Mirage density — rooms, props, sightlines ===
  // Banana elbow pocket
  room(-26, -22, 7, 8, [
    { side: "e", width: 2.8, offset: 0 },
    { side: "n", width: 2.6, offset: 0 },
  ]);
  cover(-26, -22, 1.4, 1.05, 0.75);
  barrel(-27.5, -20, 0x4a6a40);
  boxStack(-24.5, -24, 2);
  lanePaint(-26, -22, 0.55, 5, 0x3a8a50);

  // Long catwalk annex
  room(26, -22, 7, 8, [
    { side: "w", width: 2.8, offset: 0 },
    { side: "n", width: 2.6, offset: 0 },
  ]);
  cover(26, -22, 1.4, 1.05, 0.75);
  crate(28, -24, 1.8, 1.8, 2.2, 0xc08040);
  tireStack(24.5, -20);
  loft(27, -20.5, 2.4, 1.8, 1.55);

  // Mid palace / market stalls (Mirage language)
  room(-10, 2, 7, 8, [
    { side: "e", width: 2.8, offset: 0 },
    { side: "s", width: 2.6, offset: 0 },
  ]);
  room(10, 2, 7, 8, [
    { side: "w", width: 2.8, offset: 0 },
    { side: "s", width: 2.6, offset: 0 },
  ]);
  arch(0, 8.2, true, 5.0, 3.6);
  box(-2.5, 1.5, 6, 0.9, 3.0, 0.9, SHARED.concrete);
  box(2.5, 1.5, 6, 0.9, 3.0, 0.9, SHARED.concrete);
  boxStack(-1, 0, 3);
  boxStack(1.2, 3.5, 2);
  sandbags(0, 5, 2.4, true);
  barrel(-3, 3, 0x5a4a28);
  barrel(3.2, 3.2, 0x3a5a38);
  cover(-8, 2, 1.5, 1.1, 0.8);
  cover(8, 2, 1.5, 1.1, 0.8);
  windowPane(-10, 2, 1.8, 1.3, false);
  windowPane(10, 2, 1.8, 1.3, false);
  wallPipe(0, 3.1, 6, 6, true);
  cautionBand(0, 6, 2.0, 0.28);

  // B tunnels / underpass clutter
  room(-30, 6, 7, 7, [
    { side: "e", width: 2.6, offset: 0 },
    { side: "n", width: 2.6, offset: 0 },
  ]);
  sandbags(-30, 6, 2.0, true);
  barrel(-31, 4.5, 0x8a3030);
  cover(-28.5, 7.5, 1.3, 1.0, 0.7);
  lanePaint(-26, 6, 6, 0.55, 0x44aaff);

  // A short / goose sightline props
  room(30, 6, 7, 7, [
    { side: "w", width: 2.6, offset: 0 },
    { side: "n", width: 2.6, offset: 0 },
  ]);
  lowWall(30, 4, 2.2, 0.45, 1.15);
  boxStack(28.5, 7, 3);
  barrel(31.5, 5, 0xa05028);
  lanePaint(26, 6, 6, 0.55, 0xff6644);

  // CT garage / scaffold
  room(0, 18, 10, 8, [
    { side: "n", width: 3.4, offset: 0 },
    { side: "s", width: 3.4, offset: 0 },
    { side: "e", width: 2.8, offset: 0 },
    { side: "w", width: 2.8, offset: 0 },
  ]);
  loft(0, 18, 3.6, 2.4, 1.9);
  cover(-3, 16, 1.5, 1.1, 0.85);
  cover(3, 20, 1.5, 1.1, 0.85);
  crate(-3.5, 19, 1.8, 1.8, 2.0, 0x5a7a98);
  barrel(2, 17, 0x3a5a68);
  sandbags(0, 15, 2.6, true);
  lanePaint(0, 18, 0.6, 6, 0x8aa0b5);

  // Extra mid/yard props for denser sightlines
  cornerCover(-14, -8, "ne");
  cornerCover(14, -8, "nw");
  tireStack(-10, -30);
  tireStack(10, -30);
  barrel(-8, -36, 0x4a6a40);
  barrel(8, -36, 0x5a3a28);
  boxStack(-4, -34, 2);
  boxStack(4, -34, 2);
  van(-32, 12, 1.1, 0xa89878);
  sandbags(32, 16, 2.4, false);
  cover(-6, 34, 1.6, 1.1, 0.9);
  cover(6, 34, 1.6, 1.1, 0.9);
  wallPipe(-22, 3.0, 26, 8, false);
  wallPipe(22, 3.0, 26, 8, false);

  const tSpawns = [
    new THREE.Vector3(0, 0, -42),
    new THREE.Vector3(-4, 0, -40),
    new THREE.Vector3(4, 0, -40),
    new THREE.Vector3(-2, 0, -38),
    new THREE.Vector3(2, 0, -38),
  ];
  const ctSpawns = [
    new THREE.Vector3(0, 0, 42),
    new THREE.Vector3(-4, 0, 40),
    new THREE.Vector3(4, 0, 40),
    new THREE.Vector3(-2, 0, 38),
    new THREE.Vector3(2, 0, 38),
  ];
  const botSpawnsT = [
    new THREE.Vector3(-16, 0, -28),
    new THREE.Vector3(16, 0, -28),
    new THREE.Vector3(-6, 0, -34),
    new THREE.Vector3(6, 0, -34),
    new THREE.Vector3(0, 0, -18),
    new THREE.Vector3(-20, 0, -12),
    new THREE.Vector3(20, 0, -12),
    new THREE.Vector3(-10, 0, -24),
    new THREE.Vector3(10, 0, -24),
  ];
  const botSpawnsCT = [
    new THREE.Vector3(-16, 0, 34),
    new THREE.Vector3(16, 0, 34),
    new THREE.Vector3(-6, 0, 40),
    new THREE.Vector3(6, 0, 40),
    new THREE.Vector3(-22, 0, 16),
    new THREE.Vector3(22, 0, 16),
    new THREE.Vector3(0, 0, 22),
    new THREE.Vector3(-12, 0, 28),
    new THREE.Vector3(12, 0, 28),
  ];

  // Room hubs + sites + spawns for bot nav graph
  for (const p of [
    [0, -40], [-14, -26], [14, -26], [0, -14], [-18, -12], [18, -12],
    [-18, -8], [18, -8], [0, 2], [-22, 10], [22, 10], [-30, 18], [30, 18],
    [-22, 26], [22, 26], [0, 28], [0, 40], [-26, -22], [26, -22],
    [-10, 2], [10, 2], [-30, 6], [30, 6], [0, 18],
    [-22, 10], [22, 10], // sites A/B centers again ok — dedupe below
  ]) {
    navNodes.push({ x: p[0], z: p[1] });
  }

  function buildNavGraph() {
    // Deduplicate nearby nodes
    const pts = [];
    for (const n of navNodes) {
      if (pts.some((p) => (p.x - n.x) ** 2 + (p.z - n.z) ** 2 < 1.2 * 1.2)) continue;
      pts.push({ x: n.x, z: n.z, neighbors: [] });
    }
    const blocked = (ax, az, bx, bz) => {
      const steps = 10;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        for (const c of colliders) {
          if (c.maxY < 1.2) continue; // step over low cover
          if (x >= c.minX - 0.2 && x <= c.maxX + 0.2 && z >= c.minZ - 0.2 && z <= c.maxZ + 0.2) {
            return true;
          }
        }
      }
      return false;
    };
    const maxLink = 16;
    for (let i = 0; i < pts.length; i++) {
      const links = [];
      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue;
        const dx = pts[j].x - pts[i].x;
        const dz = pts[j].z - pts[i].z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5 || d > maxLink) continue;
        if (blocked(pts[i].x, pts[i].z, pts[j].x, pts[j].z)) continue;
        links.push({ j, d });
      }
      links.sort((a, b) => a.d - b.d);
      pts[i].neighbors = links.slice(0, 6).map((l) => l.j);
    }
    return pts;
  }

  const navGraph = buildNavGraph();

  function nearestNav(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < navGraph.length; i++) {
      const d = (navGraph[i].x - x) ** 2 + (navGraph[i].z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** A* on waypoint graph → list of {x,z} including goal */
  function findPath(fromX, fromZ, toX, toZ) {
    if (!navGraph.length) return [{ x: toX, z: toZ }];
    const start = nearestNav(fromX, fromZ);
    const goal = nearestNav(toX, toZ);
    if (start === goal) return [{ x: toX, z: toZ }];

    const open = [start];
    const came = new Map();
    const gScore = new Map([[start, 0]]);
    const fScore = new Map([
      [start, Math.hypot(navGraph[goal].x - navGraph[start].x, navGraph[goal].z - navGraph[start].z)],
    ]);
    const closed = new Set();

    while (open.length) {
      open.sort((a, b) => (fScore.get(a) ?? 1e9) - (fScore.get(b) ?? 1e9));
      const cur = open.shift();
      if (cur === goal) {
        const path = [];
        let c = cur;
        while (came.has(c)) {
          path.push({ x: navGraph[c].x, z: navGraph[c].z });
          c = came.get(c);
        }
        path.reverse();
        path.push({ x: toX, z: toZ });
        return path;
      }
      closed.add(cur);
      for (const nb of navGraph[cur].neighbors) {
        if (closed.has(nb)) continue;
        const tentative =
          (gScore.get(cur) ?? 1e9) +
          Math.hypot(navGraph[nb].x - navGraph[cur].x, navGraph[nb].z - navGraph[cur].z);
        if (tentative < (gScore.get(nb) ?? 1e9)) {
          came.set(nb, cur);
          gScore.set(nb, tentative);
          fScore.set(
            nb,
            tentative + Math.hypot(navGraph[goal].x - navGraph[nb].x, navGraph[goal].z - navGraph[nb].z)
          );
          if (!open.includes(nb)) open.push(nb);
        }
      }
    }
    return [{ x: toX, z: toZ }];
  }

  function resolveCollision(pos, radius = 0.36) {
    // Feet/waist volume — skip pure overhead (door headers) so gaps stay walkable
    const bodyMin = 0.05;
    const bodyMax = 1.55;
    for (let pass = 0; pass < 4; pass++) {
      for (const c of colliders) {
        if (c.maxY < 0.85) continue;
        if (c.minY > bodyMax || c.maxY < bodyMin) continue;
        const nearestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const nearestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - nearestX;
        const dz = pos.z - nearestZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq) || 0.0001;
          const push = radius - dist + 0.002;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        }
      }
    }
    pos.x = THREE.MathUtils.clamp(pos.x, -40, 40);
    pos.z = THREE.MathUtils.clamp(pos.z, -50, 50);
  }

  /** Ray vs upright colliders (incl. waist cover). Returns hit distance or maxDist. */
  function raycast(origin, dir, maxDist = 40) {
    let best = maxDist;
    const ox = origin.x;
    const oy = origin.y;
    const oz = origin.z;
    const dx = dir.x;
    const dy = dir.y;
    const dz = dir.z;
    for (const c of colliders) {
      // Keep short cover (sandbags / low walls) — viewmodel clips into these
      if (c.maxY < 0.35 || c.minY > 2.6) continue;
      let tmin = 0;
      let tmax = maxDist;
      // X slab
      if (Math.abs(dx) < 1e-8) {
        if (ox < c.minX || ox > c.maxX) continue;
      } else {
        let t1 = (c.minX - ox) / dx;
        let t2 = (c.maxX - ox) / dx;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      // Y slab
      if (Math.abs(dy) < 1e-8) {
        if (oy < c.minY || oy > c.maxY) continue;
      } else {
        let t1 = (c.minY - oy) / dy;
        let t2 = (c.maxY - oy) / dy;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      // Z slab
      if (Math.abs(dz) < 1e-8) {
        if (oz < c.minZ || oz > c.maxZ) continue;
      } else {
        let t1 = (c.minZ - oz) / dz;
        let t2 = (c.maxZ - oz) / dz;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (tmin > 0.02 && tmin < best) best = tmin;
    }
    return best;
  }

  function update(dt, cameraPos, time) {
    for (const m of shaderMats) {
      if (m.uniforms?.uTime) m.uniforms.uTime.value = time;
    }
  }

  function inSite(pos, site) {
    // Horizontal only — player eye height must not fail plant checks
    const dx = pos.x - site.center.x;
    const dz = pos.z - site.center.z;
    return dx * dx + dz * dz <= site.radius * site.radius;
  }

  return {
    group,
    colliders,
    navGraph,
    findPath,
    nearestNav,
    sites: { A: siteA, B: siteB },
    tSpawns,
    ctSpawns,
    botSpawnsT,
    botSpawnsCT,
    spawn: tSpawns[0].clone().setY(1.7),
    resolveCollision,
    raycast,
    update,
    inSite,
    dispose() {
      scene.remove(group);
      scene.remove(ambient);
      scene.remove(hemi);
      scene.remove(sun);
      scene.remove(fill);
    },
  };
}
