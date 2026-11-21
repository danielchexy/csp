import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GAME, QUALITY, BOMB, BOT_NAMES } from "./config.js?v=csp62";
import { WEAPON_BY_ID } from "./weapons.js?v=csp62";
import { createWorld } from "./world.js?v=csp62";
import { createInput, isTouchDevice } from "./input.js?v=csp62";
import { SFX } from "./audio.js?v=csp62";
import { createComposer } from "./fx.js?v=csp62";
import {
  createBot,
  createViewmodel,
  updateBotPose,
  updateViewmodel,
  punchViewmodel,
  preloadSoldiers,
  createC4Mesh,
} from "./entities.js?v=csp62";

export function createGame({
  canvas,
  settingsRef,
  onHud,
  onEnd,
  onToast,
  playerTeam = "t",
  weaponId = "glock",
  ownedIds: ownedIdsIn = null,
} = {}) {
  let renderer, scene, camera, world, input, gun, fx, bombMesh;
  let running = false;
  let armed = false;
  let fireHeld = false;
  let raf = 0;
  let tickTimer = 0;
  let last = 0;
  let time = 0;

  const team = playerTeam === "ct" ? "ct" : "t";
  const enemyTeam = team === "t" ? "ct" : "t";
  let weapon = WEAPON_BY_ID[weaponId] || WEAPON_BY_ID.glock;
  const ownedIds = (ownedIdsIn?.length ? ownedIdsIn : [weapon.id]).filter((id) => WEAPON_BY_ID[id]);
  if (!ownedIds.includes(weapon.id)) ownedIds.unshift(weapon.id);

  const player = {
    hp: GAME.maxHp,
    yaw: team === "t" ? Math.PI : 0,
    pitch: 0,
    pos: new THREE.Vector3(),
    velY: 0,
    grounded: true,
    mag: weapon.mag,
    reserve: weapon.reserve,
    cooldown: 0,
    reloading: 0,
    reloadDur: 0,
    won: false,
    dead: false,
    moving: false,
    sprinting: false,
    team,
    spray: 0,
    punchPitch: 0,
    punchYaw: 0,
    weaponName: weapon.name,
    wallPull: 0,
  };

  const score = { t: 0, ct: 0 };
  const round = {
    timeLeft: BOMB.roundTime,
    buyLeft: BOMB.buyTime,
    phase: "buy", // buy | live | end
    over: false,
    number: 1,
    endTimer: 0,
    pendingMatchEnd: null,
  };

  const bomb = {
    state: team === "t" ? "carried" : "idle", // idle = T bots have it
    site: null,
    pos: new THREE.Vector3(),
    plantProgress: 0,
    defuseProgress: 0,
    fuseLeft: BOMB.fuseTime,
    holdAction: null, // 'plant' | 'defuse'
  };

  const enemies = [];
  const allies = [];
  const bullets = [];
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const nametagLayer = document.getElementById("nametag-layer");
  const playerName = settingsRef?.current?.displayName || "Player";
  let nameIdx = { t: 0, ct: 0 };

  function applyQuality(q) {
    renderer.setPixelRatio(q.pixelRatio);
    renderer.shadowMap.enabled = !!q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (scene?.fog) {
      scene.fog.near = q.fogNear + 10;
      scene.fog.far = q.fogFar + 20;
    }
    if (camera) camera.far = q.drawDistance;
  }

  function nextBotName(side) {
    const pool = BOT_NAMES[side] || BOT_NAMES.t;
    const n = pool[nameIdx[side] % pool.length];
    nameIdx[side]++;
    return n;
  }

  function clearNametags() {
    if (!nametagLayer) return;
    nametagLayer.innerHTML = "";
  }

  function spawnSide(list, count, side, spots) {
    for (const e of list) {
      if (e.tagEl) e.tagEl.remove();
      scene.remove(e.mesh);
    }
    list.length = 0;
    for (let i = 0; i < count; i++) {
      const mesh = createBot(side);
      // Unique slot per bot across expanded spots — wide fan, no doorway stack
      const spot = spots[i % spots.length];
      const slot = (i / spots.length) | 0;
      const ring = 2.2 + slot * 1.6 + (i % 3) * 0.55;
      const ang = (i * 2.399) + (side === "t" ? 0.35 : 1.4);
      mesh.position.set(spot.x + Math.cos(ang) * ring, 0, spot.z + Math.sin(ang) * ring);
      world.resolveCollision(mesh.position, 0.4);
      mesh.rotation.order = "YXZ";
      mesh.rotation.y = side === "t" ? 0 : Math.PI;
      scene.add(mesh);
      const displayName = nextBotName(side);
      let tagEl = null;
      if (nametagLayer) {
        tagEl = document.createElement("div");
        tagEl.className = "nametag";
        tagEl.dataset.team = side;
        tagEl.innerHTML = `<span class="nametag-name">${displayName}</span>`;
        tagEl.style.display = "none";
        nametagLayer.appendChild(tagEl);
      }
      const home = mesh.position.clone();
      list.push({
        mesh,
        team: side,
        displayName,
        tagEl,
        home,
        goalOffset: new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6),
        hp: 100,
        speed: 2.6 + Math.random() * 0.25,
        attackCd: 1 + Math.random(),
        alive: true,
        strafe: Math.random() > 0.5 ? 1 : -1,
        strafeT: 0.5 + Math.random(),
        accuracy: 0.48 + Math.random() * 0.22,
        shootKick: 0,
        plantCd: 4 + Math.random() * 6,
        hasBomb: false,
        targetSite: i % 2 === 0 ? "A" : "B",
        path: null,
        pathIdx: 0,
        pathGoal: null,
        stuckT: 0,
        lastPos: mesh.position.clone(),
        repathT: 0,
        yaw: mesh.rotation.y,
        lod: 0,
      });
    }
  }

  /** Soft push so bots don't occupy the same point (stacking / jitter). */
  function separateAgents(lists) {
    const all = [];
    for (const list of lists) {
      for (const e of list) if (e.alive) all.push(e);
    }
    const minDist = 1.45;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i].mesh.position;
        const b = all[j].mesh.position;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= minDist || d < 1e-4) continue;
        const push = (minDist - d) * 0.55;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
    }
  }

  function smoothBotYaw(e, faceX, faceZ, dt) {
    const dx = faceX - e.mesh.position.x;
    const dz = faceZ - e.mesh.position.z;
    if (dx * dx + dz * dz < 1e-6) return;
    // Match Object3D.lookAt Y-facing (−Z toward target)
    const desired = Math.atan2(-dx, -dz);
    let dy = desired - (e.yaw || 0);
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    e.yaw = (e.yaw || 0) + THREE.MathUtils.clamp(dy, -2.8 * dt, 2.8 * dt);
    e.mesh.rotation.order = "YXZ";
    e.mesh.rotation.y = e.yaw;
    e.mesh.rotation.x = 0;
    e.mesh.rotation.z = 0;
  }

  function spawnBots() {
    spawnSide(enemies, BOMB.enemyBots, enemyTeam, enemyTeam === "ct" ? world.botSpawnsCT : world.botSpawnsT);
    spawnSide(allies, BOMB.allyBots, team, team === "t" ? world.botSpawnsT : world.botSpawnsCT);
    if (team === "ct") {
      // Give bomb to a T enemy
      if (enemies.length) {
        enemies[0].hasBomb = true;
        bomb.state = "carried_bot";
      }
    }
  }

  function resetMatch() {
    score.t = 0;
    score.ct = 0;
    round.number = 1;
    player.weaponName = weapon.name;
    beginRound();
    // Optional capture poses: #x=&z=&yaw=&pitch=&plant=A&advance=90&bots=1
    try {
      const h = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      if (h.has("x") && h.has("z")) {
        player.pos.set(Number(h.get("x")), 1.7, Number(h.get("z")));
        if (h.has("yaw")) player.yaw = Number(h.get("yaw"));
        if (h.has("pitch")) player.pitch = Number(h.get("pitch"));
        camera.position.copy(player.pos);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
      }
      if (h.get("plant") === "A" || h.get("plant") === "B") {
        const site = world.sites[h.get("plant")];
        if (site) plantBomb(h.get("plant"), site.center.clone());
      }
      const adv = Number(h.get("advance") || 0);
      if (adv > 0) player._captureAdvance = adv;
      if (h.get("bots") === "1") {
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        const rx = Math.cos(player.yaw);
        const rz = -Math.sin(player.yaw);
        const pin = (e, ox, oz) => {
          if (!e) return;
          e.mesh.position.set(player.pos.x + fx * 4.2 + rx * ox, 0, player.pos.z + fz * 4.2 + rz * oz);
          e.yaw = Math.atan2(-(player.pos.x - e.mesh.position.x), -(player.pos.z - e.mesh.position.z));
          e.mesh.rotation.y = e.yaw;
          e.speed = 0;
          e.path = null;
          e.home = e.mesh.position.clone();
          e.patrol = e.mesh.position.clone();
          e.patrolT = 9999;
          e.stuckT = 0;
          e.mesh.userData.holdIdle?.();
        };
        pin(enemies[0], -1.15, 0);
        pin(allies[0] || enemies[1], 1.15, 0);
      }
    } catch {
      /* ignore bad hash */
    }
    pushHud();
  }

  function fmt(t) {
    const s = Math.max(0, Math.ceil(t));
    const m = (s / 60) | 0;
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  function objectiveText() {
    if (round.phase === "end") return player.won ? "Round won" : "Round lost";
    if (round.phase === "buy") return `BUY TIME · ${fmt(round.buyLeft)} · round ${round.number}`;
    if (player.dead) return "You are dead — spectating";
    if (player.reloading > 0) return "Reloading…";
    if (bomb.state === "planted") {
      if (team === "ct") return `Bomb planted ${bomb.site} · DEFUSE (hold E) · ${fmt(bomb.fuseLeft)}`;
      return `Bomb planted ${bomb.site} · defend · ${fmt(bomb.fuseLeft)}`;
    }
    if (bomb.holdAction === "plant") {
      const pct = Math.floor((bomb.plantProgress / BOMB.plantTime) * 100);
      return `Planting C4… ${pct}% — keep holding E`;
    }
    if (bomb.holdAction === "defuse") {
      const pct = Math.floor((bomb.defuseProgress / BOMB.defuseTime) * 100);
      return `Defusing C4… ${pct}% — keep holding E`;
    }
    if (team === "t") return `Plant C4 at A or B (hold E on site) · ${fmt(round.timeLeft)}`;
    return `Stop the plant / hold E on C4 to defuse · ${fmt(round.timeLeft)}`;
  }

  function pushHud(extra = {}) {
    onHud?.({
      hp: player.hp,
      mag: player.mag,
      reserve: player.reserve,
      objective: objectiveText(),
      reloading: player.reloading > 0,
      team,
      weapon: weapon.name,
      spray: player.spray,
      bombState: bomb.state,
      roundTime: bomb.state === "planted" ? bomb.fuseLeft : round.phase === "buy" ? round.buyLeft : round.timeLeft,
      scoreT: score.t,
      scoreCT: score.ct,
      roundNumber: round.number,
      phase: round.phase,
      buyLeft: round.buyLeft,
      playerName,
      ...extra,
    });
  }

  function endRound(win, reason) {
    if (GAME.explore) {
      onToast?.(reason || (win ? "Round would end (explore)" : "Round would end (explore)"));
      pushHud();
      return;
    }
    if (round.over) return;
    round.over = true;
    round.phase = "end";
    round.endTimer = BOMB.roundRestartDelay;
    player.won = win;
    const winner = win ? team : enemyTeam;
    if (winner === "t") score.t += 1;
    else score.ct += 1;
    SFX[win ? "win" : "hurt"]();
    onToast?.(reason || (win ? "Round won" : "Round lost"));
    pushHud({
      roundBanner: {
        title: win ? "ROUND WON" : "ROUND LOST",
        sub: `${reason || ""} · T ${score.t} – ${score.ct} CT`,
      },
    });

    const matchOver = score.t >= BOMB.winScore || score.ct >= BOMB.winScore;
    if (matchOver) {
      round.pendingMatchEnd = {
        win: score[team] > score[enemyTeam],
        reason: score.t >= BOMB.winScore ? "Terrorists win the match" : "Counter-Terrorists win the match",
        score: { ...score },
        match: true,
      };
    } else {
      round.pendingMatchEnd = null;
    }
  }

  function beginRound() {
    player.hp = GAME.maxHp;
    player.yaw = team === "t" ? Math.PI : 0;
    player.pitch = -0.05;
    player.velY = 0;
    player.mag = weapon.mag;
    player.reserve = weapon.reserve;
    player.cooldown = 0;
    player.reloading = 0;
    player.reloadDur = 0;
    player.won = false;
    player.dead = false;
    player.spray = 0;
    player.punchPitch = 0;
    player.punchYaw = 0;
    armed = false;
    fireHeld = false;
    round.timeLeft = BOMB.roundTime;
    round.buyLeft = BOMB.buyTime;
    round.phase = "buy";
    round.over = false;
    round.endTimer = 0;
    round.pendingMatchEnd = null;
    bomb.state = team === "t" ? "carried" : "idle";
    bomb.site = null;
    bomb.plantProgress = 0;
    bomb.defuseProgress = 0;
    bomb.fuseLeft = BOMB.fuseTime;
    bomb.holdAction = null;
    if (bombMesh) bombMesh.visible = false;

    const spawnPos = team === "t" ? world.tSpawns[0] : world.ctSpawns[0];
    player.pos.set(spawnPos.x, 1.7, spawnPos.z);
    camera.position.copy(player.pos);
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    nameIdx = { t: 0, ct: 0 };
    clearNametags();
    spawnBots();
    pushHud({ roundBanner: null });
    onToast?.(`Round ${round.number} · buy time`);
  }

  function startNextRound() {
    round.number += 1;
    beginRound();
  }

  function aliveCount(list) {
    return list.filter((e) => e.alive).length;
  }

  function checkElim() {
    if (GAME.explore || round.over || round.phase !== "live" || player.dead) return;
    if (aliveCount(enemies) === 0) {
      if (bomb.state === "planted") {
        if (team === "ct") return;
        endRound(true, "Enemies eliminated — bomb live");
      } else {
        endRound(true, "Enemies eliminated");
      }
    }
  }

  function updateNametags() {
    if (!nametagLayer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const camPos = camera.position;

    const allyRank = allies
      .filter((e) => e.alive)
      .map((e) => ({ e, d: camPos.distanceTo(e.mesh.position) }))
      .sort((a, b) => a.d - b.d);
    const allyAllow = new Set(allyRank.filter((x) => x.d < 20).slice(0, 4).map((x) => x.e));

    const losClear = (e) => {
      const dir = tmp2.set(e.mesh.position.x - camPos.x, 1.55 - camPos.y, e.mesh.position.z - camPos.z);
      const len = dir.length();
      if (len < 0.2) return true;
      dir.multiplyScalar(1 / len);
      return world.raycast(camPos, dir, len - 0.35) >= len - 0.45;
    };

    const paint = (e, isEnemy) => {
      const el = e.tagEl;
      if (!el) return;
      if (!e.alive) {
        el.style.display = "none";
        return;
      }
      tmp3.set(e.mesh.position.x, 1.85, e.mesh.position.z);
      const dist = camPos.distanceTo(tmp3);
      tmp3.project(camera);
      const behind = tmp3.z > 1 || tmp3.z < 0;
      const onScreen = !behind && Math.abs(tmp3.x) < 1.05 && Math.abs(tmp3.y) < 1.15;
      let show = false;
      if (isEnemy) {
        show = onScreen && dist < 28 && losClear(e);
      } else {
        show = onScreen && allyAllow.has(e) && dist < 20;
      }
      if (!show) {
        el.style.display = "none";
        return;
      }
      const x = (tmp3.x * 0.5 + 0.5) * w;
      const y = (-tmp3.y * 0.5 + 0.5) * h;
      el.style.display = "block";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.opacity = String(THREE.MathUtils.clamp(1.05 - dist / 24, 0.4, 1));
      el.dataset.team = e.team;
      if (!isEnemy) el.dataset.ally = "1";
      else delete el.dataset.ally;
    };

    for (const e of allies) paint(e, false);
    for (const e of enemies) paint(e, true);
  }

  function plantBomb(siteName, pos) {
    bomb.state = "planted";
    bomb.site = siteName;
    bomb.pos.copy(pos);
    bomb.fuseLeft = BOMB.fuseTime;
    bomb.plantProgress = 0;
    bomb.defuseProgress = 0;
    bomb.holdAction = null;
    if (bombMesh) {
      bombMesh.visible = true;
      bombMesh.position.set(pos.x, 0.02, pos.z);
      bombMesh.rotation.set(0.08, Math.random() * 0.6 - 0.3, -0.04);
      if (bombMesh.userData.ledMat) bombMesh.userData.ledMat.emissiveIntensity = 1.6;
    }
    SFX.relay();
    SFX.click();
    onToast?.(GAME.explore ? `C4 planted ${siteName} — fuse live (explore)` : `C4 planted at ${siteName}`);
    pushHud();
  }

  function explodeBomb() {
    bomb.state = "exploded";
    if (bombMesh) bombMesh.visible = false;
    endRound(team === "t", team === "t" ? "Bomb exploded" : "Bomb exploded — Terrorists win");
    // Explore: reset bomb so plant can be tested again
    if (GAME.explore) {
      bomb.state = team === "t" ? "carried" : "idle";
      bomb.site = null;
      bomb.fuseLeft = BOMB.fuseTime;
      bomb.plantProgress = 0;
      bomb.defuseProgress = 0;
      if (team === "ct" && enemies[0]) {
        enemies[0].hasBomb = true;
        bomb.state = "carried_bot";
      }
    }
  }

  function defuseBomb() {
    bomb.state = "defused";
    if (bombMesh) bombMesh.visible = false;
    SFX.relay();
    onToast?.("C4 defused");
    endRound(team === "ct", team === "ct" ? "Bomb defused" : "Bomb defused — CTs win");
    if (GAME.explore) {
      bomb.state = team === "t" ? "carried" : "idle";
      bomb.site = null;
      bomb.fuseLeft = BOMB.fuseTime;
      bomb.plantProgress = 0;
      bomb.defuseProgress = 0;
      if (team === "ct" && enemies[0]) {
        enemies[0].hasBomb = true;
        bomb.state = "carried_bot";
      }
    }
  }

  function spawnTracer(from, to, color = 0xffe08a) {
    const dir = tmp.copy(to).sub(from);
    const len = dir.length();
    if (len < 0.2) return;
    dir.multiplyScalar(1 / len);
    const tracer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, Math.min(len, 2.2), 4),
      new THREE.MeshBasicMaterial({ color })
    );
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tracer.position.copy(from).addScaledVector(dir, Math.min(len, 2.2) * 0.5);
    scene.add(tracer);
    bullets.push({ mesh: tracer, life: 0.05 });
  }

  function tryShoot() {
    if (player.dead || round.over || player.reloading > 0 || player.cooldown > 0) return;
    if (bomb.holdAction) return;
    if (player.mag <= 0) {
      startReload();
      return;
    }
    player.mag -= 1;
    player.cooldown = weapon.fireCooldown;
    SFX.shoot();

    const ads = !!input.aiming;
    const mul = ads ? weapon.adsMul : 1;
    const pattern = weapon.pattern;
    const idx = Math.min(pattern.length - 1, player.spray | 0);
    const [patPitch, patYaw] = pattern[idx];
    const pitchKick = patPitch * mul * (0.92 + Math.random() * 0.16);
    const yawKick = patYaw * mul * (0.85 + Math.random() * 0.3);

    player.punchPitch += pitchKick;
    player.punchYaw += yawKick;
    player.pitch += pitchKick;
    player.yaw += yawKick;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.35, 1.35);
    player.spray = Math.min(pattern.length, player.spray + 1);

    punchViewmodel(gun, (ads ? 0.7 : 1.15) * (0.85 + Math.min(0.4, player.spray * 0.03)), yawKick * 8);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let spread =
      weapon.baseSpread * mul +
      player.spray * weapon.spraySpread * mul +
      (player.moving ? weapon.moveSpread : 0) +
      (!player.grounded ? weapon.jumpSpread : 0);
    if (ads) spread *= 0.65;
    dir.x += (Math.random() - 0.5) * spread * 2;
    dir.y += (Math.random() - 0.5) * spread * 2;
    dir.z += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    raycaster.set(camera.position.clone().addScaledVector(dir, 0.4), dir);

    let best = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const hits = raycaster.intersectObject(e.mesh, true);
      if (hits.length && hits[0].distance < 95) {
        if (!best || hits[0].distance < best.d) best = { e, d: hits[0].distance, point: hits[0].point };
      }
    }
    if (best) {
      const headshot = best.point && best.point.y - best.e.mesh.position.y > 1.55;
      const dmg = weapon.damage * (headshot ? weapon.hsMul : 1);
      best.e.hp -= dmg;
      SFX.hit();
      spawnTracer(camera.position.clone().addScaledVector(dir, 0.8), best.point);
      if (best.e.hp <= 0) {
        best.e.alive = false;
        scene.remove(best.e.mesh);
        onToast?.(headshot ? "Enemy down (HS)" : "Enemy down");
        checkElim();
      }
    } else {
      spawnTracer(camera.position.clone().addScaledVector(dir, 0.8), camera.position.clone().addScaledVector(dir, 40));
    }
    if (gun?.userData.flash) {
      gun.userData.flash.intensity = 8 + Math.random() * 4;
      setTimeout(() => {
        if (gun?.userData.flash) gun.userData.flash.intensity = 0;
      }, 28 + Math.random() * 20);
    }
    pushHud();
  }

  function startReload() {
    if (player.reloading > 0 || player.mag >= weapon.mag || player.reserve <= 0) return;
    player.reloadDur = weapon.reload;
    player.reloading = weapon.reload;
    SFX.reload();
    pushHud();
  }

  function switchWeapon(nextId) {
    const next = WEAPON_BY_ID[nextId];
    if (!next || next.id === weapon.id || !ownedIds.includes(next.id)) return;
    if (player.dead || round.over || bomb.holdAction) return;
    weapon = next;
    player.mag = weapon.mag;
    player.reserve = weapon.reserve;
    player.reloading = 0;
    player.reloadDur = 0;
    player.cooldown = 0.2;
    player.spray = 0;
    player.weaponName = weapon.name;
    if (gun && camera) {
      camera.remove(gun);
      gun = createViewmodel(weapon);
      camera.add(gun);
    }
    onToast?.(weapon.name);
    pushHud();
  }

  function pollWeaponHotkeys() {
    const slot = input.consumeWeaponSlot?.();
    if (slot == null) return;
    // 1 pistol · 2 SMG/rifle · 3 sniper/shotgun — cycle owned in that family
    const families = {
      1: ["pistol"],
      2: ["smg", "rifle"],
      3: ["sniper", "shotgun"],
    };
    const want = families[slot];
    if (!want) return;
    const pool = ownedIds.filter((id) => want.includes(WEAPON_BY_ID[id]?.slot));
    if (!pool.length) return;
    const cur = pool.indexOf(weapon.id);
    const next = pool[(cur + 1) % pool.length];
    switchWeapon(next);
  }

  function updateBombInteract(dt) {
    bomb.holdAction = null;
    if (player.dead || round.over || !input.wantsInteract()) {
      bomb.plantProgress = Math.max(0, bomb.plantProgress - dt * 2);
      bomb.defuseProgress = Math.max(0, bomb.defuseProgress - dt * 2);
      return;
    }

    // Plant (enabled in explore for testing — combat still softened)
    if (team === "t" && (bomb.state === "carried" || bomb.state === "idle")) {
      for (const name of ["A", "B"]) {
        const site = world.sites[name];
        if (world.inSite(player.pos, site)) {
          bomb.holdAction = "plant";
          bomb.plantProgress += dt;
          if (bomb.plantProgress >= BOMB.plantTime) {
            plantBomb(name, site.center.clone());
          }
          pushHud();
          return;
        }
      }
    }

    // Defuse
    if (team === "ct" && bomb.state === "planted") {
      if (player.pos.distanceTo(bomb.pos) < 2.2) {
        bomb.holdAction = "defuse";
        bomb.defuseProgress += dt;
        if (bomb.defuseProgress >= BOMB.defuseTime) defuseBomb();
        pushHud();
        return;
      }
    }

    bomb.plantProgress = Math.max(0, bomb.plantProgress - dt * 2);
    bomb.defuseProgress = Math.max(0, bomb.defuseProgress - dt * 2);
  }

  function updatePlayer(dt) {
    const look = input.consumeLook();
    player.yaw -= look.dx * GAME.mouseSens;
    // Match three.js PointerLockControls: pitch -= movementY
    player.pitch -= look.dy * GAME.mouseSens;

    // Spray pattern resets after you stop firing — aim stays where it climbed
    if (!input.shooting || player.reloading > 0 || player.dead) {
      player.spray = Math.max(0, player.spray - 11 * dt);
      player.punchPitch *= Math.exp(-9 * dt);
      player.punchYaw *= Math.exp(-9 * dt);
    }

    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.35, 1.35);
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    const mv = input.movement();
    const planting = !!bomb.holdAction;
    player.sprinting = !!mv.sprint && !input.aiming && player.reloading <= 0 && !planting;
    const speed =
      GAME.playerSpeed *
      (player.sprinting ? GAME.sprintMul : 1) *
      (input.aiming ? 0.55 : 1) *
      (player.reloading > 0 || planting ? 0.35 : 1);
    forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    tmp.set(0, 0, 0);
    tmp.addScaledVector(right, mv.x);
    tmp.addScaledVector(forward, -mv.z);
    player.moving = tmp.lengthSq() > 0 && !planting;
    if (player.moving) {
      tmp.normalize().multiplyScalar(speed * dt);
      player.pos.x += tmp.x;
      player.pos.z += tmp.z;
    }
    world.resolveCollision(player.pos);

    if (!planting && player.grounded && input.consumeJump()) {
      player.velY = GAME.jumpSpeed;
      player.grounded = false;
    }
    player.velY -= GAME.gravity * dt;
    player.pos.y += player.velY * dt;
    if (player.pos.y <= 1.7) {
      player.pos.y = 1.7;
      player.velY = 0;
      player.grounded = true;
    }
    camera.position.copy(player.pos);
    updateBombInteract(dt);

    if (gun) {
      // Soft wall avoidance — slight pull; hard hide only when face-jammed
      camera.getWorldDirection(forward);
      right.crossVectors(forward, camera.up).normalize();
      const range = 2.0;
      const muzzle = gun.userData.muzzleLen ?? 1.05;
      let hit = range;
      const sample = (ox, oy, oz, dx, dy, dz) => {
        tmp.set(ox, oy, oz);
        const d = tmp2.set(dx, dy, dz).normalize();
        hit = Math.min(hit, world.raycast?.(tmp, d, range) ?? range);
      };
      const o = camera.position;
      const gy = o.y - 0.3;
      const fx = forward.x;
      const fy = forward.y;
      const fz = forward.z;
      const rx = right.x;
      const rz = right.z;
      sample(o.x, o.y, o.z, fx, fy, fz);
      sample(o.x + rx * 0.18, gy, o.z + rz * 0.18, fx, fy, fz);
      sample(o.x + rx * 0.28, gy, o.z + rz * 0.28, fx + rx * 0.25, fy - 0.08, fz + rz * 0.25);
      sample(o.x, gy, o.z, fx, fy - 0.2, fz);
      // Soft band: pull near muzzle length; stay visible unless face-jammed
      const jamAt = 0.22;
      const start = muzzle + 0.55;
      let wallPull = 0;
      if (hit < start) {
        wallPull = THREE.MathUtils.clamp((start - hit) / (start - jamAt), 0, 1);
        if (hit > jamAt) wallPull = Math.min(wallPull, 0.72);
      }
      player.wallPull = wallPull;
      updateViewmodel(gun, dt, {
        moving: player.moving,
        sprinting: player.sprinting,
        aiming: input.aiming,
        reloading: player.reloading,
        reloadDur: player.reloadDur,
        grounded: player.grounded,
        firing: input.shooting && player.cooldown > 0,
        wallPull,
      });
    }
  }

  function botSetGoal(e, goal, force = false) {
    const gx = goal.x;
    const gz = goal.z;
    if (
      !force &&
      e.pathGoal &&
      Math.hypot(e.pathGoal.x - gx, e.pathGoal.z - gz) < 1.5 &&
      e.path?.length
    ) {
      return;
    }
    e.pathGoal = { x: gx, z: gz };
    e.path = world.findPath?.(e.mesh.position.x, e.mesh.position.z, gx, gz) || [{ x: gx, z: gz }];
    e.pathIdx = 0;
    e.repathT = 2.5 + Math.random();
  }

  function offsetGoal(base, e) {
    const o = e.goalOffset || tmp.set(0, 0, 0);
    return tmp.set(base.x + o.x, 0, base.z + o.z);
  }

  function updateBotList(list, isEnemy, dt) {
    for (const e of list) {
      if (!e.alive) continue;
      // Buy / freeze: hold home spawn — Idle_Gun, no mid-map rush
      if (round.phase === "buy" || round.phase === "end") {
        e.path = null;
        e.mesh.position.y = 0;
        smoothBotYaw(e, e.mesh.position.x - Math.sin(e.yaw), e.mesh.position.z - Math.cos(e.yaw), dt);
        updateBotPose(e.mesh, dt, { moving: false, aiming: false, shootKick: 0 });
        continue;
      }

      let goal = player.pos;
      if (GAME.explore) {
        if (!e.patrol) {
          const graph = world.navGraph || [];
          const node = graph[(Math.random() * graph.length) | 0] || { x: e.mesh.position.x, z: e.mesh.position.z };
          e.patrol = new THREE.Vector3(node.x, 0, node.z);
          e.patrolT = 5 + Math.random() * 6;
        }
        e.patrolT -= dt;
        if (e.patrolT <= 0) {
          const graph = world.navGraph || [];
          const node = graph[(Math.random() * graph.length) | 0];
          if (node) e.patrol.set(node.x, 0, node.z);
          e.patrolT = 6 + Math.random() * 8;
        }
        goal = e.patrol;
      } else if (!isEnemy) {
        if (team === "t" && bomb.state !== "planted") {
          goal = offsetGoal(world.sites[e.targetSite].center, e);
        } else if (bomb.state === "planted") {
          goal = offsetGoal(bomb.pos, e);
        } else {
          let nearest = null;
          for (const en of enemies) {
            if (!en.alive) continue;
            const d = en.mesh.position.distanceTo(e.mesh.position);
            if (!nearest || d < nearest.d) nearest = { d, p: en.mesh.position };
          }
          if (nearest) goal = offsetGoal(nearest.p, e);
          else goal = e.home || e.mesh.position;
        }
      } else {
        // Enemies: approach player with personal offset — not a single funnel point
        goal = offsetGoal(player.pos, e);
      }

      // T enemy with bomb: go plant (works in explore for plant testing)
      if (isEnemy && e.hasBomb && (bomb.state === "carried_bot" || bomb.state === "idle")) {
        const site = world.sites[e.targetSite];
        goal = offsetGoal(site.center, e);
        if (world.inSite(e.mesh.position, site)) {
          e.plantCd -= dt;
          if (e.plantCd <= 0) {
            plantBomb(e.targetSite, site.center.clone());
            e.hasBomb = false;
          }
        }
      }

      // Ally T with bomb duty in explore — walk sites so plant loop is visible
      if (!isEnemy && team === "t" && GAME.explore && bomb.state === "carried") {
        // player has bomb; allies still roam sites
        goal = world.sites[e.targetSite].center;
      }

      // CT bots defuse
      if (!isEnemy && team === "ct" && bomb.state === "planted") {
        goal = bomb.pos;
        if (e.mesh.position.distanceTo(bomb.pos) < 2.0) {
          bomb.defuseProgress += dt * 0.45; // slower than player
          if (bomb.defuseProgress >= BOMB.defuseTime) defuseBomb();
        }
      }
      // Enemy CT defuse if player is T
      if (isEnemy && enemyTeam === "ct" && bomb.state === "planted") {
        goal = bomb.pos;
        if (e.mesh.position.distanceTo(bomb.pos) < 2.0) {
          bomb.defuseProgress += dt * 0.4;
          if (bomb.defuseProgress >= BOMB.defuseTime) defuseBomb();
        }
      }

      e.repathT = (e.repathT || 0) - dt;
      botSetGoal(e, goal, e.repathT <= 0);
      if (e.repathT <= 0) e.repathT = 2.5 + Math.random();

      // Follow path waypoints
      let waypoint = goal;
      if (e.path?.length) {
        while (e.pathIdx < e.path.length - 1) {
          const wp = e.path[e.pathIdx];
          if (Math.hypot(wp.x - e.mesh.position.x, wp.z - e.mesh.position.z) < 1.1) e.pathIdx++;
          else break;
        }
        const wp = e.path[Math.min(e.pathIdx, e.path.length - 1)];
        waypoint = tmp2.set(wp.x, 0, wp.z);
      }

      const toGoal = tmp.copy(waypoint).sub(e.mesh.position);
      toGoal.y = 0;
      const dist = toGoal.length();
      const dir = dist > 0.001 ? toGoal.multiplyScalar(1 / dist) : tmp2.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      const distFinal = Math.hypot(goal.x - e.mesh.position.x, goal.z - e.mesh.position.z);

      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafe *= -1;
        e.strafeT = 1.2 + Math.random() * 1.6;
      }
      e.shootKick = Math.max(0, e.shootKick - dt * 4);

      let moving = false;
      const beforeX = e.mesh.position.x;
      const beforeZ = e.mesh.position.z;
      const spd = GAME.explore ? e.speed * 0.55 : e.speed;
      const prefer = GAME.explore ? 1.6 : isEnemy ? 12 : 5.5;
      // Strafe only in combat hold — not while door-pathing (was skating/spinning)
      const inCombatHold = !GAME.explore && isEnemy && distFinal <= prefer && distFinal > 4;
      const strafeAmt = e.path && e.pathIdx < (e.path.length - 1) ? 0.05 : inCombatHold ? 0.28 : 0;

      if (distFinal > prefer) {
        e.mesh.position.x += dir.x * spd * dt;
        e.mesh.position.z += dir.z * spd * dt;
        if (strafeAmt > 0) {
          e.mesh.position.x += -dir.z * e.strafe * spd * strafeAmt * dt;
          e.mesh.position.z += dir.x * e.strafe * spd * strafeAmt * dt;
        }
        moving = true;
      } else if (inCombatHold) {
        e.mesh.position.x += -dir.z * e.strafe * spd * 0.35 * dt;
        e.mesh.position.z += dir.x * e.strafe * spd * 0.35 * dt;
        if (distFinal < 5) {
          e.mesh.position.x -= dir.x * spd * 0.25 * dt;
          e.mesh.position.z -= dir.z * spd * 0.25 * dt;
        }
        moving = true;
      }

      world.resolveCollision(e.mesh.position, 0.38);
      e.mesh.position.y = 0;

      // Face move dir while walking; face player/goal when holding — no lookAt (spin)
      if (moving) {
        smoothBotYaw(e, e.mesh.position.x + dir.x, e.mesh.position.z + dir.z, dt);
      } else if (isEnemy && !GAME.explore) {
        smoothBotYaw(e, player.pos.x, player.pos.z, dt);
      } else {
        smoothBotYaw(e, goal.x, goal.z, dt);
      }

      // Stuck recovery — repath; soft nudge, no hard warp teleport
      const moved = Math.hypot(e.mesh.position.x - beforeX, e.mesh.position.z - beforeZ);
      if (moving && moved < 0.015) {
        e.stuckT = (e.stuckT || 0) + dt;
        if (e.stuckT > 1.6) {
          e.stuckT = 0;
          botSetGoal(e, goal, true);
          e.mesh.position.x += (Math.random() - 0.5) * 0.8;
          e.mesh.position.z += (Math.random() - 0.5) * 0.8;
          world.resolveCollision(e.mesh.position, 0.38);
        }
      } else {
        e.stuckT = 0;
      }
      e.lastPos.copy(e.mesh.position);

      // LOD: far bots animate every 2nd/3rd frame
      e.lod = (e.lod || 0) + 1;
      const distCam = camera.position.distanceTo(e.mesh.position);
      const skipAnim = distCam > 40 ? e.lod % 3 !== 0 : distCam > 22 ? e.lod % 2 !== 0 : false;
      if (!skipAnim) {
        updateBotPose(e.mesh, dt * (distCam > 22 ? 2 : 1), {
          moving,
          aiming: !GAME.explore && round.phase === "live" && distFinal < 30,
          shootKick: e.shootKick,
        });
      }

      // Shoot at player (disabled in explore / buy)
      if (GAME.explore || !isEnemy || round.over || round.phase !== "live" || !armed) continue;
      e.attackCd -= dt;
      const toPlayer = player.pos.clone().sub(e.mesh.position);
      const pDist = toPlayer.length();
      if (e.attackCd <= 0 && pDist < 40 && distFinal < 45 && !player.dead) {
        e.attackCd = 0.6 + Math.random() * 0.7;
        e.shootKick = 0.25;
        SFX.shoot();
        const dirP = toPlayer.normalize();
        const muzzle = e.mesh.position.clone().add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(dirP, 0.6);
        const aim = player.pos.clone();
        if (Math.random() > e.accuracy) {
          aim.x += (Math.random() - 0.5) * 2.4;
          aim.y += (Math.random() - 0.5) * 1.5;
          aim.z += (Math.random() - 0.5) * 2.4;
        }
        spawnTracer(muzzle, aim, 0xffaa66);
        if (aim.distanceTo(player.pos) < 1.5) {
          player.hp -= 3 + Math.random() * 3;
          SFX.hurt();
          pushHud({ damageFlash: true });
          if (player.hp <= 0) {
            player.hp = 0;
            player.dead = true;
            if (aliveCount(allies) === 0 && team === "t" && bomb.state !== "planted") {
              endRound(false, "Your team eliminated");
            }
            pushHud();
            onToast?.("You died — spectating round");
          }
        }
      }
    }

    // Ally shooting at enemies
    if (!GAME.explore && !isEnemy && round.phase === "live") {
      for (const a of list) {
        if (!a.alive || round.over) continue;
        a.attackCd -= dt;
        let nearest = null;
        for (const en of enemies) {
          if (!en.alive) continue;
          const d = en.mesh.position.distanceTo(a.mesh.position);
          if (!nearest || d < nearest.d) nearest = { d, e: en };
        }
        if (nearest && nearest.d < 38 && a.attackCd <= 0) {
          a.attackCd = 0.5 + Math.random() * 0.6;
          a.shootKick = 0.2;
          const dir = nearest.e.mesh.position.clone().sub(a.mesh.position).setY(0).normalize();
          const muzzle = a.mesh.position.clone().add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(dir, 0.6);
          spawnTracer(muzzle, nearest.e.mesh.position.clone().setY(1.4), 0xaaddff);
          if (Math.random() < a.accuracy) {
            nearest.e.hp -= 18;
            if (nearest.e.hp <= 0) {
              nearest.e.alive = false;
              scene.remove(nearest.e.mesh);
              checkElim();
            }
          }
        }
      }
    }
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    time += dt;

    // Timers / phases
    if (round.phase === "end") {
      round.endTimer -= dt;
      if (round.endTimer <= 0) {
        if (round.pendingMatchEnd) {
          const result = round.pendingMatchEnd;
          round.pendingMatchEnd = null;
          try {
            document.exitPointerLock?.();
          } catch {}
          onEnd?.({ ...result, team });
        } else {
          startNextRound();
        }
      }
    } else if (round.phase === "buy") {
      round.buyLeft -= dt;
      if (round.buyLeft <= 0) {
        round.phase = "live";
        round.buyLeft = 0;
        onToast?.("Round live");
        pushHud({ roundBanner: null });
      }
    } else if (!round.over) {
      if (bomb.state === "planted") {
        bomb.fuseLeft -= dt;
        const blinkHz = bomb.fuseLeft < 10 ? 8 : bomb.fuseLeft < 20 ? 4 : 2;
        const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(time * blinkHz * Math.PI * 2));
        if (bombMesh?.userData.light) bombMesh.userData.light.intensity = 0.25 + pulse * 0.55;
        if (bombMesh?.userData.ledMat) bombMesh.userData.ledMat.emissiveIntensity = 0.5 + pulse * 1.2;
        if (Math.floor(bomb.fuseLeft * blinkHz) !== Math.floor((bomb.fuseLeft + dt) * blinkHz) && bomb.fuseLeft < 20) {
          SFX.click();
        }
        if (bomb.fuseLeft <= 0) explodeBomb();
      } else if (!GAME.explore) {
        round.timeLeft -= dt;
        if (round.timeLeft <= 0) {
          endRound(team === "ct", "Time expired — CTs win");
        }
      }
    }

    player.cooldown = Math.max(0, player.cooldown - dt);
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) {
        const need = weapon.mag - player.mag;
        const take = Math.min(need, player.reserve);
        player.mag += take;
        player.reserve -= take;
        player.reloading = 0;
        player.reloadDur = 0;
        onToast?.("Ready");
      }
      pushHud();
    }

    if (!round.over) {
      const mv = input.movement();
      if (!armed && (input.shooting || input.pointerLocked || mv.x || mv.z)) {
        armed = true;
        SFX.unlock();
      }
      if (!player.dead) updatePlayer(dt);
      world.update(dt, camera.position, time);
      // Always advance bots (Idle/Walk) — don't leave CDN soldiers in T-pose pre-lock
      updateBotList(enemies, true, dt);
      updateBotList(allies, false, dt);
      separateAgents([enemies, allies]);
      for (const e of enemies) {
        if (e.alive) world.resolveCollision(e.mesh.position, 0.38);
      }
      for (const e of allies) {
        if (e.alive) world.resolveCollision(e.mesh.position, 0.38);
      }
      updateNametags();
      if (armed) {
        if (!player.dead) {
          pollWeaponHotkeys();
          if (input.wantsReload()) startReload();
          if (player.reloading <= 0 && !bomb.holdAction) {
            if (weapon.automatic) {
              if (input.shooting) tryShoot();
            } else if (input.shooting && !fireHeld) {
              tryShoot();
            }
          }
          fireHeld = !!input.shooting;
        }
        // If player dead and T, check team wipe
        if (player.dead && team === "t" && aliveCount(allies) === 0 && bomb.state !== "planted") {
          endRound(false, "Terrorists eliminated");
        }
        if (player.dead && team === "ct" && aliveCount(allies) === 0 && bomb.state !== "planted") {
          endRound(false, "Counter-Terrorists eliminated");
        }
      }
    } else {
      world.update(dt, camera.position, time);
    }

    // periodic HUD refresh for timers
    if ((time * 4) % 1 < dt * 4) pushHud();

    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].life -= dt;
      if (bullets[i].life <= 0) {
        scene.remove(bullets[i].mesh);
        bullets.splice(i, 1);
      }
    }

    // Soft wall pull shortens FOV slightly (never blank the gun)
    const baseFov = input.aiming ? 48 : 72;
    const pullFov = (player.wallPull || 0) * 5;
    camera.fov = THREE.MathUtils.lerp(camera.fov, baseFov - pullFov, 1 - Math.pow(0.001, dt));
    camera.updateProjectionMatrix();
    if (fx) fx.render();
    else renderer.render(scene, camera);
  }

  function onCanvasClick() {
    SFX.unlock();
    armed = true;
    input.requestLock();
    onToast?.(
      team === "t"
        ? "You are T · plant at A (orange) or B (blue) — hold E"
        : "You are CT · stop the plant · hold E to defuse"
    );
  }

  async function start() {
    const q = QUALITY[settingsRef.current.quality] || QUALITY.high;
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: q.label !== "Low",
      powerPreference: "high-performance",
      alpha: false,
      logarithmicDepthBuffer: true,
    });
    renderer.setClearColor(0x87b0e0, 1);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = !!q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.55;
      pmrem.dispose();
    } catch {
      /* env optional */
    }
    camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.12, q.drawDistance);
    scene.add(camera);
    gun = createViewmodel(weapon);
    camera.add(gun);
    world = createWorld(scene, q);
    bombMesh = createC4Mesh();
    bombMesh.visible = false;
    scene.add(bombMesh);
    applyQuality(q);
    try {
      fx = createComposer(renderer, scene, camera, q);
    } catch {
      fx = null;
    }
    input = createInput(canvas, settingsRef);
    // CDN soldier before first spawn — falls back to procedural if offline
    await preloadSoldiers();
    resetMatch();

    if (fx) fx.render();
    else renderer.render(scene, camera);

    running = true;
    last = performance.now();
    const pump = (t) => {
      if (!running) return;
      frame(t || performance.now());
    };
    // Capture advance frames from hash (bots walk paths before screenshot)
    const adv = player._captureAdvance || 0;
    if (adv > 0) {
      for (let i = 0; i < adv; i++) pump(performance.now() + i * 33);
      delete player._captureAdvance;
    }

    // Expose ASAP for local proof captures (before any later setup can throw)
    const debugApi = {
      player,
      enemies,
      allies,
      bomb,
      round,
      camera,
      scene,
      world,
      input,
      gun,
      pump,
      pose(x, z, yaw = 0, pitch = 0) {
        player.pos.set(x, 1.7, z);
        player.yaw = yaw;
        player.pitch = pitch;
        camera.position.copy(player.pos);
        camera.rotation.order = "YXZ";
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
        for (let i = 0; i < 8; i++) pump(performance.now());
      },
      plantAt(siteName = "A") {
        const site = world.sites[siteName];
        if (!site) return false;
        plantBomb(siteName, site.center.clone());
        for (let i = 0; i < 4; i++) pump(performance.now());
        return true;
      },
      holdPlant(dt = 0.4) {
        // Simulate hold-E plant progress while standing in a site
        for (const name of ["A", "B"]) {
          const site = world.sites[name];
          if (world.inSite(player.pos, site)) {
            bomb.holdAction = "plant";
            bomb.plantProgress += dt;
            if (bomb.plantProgress >= BOMB.plantTime) plantBomb(name, site.center.clone());
            pushHud();
            return bomb.state;
          }
        }
        return bomb.state;
      },
      wallPull() {
        return gun?.userData?.wallPull ?? 0;
      },
      gunVisible() {
        return !!gun?.userData?.gun?.visible;
      },
    };
    // Prefer CSP / cspApi — some runners hide __-prefixed window keys
    window.CSP = debugApi;
    window.cspApi = debugApi;
    window.__csp = debugApi;
    globalThis.__csp = debugApi;
    globalThis.CSP = debugApi;
    try {
      canvas.__csp = debugApi;
      canvas.setAttribute("data-csp", "1");
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.cspReady = "1";
    document.documentElement.dataset.cspEnemies = String(enemies.length);
    document.documentElement.dataset.cspAllies = String(allies.length);
    document.body?.setAttribute("data-csp-live", "1");

    // DOM command bus — automation worlds that can't see window.CSP can still drive
    const onCspCmd = (ev) => {
      const d = ev.detail || {};
      const op = d.op;
      if (op === "pose") debugApi.pose(d.x, d.z, d.yaw ?? 0, d.pitch ?? 0);
      else if (op === "plant") debugApi.plantAt(d.site || "A");
      else if (op === "pump") {
        const n = d.n || 10;
        for (let i = 0; i < n; i++) pump(performance.now() + i * 16);
      } else if (op === "live") {
        round.phase = "live";
        round.buyLeft = 0;
      } else if (op === "endRound") endRound(!!d.win, d.reason || "Debug end");
      else if (op === "nextRound") {
        round.endTimer = 0.01;
        round.phase = "end";
        round.over = true;
      } else if (op === "killEnemies") {
        for (const e of enemies) {
          e.alive = false;
          e.mesh.visible = false;
          if (e.tagEl) e.tagEl.style.display = "none";
        }
        checkElim();
      } else if (op === "arrange" || op === "showcase") {
        // Mid-distance 4–6 bots for proofs — rest parked far off-camera
        const base = player.pos;
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        const rx = Math.cos(player.yaw);
        const rz = -Math.sin(player.yaw);
        const show = [];
        for (const e of allies) if (e.alive && show.length < 3) show.push(e);
        for (const e of enemies) if (e.alive && show.length < 6) show.push(e);
        const all = [...allies, ...enemies].filter((e) => e.alive);
        for (const e of all) {
          if (show.includes(e)) continue;
          e.mesh.position.set(base.x + rx * 40, 0, base.z + rz * 40);
          e.path = null;
          e.speed = 0;
          if (e.tagEl) e.tagEl.style.display = "none";
        }
        show.forEach((e, i) => {
          const col = i - (show.length - 1) / 2;
          const dist = 7.5;
          e.mesh.position.set(
            base.x + fx * dist + rx * col * 2.35,
            0,
            base.z + fz * dist + rz * col * 2.35
          );
          e.path = null;
          e.speed = 0;
          e.home = e.mesh.position.clone();
          e.yaw = player.yaw + Math.PI;
          e.mesh.rotation.y = e.yaw;
          e.mesh.userData.holdIdle?.() || e.mesh.userData.setAnim?.("idle");
        });
        round.phase = "buy";
        round.buyLeft = 8;
        for (let i = 0; i < 40; i++) pump(performance.now() + i * 16);
      } else if (op === "snapshot") {
        const sample = enemies[0] || allies[0];
        let mats = [];
        let bones = [];
        let anim = null;
        if (sample?.mesh) {
          sample.mesh.traverse((o) => {
            if (o.isMesh && mats.length < 8) {
              const m = Array.isArray(o.material) ? o.material[0] : o.material;
              mats.push({ n: o.name, c: m?.color?.getHexString?.(), skinned: !!o.isSkinnedMesh });
            }
            if (o.isBone && /arm|leg|shoulder/i.test(o.name) && bones.length < 8) {
              bones.push({ n: o.name, s: [o.scale.x, o.scale.y, o.scale.z].map((v) => +v.toFixed(3)) });
            }
          });
          anim = sample.mesh.userData?.mixer?._actions?.filter((a) => a.isRunning()).map((a) => a.getClip()?.name) || null;
        }
        document.documentElement.dataset.cspSnap = JSON.stringify({
          phase: round.phase,
          number: round.number,
          over: round.over,
          score: { ...score },
          bomb: bomb.state,
          enemies: enemies.filter((e) => e.alive).length,
          allies: allies.filter((e) => e.alive).length,
          gltf: !!sample?.mesh?.userData?.gltf,
          mats,
          bones,
          anim,
        });
      }
    };
    document.addEventListener("csp-cmd", onCspCmd);
    debugApi._onCspCmd = onCspCmd;

    const loop = (t) => {
      pump(t);
      if (running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    tickTimer = window.setInterval(() => {
      if (!running) return;
      if (performance.now() - last > 40) pump(performance.now());
    }, 33);

    canvas.addEventListener("click", onCanvasClick);
    if (!isTouchDevice()) {
      onToast?.(`Team ${team.toUpperCase()} · click to start`);
    } else {
      canvas.addEventListener(
        "pointerdown",
        () => {
          armed = true;
          SFX.unlock();
        },
        { once: true }
      );
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    clearInterval(tickTimer);
    canvas.removeEventListener("click", onCanvasClick);
    try {
      document.exitPointerLock?.();
    } catch {}
  }

  function destroy() {
    stop();
    input?.dispose?.();
    try {
      const h = window.CSP?._onCspCmd || window.cspApi?._onCspCmd;
      if (h) document.removeEventListener("csp-cmd", h);
    } catch {
      /* ignore */
    }
    for (const e of enemies) {
      e.tagEl?.remove();
      scene?.remove(e.mesh);
    }
    for (const e of allies) {
      e.tagEl?.remove();
      scene?.remove(e.mesh);
    }
    clearNametags();
    for (const b of bullets) scene?.remove(b.mesh);
    if (bombMesh) scene?.remove(bombMesh);
    world?.dispose();
    if (gun && camera) camera.remove(gun);
    renderer?.dispose();
  }

  function onResize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    fx?.setSize(w, h);
  }

  window.addEventListener("resize", onResize);

  return {
    start,
    stop,
    destroy,
    resetMatch,
    get input() {
      return input;
    },
    get debug() {
      return window.__csp;
    },
  };
}
