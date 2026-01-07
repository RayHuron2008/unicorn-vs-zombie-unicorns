 /* =========================================================
   Unicorn vs Zombie Unicorns — v22
   Adds: Health bar (HP) + keeps 3 lives
   - Lasers + contact now reduce HP
   - When HP reaches 0, lose 1 life, HP refills, brief invuln
   - When lives reach 0, restart game
   ========================================================= */

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width = 960;
  const H = canvas.height = 540;

  const elLives = document.getElementById("lives");
  const elScore = document.getElementById("score");
  const elPowerFill = document.getElementById("powerFill");
  const elPowerLabel = document.getElementById("powerLabel");
  const elTime = document.getElementById("time");

  const joystick = document.getElementById("joystick");
  const stick = document.getElementById("stick");
  const btnA = document.getElementById("btnA");
  const btnB = document.getElementById("btnB");

  // ---------- AUDIO ----------
  const MUSIC_MAIN = "bgm_main.mp3.mp3"; // change if needed
  const audio = { main: new Audio(MUSIC_MAIN), unlocked: false, started: false };
  audio.main.loop = true;
  audio.main.volume = 0.55;

  function tryStartMusic() {
    if (audio.started) return;
    audio.started = true;
    audio.main.play().catch(() => { audio.started = false; });
  }
  function unlockAudio() {
    if (audio.unlocked) return;
    audio.unlocked = true;
    tryStartMusic();
  }
  window.addEventListener("touchstart", unlockAudio, { passive: true });
  window.addEventListener("mousedown", unlockAudio);

  // ---------- TUNING ----------
  const GROUND_Y = H - 90;
  const PLAYER_Y_MIN = GROUND_Y - 40;
  const PLAYER_Y_MAX = GROUND_Y;

  const MAX_ENEMIES = 4;
  const MAX_RAY_ENEMIES_ALIVE = 1;

  const STAGE_TIME_SEC_TEST = 60;
  const FINAL_RAY_ENEMIES = 2;

  const PLAYER_BASE_SPEED = 240;
  const ENEMY_BASE_SPEED = 90;

  const HEADBUTT_RANGE = 42;
  const HEADBUTT_COOLDOWN = 0.28;

  const INVULN_AFTER_HIT = 0.65; // short invuln between damage ticks
  const INVULN_AFTER_LIFE_LOST = 1.0;

  const RAY_DURATION = 10.0;
  const GIANT_DURATION = 20.0;

  // HEALTH
  const HP_MAX = 100;
  const DMG_LASER = 20;
  const DMG_CONTACT = 35;

  // ---------- INPUT ----------
  const input = { dx: 0, dy: 0, a: false, b: false };
  const keys = {};
  window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; unlockAudio(); });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

  let joyActive = false;
  let joyCenter = null;

  function getTouchPos(touch) {
    const r = joystick.getBoundingClientRect();
    return { x: touch.clientX - r.left, y: touch.clientY - r.top, r };
  }
  function setStick(x, y) { if (stick) stick.style.transform = `translate(${x}px, ${y}px)`; }
  function handleJoystickMove(px, py, radius) {
    const dx = px - joyCenter.x;
    const dy = py - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const max = radius;
    const ndx = dist > 0 ? dx / dist : 0;
    const ndy = dist > 0 ? dy / dist : 0;
    const clamped = Math.min(dist, max);
    setStick(ndx * clamped, ndy * clamped);
    input.dx = ndx * Math.min(1, clamped / max);
    input.dy = ndy * Math.min(1, clamped / max);
  }

  if (joystick) {
    joystick.addEventListener("touchstart", (e) => {
      unlockAudio();
      joyActive = true;
      const t = e.touches[0];
      const p = getTouchPos(t);
      joyCenter = { x: p.r.width / 2, y: p.r.height / 2 };
      handleJoystickMove(p.x, p.y, Math.min(p.r.width, p.r.height) * 0.38);
    }, { passive: false });

    joystick.addEventListener("touchmove", (e) => {
      if (!joyActive) return;
      const t = e.touches[0];
      const p = getTouchPos(t);
      handleJoystickMove(p.x, p.y, Math.min(p.r.width, p.r.height) * 0.38);
      e.preventDefault();
    }, { passive: false });

    joystick.addEventListener("touchend", () => {
      joyActive = false;
      input.dx = 0;
      input.dy = 0;
      setStick(0, 0);
    });
  }

  function bindButton(el, downFn, upFn) {
    if (!el) return;
    el.addEventListener("touchstart", (e) => { unlockAudio(); downFn(); e.preventDefault(); }, { passive: false });
    el.addEventListener("touchend", (e) => { upFn(); e.preventDefault(); }, { passive: false });
    el.addEventListener("mousedown", () => { unlockAudio(); downFn(); });
    el.addEventListener("mouseup", upFn);
    el.addEventListener("mouseleave", upFn);
  }
  bindButton(btnA, () => (input.a = true), () => (input.a = false));
  bindButton(btnB, () => (input.b = true), () => (input.b = false));

  // ---------- HELPERS ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function rectsOverlap(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h / 2 < b.y + b.h / 2 &&
      a.y + a.h / 2 > b.y - b.h / 2
    );
  }

  // ---------- STATE ----------
  const state = {
    t: 0,
    dt: 0,
    lastTime: performance.now(),
    mode: "PLAY", // PLAY | FINAL_WAVE | TALK | MOUNT | FIREWORKS_PREP | FIREWORKS | VICTORY
    stageTimer: STAGE_TIME_SEC_TEST,
    finalSpawned: false,
    _shootCd: 0,
    _fwCd: 0,
    _exitTimer: 0,

    player: {
      x: 140,
      y: GROUND_Y,
      w: 46,
      h: 34,
      dir: 1,
      speed: PLAYER_BASE_SPEED,
      lives: 3,
      hp: HP_MAX,
      invuln: 0,
      score: 0,
      headbuttCd: 0,
      headbutting: 0,
      ray: 0,
      giant: 0,
      normalKillsSincePower: 0,
    },

    enemies: [],
    bullets: [],
    rays: [],
    effects: [],

    human: { active: false, x: W + 80, y: GROUND_Y, w: 22, h: 42, vx: -240, state: "OFF", talkTimer: 0 },
    dialog: { active: false, text: "You killed all of the zombies here!\nThank you! I was so scared.", timer: 0 },

    fireworks: { active: false, timer: 0, bursts: [] },
  };

  // ---------- SPAWN ----------
  function countRayEnemiesAlive() { return state.enemies.filter(e => e.type === "RAY").length; }

  function spawnEnemy(type = "NORMAL") {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -40 : W + 40;
    const y = rand(PLAYER_Y_MIN + 6, PLAYER_Y_MAX);

    state.enemies.push({
      x, y,
      w: 46, h: 34,
      vx: fromLeft ? ENEMY_BASE_SPEED : -ENEMY_BASE_SPEED,
      hp: type === "RAY" ? 3 : 1,
      type,
      shootCd: rand(0.8, 1.4),
    });
  }

  function trySpawn() {
    if (state.mode !== "PLAY") return;
    if (state.enemies.length >= MAX_ENEMIES) return;

    const wantRay = Math.random() < 0.12;
    if (wantRay) {
      if (countRayEnemiesAlive() >= MAX_RAY_ENEMIES_ALIVE) spawnEnemy("NORMAL");
      else spawnEnemy("RAY");
    } else spawnEnemy("NORMAL");
  }

  let spawnAccum = 0;

  // ---------- COMBAT ----------
  function doHeadbutt() {
    const p = state.player;
    if (p.headbuttCd > 0) return;
    p.headbuttCd = HEADBUTT_COOLDOWN;
    p.headbutting = 0.12;

    const hb = {
      x: p.x + p.dir * (p.w / 2 + HEADBUTT_RANGE / 2),
      y: p.y,
      w: HEADBUTT_RANGE,
      h: p.h
    };

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (rectsOverlap(hb, eb)) killEnemy(i);
    }
  }

  function firePlayerRay() {
    const p = state.player;
    if (p.ray <= 0) return;

    const speed = 520;
    state.bullets.push({
      x: p.x + p.dir * (p.w / 2 + 10),
      y: p.y - 8,
      vx: p.dir * speed,
      vy: 0,
      r: p.giant > 0 ? 10 : 6,
      t: 0
    });

    for (let k = 0; k < 8; k++) {
      state.effects.push({ x: p.x, y: p.y - 8, vx: rand(-60, 60), vy: rand(-80, 10), life: rand(0.25, 0.45), hue: rand(0, 360) });
    }
  }

  function killEnemy(index) {
    const p = state.player;
    const e = state.enemies[index];

    for (let k = 0; k < 18; k++) {
      state.effects.push({ x: e.x, y: e.y, vx: rand(-160, 160), vy: rand(-200, 60), life: rand(0.35, 0.65), hue: e.type === "RAY" ? rand(0, 360) : rand(330, 30) });
    }

    p.score += e.type === "RAY" ? 40 : 10;

    const poweredNow = (p.ray > 0 || p.giant > 0);

    if (e.type === "RAY" && !poweredNow && p.ray <= 0) p.ray = RAY_DURATION;

    if (!poweredNow) {
      p.normalKillsSincePower++;
      if (p.normalKillsSincePower >= 20) {
        p.normalKillsSincePower = 0;
        p.giant = GIANT_DURATION;
      }
    }

    state.enemies.splice(index, 1);

    if (state.mode === "FINAL_WAVE" && state.enemies.length === 0) startTalkSequence();
  }

  // DAMAGE -> HP -> LIFE
  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return;

    p.hp -= amount;
    p.invuln = INVULN_AFTER_HIT;

    for (let k = 0; k < 10; k++) {
      state.effects.push({ x: p.x, y: p.y, vx: rand(-180, 180), vy: rand(-240, 40), life: rand(0.25, 0.45), hue: rand(0, 360) });
    }

    if (p.hp <= 0) {
      p.lives -= 1;
      if (p.lives <= 0) {
        restartGame();
        return;
      }
      // reset hp for next life
      p.hp = HP_MAX;
      p.invuln = INVULN_AFTER_LIFE_LOST;
      // small knockback
      p.x = clamp(p.x - p.dir * 40, 30, W - 30);
    }
  }

  function restartGame() {
    const p = state.player;

    state.mode = "PLAY";
    state.stageTimer = STAGE_TIME_SEC_TEST;
    state.finalSpawned = false;
    spawnAccum = 0;

    p.x = 140; p.y = GROUND_Y; p.dir = 1;
    p.lives = 3;
    p.hp = HP_MAX;
    p.invuln = 0;
    p.score = 0;
    p.headbuttCd = 0;
    p.headbutting = 0;
    p.ray = 0;
    p.giant = 0;
    p.normalKillsSincePower = 0;

    state.enemies.length = 0;
    state.bullets.length = 0;
    state.rays.length = 0;
    state.effects.length = 0;

    state.human.active = false;
    state.human.state = "OFF";
    state.dialog.active = false;

    state.fireworks.active = false;
    state.fireworks.timer = 0;
    state.fireworks.bursts.length = 0;

    trySpawn();
  }

  // ---------- ENDING ----------
  function startFinalWave() {
    state.mode = "FINAL_WAVE";
    state.finalSpawned = true;

    let add = FINAL_RAY_ENEMIES;
    const interval = setInterval(() => {
      if (state.mode !== "FINAL_WAVE") return clearInterval(interval);
      if (add <= 0) return clearInterval(interval);
      if (state.enemies.length < MAX_ENEMIES) { spawnEnemy("RAY"); add--; }
    }, 650);
  }

  function startTalkSequence() {
    state.mode = "TALK";
    state.human.active = true;
    state.human.x = W + 80;
    state.human.y = GROUND_Y;
    state.human.vx = -280;
    state.human.state = "RUNIN";
    state.dialog.active = false;
    state.dialog.timer = 0;
  }

  function startMountAndExit() {
    state.mode = "MOUNT";
    state.human.state = "MOUNT";
    state.human.talkTimer = 0.9;
  }

  function startFireworks() {
    state.mode = "FIREWORKS";
    state.fireworks.active = true;
    state.fireworks.timer = 2.8;
    state.fireworks.bursts.length = 0;
  }

  function startVictory() { state.mode = "VICTORY"; }

  // ---------- UPDATE ----------
  function update(dt) {
    state.t += dt;
    const p = state.player;

    // movement input (keyboard overrides)
    let kdx = 0, kdy = 0;
    if (keys["arrowleft"] || keys["a"]) kdx -= 1;
    if (keys["arrowright"] || keys["d"]) kdx += 1;
    if (keys["arrowup"] || keys["w"]) kdy -= 1;
    if (keys["arrowdown"] || keys["s"]) kdy += 1;

    let dx = input.dx, dy = input.dy;
    if (kdx || kdy) {
      const mag = Math.hypot(kdx, kdy) || 1;
      dx = kdx / mag; dy = kdy / mag;
    }

    if (input.a || keys[" "]) doHeadbutt();

    // shoot
    const wantShoot = input.b || keys["enter"];
    state._shootCd -= dt;
    if (wantShoot && state._shootCd <= 0) {
      firePlayerRay();
      state._shootCd = 0.18;
    }

    // cooldowns
    p.headbuttCd = Math.max(0, p.headbuttCd - dt);
    p.headbutting = Math.max(0, p.headbutting - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    // powerups
    if (p.ray > 0) p.ray = Math.max(0, p.ray - dt);
    if (p.giant > 0) p.giant = Math.max(0, p.giant - dt);

    // move player
    const speed = p.speed * (p.giant > 0 ? 1.08 : 1);
    p.x += dx * speed * dt;
    p.y += dy * speed * 0.65 * dt;
    p.x = clamp(p.x, 30, W - 30);
    p.y = clamp(p.y, PLAYER_Y_MIN, PLAYER_Y_MAX);
    if (Math.abs(dx) > 0.15) p.dir = dx > 0 ? 1 : -1;

    // stage timer
    if (state.mode === "PLAY") {
      state.stageTimer -= dt;
      if (state.stageTimer <= 0) { state.stageTimer = 0; startFinalWave(); }
    }

    // spawning
    if (state.mode === "PLAY") {
      spawnAccum += dt;
      if (spawnAccum >= 1.15) { spawnAccum = 0; trySpawn(); }
    }

    // enemies update + contact damage
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      e.y = clamp(e.y, PLAYER_Y_MIN + 6, PLAYER_Y_MAX);
      e.x += e.vx * dt;

      const edir = e.vx >= 0 ? 1 : -1;

      // ray shooting
      if (e.type === "RAY") {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = rand(1.0, 1.55);
          const ang = Math.atan2((p.y - 8) - (e.y - 8), p.x - e.x);
          const sp = 360;
          state.rays.push({
            x: e.x + edir * (e.w / 2 + 8),
            y: e.y - 8,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            r: 7,
            t: 0,
            hue: rand(0, 360)
          });
        }
      }

      const pb = { x: p.x, y: p.y, w: p.w * (p.giant > 0 ? 1.25 : 1), h: p.h * (p.giant > 0 ? 1.25 : 1) };
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };

      if (rectsOverlap(pb, eb)) {
        if (p.headbutting > 0) {
          killEnemy(i);
        } else {
          damagePlayer(DMG_CONTACT);
          p.x -= (e.vx > 0 ? 1 : -1) * 18;
        }
      }

      // mild separation to reduce clustering
      for (let j = 0; j < state.enemies.length; j++) {
        if (j === i) continue;
        const o = state.enemies[j];
        if (Math.abs(o.x - e.x) < 38 && Math.abs(o.y - e.y) < 18) e.x += (e.x < o.x ? -1 : 1) * 18 * dt;
      }
    }

    // player bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.t += dt;
      b.x += b.vx * dt;

      for (let k = state.enemies.length - 1; k >= 0; k--) {
        const e = state.enemies[k];
        const dx = e.x - b.x;
        const dy = (e.y - 8) - b.y;
        const rr = (b.r + 18);
        if (dx * dx + dy * dy <= rr * rr) {
          e.hp -= (p.giant > 0 ? 2 : 1);
          for (let s = 0; s < 8; s++) state.effects.push({ x: b.x, y: b.y, vx: rand(-140, 140), vy: rand(-200, 40), life: rand(0.2, 0.35), hue: rand(0, 360) });
          state.bullets.splice(i, 1);
          if (e.hp <= 0) killEnemy(k);
          break;
        }
      }

      if (b.x < -120 || b.x > W + 120) state.bullets.splice(i, 1);
    }

    // enemy rays -> DAMAGE HP
    for (let i = state.rays.length - 1; i >= 0; i--) {
      const r = state.rays[i];
      r.t += dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;

      state.effects.push({ x: r.x, y: r.y, vx: rand(-40, 40), vy: rand(-40, 40), life: 0.18, hue: r.hue });

      const pb = { x: p.x, y: p.y - 6, w: p.w * (p.giant > 0 ? 1.25 : 1), h: p.h * (p.giant > 0 ? 1.25 : 1) };
      const rb = { x: r.x, y: r.y, w: r.r * 2, h: r.r * 2 };
      if (rectsOverlap(pb, rb)) {
        damagePlayer(DMG_LASER);
        state.rays.splice(i, 1);
        continue;
      }

      if (r.x < -140 || r.x > W + 140 || r.y < -140 || r.y > H + 140) state.rays.splice(i, 1);
    }

    // effects
    for (let i = state.effects.length - 1; i >= 0; i--) {
      const fx = state.effects[i];
      fx.life -= dt;
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.vy += 380 * dt;
      if (fx.life <= 0) state.effects.splice(i, 1);
    }

    // ending flow
    if (state.mode === "TALK") {
      const h = state.human;
      if (h.active && h.state === "RUNIN") {
        h.x += h.vx * dt;
        const stopX = p.x + 110;
        if (h.x <= stopX) {
          h.x = stopX;
          h.vx = 0;
          h.state = "TALK";
          state.dialog.active = true;
          state.dialog.timer = 2.4;
        }
      }

      if (state.dialog.active) {
        state.dialog.timer -= dt;
        if (state.dialog.timer <= 0) {
          state.dialog.active = false;
          startMountAndExit();
        }
      }
    }

    if (state.mode === "MOUNT") {
      state.human.talkTimer -= dt;
      if (state.human.talkTimer <= 0) {
        state.mode = "FIREWORKS_PREP";
        state._exitTimer = 1.2;
      }
    }

    if (state.mode === "FIREWORKS_PREP") {
      state._exitTimer -= dt;
      p.x += 260 * dt;
      state.human.x = p.x + 60;
      if (state._exitTimer <= 0) {
        p.x = W + 200;
        state.human.x = W + 260;
        startFireworks();
      }
    }

    if (state.mode === "FIREWORKS") {
      state.fireworks.timer -= dt;
      state._fwCd -= dt;
      if (state._fwCd <= 0) {
        state._fwCd = rand(0.18, 0.32);
        const bx = rand(160, W - 160);
        const by = rand(80, 220);
        const hue = rand(0, 360);
        for (let k = 0; k < 22; k++) {
          const ang = rand(0, Math.PI * 2);
          const sp = rand(80, 220);
          state.fireworks.bursts.push({ x: bx, y: by, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: rand(0.6, 1.15), hue });
        }
      }

      for (let i = state.fireworks.bursts.length - 1; i >= 0; i--) {
        const b = state.fireworks.bursts[i];
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += 120 * dt;
        if (b.life <= 0) state.fireworks.bursts.splice(i, 1);
      }

      if (state.fireworks.timer <= 0) startVictory();
    }

    updateHUD();
  }

  // ---------- HUD (includes HP) ----------
  function updateHUD() {
    const p = state.player;
    if (elLives) elLives.textContent = `🦄 x ${p.lives}`;
    if (elScore) elScore.textContent = `Score: ${p.score}`;
    if (elTime) elTime.textContent = `Time: ${Math.ceil(state.stageTimer)}s`;

    if (elPowerFill) {
      let val = 0;
      let label = "Power";
      if (p.ray > 0) { val = p.ray / RAY_DURATION; label = "Power  ✨(Ray)"; }
      else if (p.giant > 0) { val = p.giant / GIANT_DURATION; label = "Power  💪(Giant)"; }
      else { val = clamp(p.normalKillsSincePower / 20, 0, 1); label = "Power"; }
      elPowerFill.style.width = `${Math.floor(val * 100)}%`;
      if (elPowerLabel) elPowerLabel.textContent = label;
    }
  }

  // ---------- DRAW ----------
  function drawBackground() {
    ctx.fillStyle = "#7ec7ff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#b7e6ff"; ctx.fillRect(0, 120, W, 120);
    ctx.fillStyle = "#32c86d"; ctx.fillRect(0, 260, W, 110);
    ctx.fillStyle = "#1faa52";
    for (let x = 80; x < W; x += 180) {
      ctx.fillRect(x, 320, 70, 18);
      ctx.fillRect(x + 12, 302, 42, 18);
      ctx.fillRect(x + 6, 284, 54, 18);
    }
    ctx.fillStyle = "#9a5b2d"; ctx.fillRect(0, GROUND_Y + 26, W, H - (GROUND_Y + 26));
    ctx.fillStyle = "#2ed066"; ctx.fillRect(0, GROUND_Y + 10, W, 16);
    drawRainbow(620, GROUND_Y + 10, 240);
  }

  function drawRainbow(cx, cy, r) {
    const bands = ["#ff3b64", "#ff7a1a", "#ffd400", "#38d96b", "#2bc4ff", "#3b65ff", "#9f44ff"];
    ctx.lineWidth = 18;
    for (let i = 0; i < bands.length; i++) {
      ctx.strokeStyle = bands[i];
      ctx.beginPath();
      ctx.arc(cx, cy, r - i * 14, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  // NEW: Health Bar (top-left under HUD area, not covering menu)
  function drawHealthBar() {
    const p = state.player;

    const x = 16;
    const y = 58;      // under HUD row
    const w = 240;
    const h = 18;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.fillRect(x, y, w, h);

    const frac = clamp(p.hp / HP_MAX, 0, 1);
    ctx.fillStyle = "rgba(30,220,100,0.95)";
    ctx.fillRect(x, y, Math.floor(w * frac), h);

    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#111";
    ctx.font = "14px monospace";
    ctx.fillText(`HP ${p.hp}/${HP_MAX}`, x + 8, y + 14);
  }

  function drawPlayer() {
    const p = state.player;
    const scale = (p.giant > 0 ? 1.3 : 1);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.dir * scale, scale);

    ctx.fillStyle = "#ff6fa8"; ctx.fillRect(-22, -16, 44, 22);
    ctx.fillStyle = "#ff4f93"; ctx.fillRect(-18, 2, 10, 12); ctx.fillRect(6, 2, 10, 12);
    ctx.fillStyle = "#ff6fa8"; ctx.fillRect(12, -20, 22, 16);
    ctx.fillStyle = "#ffd400"; ctx.fillRect(26, -30, 4, 10);
    ctx.fillStyle = "#111"; ctx.fillRect(24, -16, 3, 3);
    ctx.fillStyle = "#2bc4ff"; ctx.fillRect(-22, -24, 16, 10);
    ctx.fillStyle = "#9f44ff"; ctx.fillRect(-10, -24, 10, 10);

    if (p.ray > 0) {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(-6, -38, 12, 6);
      ctx.fillStyle = "#2bc4ff"; ctx.fillRect(-5, -37, 10, 4);
    }

    ctx.restore();
  }

  function drawEnemy(e) {
    const dir = e.vx >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(dir, 1);

    ctx.fillStyle = (e.type === "RAY") ? "#3df07b" : "#35d66d";
    ctx.fillRect(-22, -16, 44, 22);

    ctx.fillStyle = "#1faa52";
    ctx.fillRect(-18, 2, 10, 12);
    ctx.fillRect(6, 2, 10, 12);

    ctx.fillStyle = (e.type === "RAY") ? "#3df07b" : "#35d66d";
    ctx.fillRect(12, -20, 22, 16);

    ctx.fillStyle = "#ffd400";
    ctx.fillRect(26, -30, 4, 10);

    ctx.fillStyle = "#441111";
    ctx.fillRect(24, -16, 3, 3);

    if (e.type === "RAY") {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(-10, -28, 18, 4);
    }

    ctx.restore();
  }

  function drawBullets() {
    for (const b of state.bullets) {
      ctx.beginPath(); ctx.fillStyle = "#ffffff"; ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.fillStyle = "rgba(43,196,255,0.85)"; ctx.arc(b.x, b.y, Math.max(2, b.r - 3), 0, Math.PI * 2); ctx.fill();
    }
    for (const r of state.rays) {
      ctx.beginPath(); ctx.fillStyle = "#ffffff"; ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.fillStyle = `hsla(${r.hue}, 90%, 60%, 0.9)`; ctx.arc(r.x, r.y, Math.max(2, r.r - 3), 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawEffects() {
    for (const fx of state.effects) {
      const a = clamp(fx.life / 0.65, 0, 1);
      ctx.fillStyle = `hsla(${fx.hue}, 90%, 60%, ${a})`;
      ctx.fillRect(fx.x, fx.y, 3, 3);
    }
  }

  function roundRect(x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function drawDialogBox() {
    if (!state.dialog.active) return;
    const pad = 16, boxW = 560, boxH = 94;
    const x = (W - boxW) / 2;
    const y = 70;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    roundRect(x, y, boxW, boxH, 14, true, true);

    ctx.fillStyle = "#111";
    ctx.font = "18px monospace";
    const lines = state.dialog.text.split("\n");
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + pad, y + 32 + i * 24);

    const hx = state.human.x;
    const triX = clamp(hx, x + 40, x + boxW - 40);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(triX, y + boxH);
    ctx.lineTo(triX - 10, y + boxH + 16);
    ctx.lineTo(triX + 10, y + boxH + 16);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  function drawHuman() {
    const h = state.human;
    if (!h.active) return;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.fillStyle = "#5a44ff"; ctx.fillRect(-10, -34, 20, 26);
    ctx.fillStyle = "#ffd8b0"; ctx.fillRect(-8, -52, 16, 16);
    ctx.fillStyle = "#222"; ctx.fillRect(-8, -52, 16, 5);
    ctx.fillStyle = "#222"; ctx.fillRect(-8, -8, 6, 10); ctx.fillRect(2, -8, 6, 10);
    ctx.restore();
  }

  function drawTimerOnCanvas() {
    const t = Math.ceil(state.stageTimer);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(W / 2 - 90, 14, 180, 30);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeRect(W / 2 - 90, 14, 180, 30);
    ctx.fillStyle = "#111";
    ctx.font = "16px monospace";
    ctx.fillText(`Time: ${t}s`, W / 2 - 52, 35);
  }

  function drawFireworks() {
    if (!state.fireworks.active) return;
    for (const b of state.fireworks.bursts) {
      const a = clamp(b.life / 1.15, 0, 1);
      ctx.fillStyle = `hsla(${b.hue}, 90%, 60%, ${a})`;
      ctx.fillRect(b.x, b.y, 3, 3);
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "34px monospace";
    ctx.fillText("Victory: Stage 1 Completed!", 160, 290);
  }

  function draw() {
    drawBackground();
    drawTimerOnCanvas();
    drawHealthBar(); // <-- NEW

    for (const e of state.enemies) drawEnemy(e);
    drawBullets();
    drawEffects();
    drawPlayer();
    drawHuman();
    drawDialogBox();
    drawFireworks();

    if (state.player.invuln > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- LOOP ----------
  function loop(now) {
    state.dt = Math.min(0.033, (now - state.lastTime) / 1000);
    state.lastTime = now;
    update(state.dt);
    draw();
    requestAnimationFrame(loop);
  }

  // start
  trySpawn();
  requestAnimationFrame(loop);
})();                     
