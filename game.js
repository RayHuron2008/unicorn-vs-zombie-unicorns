(() => {
  "use strict";

  const canvas = document.getElementById("game");
  if (!canvas) {
    alert("Missing canvas with id='game'");
    return;
  }

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // -----------------------------
  // SETTINGS
  // -----------------------------
  const VERSION = "v42";

  const GROUND_Y = Math.floor(H * 0.78);
  const MIN_Y = GROUND_Y - 46;
  const MAX_Y = GROUND_Y;

  const STAGE_TIME = 60;          // testing timer
  const MAX_ENEMIES = 2;          // HALF difficulty
  const SPAWN_INTERVAL = 1.6;     // slower enemy spawning
  const MAX_RAY_NORMAL = 1;
  const FINAL_RAY_COUNT = 2;

  const PLAYER_SPEED = 245;
  const ENEMY_SPEED = 100;
  const ENEMY_Y_SPEED = 72;

  const HP_MAX = 100;
  const DMG_CONTACT = 18;
  const DMG_LASER = 14;

  const INVULN_AFTER_HIT = 0.65;
  const INVULN_AFTER_LIFE_LOSS = 1.1;

  const HEADBUTT_CD = 0.25;
  const HEADBUTT_WINDOW = 0.16;
  const HEADBUTT_RANGE = 56;

  const RAY_DURATION = 10;
  const GIANT_DURATION = 20;
  const PLAYER_SHOT_CD = 0.18;

  // -----------------------------
  // DOM HUD
  // -----------------------------
  const hudLives = document.getElementById("lives");
  const hudScore = document.getElementById("score");
  const hudTime = document.getElementById("time");
  const powerFill = document.getElementById("powerFill");
  const powerLabel = document.getElementById("powerLabel");

  // -----------------------------
  // INPUT
  // -----------------------------
  const input = {
    dx: 0,
    dy: 0,
    attack: false,
    shoot: false
  };

  const keys = {};

  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  function bindButton(id, down, up) {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("touchstart", (e) => {
      down();
      e.preventDefault();
    }, { passive: false });

    el.addEventListener("touchend", (e) => {
      up();
      e.preventDefault();
    }, { passive: false });

    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    el.addEventListener("mouseleave", up);
  }

  // Button support
  bindButton("btnA", () => input.attack = true, () => input.attack = false);
  bindButton("btnB", () => input.shoot = true, () => input.shoot = false);

  // Old D-pad support if your HTML has dpad-up/down/left/right
  bindButton("dpad-up", () => input.dy = -1, () => { if (input.dy < 0) input.dy = 0; });
  bindButton("dpad-down", () => input.dy = 1, () => { if (input.dy > 0) input.dy = 0; });
  bindButton("dpad-left", () => input.dx = -1, () => { if (input.dx < 0) input.dx = 0; });
  bindButton("dpad-right", () => input.dx = 1, () => { if (input.dx > 0) input.dx = 0; });

  // Joystick support
  const joystick = document.getElementById("joystick");
  const stick = document.getElementById("stick");
  let joyActive = false;
  let joyCenter = { x: 0, y: 0 };

  function setStick(x, y) {
    if (!stick) return;
    stick.style.transform = `translate(${x}px, ${y}px)`;
  }

  if (joystick) {
    joystick.addEventListener("touchstart", (e) => {
      joyActive = true;
      const r = joystick.getBoundingClientRect();
      joyCenter.x = r.left + r.width / 2;
      joyCenter.y = r.top + r.height / 2;
      handleJoystick(e.touches[0]);
      e.preventDefault();
    }, { passive: false });

    joystick.addEventListener("touchmove", (e) => {
      if (!joyActive) return;
      handleJoystick(e.touches[0]);
      e.preventDefault();
    }, { passive: false });

    joystick.addEventListener("touchend", () => {
      joyActive = false;
      input.dx = 0;
      input.dy = 0;
      setStick(0, 0);
    });
  }

  function handleJoystick(touch) {
    const r = joystick.getBoundingClientRect();
    const max = Math.min(r.width, r.height) * 0.35;

    let dx = touch.clientX - joyCenter.x;
    let dy = touch.clientY - joyCenter.y;
    const d = Math.hypot(dx, dy);

    if (d > max) {
      dx = dx / d * max;
      dy = dy / d * max;
    }

    setStick(dx, dy);

    input.dx = dx / max;
    input.dy = dy / max;
  }

  // -----------------------------
  // HELPERS
  // -----------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function hit(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h / 2 < b.y + b.h / 2 &&
      a.y + a.h / 2 > b.y - b.h / 2
    );
  }

  // -----------------------------
  // STATE
  // -----------------------------
  const Mode = {
    PLAY: "PLAY",
    FINAL: "FINAL",
    NPC_IN: "NPC_IN",
    TALK: "TALK",
    EXIT: "EXIT",
    FIREWORKS: "FIREWORKS",
    VICTORY: "VICTORY"
  };

  const state = {
    last: performance.now(),
    mode: Mode.PLAY,
    timeLeft: STAGE_TIME,

    score: 0,

    player: {
      x: W * 0.22,
      y: GROUND_Y,
      w: 48,
      h: 34,
      dir: 1,
      hp: HP_MAX,
      lives: 3,
      invuln: 0,
      headbuttCd: 0,
      headbutting: 0,
      ray: 0,
      giant: 0,
      shotCd: 0,
      normalKillsSincePower: 0
    },

    enemies: [],
    playerShots: [],
    enemyShots: [],
    fx: [],

    spawnTimer: 0.5,

    finalSpawned: 0,
    finalSpawnCd: 0,
    endingStarted: false,

    npc: {
      active: false,
      x: -80,
      y: GROUND_Y,
      vx: 260
    },

    dialogTimer: 0,

    fireworksTimer: 0,
    fireworksCd: 0,
    fireworks: [],

    exitTimer: 0
  };

  // -----------------------------
  // SPAWN
  // -----------------------------
  function countRayEnemies() {
    return state.enemies.filter(e => e.ray).length;
  }

  function spawnEnemy(ray = false) {
    const fromLeft = Math.random() < 0.5;

    state.enemies.push({
      x: fromLeft ? -70 : W + 70,
      y: rand(MIN_Y + 8, MAX_Y),
      w: 48,
      h: 34,
      ray,
      hp: ray ? 3 : 1,
      shootCd: rand(1.0, 1.6),
      sep: rand(0.8, 1.2)
    });
  }

  function updateSpawning(dt) {
    if (state.mode !== Mode.PLAY) return;

    state.spawnTimer -= dt;

    if (state.spawnTimer <= 0) {
      state.spawnTimer = SPAWN_INTERVAL;

      if (state.enemies.length >= MAX_ENEMIES) return;

      const wantsRay = Math.random() < 0.18;

      if (wantsRay && countRayEnemies() < MAX_RAY_NORMAL) {
        spawnEnemy(true);
      } else {
        spawnEnemy(false);
      }
    }
  }

  function updateFinalWave(dt) {
    if (state.mode !== Mode.FINAL) return;
    if (state.endingStarted) return;

    state.finalSpawnCd -= dt;

    if (state.finalSpawned < FINAL_RAY_COUNT && state.finalSpawnCd <= 0) {
      spawnEnemy(true);
      state.finalSpawned += 1;
      state.finalSpawnCd = 0.9;
    }

    if (state.finalSpawned >= FINAL_RAY_COUNT && state.enemies.length === 0) {
      beginEnding();
    }
  }

  // -----------------------------
  // DAMAGE / RESTART
  // -----------------------------
  function damagePlayer(amount) {
    const p = state.player;

    if (state.mode !== Mode.PLAY && state.mode !== Mode.FINAL) return;
    if (p.invuln > 0) return;

    p.hp -= amount;
    p.invuln = INVULN_AFTER_HIT;

    burst(p.x, p.y, 12, 0, 360);

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

  function restartGame() {
    state.mode = Mode.PLAY;
    state.timeLeft = STAGE_TIME;
    state.score = 0;

    state.player.x = W * 0.22;
    state.player.y = GROUND_Y;
    state.player.dir = 1;
    state.player.hp = HP_MAX;
    state.player.lives = 3;
    state.player.invuln = 0;
    state.player.headbuttCd = 0;
    state.player.headbutting = 0;
    state.player.ray = 0;
    state.player.giant = 0;
    state.player.shotCd = 0;
    state.player.normalKillsSincePower = 0;

    state.enemies.length = 0;
    state.playerShots.length = 0;
    state.enemyShots.length = 0;
    state.fx.length = 0;

    state.spawnTimer = 0.5;

    state.finalSpawned = 0;
    state.finalSpawnCd = 0;
    state.endingStarted = false;

    state.npc.active = false;
    state.npc.x = -80;

    state.dialogTimer = 0;

    state.fireworksTimer = 0;
    state.fireworksCd = 0;
    state.fireworks.length = 0;

    state.exitTimer = 0;

    spawnEnemy(false);
  }

  // -----------------------------
  // COMBAT
  // -----------------------------
  function doHeadbutt() {
    const p = state.player;

    if (p.headbuttCd > 0) return;

    p.headbuttCd = HEADBUTT_CD;
    p.headbutting = HEADBUTT_WINDOW;

    const box = {
      x: p.x + p.dir * (p.w / 2 + HEADBUTT_RANGE / 2),
      y: p.y,
      w: HEADBUTT_RANGE,
      h: p.h
    };

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];

      if (hit(box, e)) {
        killEnemy(i);
      }
    }
  }

  function shootPlayerRay() {
    const p = state.player;

    if (p.ray <= 0) return;
    if (p.shotCd > 0) return;

    p.shotCd = PLAYER_SHOT_CD;

    state.playerShots.push({
      x: p.x + p.dir * 34,
      y: p.y - 12,
      vx: p.dir * 460,
      vy: 0,
      r: p.giant > 0 ? 10 : 6
    });

    burst(p.x + p.dir * 34, p.y - 12, 6, 180, 260);
  }

  function killEnemy(index) {
    const p = state.player;
    const e = state.enemies[index];

    burst(e.x, e.y, 18, e.ray ? 0 : 90, e.ray ? 360 : 160);

    state.score += e.ray ? 50 : 10;

    const powered = p.ray > 0 || p.giant > 0;

    if (e.ray && !powered && p.ray <= 0) {
      p.ray = RAY_DURATION;
    }

    if (!powered) {
      p.normalKillsSincePower += 1;

      if (p.normalKillsSincePower >= 20) {
        p.normalKillsSincePower = 0;
        p.giant = GIANT_DURATION;
      }
    }

    state.enemies.splice(index, 1);

    if (state.mode === Mode.FINAL && state.finalSpawned >= FINAL_RAY_COUNT && state.enemies.length === 0) {
      beginEnding();
    }
  }

  // -----------------------------
  // ENDING
  // -----------------------------
  function beginEnding() {
    if (state.endingStarted) return;

    state.endingStarted = true;
    state.mode = Mode.NPC_IN;

    state.playerShots.length = 0;
    state.enemyShots.length = 0;

    state.npc.active = true;
    state.npc.x = -90;
    state.npc.y = GROUND_Y;
    state.npc.vx = 260;

    state.dialogTimer = 0;
  }

  function updateEnding(dt) {
    const p = state.player;

    if (state.mode === Mode.NPC_IN) {
      state.npc.x += state.npc.vx * dt;

      const stopX = p.x - 110;

      if (state.npc.x >= stopX) {
        state.npc.x = stopX;
        state.mode = Mode.TALK;
        state.dialogTimer = 2.5;
      }
    }

    else if (state.mode === Mode.TALK) {
      state.dialogTimer -= dt;

      if (state.dialogTimer <= 0) {
        state.mode = Mode.EXIT;
        state.exitTimer = 1.6;
      }
    }

    else if (state.mode === Mode.EXIT) {
      state.exitTimer -= dt;

      p.x += 260 * dt;
      state.npc.x = p.x - 55;
      state.npc.y = p.y - 20;

      if (state.exitTimer <= 0 || p.x > W + 100) {
        state.mode = Mode.FIREWORKS;
        state.fireworksTimer = 3.2;
        state.fireworksCd = 0;
        state.fireworks.length = 0;
      }
    }

    else if (state.mode === Mode.FIREWORKS) {
      state.fireworksTimer -= dt;
      state.fireworksCd -= dt;

      if (state.fireworksCd <= 0) {
        state.fireworksCd = rand(0.18, 0.35);
        makeFirework();
      }

      for (let i = state.fireworks.length - 1; i >= 0; i--) {
        const f = state.fireworks[i];

        f.life -= dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 80 * dt;

        if (f.life <= 0) {
          state.fireworks.splice(i, 1);
        }
      }

      if (state.fireworksTimer <= 0) {
        state.mode = Mode.VICTORY;
      }
    }
  }

  // -----------------------------
  // UPDATE
  // -----------------------------
  function update(dt) {
    const p = state.player;

    p.invuln = Math.max(0, p.invuln - dt);
    p.headbuttCd = Math.max(0, p.headbuttCd - dt);
    p.headbutting = Math.max(0, p.headbutting - dt);
    p.shotCd = Math.max(0, p.shotCd - dt);

    if (p.ray > 0) p.ray = Math.max(0, p.ray - dt);
    if (p.giant > 0) p.giant = Math.max(0, p.giant - dt);

    if (
      state.mode === Mode.NPC_IN ||
      state.mode === Mode.TALK ||
      state.mode === Mode.EXIT ||
      state.mode === Mode.FIREWORKS ||
      state.mode === Mode.VICTORY
    ) {
      updateEnding(dt);
      updateFX(dt);
      updateHUD();
      return;
    }

    let dx = input.dx;
    let dy = input.dy;

    if (keys["arrowleft"] || keys["a"]) dx = -1;
    if (keys["arrowright"] || keys["d"]) dx = 1;
    if (keys["arrowup"] || keys["w"]) dy = -1;
    if (keys["arrowdown"] || keys["s"]) dy = 1;

    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }

    if (input.attack || keys[" "]) doHeadbutt();
    if (input.shoot || keys["enter"]) shootPlayerRay();

    const sizeBoost = p.giant > 0 ? 1.12 : 1;

    p.x += dx * PLAYER_SPEED * sizeBoost * dt;
    p.y += dy * PLAYER_SPEED * 0.65 * sizeBoost * dt;

    p.x = clamp(p.x, 28, W - 28);
    p.y = clamp(p.y, MIN_Y, MAX_Y);

    if (Math.abs(dx) > 0.1) p.dir = dx > 0 ? 1 : -1;

    if (state.mode === Mode.PLAY) {
      state.timeLeft -= dt;

      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.mode = Mode.FINAL;
        state.finalSpawned = 0;
        state.finalSpawnCd = 0;
      } else {
        updateSpawning(dt);
      }
    }

    updateFinalWave(dt);
    updateEnemies(dt);
    updateShots(dt);
    updateFX(dt);
    updateHUD();
  }

  function updateEnemies(dt) {
    const p = state.player;

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];

      const dirX = p.x >= e.x ? 1 : -1;
      const targetX = p.x - dirX * (36 + 18 * e.sep);

      e.x += clamp(targetX - e.x, -1, 1) * ENEMY_SPEED * dt;
      e.y += clamp(p.y - e.y, -1, 1) * ENEMY_Y_SPEED * dt;
      e.y = clamp(e.y, MIN_Y + 4, MAX_Y);

      if (e.ray) {
        e.shootCd -= dt;

        if (e.shootCd <= 0) {
          e.shootCd = rand(1.0, 1.6);

          const sx = e.x + dirX * 32;
          const sy = e.y - 14;
          const angle = Math.atan2((p.y - 10) - sy, p.x - sx);

          state.enemyShots.push({
            x: sx,
            y: sy,
            vx: Math.cos(angle) * 340,
            vy: Math.sin(angle) * 340,
            r: 6,
            hue: 0
          });
        }
      }

      if (hit(p, e)) {
        if (p.headbutting > 0) {
          killEnemy(i);
        } else {
          damagePlayer(DMG_CONTACT);
          p.x += (p.x >= e.x ? 1 : -1) * 24;
          p.x = clamp(p.x, 28, W - 28);
        }
      }
    }
  }

  function updateShots(dt) {
    const p = state.player;

    for (let i = state.playerShots.length - 1; i >= 0; i--) {
      const s = state.playerShots[i];

      s.x += s.vx * dt;

      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];

        const dx = e.x - s.x;
        const dy = (e.y - 12) - s.y;
        const rr = s.r + 22;

        if (dx * dx + dy * dy <= rr * rr) {
          e.hp -= p.giant > 0 ? 2 : 1;
          state.playerShots.splice(i, 1);
          burst(s.x, s.y, 8, 180, 260);

          if (e.hp <= 0) killEnemy(j);

          break;
        }
      }

      if (s.x < -100 || s.x > W + 100) {
        state.playerShots.splice(i, 1);
      }
    }

    for (let i = state.enemyShots.length - 1; i >= 0; i--) {
      const s = state.enemyShots[i];

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      state.fx.push({
        x: s.x,
        y: s.y,
        vx: rand(-20, 20),
        vy: rand(-20, 20),
        life: 0.15,
        hue: 0
      });

      const shotBox = {
        x: s.x,
        y: s.y,
        w: s.r * 2,
        h: s.r * 2
      };

      if (hit(p, shotBox)) {
        damagePlayer(DMG_LASER);
        state.enemyShots.splice(i, 1);
        continue;
      }

      if (s.x < -100 || s.x > W + 100 || s.y < -100 || s.y > H + 100) {
        state.enemyShots.splice(i, 1);
      }
    }
  }

  function updateFX(dt) {
    for (let i = state.fx.length - 1; i >= 0; i--) {
      const f = state.fx[i];

      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 120 * dt;

      if (f.life <= 0) {
        state.fx.splice(i, 1);
      }
    }
  }

  function updateHUD() {
    const p = state.player;

    if (hudLives) hudLives.textContent = `🦄 x ${p.lives}`;
    if (hudScore) hudScore.textContent = `Score: ${state.score}`;
    if (hudTime) hudTime.textContent = `Time: ${Math.ceil(state.timeLeft)}s`;

    if (powerFill) {
      let percent = 0;
      let label = "Power";

      if (p.ray > 0) {
        percent = p.ray / RAY_DURATION;
        label = "Power ✨ Ray";
      } else if (p.giant > 0) {
        percent = p.giant / GIANT_DURATION;
        label = "Power 💪 Giant";
      } else {
        percent = p.normalKillsSincePower / 20;
      }

      powerFill.style.width = `${Math.floor(clamp(percent, 0, 1) * 100)}%`;
      if (powerLabel) powerLabel.textContent = label;
    }
  }

  // -----------------------------
  // DRAW
  // -----------------------------
  function draw() {
    drawBackground();
    drawHealthBar();

    for (const e of state.enemies) drawZombieUnicorn(e);
    drawShots();
    drawFX();
    drawPlayerUnicorn();

    drawNPC();
    drawDialog();
    drawFireworks();

    if (state.player.invuln > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, 0, W, H);
    }

    drawVersion();
  }

  function drawBackground() {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#7ed6ff");
    grad.addColorStop(0.45, "#d8f5ff");
    grad.addColorStop(1, "#a8f0b4");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Park hills
    ctx.fillStyle = "#5ed672";
    ctx.beginPath();
    ctx.arc(W * 0.18, GROUND_Y + 50, 170, Math.PI, 0);
    ctx.arc(W * 0.50, GROUND_Y + 55, 220, Math.PI, 0);
    ctx.arc(W * 0.82, GROUND_Y + 50, 170, Math.PI, 0);
    ctx.fill();

    // Rainbow
    drawRainbow(W * 0.67, GROUND_Y + 28, 220);

    // Trees
    for (let x = 50; x < W; x += 180) {
      drawTree(x, GROUND_Y - 26);
    }

    // Grass
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(0, GROUND_Y + 8, W, H - GROUND_Y);

    // Dirt
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(0, GROUND_Y + 34, W, H - GROUND_Y - 34);
  }

  function drawRainbow(cx, cy, r) {
    const colors = ["#ff3355", "#ff9933", "#ffe34d", "#47df6a", "#39c8ff", "#8a5cff"];

    ctx.lineWidth = 15;

    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i];
      ctx.beginPath();
      ctx.arc(cx, cy, r - i * 15, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawTree(x, y) {
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(x - 8, y - 10, 16, 42);

    ctx.fillStyle = "#1fa64a";
    ctx.beginPath();
    ctx.arc(x, y - 20, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 22, y - 8, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 22, y - 8, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHealthBar() {
    const p = state.player;

    const x = 16;
    const y = 52;
    const w = 210;
    const h = 16;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, w, h);

    const frac = clamp(p.hp / HP_MAX, 0, 1);

    ctx.fillStyle = frac > 0.5 ? "#39d66b" : frac > 0.25 ? "#ffd34d" : "#ff4d4d";
    ctx.fillRect(x, y, w * frac, h);

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#111";
    ctx.font = "13px monospace";
    ctx.fillText(`HP ${Math.ceil(p.hp)}/${HP_MAX}`, x + 8, y + 13);
  }

  function drawPlayerUnicorn() {
    const p = state.player;

    const scale = p.giant > 0 ? 1.28 : 1;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.dir * scale, scale);

    // body
    ctx.fillStyle = "#ff73b7";
    ctx.fillRect(-25, -18, 50, 24);

    // legs
    ctx.fillStyle = "#ec4f9c";
    ctx.fillRect(-20, 2, 8, 18);
    ctx.fillRect(12, 2, 8, 18);

    // head
    ctx.fillStyle = "#ff73b7";
    ctx.fillRect(16, -28, 25, 22);

    // nose
    ctx.fillStyle = "#ffc0dc";
    ctx.fillRect(32, -18, 12, 9);

    // horn
    ctx.fillStyle = "#ffd84d";
    ctx.beginPath();
    ctx.moveTo(30, -30);
    ctx.lineTo(36, -47);
    ctx.lineTo(42, -30);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = "#111";
    ctx.fillRect(30, -22, 4, 4);

    // mane
    ctx.fillStyle = "#39c8ff";
    ctx.fillRect(-22, -30, 12, 14);
    ctx.fillStyle = "#8a5cff";
    ctx.fillRect(-10, -30, 12, 14);
    ctx.fillStyle = "#ffe34d";
    ctx.fillRect(2, -30, 12, 14);

    // tail
    ctx.fillStyle = "#39c8ff";
    ctx.fillRect(-36, -15, 14, 8);
    ctx.fillStyle = "#8a5cff";
    ctx.fillRect(-40, -7, 18, 8);

    // ray icon above player
    if (p.ray > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-12, -58, 24, 10);
      ctx.fillStyle = "#39c8ff";
      ctx.fillRect(-10, -56, 20, 6);
    }

    ctx.restore();
  }

  function drawZombieUnicorn(e) {
    const dir = state.player.x >= e.x ? 1 : -1;

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(dir, 1);

    const body = e.ray ? "#44e06d" : "#58c96a";
    const dark = e.ray ? "#198a3a" : "#2b8a45";

    // body
    ctx.fillStyle = body;
    ctx.fillRect(-25, -18, 50, 24);

    // legs
    ctx.fillStyle = dark;
    ctx.fillRect(-20, 2, 8, 18);
    ctx.fillRect(12, 2, 8, 18);

    // head
    ctx.fillStyle = body;
    ctx.fillRect(16, -28, 25, 22);

    // zombie nose
    ctx.fillStyle = "#c8ffce";
    ctx.fillRect(32, -18, 12, 9);

    // horn
    ctx.fillStyle = "#ffef75";
    ctx.beginPath();
    ctx.moveTo(30, -30);
    ctx.lineTo(36, -47);
    ctx.lineTo(42, -30);
    ctx.closePath();
    ctx.fill();

    // red eyes but subtle
    ctx.fillStyle = e.ray ? "#ff1f1f" : "#7c1414";
    ctx.fillRect(30, -22, 4, 4);

    // messy mane
    ctx.fillStyle = "#133f22";
    ctx.fillRect(-18, -30, 9, 14);
    ctx.fillRect(-7, -28, 9, 12);

    // tail
    ctx.fillStyle = "#133f22";
    ctx.fillRect(-38, -13, 16, 8);

    // ray zombie marking
    if (e.ray) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(-10, -36, 20, 5);
    }

    ctx.restore();
  }

  function drawShots() {
    for (const s of state.playerShots) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#39c8ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(2, s.r - 3), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of state.enemyShots) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff3333";
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(2, s.r - 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFX() {
    for (const f of state.fx) {
      const a = clamp(f.life / 0.6, 0, 1);
      ctx.fillStyle = `hsla(${f.hue}, 90%, 60%, ${a})`;
      ctx.fillRect(f.x, f.y, 3, 3);
    }
  }

  function drawNPC() {
    if (!state.npc.active) return;

    ctx.save();
    ctx.translate(state.npc.x, state.npc.y);

    ctx.fillStyle = "#4d5cff";
    ctx.fillRect(-9, -34, 18, 26);

    ctx.fillStyle = "#ffd8b0";
    ctx.fillRect(-8, -52, 16, 16);

    ctx.fillStyle = "#222";
    ctx.fillRect(-8, -52, 16, 5);

    ctx.fillStyle = "#222";
    ctx.fillRect(-8, -8, 6, 12);
    ctx.fillRect(2, -8, 6, 12);

    ctx.restore();
  }

  function drawDialog() {
    if (state.mode !== Mode.TALK) return;

    const boxW = Math.min(W - 80, 620);
    const boxH = 92;
    const x = (W - boxW) / 2;
    const y = 76;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;

    roundRect(x, y, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.font = "18px monospace";
    ctx.fillText("You killed all of the zombies here!", x + 18, y + 34);
    ctx.fillText("Thank you! I was so scared.", x + 18, y + 62);
  }

  function drawFireworks() {
    if (state.mode !== Mode.FIREWORKS && state.mode !== Mode.VICTORY) return;

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, W, H);

    for (const f of state.fireworks) {
      const a = clamp(f.life / 1.2, 0, 1);
      ctx.fillStyle = `hsla(${f.hue}, 90%, 60%, ${a})`;
      ctx.fillRect(f.x, f.y, 4, 4);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "30px monospace";
    ctx.fillText("Victory: Stage 1 Completed!", W / 2 - 230, H / 2);
  }

  function drawVersion() {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.font = "10px monospace";
    ctx.fillText(VERSION, W - 36, H - 8);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function burst(x, y, count, hueMin, hueMax) {
    for (let i = 0; i < count; i++) {
      state.fx.push({
        x,
        y,
        vx: rand(-120, 120),
        vy: rand(-160, 40),
        life: rand(0.25, 0.6),
        hue: rand(hueMin, hueMax)
      });
    }
  }

  function makeFirework() {
    const x = rand(90, W - 90);
    const y = rand(60, H * 0.45);
    const hue = rand(0, 360);

    for (let i = 0; i < 24; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(70, 190);

      state.fireworks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.7, 1.25),
        hue
      });
    }
  }

  // -----------------------------
  // LOOP
  // -----------------------------
  function loop(now) {
    const dt = Math.min(0.033, (now - state.last) / 1000);
    state.last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // Start gentle
  spawnEnemy(false);
  updateHUD();
  requestAnimationFrame(loop);
})();