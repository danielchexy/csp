import { CAPS, QUALITY, loadSettings, saveSettings, makeRoomCode } from "./config.js?v=csp62";
import {
  WEAPONS,
  loadLoadout,
  saveLoadout,
  buyWeapon,
  equipWeapon,
  getEquippedWeapon,
} from "./weapons.js?v=csp62";
import { createGame } from "./game.js?v=csp62";
import { isTouchDevice } from "./input.js?v=csp62";
import { SFX } from "./audio.js?v=csp62";

const settingsRef = { current: loadSettings() };
let loadout = loadLoadout();
let game = null;
let pendingRoom = null;
let selectedTeam = "t";
let shopFilter = "all";

const els = {
  hud: document.getElementById("hud"),
  canvas: document.getElementById("game-canvas"),
  touch: document.getElementById("touch-layer"),
  pauseBtn: document.getElementById("pause-btn"),
  toast: document.getElementById("toast"),
  hpBar: document.getElementById("hp-bar"),
  ammo: document.getElementById("ammo"),
  weaponName: document.getElementById("weapon-name"),
  objective: document.getElementById("objective"),
  damage: document.getElementById("damage-vignette"),
  teamBadge: document.getElementById("team-badge"),
  endTitle: document.getElementById("end-title"),
  endBody: document.getElementById("end-body"),
  roomTitle: document.getElementById("room-title"),
  roomBody: document.getElementById("room-body"),
  roomCodeInput: document.getElementById("room-code-input"),
  quality: document.getElementById("quality-select"),
  sens: document.getElementById("sens-range"),
  sensVal: document.getElementById("sens-val"),
  invertY: document.getElementById("invert-y"),
  shopCoins: document.getElementById("shop-coins"),
  shopList: document.getElementById("shop-list"),
  menuLoadout: document.getElementById("menu-loadout"),
  crosshair: document.querySelector(".crosshair"),
  scoreT: document.getElementById("score-t"),
  scoreCT: document.getElementById("score-ct"),
  roundNum: document.getElementById("round-num"),
  scoreClock: document.getElementById("score-clock"),
  roundBanner: document.getElementById("round-banner"),
  roundBannerTitle: document.getElementById("round-banner-title"),
  roundBannerSub: document.getElementById("round-banner-sub"),
  playerChip: document.getElementById("player-chip"),
  displayName: document.getElementById("display-name"),
};

function showScreen(name) {
  for (const s of document.querySelectorAll(".screen")) s.classList.remove("active");
  if (name) document.getElementById(name)?.classList.add("active");
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function setHudActive(on) {
  els.hud.classList.toggle("active", on);
  els.pauseBtn.classList.toggle("active", on);
  els.touch.classList.toggle("active", on && isTouchDevice());
  if (!on && els.crosshair) els.crosshair.style.setProperty("--spread", "0px");
}

function fmtClock(t) {
  const s = Math.max(0, Math.ceil(Number(t) || 0));
  const m = (s / 60) | 0;
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function onHud(data) {
  if (data.hp != null) {
    els.hpBar.style.transform = `scaleX(${Math.max(0, Math.min(100, data.hp)) / 100})`;
  }
  if (data.mag != null) {
    els.ammo.textContent = data.reloading ? "REL…" : `${data.mag} / ${data.reserve}`;
  }
  if (data.weapon && els.weaponName) els.weaponName.textContent = data.weapon;
  if (data.objective) els.objective.textContent = data.objective;
  if (data.team && els.teamBadge) {
    els.teamBadge.textContent = data.team.toUpperCase();
    els.teamBadge.dataset.team = data.team;
  }
  if (data.spray != null && els.crosshair) {
    const px = Math.min(14, Number(data.spray) * 0.9);
    els.crosshair.style.setProperty("--spread", `${px}px`);
  }
  if (data.damageFlash) {
    els.damage.style.opacity = "1";
    setTimeout(() => (els.damage.style.opacity = "0"), 180);
  }
  if (data.scoreT != null && els.scoreT) els.scoreT.textContent = String(data.scoreT);
  if (data.scoreCT != null && els.scoreCT) els.scoreCT.textContent = String(data.scoreCT);
  if (data.roundNumber != null && els.roundNum) els.roundNum.textContent = `R${data.roundNumber}`;
  if (data.roundTime != null && els.scoreClock) {
    els.scoreClock.textContent = fmtClock(data.roundTime);
    els.scoreClock.dataset.phase = data.phase || "";
  }
  if (data.playerName && els.playerChip) els.playerChip.textContent = data.playerName;
  if (data.roundBanner === null && els.roundBanner) {
    els.roundBanner.hidden = true;
  } else if (data.roundBanner && els.roundBanner) {
    els.roundBanner.hidden = false;
    if (els.roundBannerTitle) els.roundBannerTitle.textContent = data.roundBanner.title || "";
    if (els.roundBannerSub) els.roundBannerSub.textContent = data.roundBanner.sub || "";
  }
}

function fmtCoins(n) {
  return `${Number(n).toLocaleString()} ¢`;
}

function refreshMenuLoadout() {
  loadout = loadLoadout();
  const gun = getEquippedWeapon(loadout);
  if (els.menuLoadout) {
    els.menuLoadout.innerHTML = `Loadout · <strong>${gun.name}</strong> · ${fmtCoins(loadout.coins)}`;
  }
}

function renderShop() {
  loadout = loadLoadout();
  els.shopCoins.textContent = fmtCoins(loadout.coins);
  els.shopList.innerHTML = "";

  const list =
    shopFilter === "all" ? WEAPONS : WEAPONS.filter((w) => w.slot === shopFilter);

  for (const w of list) {
    const owned = loadout.owned.includes(w.id);
    const equipped = loadout.equipped === w.id;
    const row = document.createElement("div");
    row.className = "shop-row" + (equipped ? " equipped" : "");
    row.innerHTML = `
      <div>
        <div class="name">${w.name}</div>
        <div class="price">${w.price <= 0 ? "FREE" : fmtCoins(w.price)} · ${w.slot}</div>
      </div>
      <div class="actions"></div>
      <div class="meta">${w.desc} · ${w.mag}/${w.reserve} · ${w.automatic ? "auto" : "semi"}</div>
    `;
    const actions = row.querySelector(".actions");
    if (!owned) {
      const buy = document.createElement("button");
      buy.className = "btn primary";
      buy.type = "button";
      buy.textContent = "Buy & equip";
      buy.disabled = loadout.coins < w.price;
      buy.addEventListener("click", () => {
        const res = buyWeapon(loadout, w.id);
        if (!res.ok) {
          toast(res.reason);
          return;
        }
        SFX.click();
        toast(`${w.name} equipped`);
        refreshMenuLoadout();
        renderShop();
      });
      actions.appendChild(buy);
    } else if (equipped) {
      const tag = document.createElement("button");
      tag.className = "btn";
      tag.type = "button";
      tag.textContent = "Equipped";
      tag.disabled = true;
      actions.appendChild(tag);
    } else {
      const eq = document.createElement("button");
      eq.className = "btn primary";
      eq.type = "button";
      eq.textContent = "Equip";
      eq.addEventListener("click", () => {
        equipWeapon(loadout, w.id);
        SFX.click();
        toast(`Equipped ${w.name}`);
        refreshMenuLoadout();
        renderShop();
      });
      actions.appendChild(eq);
    }
    els.shopList.appendChild(row);
  }
}

function openShop() {
  SFX.click();
  shopFilter = "all";
  for (const t of document.querySelectorAll(".shop-tab")) {
    t.classList.toggle("active", t.dataset.slot === "all");
  }
  renderShop();
  showScreen("shop-screen");
}

async function startMatch(team) {
  selectedTeam = team;
  loadout = loadLoadout();
  const gun = getEquippedWeapon(loadout);
  const name = (els.displayName?.value || settingsRef.current.displayName || "Player").trim().slice(0, 16) || "Player";
  settingsRef.current.displayName = name;
  saveSettings(settingsRef.current);
  SFX.click();
  SFX.unlock();
  pendingRoom = null;
  showScreen(null);
  setHudActive(true);
  if (els.roundBanner) els.roundBanner.hidden = true;
  game?.destroy();
  try {
    game = createGame({
      canvas: els.canvas,
      settingsRef,
      playerTeam: team,
      weaponId: gun.id,
      ownedIds: loadout.owned,
      onHud,
      onToast: toast,
      onEnd: (result) => {
        setHudActive(false);
        document.getElementById("nametag-layer") && (document.getElementById("nametag-layer").innerHTML = "");
        if (result.win) {
          loadout = loadLoadout();
          loadout.coins += result.match ? 1500 : 500;
          saveLoadout(loadout);
          refreshMenuLoadout();
        }
        const sc = result.score ? ` · T ${result.score.t}–${result.score.ct} CT` : "";
        els.endTitle.textContent = result.match
          ? result.win
            ? "Match victory"
            : "Match defeat"
          : result.win
            ? "Victory"
            : "Defeat";
        els.endBody.textContent =
          (result.reason || (result.win ? "Your team won." : "Your team lost.")) +
          sc +
          (result.win ? (result.match ? " · +1500 ¢" : " · +500 ¢") : "");
        showScreen("end-screen");
      },
    });
    await game.start();
    window.__csp = game.debug || window.__csp || document.documentElement.__csp;
    window.__cspGame = game;
    document.documentElement.dataset.cspReady = window.__csp ? "1" : "0";
    window.__cspErr = window.__csp ? null : "start finished but __csp missing";
  } catch (err) {
    window.__cspErr = String(err?.stack || err);
    document.documentElement.dataset.cspErr = window.__cspErr.slice(0, 200);
    console.error(err);
    toast("Start failed — see console");
  }
  toast(`${gun.name} · 1/2/3 to swap`);
}

function openSettings() {
  SFX.click();
  els.quality.value = settingsRef.current.quality;
  els.sens.value = String(settingsRef.current.sens);
  els.sensVal.textContent = Number(settingsRef.current.sens).toFixed(1);
  els.invertY.checked = !!settingsRef.current.invertY;
  showScreen("settings-screen");
}

function saveSettingsFromUi() {
  settingsRef.current = {
    quality: els.quality.value,
    sens: Number(els.sens.value),
    invertY: els.invertY.checked,
    lookV: settingsRef.current.lookV ?? 6,
  };
  saveSettings(settingsRef.current);
  SFX.click();
  toast(`Saved · ${QUALITY[settingsRef.current.quality].label}`);
  showScreen("menu-screen");
}

function createRoomStub() {
  SFX.click();
  const code = makeRoomCode();
  pendingRoom = code;
  els.roomTitle.textContent = "Room created (stub)";
  els.roomBody.innerHTML = `Code <strong>${code}</strong><br/>Multiplayer later. Cap ${CAPS.MAX_ROOMS} rooms · ${CAPS.MAX_PLAYERS} players.`;
  showScreen("room-screen");
}

function joinRoomStub() {
  SFX.click();
  const code = (els.roomCodeInput.value || "").trim().toUpperCase();
  if (code.length < 4) {
    toast("Enter a room code");
    return;
  }
  pendingRoom = code;
  els.roomTitle.textContent = "Join room (stub)";
  els.roomBody.innerHTML = `Would join <strong>${code}</strong>. Pick a team and play offline for now.`;
  showScreen("room-screen");
}

function backMenu() {
  SFX.click();
  game?.destroy();
  game = null;
  setHudActive(false);
  refreshMenuLoadout();
  showScreen("menu-screen");
}

async function toggleFullscreen() {
  SFX.click();
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      screen.orientation?.lock?.("landscape").catch(() => {});
    } else {
      await document.exitFullscreen?.();
    }
  } catch {
    toast("Fullscreen blocked — try Add to Home Screen on iOS");
  }
}

document.getElementById("btn-play-t").addEventListener("click", () => startMatch("t"));
document.getElementById("btn-play-ct").addEventListener("click", () => startMatch("ct"));
document.getElementById("btn-shop").addEventListener("click", openShop);
document.getElementById("btn-shop-back").addEventListener("click", () => {
  SFX.click();
  refreshMenuLoadout();
  showScreen("menu-screen");
});
document.getElementById("shop-tabs")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".shop-tab");
  if (!btn) return;
  shopFilter = btn.dataset.slot || "all";
  for (const t of document.querySelectorAll(".shop-tab")) {
    t.classList.toggle("active", t === btn);
  }
  SFX.click();
  renderShop();
});
document.getElementById("btn-settings").addEventListener("click", openSettings);
document.getElementById("btn-fullscreen").addEventListener("click", toggleFullscreen);
document.getElementById("btn-create-room").addEventListener("click", createRoomStub);
document.getElementById("btn-join-room").addEventListener("click", joinRoomStub);
document.getElementById("btn-settings-save").addEventListener("click", saveSettingsFromUi);
document.getElementById("btn-settings-back").addEventListener("click", () => {
  SFX.click();
  showScreen("menu-screen");
});
document.getElementById("btn-room-play-t").addEventListener("click", () => startMatch("t"));
document.getElementById("btn-room-play-ct").addEventListener("click", () => startMatch("ct"));
document.getElementById("btn-room-back").addEventListener("click", backMenu);
document.getElementById("btn-end-again").addEventListener("click", () => startMatch(selectedTeam));
document.getElementById("btn-end-menu").addEventListener("click", backMenu);
els.pauseBtn.addEventListener("click", () => {
  game?.destroy();
  game = null;
  setHudActive(false);
  refreshMenuLoadout();
  showScreen("menu-screen");
  toast("Returned to menu");
});
els.sens.addEventListener("input", () => {
  els.sensVal.textContent = Number(els.sens.value).toFixed(1);
});

if (els.displayName) els.displayName.value = settingsRef.current.displayName || "Player";
refreshMenuLoadout();
showScreen("menu-screen");
toast(`CSP · ${fmtCoins(loadout.coins)}`);
