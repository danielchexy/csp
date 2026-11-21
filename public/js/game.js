import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GAME, QUALITY, BOMB } from "./config.js?v=csp38";
import { WEAPON_BY_ID } from "./weapons.js?v=csp38";
import { createWorld } from "./world.js?v=csp38";
import { createInput, isTouchDevice } from "./input.js?v=csp38";
import { SFX } from "./audio.js?v=csp38";
import { createComposer } from "./fx.js?v=csp38";
import {
  createBot,
  createViewmodel,
  updateBotPose,
  updateViewmodel,
  punchViewmodel,
  preloadSoldiers,
  createC4Mesh,
} from "./entities.js?v=csp38";

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

  const round = {
    timeLeft: BOMB.roundTime,
    over: false,
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
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();

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

  function spawnSide(list, count, side, spots) {
    for (const e of list) scene.remove(e.mesh);
    list.length = 0;
    for (let i = 0; i < count; i++) {
      const mesh = createBot(side);
      const spot = spots[i % spots.length];
      mesh.position.set(spot.x + (Math.random() - 0.5) * 2, 0, spot.z + (Math.random() - 0.5) * 2);
      scene.add(mesh);
      list.push({
        mesh,
        team: side,
        hp: 100,
        speed: 3.3 + Math.random() * 0.5,
        attackCd: 1 + Math.random(),
        alive: true,
        strafe: Math.random() > 0.5 ? 1 : -1,
        strafeT: 0,
        accuracy: 0.52 + Math.random() * 0.2,
        shootKick: 0,
        plantCd: 4 + Math.random() * 6,
        hasBomb: false,
        targetSite: Math.random() > 0.5 ? "A" : "B",
        path: null,
        pathIdx: 0,
        pathGoal: null,
        stuckT: 0,
        lastPos: mesh.position.clone(),
        repathT: 0,
      });
    }
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
    player.hp = GAME.maxHp;
    player.yaw = team === "t" ? Math.PI : 0;
    player.pitch = -0.05;
    player.velY = 0;
    player.mag = weapon.mag;
    player.reserve = weapon.reserve;
    player.weaponName = weapon.name;
    player.cooldown = 0;
    player.reloading = 0;
    player.reloadDur = 0;
    player.won = false;
    player.dead = false;
    player.spray = 0;
    player.punchPitch = 0;
    player.punchYaw = 0;
    armed = false;
    round.timeLeft = BOMB.roundTime;
    round.over = false;
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
    // Optional capture poses: #x=&z=&yaw=&pitch=&plant=A&advance=90
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
      if (adv > 0) {
        // Applied after __csp pump exists — stash for start()
        player._captureAdvance = adv;
      }
      // Capture: place showcase bots in front of camera (#bots=1)
      if (h.get("bots") === "1") {
        player._captureBots = true;
      }
    } catch {
      /* ignore bad hash */
    }
    spawnBots();
    if (player._captureBots) {
      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      const rx = Math.cos(player.yaw);
      const rz = -Math.sin(player.yaw);
      const pin = (e, ox, oz) => {
        if (!e) return;
        e.mesh.position.set(player.pos.x + fx * 2.6 + rx * ox, 0, player.pos.z + fz * 2.6 + rz * oz);
        e.mesh.lookAt(player.pos.x, 0, player.pos.z);
        e.speed = 0;
        e.path = null;
        e.patrol = e.mesh.position.clone();
        e.patrolT = 9999;
        e.stuckT = 0;
      };
      // CT left, T right — mid-range team read
      pin(enemies[0], -0.85, 0);
      pin(allies[0] || enemies[1], 0.85, 0);
      delete player._captureBots;
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
    if (round.over) return player.won ? "Round won" : "Round lost";
    if (player.dead) return "You are dead";
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
      roundTime: bomb.state === "planted" ? bomb.fuseLeft : round.timeLeft,
      ...extra,
    });
  }

  function endRound(win, reason) {
    // Explore softens combat — plant/defuse still run; rounds don't terminate
    if (GAME.explore) {
      onToast?.(reason || (win ? "Round would end (explore)" : "Round would end (explore)"));
      pushHud();
      return;
    }
    if (round.over) return;
    round.over = true;
    player.won = win;
    SFX[win ? "win" : "hurt"]();
    pushHud();
    onEnd?.({ win, reason, team });
    try {
      document.exitPointerLock?.();
    } catch {}
  }

  function aliveCount(list) {
    return list.filter((e) => e.alive).length;
  }

  function checkElim() {
    if (GAME.explore || round.over || player.dead) return;
    if (aliveCount(enemies) === 0) {
      if (bomb.state === "planted") {
        if (team === "ct") return;
        endRound(true, "Enemies eliminated — bomb live");
      } else {
        endRound(true, "Enemies eliminated");
      }
    }
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

  function updateBotList(list, isEnemy, dt) {
    for (const e of list) {
      if (!e.alive) continue;
      let goal = player.pos;
      if (GAME.explore) {
        // Patrol along nav waypoints — don't chase; still walk door gaps
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
          const site = world.sites[e.targetSite];
          goal = site.center;
        } else if (bomb.state === "planted") {
          goal = bomb.pos;
        } else {
          let nearest = null;
          for (const en of enemies) {
            if (!en.alive) continue;
            const d = en.mesh.position.distanceTo(e.mesh.position);
            if (!nearest || d < nearest.d) nearest = { d, p: en.mesh.position };
          }
          if (nearest) goal = nearest.p;
        }
      }

      // T enemy with bomb: go plant (works in explore for plant testing)
      if (isEnemy && e.hasBomb && (bomb.state === "carried_bot" || bomb.state === "idle")) {
        const site = world.sites[e.targetSite];
        goal = site.center;
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
      const dir = dist > 0.001 ? toGoal.multiplyScalar(1 / dist) : new THREE.Vector3(0, 0, 1);
      const distFinal = Math.hypot(goal.x - e.mesh.position.x, goal.z - e.mesh.position.z);

      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafe *= -1;
        e.strafeT = 0.8 + Math.random() * 1.2;
      }
      e.shootKick = Math.max(0, e.shootKick - dt * 4);

      e.mesh.lookAt(waypoint.x, e.mesh.position.y, waypoint.z);

      let moving = false;
      const before = e.lastPos;
      const spd = GAME.explore ? e.speed * 0.55 : e.speed;
      const prefer = GAME.explore ? 1.4 : isEnemy ? 10 + Math.random() * 4 : 6;
      // Light strafe only when not pathing through doors (avoids wall scrapes)
      const strafeAmt = e.path && e.pathIdx < (e.path.length - 1) ? 0.08 : 0.32;
      if (distFinal > prefer) {
        e.mesh.position.addScaledVector(dir, spd * dt);
        e.mesh.position.x += -dir.z * e.strafe * spd * strafeAmt * dt;
        e.mesh.position.z += dir.x * e.strafe * spd * strafeAmt * dt;
        moving = true;
      } else if (!GAME.explore && isEnemy && distFinal < 6) {
        e.mesh.position.addScaledVector(dir, -spd * 0.4 * dt);
        moving = true;
      } else if (!GAME.explore) {
        e.mesh.position.x += -dir.z * e.strafe * spd * 0.45 * dt;
        e.mesh.position.z += dir.x * e.strafe * spd * 0.45 * dt;
        moving = true;
      }
      world.resolveCollision(e.mesh.position, 0.42);
      e.mesh.position.y = 0;

      // Stuck recovery — repath or warp to next open nav node
      const moved = Math.hypot(e.mesh.position.x - before.x, e.mesh.position.z - before.z);
      if (moving && moved < 0.02) {
        e.stuckT = (e.stuckT || 0) + dt;
        if (e.stuckT > 1.2) {
          e.stuckT = 0;
          botSetGoal(e, goal, true);
          const graph = world.navGraph || [];
          if (graph.length) {
            const ni = world.nearestNav?.(e.mesh.position.x, e.mesh.position.z) ?? 0;
            const nbs = graph[ni]?.neighbors || [];
            if (nbs.length) {
              const n = graph[nbs[(Math.random() * nbs.length) | 0]];
              e.mesh.position.x = n.x;
              e.mesh.position.z = n.z;
              world.resolveCollision(e.mesh.position, 0.42);
            }
          }
        }
      } else {
        e.stuckT = 0;
      }
      e.lastPos.copy(e.mesh.position);

      updateBotPose(e.mesh, dt, {
        moving,
        aiming: !GAME.explore && distFinal < 30,
        shootKick: e.shootKick,
      });

      // Shoot at player (disabled in explore)
      if (GAME.explore || !isEnemy || round.over || !armed) continue;
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
    if (!GAME.explore && !isEnemy) {
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

    // Timers
    if (!round.over) {
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
      scene.environmentIntensity = 0.45;
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
    window.__csp = debugApi;
    globalThis.__csp = debugApi;
    window.CSP = debugApi;
    // Also hang off the canvas — some automation worlds miss window.* from modules
    try {
      canvas.__csp = debugApi;
      canvas.setAttribute("data-csp", "1");
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.cspReady = "1";
    document.body?.setAttribute("data-csp-live", "1");

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
    for (const e of enemies) scene?.remove(e.mesh);
    for (const e of allies) scene?.remove(e.mesh);
    for (const b of bullets) scene?.remove(b.mesh);
    if (bombMesh) scene?.remove(bombMesh);
    world?.dispose();
    if (gun && camera) camera.remove(gun);
    renderer?.dispose();
    // Keep window.__csp for capture tooling; next start() replaces it
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
