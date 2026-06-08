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
      livesEl.textContent =
        `Lives: ${player.lives} | Shield: ${player.shieldCharges}/2 | HB: ${player.headbuttStreak}/10`;
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
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(player.x - 34, player.y - 52, 68, 58);
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
