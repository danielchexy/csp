/** Keyboard / mouse / touch input */

export function createInput(canvas, settingsRef) {
  const keys = new Set();
  const look = { dx: 0, dy: 0 };
  const moveStick = { x: 0, y: 0 };
  let shooting = false;
  let aiming = false;
  let interacting = false;
  let pointerLocked = false;
  let jumpPressed = false;
  let dragLook = false;
  let lastDrag = null;
  let weaponSlotPressed = null;

  const disposers = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    disposers.push(() => target.removeEventListener(type, fn, opts));
  };

  const onKey = (e, down) => {
    const k = e.code || "";
    if (!k) return;
    if (down) keys.add(k);
    else keys.delete(k);
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyF", "KeyE", "KeyR"].includes(k)) {
      e.preventDefault();
    }
    if (down && k === "Space") jumpPressed = true;
    if (down && (k === "Digit1" || k === "Numpad1")) weaponSlotPressed = 1;
    if (down && (k === "Digit2" || k === "Numpad2")) weaponSlotPressed = 2;
    if (down && (k === "Digit3" || k === "Numpad3")) weaponSlotPressed = 3;
  };

  on(window, "keydown", (e) => onKey(e, true));
  on(window, "keyup", (e) => onKey(e, false));

  on(canvas, "mousedown", (e) => {
    if (e.button === 0) shooting = true;
    if (e.button === 2) {
      aiming = true;
      dragLook = true;
      lastDrag = { x: e.clientX, y: e.clientY };
    }
  });
  on(window, "mouseup", (e) => {
    if (e.button === 0) shooting = false;
    if (e.button === 2) {
      aiming = false;
      dragLook = false;
      lastDrag = null;
    }
  });
  on(canvas, "contextmenu", (e) => e.preventDefault());

  // Click-drag look fallback when pointer lock is unavailable
  on(canvas, "mousemove", (e) => {
    if (pointerLocked || !dragLook || !lastDrag) return;
    const sens = (settingsRef.current.sens ?? 1) * 1.2;
    const inv = settingsRef.current.invertY ? -1 : 1;
    look.dx += (e.clientX - lastDrag.x) * sens;
    // Drag up (clientY decreases) → negative dy → look up (see game.js)
    look.dy += (e.clientY - lastDrag.y) * sens * inv;
    lastDrag = { x: e.clientX, y: e.clientY };
  });

  on(document, "pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
  });

  on(window, "mousemove", (e) => {
    if (!pointerLocked) return;
    const sens = settingsRef.current.sens ?? 1;
    const inv = settingsRef.current.invertY ? -1 : 1;
    look.dx += e.movementX * sens;
    look.dy += e.movementY * sens * inv;
  });

  const stickEl = document.getElementById("stick");
  const knobEl = document.getElementById("stick-knob");
  const lookPad = document.getElementById("look-pad");
  const fireBtn = document.getElementById("fire-btn");
  const jumpBtn = document.getElementById("jump-btn");
  const aimBtn = document.getElementById("aim-btn");
  const useBtn = document.getElementById("use-btn");

  const bindHold = (el, setOn, setOff) => {
    if (!el) return;
    const start = (e) => {
      e.preventDefault();
      setOn();
    };
    const end = (e) => {
      e.preventDefault();
      setOff();
    };
    on(el, "pointerdown", start);
    on(el, "pointerup", end);
    on(el, "pointercancel", end);
    on(el, "pointerleave", end);
  };

  bindHold(fireBtn, () => (shooting = true), () => (shooting = false));
  bindHold(aimBtn, () => (aiming = true), () => (aiming = false));
  bindHold(useBtn, () => (interacting = true), () => (interacting = false));
  bindHold(jumpBtn, () => (jumpPressed = true), () => {});

  let stickId = null;
  if (stickEl) {
    on(stickEl, "pointerdown", (e) => {
      stickId = e.pointerId;
      stickEl.setPointerCapture(stickId);
      updateStick(e);
    });
    on(stickEl, "pointermove", (e) => {
      if (e.pointerId === stickId) updateStick(e);
    });
    const clearStick = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      moveStick.x = 0;
      moveStick.y = 0;
      if (knobEl) knobEl.style.transform = "translate(0,0)";
    };
    on(stickEl, "pointerup", clearStick);
    on(stickEl, "pointercancel", clearStick);
  }

  function updateStick(e) {
    const rect = stickEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (e.clientX - cx) / (rect.width * 0.5);
    let y = (e.clientY - cy) / (rect.height * 0.5);
    const mag = Math.hypot(x, y) || 1;
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    moveStick.x = x;
    moveStick.y = y;
    if (knobEl) knobEl.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
  }

  let lookId = null;
  let lastLook = null;
  if (lookPad) {
    on(lookPad, "pointerdown", (e) => {
      lookId = e.pointerId;
      lastLook = { x: e.clientX, y: e.clientY };
      lookPad.setPointerCapture(lookId);
    });
    on(lookPad, "pointermove", (e) => {
      if (e.pointerId !== lookId || !lastLook) return;
      const sens = (settingsRef.current.sens ?? 1) * 1.4;
      const inv = settingsRef.current.invertY ? -1 : 1;
      look.dx += (e.clientX - lastLook.x) * sens;
      look.dy += (e.clientY - lastLook.y) * sens * inv;
      lastLook = { x: e.clientX, y: e.clientY };
    });
    on(lookPad, "pointerup", () => {
      lookId = null;
      lastLook = null;
    });
  }

  return {
    keys,
    look,
    moveStick,
    get shooting() {
      return shooting;
    },
    get aiming() {
      // RMB / touch AIM only — E is plant/defuse
      return aiming;
    },
    get pointerLocked() {
      return pointerLocked;
    },
    requestLock() {
      if (!pointerLocked) canvas.requestPointerLock?.();
    },
    consumeJump() {
      const j = jumpPressed || keys.has("Space");
      jumpPressed = false;
      return j;
    },
    consumeLook() {
      const out = { dx: look.dx, dy: look.dy };
      look.dx = 0;
      look.dy = 0;
      return out;
    },
    movement() {
      let x = moveStick.x;
      let z = moveStick.y;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }
      const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
      return { x, z, sprint };
    },
    wantsReload() {
      return keys.has("KeyR");
    },
    wantsInteract() {
      return keys.has("KeyE") || interacting;
    },
    consumeWeaponSlot() {
      const s = weaponSlotPressed;
      weaponSlotPressed = null;
      return s;
    },
    dispose() {
      for (const off of disposers) off();
      disposers.length = 0;
      keys.clear();
    },
  };
}

export function isTouchDevice() {
  return matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}
