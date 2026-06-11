(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  const livesEl = document.getElementById("lives");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const powerFillEl = document.getElementById("powerFill");
  const powerLabelEl = document.getElementById("powerLabel");

  const dpad = document.getElementById("dpad");
  const btnA = document.getElementById("btnA");
  const btnB = document.getElementById("btnB");

  const music = new Audio("./bgm_main.mp3");
  music.loop = true;
  music.volume = 0.75;
  music.preload = "auto";

  function startMusic() {
    music.play().catch(() => {});
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  const GROUND_Y = Math.floor(H * 0.78);
  const MIN_Y = GROUND_Y - 58;
  const MAX_Y = GROUND_Y;

  const LEVEL_TIME = 60;
  const MAX_ENEMIES = 4;
  const FINAL_RAY_COUNT = 2;

  const HP_MAX = 2;
  const DMG_LASER = 1;
  const HEALTH_REGEN_TIME = 15;

  const RAY_TIME = 10;
  const GIANT_TIME = 20;

  const SHIELD_KILL_STREAK_NEEDED = 10;
  const MAX_SHIELDS_EARNED = 2;
  const SHIELD_MAX_CHARGES = 2;

  const DODGE_SPEED = 560;
  const DODGE_TIME = 0.2;
  const DODGE_INVULN = 0.28;
  const DODGE_COOLDOWN = 0.55;
  const DODGE_COMBO_WINDOW = 0.12;

  const input = {
    dx: 0,
    dy: 0,
    a: false,
    b: false,
    lastDirPressTime: -999,
    lastDirX: 0,
    lastDirY: 0,
    lastAPressTime: -999
  };

  const keys = {};
  const keyTimes = {};

  let gameClock = 0;
  let shootCooldown = 0;

  window.addEventListener("keydown", e => {
    startMusic();

    const k = e.key.toLowerCase();

    if (!keys[k]) {
      keyTimes[k] = gameClock;

      if (
        k === "arrowleft" ||
        k === "arrowright" ||
        k === "arrowup" ||
        k === "arrowdown" ||
        k === "w" ||
        k === "a" ||
        k === "s" ||
        k === "d"
      ) {
        input.lastDirPressTime = gameClock;

        if (k === "arrowleft" || k === "a") {
          input.lastDirX = -1;
          input.lastDirY = 0;
        }

        if (k === "arrowright" || k === "d") {
          input.lastDirX = 1;
          input.lastDirY = 0;
        }

        if (k === "arrowup" || k === "w") {
          input.lastDirX = 0;
          input.lastDirY = -1;
        }

        if (k === "arrowdown" || k === "s") {
          input.lastDirX = 0;
          input.lastDirY = 1;
        }
      }

      if (k === " ") {
        input.lastAPressTime = gameClock;
      }
    }

    keys[k] = true;
  });

  window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
  });

  window.addEventListener("touchstart", () => {
    startMusic();
  }, { passive: true });

  window.addEventListener("mousedown", () => {
    startMusic();
  });

  function bindDpad() {
    if (!dpad) return;

    dpad.querySelectorAll(".dir").forEach(btn => {
      const dx = Number(btn.dataset.dx || 0);
      const dy = Number(btn.dataset.dy || 0);

      const start = e => {
        startMusic();

        input.dx = dx;
        input.dy = dy;
        input.lastDirPressTime = gameClock;
        input.lastDirX = dx;
        input.lastDirY = dy;

        e.preventDefault();
      };

      const end = e => {
        input.dx = 0;
        input.dy = 0;
        if (e) e.preventDefault();
      };

      btn.addEventListener("touchstart", start, { passive: false });
      btn.addEventListener("touchend", end, { passive: false });
      btn.addEventListener("mousedown", start);
      btn.addEventListener("mouseup", end);
      btn.addEventListener("mouseleave", end);
    });
  }

  function bindButton(el, key) {
    if (!el) return;

    const down = e => {
      startMusic();

      if (!input[key]) {
        if (key === "a") input.lastAPressTime = gameClock;
      }

      input[key] = true;
      e.preventDefault();
    };

    const up = e => {
      input[key] = false;
      if (e) e.preventDefault();
    };

    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    el.addEventListener("mouseleave", up);
  }

  bindDpad();
  bindButton(btnA, "a");
  bindButton(btnB, "b");

  const state = {
    mode: "play",
    time: 0,
    score: 0,
    enemies: [],
    playerShots: [],
    enemyShots: [],
    particles: [],
    spawnTimer: 0,
    finalSpawned: 0,
    finalSpawnTimer: 0,
    npc: null,
    dialogTimer: 0,
    exitTimer: 0,
    fireworks: [],
    victoryTimer: 0,
    resetQueued: false
  };

  const player = {
    x: W * 0.25,
    y: GROUND_Y,
    face: 1,
    hp: HP_MAX,
    lives: 3,
    invuln: 0,
    headCd: 0,
    headTimer: 0,
    ray: 0,
    giant: 0,
    killsForGiant: 0,

    shieldCharges: 0,
    shieldsEarned: 0,
    headbuttStreak: 0,

    dodgeTimer: 0,
    dodgeCooldown: 0,
    dodgeDirX: 0,
    dodgeDirY: 0,
    actionLock: 0,

    aConsumed: false,
    regenTimer: HEALTH_REGEN_TIME
  };

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function enemyRayCount() {
    return state.enemies.filter(e => e.type === "ray").length;
  }

  function spawnEnemy(type = "normal") {
    if (state.enemies.length >= MAX_ENEMIES && state.mode !== "final") return;

    if (type === "ray" && state.mode === "play" && enemyRayCount() >= 1) {
      type = "normal";
    }

    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -50 : W + 50;

    state.enemies.push({
      x,
      y: rand(MIN_Y + 8, MAX_Y),
      w: 54,
      h: 34,
      face: fromLeft ? 1 : -1,
      type,
      hp: type === "ray" ? 2 : 1,
      shootTimer: rand(1.0, 1.6),
      sep: rand(0.8, 1.25)
    });
  }

  function addParticles(x, y, kind = "rainbow") {
    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x,
        y,
        vx: rand(-120, 120),
        vy: rand(-180, 60),
        life: rand(0.25, 0.65),
        hue:
          kind === "red"
            ? rand(0, 25)
            : kind === "shield"
              ? rand(190, 240)
              : kind === "heal"
                ? rand(90, 140)
                : rand(0, 360)
      });
    }
  }

  function clearBattlefield() {
    state.enemies.length = 0;
    state.playerShots.length = 0;
    state.enemyShots.length = 0;
    state.particles.length = 0;
    state.spawnTimer = 0.8;
  }

  function resetPlayerPosition() {
    player.x = W * 0.25;
    player.y = GROUND_Y;
    player.face = 1;
    player.hp = HP_MAX;
    player.invuln = 1.2;
    player.headCd = 0;
    player.headTimer = 0;
    player.ray = 0;
    player.giant = 0;
    player.headbuttStreak = 0;
    player.dodgeTimer = 0;
    player.dodgeCooldown = 0.25;
    player.dodgeDirX = 0;
    player.dodgeDirY = 0;
    player.actionLock = 0.25;
    player.aConsumed = false;
    player.regenTimer = HEALTH_REGEN_TIME;
  }

  function fullRestart() {
    state.mode = "play";
    state.time = 0;
    state.score = 0;
    state.enemies.length = 0;
    state.playerShots.length = 0;
    state.enemyShots.length = 0;
    state.particles.length = 0;
    state.spawnTimer = 0;
    state.finalSpawned = 0;
    state.finalSpawnTimer = 0;
    state.npc = null;
    state.dialogTimer = 0;
    state.exitTimer = 0;
    state.fireworks.length = 0;
    state.victoryTimer = 0;
    state.resetQueued = false;

    player.x = W * 0.25;
    player.y = GROUND_Y;
    player.face = 1;
    player.hp = HP_MAX;
    player.lives = 3;
    player.invuln = 1.2;
    player.headCd = 0;
    player.headTimer = 0;
    player.ray = 0;
    player.giant = 0;
    player.killsForGiant = 0;

    player.shieldCharges = 0;
    player.shieldsEarned = 0;
    player.headbuttStreak = 0;

    player.dodgeTimer = 0;
    player.dodgeCooldown = 0.25;
    player.dodgeDirX = 0;
    player.dodgeDirY = 0;
    player.actionLock = 0.25;
    player.aConsumed = false;
    player.regenTimer = HEALTH_REGEN_TIME;

    spawnEnemy("normal");
  }

  function safeLifeReset() {
    state.resetQueued = false;

    clearBattlefield();
    resetPlayerPosition();

    if (state.mode === "play") {
      spawnEnemy("normal");
    }
  }

  function awardShieldIfReady() {
    if (
      player.headbuttStreak >= SHIELD_KILL_STREAK_NEEDED &&
      player.shieldsEarned < MAX_SHIELDS_EARNED
    ) {
      player.headbuttStreak = 0;
      player.shieldsEarned += 1;
      player.shieldCharges = SHIELD_MAX_CHARGES;
      addParticles(player.x, player.y - 24, "shield");
    }
  }

  function shieldBlockLaser() {
    if (player.shieldCharges <= 0) return false;

    player.shieldCharges -= 1;
    player.headbuttStreak = 0;
    player.invuln = 0.25;
    addParticles(player.x, player.y - 24, "shield");
    return true;
  }

  function shieldBlockContact() {
    if (player.shieldCharges <= 0) return false;

    player.shieldCharges = 0;
    player.headbuttStreak = 0;
    player.invuln = 0.4;
    addParticles(player.x, player.y - 24, "shield");
    return true;
  }

  function loseLife() {
    if (player.invuln > 0) return;
    if (state.mode !== "play" && state.mode !== "final") return;

    player.lives -= 1;
    player.headbuttStreak = 0;
    player.regenTimer = HEALTH_REGEN_TIME;
    addParticles(player.x, player.y, "red");

    if (player.lives <= 0) {
      fullRestart();
      return;
    }

    state.resetQueued = true;
  }

  function damagePlayerByLaser() {
    if (player.invuln > 0) return;
    if (state.mode !== "play" && state.mode !== "final") return;

    if (shieldBlockLaser()) return;

    player.hp -= DMG_LASER;
    player.invuln = 0.35;
    player.headbuttStreak = 0;
    player.regenTimer = HEALTH_REGEN_TIME;
    addParticles(player.x, player.y, "red");

    if (player.hp <= 0) {
      player.invuln = 0;
      loseLife();
    }
  }

  function updateHealthRegen(dt) {
    if (state.mode !== "play" && state.mode !== "final") return;

    if (player.hp < HP_MAX && player.lives > 0) {
      player.regenTimer -= dt;

      if (player.regenTimer <= 0) {
        player.hp = Math.min(HP_MAX, player.hp + 1);
        player.regenTimer = HEALTH_REGEN_TIME;
        addParticles(player.x, player.y - 24, "heal");
      }
    } else {
      player.regenTimer = HEALTH_REGEN_TIME;
    }
  }

  function killEnemy(index, method = "other") {
    if (index < 0 || index >= state.enemies.length) return;

    const e = state.enemies[index];
    const powered = player.ray > 0 || player.giant > 0;

    addParticles(e.x, e.y, e.type === "ray" ? "rainbow" : "red");

    state.score += e.type === "ray" ? 40 : 10;

    if (method === "headbutt") {
      player.headbuttStreak += 1;
      awardShieldIfReady();
    } else {
      player.headbuttStreak = 0;
    }

    if (!powered) {
      if (e.type === "ray") {
        player.ray = RAY_TIME;
      }

      player.killsForGiant += 1;

      if (player.killsForGiant >= 20) {
        player.killsForGiant = 0;
        player.giant = GIANT_TIME;
      }
    }

    state.enemies.splice(index, 1);

    if (
      state.mode === "final" &&
      state.finalSpawned >= FINAL_RAY_COUNT &&
      state.enemies.length === 0
    ) {
      startNpcScene();
    }
  }

  function dodge(dx, dy) {
    if (player.dodgeCooldown > 0) return;
    if (player.actionLock > 0) return;

    const mag = Math.hypot(dx, dy);
    if (mag <= 0) return;

    player.dodgeDirX = dx / mag;
    player.dodgeDirY = dy / mag;

    player.dodgeTimer = DODGE_TIME;
    player.dodgeCooldown = DODGE_COOLDOWN;
    player.invuln = Math.max(player.invuln, DODGE_INVULN);
    player.headTimer = 0;
    player.headCd = Math.max(player.headCd, 0.12);
    player.actionLock = 0.12;

    addParticles(player.x, player.y - 20, "shield");
  }

  function headbutt() {
    if (player.headCd > 0) return;
    if (player.dodgeTimer > 0) return;
    if (player.actionLock > 0) return;

    player.headCd = 0.24;
    player.headTimer = 0.15;
    player.actionLock = 0.08;

    const hitbox = {
      x: player.x + player.face * 38 - 25,
      y: player.y - 30,
      w: 70,
      h: 48
    };

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const box = {
        x: e.x - 27,
        y: e.y - 34,
        w: e.w,
        h: e.h
      };

      if (rectsOverlap(hitbox, box)) {
        killEnemy(i, "headbutt");
      }
    }
  }

  function currentDirection() {
    let dx = input.dx;
    let dy = input.dy;

    if (keys.arrowleft || keys.a) dx = -1;
    if (keys.arrowright || keys.d) dx = 1;
    if (keys.arrowup || keys.w) dy = -1;
    if (keys.arrowdown || keys.s) dy = 1;

    const mag = Math.hypot(dx, dy);

    if (mag > 0) {
      return {
        dx: dx / mag,
        dy: dy / mag
      };
    }

    return { dx: 0, dy: 0 };
  }

  function handleAAction() {
    const aDown = input.a || keys[" "];

    if (!aDown) {
      player.aConsumed = false;
      return;
    }

    if (player.aConsumed) return;

    player.aConsumed = true;

    const dir = currentDirection();

    const comboHappened =
      dir.dx !== 0 || dir.dy !== 0
        ? Math.abs(input.lastAPressTime - input.lastDirPressTime) <= DODGE_COMBO_WINDOW
        : false;

    if (comboHappened) {
      dodge(input.lastDirX, input.lastDirY);
      return;
    }

    headbutt();
  }

  function playerShoot() {
    if (player.ray <= 0) return;

    state.playerShots.push({
      x: player.x + player.face * 34,
      y: player.y - 32,
      vx: player.face * (player.giant > 0 ? 520 : 420),
      r: player.giant > 0 ? 9 : 6,
      life: 1
    });
  }

  function startFinalWave() {
    state.mode = "final";
    state.enemies.length = 0;
    state.enemyShots.length = 0;
    state.playerShots.length = 0;
    state.finalSpawned = 0;
    state.finalSpawnTimer = 0;
  }

  function startNpcScene() {
    state.mode = "npc";
    state.enemies.length = 0;
    state.enemyShots.length = 0;
    state.playerShots.length = 0;

    const fromLeft = player.x > W / 2;

    state.npc = {
      x: fromLeft ? -30 : W + 30,
      y: GROUND_Y,
      vx: fromLeft ? 160 : -160,
      face: fromLeft ? 1 : -1
    };
  }

  function update(dt) {
    gameClock += dt;

    if (state.resetQueued) {
      safeLifeReset();
      updateHud();
      return;
    }

    player.invuln = Math.max(0, player.invuln - dt);
    player.headCd = Math.max(0, player.headCd - dt);
    player.headTimer = Math.max(0, player.headTimer - dt);
    player.dodgeTimer = Math.max(0, player.dodgeTimer - dt);
    player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);
    player.actionLock = Math.max(0, player.actionLock - dt);
    shootCooldown = Math.max(0, shootCooldown - dt);

    if (player.ray > 0) player.ray = Math.max(0, player.ray - dt);
    if (player.giant > 0) player.giant = Math.max(0, player.giant - dt);

    updateHealthRegen(dt);

    if (state.mode === "play" || state.mode === "final") {
      const dir = currentDirection();

      const speed = player.giant > 0 ? 250 : 220;

      if (player.dodgeTimer > 0) {
        player.x += player.dodgeDirX * DODGE_SPEED * dt;
        player.y += player.dodgeDirY * DODGE_SPEED * dt;
      } else {
        player.x += dir.dx * speed * dt;
        player.y += dir.dy * speed * 0.72 * dt;
      }

      player.x = clamp(player.x, 25, W - 25);
      player.y = clamp(player.y, MIN_Y, MAX_Y);

      if (dir.dx !== 0 && player.dodgeTimer <= 0) {
        player.face = dir.dx > 0 ? 1 : -1;
      }

      handleAAction();

      if ((input.b || keys.enter) && shootCooldown <= 0) {
        playerShoot();
        shootCooldown = 0.18;
      }
    }

    if (state.mode === "play") {
      state.time += dt;

      if (state.time >= LEVEL_TIME) {
        startFinalWave();
      } else {
        state.spawnTimer -= dt;

        if (state.spawnTimer <= 0 && state.enemies.length < MAX_ENEMIES) {
          const wantRay = Math.random() < 0.2;
          spawnEnemy(wantRay ? "ray" : "normal");
          state.spawnTimer = rand(0.75, 1.2);
        }
      }
    }

    if (state.mode === "final") {
      state.finalSpawnTimer -= dt;

      if (state.finalSpawned < FINAL_RAY_COUNT && state.finalSpawnTimer <= 0) {
        spawnEnemy("ray");
        state.finalSpawned += 1;
        state.finalSpawnTimer = 0.9;
      }

      if (state.finalSpawned >= FINAL_RAY_COUNT && state.enemies.length === 0) {
        startNpcScene();
      }
    }

    updateEnemies(dt);
    if (state.resetQueued) return;

    updateShots(dt);
    if (state.resetQueued) return;

    updateParticles(dt);
    updateEnding(dt);
    updateHud();
  }

  function updateEnemies(dt) {
    if (state.mode !== "play" && state.mode !== "final") return;

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];

      const dx = player.x - e.x;
      const dy = player.y - e.y;

      e.face = dx >= 0 ? 1 : -1;

      const stopDistance = 28 + e.sep * 16;

      if (Math.abs(dx) > stopDistance) {
        e.x += Math.sign(dx) * 105 * dt;
      }

      if (Math.abs(dy) > 3) {
        e.y += Math.sign(dy) * 70 * dt;
      }

      e.y = clamp(e.y, MIN_Y + 6, MAX_Y);

      if (e.type === "ray") {
        e.shootTimer -= dt;

        if (e.shootTimer <= 0) {
          const sx = e.x + e.face * 28;
          const sy = e.y - 34;
          const angle = Math.atan2(player.y - 28 - sy, player.x - sx);

          state.enemyShots.push({
            x: sx,
            y: sy,
            vx: Math.cos(angle) * 290,
            vy: Math.sin(angle) * 290,
            r: 6,
            life: 2
          });

          e.shootTimer = rand(0.9, 1.4);
        }
      }

      if (player.dodgeTimer > 0) {
        continue;
      }

      const pBox = {
        x: player.x - 24,
        y: player.y - 34,
        w: 48,
        h: 40
      };

      const eBox = {
        x: e.x - 27,
        y: e.y - 34,
        w: e.w,
        h: e.h
      };

      if (rectsOverlap(pBox, eBox)) {
        if (player.headTimer > 0) {
          killEnemy(i, "headbutt");
        } else {
          if (shieldBlockContact()) {
            state.enemies.splice(i, 1);
          } else {
            loseLife();
            return;
          }
        }
      }
    }
  }

  function updateShots(dt) {
    for (let i = state.playerShots.length - 1; i >= 0; i--) {
      const b = state.playerShots[i];

      b.x += b.vx * dt;
      b.life -= dt;

      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];

        if (distance(b.x, b.y, e.x, e.y - 25) < b.r + 24) {
          e.hp -= 1;
          state.playerShots.splice(i, 1);

          if (e.hp <= 0) killEnemy(j, "ray");
          break;
        }
      }

      if (i < state.playerShots.length) {
        if (b.life <= 0 || b.x < -100 || b.x > W + 100) {
          state.playerShots.splice(i, 1);
        }
      }
    }

    for (let i = state.enemyShots.length - 1; i >= 0; i--) {
      const b = state.enemyShots[i];

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (distance(b.x, b.y, player.x, player.y - 24) < b.r + 19) {
        damagePlayerByLaser();
        state.enemyShots.splice(i, 1);
        if (state.resetQueued) return;
        continue;
      }

      if (
        b.life <= 0 ||
        b.x < -100 ||
        b.x > W + 100 ||
        b.y < -100 ||
        b.y > H + 100
      ) {
        state.enemyShots.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];

      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 250 * dt;

      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function updateEnding(dt) {
    if (state.mode === "npc") {
      if (!state.npc) return;

      state.npc.x += state.npc.vx * dt;

      const target = player.x + (state.npc.vx > 0 ? -70 : 70);

      if (
        (state.npc.vx > 0 && state.npc.x >= target) ||
        (state.npc.vx < 0 && state.npc.x <= target)
      ) {
        state.npc.x = target;
        state.dialogTimer = 2.5;
        state.mode = "talk";
      }
    }

    if (state.mode === "talk") {
      state.dialogTimer -= dt;

      if (state.dialogTimer <= 0) {
        state.mode = "exit";
        state.exitTimer = 1.7;
      }
    }

    if (state.mode === "exit") {
      state.exitTimer -= dt;

      player.face = 1;
      player.x += 210 * dt;

      if (state.npc) {
        state.npc.x = player.x - 15;
        state.npc.y = player.y - 18;
      }

      if (state.exitTimer <= 0 || player.x > W + 80) {
        state.mode = "fireworks";
        state.fireworks.length = 0;
        state.victoryTimer = 3.5;
      }
    }

    if (state.mode === "fireworks") {
      state.victoryTimer -= dt;

      if (Math.random() < 0.15) spawnFirework();

      for (let i = state.fireworks.length - 1; i >= 0; i--) {
        const f = state.fireworks[i];

        f.life -= dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 40 * dt;

        if (f.life <= 0) state.fireworks.splice(i, 1);
      }

      if (state.victoryTimer <= 0) {
        state.mode = "victory";
      }
    }
  }

  function spawnFirework() {
    const cx = rand(120, W - 120);
    const cy = rand(70, H * 0.48);
    const hue = rand(0, 360);

    for (let i = 0; i < 20; i++) {
      const a = (Math.PI * 2 * i) / 20;
      const s = rand(50, 120);

      state.fireworks.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.6, 1.1),
        hue
      });
    }
  }

  function updateHud() {
    if (livesEl) {
      const regenText =
        player.hp < HP_MAX
          ? ` | Regen: ${Math.ceil(player.regenTimer)}s`
          : "";

      livesEl.textContent =
        `Lives: ${player.lives} | Shield: ${player.shieldCharges}/2 | HB: ${player.headbuttStreak}/10${regenText}`;
    }

    if (scoreEl) scoreEl.textContent = `Score: ${state.score}`;

    if (timeEl) {
      const remaining =
        state.mode === "play"
          ? Math.max(0, Math.ceil(LEVEL_TIME - state.time))
          : 0;

      timeEl.textContent = `Time: ${remaining}s`;
    }

    let pct = player.killsForGiant / 20;
    let label = "Power";

    if (player.ray > 0) {
      pct = player.ray / RAY_TIME;
      label = "Ray";
    }

    if (player.giant > 0) {
      pct = player.giant / GIANT_TIME;
      label = "Giant";
    }

    if (player.dodgeCooldown > 0 && player.dodgeTimer <= 0) {
      label = "Dodge";
    }

    if (powerFillEl) {
      powerFillEl.style.width = `${Math.floor(clamp(pct, 0, 1) * 100)}%`;
    }

    if (powerLabelEl) {
      powerLabelEl.textContent = label;
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#77ccff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#a7e9ff";
    ctx.fillRect(0, 90, W, 90);

    ctx.fillStyle = "#8be37a";
    ctx.fillRect(0, H * 0.58, W, H * 0.42);

    drawRainbow(W * 0.62, GROUND_Y + 10, 240);

    drawCloud(120, 70);
    drawCloud(390, 55);
    drawCloud(750, 85);

    drawTree(90, GROUND_Y + 16);
    drawTree(820, GROUND_Y + 18);

    ctx.fillStyle = "#7a4a2a";
    ctx.fillRect(0, GROUND_Y + 20, W, H - GROUND_Y);

    ctx.fillStyle = "#29c768";
    ctx.fillRect(0, GROUND_Y + 8, W, 18);
  }

  function drawRainbow(cx, cy, r) {
    const colors = ["#ff3b64", "#ff8a00", "#ffe600", "#36dd5c", "#21c9ff", "#8a42ff"];
    ctx.lineWidth = 16;

    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i];
      ctx.beginPath();
      ctx.arc(cx, cy, r - i * 15, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawCloud(x, y) {
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillRect(x, y, 70, 22);
    ctx.fillRect(x + 15, y - 14, 42, 22);
    ctx.fillRect(x + 40, y - 6, 46, 20);
  }

  function drawTree(x, y) {
    ctx.fillStyle = "#75421f";
    ctx.fillRect(x - 8, y - 70, 16, 70);

    ctx.fillStyle = "#238b45";
    ctx.fillRect(x - 38, y - 105, 76, 35);
    ctx.fillRect(x - 28, y - 130, 56, 35);
  }

  function drawHealthBar() {
    const x = 18;
    const y = 52;
    const w = 210;
    const h = 16;

    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = player.hp > 1 ? "#2de06e" : "#ff3b3b";
    ctx.fillRect(x, y, w * clamp(player.hp / HP_MAX, 0, 1), h);

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#111";
    ctx.font = "13px monospace";
    ctx.fillText(`HP ${player.hp}/${HP_MAX}`, x + 8, y + 13);
  }

  function drawShieldAura() {
    if (player.shieldCharges <= 0) return;

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#66d9ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(player.x, player.y - 22, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawDodgeEffect() {
    if (player.dodgeTimer <= 0) return;

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(player.x - 34, player.y - 52, 68, 58);

    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#66d9ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y - 24, 38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawUnicorn(x, y, face, zombie = false, ray = false, giant = false) {
    const s = giant ? 1.35 : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * s, s);

    const body = zombie ? "#63d884" : "#ff7fbd";
    const dark = zombie ? "#299452" : "#ff4da3";

    const mane = zombie
      ? ["#bbffd1", "#7df1a5", "#44c982"]
      : ["#ff4d6d", "#ffa94d", "#ffe066", "#66ff66", "#66d9ff", "#b066ff"];

    ctx.fillStyle = body;
    ctx.fillRect(-28, -26, 50, 24);

    ctx.fillStyle = dark;
    ctx.fillRect(-20, -4, 8, 18);
    ctx.fillRect(6, -4, 8, 18);

    ctx.fillStyle = body;
    ctx.fillRect(18, -34, 28, 20);

    ctx.fillStyle = "#ffe066";
    ctx.fillRect(38, -48, 6, 16);

    for (let i = 0; i < mane.length; i++) {
      ctx.fillStyle = mane[i];
      ctx.fillRect(-24 + i * 7, -36, 8, 12);
    }

    ctx.fillStyle = zombie ? "#ff1e1e" : "#111";
    ctx.fillRect(34, -27, 4, 4);

    if (ray) {
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.fillRect(-10, -43, 26, 5);
    }

    ctx.restore();
  }

  function drawNpc() {
    if (!state.npc) return;

    const n = state.npc;

    ctx.save();
    ctx.translate(n.x, n.y);

    ctx.fillStyle = "#5137ff";
    ctx.fillRect(-10, -38, 20, 30);

    ctx.fillStyle = "#ffd6aa";
    ctx.fillRect(-8, -55, 16, 16);

    ctx.fillStyle = "#24160f";
    ctx.fillRect(-8, -57, 16, 6);

    ctx.fillStyle = "#222";
    ctx.fillRect(-8, -8, 6, 12);
    ctx.fillRect(2, -8, 6, 12);

    ctx.restore();
  }

  function drawShots() {
    for (const b of state.playerShots) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(b.x - 10, b.y - 3, 20, 6);

      ctx.fillStyle = "#66d9ff";
      ctx.fillRect(b.x - 7, b.y - 2, 14, 4);
    }

    for (const b of state.enemyShots) {
      ctx.fillStyle = "#ff2a2a";
      ctx.fillRect(b.x - 8, b.y - 3, 16, 6);

      ctx.fillStyle = "#fff";
      ctx.fillRect(b.x - 4, b.y - 2, 8, 4);
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.fillStyle = `hsla(${p.hue},90%,60%,${clamp(p.life / 0.65, 0, 1)})`;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
  }

  function drawDialog() {
    if (state.mode !== "talk") return;

    const x = 90;
    const y = 72;
    const w = W - 180;
    const h = 84;

    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#111";
    ctx.font = "20px monospace";
    ctx.fillText("You killed all of the zombies here!", x + 22, y + 35);
    ctx.fillText("Thank you! I was so scared.", x + 22, y + 62);
  }

  function drawFireworks() {
    if (state.mode !== "fireworks" && state.mode !== "victory") return;

    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(0, 0, W, H);

    for (const f of state.fireworks) {
      ctx.fillStyle = `hsla(${f.hue},90%,60%,${clamp(f.life, 0, 1)})`;
      ctx.fillRect(f.x, f.y, 4, 4);
    }

    ctx.fillStyle = "#fff";
    ctx.font = "34px monospace";
    ctx.fillText("Victory: Stage 1 Completed!", 170, 280);
  }

  function draw() {
    drawBackground();
    drawHealthBar();

    for (const e of state.enemies) {
      drawUnicorn(e.x, e.y, e.face, true, e.type === "ray", false);
    }

    drawShots();
    drawParticles();

    if (state.mode !== "fireworks" && state.mode !== "victory") {
      drawShieldAura();
      drawDodgeEffect();
      drawUnicorn(player.x, player.y, player.face, false, player.ray > 0, player.giant > 0);
    }

    drawNpc();
    drawDialog();
    drawFireworks();

    if (player.invuln > 0) {
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  fullRestart();
  requestAnimationFrame(loop);
})();
