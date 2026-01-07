/* =========================================================
   Unicorn vs Zombie Unicorns — v26
   FIX: Blank screen (adds on-screen error overlay + null-safe DOM)
   - If anything crashes, you see the error on screen (iOS-friendly)
   - Keeps ending state machine: PLAY -> FINAL -> NPC_IN -> TALK -> EXIT -> FIREWORKS -> VICTORY
   - Does NOT resize canvas in JS (keeps joystick working)
   ========================================================= */

(() => {
  // ---------- ERROR OVERLAY ----------
  function showFatal(err) {
    try {
      const pre = document.createElement("pre");
      pre.style.position = "fixed";
      pre.style.left = "10px";
      pre.style.right = "10px";
      pre.style.top = "10px";
      pre.style.bottom = "10px";
      pre.style.zIndex = "99999";
      pre.style.background = "rgba(0,0,0,0.92)";
      pre.style.color = "#fff";
      pre.style.padding = "12px";
      pre.style.border = "2px solid rgba(255,255,255,0.25)";
      pre.style.borderRadius = "12px";
      pre.style.overflow = "auto";
      pre.style.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      pre.textContent =
        "GAME CRASHED (v26)\n\n" +
        String(err && err.stack ? err.stack : err) +
        "\n\nMost common fixes:\n" +
        "• Confirm index.html has <canvas id=\"game\"> and joystick/button IDs match.\n" +
        "• Hard refresh / clear cache.\n";
      document.body.appendChild(pre);
    } catch (_) {
      alert("Game crashed: " + err);
    }
    throw err; // stop further execution
  }

  try {
    // ---------- DOM ----------
    const canvas = document.getElementById("game");
    if (!canvas) throw new Error('Missing <canvas id="game"> in index.html');

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    const W = canvas.width;
    const H = canvas.height;

    // HUD (optional)
    const elLives = document.getElementById("lives");
    const elScore = document.getElementById("score");
    const elPowerFill = document.getElementById("powerFill");
    const elPowerLabel = document.getElementById("powerLabel");
    const elTime = document.getElementById("time");

    // Controls
    const joystick = document.getElementById("joystick");
    const stick = document.getElementById("stick");
    const btnA = document.getElementById("btnA");
    const btnB = document.getElementById("btnB");

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

    // ---------- INPUT ----------
    const input = { dx: 0, dy: 0, a: false, b: false };
    const keys = {};

    window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
    window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

    // Joystick
    let joyActive = false;
    let joyCenter = null;

    function setStick(x, y) {
      if (!stick) return;
      stick.style.transform = `translate(${x}px, ${y}px)`;
    }

    function getTouchPos(t) {
      const r = joystick.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top, r };
    }

    function handleJoy(px, py, radius) {
      const dx = px - joyCenter.x;
      const dy = py - joyCenter.y;
      const dist = Math.hypot(dx, dy);
      const ndx = dist > 0 ? dx / dist : 0;
      const ndy = dist > 0 ? dy / dist : 0;
      const clampedDist = Math.min(dist, radius);

      setStick(ndx * clampedDist, ndy * clampedDist);
      input.dx = ndx * Math.min(1, clampedDist / radius);
      input.dy = ndy * Math.min(1, clampedDist / radius);
    }

    if (joystick) {
      joystick.addEventListener(
        "touchstart",
        (e) => {
          joyActive = true;
          const t = e.touches[0];
          const p = getTouchPos(t);
          joyCenter = { x: p.r.width / 2, y: p.r.height / 2 };
          handleJoy(p.x, p.y, Math.min(p.r.width, p.r.height) * 0.38);
          e.preventDefault();
        },
        { passive: false }
      );

      joystick.addEventListener(
        "touchmove",
        (e) => {
          if (!joyActive) return;
          const t = e.touches[0];
          const p = getTouchPos(t);
          handleJoy(p.x, p.y, Math.min(p.r.width, p.r.height) * 0.38);
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

    function bindButton(el, down, up) {
      if (!el) return;
      el.addEventListener(
        "touchstart",
        (e) => {
          down();
          e.preventDefault();
        },
        { passive: false }
      );
      el.addEventListener(
        "touchend",
        (e) => {
          up();
          e.preventDefault();
        },
        { passive: false }
      );
      el.addEventListener("mousedown", down);
      el.addEventListener("mouseup", up);
      el.addEventListener("mouseleave", up);
    }

    bindButton(btnA, () => (input.a = true), () => (input.a = false));
    bindButton(btnB, () => (input.b = true), () => (input.b = false));

    // ---------- CONSTANTS ----------
    const GROUND_Y = H - 90;
    const PLAYER_Y_MIN = GROUND_Y - 44;
    const PLAYER_Y_MAX = GROUND_Y;

    const STAGE_TIME_TEST = 60;

    const MAX_ENEMIES = 4;
    const MAX_RAY_ALIVE_PLAY = 1;
    const FINAL_RAY_COUNT = 2;

    const PLAYER_SPEED = 260;
    const ENEMY_SPEED = 125;
    const ENEMY_Y_FOLLOW = 90;

    const HP_MAX = 100;
    const DMG_CONTACT = 22;
    const DMG_LASER = 18;
    const INVULN_AFTER_DAMAGE = 0.55;
    const INVULN_AFTER_LIFE_LOSS = 1.0;

    const HEADBUTT_RANGE = 54;
    const HEADBUTT_COOLDOWN = 0.22;
    const HEADBUTT_WINDOW = 0.16;

    const RAY_DURATION = 10.0;
    const GIANT_DURATION = 20.0;

    const PLAYER_SHOT_SPEED = 560;
    const PLAYER_SHOT_COOLDOWN = 0.16;

    const ENEMY_RAY_SPEED = 420;
    const ENEMY_RAY_COOLDOWN_MIN = 0.9;
    const ENEMY_RAY_COOLDOWN_MAX = 1.4;

    const Mode = {
      PLAY: "PLAY",
      FINAL: "FINAL",
      NPC_IN: "NPC_IN",
      TALK: "TALK",
      EXIT: "EXIT",
      FIREWORKS: "FIREWORKS",
      VICTORY: "VICTORY",
    };

    // ---------- STATE ----------
    const state = {
      last: performance.now(),
      mode: Mode.PLAY,
      stageTimer: STAGE_TIME_TEST,

      finalSpawned: 0,
      finalDone: false,
      finalSpawnCd: 0,

      player: {
        x: 140,
        y: GROUND_Y,
        w: 46,
        h: 34,
        dir: 1,
        lives: 3,
        hp: HP_MAX,
        invuln: 0,
        score: 0,
        headbuttCd: 0,
        headbutting: 0,
        ray: 0,
        giant: 0,
        normalKillsSincePower: 0,
        shotCd: 0,
      },

      enemies: [],
      pShots: [],
      eShots: [],
      fx: [],

      npc: { x: -120, y: GROUND_Y, vx: 340, active: false },

      dialog: {
        active: false,
        timer: 0,
        text: "You killed all of the zombies here!\nThank you! I was so scared.",
      },

      fireworks: { active: false, timer: 0, cd: 0, bursts: [] },
      exitTimer: 0,
    };

    // ---------- SPAWN ----------
    function rayAlive() {
      return state.enemies.reduce((n, e) => n + (e.type === "RAY" ? 1 : 0), 0);
    }

    function spawnEnemy(type) {
      const fromLeft = Math.random() < 0.5;
      const x = fromLeft ? -60 : W + 60;
      const y = rand(PLAYER_Y_MIN + 6, PLAYER_Y_MAX);

      state.enemies.push({
        x,
        y,
        w: 46,
        h: 34,
        type, // "NORMAL" | "RAY"
        hp: type === "RAY" ? 3 : 1,
        shootCd: rand(ENEMY_RAY_COOLDOWN_MIN, ENEMY_RAY_COOLDOWN_MAX),
        sep: rand(0.8, 1.2),
      });
    }

    let spawnAcc = 0;
    function trySpawnPlay(dt) {
      spawnAcc += dt;
      if (spawnAcc < 1.0) return;
      spawnAcc = 0;

      if (state.enemies.length >= MAX_ENEMIES) return;

      const wantRay = Math.random() < 0.12;
      if (wantRay) {
        if (rayAlive() >= MAX_RAY_ALIVE_PLAY) spawnEnemy("NORMAL");
        else spawnEnemy("RAY");
      } else {
        spawnEnemy("NORMAL");
      }
    }

    function handleFinalWave(dt) {
      if (state.finalDone) return;

      // spawn exactly 2 ray zombies, spaced out
      if (state.finalSpawned < FINAL_RAY_COUNT && state.enemies.length < MAX_ENEMIES) {
        state.finalSpawnCd -= dt;
        if (state.finalSpawnCd <= 0) {
          spawnEnemy("RAY");
          state.finalSpawned++;
          state.finalSpawnCd = 0.9;
        }
      }

      // if spawned both and all enemies dead -> ending
      if (state.finalSpawned >= FINAL_RAY_COUNT && state.enemies.length === 0) {
        beginEnding();
      }
    }

    // ---------- DAMAGE / RESET ----------
    function restartGame() {
      const p = state.player;
      state.mode = Mode.PLAY;
      state.stageTimer = STAGE_TIME_TEST;
      state.finalSpawned = 0;
      state.finalDone = false;
      state.finalSpawnCd = 0;
      spawnAcc = 0;

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
      p.shotCd = 0;

      state.enemies.length = 0;
      state.pShots.length = 0;
      state.eShots.length = 0;
      state.fx.length = 0;

      state.npc.active = false;
      state.npc.x = -120;
      state.npc.vx = 340;

      state.dialog.active = false;
      state.dialog.timer = 0;

      state.fireworks.active = false;
      state.fireworks.timer = 0;
      state.fireworks.cd = 0;
      state.fireworks.bursts.length = 0;

      state.exitTimer = 0;

      spawnEnemy("NORMAL");
    }

    function damagePlayer(amount) {
      const p = state.player;
      if (p.invuln > 0) return;

      p.hp -= amount;
      p.invuln = INVULN_AFTER_DAMAGE;

      for (let i = 0; i < 10; i++) {
        state.fx.push({
          x: p.x,
          y: p.y,
          vx: rand(-180, 180),
          vy: rand(-240, 50),
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
        p.ray = 0;
        p.giant = 0;
      }
    }

    // ---------- COMBAT ----------
    function doHeadbutt() {
      const p = state.player;
      if (p.headbuttCd > 0) return;

      p.headbuttCd = HEADBUTT_COOLDOWN;
      p.headbutting = HEADBUTT_WINDOW;

      const hb = {
        x: p.x + p.dir * (p.w / 2 + HEADBUTT_RANGE / 2),
        y: p.y,
        w: HEADBUTT_RANGE,
        h: p.h,
      };

      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
        if (rectsOverlap(hb, eb)) killEnemy(i);
      }
    }

    function shootPlayer() {
      const p = state.player;
      if (p.ray <= 0) return;
      if (p.shotCd > 0) return;
      p.shotCd = PLAYER_SHOT_COOLDOWN;

      state.pShots.push({
        x: p.x + p.dir * (p.w / 2 + 10),
        y: p.y - 8,
        vx: p.dir * PLAYER_SHOT_SPEED,
        vy: 0,
        r: p.giant > 0 ? 10 : 6,
      });
    }

    function killEnemy(idx) {
      const p = state.player;
      const e = state.enemies[idx];

      for (let i = 0; i < 18; i++) {
        state.fx.push({
          x: e.x,
          y: e.y,
          vx: rand(-160, 160),
          vy: rand(-220, 60),
          life: rand(0.35, 0.65),
          hue: e.type === "RAY" ? rand(0, 360) : rand(330, 30),
        });
      }

      p.score += e.type === "RAY" ? 40 : 10;

      const powered = p.ray > 0 || p.giant > 0;

      // Ray pickup only if not powered
      if (e.type === "RAY" && !powered && p.ray <= 0) p.ray = RAY_DURATION;

      // Only non-powered kills count toward giant
      if (!powered) {
        p.normalKillsSincePower++;
        if (p.normalKillsSincePower >= 20) {
          p.normalKillsSincePower = 0;
          p.giant = GIANT_DURATION;
        }
      }

      state.enemies.splice(idx, 1);

      // If in FINAL and spawned both, killing last enemy triggers ending
      if (state.mode === Mode.FINAL) {
        if (!state.finalDone && state.finalSpawned >= FINAL_RAY_COUNT && state.enemies.length === 0) {
          beginEnding();
        }
      }
    }

    // ---------- ENDING ----------
    function beginEnding() {
      if (state.finalDone) return;
      state.finalDone = true;

      state.pShots.length = 0;
      state.eShots.length = 0;

      state.mode = Mode.NPC_IN;
      state.npc.active = true;
      state.npc.x = -120;
      state.npc.vx = 340;

      state.dialog.active = false;
      state.dialog.timer = 0;
    }

    function updateEnding(dt) {
      const p = state.player;

      if (state.mode === Mode.NPC_IN) {
        state.npc.x += state.npc.vx * dt;
        const stopX = p.x - 120;
        if (state.npc.x >= stopX) {
          state.npc.x = stopX;
          state.npc.vx = 0;
          state.mode = Mode.TALK;
          state.dialog.active = true;
          state.dialog.timer = 2.4;
        }
        return;
      }

      if (state.mode === Mode.TALK) {
        state.dialog.timer -= dt;
        if (state.dialog.timer <= 0) {
          state.dialog.active = false;
          state.mode = Mode.EXIT;
          state.exitTimer = 1.6;
        }
        return;
      }

      if (state.mode === Mode.EXIT) {
        state.exitTimer -= dt;
        p.x += 280 * dt;
        state.npc.x = p.x - 60;

        if (state.exitTimer <= 0 || p.x > W + 140) {
          state.mode = Mode.FIREWORKS;
          state.fireworks.active = true;
          state.fireworks.timer = 3.0;
          state.fireworks.cd = 0;
          state.fireworks.bursts.length = 0;
        }
        return;
      }

      if (state.mode === Mode.FIREWORKS) {
        state.fireworks.timer -= dt;
        state.fireworks.cd -= dt;

        if (state.fireworks.cd <= 0) {
          state.fireworks.cd = rand(0.18, 0.30);
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
          state.fireworks.active = false;
          state.mode = Mode.VICTORY;
        }
      }
    }

    // ---------- UPDATE (core) ----------
    function updateFX(dt) {
      for (let i = state.fx.length - 1; i >= 0; i--) {
        const fx = state.fx[i];
        fx.life -= dt;
        fx.x += fx.vx * dt;
        fx.y += fx.vy * dt;
        fx.vy += 380 * dt;
        if (fx.life <= 0) state.fx.splice(i, 1);
      }
    }

    function updateHUD() {
      const p = state.player;
      if (elLives) elLives.textContent = `🦄 x ${p.lives}`;
      if (elScore) elScore.textContent = `Score: ${p.score}`;

      const t = state.mode === Mode.PLAY ? Math.ceil(state.stageTimer) : 0;
      if (elTime) elTime.textContent = `Time: ${t}s`;

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
        }
        elPowerFill.style.width = `${Math.floor(val * 100)}%`;
        if (elPowerLabel) elPowerLabel.textContent = label;
      }
    }

    function updateEnemies(dt) {
      const p = state.player;

      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];

        // Chase player X + follow Y
        const toX = p.x - e.x;
        const dirX = toX === 0 ? 0 : Math.sign(toX);

        const desiredX = p.x - dirX * (26 + 22 * e.sep);
        const steer = desiredX - e.x;

        e.x += clamp(steer, -1, 1) * ENEMY_SPEED * dt;

        const toY = p.y - e.y;
        e.y += clamp(toY, -1, 1) * ENEMY_Y_FOLLOW * dt;
        e.y = clamp(e.y, PLAYER_Y_MIN + 6, PLAYER_Y_MAX);

        // Ray shots
        if (e.type === "RAY") {
          e.shootCd -= dt;
          if (e.shootCd <= 0) {
            e.shootCd = rand(ENEMY_RAY_COOLDOWN_MIN, ENEMY_RAY_COOLDOWN_MAX);

            const sx = e.x + (p.x >= e.x ? 1 : -1) * (e.w / 2 + 8);
            const sy = e.y - 8;
            const ang = Math.atan2((p.y - 8) - sy, p.x - sx);

            state.eShots.push({
              x: sx,
              y: sy,
              vx: Math.cos(ang) * ENEMY_RAY_SPEED,
              vy: Math.sin(ang) * ENEMY_RAY_SPEED,
              r: 7,
              hue: rand(0, 360),
            });
          }
        }

        // Collision with player
        const pb = { x: p.x, y: p.y, w: p.w * (p.giant > 0 ? 1.25 : 1), h: p.h * (p.giant > 0 ? 1.25 : 1) };
        const eb = { x: e.x, y: e.y, w: e.w, h: e.h };

        if (rectsOverlap(pb, eb)) {
          if (p.headbutting > 0) {
            killEnemy(i);
          } else {
            damagePlayer(DMG_CONTACT);
            p.x += (p.x >= e.x ? 1 : -1) * 22;
            p.x = clamp(p.x, 30, W - 30);
          }
        }
      }
    }

    function updatePlayerShots(dt) {
      const p = state.player;

      for (let i = state.pShots.length - 1; i >= 0; i--) {
        const b = state.pShots[i];
        b.x += b.vx * dt;

        for (let k = state.enemies.length - 1; k >= 0; k--) {
          const e = state.enemies[k];
          const dx = e.x - b.x;
          const dy = (e.y - 8) - b.y;
          const rr = b.r + 18;
          if (dx * dx + dy * dy <= rr * rr) {
            e.hp -= p.giant > 0 ? 2 : 1;
            state.pShots.splice(i, 1);
            if (e.hp <= 0) killEnemy(k);
            break;
          }
        }

        if (b.x < -200 || b.x > W + 200) state.pShots.splice(i, 1);
      }
    }

    function updateEnemyShots(dt) {
      const p = state.player;

      for (let i = state.eShots.length - 1; i >= 0; i--) {
        const r = state.eShots[i];
        r.x += r.vx * dt;
        r.y += r.vy * dt;

        // hitbox vs player
        const pb = { x: p.x, y: p.y - 6, w: p.w * (p.giant > 0 ? 1.25 : 1), h: p.h * (p.giant > 0 ? 1.25 : 1) };
        const rb = { x: r.x, y: r.y, w: r.r * 2, h: r.r * 2 };
        if (rectsOverlap(pb, rb)) {
          damagePlayer(DMG_LASER);
          state.eShots.splice(i, 1);
          continue;
        }

        if (r.x < -240 || r.x > W + 240 || r.y < -240 || r.y > H + 240) state.eShots.splice(i, 1);
      }
    }

    function update(dt) {
      const p = state.player;

      // timers
      p.invuln = Math.max(0, p.invuln - dt);
      p.headbuttCd = Math.max(0, p.headbuttCd - dt);
      p.headbutting = Math.max(0, p.headbutting - dt);
      p.shotCd = Math.max(0, p.shotCd - dt);
      if (p.ray > 0) p.ray = Math.max(0, p.ray - dt);
      if (p.giant > 0) p.giant = Math.max(0, p.giant - dt);

      // ending modes
      if (state.mode === Mode.NPC_IN || state.mode === Mode.TALK || state.mode === Mode.EXIT || state.mode === Mode.FIREWORKS || state.mode === Mode.VICTORY) {
        updateEnding(dt);
        updateFX(dt);
        updateHUD();
        return;
      }

      // input (keyboard overrides)
      let dx = input.dx, dy = input.dy;
      let kdx = 0, kdy = 0;
      if (keys["arrowleft"] || keys["a"]) kdx -= 1;
      if (keys["arrowright"] || keys["d"]) kdx += 1;
      if (keys["arrowup"] || keys["w"]) kdy -= 1;
      if (keys["arrowdown"] || keys["s"]) kdy += 1;

      if (kdx || kdy) {
        const m = Math.hypot(kdx, kdy) || 1;
        dx = kdx / m;
        dy = kdy / m;
      }

      // actions
      if (input.a || keys[" "]) doHeadbutt();
      if (input.b || keys["enter"]) shootPlayer();

      // move player
      const scale = p.giant > 0 ? 1.08 : 1;
      p.x += dx * PLAYER_SPEED * scale * dt;
      p.y += dy * PLAYER_SPEED * 0.65 * dt;
      p.x = clamp(p.x, 30, W - 30);
      p.y = clamp(p.y, PLAYER_Y_MIN, PLAYER_Y_MAX);
      if (Math.abs(dx) > 0.15) p.dir = dx > 0 ? 1 : -1;

      // timer -> FINAL
      if (state.mode === Mode.PLAY) {
        state.stageTimer -= dt;
        if (state.stageTimer <= 0) {
          state.stageTimer = 0;
          state.mode = Mode.FINAL;
          state.finalSpawned = 0;
          state.finalDone = false;
          state.finalSpawnCd = 0;
        } else {
          trySpawnPlay(dt);
        }
      }

      if (state.mode === Mode.FINAL) handleFinalWave(dt);

      updateEnemies(dt);
      updatePlayerShots(dt);
      updateEnemyShots(dt);
      updateFX(dt);
      updateHUD();
    }

    // ---------- DRAW ----------
    function drawBackground() {
      ctx.fillStyle = "#7ec7ff";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#32c86d";
      ctx.fillRect(0, 260, W, 110);
      ctx.fillStyle = "#2ed066";
      ctx.fillRect(0, GROUND_Y + 10, W, 16);
      ctx.fillStyle = "#9a5b2d";
      ctx.fillRect(0, GROUND_Y + 26, W, H - (GROUND_Y + 26));
    }

    function drawHealthBar() {
      const p = state.player;
      const x = 16, y = 54, w = 220, h = 16;
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

      ctx.fillStyle = "#ff6fa8";
      ctx.fillRect(-22, -16, 44, 22);
      ctx.fillStyle = "#ff4f93";
      ctx.fillRect(-18, 2, 10, 12);
      ctx.fillRect(6, 2, 10, 12);
      ctx.fillStyle = "#ff6fa8";
      ctx.fillRect(12, -20, 22, 16);
      ctx.fillStyle = "#ffd400";
      ctx.fillRect(26, -30, 4, 10);
      ctx.fillStyle = "#111";
      ctx.fillRect(24, -16, 3, 3);
      ctx.restore();
    }

    function drawEnemy(e) {
      const dir = state.player.x >= e.x ? 1 : -1;
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
      ctx.fillStyle = "rgba(120,0,0,0.6)";
      ctx.fillRect(24, -16, 3, 3);
      ctx.restore();
    }

    function drawShots() {
      for (const b of state.pShots) {
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const r of state.eShots) {
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `hsla(${r.hue},90%,60%,0.9)`;
        ctx.arc(r.x, r.y, Math.max(2, r.r - 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawFX() {
      for (const fx of state.fx) {
        const a = clamp(fx.life / 0.65, 0, 1);
        ctx.fillStyle = `hsla(${fx.hue}, 90%, 60%, ${a})`;
        ctx.fillRect(fx.x, fx.y, 3, 3);
      }
    }

    function drawNPC() {
      if (!state.npc.active) return;
      ctx.save();
      ctx.translate(state.npc.x, state.npc.y);
      ctx.fillStyle = "#5a44ff";
      ctx.fillRect(-10, -34, 20, 26);
      ctx.fillStyle = "#ffd8b0";
      ctx.fillRect(-8, -52, 16, 16);
      ctx.restore();
    }

    function drawDialog() {
      if (!state.dialog.active) return;

      const boxW = 560, boxH = 94;
      const x = (W - boxW) / 2;
      const y = 70;

      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(x + 14, y);
      ctx.arcTo(x + boxW, y, x + boxW, y + boxH, 14);
      ctx.arcTo(x + boxW, y + boxH, x, y + boxH, 14);
      ctx.arcTo(x, y + boxH, x, y, 14);
      ctx.arcTo(x, y, x + boxW, y, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#111";
      ctx.font = "18px monospace";
      const lines = state.dialog.text.split("\n");
      ctx.fillText(lines[0] || "", x + 16, y + 34);
      ctx.fillText(lines[1] || "", x + 16, y + 58);
    }

    function drawFireworks() {
      if (state.mode !== Mode.FIREWORKS && state.mode !== Mode.VICTORY) return;

      for (const b of state.fireworks.bursts) {
        const a = clamp(b.life / 1.15, 0, 1);
        ctx.fillStyle = `hsla(${b.hue}, 90%, 60%, ${a})`;
        ctx.fillRect(b.x, b.y, 3, 3);
      }

      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#fff";
      ctx.font = "34px monospace";
      ctx.fillText("Victory: Stage 1 Completed!", 160, 290);
    }

    function draw() {
      drawBackground();
      drawHealthBar();

      for (const e of state.enemies) drawEnemy(e);
      drawShots();
      drawFX();
      drawPlayer();

      drawNPC();
      drawDialog();
      drawFireworks();

      if (state.player.invuln > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 0, W, H);
      }
    }

    // ---------- LOOP ----------
    function loop(now) {
      const dt = Math.min(0.033, (now - state.last) / 1000);
      state.last = now;

      update(dt);
      draw();

      requestAnimationFrame(loop);
    }

    // Start gentle
    spawnEnemy("NORMAL");
    updateHUD();
    requestAnimationFrame(loop);
  } catch (err) {
    showFatal(err);
  }
})();

