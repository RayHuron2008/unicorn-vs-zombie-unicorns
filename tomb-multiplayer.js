// Shared secret-tomb travel. Skeleton combat remains handled by the existing game.
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
      if (kind === "return" && (!isTomb() || !saved || player.lives < 99)) return;
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
        const rewarded = role === "host" ? player.lives >= 99 : room.guest?.lives >= 99;
        const returning = request.kind === "return" && isTomb() && saved && rewarded;
        if (!entering && !returning) continue;
        busy = true;
        const portal = { id: request.id, kind: request.kind, epoch: currentEpoch,
          at: Date.now(), grave: entering ? snapshot() : copy(saved.grave) };
        net.send({ tombPortal: portal, tombRequests: null, enemyState: null,
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
    once('  let last = performance.now();', '(' + installTravel.toString() + ')();\n\n  let last = performance.now();');
    return code;
  };
})();
