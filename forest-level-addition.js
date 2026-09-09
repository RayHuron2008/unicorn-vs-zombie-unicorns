// Forest level only: append this block to the bottom of the existing game.js.
(() => {
  function forestRuntime() {
    const forestCode = "FRST5";
    const inForest = () => window.__uvzuCurrentLevelCode === forestCode;
    const host = () => !!window.__uvzuIsMultiplayerHost?.();
    const guest = () => !!window.__uvzuIsMultiplayerGuest?.();
    const ghost = () => !!window.__uvzuIsLocalGhost?.();
    const base = { fullRestart, safeLifeReset, startFinalWave, update, updateEnding,
      headbutt, updateShots, draw, drawBackground, updateHud };
    const copy = value => JSON.parse(JSON.stringify(value));
    const bearHP = 4, restSeconds = 2, chargeSpeed = 650;
    let runCounter = 0, lastSnapshot = 0, lastRequest = -99, requestSerial = 0;
    let nextSent = false, lastChargeHit = "", previousBear = null;
    const handledHits = new Set();
    const session = () => {
      const room = window.__uvzuTombTravelNetwork?.room?.() || {};
      return [room.createdAt || 0, room.nextLevelAt || 0, room.ghostResetAt || 0].join(":");
    };
    const fresh = () => ({ level: forestCode, run: Date.now() + "-" + (++runCounter),
      session: session(), clock: 0, playTime: 0, final: false, wave: 0,
      bear: null, gap: 0, ending: false, endTime: 0, finished: false });
    let forest = fresh();
    window.__uvzuGetForestState = () => inForest() ? forest : null;

    function pushNow() {
      if (host()) window.__uvzuMultiplayerPushEnemyState?.(state.enemies, true);
    }
    function clearHazards() {
      clearBattlefield();
      player.webbedTimer = player.webFlash = 0;
      player.webTrapX = player.webTrapY = null;
    }
    fullRestart = function() {
      base.fullRestart();
      forest = fresh();
      lastSnapshot = 0; lastRequest = -99; nextSent = false;
      lastChargeHit = ""; previousBear = null; handledHits.clear();
      if (inForest()) {
        window.__uvzuLevelTheme = "forest";
        player.y = H * 0.80;
        clearHazards();
        state.spawnTimer = 0.8;
      }
    };
    safeLifeReset = function() {
      if (!inForest() || !forest.final) return base.safeLifeReset();
      // A lost life does not bring defeated bears back.
      clearHazards(); resetPlayerPosition(); state.resetQueued = false;
    };

    function spawnBear() {
      const left = forest.wave % 2 === 1;
      forest.bear = { x: left ? -95 : W + 95, y: H * 0.79, face: left ? 1 : -1,
        mode: "enter", timer: 1, hp: bearHP, charges: 0, strike: 0, flash: 0,
        targetX: W / 2, targetY: H * 0.79, endX: W / 2, endY: H * 0.79,
        vx: 0, vy: 0, hitLocks: { host: 0, guest: 0 } };
      previousBear = null; lastChargeHit = ""; pushNow();
    }
    startFinalWave = function() {
      if (!inForest()) return base.startFinalWave();
      if (forest.final) return;
      clearHazards();
      state.mode = "final"; state.finalSpawned = 0;
      forest.final = true; forest.wave = 0;
      if (!guest()) spawnBear();
    };

    function bearBox(b) {
      const standing = b.mode === "roar";
      return { x: b.x - (standing ? 33 : 55), y: b.y - (standing ? 112 : 65),
        w: standing ? 66 : 110, h: standing ? 112 : 65 };
    }
    function headBox(p) {
      return { x: p.x + (p.face || 1) * 38 - 25, y: p.y - 30, w: 70, h: 48 };
    }
    function hurtBear(kind, role = "host") {
      const b = forest.bear;
      if (!b || b.hp <= 0 || forest.ending || b.mode === "enter" || ghost() && !host()) return;
      if (guest()) {
        if (gameClock - lastRequest < 0.22) return;
        lastRequest = gameClock;
        window.__uvzuRequestEnemyKill?.("forest_" + kind + "_" + forest.run + "_" +
          forest.wave + "_" + (++requestSerial));
        return;
      }
      if (b.hitLocks[role] > 0) return;
      b.hp = Math.max(0, b.hp - 1); b.hitLocks[role] = 0.32; b.flash = 0.16;
      addParticles(b.x, b.y - 30, "white");
      if (b.hp === 0) {
        b.mode = "defeated"; b.timer = 0.9; b.vx = b.vy = 0;
        state.score += 100;
      }
      pushNow();
    }
    headbutt = function() {
      const ready = player.headCd <= 0 && player.dodgeTimer <= 0 &&
        player.actionLock <= 0 && !ghost() && player.lives > 0;
      base.headbutt();
      if (inForest() && ready && forest.bear && rectsOverlap(headBox(player), bearBox(forest.bear))) {
        hurtBear("head");
      }
    };
    updateShots = function(dt) {
      if (inForest() && forest.bear && !forest.ending) {
        const box = bearBox(forest.bear);
        for (let i = state.playerShots.length - 1; i >= 0; i--) {
          const shot = state.playerShots[i];
          const nextX = shot.x + shot.vx * dt;
          const swept = { x: Math.min(shot.x, nextX) - shot.r, y: shot.y - shot.r,
            w: Math.abs(nextX - shot.x) + shot.r * 2, h: shot.r * 2 };
          if (rectsOverlap(swept, box)) {
            if (!ghost()) hurtBear("ray");
            state.playerShots.splice(i, 1);
          }
        }
      }
      base.updateShots(dt);
    };
    function receiveHits() {
      if (!host() || !forest.bear) return;
      for (const [id] of Object.entries(window.__uvzuGetGuestKillRequests?.() || {})) {
        const match = /^forest_(head|ray)_(\d+-\d+)_([0-2])_(\d+)$/.exec(id);
        if (!match || handledHits.has(id)) continue;
        handledHits.add(id);
        const remote = window.__uvzuGetRemotePlayer?.();
        if (match[2] === forest.run && Number(match[3]) === forest.wave &&
            remote && !remote.ghost && !remote.dead && remote.lives > 0) {
          const box = bearBox(forest.bear);
          // A little space accounts for the remote player's position arriving late.
          box.x -= 22; box.y -= 12; box.w += 44; box.h += 24;
          if (match[1] === "ray" ? remote.ray > 0 : rectsOverlap(headBox(remote), box)) {
            hurtBear(match[1], "guest");
          }
        }
        window.__uvzuClearGuestKillRequest?.(id);
      }
    }

    function target() {
      const players = [];
      if (!ghost() && player.lives > 0) players.push(player);
      const other = window.__uvzuGetRemotePlayer?.();
      if (other && !other.ghost && !other.dead && other.lives > 0 &&
          Number.isFinite(other.x) && Number.isFinite(other.y)) players.push(other);
      const b = forest.bear;
      return players.sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) -
        Math.hypot(c.x - b.x, c.y - b.y))[0] || { x: W / 2, y: H * 0.8 };
    }
    function windUp() {
      const b = forest.bear, p = target();
      b.mode = "windup"; b.timer = 0.55;
      b.targetX = clamp(p.x, 35, W - 35);
      b.targetY = clamp(p.y, H * 0.62, H - 25);
      b.face = b.targetX >= b.x ? 1 : -1;
      pushNow();
    }
    function beginCharge() {
      const b = forest.bear;
      const dx = b.targetX - b.x, dy = b.targetY - b.y;
      const length = Math.hypot(dx, dy) || 1;
      b.endX = clamp(b.targetX + (dx / length) * 145, 65, W - 65);
      b.endY = clamp(b.targetY + (dy / length) * 65, H * 0.63, H - 25);
      const travel = Math.hypot(b.endX - b.x, b.endY - b.y) || 1;
      b.vx = (b.endX - b.x) / travel * chargeSpeed;
      b.vy = (b.endY - b.y) / travel * chargeSpeed;
      b.timer = travel / chargeSpeed;
      b.mode = "charge"; b.charges++; b.strike++;
      pushNow();
    }
    function beginEnding() {
      forest.ending = true; forest.endTime = 0; forest.bear = null;
      clearHazards(); state.mode = "forestWin";
      player.headTimer = player.dodgeTimer = player.ray = player.giant = 0;
      player.invuln = 999999; pushNow();
    }
    function updateBear(dt) {
      const b = forest.bear;
      if (!b) {
        forest.gap = Math.max(0, forest.gap - dt);
        if (!forest.gap && forest.wave < 3) spawnBear();
        return;
      }
      for (const role of ["host", "guest"]) b.hitLocks[role] = Math.max(0, b.hitLocks[role] - dt);
      b.flash = Math.max(0, b.flash - dt);
      const remaining = b.timer;
      b.timer = Math.max(0, b.timer - dt);
      if (b.mode === "enter") {
        const x = forest.wave % 2 ? 110 : W - 110;
        b.x = lerp(forest.wave % 2 ? -95 : W + 95, x, 1 - b.timer);
        if (!b.timer) windUp();
      } else if (b.mode === "windup") {
        if (!b.timer) beginCharge();
      } else if (b.mode === "charge") {
        b.x += b.vx * Math.min(dt, remaining); b.y += b.vy * Math.min(dt, remaining);
        if (!b.timer) {
          b.x = b.endX; b.y = b.endY; b.vx = b.vy = 0;
          if (b.charges < 2) { b.mode = "turn"; b.timer = 0.3; }
          else { b.mode = "roar"; b.timer = 1.1; }
          pushNow();
        }
      } else if (b.mode === "turn") {
        if (!b.timer) windUp();
      } else if (b.mode === "roar") {
        if (!b.timer) { b.mode = "rest"; b.timer = restSeconds; pushNow(); }
      } else if (b.mode === "rest") {
        if (!b.timer) { b.charges = 0; windUp(); }
      } else if (b.mode === "defeated" && !b.timer) {
        forest.wave++; forest.bear = null;
        if (forest.wave === 3) beginEnding();
        else { forest.gap = 1.2; pushNow(); }
      }
    }

    function chargeHazard() {
      const b = forest.bear;
      if (!b || forest.ending) { previousBear = null; return; }
      const identity = forest.run + "_" + forest.wave + "_" + b.strike;
      const previous = previousBear?.identity === identity ? previousBear : null;
      const charging = b.mode === "charge" && b.timer > 0;
      previousBear = { identity, x: b.x, y: b.y, charging };
      if (!charging && !previous?.charging) return;
      if (identity === lastChargeHit || ghost() || player.lives <= 0 ||
          player.dodgeTimer > 0 || player.invuln > 0) return;
      // Check the path between snapshots so a fast charge cannot jump over a player.
      const ax = previous?.x ?? b.x, ay = previous?.y ?? b.y;
      const dx = b.x - ax, dy = b.y - ay;
      const u = clamp(((player.x - ax) * dx + (player.y - ay) * dy) /
        (dx * dx + dy * dy || 1), 0, 1);
      const x = ax + dx * u, y = ay + dy * u;
      if (Math.abs(player.x - x) < 64 && Math.abs(player.y - y) < 34) {
        lastChargeHit = identity;
        damagePlayerByLaser();
        player.invuln = Math.max(player.invuln, 0.75);
      }
    }
    function receiveForest() {
      if (!guest()) return;
      const packet = window.__uvzuGetMultiplayerEnemyState?.();
      if (!packet?.forest || packet.forest.level !== forestCode ||
          packet.forest.session !== session() || packet.updatedAt <= lastSnapshot) return;
      lastSnapshot = packet.updatedAt;
      const wasFinal = forest.final;
      if (packet.forest.run !== forest.run) { lastChargeHit = ""; previousBear = null; }
      forest = copy(packet.forest);
      if (forest.bear) forest.bear.hitLocks ||= { host: 0, guest: 0 };
      state.time = forest.playTime;
      state.mode = forest.ending ? "forestWin" : forest.final ? "final" : "play";
      if ((!wasFinal && forest.final) || forest.ending) clearHazards();
      else if (forest.final) state.enemies.length = 0;
    }
    function updateVictory(dt) {
      forest.endTime += dt;
      state.mode = "forestWin";
      player.invuln = 999999;
      if (ghost()) {
        window.__uvzuReviveLocalForNextLevel?.(player);
        player.hp = HP_MAX;
      }
      if (forest.endTime >= 9 && !forest.finished && !guest()) {
        forest.finished = true;
        if (host()) window.__uvzuSignalLevelCompleted?.();
        pushNow();
      }
    }

    function continueFromCity() {
      if (window.__uvzuCurrentLevelCode !== "CITY3" ||
          !window.__uvzuGetDowntownState?.()?.finished || nextSent || guest()) return;
      nextSent = true;
      if (host()) window.__uvzuSignalNextLevel?.(forestCode);
      else {
        window.__uvzuCurrentLevelCode = forestCode;
        window.__uvzuLevelTheme = "forest";
        window.__uvzuUpdateLevelMusic?.();
        fullRestart();
      }
    }
    update = function(dt) {
      if (inForest()) receiveForest();
      base.update(dt);
      continueFromCity();
      if (!inForest()) return;
      forest.clock += dt; forest.playTime = state.time;
      if (forest.ending) updateVictory(dt);
      else if (forest.final) {
        if (!guest()) { updateBear(dt); receiveHits(); }
        else if (forest.bear?.mode === "charge" && forest.bear.timer > 0) {
          const b = forest.bear, step = Math.min(dt, b.timer);
          b.x += b.vx * step; b.y += b.vy * step;
          b.timer = Math.max(0, b.timer - dt);
        }
        chargeHazard();
      }
      updateHud();
    };
    updateEnding = function(dt) {
      if (!inForest()) base.updateEnding(dt);
    };
    updateHud = function() {
      base.updateHud();
      if (!inForest()) return;
      if (forest.ending) timeEl.textContent = "Forest saved!";
      else if (forest.final) timeEl.textContent = "Bear " + Math.min(3, forest.wave + 1) + "/3";
    };

    const blend = (a, b, t) => {
      const rgb = value => value.match(/\w\w/g).map(n => parseInt(n, 16));
      const x = rgb(a), y = rgb(b);
      return "rgb(" + x.map((v, i) => Math.round(lerp(v, y[i], t))).join(",") + ")";
    };
    const sunAmount = () => forest.ending ? clamp((forest.endTime - 0.4) / 4, 0, 1) : 0;
    const rect = (x, y, w, h, color) => {
      ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    function polygon(points, color) {
      ctx.fillStyle = color; ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath(); ctx.fill();
    }
    function tree(x, ground, height, width, index, layer, sun) {
      const gust = Math.sin(forest.clock * 1.7 + index * 0.8) * 0.045 +
        Math.sin(forest.clock * 0.63 + index) * 0.045;
      ctx.save(); ctx.translate(x, ground);
      ctx.transform(1, 0, -(gust + 0.04) * (1 - sun * 0.88), 1, 0, 0);
      const trunk = layer === 0 ? blend("526c72", "96b5a2", sun) : blend("393e35", "72603d", sun);
      rect(-width * 0.09, -height * 0.74, width * 0.18, height * 0.74, trunk);
      if (layer > 0) rect(-width * 0.055, -height * 0.69, width * 0.045, height * 0.69, blend("676043", "ac9760", sun));
      for (let tier = 0; tier < 5; tier++) {
        const top = -height + tier * height * 0.128;
        const span = width * (0.35 + tier * 0.13);
        const dark = layer === 0 ? blend("456570", "8eb4a0", sun) : blend("234c49", "356e48", sun);
        const light = layer === 0 ? blend("547780", "a0c6ad", sun) : blend("39675b", "619953", sun);
        polygon([[0, top], [-span * 0.38, top + height * 0.13],
          [-span * 0.65, top + height * 0.20], [-span * 0.36, top + height * 0.20],
          [-span * 0.75, top + height * 0.30], [span * 0.76, top + height * 0.30],
          [span * 0.41, top + height * 0.20], [span * 0.63, top + height * 0.20]], dark);
        polygon([[0, top + 3], [-span * 0.4, top + height * 0.16],
          [-span * 0.19, top + height * 0.15], [-span * 0.52, top + height * 0.25],
          [-span * 0.05, top + height * 0.21]], light);
      }
      ctx.restore();
    }
    function drawForest() {
      const sun = sunAmount(), t = forest.clock;
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.65);
      sky.addColorStop(0, blend("2d4659", "82bfda", sun));
      sky.addColorStop(1, blend("839c9b", "e2e4b2", sun));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (sun > 0) {
        ctx.save(); ctx.globalAlpha = sun;
        ctx.fillStyle = "#fff6bd"; ctx.beginPath(); ctx.arc(W * 0.72, H * 0.18, 31, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,234,166,.12)";
        ctx.beginPath(); ctx.arc(W * 0.72, H * 0.18, 56, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.save(); ctx.globalAlpha = 0.78 * (1 - sun);
      for (let i = 0; i < 12; i++) {
        const x = ((i * 127 + t * 15) % (W + 230)) - 120;
        rect(x, 28 + i % 3 * 17, 180, 24, i % 2 ? "#455c6b" : "#3d5263");
        rect(x + 23, 13 + i % 3 * 17, 104, 20, "#455c6b");
      }
      ctx.restore();
      polygon([[0, H * 0.5], [W * 0.17, H * 0.31], [W * 0.37, H * 0.47],
        [W * 0.64, H * 0.3], [W, H * 0.47], [W, H * 0.63], [0, H * 0.63]], blend("648079", "93b384", sun));
      for (let i = 0; i < 18; i++) tree(i * W / 17 - 30, H * 0.59,
        170 + i * 41 % 90, 56 + i % 3 * 12, i, 0, sun);
      rect(0, H * 0.57, W, H * 0.43, blend("53654a", "8caa54", sun));
      for (let i = 0; i < 8; i++) tree(i * W / 7 - 25, H * 0.62,
        265 + i * 37 % 75, 125 + i % 2 * 30, i + 30, 1, sun);
      polygon([[0, H * 0.69], [W * 0.2, H * 0.65], [W * 0.45, H * 0.70],
        [W * 0.74, H * 0.66], [W, H * 0.7], [W, H], [0, H]], blend("786c4f", "b6a36a", sun));
      rect(0, H * 0.89, W, H * 0.11, blend("69644a", "a08f58", sun));
      for (let i = 0; i < 105; i++) {
        const x = (i * 113 + 31) % W, y = H * 0.69 + (i * 37 % Math.floor(H * 0.30));
        rect(x, y, 3 + i % 9, 2, i % 3 ? blend("635e48", "938651", sun) : blend("9a956c", "d1c17f", sun));
      }
      for (let i = 0; i < 7; i++) {
        const x = (i * 149 + 55) % W, y = H * 0.73 + i % 3 * 39;
        ctx.fillStyle = blend("839d96", "b6bc83", sun);
        ctx.beginPath(); ctx.ellipse(x, y, 26 + i % 3 * 12, 5, 0, 0, Math.PI * 2); ctx.fill();
        rect(x - 18, y - 1, 20, 1, blend("b0c5b9", "d9d8ad", sun));
      }
      for (let i = 0; i < 36; i++) {
        const x = i * 31 - 18, y = H * 0.67 + (i % 3 - 1) * 6;
        const sway = Math.sin(t * 2.5 + i) * 6 * (1 - sun * 0.8);
        polygon([[x, y + 10], [x - 7 + sway, y - 7], [x + 3, y + 1],
          [x + 8 + sway, y - 12], [x + 11, y + 5], [x + 20 + sway, y - 2],
          [x + 17, y + 10]], blend("3e6143", "628d42", sun));
      }
      if (sun > 0.05) {
        ctx.save(); ctx.globalAlpha = sun * 0.13;
        for (let i = 0; i < 3; i++) polygon([[W * 0.72 + i * 10, H * 0.18],
          [W * 0.22 + i * 205, H], [W * 0.38 + i * 205, H]], "#fff4ba");
        ctx.restore();
      }
    }
    function weather() {
      const strength = 1 - sunAmount();
      if (strength <= 0) return;
      const t = forest.clock, wind = 1 + Math.sin(t * 0.8) * 0.25;
      ctx.save(); ctx.globalAlpha = strength * 0.42;
      ctx.strokeStyle = "#c9e1e4"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 105; i++) {
        const x = ((i * 83 + t * 230 * wind) % (W + 120)) - 60;
        const y = (i * 71 + t * (360 + i % 4 * 28)) % (H + 30) - 30;
        ctx.moveTo(x, y); ctx.lineTo(x + 8 * wind, y + 16);
      }
      ctx.stroke(); ctx.globalAlpha = strength * 0.8;
      for (let i = 0; i < 13; i++) {
        const x = ((i * 149 + t * 140) % (W + 80)) - 40;
        const y = H * 0.42 + Math.sin(t * 2 + i) * 21 + i % 5 * 43;
        rect(x, y, 7, 3, i % 2 ? "#b4aa63" : "#678e63");
      }
      for (let i = 0; i < 9; i++) {
        const pulse = (t * 2.1 + i * 0.71) % 1;
        ctx.globalAlpha = strength * (1 - pulse) * 0.35;
        ctx.strokeStyle = "#d5e2d0"; ctx.beginPath();
        ctx.ellipse((i * 137 + 62) % W, H * 0.73 + i % 4 * 34, 3 + pulse * 9, 1 + pulse * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawBear() {
      const b = forest.bear;
      if (!b) return;
      const stand = b.mode === "roar";
      const pace = forest.clock * (b.mode === "charge" ? 23 : 9);
      const walking = ["charge", "enter"].includes(b.mode);
      ctx.save();
      ctx.fillStyle = "rgba(33,35,24,.28)"; ctx.beginPath();
      ctx.ellipse(b.x, b.y + 2, stand ? 32 : 58, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(b.x, b.y);
      if (b.mode === "defeated") { ctx.globalAlpha = b.timer / 0.9; ctx.rotate(-b.face * (1 - b.timer / 0.9) * 0.55); }
      ctx.scale(b.face, 1);
      if (b.flash > 0) ctx.globalAlpha *= 0.55;
      const dark = "#49362b", brown = "#775038", light = "#a27348", belly = "#bd9865";
      const bob = walking ? Math.sin(pace * 2) * 3 : b.mode === "rest" ? Math.sin(pace * 0.45) * 1.5 : 0;
      if (stand) {
        rect(-24, -17, 17, 17, dark); rect(9, -17, 17, 17, dark);
        rect(-27, -4, 23, 7, "#392d25"); rect(8, -4, 23, 7, "#392d25");
        polygon([[-27, -75], [-19, -99], [20, -100], [30, -72], [27, -20],
          [12, -9], [-19, -14], [-29, -36]], brown);
        rect(-15, -70, 32, 50, light); rect(-10, -62, 21, 31, belly);
        rect(-44, -83, 17, 38, dark); rect(28, -84, 17, 38, brown);
        for (let i = 0; i < 3; i++) { rect(-44 + i * 5, -47, 3, 6, "#d9c69f"); rect(29 + i * 5, -48, 3, 6, "#d9c69f"); }
        rect(-20, -120, 39, 35, brown); rect(-26, -123, 14, 14, dark); rect(12, -124, 14, 14, dark);
        rect(-21, -119, 8, 7, light); rect(15, -120, 7, 7, light);
        rect(-8, -104, 30, 21, belly); rect(11, -106, 13, 8, "#292827");
        rect(-6, -94, 25, 17, "#332529"); rect(-2, -81, 18, 4, "#b97569");
        rect(-4, -95, 5, 5, "#eee2c5"); rect(11, -95, 5, 5, "#eee2c5");
        rect(-12, -110, 5, 4, "#221f1c"); rect(8, -111, 5, 4, "#221f1c");
      } else {
        for (const [i, x] of [-37, -17, 19, 37].entries()) {
          const stride = walking ? Math.sin(pace + i * Math.PI) * 9 : 0;
          rect(x + stride - 8, -26 + bob, 16, 26 - bob, i % 2 ? dark : brown);
          rect(x + stride - 10, -3, 22, 6, dark);
          for (let n = 0; n < 3; n++) rect(x + stride + 4 + n * 3, -1, 2, 3, "#c7b38a");
        }
        polygon([[-49, -48 + bob], [-37, -65 + bob], [14, -68 + bob], [39, -58 + bob],
          [46, -34 + bob], [28, -23 + bob], [-36, -23 + bob], [-53, -32 + bob]], brown);
        rect(-28, -62 + bob, 46, 11, light);
        rect(-48, -39 + bob, 68, 16, dark);
        rect(19, -68 + bob, 27, 23, brown);
        rect(30, -66 + bob, 29, 33, brown);
        rect(45, -49 + bob, 27, 16, belly); rect(63, -48 + bob, 13, 10, "#292827");
        rect(28, -74 + bob, 13, 14, dark); rect(31, -71 + bob, 7, 7, light);
        rect(42, -60 + bob, 5, 5, "#201f1c"); rect(43, -60 + bob, 2, 2, "#e4cc9d");
        rect(51, -34 + bob, 15, 3, "#49362b");
        rect(-56, -48 + bob, 10, 13, dark);
      }
      ctx.restore();
      if (b.mode === "roar") label("ROAR!", b.y - 143, 22, "#fff0c2", b.x);
      if (b.mode === "windup") {
        ctx.save(); ctx.globalAlpha = 0.65;
        for (let i = 0; i < 3; i++) rect(b.x - b.face * (35 + i * 12), b.y - 3 - i % 2 * 5, 8, 3, "#d3be80");
        ctx.restore();
      }
    }
    function deer(x, y, scale, face, walking, antlers) {
      ctx.save(); ctx.translate(x, y); ctx.scale(scale * face, scale);
      const stride = walking ? Math.sin(forest.clock * 9 + x * 0.01) * 6 : 0;
      ctx.fillStyle = "rgba(34,51,29,.17)"; ctx.beginPath(); ctx.ellipse(0, 1, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const lx = [-24, -15, 14, 23][i] + (i % 2 ? stride : -stride);
        rect(lx, -32, 6, 32, i % 2 ? "#805535" : "#a47745"); rect(lx - 1, -4, 8, 5, "#3d3527");
      }
      polygon([[-31, -49], [-18, -60], [18, -59], [31, -47], [24, -29], [-25, -31]], "#b1844c");
      rect(-13, -37, 32, 8, "#d6b67c");
      polygon([[19, -46], [22, -77], [29, -90], [39, -80], [36, -49]], "#b1844c");
      rect(25, -91, 22, 20, "#b98d55"); rect(40, -83, 18, 10, "#d5b77f");
      rect(53, -84, 7, 8, "#34312a"); rect(36, -88, 4, 4, "#24281e");
      polygon([[26, -89], [11, -105], [15, -90], [25, -83]], "#a67a44");
      polygon([[38, -91], [43, -109], [49, -98], [44, -87]], "#bd955d");
      polygon([[-30, -49], [-44, -54], [-34, -38]], "#e5d9aa");
      if (antlers) {
        ctx.strokeStyle = "#816843"; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(28, -95); ctx.lineTo(22, -115); ctx.lineTo(17, -123);
        ctx.moveTo(23, -111); ctx.lineTo(10, -115);
        ctx.moveTo(36, -95); ctx.lineTo(39, -116); ctx.lineTo(47, -123);
        ctx.moveTo(39, -110); ctx.lineTo(49, -111); ctx.stroke();
      } else {
        for (let i = 0; i < 5; i++) rect(-22 + i * 9, -49 + i % 2 * 6, 4, 3, "#e5d6a0");
      }
      ctx.restore();
    }
    function squirrel(x, y, face, moving, index) {
      ctx.save(); ctx.translate(x, y - (moving ? Math.abs(Math.sin(forest.clock * 11 + index)) * 5 : 0));
      ctx.scale(face, 1);
      polygon([[-6, -11], [-23, -12], [-34, -24], [-34, -42], [-27, -51],
        [-16, -50], [-9, -43], [-11, -35], [-20, -31], [-21, -23], [-5, -23]], "#8e5936");
      polygon([[-22, -14], [-30, -25], [-29, -42], [-21, -45], [-18, -37], [-25, -29]], "#bd8652");
      rect(-9, -25, 23, 22, "#a16b40"); rect(2, -22, 13, 16, "#dac290");
      rect(3, -38, 20, 19, "#a16b40"); rect(4, -45, 7, 10, "#805034");
      rect(17, -33, 4, 4, "#22251c"); rect(21, -26, 8, 6, "#d5b882");
      rect(27, -28, 4, 4, "#30291f"); rect(-12, -5, 15, 6, "#6e4931");
      rect(7, -4, 14, 5, "#6e4931"); ctx.restore();
    }
    function drawWildlife() {
      if (!forest.ending) return;
      const t = forest.endTime;
      const animals = [
        { kind: "deer", start: 3.0, from: -90, x: W * 0.22, y: H * 0.84, size: 0.78, face: 1, antlers: true },
        { kind: "deer", start: 3.7, from: W + 90, x: W * 0.77, y: H * 0.83, size: 0.65, face: -1, antlers: false },
        { kind: "deer", start: 4.3, from: W + 90, x: W * 0.89, y: H * 0.85, size: 0.47, face: -1, antlers: false },
        { kind: "squirrel", start: 4.0, from: -45, x: W * 0.39, y: H * 0.93, face: 1 },
        { kind: "squirrel", start: 4.8, from: W + 45, x: W * 0.64, y: H * 0.94, face: -1 },
        { kind: "squirrel", start: 5.4, from: -45, x: W * 0.12, y: H * 0.95, face: 1 }
      ];
      animals.forEach((a, i) => {
        if (t < a.start) return;
        const u = clamp((t - a.start) / (a.kind === "deer" ? 3 : 2), 0, 1);
        const x = lerp(a.from, a.x, u * (2 - u));
        if (a.kind === "deer") deer(x, a.y, a.size, a.face, u < 1, a.antlers);
        else squirrel(x, a.y, a.face, u < 1, i);
      });
    }
    function label(text, y, size = 21, color = "#fff1c2", x = W / 2) {
      ctx.save(); ctx.textAlign = "center"; ctx.font = "900 " + size + "px system-ui, sans-serif";
      ctx.lineWidth = 5; ctx.strokeStyle = "#263c35"; ctx.fillStyle = color;
      ctx.strokeText(text, x, y); ctx.fillText(text, x, y); ctx.restore();
    }
    function bearHud() {
      if (!forest.final || forest.ending) return;
      const b = forest.bear, left = W / 2 - 75;
      label("BEAR " + Math.min(3, forest.wave + 1) + " / 3", 38, 22);
      rect(left - 3, 49, 156, 14, "#2b362b");
      rect(left, 52, 150 * ((b?.hp ?? 0) / bearHP), 8, "#d8b56a");
      const hint = !b || b.mode === "enter" ? "HERE COMES THE NEXT BEAR!"
        : b.mode === "defeated" ? "BEAR DEFEATED!"
        : b.mode === "rest" ? "YOUR CHANCE — ATTACK!"
        : b.mode === "roar" ? "GET READY..."
        : "DODGE TWO CHARGES!";
      label(hint, 90, 17, b?.mode === "rest" ? "#c4efad" : "#f0e2bf");
    }
    drawBackground = function() {
      if (inForest()) { drawForest(); drawBear(); } else base.drawBackground();
    };
    draw = function() {
      base.draw();
      if (!inForest()) return;
      drawWildlife(); weather(); bearHud();
      if (forest.ending && forest.endTime >= 6.5) label("THE FOREST IS SAFE!", 93, 30, "#fff5b5");
    };
  }

  window.__uvzuInstallForest = function(code) {
    function once(before, after) {
      if (code.split(before).length !== 2) throw new Error("Forest hook missing: " + before.slice(0, 70));
      code = code.replace(before, () => after);
    }
    once('    if (state.mode === "final" && window.__uvzuCurrentLevelCode !== "CITY3") {',
      '    if (state.mode === "final" && !["CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)) {');
    once('      window.__uvzuCurrentLevelCode !== "CITY3" &&\n      window.__uvzuIsLevelCompleted &&',
      '      !["CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode) &&\n      window.__uvzuIsLevelCompleted &&');
    // Keep the same movement depth as the street and the other regular levels.
    const movement = '(window.__uvzuCurrentLevelCode === "CITY3" || window.__uvzuCurrentLevelCode === "RNBW1" || window.__uvzuCurrentLevelCode === "GRV2")';
    if (code.split(movement).length !== 6) throw new Error("Forest movement hooks missing");
    code = code.split(movement).join('(["CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))');
    once('      window.__uvzuLevelTheme = nextCode === "GRV2" ? "graveyard" : nextCode === "CITY3" ? "downtown" : "rainbow";',
      '      window.__uvzuLevelTheme = nextCode === "FRST5" ? "forest" : nextCode === "GRV2" ? "graveyard" : nextCode === "CITY3" ? "downtown" : "rainbow";');
    once('  let last = performance.now();', '(' + forestRuntime.toString() + ')();\n\n  let last = performance.now();');
    return code;
  };
})();
