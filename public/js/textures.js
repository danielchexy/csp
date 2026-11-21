import * as THREE from "three";

function canvas(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  return { c, ctx, size };
}

function toTex(c, { repeat = 1, normal = false } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (!normal) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Height → tangent-space normal map */
function heightToNormal(heightCtx, size, strength = 2.5) {
  const src = heightCtx.getImageData(0, 0, size, size).data;
  const { c, ctx } = canvas(size);
  const out = ctx.createImageData(size, size);
  const h = (x, y) => {
    const i = ((y & (size - 1)) * size + (x & (size - 1))) * 4;
    return src[i] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1) || 1;
      const i = (y * size + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 0.5 * 255 + 128;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return toTex(c, { repeat: 1, normal: true });
}

function fillNoise(ctx, size, base, varAmt = 30) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() * varAmt - varAmt * 0.5) | 0;
    d[i] = Math.max(0, Math.min(255, base[0] + n));
    d[i + 1] = Math.max(0, Math.min(255, base[1] + n));
    d[i + 2] = Math.max(0, Math.min(255, base[2] + n));
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Weathered plaster / painted concrete walls */
export function makePlasterTexture() {
  const size = 512;
  const { c, ctx } = canvas(size);
  fillNoise(ctx, size, [210, 205, 195], 28);

  // Larger mottling
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.04 + Math.random() * 0.1;
    g.addColorStop(0, `rgba(160,150,140,${a})`);
    g.addColorStop(1, "rgba(160,150,140,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dirt near “bottom” bands
  for (let i = 0; i < 40; i++) {
    const y = size * (0.7 + Math.random() * 0.3);
    ctx.fillStyle = `rgba(90,70,50,${0.04 + Math.random() * 0.08})`;
    ctx.fillRect(0, y, size, 2 + Math.random() * 6);
  }

  // Soft hairline cracks — keep sparse so motion doesn't shimmer
  ctx.strokeStyle = "rgba(60,50,40,0.1)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (Math.random() - 0.5) * 28;
      y += (Math.random() - 0.5) * 28;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Panel seams
  ctx.strokeStyle = "rgba(100,90,80,0.2)";
  for (let y = 0; y < size; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size, y + 0.5);
    ctx.stroke();
  }

  const map = toTex(c, { repeat: 2 });
  // Height pass for normals
  const h = canvas(size);
  h.ctx.fillStyle = "#808080";
  h.ctx.fillRect(0, 0, size, size);
  h.ctx.drawImage(c, 0, 0);
  const normalMap = heightToNormal(h.ctx, size, 0.9);
  normalMap.repeat.set(2, 2);
  return { map, normalMap };
}

/** Worn warehouse floor */
export function makeFloorTexture() {
  const size = 512;
  const { c, ctx } = canvas(size);
  fillNoise(ctx, size, [150, 140, 125], 35);

  // Tile grid
  ctx.strokeStyle = "rgba(40,35,30,0.35)";
  ctx.lineWidth = 2;
  const tile = 64;
  for (let i = 0; i <= size; i += tile) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Stains
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 15 + Math.random() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(40,35,30,${0.2 + Math.random() * 0.3})`);
    g.addColorStop(1, "rgba(40,35,30,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scuff marks
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(220,210,190,${0.05 + Math.random() * 0.1})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }

  const map = toTex(c, { repeat: 4 });
  const h = canvas(size);
  h.ctx.drawImage(c, 0, 0);
  const normalMap = heightToNormal(h.ctx, size, 2.2);
  normalMap.repeat.set(4, 4);
  return { map, normalMap };
}

/** Exterior asphalt */
export function makeAsphaltTexture() {
  const size = 512;
  const { c, ctx } = canvas(size);
  fillNoise(ctx, size, [55, 58, 62], 40);

  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const s = 1 + Math.random() * 2.5;
    const v = 30 + ((Math.random() * 50) | 0);
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 4},0.5)`;
    ctx.fillRect(x, y, s, s);
  }

  ctx.strokeStyle = "rgba(10,10,12,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 35; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let j = 0; j < 7; j++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 14; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 20 + Math.random() * 45;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, "rgba(15,16,20,0.65)");
    g.addColorStop(1, "rgba(15,16,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = toTex(c, { repeat: 14 });
  return map;
}

export function makeContainerTexture(hex) {
  const size = 512;
  const { c, ctx } = canvas(size);
  const col = new THREE.Color(hex);
  ctx.fillStyle = `#${col.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += 10) {
    ctx.fillStyle = `rgba(0,0,0,${x % 20 === 0 ? 0.32 : 0})`;
    ctx.fillRect(x, 0, 4, size);
    ctx.fillStyle = `rgba(255,255,255,${x % 20 === 0 ? 0 : 0.08})`;
    ctx.fillRect(x + 4, 0, 2, size);
  }

  for (let i = 0; i < 55; i++) {
    const x = Math.random() * size;
    const w = 3 + Math.random() * 10;
    const g = ctx.createLinearGradient(x, 0, x, size);
    g.addColorStop(0, "rgba(120,55,20,0)");
    g.addColorStop(0.3, `rgba(110,50,18,${0.25 + Math.random() * 0.4})`);
    g.addColorStop(1, "rgba(60,30,10,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, size);
  }

  ctx.fillStyle = "rgba(20,20,24,0.7)";
  for (let y = 24; y < size; y += 64) {
    for (let x = 24; x < size; x += 48) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(200,200,210,0.25)";
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(20,20,24,0.7)";
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(size * 0.55, size * 0.35, size * 0.35, size * 0.22);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.strokeRect(size * 0.55, size * 0.35, size * 0.35, size * 0.22);
  ctx.fillStyle = "rgba(230,240,255,0.55)";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText("CSP", size * 0.6, size * 0.5);

  return toTex(c);
}

export function makeContainerNormal() {
  const size = 256;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 8) {
    const g = ctx.createLinearGradient(x, 0, x + 8, 0);
    g.addColorStop(0, "#6060ff");
    g.addColorStop(0.5, "#a0a0ff");
    g.addColorStop(1, "#6060ff");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 8, size);
  }
  return toTex(c, { normal: true });
}

export function makeMetalTexture() {
  const size = 256;
  const { c, ctx } = canvas(size);
  fillNoise(ctx, size, [110, 118, 128], 25);
  for (let i = 0; i < 80; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * size);
    ctx.lineTo(size, Math.random() * size);
    ctx.stroke();
  }
  return toTex(c, { repeat: 2 });
}

/** Rough wood for props / trim */
export function makeWoodTexture() {
  const size = 512;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = "#6a4a30";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x++) {
    const n = Math.sin(x * 0.15) * 8 + Math.sin(x * 0.03) * 18;
    ctx.fillStyle = `rgba(${80 + n},${55 + n * 0.6},${35},${0.15 + (x % 7) * 0.02})`;
    ctx.fillRect(x, 0, 1, size);
  }
  for (let i = 0; i < 20; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(40,25,15,${0.15 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4);
    ctx.stroke();
  }
  const map = toTex(c, { repeat: 1 });
  const h = canvas(size);
  h.ctx.drawImage(c, 0, 0);
  const normalMap = heightToNormal(h.ctx, size, 2.0);
  return { map, normalMap };
}
