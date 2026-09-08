// Shared secret-tomb travel and host-authoritative skeleton combat (version 2).
(() => {
  function installTravel() {
    const net = window.__uvzuTombTravelNetwork;
    const copy = value => JSON.parse(JSON.stringify(value));
    const isTomb = () => window.__uvzuCurrentLevelCode === "TOMB1";
    const active = () => ["host", "guest"].includes(net.role());
    const epoch = room => [room.createdAt || 0, room.nextLevelAt || 0, room.ghostResetAt || 0].join(":");
    let saved = null, seen = "", busy = false, requesting = false, serial = 0, returnedAt = 0;
    const handled = new Set();

    function fail(error) {
      console.error("Secret tomb travel failed:", error);
      alert("The tomb transition could not be synchronized. Check the multiplayer connection before trying again.");
    }

    function snapshot() {
      return copy({
        mode: state.mode, time: state.time, enemies: state.enemies,
        enemyShots: state.enemyShots, spawnTimer: state.spawnTimer,
        finalSpawned: state.finalSpawned, finalSpawnTimer: state.finalSpawnTimer,
        grv2TarantulasKilled: state.grv2TarantulasKilled || 0
      });
    }

    function clearTomb() {
      window.__uvzuTombCoop?.battle?.reset();
      tombEncounterStarted = tombFirstSkeletonActive = tombFatherBurning = false;
      tombAwakenDelay = tombFirstGraveRattle = tombSkeletonNumber = tombNextSkeletonDelay = 0;
      tombFirstSkeletonRise = tombFirstSkeletonHitLock = tombFatherBurnTimer = 0;
      tombFirstSkeletonHP = 4;
      tombFirstSkeletonX = tombFirstSkeletonY = null;
      tombFirstSkeletonFireTimer = 1.2;
      tombFatherMouthFireTimer = 1.5;
      tombFirstSkeletonFireballs.length = 0;
      tombFirstSkeletonSwordTimer = 0.8;
      tombFirstSkeletonSwordSwing = 0;
      tombFirstSkeletonSwordDidHit = tombFirstSkeletonSwordLanded = false;
      tombFirstSkeletonThrowTimer = 10;
      tombFirstSkeletonSwordState = "held";
      tombFirstSkeletonThrownSwordX = tombFirstSkeletonThrownSwordY = null;
      tombFirstSkeletonSwordTargetX = tombFirstSkeletonSwordTargetY = null;
      tombFirstSkeletonSwordVx = tombFirstSkeletonSwordVy = tombFirstSkeletonSwordSpin = 0;
      tombNeedsFullRestart = tombReading = false;
      tombCurrentSign = tombIgnoredSign = null;
      tombAWasDown = !!input.a;
      tombBWasDown = !!input.b;
      window.__uvzuDisableTombSigns = false;
      removeTombPrompt();
      removeTombWriting();
      document.getElementById("tombFatherVictoryMessage")?.remove();
      document.getElementById("tombReturnToOverworld")?.remove();
      window.stopTombMusic?.();
    }

    function enter(packet) {
      if (window.__uvzuCurrentLevelCode !== "GRV2" || saved) return;
      saved = { grave: copy(packet.grave), x: player.x, y: player.y, face: player.face };
      graveyardSecretReturnState = saved;
      graveyardAngelHoldTimer = 0;
      clearTomb();
      clearBattlefield();
      state.mode = "play";
      state.time = packet.grave.time;
      state.npc = state.family = null;
      state.endingKind = null;
      state.resetQueued = false;
      state.fireworks.length = 0;
      player.webbedTimer = player.webFlash = player.headTimer = player.dodgeTimer = 0;
      player.webTrapX = player.webTrapY = null;
      player.actionLock = 0.25;
      player.invuln = Math.max(player.invuln, 1.2);
      player.x = W / 2 + (net.role() === "host" ? -35 : 35);
      player.y = H * 0.72;
      window.__uvzuCurrentLevelCode = "TOMB1";
      window.__uvzuLevelTheme = "tomb";
      window.__uvzuUpdateLevelMusic?.();
      updateHud();
    }

    function leave(packet) {
      if (!isTomb() || !saved) return;
      clearTomb();
      clearBattlefield();
      const grave = copy(packet.grave);
      Object.assign(state, grave);
      state.enemies = Array.isArray(grave.enemies) ? grave.enemies : [];
      state.enemyShots = Array.isArray(grave.enemyShots) ? grave.enemyShots : [];
      state.resetQueued = false;
      if (window.__uvzuIsLocalGhost?.()) window.__uvzuReviveLocalForNextLevel?.(player);
      player.x = saved.x;
      player.y = saved.y;
      player.face = saved.face;
      player.hp = HP_MAX;
      player.lives = Math.max(player.lives, 99);
      player.invuln = 1.2;
      player.actionLock = 0.25;
      player.headTimer = player.dodgeTimer = player.webbedTimer = player.webFlash = 0;
      player.webTrapX = player.webTrapY = null;
      window.__uvzuCurrentLevelCode = "GRV2";
      window.__uvzuLevelTheme = "graveyard";
      saved = graveyardSecretReturnState = null;
      graveyardAngelHoldTimer = 0;
      returnedAt = packet.at;
      window.__uvzuUpdateLevelMusic?.();
      if (net.role() === "host") window.__uvzuMultiplayerPushEnemyState?.(state.enemies, true);
      updateHud();
    }

    function request(kind) {
      if (!active() || requesting || busy) return;
      if (kind === "enter" && window.__uvzuCurrentLevelCode !== "GRV2") return;
      if (kind === "return" && (!isTomb() || !saved || !window.__uvzuTombCoop.battle.won())) return;
      const room = net.room();
      if (!room) return;
      requesting = true;
      const id = net.role() + "_" + Date.now() + "_" + (++serial);
      net.send({ ["tombRequests/" + net.role()]: {
        id, kind, epoch: epoch(room), after: room.tombPortal?.id || ""
      } })
        .catch(fail).finally(() => { requesting = false; });
    }

    function tick() {
      if (!active()) return false;
      if (busy) return true;
      const room = net.room();
      if (!room) return false;
      const currentEpoch = epoch(room);
      const packet = room.tombPortal;
      if (packet && packet.epoch === currentEpoch && packet.id !== seen) {
        seen = packet.id;
        if (packet.kind === "enter") enter(packet);
        else if (packet.kind === "return") leave(packet);
        window.__uvzuMultiplayerPush?.(player);
        return true;
      }
      if (saved && !isTomb()) saved = graveyardSecretReturnState = null;
      if (net.role() !== "host") return false;
      for (const role of ["host", "guest"]) {
        const request = room.tombRequests?.[role];
        if (!request?.id || handled.has(request.id)) continue;
        handled.add(request.id);
        if (request.epoch !== currentEpoch || request.after !== (room.tombPortal?.id || "")) continue;
        const entering = request.kind === "enter" && window.__uvzuCurrentLevelCode === "GRV2" &&
          ["play", "final"].includes(state.mode) && !saved;
        const returning = request.kind === "return" && isTomb() && saved && window.__uvzuTombCoop.battle.won();
        if (!entering && !returning) continue;
        busy = true;
        const portal = { id: request.id, kind: request.kind, epoch: currentEpoch,
          at: Date.now(), grave: entering ? snapshot() : copy(saved.grave) };
        net.send({ tombPortal: portal, tombRequests: null, tombBattle: null, tombActions: null, enemyState: null,
          enemyDeaths: null, guestKillRequests: null, endingSceneAt: 0, levelCompleted: false })
          .catch(fail).finally(() => { busy = false; });
        return true;
      }
      return false;
    }

    // Ignore graveyard enemy packets inside the tomb, and old packets on return.
    const readEnemies = window.__uvzuGetMultiplayerEnemyState;
    if (readEnemies) window.__uvzuGetMultiplayerEnemyState = function() {
      if (active() && isTomb()) return null;
      const packet = readEnemies();
      return packet && packet.updatedAt <= returnedAt ? null : packet;
    };

    window.__uvzuTombCoop = { active, request, tick };
  }

  function installBattle() {
    const net = window.__uvzuTombTravelNetwork;
    const coop = window.__uvzuTombCoop;
    const copy = value => JSON.parse(JSON.stringify(value));
    const host = () => net.role() === "host";
    const on = () => coop.active() && window.__uvzuCurrentLevelCode === "TOMB1";
    const alive = p => p && p.connected !== false && !p.dead && !p.ghost && p.lives > 0;
    const localAlive = () => player.lives > 0 && !window.__uvzuIsLocalGhost?.();
    let key = "", battle = null, pending = [], serial = 0, lastSent = 0;
    let writeBusy = false, inputBusy = false, failed = false, lastWrite = -Infinity;
    let receivedAt = 0, wonShown = false, winCommitted = false, musicStarted = false, musicStopped = false;
    let startPending = false;
    const touched = new Set();

    function reset() {
      key = ""; battle = null; pending = []; serial = lastSent = 0;
      writeBusy = inputBusy = failed = wonShown = winCommitted = musicStarted = musicStopped = startPending = false;
      lastWrite = -Infinity;
      touched.clear();
    }

    function fresh() {
      return { key, revision: 0, clock: 0, phase: "idle", timer: 0, number: 0, hp: 4,
        x: W * 0.135, y: H * 0.34 + 20, fireTimer: 1.2, mouthTimer: 1.5,
        sword: "held", throwTimer: 10, swingTimer: 0.8, swing: 0, swingId: 0,
        throwId: 0, swordX: null, swordY: null, targetX: null, targetY: null,
        swordVx: 0, swordVy: 0, spin: 0, projectileId: 0, fire: [], bolts: [],
        targetRole: "", targetTimer: 0, acks: { host: 0, guest: 0 },
        headLocks: { host: 0, guest: 0 }, shotLocks: { host: 0, guest: 0 } };
    }

    function error(err, sentKey) {
      if (key !== sentKey || failed) return;
      failed = true;
      console.error("Shared tomb battle failed:", err);
      alert("The shared tomb battle could not synchronize. Reconnect both players before trying again.");
    }

    // Existing renderers read these variables, so the artwork remains unchanged.
    function mirror() {
      if (!battle) return;
      const b = battle;
      tombEncounterStarted = b.phase !== "idle";
      tombAwakenDelay = b.phase === "awaken" ? b.timer : 0;
      tombFirstGraveRattle = b.phase === "rattle" ? b.timer : 0;
      tombFirstSkeletonActive = ["rise", "fight", "burn"].includes(b.phase);
      tombFirstSkeletonRise = b.phase === "rise" ? b.timer : 0;
      tombFirstSkeletonHP = b.hp;
      tombFirstSkeletonX = b.x; tombFirstSkeletonY = b.y;
      tombSkeletonNumber = b.number;
      tombNextSkeletonDelay = b.phase === "wait" ? b.timer : 0;
      tombFirstSkeletonSwordState = b.sword;
      tombFirstSkeletonSwordSwing = b.swing;
      tombFirstSkeletonThrownSwordX = b.swordX;
      tombFirstSkeletonThrownSwordY = b.swordY;
      tombFirstSkeletonSwordTargetX = b.targetX;
      tombFirstSkeletonSwordTargetY = b.targetY;
      tombFirstSkeletonSwordVx = b.swordVx;
      tombFirstSkeletonSwordVy = b.swordVy;
      tombFirstSkeletonSwordSpin = b.spin;
      tombFirstSkeletonSwordLanded = b.sword === "landed";
      tombFirstSkeletonFireballs = b.fire.filter(f => !touched.has("fire_" + f.id));
      tombFatherBurning = b.phase === "burn";
      tombFatherBurnTimer = tombFatherBurning ? b.timer : 0;
      window.__uvzuDisableTombSigns = tombEncounterStarted || startPending;
      if (tombEncounterStarted || startPending) {
        tombReading = false;
        tombCurrentSign = tombIgnoredSign = null;
        removeTombPrompt(); removeTombWriting();
      }
      if (["rattle", "rise", "fight", "wait"].includes(b.phase) && !musicStarted) {
        musicStarted = true;
        window.startTombMusic?.();
      }
      if (["burn", "won"].includes(b.phase) && !musicStopped) {
        musicStopped = true;
        window.stopTombMusic?.();
      }
      // The host also waits for the final network write before displaying a win.
      if (b.phase === "won" && winCommitted && !wonShown && !failed) {
        wonShown = true;
        if (window.__uvzuIsLocalGhost?.()) window.__uvzuReviveLocalForNextLevel?.(player);
        player.lives = 99; player.hp = HP_MAX; player.invuln = 1.2;
        updateHud();
        window.__uvzuMultiplayerPush?.(player);
        __uvzuShowSharedTombVictory();
      }
    }

    function poll() {
      if (!on()) { if (key) reset(); return; }
      const room = net.room();
      if (!room?.tombPortal || room.tombPortal.kind !== "enter") return;
      const newKey = [room.tombPortal.id, room.createdAt || 0, room.nextLevelAt || 0,
        room.ghostResetAt || 0].join(":");
      if (newKey !== key) {
        reset(); key = newKey;
        battle = fresh();
        document.getElementById("tombFatherVictoryMessage")?.remove();
        document.getElementById("tombReturnToOverworld")?.remove();
        window.stopTombMusic?.();
      }
      const packet = room.tombBattle;
      if (!host() && packet?.key === key && packet.revision > battle.revision) {
        battle = Object.assign(fresh(), copy(packet));
        battle.fire = Array.isArray(packet.fire) ? copy(packet.fire) : [];
        battle.bolts = Array.isArray(packet.bolts) ? copy(packet.bolts) : [];
        receivedAt = performance.now();
        if (battle.phase === "won") winCommitted = true;
        pending = pending.filter(e => e.id > (battle.acks.guest || 0));
      }
      mirror();
    }

    function emit(kind, extra = {}) {
      if (!on() || !battle || failed || !localAlive() || pending.length >= 64) return;
      pending.push({ id: ++serial, kind, number: battle.number, clock: battle.clock,
        x: player.x, y: player.y, ...extra });
    }

    function start() {
      poll();
      if (!battle || battle.phase !== "idle" || startPending || !localAlive()) return;
      startPending = true;
      emit("start");
      mirror();
    }

    function vulnerable() {
      return battle.phase === "fight" &&
        (tombGraveSequence[battle.number].name === "Father" || battle.sword !== "held");
    }

    function hit() {
      if (!vulnerable()) return false;
      battle.hp = Math.max(0, battle.hp - 1);
      if (!battle.hp) {
        if (tombGraveSequence[battle.number].name === "Father") {
          battle.phase = "burn"; battle.timer = 5;
          battle.fire = []; battle.bolts = [];
        } else {
          battle.number++;
          battle.phase = "wait"; battle.timer = 2;
        }
      }
      return true;
    }

    function landSword() {
      battle.sword = "landed";
      battle.swordX = battle.targetX; battle.swordY = battle.targetY;
    }

    function actions(events, role) {
      if (!Array.isArray(events)) return;
      for (const e of events.slice(0, 64)) {
        if (!Number.isSafeInteger(e.id) || e.id <= battle.acks[role]) continue;
        battle.acks[role] = e.id;
        if (![e.x, e.y, e.clock].every(Number.isFinite)) continue;
        // Stale attacks cannot damage a later skeleton or a restarted battle.
        if (e.kind !== "start" && (battle.clock - e.clock > 1 || e.clock - battle.clock > 0.3)) continue;
        if (e.kind === "touch") {
          if (e.fire != null) {
            battle.fire = battle.fire.filter(f => f.id !== e.fire || Math.hypot(f.x - e.x, f.y - e.y) > 85);
          } else if (battle.sword === "flying" && e.sword === battle.throwId &&
                     Math.hypot(battle.swordX - e.x, battle.swordY - e.y) < 100) {
            landSword();
          }
          continue;
        }
        if (role === "host" ? !localAlive() : !alive(net.room()?.guest)) continue;
        if (e.kind === "start" && battle.phase === "idle") {
          battle.phase = "awaken"; battle.timer = 1.5;
        }
        if (e.number !== battle.number || battle.phase !== "fight") continue;
        if (e.kind === "head" && battle.headLocks[role] <= 0 &&
            Math.hypot(e.x - battle.x, e.y - battle.y) < 90 && hit()) {
          battle.headLocks[role] = 0.4;
        }
        if (e.kind === "ray" && e.ray > 0 && (e.face === -1 || e.face === 1) &&
            battle.shotLocks[role] <= 0 && battle.bolts.length < 32) {
          battle.shotLocks[role] = 0.15;
          battle.bolts.push({ id: ++battle.projectileId, role, x: e.x + e.face * 34,
            y: e.y - 32, vx: e.face * (e.giant ? 520 : 420), life: 1 });
        }
      }
    }

    function chooseTarget(dt) {
      const candidates = [];
      if (localAlive()) candidates.push({ role: "host", x: player.x, y: player.y });
      const guest = net.room()?.guest;
      if (alive(guest) && Number.isFinite(guest.x) && Number.isFinite(guest.y)) {
        candidates.push({ role: "guest", x: guest.x, y: guest.y });
      }
      battle.targetTimer -= dt;
      let target = candidates.find(p => p.role === battle.targetRole);
      if (!target || battle.targetTimer <= 0) {
        target = candidates.sort((a, b) => Math.hypot(a.x - battle.x, a.y - battle.y) -
          Math.hypot(b.x - battle.x, b.y - battle.y))[0];
        battle.targetRole = target?.role || "";
        battle.targetTimer = 1;
      }
      return target;
    }

    function fire(angle, speed, mouth = false) {
      battle.fire.push({ id: ++battle.projectileId,
        x: battle.x + (mouth ? 0 : Math.cos(angle) * 18), y: battle.y - (mouth ? 24 : 8),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 3 });
    }

    function advance(dt) {
      const b = battle;
      b.clock += dt;
      for (const role of ["host", "guest"]) {
        b.headLocks[role] = Math.max(0, b.headLocks[role] - dt);
        b.shotLocks[role] = Math.max(0, b.shotLocks[role] - dt);
      }
      actions(pending, "host");
      pending = pending.filter(e => e.id > b.acks.host);
      const inputPacket = net.room()?.tombActions?.guest;
      if (inputPacket?.key === key) actions(inputPacket.events, "guest");

      if (["awaken", "rattle", "rise", "wait", "burn"].includes(b.phase)) {
        b.timer = Math.max(0, b.timer - dt);
        if (!b.timer) {
          if (b.phase === "awaken" || b.phase === "wait") {
            b.phase = "rattle"; b.timer = 1.5;
          } else if (b.phase === "rattle") {
            const grave = tombGraveSequence[b.number];
            b.phase = "rise"; b.timer = 1.2; b.hp = 4;
            b.x = W * grave.x; b.y = H * grave.y + 20;
            b.fire = []; b.bolts = []; b.sword = "held";
            b.throwTimer = 10; b.swingTimer = 0.8; b.swing = 0;
            b.swordX = b.swordY = b.targetX = b.targetY = null;
            b.fireTimer = 1.2; b.mouthTimer = 1.5; b.targetTimer = 0;
          } else if (b.phase === "rise") {
            b.phase = "fight";
          } else if (b.phase === "burn") {
            b.phase = "won"; b.number = tombGraveSequence.length;
            b.fire = []; b.bolts = [];
          }
        }
      }
      if (b.phase === "fight") {
        const target = chooseTarget(dt);
        const grave = tombGraveSequence[b.number];
        const swordUser = grave.name !== "Father";
        b.swing = Math.max(0, b.swing - dt);
        b.swingTimer -= dt; b.fireTimer -= dt;
        if (swordUser && b.sword === "landed") {
          const dx = b.swordX - b.x, dy = b.swordY - b.y, d = Math.hypot(dx, dy);
          if (d > 25) { b.x += dx / d * 50 * dt; b.y += dy / d * 50 * dt; }
          else {
            b.sword = "held"; b.throwTimer = 10; b.swingTimer = 0.8; b.fireTimer = 1.2;
            b.swordX = b.swordY = b.targetX = b.targetY = null;
          }
        }
        if (target) {
          const dx = target.x - b.x, dy = target.y - b.y, d = Math.hypot(dx, dy);
          if ((!swordUser || b.sword === "held") && d > 150) {
            b.x += dx / d * 38 * dt; b.y += dy / d * 38 * dt;
          }
          if (swordUser && b.sword === "held") {
            b.throwTimer -= dt;
            if (b.throwTimer <= 0) {
              b.sword = "flying"; b.throwId++; b.swing = 0;
              b.targetX = target.x; b.targetY = target.y;
              b.swordX = b.x + 14; b.swordY = b.y - 10;
              const length = Math.hypot(b.targetX - b.swordX, b.targetY - b.swordY) || 1;
              b.swordVx = (b.targetX - b.swordX) / length * 320;
              b.swordVy = (b.targetY - b.swordY) / length * 320;
              b.spin = 0;
            } else if (d <= 85 && b.swingTimer <= 0 && b.swing <= 0) {
              b.swing = 0.35; b.swingTimer = 1; b.swingId++;
            }
          }
          const angle = Math.atan2(target.y - b.y, target.x - b.x);
          if ((!swordUser || b.sword === "held") && b.fireTimer <= 0 && d > 85) {
            for (let i = 0; i < grave.fireballCount; i++) {
              fire(grave.fireballCount === 4 ? i * Math.PI / 2 :
                angle + (i - (grave.fireballCount - 1) / 2) * 0.18, 150);
            }
            b.fireTimer = 2;
          }
          if (grave.usesMouthFire) {
            b.mouthTimer -= dt;
            if (b.mouthTimer <= 0) { fire(angle, 220, true); b.mouthTimer = 0.55; }
          }
        }
        b.x = clamp(b.x, 86, W - 86); b.y = clamp(b.y, 105, H - 78);
      }
      moveHazards(dt, true);
    }

    function moveHazards(dt, authoritative) {
      const b = battle;
      if (b.phase === "fight" && b.sword === "flying") {
        const distance = Math.hypot(b.targetX - b.swordX, b.targetY - b.swordY);
        if (distance <= 320 * dt + 1) {
          b.swordX = b.targetX; b.swordY = b.targetY;
          if (authoritative) landSword();
        } else {
          b.swordX += b.swordVx * dt; b.swordY += b.swordVy * dt;
        }
        b.spin += dt * 12;
      }
      for (const f of b.fire) { f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; }
      b.fire = b.fire.filter(f => f.life > 0 && f.x >= 0 && f.x <= W && f.y >= 0 && f.y <= H);
      for (let i = b.bolts.length - 1; i >= 0; i--) {
        const shot = b.bolts[i], oldX = shot.x;
        shot.x += shot.vx * dt; shot.life -= dt;
        if (authoritative && vulnerable() && Math.abs(shot.y - b.y) < 45 &&
            b.x > Math.min(oldX, shot.x) - 30 && b.x < Math.max(oldX, shot.x) + 30) {
          b.bolts.splice(i, 1); hit();
          if (b.phase !== "fight") break;
        } else if (shot.life <= 0 || shot.x < 0 || shot.x > W) b.bolts.splice(i, 1);
      }
    }

    function hazards() {
      if (!localAlive() || ["idle", "awaken", "burn", "won"].includes(battle.phase)) return;
      const b = battle;
      for (const f of b.fire) {
        const id = "fire_" + f.id;
        if (!touched.has(id) && Math.hypot(player.x - f.x, player.y - f.y) < 27) {
          touched.add(id);
          emit("touch", { fire: f.id });
          damagePlayerByLaser();
        }
      }
      if (!localAlive() || b.phase !== "fight") return;
      const swingId = "swing_" + b.swingId;
      const distance = Math.hypot(player.x - b.x, player.y - b.y);
      if (b.sword === "held" && tombGraveSequence[b.number].name !== "Father" &&
          b.swing > 0.12 && b.swing < 0.24 && distance < 72 && !touched.has(swingId)) {
        touched.add(swingId); damagePlayerByLaser();
      }
      const throwId = "throw_" + b.throwId;
      if (b.sword === "flying" && !touched.has(throwId) &&
          Math.hypot(player.x - b.swordX, player.y - b.swordY) < 36) {
        touched.add(throwId);
        emit("touch", { sword: b.throwId });
        if (localAlive() && player.invuln <= 0) { player.hp = 1; damagePlayerByLaser(); }
      }
      if (localAlive() && distance < 52) {
        const nx = distance > 0.001 ? (player.x - b.x) / distance : 1;
        const ny = distance > 0.001 ? (player.y - b.y) / distance : 0;
        player.x = clamp(b.x + nx * 52, 86, W - 86);
        player.y = clamp(b.y + ny * 52, 105, H - 78);
      }
    }

    function send() {
      if (failed || !battle) return;
      const sentKey = key;
      if (host()) {
        if (writeBusy || performance.now() - lastWrite < 80) return;
        writeBusy = true; lastWrite = performance.now(); battle.revision++;
        const packet = copy(battle);
        net.send({ tombBattle: packet })
          .then(() => { if (key === sentKey && packet.phase === "won") winCommitted = true; })
          .catch(err => error(err, sentKey))
          .finally(() => { if (key === sentKey) writeBusy = false; });
      } else {
        if (inputBusy || !pending.length || pending[pending.length - 1].id === lastSent) return;
        inputBusy = true; lastSent = pending[pending.length - 1].id;
        net.send({ "tombActions/guest": { key, events: copy(pending) } })
          .catch(err => error(err, sentKey))
          .finally(() => { if (key === sentKey) inputBusy = false; });
      }
    }

    function step(dt) {
      poll();
      if (!battle || failed) return;
      if (host()) advance(dt);
      else if (performance.now() - receivedAt < 250) {
        // Smooth projectiles between snapshots; only the host advances HP or phases.
        battle.swing = Math.max(0, battle.swing - dt);
        if (["awaken", "rattle", "rise", "wait", "burn"].includes(battle.phase)) {
          battle.timer = Math.max(0, battle.timer - dt);
        }
        moveHazards(dt, false);
      }
      hazards(); mirror(); send(); updateHud();
    }

    const originalHeadbutt = headbutt;
    headbutt = function() {
      if (on() && !localAlive()) return;
      const oldCooldown = player.headCd;
      originalHeadbutt();
      if (on() && player.headCd > oldCooldown) emit("head");
    };
    const originalShoot = playerShoot;
    playerShoot = function() {
      if (!on()) return originalShoot();
      if (player.ray > 0) emit("ray", { face: player.face, ray: player.ray, giant: player.giant > 0 });
    };
    const originalDrawShots = drawShots;
    drawShots = function() {
      originalDrawShots();
      if (!on() || !battle) return;
      for (const shot of battle.bolts) {
        ctx.fillStyle = "#fff"; ctx.fillRect(shot.x - 10, shot.y - 3, 20, 6);
        ctx.fillStyle = "#66d9ff"; ctx.fillRect(shot.x - 7, shot.y - 2, 14, 4);
      }
    };
    const travelTick = coop.tick;
    coop.tick = function() {
      const blocked = travelTick();
      if (!blocked) poll();
      return blocked;
    };
    coop.battle = { start, step, reset, won: () => on() && battle?.phase === "won" && winCommitted && !failed };
  }

  window.__uvzuInstallTombMultiplayer = function(code, network) {
    window.__uvzuTombTravelNetwork = network;
    function once(before, after) {
      if (code.split(before).length !== 2) throw new Error("Tomb multiplayer hook missing: " + before.slice(0, 60));
      code = code.replace(before, () => after);
    }
    const start = code.indexOf("          graveyardSecretReturnState = {");
    const lastLine = "          player.y = H * 0.72;";
    const end = code.indexOf(lastLine, start);
    if (start < 0 || end < start) throw new Error("Secret tomb entrance not found");
    const oldEntry = code.slice(start, end + lastLine.length);
    once(oldEntry, '          if (window.__uvzuTombCoop.active()) {\n' +
      '            graveyardAngelHoldTimer = 0;\n' +
      '            window.__uvzuTombCoop.request("enter");\n' +
      '          } else {\n' + oldEntry + '\n          }');
    once('returnButton.onclick = function() {\n  if (!graveyardSecretReturnState) return;',
      'returnButton.onclick = function() {\n' +
      '  if (window.__uvzuTombCoop.active()) {\n' +
      '    window.__uvzuTombCoop.request("return");\n    return;\n  }\n' +
      '  if (!graveyardSecretReturnState) return;');
    once('    if (paused) {\n      draw();',
      '    if (window.__uvzuTombCoop.tick()) {\n' +
      '      draw();\n      requestAnimationFrame(loop);\n      return;\n    }\n\n' +
      '    if (paused) {\n      draw();');
    // A partner may return while this player's victory message is still fading.
    once('  message.style.transition = "opacity 1.5s";',
      '  if (window.__uvzuCurrentLevelCode !== "TOMB1" || tombSkeletonNumber < tombGraveSequence.length) { message.remove(); return; }\n' +
      '  message.style.transition = "opacity 1.5s";');
    once('  const returnButton = document.createElement("button");',
      '  if (window.__uvzuCurrentLevelCode !== "TOMB1" || tombSkeletonNumber < tombGraveSequence.length) return;\n' +
      '  const returnButton = document.createElement("button");');
    once('      tombEncounterStarted = true;\n      tombAwakenDelay = 1.5;',
      '      if (window.__uvzuTombCoop.active()) window.__uvzuTombCoop.battle.start();\n' +
      '      else { tombEncounterStarted = true; tombAwakenDelay = 1.5; }');

    const loopStart = code.indexOf('  function loop(now) {');
    const stepStart = code.indexOf('\nif (\n  window.__uvzuCurrentLevelCode === "TOMB1" &&\n  tombEncounterStarted &&', loopStart);
    const stepEnd = code.indexOf('\ndraw();\ndrawTombFirstGraveRattle();', stepStart);
    if (loopStart < 0 || stepStart < loopStart || stepEnd < stepStart) throw new Error('Tomb battle loop not found');
    const oldStep = code.slice(stepStart, stepEnd);
    once(oldStep, '\nif (window.__uvzuTombCoop.active() && window.__uvzuCurrentLevelCode === "TOMB1") {\n' +
      '  window.__uvzuTombCoop.battle.step(dt);\n} else {\n' + oldStep + '\n}\n');

    // Reuse the original victory message and return button, including their styling.
    const victoryStart = code.indexOf('  const message = document.createElement("div");\n  message.id = "tombFatherVictoryMessage";');
    const victoryEnd = code.indexOf('\n}, 5000);', victoryStart);
    if (victoryStart < 0 || victoryEnd < victoryStart) throw new Error('Tomb victory message not found');
    const victory = 'function __uvzuShowSharedTombVictory() {\n' +
      code.slice(victoryStart, victoryEnd + '\n}, 5000);'.length) + '\n}\n';
    once('  let last = performance.now();', victory + '\n(' + installTravel.toString() + ')();\n(' +
      installBattle.toString() + ')();\n\n  let last = performance.now();');
    return code;
  };
})();
