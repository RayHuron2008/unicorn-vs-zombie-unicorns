// Level 6: load this file before game.js, then install after the forest installer.
(() => {
  function catchersRuntime() {
    const levelCode = "HUNT6";
    const active = () => window.__uvzuCurrentLevelCode === levelCode;
    const host = () => !!window.__uvzuIsMultiplayerHost?.();
    const guest = () => !!window.__uvzuIsMultiplayerGuest?.();
    const ghost = () => !!window.__uvzuIsLocalGhost?.() || player.lives <= 0;
    const role = () => guest() ? "guest" : "host";
    const copy = value => JSON.parse(JSON.stringify(value));
    const old = { fullRestart, safeLifeReset, update, updateEnding, startFinalWave,
      spawnEnemy, updateEnemies, headbutt, handleAAction, playerShoot, updateShots,
      draw, drawBackground, updateHud, startMusic, currentDirection };
    const session = () => {
      const room = window.__uvzuTombTravelNetwork?.room?.() || {};
      return [room.createdAt || 0, room.nextLevelAt || 0, room.ghostResetAt || 0].join(":");
    };
    const tiers = [
      { speed: 90, lock: 1.15, radius: 25, time: 3.1 },
      { speed: 112, lock: 0.98, radius: 29, time: 2.9 },
      { speed: 138, lock: 0.84, radius: 32, time: 2.7 },
      { speed: 160, lock: 0.70, radius: 35, time: 2.5 }
    ];
    const dialogue = [
      { start: 0.7, end: 7, who: "UNICORN", text: "HELLO! HELLO! IS ANYONE STILL ALIVE? ARE ANY OTHER UNICORNS STILL AROUND?" },
      { start: 8, end: 18.5, who: "CATCHER", text: "Hey! There is another unicorn! Capture him before he escapes! We need this one. He could be the test subject that we need to finally find the cure" },
      { start: 19.3, end: 29, who: "SECOND CATCHER", text: "The boss is going to be so happy that this one didn't turn. He might be just what we need to figure out immortality!" }
    ];
    const roster = ["lasso", "grab", "grab", "stun", "lasso", "grab", "lasso", "grab"];
    let serial = 0, requestSerial = 0, lastPacket = 0, lastRequest = -99, nextSent = false;
    let hunt, trap = null, notice = "", noticeTime = 0, releaseGuard = 0, oldLives = player.lives;
    const seenHits = new Set(), seenHazards = new Set(), shotTimes = new Map();
    const fresh = () => ({ level: levelCode, session: session(), run: Date.now() + "-" + (++serial),
      clock: 0, phase: "intro", phaseTime: 0, humans: [], shots: [], cages: [],
      spawned: 0, defeated: 0, spawnTimer: 1, attackGap: 0, event: 0, boss: null, finished: false });
    hunt = fresh();
    window.__uvzuGetCatcherState = () => active() ? hunt : null;
    window.__uvzuGetCatcherStatus = () => active() && trap ?
      { kind: trap.kind, time: trap.time, taps: trap.taps, run: hunt.run, source: trap.source } : null;
    const push = () => { if (host()) window.__uvzuMultiplayerPushEnemyState?.(state.enemies, true); };
    const fighting = () => hunt.phase === "humans" || hunt.phase === "mech";
    const headBox = p => ({ x: p.x + (p.face || 1) * 38 - 25, y: p.y - 30, w: 70, h: 48 });
    const humanBox = p => ({ x: p.x - 19, y: p.y - 67, w: 38, h: 67 });
    const coreBox = () => ({ x: hunt.boss.x - 62, y: hunt.boss.y - 76, w: 124, h: 74 });
    const body = p => ({ x: p.x, y: p.y - 27 });
    const note = (text, time = 1.4) => { notice = text; noticeTime = time; };
    function segmentDistance(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const u = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      return Math.hypot(px - ax - u * dx, py - ay - u * dy);
    }
    function stopTrap() {
      trap = null; player.actionLock = 0; player.aConsumed = true;
      releaseGuard = 1; player.invuln = Math.max(player.invuln, 0.8);
    }
    function resetLocal() {
      trap = null; releaseGuard = 1.8; seenHazards.clear(); shotTimes.clear();
      player.y = H * 0.81; player.x = guest() ? W * 0.33 : W * 0.23;
      player.face = 1; oldLives = player.lives;
    }
    fullRestart = function() {
      old.fullRestart(); hunt = fresh(); lastPacket = 0; nextSent = false;
      seenHits.clear(); lastRequest = -99; requestSerial = 0; noticeTime = 0;
      if (active()) {
        clearBattlefield(); resetLocal(); state.mode = "huntIntro";
        window.__uvzuLevelTheme = "catchers"; window.__uvzuStopMainMusic?.();
      }
    };
    safeLifeReset = function() {
      if (!active()) return old.safeLifeReset();
      clearBattlefield(); resetPlayerPosition(); state.resetQueued = false; resetLocal();
      state.mode = fighting() ? "play" : "huntScene";
    };
    spawnEnemy = function(...args) { if (!active()) return old.spawnEnemy(...args); };
    startFinalWave = function() { if (!active()) return old.startFinalWave(); };
    updateEnemies = function(dt) { if (!active()) return old.updateEnemies(dt); };
    updateEnding = function(dt) { if (!active()) return old.updateEnding(dt); };
    startMusic = function() { if (active()) window.__uvzuStopMainMusic?.(); else old.startMusic(); };
    const oldLevelMusic = window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic = function() {
      oldLevelMusic?.(); if (active()) { window.__uvzuStopMainMusic?.(); window.stopTombMusic?.(); }
    };

    function contestants() {
      const list = [];
      if (!ghost()) list.push({ ...player, role: role(), catcherTrap: window.__uvzuGetCatcherStatus() });
      const other = window.__uvzuGetRemotePlayer?.();
      if ((host() || guest()) && other && !other.dead && !other.ghost && other.lives > 0 &&
          Number.isFinite(other.x) && Number.isFinite(other.y)) list.push({ ...other, role: guest() ? "host" : "guest" });
      return list;
    }
    function nearest(x, y) {
      return contestants().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    }
    function phase(name) {
      hunt.phase = name; hunt.phaseTime = 0; hunt.shots = []; hunt.cages = [];
      trap = null; state.enemyShots.length = state.playerShots.length = 0;
      if (name === "humans") { hunt.spawnTimer = 0; player.invuln = 1.5; }
      if (name === "mechEntry") {
        hunt.boss = { x: W + 170, y: H * 0.82, tier: 0, hp: 3, mode: "entry", timer: 4.8,
          tries: 0, lock: 0, aimX: W / 2, aimY: H * 0.8, target: "host", flash: 0,
          locks: { host: 0, guest: 0 } };
      }
      if (name === "wreck") { player.invuln = 999999; hunt.boss.mode = "wreck"; }
      push();
    }
    function fireHuman(h, target) {
      const from = { x: h.x + h.face * 23, y: h.y - 43 }, to = { x: h.aimX, y: h.aimY };
      if (hunt.humans.some(o => o !== h && o.hp > 0 &&
          segmentDistance(o.x, o.y - 32, from.x, from.y, to.x, to.y) < 28)) return;
      const d = Math.hypot(to.x - from.x, to.y - from.y) || 1, speed = h.kind === "stun" ? 270 : 215;
      hunt.shots.push({ id: ++hunt.event, kind: h.kind, source: h.id,
        x: from.x, y: from.y, vx: (to.x - from.x) / d * speed, vy: (to.y - from.y) / d * speed,
        born: hunt.clock, life: 2.6, target: target?.role || h.target });
      push();
    }
    function spawnHuman() {
      const i = hunt.spawned++, side = i % 3 === 2 ? -1 : 1;
      const kind = roster[i];
      hunt.humans.push({ id: i, kind, x: side > 0 ? W + 35 : -35,
        y: H * (0.69 + i % 3 * 0.105), hp: kind === "stun" ? 3 : 2,
        face: -side, mode: "move", timer: 0.4 + i % 3 * 0.24,
        aimX: 0, aimY: 0, target: "host", flash: 0, locks: { host: 0, guest: 0 },
        offset: i * 2.3 });
    }
    function updateHumans(dt) {
      const scale = window.__uvzuCurrentDifficultyName === "Hard" ? 1.1 :
        window.__uvzuCurrentDifficultyName === "Normal" ? 1 : 0.9;
      hunt.spawnTimer -= dt; hunt.attackGap = Math.max(0, hunt.attackGap - dt);
      if (hunt.spawned < roster.length && hunt.humans.filter(h => h.hp > 0).length < 4 && hunt.spawnTimer <= 0) {
        spawnHuman(); hunt.spawnTimer = hunt.spawned < 3 ? 0.7 : 3.8; push();
      }
      for (const h of hunt.humans) {
        h.flash = Math.max(0, h.flash - dt);
        for (const k of ["host", "guest"]) h.locks[k] = Math.max(0, h.locks[k] - dt);
        if (h.hp <= 0) continue;
        const p = nearest(h.x, h.y); if (!p) continue;
        const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy);
        h.face = dx >= 0 ? 1 : -1; h.timer -= dt;
        if (h.mode === "windup") {
          if (h.timer <= 0) {
            if (h.kind === "grab") hunt.shots.push({ id: ++hunt.event, kind: "reach", source: h.id,
              x: h.aimX, y: h.aimY, vx: 0, vy: 0, born: hunt.clock, life: 0.24 });
            else fireHuman(h, p);
            h.mode = "recover"; h.timer = h.kind === "stun" ? 3.4 : 1.35; push();
          }
          continue;
        }
        if (h.mode === "recover") { if (h.timer <= 0) { h.mode = "move"; h.timer = 0.35; } continue; }
        const stunned = p.catcherTrap?.run === hunt.run && p.catcherTrap.kind === "stun" && p.catcherTrap.time > 0;
        const desired = stunned || h.kind === "grab" ? 28 : h.kind === "lasso" ? 155 : 245;
        if (d > desired) {
          const angle = Math.atan2(dy, dx) + (stunned ? 0 : Math.sin(hunt.clock * 1.1 + h.offset) * 0.4);
          h.x += Math.cos(angle) * (stunned ? 108 : 88) * scale * dt;
          h.y += Math.sin(angle) * 68 * scale * dt;
        } else if (h.kind !== "grab" && !stunned && d < desired - 40) {
          h.x -= Math.sign(dx) * 46 * dt;
        }
        // Loose spacing leaves gaps without making every catcher stop pursuing.
        for (const o of hunt.humans) {
          if (o === h || o.hp <= 0) continue;
          const sep = Math.hypot(h.x - o.x, h.y - o.y);
          if (sep > 0.1 && sep < 48) { h.x += (h.x - o.x) / sep * 35 * dt; h.y += (h.y - o.y) / sep * 24 * dt; }
        }
        h.x = clamp(h.x, -40, W + 40); h.y = clamp(h.y, H * 0.62, H - 24);
        const inRange = h.kind === "grab" ? d < 53 : d < (h.kind === "stun" ? 390 : 275);
        if (!stunned && inRange && h.timer <= 0 && hunt.attackGap <= 0) {
          h.mode = "windup"; h.timer = h.kind === "stun" ? 1.05 : h.kind === "lasso" ? 0.75 : 0.55;
          h.aimX = p.x; h.aimY = p.y - 27; h.target = p.role;
          hunt.attackGap = 0.85; push();
        }
      }
      if (hunt.defeated === roster.length) phase("mechEntry");
    }

    function beginScan() {
      const b = hunt.boss, p = nearest(b.x, b.y);
      b.mode = "scan"; b.timer = tiers[b.tier].time; b.lock = 0;
      b.aimX = clamp((p?.x ?? W / 2) + (b.tries % 2 ? -100 : 100), 30, W - 30);
      b.aimY = p?.y ?? H * 0.8; b.target = p?.role || "host"; push();
    }
    function finishScan() {
      const b = hunt.boss; b.tries++;
      b.mode = b.tries >= 3 ? "recharge" : "gap";
      b.timer = b.mode === "recharge" ? 5 : 0.75; b.lock = 0; push();
    }
    function updateMech(dt) {
      const b = hunt.boss, cfg = tiers[b.tier];
      b.flash = Math.max(0, b.flash - dt);
      for (const k of ["host", "guest"]) b.locks[k] = Math.max(0, b.locks[k] - dt);
      b.timer = Math.max(0, b.timer - dt);
      if (b.mode === "scan") {
        const players = contestants(), p = players.find(p => p.role === b.target) || players[0];
        if (p) {
          b.target = p.role;
          const dx = p.x - b.aimX, dy = p.y - b.aimY, d = Math.hypot(dx, dy) || 1;
          const step = Math.min(d, cfg.speed * dt);
          b.aimX += dx / d * step; b.aimY += dy / d * step;
          if (Math.hypot(p.x - b.aimX, p.y - b.aimY) < cfg.radius && !(p.dodgeTimer > 0)) b.lock += dt;
          else b.lock = Math.max(0, b.lock - dt * 2);
          if (b.lock >= cfg.lock) {
            hunt.cages.push({ id: ++hunt.event, x: b.aimX, y: b.aimY, born: hunt.clock, life: 2.2 });
            finishScan(); return;
          }
        }
        if (!b.timer) finishScan();
      } else if (!b.timer && b.mode === "gap") beginScan();
      else if (!b.timer && b.mode === "recharge") { b.tries = 0; beginScan(); }
      else if (!b.timer && b.mode === "tierShift") { b.tries = 0; beginScan(); }
    }
    function damageTarget(id, kind, by = "host") {
      const b = id === "mech" ? hunt.boss : hunt.humans.find(h => h.id === Number(id));
      if (!b || b.hp <= 0 || !fighting()) return;
      if (id === "mech" && (hunt.phase !== "mech" || b.mode !== "recharge")) return;
      if (guest()) {
        if (gameClock - lastRequest < 0.20) return;
        lastRequest = gameClock;
        window.__uvzuRequestEnemyKill?.("hunt_" + kind + "_" + hunt.run + "_" + id + "_" +
          (id === "mech" ? b.tier : 0) + "_" + (++requestSerial)); return;
      }
      if (b.locks[by] > 0) return;
      b.locks[by] = 0.30; b.hp--; b.flash = 0.2; addParticles(b.x, b.y - 35, "white");
      if (!b.hp) {
        if (id === "mech") {
          state.score += 150;
          if (b.tier === 3) { phase("wreck"); return; }
          b.tier++; b.hp = 3; b.mode = "tierShift"; b.timer = 1.6;
          hunt.cages = []; stopTrap();
        } else {
          hunt.defeated++; state.score += 30; b.mode = "down";
          if (hunt.defeated % 3 === 0) player.hp = Math.min(HP_MAX, player.hp + 1);
        }
      }
      push();
    }
    function receiveHits() {
      if (!host()) return;
      for (const id of Object.keys(window.__uvzuGetGuestKillRequests?.() || {})) {
        const m = /^hunt_(head|ray)_(\d+-\d+)_(mech|\d+)_([0-3])_(\d+)$/.exec(id);
        if (!m || seenHits.has(id)) continue;
        seenHits.add(id);
        const p = window.__uvzuGetRemotePlayer?.(), b = m[3] === "mech" ? hunt.boss : hunt.humans.find(h => h.id === Number(m[3]));
        if (m[2] === hunt.run && p && p.lives > 0 && !p.dead && !p.ghost && !p.catcherTrap && b &&
            (m[3] !== "mech" || Number(m[4]) === b.tier)) {
          const box = m[3] === "mech" ? coreBox() : humanBox(b);
          box.x -= 22; box.y -= 12; box.w += 44; box.h += 24;
          const rayInLane = p.ray > 0 && Math.sign(b.x - p.x) === (p.face || 1) &&
            Math.abs((p.y - 32) - (box.y + box.h / 2)) < box.h / 2 + 24;
          if (m[1] === "ray" ? rayInLane : rectsOverlap(headBox(p), box)) damageTarget(m[3], m[1], "guest");
        }
        window.__uvzuClearGuestKillRequest?.(id);
      }
    }
    headbutt = function() {
      if (!active()) return old.headbutt();
      if (!fighting() || trap || ghost() || player.headCd > 0 || player.actionLock > 0 || player.dodgeTimer > 0) return;
      old.headbutt(); const box = headBox(player);
      if (hunt.phase === "mech") {
        if (rectsOverlap(box, coreBox())) damageTarget("mech", "head");
      } else for (const h of hunt.humans) if (h.hp > 0 && rectsOverlap(box, humanBox(h))) damageTarget(h.id, "head");
    };
    handleAAction = function() { if (active() && (trap || !fighting() || ghost())) return; old.handleAAction(); };
    currentDirection = function() {
      if (active() && (trap || !fighting() || ghost())) return { dx: 0, dy: 0 };
      return old.currentDirection();
    };
    playerShoot = function() { if (active() && (trap || !fighting() || ghost())) return; old.playerShoot(); };
    updateShots = function(dt) {
      if (active() && fighting()) {
        const targets = hunt.phase === "mech" ? [{ id: "mech", box: coreBox() }] :
          hunt.humans.filter(h => h.hp > 0).map(h => ({ id: h.id, box: humanBox(h) }));
        for (let i = state.playerShots.length - 1; i >= 0; i--) {
          const s = state.playerShots[i], nx = s.x + s.vx * dt;
          const swept = { x: Math.min(s.x, nx) - s.r, y: s.y - s.r, w: Math.abs(nx - s.x) + s.r * 2, h: s.r * 2 };
          const hit = targets.sort((a, b) => Math.abs(a.box.x - s.x) - Math.abs(b.box.x - s.x))
            .find(t => rectsOverlap(swept, t.box));
          if (hit) { if (!ghost() && !trap) damageTarget(hit.id, "ray"); state.playerShots.splice(i, 1); }
        }
      }
      old.updateShots(dt);
    };

    function capturePlayer() {
      if (ghost()) return;
      trap = null; player.invuln = 0; loseLife();
      if (!ghost()) { safeLifeReset(); note("CAPTURED — ONE LIFE LOST. KEEP MOVING!", 2.2); }
    }
    function applyTrap(kind, source, time) {
      if (!fighting() || ghost() || trap || releaseGuard > 0 || player.invuln > 0 || player.dodgeTimer > 0) return false;
      if (kind === "lasso") {
        const lives = player.lives; damagePlayerByLaser();
        if (player.lives !== lives || state.resetQueued || ghost()) return false;
      }
      trap = { kind, source, time, taps: 0, x: player.x, y: player.y, hit: false };
      player.headTimer = player.dodgeTimer = 0; player.aConsumed = true;
      return true;
    }
    function tapA() {
      if (!active() || paused || !gameStarted || ghost() || trap?.kind !== "lasso" || trap.time <= 0) return;
      trap.taps++;
      if (trap.taps === 10) { stopTrap(); note("ROPE BROKEN!"); }
    }
    // Count real button presses, not held frames, repeats, or synthetic mouse events.
    btnA?.addEventListener("pointerdown", tapA);
    window.addEventListener("keydown", event => { if (event.key === " " && !event.repeat) tapA(); });
    function updateTrap(dt) {
      releaseGuard = Math.max(0, releaseGuard - dt);
      if (!trap) return;
      if (ghost() || !fighting()) { trap = null; return; }
      player.x = trap.x; player.y = trap.y; player.actionLock = Math.max(0.12, trap.time);
      player.headTimer = player.dodgeTimer = 0; trap.time -= dt;
      if (trap.kind === "lasso") {
        const holder = hunt.humans.find(h => h.id === trap.source);
        if (!holder || holder.hp <= 0) { stopTrap(); note("ROPE CUT FREE!"); return; }
        if (trap.time <= 0) capturePlayer();
      } else if (trap.kind === "stun") {
        if (trap.time <= 0) { stopTrap(); note("YOU CAN MOVE AGAIN!"); return; }
        if (hunt.humans.some(h => h.hp > 0 && Math.abs(h.x - player.x) < 31 && Math.abs(h.y - player.y) < 29)) capturePlayer();
      } else if (trap.kind === "cage") {
        const cage = hunt.cages.find(c => c.id === trap.source);
        if (cage && hunt.clock - cage.born >= 1.25 && !trap.hit) {
          trap.hit = true; damagePlayerByLaser();
        }
        if (trap && (trap.time <= 0 || !cage)) stopTrap();
      }
    }
    function localHazards(dt) {
      if (!fighting() || ghost()) return;
      const p = body(player);
      for (const s of hunt.shots) {
        const age = clamp(hunt.clock - s.born, 0, s.life);
        const prev = shotTimes.get(s.id) ?? Math.max(0, age - Math.max(dt, 0.28));
        shotTimes.set(s.id, age);
        if (seenHazards.has(s.id) || age >= s.life) continue;
        const hit = s.kind === "reach" ? Math.hypot(p.x - s.x, p.y - s.y) < 39 :
          segmentDistance(p.x, p.y, s.x + s.vx * prev, s.y + s.vy * prev, s.x + s.vx * age, s.y + s.vy * age) < 24;
        if (!hit) continue;
        seenHazards.add(s.id);
        if (s.kind === "reach") { if (!trap && releaseGuard <= 0 && player.dodgeTimer <= 0) damagePlayerByLaser(); }
        else applyTrap(s.kind, s.source, s.kind === "lasso" ? 3 : 2.4);
      }
      for (const c of hunt.cages) {
        if (seenHazards.has(c.id) || hunt.clock - c.born > 0.4) continue;
        if (Math.abs(player.x - c.x) < 48 && Math.abs(player.y - c.y) < 36) {
          seenHazards.add(c.id); applyTrap("cage", c.id, c.life - (hunt.clock - c.born));
        }
      }
      updateTrap(dt);
    }
    function receiveState() {
      if (!guest()) return;
      const packet = window.__uvzuGetMultiplayerEnemyState?.(), h = packet?.catchers;
      if (!h || h.level !== levelCode || h.session !== session() || packet.updatedAt <= lastPacket) return;
      lastPacket = packet.updatedAt;
      const reset = h.run !== hunt.run, changed = h.phase !== hunt.phase;
      hunt = copy(h);
      if (reset) resetLocal();
      if (changed) {
        trap = null; clearBattlefield();
        if (hunt.phase === "humans" || hunt.phase === "mech") player.invuln = 1.5;
        if (hunt.phase === "mech") player.hp = HP_MAX;
      }
    }
    function continueForest() {
      if (window.__uvzuCurrentLevelCode !== "FRST5" || nextSent || guest()) return;
      const forest = window.__uvzuGetForestState?.();
      if (!forest?.finished || forest.endTime < 13) return;
      nextSent = true;
      if (host()) window.__uvzuSignalNextLevel?.(levelCode);
      else {
        window.__uvzuCurrentLevelCode = levelCode; window.__uvzuLevelTheme = "catchers";
        window.__uvzuUpdateLevelMusic?.(); fullRestart();
      }
    }
    update = function(dt) {
      if (!active()) { old.update(dt); continueForest(); return; }
      receiveState();
      const before = hunt.phase;
      state.mode = fighting() ? "play" : "huntScene";
      const saved = trap ? { x: trap.x, y: trap.y } : null;
      if (trap) player.actionLock = Math.max(0.12, trap.time);
      old.update(dt);
      if (!active()) return;
      if (saved && trap) { player.x = saved.x; player.y = saved.y; }
      if (player.lives !== oldLives) {
        trap = null; releaseGuard = 1.8; oldLives = player.lives;
        if (!ghost()) { player.x = role() === "guest" ? W * 0.33 : W * 0.23; player.y = H * 0.81; }
      }
      noticeTime = Math.max(0, noticeTime - dt); hunt.clock += dt; hunt.phaseTime += dt;
      if (!guest()) {
        receiveHits();
        if (hunt.phase === "intro" && hunt.phaseTime >= 30) phase("humans");
        else if (hunt.phase === "humans") updateHumans(dt);
        else if (hunt.phase === "mechEntry") {
          hunt.boss.x = lerp(W + 170, W * 0.77, clamp(hunt.phaseTime / 4.8, 0, 1));
          if (hunt.phaseTime >= 4.8) { phase("mech"); player.hp = HP_MAX; player.invuln = 1.5; beginScan(); }
        } else if (hunt.phase === "mech") updateMech(dt);
        else if (hunt.phase === "wreck" && hunt.phaseTime >= 8 && !hunt.finished) {
          hunt.finished = true; if (host()) window.__uvzuSignalLevelCompleted?.(); push();
        }
        hunt.shots = hunt.shots.filter(s => hunt.clock - s.born <= s.life + 0.3);
        hunt.cages = hunt.cages.filter(c => hunt.clock - c.born <= c.life + 0.2);
      }
      if (hunt.phase === "intro") {
        player.x = lerp(W * 0.16, W * 0.38, clamp(hunt.phaseTime / 7, 0, 1)) - (guest() ? 72 : 0);
        player.y = H * 0.81; player.face = 1;
      }
      if (hunt.phase === "wreck") {
        trap = null; player.invuln = 999999;
        hunt.boss.flash = Math.max(0, hunt.boss.flash - dt);
        if (!ghost()) {
          const dx = W * (guest() ? 0.23 : 0.31) - player.x, dy = H * 0.86 - player.y;
          const d = Math.hypot(dx, dy) || 1, step = Math.min(d, dt * 150);
          player.x += dx / d * step; player.y += dy / d * step; player.face = 1;
        }
      }
      if (before === hunt.phase) localHazards(dt);
      state.enemies.length = 0; updateHud();
    };
    updateHud = function() {
      old.updateHud(); if (!active()) return;
      timeEl.textContent = hunt.phase === "humans" ? "Catchers " + hunt.defeated + "/8" :
        hunt.phase === "mech" ? "Mech " + (hunt.boss.tier + 1) + "/4" :
        hunt.phase === "wreck" ? "Escaped" : "The search";
    };

    const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    function poly(points, color) {
      ctx.fillStyle = color; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill();
    }
    function line(x, y, x2, y2, color, width = 2) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function ellipse(x, y, rx, ry, color) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    function text(str, x, y, size = 18, color = "#f4eee2", align = "center") {
      ctx.font = "bold " + size + "px system-ui"; ctx.textAlign = align; ctx.fillStyle = "#14242a";
      ctx.fillText(str, x + 2, y + 2); ctx.fillStyle = color; ctx.fillText(str, x, y);
    }
    function tree(x, y, height, color, sway = 0) {
      rect(x - 7, y - height, 14, height, "#544a3e");
      for (let i = 0; i < 4; i++) {
        const top = y - height - 38 + i * height * 0.18, width = 32 + i * 12;
        poly([[x + sway, top], [x - width, top + height * 0.46], [x + width, top + height * 0.46]], color);
      }
    }
    function scenery() {
      rect(0, 0, W, H, "#738d92");
      rect(0, H * 0.44, W, H * 0.21, "#a2aaa0");
      const pan = hunt.phase === "intro" ? Math.min(7, hunt.phaseTime) * 7 : 49;
      for (let i = 0; i < 17; i++) tree(i * W / 14 - pan * 0.35, H * 0.64, H * (0.32 + i % 3 * 0.05), "#53716a");
      for (let i = 0; i < 10; i++) tree(i * W / 8 - pan, H * 0.66, H * (0.44 + i % 2 * 0.09), "#284c43", Math.sin(hunt.clock * 0.65 + i) * 3);
      rect(0, H * 0.64, W, H * 0.36, "#59654a");
      poly([[0, H * 0.79], [W * 0.47, H * 0.7], [W, H * 0.76], [W, H], [0, H]], "#867b5f");
      for (let i = 0; i < 65; i++) {
        const x = (i * 137 + i % 3 * 13) % W, y = H * 0.66 + (i * 79 % Math.floor(H * 0.32));
        rect(x, y, 6 + i % 4 * 3, 2, i % 2 ? "#a19878" : "#697154");
      }
      // Equipment truck foreshadows an organized operation without blocking the arena.
      rect(W * 0.72, H * 0.61 - 48, 150, 48, "#293d42");
      rect(W * 0.72 + 100, H * 0.61 - 68, 50, 48, "#40555a");
      rect(W * 0.72 + 110, H * 0.61 - 60, 30, 19, "#91a9a5");
      ellipse(W * 0.72 + 26, H * 0.61, 16, 16, "#1d282b"); ellipse(W * 0.72 + 125, H * 0.61, 16, 16, "#1d282b");
      rect(W * 0.72 + 45, H * 0.61 - 30, 28, 6, "#cdaf58");
    }
    function drawHuman(h) {
      ctx.save(); ctx.translate(h.x, h.y);
      if (h.hp <= 0) { ctx.globalAlpha = 0.5; ctx.rotate(-1.5); }
      ellipse(0, 2, 19, 6, "rgba(16,28,22,.28)");
      const moving = h.mode === "move", stride = moving ? Math.sin(hunt.clock * 7 + h.id) * 5 : 0;
      rect(-12, -28, 10, 28 - stride, "#25383f"); rect(3, -28, 10, 28 + stride, "#30474e");
      rect(-16, -4 - stride, 17, 7, "#172b31"); rect(1, -4 + stride, 18, 7, "#172b31");
      rect(-17, -57, 34, 33, h.flash > 0 ? "#edf8eb" : h.kind === "stun" ? "#587886" : "#bc895b");
      rect(-9, -54, 19, 24, "#384e51"); rect(-17, -34, 34, 6, "#292e30");
      rect(-11, -75, 22, 20, h.id % 2 ? "#c18860" : "#e2ae82");
      rect(-14, -80, 29, 9, "#2a4145"); rect(h.face > 0 ? 4 : -14, -73, 13, 5, "#162e38");
      rect(h.face > 0 ? 13 : -24, -51, 11, 21, "#c8936b");
      if (h.kind === "stun") {
        rect(h.face * 18 - 22, -54, 45, 19, "#263943"); rect(h.face * 35 - 12, -49, 25, 10, "#6c919c");
        for (let i = 0; i < 3; i++) rect(-12 + i * 11, -52, 5, 11, h.mode === "windup" ? "#adf9ff" : "#5aabb6");
        rect(-20, -56, 9, 24, "#1b3039");
      } else if (h.kind === "lasso") {
        ctx.strokeStyle = "#ddc48a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(h.face * 25, h.mode === "windup" ? -88 : -36, h.mode === "windup" ? 22 : 10, 11, hunt.clock * 5, 0, Math.PI * 2); ctx.stroke();
      } else if (h.mode === "windup") rect(h.face * 25 - 5, -49, 20, 9, "#e0b080");
      if (h.hp > 0 && h.hp < (h.kind === "stun" ? 3 : 2)) { rect(-16, -90, 32, 4, "#293933"); rect(-16, -90, 32 * h.hp / (h.kind === "stun" ? 3 : 2), 4, "#edbc74"); }
      ctx.restore();
    }
    function drawMech() {
      const b = hunt.boss; if (!b) return;
      const fall = hunt.phase === "wreck" ? clamp((hunt.phaseTime - 1.6) / 1.8, 0, 1) : 0;
      ctx.save(); ctx.translate(b.x, b.y - fall * 45);
      ctx.rotate(-fall * 1.44);
      const recharge = b.mode === "recharge", sink = recharge ? 54 : 0;
      ellipse(0, 8, 102, 21, "rgba(10,20,21,.4)");
      for (const side of [-1, 1]) {
        rect(side * 51 - 19, -108 + sink * 0.55, 38, 105 - sink * 0.55, "#263b46");
        rect(side * 51 - 25, -78 + sink * 0.3, 50, 43, "#72878b");
        rect(side * 51 - 32, -23, 69, 28, "#344e59");
        rect(side * 51 - 27, -17, 54, 8, "#91a6a5");
        line(side * 51, -98 + sink, side * 51, -35, "#c5ba87", 5);
      }
      rect(-84, -244 + sink, 168, 139, b.flash > 0 ? "#eefbff" : "#637f89");
      rect(-75, -233 + sink, 150, 103, "#2d4655");
      poly([[-75,-233+sink],[-42,-249+sink],[45,-249+sink],[75,-233+sink],[56,-204+sink],[-56,-204+sink]], "#91aaa9");
      for (const side of [-1, 1]) {
        rect(side * 111 - 30, -226 + sink, 60, 66, "#536d78");
        rect(side * 111 - 19, -163 + sink, 38, 72, "#29434f");
        rect(side * 111 - 27, -114 + sink, 54, 45, "#80949a");
        for (let i = 0; i < 3; i++) rect(side * 111 - 21 + i * 15, -94 + sink, 11, 24, "#3c5660");
      }
      rect(-43, -290 + sink, 86, 48, "#294451"); rect(-34, -283 + sink, 68, 30, "#88a1a7");
      rect(-25, -276 + sink, 50, 9, fall ? "#2f393a" : "#fb7061");
      line(-38, -287 + sink, -52, -316 + sink, "#bcc4b0", 4);
      ellipse(0, -171 + sink, 30, 29, "#182f3b");
      ellipse(0, recharge ? -49 : -171 + sink, recharge ? 36 : 20, recharge ? 28 : 20,
        fall ? "#282f30" : recharge ? "#a0f1dd" : "#d6b668");
      for (let i = 0; i < 4; i++) rect(-32 + i * 18, -124 + sink, 10, 8, i <= b.tier ? "#ed805d" : "#243840");
      ctx.restore();
      if (hunt.phase === "wreck") {
        for (let i = 0; i < 14; i++) {
          const t = hunt.phaseTime, a = i * 2.39, r = Math.min(140, t * (40 + i * 2));
          if (t < 2) ellipse(b.x + Math.cos(a) * r, b.y - 150 + Math.sin(a) * r, 11 + i % 3 * 8, 10 + i % 3 * 7, i % 2 ? "#ffd888" : "#ed8451");
          else ellipse(b.x - 120 + (i % 3) * 28 - t * 4, b.y - 55 - ((i * 23 + t * 21) % 150), 18 + i % 4 * 7, 14 + i % 4 * 6, "rgba(37,46,47,.26)");
        }
      }
    }
    function drawHazards() {
      for (const h of hunt.humans) if (h.hp > 0 && h.mode === "windup") {
        if (h.kind === "stun") line(h.x + h.face * 24, h.y - 43, h.aimX, h.aimY, "rgba(169,242,249,.55)");
        else if (h.kind === "lasso") ellipse(h.aimX, h.aimY + 27, 30, 13, "rgba(233,208,149,.24)");
      }
      for (const s of hunt.shots) {
        const age = hunt.clock - s.born; if (age < 0 || age > s.life) continue;
        const x = s.x + s.vx * age, y = s.y + s.vy * age;
        if (s.kind === "lasso") {
          const owner = hunt.humans.find(h => h.id === s.source);
          if (owner) line(owner.x, owner.y - 44, x, y, "#c5a970");
          ctx.strokeStyle = "#f2d696"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 15, 10, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (s.kind === "stun") { line(x - s.vx * 0.045, y - s.vy * 0.045, x, y, "#8bedfd", 8); ellipse(x, y, 4, 4, "#ffffff"); }
      }
      const b = hunt.boss;
      if (b?.mode === "scan") {
        const cfg = tiers[b.tier], progress = clamp(b.lock / cfg.lock, 0, 1);
        line(b.x, b.y - 267, b.aimX, b.aimY - 24, "rgba(255,94,96,.65)", 2 + progress * 3);
        ellipse(b.aimX, b.aimY, cfg.radius + 13, cfg.radius * 0.55, "rgba(244,91,90,.15)");
        for (const side of [-1, 1]) {
          line(b.aimX + side * 33, b.aimY - 17, b.aimX + side * 33, b.aimY + 15, "#ffd290", 3);
          line(b.aimX - 20, b.aimY + side * 23, b.aimX + 20, b.aimY + side * 23, "#ffd290", 3);
        }
        rect(b.aimX - 30, b.aimY + 28, 60, 5, "#573f3a"); rect(b.aimX - 30, b.aimY + 28, 60 * progress, 5, "#ff7770");
      }
      for (const c of hunt.cages) {
        const age = hunt.clock - c.born; if (age > c.life) continue;
        const height = 92 * clamp(age / 0.25, 0, 1), color = age > 1.15 ? "#ffd38e" : "#ff7d90";
        for (let i = 0; i < 5; i++) line(c.x - 43 + i * 21.5, c.y + 10, c.x - 43 + i * 21.5, c.y + 10 - height, color, 3);
        line(c.x - 47, c.y + 10 - height, c.x + 47, c.y + 10 - height, color, 4);
        line(c.x - 47, c.y + 10, c.x + 47, c.y + 10, color, 4);
      }
    }
    function drawRestraint(p, status) {
      if (!status) return;
      if (status.kind === "lasso") {
        ctx.strokeStyle = "#eed28f"; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y - 29 + i * 6, 28, 12, 0, 0, Math.PI * 2); ctx.stroke(); }
      } else if (status.kind === "stun") {
        for (let i = 0; i < 4; i++) {
          const x = p.x - 34 + i * 22;
          line(x, p.y - 67, x + 9, p.y - 39, "#a6f4ff", 3); line(x + 9, p.y - 39, x - 3, p.y - 9, "#a6f4ff", 3);
        }
      }
    }
    function wrapText(str, width) {
      const lines = []; let current = "";
      for (const word of str.split(" ")) {
        const next = current ? current + " " + word : word;
        if (current && ctx.measureText(next).width > width) { lines.push(current); current = word; }
        else current = next;
      }
      if (current) lines.push(current); return lines;
    }
    function dialogueBox() {
      const d = dialogue.find(d => hunt.phaseTime >= d.start && hunt.phaseTime < d.end);
      if (!d) return;
      ctx.font = "bold 18px system-ui"; const lines = wrapText(d.text, W - 136), y = 76, height = 43 + lines.length * 24;
      rect(40, y, W - 80, height, "rgba(15,32,35,.94)"); rect(40, y, 5, height, d.who === "UNICORN" ? "#ea93bd" : "#cba465");
      text(d.who, 60, y + 25, 15, d.who === "UNICORN" ? "#f6b5d6" : "#e9cb8c", "left");
      lines.forEach((l, i) => text(l, 60, y + 53 + i * 24, 18, "#f1eee1", "left"));
    }
    drawBackground = function() { if (active()) scenery(); else old.drawBackground(); };
    draw = function() {
      if (!active()) return old.draw();
      ctx.save();
      if (hunt.phase === "mechEntry" || hunt.phase === "wreck" && hunt.phaseTime < 3.4) ctx.translate(Math.sin(hunt.clock * 42) * 2, Math.cos(hunt.clock * 37) * 2);
      scenery();
      const actors = hunt.humans.map(h => ({ y: h.y, draw: () => drawHuman(h) }));
      if (hunt.phase === "intro" && hunt.phaseTime >= 7.4) {
        for (let i = 0; i < 3; i++) {
          const h = { id: i, hp: 2, kind: i === 2 ? "stun" : "lasso", face: -1, mode: "move",
            x: lerp(W + 60 + i * 60, W * 0.68 + i * 72, clamp((hunt.phaseTime - 7.4) / 2.4, 0, 1)), y: H * 0.8 + i % 2 * 34 };
          actors.push({ y: h.y, draw: () => drawHuman(h) });
        }
      }
      if (hunt.boss) actors.push({ y: hunt.boss.y, draw: drawMech });
      if (!ghost()) actors.push({ y: player.y, draw: () => {
        drawUnicorn(player.x, player.y, player.face, false, player.ray > 0, player.giant > 0);
        drawShieldAura(); drawDodgeEffect(); drawRestraint(player, trap);
      } });
      const remote = window.__uvzuGetRemotePlayer?.();
      if ((host() || guest()) && remote && remote.lives > 0 && !remote.dead && !remote.ghost) {
        const p = hunt.phase === "intro" ? { ...remote, x: player.x + (guest() ? 72 : -72), y: player.y } : remote;
        actors.push({ y: p.y, draw: () => { drawUnicorn(p.x, p.y, p.face || 1, false, p.ray > 0, p.giant > 0); drawRestraint(p, p.catcherTrap); } });
      }
      actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
      drawShots(); drawParticles(); drawHazards(); ctx.restore(); drawHealthBar();
      if (hunt.phase === "intro") dialogueBox();
      else if (hunt.phase === "humans") text("KEEP MOVING. DODGE ROPES AND THE STUN GUN.", W / 2, 55, 17, "#f0dfb4");
      else if (hunt.phase === "mechEntry") text("SOMETHING BIG IS COMING...", W / 2, 78, 25, "#f4c987");
      else if (hunt.phase === "mech") {
        const b = hunt.boss;
        text("MECH — TIER " + (b.tier + 1) + " / 4", W / 2, 39, 20);
        rect(W / 2 - 124, 49, 248, 10, "#243b3f"); rect(W / 2 - 122, 51, 244 * b.hp / 3, 6, "#e6a561");
        text(b.mode === "recharge" ? "RECHARGING — HIT THE LOWERED CORE!" : b.mode === "tierShift" ? "TRACKING UPGRADED!" :
          "MOVE OUT OF THE SIGHT — ATTEMPT " + Math.min(3, b.tries + 1) + " / 3", W / 2, 83, 17,
          b.mode === "recharge" ? "#bcf4d7" : "#ffd6a0");
      }
      if (trap) {
        const y = H - 78; rect(W / 2 - 216, y - 20, 432, 63, "rgba(18,34,40,.93)");
        if (trap.kind === "lasso") {
          text("TAP A!  " + trap.taps + " / 10  —  " + Math.max(0, trap.time).toFixed(1) + "s", W / 2, y + 3, 22, "#ffe0a4");
          rect(W / 2 - 190, y + 16, 380, 10, "#495454"); rect(W / 2 - 190, y + 16, 380 * trap.taps / 10, 10, "#eac88b");
        } else text(trap.kind === "stun" ? "PARALYZED!  " + Math.max(0, trap.time).toFixed(1) + "s" : "LASER CAGE!", W / 2, y + 13, 22, "#bfeaff");
      } else if (noticeTime > 0) text(notice, W / 2, H - 48, 20, "#ffdd9f");
      if (hunt.phase === "wreck" && hunt.phaseTime >= 5.6) text("YOU ESCAPED.", W / 2, 86, 29, "#e8dac0");
    };
  }

  window.__uvzuInstallCatchers = function(code) {
    function once(before, after) {
      if (code.split(before).length !== 2) throw new Error("Catcher hook missing: " + before.slice(0, 80));
      code = code.replace(before, () => after);
    }
    const movement = '(["CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))';
    if (code.split(movement).length !== 6) throw new Error("Catcher movement hooks missing");
    code = code.split(movement).join('(["HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))');
    const ending = '!["CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)';
    if (code.split(ending).length !== 3) throw new Error("Catcher ending hooks missing");
    code = code.split(ending).join('!["HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)');
    once('window.__uvzuLevelTheme = nextCode === "FRST5" ? "forest" :',
      'window.__uvzuLevelTheme = nextCode === "HUNT6" ? "catchers" : nextCode === "FRST5" ? "forest" :');
    once('  let last = performance.now();', '(' + catchersRuntime.toString() + ')();\n\n  let last = performance.now();');
    return code;
  };
})();
