/* =========================================================
   Unicorn vs Zombie Unicorns — v23
   FULL REWRITE WITH HEALTH BAR — but keeps mobile controls working

   Key fixes vs the broken health version:
   - DOES NOT overwrite canvas width/height (prevents joystick dead zone)
   - Adds HP bar + HP-based damage (lasers + contact)
   - Lives still exist; HP resets when you lose a life
   - Restart on 0 lives
   - Max 4 enemies
   - Max 1 ray zombie at a time (except final wave)
   - Ray power icon on HUD
   - Powerup kills do NOT count toward earning more powerups / giant
   - Stage timer test = 60s -> final wave -> human runs in -> talks -> fireworks -> victory
   ========================================================= */

(() => {
  // ---------- CANVAS ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // IMPORTANT: DO NOT FORCE CANVAS SIZE HERE.
  // This keeps your mobile UI layout (joystick/buttons) working.
  const W = canvas.width;
  const H = canvas.height;

  // ---------- OPTIONAL HUD DOM ----------
  const elLives = document.getElementById("lives");
  const elScore = document.getElementById("score");
  const elPowerFill = document.getElementById("powerFill");
  const elPowerLabel = document.getElementById("powerLabel");
  const elTime = document.getElementById("time");

  // ---------- MOBILE CONTROLS ----------
  const joystick = document.getElementById("joystick");
  const stick = document.getElementById("stick");
  const btnA = document.getElementById("btnA");
  const btnB = document.getElementById("btnB");

  // ---------- AUDIO ----------
  // Keep your same name setup. Change ONLY this string if needed.
  const MUSIC_MAIN = "bgm_main.mp3.mp3";
  const audio = { main: new Audio(MUSIC_MAIN), unlocked: false, started: false };
  audio.main.loop = true;
  audio.main.volume = 0.55;

  function tryStartMusic() {
    if (audio.started) return;
    audio.started = true;
    audio.main.play().catch(() => (audio.started = false));
  }
  function unlockAudio() {
    if (audio.unlocked) return;
    audio.unlocked = true;
    tryStartMusic();
  }
  window.addEventListener("touchstart", unlockAudio, { passive: true });
  window.addEventListener("mousedown", unlockAudio);

  // ---------- GAME TUNING ----------
  const GROUND_Y = H - 90;
  const PLAYER_Y_MIN = GROUND_Y - 40;
  const PLAYER_Y_MAX = GROUND_Y;

  const MAX_ENEMIES = 4;
  const MAX_RAY_ENEMIES_ALIVE = 1;

  // TEST TIMER (change later to 300 for 5 minutes)
  const STAGE_TIME_SEC_TEST = 60;
  const FINAL_RAY_ENEMIES = 2;

  const PLAYER_BASE_SPEED = 240; // px/sec
  const ENEMY_BASE_SPEED = 90;

  const HEADBUTT_RANGE = 42;
  const HEADBUTT_COOLDOWN = 0.28;

  // Health system
  const HP_MAX = 100;
  const DMG_LASER = 20;
  const DMG_CONTACT = 35;

  // Invuln windows
  const INVULN_AFTER_DAMAGE = 0.55;
  const INVULN_AFTER_LIFE_LOSS = 1.0;

  // Powerups
  const RAY_DURATION = 10.0;
  const GIANT_DURATION = 20.0;

  // ---------- INPUT ----------
  const input = { dx: 0, dy: 0, a: false, b: false };
  const keys = {};

  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    unlockAudio();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // Joystick
  let joyActive = false;
  let joyCenter = null;

  function setStick(x, y) {
    if (!stick) return;
    stick.style.transform = `translate(${x}px, ${y}px)`;
  }

  function getTouchPos(touch) {
    const r = joystick.getBoundingClientRect();
    return { x: touch.clientX - r.left, y: touch.clientY - r.top, r };
  }

  function handleJoystickMove(px, py, radius) {
    const dx = px - joyCenter.x;
    const dy = py - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const ndx = dist > 0 ? dx / dist : 0;
    const ndy = dist > 0 ? dy / dist : 0;

    const clamped = Math.min(dist, radius);
    setStick(ndx * clamped, ndy * clamped);

    input.dx = ndx * Math.min(1, clamped / radius);
    input.dy = ndy * Math.min(1, clamped / radius);
  }

  if (joystick) {
    joystick.addEventListener(
      "touchstart",
      (e) => {
        unlockAudio();
        joyActive = true;
        const t = e.touches[0];
        const p = getTouchPos(t);
        joyCenter = { x: p.r.width / 2, y: p.r.height / 2 };
        handleJoystickMove(p.x, p.y, Math.min(p.r.width, p.r.height) * 0.38);
      },
      { passive: false }
    );

    joystick.addEventListener(
      "touchmove",
      (e) => {
        if (!joyActive) return;
        const t = e.touches[0];
        const p = getTouchPos(t);
        handleJoystickMove(p.x, p.y, Math.min(p.r.width, p.r.height) * 0.38);
        e.preventDefault();
      },
      { passive: false }
    );

    joystick.addEventListener("touchend", () => {
      joyActive = false;
      input.dx = 0;
      input.dy = 0;
      setStick(0, 0);
    });
  }

  function bindButton(el, downFn, upFn) {
    if (!el) return;
    el.addEventListener(
      "touchstart",
      (e) => {
        unlockAudio();
        downFn();
        e.preventDefault();
      },
      { passive: false }
    );
    el.addEventListener(
      "touchend",
      (e) => {
        upFn();
        e.preventDefault();
      },
      { passive: false }
    );
    el.addEventListener("mousedown", () => {
      unlockAudio();
      downFn();
    });
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
    lastTime: performance.now(),
    mode: "PLAY", // PLAY | FINAL_WAVE | TALK | MOUNT | EXIT | FIREWORKS | VICTORY
    stageTimer: STAGE_TIME_SEC_TEST,
    finalSpawned: false,

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

      // counts ONLY non-powered kills
      normalKillsSincePower: 0,
    },

    enemies: [],
    bullets: [], // player shots
    rays: [], // enemy shots
    effects: [],

    shootCd: 0,

    human: {
      active: false,
      x: W + 80,
      y: GROUND_Y,
      vx: -280,
      state: "OFF",
    },

    dialog: {
      active: false,
      text: "You killed all of the zombies here!\nThank you! I was so scared.",
      timer: 0,
    },

    fireworks: {
      active: false,
      timer: 0,
      bursts: [],
      cd: 0,
    },

    exitTimer: 0,
  };

  // ---------- SPAWNING ----------
  function countRayEnemiesAlive() {
    return state.enemies.filter((e) => e.type === "RAY").length;
  }

  function spawnEnemy(type = "NORMAL") {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -40 : W + 40;
    const y = rand(PLAYER_Y_MIN + 6, PLAYER_Y_MAX);

    state.enemies.push({
      x,
      y,
      w: 46,
      h: 34,
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
    } else {
      spawnEnemy("NORMAL");
    }
  }

  let spawnAccum = 0;

  // ---------- DAMAGE / HEALTH ----------
  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return;

    p.hp -= amount;
    p.invuln = INVULN_AFTER_DAMAGE;

    // hit particles
    for (let k = 0; k < 10; k++) {
      state.effects.push({
        x: p.x,
        y: p.y,
        vx: rand(-180, 180),
        vy: rand(-240, 40),
        life: rand(0.25, 0.45),
        hue: rand(0, 360),
      });
    }

    if (p.hp <= 0) {
      p.lives -= 1;

      if (p.lives <= 0) {
        restartGame();
        return;
      }

      p.hp = HP_MAX;
      p.invuln = INVULN_AFTER_LIFE_LOSS;

      // drop any active powers on life loss (feels fair)
      p.ray = 0;
      p.giant = 0;

      // keep the “earned progress” clean
      // (optional: reset normalKillsSincePower too)
      // p.normalKillsSincePower = 0;
    }
  }

  function restartGame() {
    const p = state.player;

    state.mode = "PLAY";
    state.stageTimer = STAGE_TIME_SEC_TEST;
    state.finalSpawned = false;

    p.x = 140;
    p.y = GROUND_Y;
    p.dir = 1;
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

    state.shootCd = 0;

    state.human.active = false;
    state.human.state = "OFF";
    state.dialog.active = false;

    state.fireworks.active = false;
    state.fireworks.timer = 0;
    state.fireworks.bursts.length = 0;
    state.fireworks.cd = 0;

    state.exitTimer = 0;

    spawnAccum = 0;
    trySpawn();
  }

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
      h: p.h,
    };

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (rectsOverlap(hb, eb)) {
        killEnemy(i);
      }
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
    });

    // sparkle
    for (let k = 0; k < 8; k++) {
      state.effects.push({
        x: p.x + p.dir * 26,
        y: p.y - 10,
        vx: rand(-60, 60),
        vy: rand(-80, 10),
        life: rand(0.25, 0.45),
        hue: rand(0, 360),
      });
    }
  }

  function killEnemy(index) {
    const p = state.player;
    const e = state.enemies[index];

    // explosion
    for (let k = 0; k < 18; k++) {
      state.effects.push({
        x: e.x,
        y: e.y,
        vx: rand(-160, 160),
        vy: rand(-200, 60),
        life: rand(0.35, 0.65),
        hue: e.type === "RAY" ? rand(0, 360) : rand(330, 30),
      });
    }

    p.score += e.type === "RAY" ? 40 : 10;

    const poweredNow = p.ray > 0 || p.giant > 0;

    // get ray ONLY if you are not currently powered
    if (e.type === "RAY" && !poweredNow && p.ray <= 0) {
      p.ray = RAY_DURATION;
    }

    // only non-powered kills count toward giant power
    if (!poweredNow) {
      p.normalKillsSincePower++;
      if (p.normalKillsSincePower >= 20) {
        p.normalKillsSincePower = 0;
        p.giant = GIANT_DURATION;
      }
    }

    state.enemies.splice(index, 1);

    // if in final wave and all enemies dead -> talk
    if (state.mode === "FINAL_WAVE" && state.enemies.length === 0) {
      startTalkSequence();
    }
  }

  // ---------- ENDING FLOW ----------
  function startFinalWave() {
    state.mode = "FINAL_WAVE";
    state.finalSpawned = true;

    let add = FINAL_RAY_ENEMIES;
    const interval = setInterval(() => {
      if (state.mode !== "FINAL_WAVE") return clearInterval(interval);
      if (add <= 0) return clearInterval(interval);

      if (state.enemies.length < MAX_ENEMIES) {
        // During final wave, allow two ray zombies total
        spawnEnemy("RAY");
        add--;
      }
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

  function startFireworks() {
    state.mode = "FIREWORKS";
    state.fireworks.active = true;
   state.fireworks.timer = 6;
    state.fireworks.bursts.length = 0;
    state.fireworks.cd = 0;


  // ---------- UPDATE ----------
  function update(dt) {
    state.t += dt;

    const p = state.player;

    // Keyboard movement overrides joystick
    let kdx = 0,
      kdy = 0;
    if (keys["arrowleft"] || keys["a"]) kdx -= 1;
    if (keys["arrowright"] || keys["d"]) kdx += 1;
    if (keys["arrowup"] || keys["w"]) kdy -= 1;
    if (keys["arrowdown"] || keys["s"]) kdy += 1;

    let dx = input.dx;
    let dy = input.dy;
    if (kdx || kdy) {
      const mag = Math.hypot(kdx, kdy) || 1;
      dx = kdx / mag;
      dy = kdy / mag;
    }

    // actions
    if (input.a || keys[" "]) doHeadbutt();

    state.shootCd = Math.max(0, state.shootCd - dt);
    if ((input.b || keys["enter"]) && state.shootCd <= 0) {
      firePlayerRay();
      state.shootCd = 0.18;
    }

    // timers
    p.headbuttCd = Math.max(0, p.headbuttCd - dt);
    p.headbutting = Math.max(0, p.headbutting - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    if (p.ray > 0) p.ray = Math.max(0, p.ray - dt);
    if (p.giant > 0) p.giant = Math.max(0, p.giant - dt);

    // player movement
    const speed = p.speed * (p.giant > 0 ? 1.08 : 1);
    p.x += dx * speed * dt;
    p.y += dy * speed * 0.65 * dt;

    p.x = clamp(p.x, 30, W - 30);
    p.y = clamp(p.y, PLAYER_Y_MIN, PLAYER_Y_MAX);

    if (Math.abs(dx) > 0.15) p.dir = dx > 0 ? 1 : -1;

    // stage timer -> final wave
    if (state.mode === "PLAY") {
      state.stageTimer -= dt;
      if (state.stageTimer <= 0) {
        state.stageTimer = 0;
        startFinalWave();
      }
    }

    // spawning (PLAY only)
    if (state.mode === "PLAY") {
      spawnAccum += dt;
      if (spawnAccum >= 1.15) {
        spawnAccum = 0;
        trySpawn();
      }
    }

    // enemies
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];

      // keep on ground band
      e.y = clamp(e.y, PLAYER_Y_MIN + 6, PLAYER_Y_MAX);
      e.x += e.vx * dt;

      const edir = e.vx >= 0 ? 1 : -1;

      // ray enemy shooting
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
            hue: rand(0, 360),
          });
        }
      }

      // contact collision
      const pb = {
        x: p.x,
        y: p.y,
        w: p.w * (p.giant > 0 ? 1.25 : 1),
        h: p.h * (p.giant > 0 ? 1.25 : 1),
      };
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };

      if (rectsOverlap(pb, eb)) {
        if (p.headbutting > 0) {
          killEnemy(i);
        } else {
          damagePlayer(DMG_CONTACT);
          // small knockback
          p.x -= (e.vx > 0 ? 1 : -1) * 18;
        }
      }

      // mild separation (avoid clusters)
      for (let j = 0; j < state.enemies.length; j++) {
        if (j === i) continue;
        const o = state.enemies[j];
        if (Math.abs(o.x - e.x) < 38 && Math.abs(o.y - e.y) < 18) {
          e.x += (e.x < o.x ? -1 : 1) * 18 * dt;
        }
      }
    }

    // player bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt;

      // hit enemies
      for (let k = state.enemies.length - 1; k >= 0; k--) {
        const e = state.enemies[k];
        const dx2 = e.x - b.x;
        const dy2 = (e.y - 8) - b.y;
        const rr = b.r + 18;
        if (dx2 * dx2 + dy2 * dy2 <= rr * rr) {
          e.hp -= p.giant > 0 ? 2 : 1;

          for (let s = 0; s < 8; s++) {
            state.effects.push({
              x: b.x,
              y: b.y,
              vx: rand(-140, 140),
              vy: rand(-200, 40),
              life: rand(0.2, 0.35),
              hue: rand(0, 360),
            });
          }

          state.bullets.splice(i, 1);

          if (e.hp <= 0) killEnemy(k);
          break;
        }
      }

      if (b.x < -140 || b.x > W + 140) {
        state.bullets.splice(i, 1);
      }
    }

    // enemy rays (lasers) -> DAMAGE HP
    for (let i = state.rays.length - 1; i >= 0; i--) {
      const r = state.rays[i];
      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // trail sparkle
      state.effects.push({
        x: r.x,
        y: r.y,
        vx: rand(-40, 40),
        vy: rand(-40, 40),
        life: 0.18,
        hue: r.hue,
      });

      const pb = {
        x: p.x,
        y: p.y - 6,
        w: p.w * (p.giant > 0 ? 1.25 : 1),
        h: p.h * (p.giant > 0 ? 1.25 : 1),
      };
      const rb = { x: r.x, y: r.y, w: r.r * 2, h: r.r * 2 };

      if (rectsOverlap(pb, rb)) {
        damagePlayer(DMG_LASER);
        state.rays.splice(i, 1);
        continue;
      }

      if (r.x < -160 || r.x > W + 160 || r.y < -160 || r.y > H + 160) {
        state.rays.splice(i, 1);
      }
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

    // TALK sequence: human runs in, then dialog, then exit, then fireworks
    if (state.mode === "TALK") {
      if (state.human.active && state.human.state === "RUNIN") {
        state.human.x += state.human.vx * dt;

        const stopX = p.x + 110;
        if (state.human.x <= stopX) {
          state.human.x = stopX;
          state.human.vx = 0;
          state.human.state = "TALK";
          state.dialog.active = true;
          state.dialog.timer = 2.4;
        }
      }

      if (state.dialog.active) {
        state.dialog.timer -= dt;
        if (state.dialog.timer <= 0) {
          state.dialog.active = false;
          state.mode = "EXIT";
          state.exitTimer = 1.2;
        }
      }
    }

    if (state.mode === "EXIT") {
      state.exitTimer -= dt;
      p.x += 260 * dt;
      state.human.x = p.x + 60;

      if (state.exitTimer <= 0) {
        // ensure offscreen
        p.x = W + 200;
        state.human.x = W + 260;
        startFireworks();
      }
    }

    if (state.mode === "FIREWORKS") {
      state.fireworks.timer -= dt;
      state.fireworks.cd -= dt;

      if (state.fireworks.cd <= 0) {
        state.fireworks.cd = rand(0.18, 0.32);

        const bx = rand(160, W - 160);
        const by = rand(80, 220);
        const hue = rand(0, 360);

        for (let k = 0; k < 22; k++) {
          const ang = rand(0, Math.PI * 2);
          const sp = rand(80, 220);
          state.fireworks.bursts.push({
            x: bx,
            y: by,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            life: rand(0.6, 1.15),
            hue,
          });
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

      if (state.fireworks.timer <= 0) {
        state.mode = "VICTORY";
      }
    }

    // HUD
    updateHUD();
  }

  // ---------- HUD UPDATE ----------
  function updateHUD() {
    const p = state.player;

    if (elLives) elLives.textContent = `🦄 x ${p.lives}`;
    if (elScore) elScore.textContent = `Score: ${p.score}`;
    if (elTime) elTime.textContent = `Time: ${Math.ceil(state.stageTimer)}s`;

    if (elPowerFill) {
      let val = 0;
      let label = "Power";
      if (p.ray > 0) {
        val = p.ray / RAY_DURATION;
        label = "Power  ✨(Ray)";
      } else if (p.giant > 0) {
        val = p.giant / GIANT_DURATION;
        label = "Power  💪(Giant)";
      } else {
        val = clamp(p.normalKillsSincePower / 20, 0, 1);
        label = "Power";
      }
      elPowerFill.style.width = `${Math.floor(val * 100)}%`;
      if (elPowerLabel) elPowerLabel.textContent = label;
    }
  }

  // ---------- DRAW HELPERS ----------
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

  function drawBackground() {
    ctx.fillStyle = "#7ec7ff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#b7e6ff";
    ctx.fillRect(0, 120, W, 120);

    ctx.fillStyle = "#32c86d";
    ctx.fillRect(0, 260, W, 110);

    ctx.fillStyle = "#1faa52";
    for (let x = 80; x < W; x += 180) {
      ctx.fillRect(x, 320, 70, 18);
      ctx.fillRect(x + 12, 302, 42, 18);
      ctx.fillRect(x + 6, 284, 54, 18);
    }

    ctx.fillStyle = "#9a5b2d";
    ctx.fillRect(0, GROUND_Y + 26, W, H - (GROUND_Y + 26));

    ctx.fillStyle = "#2ed066";
    ctx.fillRect(0, GROUND_Y + 10, W, 16);

    drawRainbow(W * 0.75, GROUND_Y + 10, 240);
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

  function drawHealthBar() {
    const p = state.player;
    const x = 16;
    const y = 54; // under the top HUD row area
    const w = 220;
    const h = 16;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(x, y, w, h);

    const frac = clamp(p.hp / HP_MAX, 0, 1);
    ctx.fillStyle = "rgba(46,208,102,0.95)";
    ctx.fillRect(x, y, Math.floor(w * frac), h);

    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#111";
    ctx.font = "14px monospace";
    ctx.fillText(`HP ${p.hp}/${HP_MAX}`, x + 8, y + 13);
  }

  function drawPlayer() {
    const p = state.player;
    const scale = p.giant > 0 ? 1.3 : 1;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.dir * scale, scale);

    // body
    ctx.fillStyle = "#ff6fa8";
    ctx.fillRect(-22, -16, 44, 22);

    // legs
    ctx.fillStyle = "#ff4f93";
    ctx.fillRect(-18, 2, 10, 12);
    ctx.fillRect(6, 2, 10, 12);

    // head
    ctx.fillStyle = "#ff6fa8";
    ctx.fillRect(12, -20, 22, 16);

    // horn
    ctx.fillStyle = "#ffd400";
    ctx.fillRect(26, -30, 4, 10);

    // eye
    ctx.fillStyle = "#111";
    ctx.fillRect(24, -16, 3, 3);

    // mane
    ctx.fillStyle = "#2bc4ff";
    ctx.fillRect(-22, -24, 16, 10);
    ctx.fillStyle = "#9f44ff";
    ctx.fillRect(-10, -24, 10, 10);

    // ray icon when active
    if (p.ray > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-6, -38, 12, 6);
      ctx.fillStyle = "#2bc4ff";
      ctx.fillRect(-5, -37, 10, 4);
    }

    ctx.restore();
  }

  function drawEnemy(e) {
    const dir = e.vx >= 0 ? 1 : -1;

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(dir, 1);

    ctx.fillStyle = e.type === "RAY" ? "#3df07b" : "#35d66d";
    ctx.fillRect(-22, -16, 44, 22);

    ctx.fillStyle = "#1faa52";
    ctx.fillRect(-18, 2, 10, 12);
    ctx.fillRect(6, 2, 10, 12);

    ctx.fillStyle = e.type === "RAY" ? "#3df07b" : "#35d66d";
    ctx.fillRect(12, -20, 22, 16);

    ctx.fillStyle = "#ffd400";
    ctx.fillRect(26, -30, 4, 10);

    // subtle red eye tint but not too obvious
    ctx.fillStyle = "#441111";
    ctx.fillRect(24, -16, 3, 3);

    if (e.type === "RAY") {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(-10, -28, 18, 4);
    }

    ctx.restore();
  }

  function drawBullets() {
    // player shots
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "rgba(43,196,255,0.85)";
      ctx.arc(b.x, b.y, Math.max(2, b.r - 3), 0, Math.PI * 2);
      ctx.fill();
    }

    // enemy rays
    for (const r of state.rays) {
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = `hsla(${r.hue}, 90%, 60%, 0.9)`;
      ctx.arc(r.x, r.y, Math.max(2, r.r - 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEffects() {
    for (const fx of state.effects) {
      const a = clamp(fx.life / 0.65, 0, 1);
      ctx.fillStyle = `hsla(${fx.hue}, 90%, 60%, ${a})`;
      ctx.fillRect(fx.x, fx.y, 3, 3);
    }
  }

  function drawHuman() {
    if (!state.human.active) return;

    ctx.save();
    ctx.translate(state.human.x, state.human.y);

    ctx.fillStyle = "#5a44ff";
    ctx.fillRect(-10, -34, 20, 26);

    ctx.fillStyle = "#ffd8b0";
    ctx.fillRect(-8, -52, 16, 16);

    ctx.fillStyle = "#222";
    ctx.fillRect(-8, -52, 16, 5);

    ctx.fillStyle = "#222";
    ctx.fillRect(-8, -8, 6, 10);
    ctx.fillRect(2, -8, 6, 10);

    ctx.restore();
  }

  function drawDialogBox() {
    if (!state.dialog.active) return;

    const pad = 16;
    const boxW = 560;
    const boxH = 94;
    const x = (W - boxW) / 2;
    const y = 70; // under top HUD

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    roundRect(x, y, boxW, boxH, 14, true, true);

    ctx.fillStyle = "#111";
    ctx.font = "18px monospace";
    const lines = state.dialog.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x + pad, y + 32 + i * 24);
    }

    // pointer toward human
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
    ctx.fill();
    ctx.stroke();
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
    drawHealthBar();

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

  // ---------- MAIN LOOP ----------
  function loop(now) {
    const dt = Math.min(0.033, (now - state.lastTime) / 1000);
    state.lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // ---------- START ----------
  // Start with one enemy so you aren't surrounded instantly
  trySpawn();

  requestAnimationFrame(loop);
})();  
