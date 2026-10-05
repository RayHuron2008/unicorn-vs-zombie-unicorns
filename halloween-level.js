// HALO4 — Lantern Lane. Level 4: Downtown -> Halloween -> Forest.
// Standalone level; shares the game's controls and unchanged unicorn artwork.
(() => {
  function halloweenRuntime() {
    const LEVEL = "HALO4", TOTAL = 8, SPAWN_SECONDS = 60;
    const MUSIC_URL = "./halloween-lantern-lane.mp3?v=1";
    const RELEASE_AT = [0, 0, 0, 16, 24, 36, 44, 52];
    // Faster arrivals and a second-half surge; the ordinary difficulty menu applies.
    const DIFFICULTY = {
      Easy:   { speed: 78, gap: 2.6, cap: 5, windup: .66, recovery: 1.6 },
      Normal: { speed: 90, gap: 2.3, cap: 6, windup: .60, recovery: 1.5 },
      Hard:   { speed: 102, gap: 2.0, cap: 7, windup: .54, recovery: 1.4 }
    };
    const settings = () => DIFFICULTY[window.__uvzuCurrentDifficultyName] || DIFFICULTY.Easy;
    const active = () => window.__uvzuCurrentLevelCode === LEVEL;
    const host = () => !!window.__uvzuIsMultiplayerHost?.();
    const guest = () => !!window.__uvzuIsMultiplayerGuest?.();
    const role = () => guest() ? "guest" : "host";
    const ghost = () => player.lives <= 0 || !!window.__uvzuIsLocalGhost?.();
    const copy = value => JSON.parse(JSON.stringify(value));
    const list = value => Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {});
    const old = { fullRestart, safeLifeReset, update, updateEnemies, spawnEnemy,
      startFinalWave, updateEnding, loseLife, draw, drawBackground, updateHud, startMusic };
    const session = () => {
      const room = window.__uvzuTombTravelNetwork?.room?.() || {};
      return [room.createdAt || 0, room.nextLevelAt || 0, room.ghostResetAt || 0].join(":");
    };
    const safeZone = { x: 736, y: 335, w: 172, h: 69 };
    const spots = [[195,405],[470,465],[330,359],[625,475],[125,481],[535,360],[365,482],[630,408]];
    let serial = 0, loss = 0, lastPacket = 0, hasSnapshot = false, retryWaiting = false, nextSent = false;
    let notice = "", noticeTime = 0, sceneryCanvas = null;
    let halloweenMusic = null, musicPending = false, musicBlocked = false, pageHidden = false;
    const seenStrikes = new Set();
    const fresh = () => ({ level: LEVEL, session: session(), run: Date.now() + "-" + (++serial),
      clock: 0, phase: "rescue", phaseTime: 0, rescued: 0, spawned: 0, spawnTimer: 2.8,
      nextChild: 0, revealTimer: 0, event: 0, failure: "", zombies: [], strikes: [],
      lastRescuer: "", ending: null,
      people: spots.map(([x,y], id) => ({ id, x, y, hp: 3, status: "inside", carrier: "",
        loss: 0, safeOrder: -1, invuln: 0, pickupDelay: 0, flash: 0, face: 1, walking: false,
        homeX: x, homeY: y })) });
    let rescue = fresh();
    window.__uvzuGetHalloweenState = () => active() ? { ...rescue, zombies: state.enemies } : null;
    window.__uvzuGetHalloweenStatus = () => active() ? { level: LEVEL, run: rescue.run, loss } : null;
    const push = () => { if (host()) window.__uvzuMultiplayerPushEnemyState?.(state.enemies, true); };
    const say = (message, seconds = 1.8) => { notice = message; noticeTime = seconds; };
    const inSafeZone = p => p.x >= safeZone.x && p.x <= safeZone.x + safeZone.w &&
      p.y >= safeZone.y && p.y <= safeZone.y + safeZone.h;
    const passenger = who => rescue.people.find(p => p.status === "riding" && p.carrier === who);
    const wantsMusic = () => active() && gameStarted && !paused && !document.hidden && !pageHidden && rescue.phase !== "failed";
    function stopHalloweenMusic(reset = false) {
      if (!halloweenMusic) return;
      if (!halloweenMusic.paused || musicPending) halloweenMusic.pause();
      if (reset && halloweenMusic.currentTime !== 0) { try { halloweenMusic.currentTime = 0; } catch (_) {} }
    }
    function playHalloweenMusic(retry = false) {
      if (!wantsMusic()) { stopHalloweenMusic(!active()); return; }
      window.__uvzuStopMainMusic?.(); window.stopTombMusic?.();
      if (!halloweenMusic) {
        halloweenMusic = new Audio(MUSIC_URL);
        halloweenMusic.loop = true;
        halloweenMusic.volume = 0.45;
        halloweenMusic.preload = "auto";
      }
      if (!halloweenMusic.paused || musicPending || (musicBlocked && !retry)) return;
      // Phone browsers may require a tap before allowing audio. The existing
      // pointer handlers and the keyboard handler below retry on the next input.
      try {
        musicPending = true; musicBlocked = false;
        Promise.resolve(halloweenMusic.play()).then(() => {
          musicPending = false;
          if (!wantsMusic()) stopHalloweenMusic(!active());
        }, () => { musicPending = false; musicBlocked = true; });
      } catch (_) { musicPending = false; musicBlocked = true; }
    }
    function localPosition() {
      resetPlayerPosition();
      player.x = guest() ? 330 : 250; player.y = 447;
      player.webbedTimer = player.webFlash = 0; player.webTrapX = player.webTrapY = null;
    }
    function removeResult() {
      document.getElementById("halloweenResult")?.remove(); retryWaiting = false;
    }
    function initialize() {
      stopHalloweenMusic(true);
      window.__uvzuReviveLocalForNextLevel?.(player);
      old.fullRestart(); rescue = fresh(); loss = 0; seenStrikes.clear();
      hasSnapshot = false; lastPacket = 0; noticeTime = 0; nextSent = false;
      removeResult(); localPosition(); state.mode = "play"; state.enemies = rescue.zombies;
      window.__uvzuLevelTheme = "halloween";
      window.__uvzuStopMainMusic?.(); window.stopTombMusic?.();
      revealChildren(); updateHud(); playHalloweenMusic(true);
    }
    fullRestart = function() {
      if (!active()) { stopHalloweenMusic(true); nextSent = false; removeResult(); return old.fullRestart(); }
      // A guest's retry is a request; only the host creates the new shared run.
      if (guest() && hasSnapshot && rescue.session === session()) {
        retryWaiting = true;
        window.__uvzuRequestEnemyKill?.("halloween-retry-" + rescue.run);
        const button = document.getElementById("halloweenRetry");
        if (button) { button.textContent = "RESTARTING..."; button.disabled = true; }
        return;
      }
      initialize(); push();
    };
    safeLifeReset = function() {
      if (!active()) return old.safeLifeReset();
      state.resetQueued = false; localPosition();
      state.playerShots.length = state.enemyShots.length = 0;
      // Rescued people, waiting people, and the survival clock persist after a life loss.
      state.mode = rescue.phase === "rescue" ? "play" : "rescueScene";
    };
    spawnEnemy = function(...args) { if (!active()) return old.spawnEnemy(...args); };
    startFinalWave = function() { if (!active()) return old.startFinalWave(); };
    updateEnding = function(dt) { if (!active()) return old.updateEnding(dt); };
    startMusic = function() {
      if (active()) playHalloweenMusic(true);
      else { stopHalloweenMusic(true); old.startMusic(); }
    };
    window.__uvzuStartMainMusic = startMusic;
    const previousMusic = window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic = function() {
      previousMusic?.(); playHalloweenMusic(true);
    };
    const previousStart = window.__uvzuStartGame;
    window.__uvzuStartGame = function(...args) {
      const result = previousStart(...args);
      playHalloweenMusic(true); return result;
    };
    const previousPause = window.__uvzuSetPaused;
    window.__uvzuSetPaused = function(value) {
      previousPause(value); playHalloweenMusic(true);
    };
    for (const event of ["keydown", "pointerdown"]) window.addEventListener(event, () => playHalloweenMusic(true));
    document.addEventListener?.("visibilitychange", () => playHalloweenMusic(true));
    window.addEventListener("pagehide", () => { pageHidden = true; stopHalloweenMusic(); });
    window.addEventListener("pageshow", () => { pageHidden = false; playHalloweenMusic(true); });
    function finish(phase, reason = "") {
      if (rescue.phase !== "rescue") return;
      rescue.phase = phase; rescue.phaseTime = 0; rescue.failure = reason;
      if (phase === "failed") stopHalloweenMusic();
      state.mode = "rescueScene"; rescue.strikes = [];
      state.playerShots.length = state.enemyShots.length = 0;
      if (phase === "won") {
        state.enemies.length = 0; beginHomecoming();
        if (host()) window.__uvzuSignalLevelCompleted?.();
      }
      push();
    }
    // One host-authored homecoming keeps both players in the same ending.
    function beginHomecoming() {
      rescue.ending = { participants: players().map(p => ({ role: p.role, fromX: p.x, fromY: p.y,
        x: p.role === "host" ? 745 : 865, y: 419 })) };
    }
    function endingPlayers() {
      const walk = clamp(rescue.phaseTime / 2, 0, 1);
      return list(rescue.ending?.participants).map(p => ({ role: p.role,
        x: p.fromX + (p.x-p.fromX)*walk, y: p.fromY + (p.y-p.fromY)*walk,
        face: 1, lives: 1, ray: 0, giant: 0, dead: false, ghost: false }));
    }
    function updateHomecoming() {
      if (rescue.phase !== "won" || !rescue.ending) return;
      const pose = endingPlayers().find(p => p.role === role());
      if (!pose) return;
      player.x=pose.x; player.y=pose.y; player.face=1; player.ray=player.giant=0;
      player.headTimer=player.dodgeTimer=0; player.invuln=999999;
    }
    const previousGameOver = window.__uvzuShowGameOver;
    window.__uvzuShowGameOver = function(retry) {
      if (!active()) return previousGameOver?.(retry);
      finish("failed", "The children still need you. Give Lantern Lane another try!");
    };
    function dropPassenger(who) {
      const p = passenger(who); if (!p) return;
      p.status = "waiting"; p.carrier = "";
      p.x = clamp(p.x, 85, 684); p.y = clamp(p.y, 345, 493);
      p.homeX = p.x; p.homeY = p.y;
      p.invuln = 3; p.pickupDelay = 1; p.flash = 0;
      if (who === role()) say("YOUR PASSENGER IS WAITING — GO BACK FOR THEM!");
      push();
    }
    loseLife = function() {
      if (!active()) return old.loseLife();
      const before = player.lives;
      old.loseLife();
      if (player.lives < before) {
        loss++; if (!guest()) dropPassenger(role());
        window.__uvzuMultiplayerPush?.(player);
      }
    };
    function players(includeDead = false) {
      const all = [{ ...player, role: role(), dead: ghost(), loss }];
      const remote = window.__uvzuGetRemotePlayer?.();
      if ((host() || guest()) && remote?.halloweenStatus?.run === rescue.run &&
          Number.isFinite(remote.x) && Number.isFinite(remote.y)) {
        all.push({ ...remote, role: guest() ? "host" : "guest", loss: remote.halloweenStatus.loss || 0,
          dead: !!remote.dead || !!remote.ghost || remote.lives <= 0 });
      }
      return includeDead ? all : all.filter(p => !p.dead);
    }
    function revealChildren() {
      let outside = rescue.people.filter(p => p.status === "waiting" || p.status === "riding").length;
      while (outside < 3 && rescue.nextChild < TOTAL && rescue.revealTimer <= 0 &&
          rescue.clock >= RELEASE_AT[rescue.nextChild]) {
        const p = rescue.people[rescue.nextChild++]; p.status = "waiting"; p.invuln = 3;
        outside++; if (rescue.nextChild > 2) { rescue.revealTimer = 1.8; say("ANOTHER TRICK-OR-TREATER IS OUT FOR CANDY!"); }
      }
    }
    function updateRescues(dt) {
      const everyone = players(true), live = everyone.filter(p => !p.dead);
      for (const p of rescue.people) {
        p.invuln = Math.max(0, p.invuln - dt); p.pickupDelay = Math.max(0, p.pickupDelay - dt);
        p.flash = Math.max(0, p.flash - dt); p.walking = false;
        if (p.status === "riding") {
          const carrier = everyone.find(q => q.role === p.carrier);
          if (!carrier) continue;
          if (carrier.dead || carrier.loss !== p.loss) { dropPassenger(p.carrier); continue; }
          p.x = carrier.x; p.y = carrier.y; p.face = carrier.face;
          if (inSafeZone(carrier)) {
            rescue.lastRescuer = carrier.role;
            p.status = "safe"; p.safeOrder = rescue.rescued++; p.carrier = "";
            state.score += 100; say("SAFE!  " + rescue.rescued + " / " + TOTAL + " TRICK-OR-TREATERS"); push();
          }
        } else if (p.status === "waiting" && p.pickupDelay <= 0) {
          // Stable role ordering makes simultaneous pickups resolve to one carrier.
          const carrier = live.filter(q => !passenger(q.role) && Math.abs(q.x-p.x) < 36 && Math.abs(q.y-p.y) < 31)
            .sort((a,b) => a.role.localeCompare(b.role))[0];
          if (carrier) {
            p.status = "riding"; p.carrier = carrier.role; p.loss = carrier.loss;
            p.x = carrier.x; p.y = carrier.y; p.face = carrier.face;
            say("TAKE YOUR PASSENGER TO THE WELCOMING HOUSE!"); push();
          }
        }
      }
      if (rescue.rescued === TOTAL) { finish("won"); return; }
      rescue.revealTimer = Math.max(0, rescue.revealTimer - dt); revealChildren();
    }
    function spawnZombie() {
      const number = rescue.spawned++, right = number % 2 === 1, tune = settings();
      state.enemies.push({ id: "halloween-z-" + rescue.run + "-" + number,
        x: right ? W + 46 : -46, y: [377,479,459,351][number % 4],
        w: 54, h: 34, face: right ? -1 : 1, type: "normal", hp: 1, shootTimer: 999, sep: 1,
        speed: tune.speed + number % 4 * 4 + Math.min(12,rescue.clock*.2),
        huntsPeople: number % 3 !== 2, mode: "walk", timer: 0, cooldown: 0,
        targetX: 0, targetY: 0, targetPerson: -1 });
    }
    function hitPerson(p) {
      if (!p || p.status !== "waiting" || p.invuln > 0) return;
      p.hp--; p.invuln = 3; p.flash = .4;
      if (p.hp <= 0) { finish("failed", "A trick-or-treater was caught! Protect the children and try again."); return; }
      say("A TRICK-OR-TREATER NEEDS HELP!"); push();
    }
    function zombieStrike(z) {
      const strike = { id: rescue.run + "-" + (++rescue.event), x: z.targetX, y: z.targetY, born: rescue.clock };
      rescue.strikes.push(strike);
      const p = rescue.people.find(person => person.id === z.targetPerson);
      if (p && Math.abs(p.x-strike.x) < 46 && Math.abs(p.y-strike.y) < 30) hitPerson(p);
      push();
    }
    function tickZombies(dt) {
      const waiting = rescue.people.filter(p => p.status === "waiting"), live = players(), tune = settings();
      const assigned = new Map();
      for (const z of state.enemies) {
        z.cooldown = Math.max(0, z.cooldown-dt);
        if (z.mode === "windup") {
          z.timer -= dt;
          if (z.timer <= 0) { z.mode = "rest"; z.timer = .45; z.cooldown = tune.recovery; zombieStrike(z); }
          if (rescue.phase !== "rescue") break;
          continue;
        }
        if (z.mode === "rest") { z.timer -= dt; if (z.timer <= 0) z.mode = "walk"; continue; }
        const targets = waiting.map(p => ({ ...p, civilian: true })).concat(live);
        const targetCost = p => {
          const distance = Math.hypot(p.x-z.x,(p.y-z.y)*1.25);
          // Players can intercept an attacker, but a distant player cannot draw every
          // zombie away from the people. Spread hunters across the waiting children.
          if (!p.civilian && distance < 82) return distance*.45;
          if (p.civilian && z.huntsPeople) return distance*.58 + (assigned.get(p.id)||0)*75;
          return distance;
        };
        targets.sort((a,b) => targetCost(a)-targetCost(b));
        const target = targets[0]; if (!target) continue;
        if (target.civilian) assigned.set(target.id,(assigned.get(target.id)||0)+1);
        const dx = target.x-z.x, dy = target.y-z.y, d = Math.hypot(dx,dy) || 1;
        z.face = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 48 && Math.abs(dy) < 27 && z.cooldown <= 0) {
          z.mode = "windup"; z.timer = tune.windup; z.targetX = target.x; z.targetY = target.y;
          z.targetPerson = target.civilian ? target.id : -1; continue;
        }
        if (d > 35) { z.x += dx/d*z.speed*dt; z.y += dy/d*z.speed*dt*.85; }
        for (const other of state.enemies) {
          if (other === z) continue;
          const sx = z.x-other.x, sy = z.y-other.y, gap = Math.hypot(sx,sy);
          if (gap > 0 && gap < 45) { z.x += sx/gap*14*dt; z.y += sy/gap*14*dt; }
        }
        z.y = clamp(z.y, 335, 509);
      }
      for (const p of waiting) {
        if (p.status !== "waiting") continue;
        // They think the zombies are costumes. They browse for candy, not safety.
        const dx = p.homeX + Math.sin(rescue.clock*.38+p.id)*22 - p.x;
        const dy = p.homeY + Math.cos(rescue.clock*.31+p.id)*8 - p.y;
        const d = Math.hypot(dx,dy) || 1, step = Math.min(d, 10*dt);
        p.x = clamp(p.x+dx/d*step,85,684); p.y = clamp(p.y+dy/d*step,345,493);
        if (Math.abs(dx)>1) p.face = Math.sign(dx);
        p.walking = d>3;
      }
    }
    updateEnemies = function(dt) {
      if (!active()) return old.updateEnemies(dt);
      if (!guest() && rescue.phase === "rescue") tickZombies(dt);
    };
    function localHazards() {
      if (ghost() || rescue.phase !== "rescue") return;
      for (const s of rescue.strikes) {
        if (seenStrikes.has(s.id) || rescue.clock-s.born > .7) continue;
        if (Math.abs(player.x-s.x) >= 45 || Math.abs(player.y-s.y) >= 30) continue;
        seenStrikes.add(s.id);
        if (player.invuln > 0 || player.dodgeTimer > 0) continue;
        if (!shieldBlockContact()) loseLife();
      }
    }
    function receiveState() {
      if (!guest()) return;
      const packet = window.__uvzuGetMultiplayerEnemyState?.(), data = packet?.halloween;
      if (!data || data.level !== LEVEL || data.session !== session() || packet.updatedAt <= lastPacket) return;
      const reset = data.run !== rescue.run;
      if (reset) {
        stopHalloweenMusic(true);
        window.__uvzuReviveLocalForNextLevel?.(player); old.fullRestart(); localPosition();
        loss = 0; seenStrikes.clear(); removeResult(); noticeTime = 0;
      }
      lastPacket = packet.updatedAt; hasSnapshot = true;
      const before = rescue.rescued; rescue = copy(data);
      rescue.people = list(rescue.people); rescue.zombies = list(rescue.zombies); rescue.strikes = list(rescue.strikes);
      if (!reset && rescue.rescued > before) say("SAFE!  " + rescue.rescued + " / " + TOTAL + " TRICK-OR-TREATERS");
      state.time = rescue.clock; state.enemies = rescue.zombies;
      if (reset) playHalloweenMusic();
    }
    function receiveRetry() {
      if (!host()) return false;
      const id = "halloween-retry-" + rescue.run;
      if (!window.__uvzuGetGuestKillRequests?.()?.[id]) return false;
      window.__uvzuClearGuestKillRequest?.(id); initialize(); push(); return true;
    }
    function showResult() {
      if (rescue.phase !== "failed" || document.getElementById("halloweenResult")) return;
      stopHalloweenMusic();
      const overlay = document.createElement("div"); overlay.id = "halloweenResult";
      overlay.style.cssText = "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#13293bb3;padding:24px;font-family:system-ui,sans-serif;text-align:center;color:white";
      const card = document.createElement("div");
      card.style.cssText = "max-width:440px;background:#173b46;border:3px solid #ffe69c;border-radius:18px;padding:28px;box-shadow:0 16px 60px #0008";
      const title = document.createElement("h2"); title.textContent = "RESCUE INTERRUPTED";
      const description = document.createElement("p"); description.textContent = rescue.failure;
      const button = document.createElement("button"); button.id = "halloweenRetry";
      button.textContent = retryWaiting ? "RESTARTING..." : "TRY AGAIN"; button.disabled = retryWaiting;
      button.style.cssText = "padding:14px 24px;border:0;border-radius:10px;background:#ffe69c;color:#173b46;font:bold 18px system-ui;cursor:pointer;touch-action:manipulation";
      button.addEventListener("click", () => fullRestart());
      card.appendChild(title); card.appendChild(description); card.appendChild(button);
      if (host() || guest()) {
        const hint = document.createElement("p"); hint.textContent = "Restarts the rescue for both players.";
        hint.style.cssText = "font-size:13px;color:#c9e1e4"; card.appendChild(hint);
      }
      overlay.appendChild(card); document.body.appendChild(overlay); button.focus?.();
    }
    function continueCity() {
      if (window.__uvzuCurrentLevelCode !== "CITY3" || nextSent || guest()) return;
      if (!window.__uvzuGetDowntownState?.()?.finished) return;
      nextSent = true;
      if (host()) window.__uvzuSignalNextLevel?.(LEVEL);
      else {
        window.__uvzuCurrentLevelCode = LEVEL; window.__uvzuLevelTheme = "halloween";
        window.__uvzuUpdateLevelMusic?.(); fullRestart();
      }
    }
    update = function(dt) {
      if (!active()) { stopHalloweenMusic(true); old.update(dt); continueCity(); return; }
      receiveState(); if (receiveRetry()) return;
      const run = rescue.run;
      state.mode = rescue.phase === "rescue" ? "play" : "rescueScene";
      if (!guest() && rescue.phase === "rescue") updateRescues(dt);
      old.update(dt);
      if (!active() || run !== rescue.run) return;
      noticeTime = Math.max(0, noticeTime-dt);
      rescue.phaseTime += dt;
      if (!guest()) {
        rescue.zombies = state.enemies;
        if (rescue.phase === "rescue") {
          rescue.clock += dt; rescue.spawnTimer -= dt;
          const tune=settings(), surge=rescue.clock>=25, teammate=players().length>1;
          const cap=Math.min(8,tune.cap+(surge?1:0)+(teammate?1:0));
          if (rescue.clock < SPAWN_SECONDS && rescue.spawnTimer <= 0 && state.enemies.length < cap) {
            spawnZombie(); rescue.spawnTimer = tune.gap-(surge ? .6 : 0)-(teammate ? .2 : 0);
          }
          rescue.strikes = rescue.strikes.filter(s => rescue.clock-s.born < 1);
        }
      } else {
        // The full snapshot keeps windup telegraphs that the base enemy packet omits.
        state.enemies = rescue.zombies;
        if (rescue.phase === "rescue") rescue.clock += dt;
      }
      updateHomecoming(); localHazards(); showResult(); updateHud(); playHalloweenMusic();
    };
    updateHud = function() {
      old.updateHud(); if (!active()) return;
      if (timeEl) timeEl.textContent = rescue.phase === "won" ? "Everyone safe!" : rescue.phase === "failed" ? "Try again" :
        rescue.clock < SPAWN_SECONDS ? "Time: " + Math.ceil(SPAWN_SECONDS-rescue.clock) + "s" : "Finish the rescue!";
      if (scoreEl) scoreEl.textContent = "Safe: " + rescue.rescued + " / " + TOTAL;
    };

    // Stationary, cached Canvas scenery. The original unicorn sprites are untouched.
    const box = (x,y,w,h,color) => { ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
    function oval(x,y,rx,ry,color) { ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill(); }
    function poly(points,color) { ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill(); }
    function line(x,y,x2,y2,color,width=2) { ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke(); }
    function text(value,x,y,size=18,color="#fff1cc",align="center") {
      ctx.textAlign=align;ctx.font="900 "+size+"px system-ui,sans-serif";ctx.lineJoin="round";
      ctx.strokeStyle="#211c3d";ctx.lineWidth=3;ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);
    }
    function glow(x,y,r,color) {
      const light=ctx.createRadialGradient(x,y,0,x,y,r);light.addColorStop(0,color);light.addColorStop(1,"#ffc47700");
      ctx.fillStyle=light;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    function pumpkin(x,y,s=1) {
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(0,2,17,5,"#10142666");
      oval(0,-8,16,14,"#ad462a");oval(-6,-10,10,12,"#ed762d");oval(5,-10,9,12,"#ff993f");
      oval(0,-10,7,13,"#e87931");box(-2,-25,4,7,"#8d9855");box(1,-26,5,3,"#b3b26f");
      poly([[-10,-12],[-5,-17],[-2,-11]],"#ffe890");poly([[3,-11],[6,-17],[11,-12]],"#ffe890");
      poly([[-9,-6],[-4,-3],[0,-5],[4,-3],[10,-7],[6,0],[-4,0]],"#ffdf75");ctx.restore();
    }
    function bareTree(x,y,s=1) {
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);
      poly([[-12,0],[8,0],[4,-81],[18,-125],[14,-131],[-3,-102],[-13,-163],[-18,-166],[-16,-94]],"#232338");
      for(const [a,b,c,d,w] of [[-5,-62,-42,-104,8],[-38,-98,-48,-143,5],[-37,-96,-72,-112,5],[0,-88,42,-128,7],[36,-121,68,-128,4],[38,-122,43,-160,4]])line(a,b,c,d,"#232338",w);
      line(-8,-5,-9,-78,"#61506a",3);
      for(let i=0;i<13;i++){const px=(i*29)%103-53,py=-90-(i*19)%68;oval(px,py,13,8,["#634259","#875348","#a96643"][i%3]);}
      ctx.restore();
    }
    function litWindow(x,y,w=31,h=35) {
      glow(x+w/2,y+h/2,48,"#ffb76330");box(x-4,y-5,w+8,h+11,"#24223a");box(x-2,y-3,w+4,h+6,"#bca291");
      const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,"#ffdf98");g.addColorStop(1,"#e99c66");
      ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
      poly([[x,y],[x+9,y],[x+5,y+h],[x,y+h]],"#b56678");poly([[x+w-9,y],[x+w,y],[x+w,y+h],[x+w-5,y+h]],"#995b76");
      box(x+w/2-1,y,3,h,"#ecd5ac");box(x,y+h*.5,w,3,"#ecd5ac");box(x-6,y+h+2,w+12,5,"#d9c3a6");
    }
    function house(x,y,w,wall,roof,safe=false) {
      box(x+6,y+103,w,16,"#121a2b66");box(x,y,w,115,wall);box(x+w-18,y,18,115,"#13142b35");
      for(let k=0;k<8;k++){box(x,y+12+k*13,w,1,"#cfb4a42b");box(x,y+13+k*13,w,1,"#191b3526");}
      box(x+24,y-60,23,40,"#795362");box(x+22,y-63,27,7,"#ad8190");
      poly([[x-15,y+3],[x+w*.5,y-75],[x+w+15,y+3]],"#141a2e");
      poly([[x-14,y-4],[x+w*.5,y-84],[x+w+14,y-4]],roof);
      for(let row=0;row<5;row++) {
        const left=x-9+row*20,right=x+w+9-row*20,yy=y-10-row*14;
        line(left,yy,right,yy,"#cec6d52a",2);
        for(let xx=left+18;xx<right;xx+=25)line(xx,yy,xx+4,yy+10,"#11152644",1);
      }
      poly([[x-15,y-4],[x+w*.5,y-84],[x+w+15,y-4],[x+w+8,y-4],[x+w*.5,y-76],[x-8,y-4]],"#a19bb6");
      box(x-10,y-3,w+20,8,"#d4bcb1");
      litWindow(x+16,y+28);litWindow(x+w-49,y+28);
      box(x+w/2-21,y+37,42,78,"#e8d1ab");box(x+w/2-16,y+42,32,73,safe?"#ffe4aa":"#615270");
      if(safe){glow(x+w/2,y+95,88,"#ffd48858");box(x+w/2-12,y+45,24,70,"#ffcb77");}
      else {box(x+w/2-11,y+48,22,21,"#ecc887");box(x+w/2+9,y+84,3,4,"#f5c974");}
      box(x+w/2-31,y+108,62,7,"#7b6c80");box(x+w/2-36,y+115,72,6,"#aa91a0");
      poly([[x+w/2-36,y+121],[x+w/2+36,y+121],[x+w/2+50,338],[x+w/2-50,338]],safe?"#cfad87":"#73657d");
      for(let i=0;i<10;i++){const xx=x-6+i*(w+12)/9,yy=y+9+Math.sin(i/9*Math.PI)*8;
        line(xx,yy,xx+16,yy+2,"#302336",1);oval(xx,yy+3,3,4,i%2?"#eab2ed":"#ffc475");}
      if(safe) {
        box(x+5,y+83,w-10,21,"#4d776a");box(x+5,y+83,w-10,2,"#a1c890");
        text("COME ON IN!",x+w/2,y+99,13,"#fff2b1");
      } else {
        // Paper bunting and a smiling hanging ghost are decorations, not enemies.
        for(let i=0;i<4;i++)poly([[x+10+i*35,y+78],[x+30+i*35,y+78],[x+20+i*35,y+91]],i%2?"#ba8ddb":"#ee9960");
        line(x+w-10,y+13,x+w-10,y+35,"#c0acbd",1);
        oval(x+w-10,y+44,10,11,"#e5dcdf");poly([[x+w-20,y+43],[x+w,y+43],[x+w+2,y+60],[x+w-5,y+55],[x+w-10,y+60],[x+w-17,y+55],[x+w-22,y+60]],"#e5dcdf");
        oval(x+w-14,y+42,2,3,"#463a56");oval(x+w-7,y+42,2,3,"#463a56");
      }
    }
    function lamp(x,y) {
      glow(x,y-135,86,"#ffc8703e");poly([[x-9,y-127],[x+9,y-127],[x+57,y],[x-57,y]],"#ffc27309");
      box(x-4,y-137,8,139,"#222439");box(x-2,y-126,2,121,"#79677c");box(x-10,y-3,20,6,"#302b41");
      box(x-11,y-149,22,27,"#3a3048");box(x-7,y-145,14,18,"#ffde95");box(x-1,y-145,3,18,"#5b4557");
      poly([[x-15,y-149],[x,y-161],[x+15,y-149]],"#4b4059");
    }
    function scenery() {
      const sky=ctx.createLinearGradient(0,0,0,350);sky.addColorStop(0,"#151c3e");sky.addColorStop(.63,"#3c355b");sky.addColorStop(1,"#936474");
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      for(let i=0;i<68;i++){const x=(i*137+21)%W,y=(i*47+19)%190;box(x,y,i%8===0?3:1,i%8===0?3:1,i%3?"#f5dcb68a":"#b5c2dd8a");}
      glow(120,89,90,"#e1dcd735");oval(120,89,35,35,"#f4e8c3");oval(117,85,30,31,"#fff2ce");
      for(const [x,y,r] of [[104,82,6],[125,70,4],[133,99,8],[114,108,4]])oval(x,y,r,r,"#d8d4b27d");
      for(const [x,y,s] of [[228,101,1],[254,90,.65],[639,69,.8]])poly([[x-13*s,y],[x-5*s,y-4*s],[x,y],[x+5*s,y-4*s],[x+13*s,y],[x+5*s,y+2*s],[x,y+5*s],[x-5*s,y+2*s]],"#141a32");
      poly([[0,224],[69,191],[145,208],[225,176],[322,204],[420,172],[553,218],[668,182],[823,212],[931,171],[960,201],[960,300],[0,300]],"#292b46");
      for(let i=0;i<16;i++){const x=i*67,y=224+(i%3)*9;box(x,y,49,59,"#303149");poly([[x-4,y],[x+24,y-24],[x+53,y]],"#26283f");if(i%3===0)box(x+12,y+10,5,8,"#bca18070");}
      box(0,275,W,74,"#3c4650");box(0,310,W,28,"#515849");
      bareTree(28,323,.94);bareTree(312,309,.94);bareTree(616,315,.87);bareTree(948,303,.9);
      house(80,210,170,"#765a76","#53405d");house(351,204,182,"#52647b","#42435c");
      house(693,187,218,"#ad806f","#695574",true);
      // The porch is inside the safe-house boundary; rescued children stay here.
      box(697,302,211,32,"#a17d76");box(692,330,223,6,"#d5b392");box(702,308,3,22,"#dec4a3");box(900,308,3,22,"#dec4a3");
      box(0,338,W,19,"#7a7080");box(0,353,W,5,"#a09199");
      const road=ctx.createLinearGradient(0,358,0,524);road.addColorStop(0,"#42465e");road.addColorStop(1,"#292f48");
      ctx.fillStyle=road;ctx.fillRect(0,358,W,166);box(0,359,W,3,"#24283e");box(0,365,W,2,"#7b77916b");
      for(let x=0;x<W;x+=61)line(x,339,x+5,352,"#504b65",1);
      for(let x=18;x<W;x+=120)box(x,445,56,4,"#c6b38a88");
      for(let i=0;i<72;i++){const x=(i*97+33)%W,y=372+(i*23)%138;box(x,y,i%4+1,1,"#a8a4be25");}
      box(0,523,W,6,"#858095");box(0,529,W,11,"#333e44");
      for(let i=0;i<33;i++){const x=(i*83+37)%W,y=i%2?344:528;poly([[x,y],[x+7,y-3],[x+11,y+1],[x+4,y+3]],i%3?"#ad754c":"#935666");}
      lamp(53,354);lamp(650,353);
      for(const [x,y,s] of [[80,341,.9],[254,340,.7],[337,339,.65],[550,339,.85],[717,339,.9],[894,340,1]]){glow(x,y-8,29,"#ffac5029");pumpkin(x,y,s);}
      glow(803,325,130,"#ffcf7a27");
      box(804,219,4,4,"#ffeeaf");
      // A cobweb on the left eave is harmless scenery.
      for(let i=0;i<4;i++)line(83,214,83+i*12,251-i*10,"#d2bfcd80",1);
      for(let i=1;i<4;i++)line(83,214+i*9,83+i*10,214,"#d2bfcd80",1);
    }
    const skins=["#dda77c","#8b5e47","#f0c79f","#b17b56","#ebba93","#79503e","#d69f78","#a46b4c"];
    function human(p,x,y,pose="waiting",face=1) {
      const id=p.id%8,riding=pose==="riding",cheering=pose==="cheer",skin=skins[id];
      const stride=p.walking?Math.sin(gameClock*10+id)*3:0,wave=cheering?Math.sin(gameClock*7+id)*4:0;
      const suit=["#b799db","#ede8ec","#95517b","#ed893e","#b4d7e1","#59748d","#50546f","#9cb7b3"][id];
      ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(.78,.78);
      if(p.flash>0&&Math.floor(gameClock*16)%2===0)ctx.globalAlpha=.5;
      if(!riding)oval(0,2,16,5,"#12132866");
      if(id===2)poly([[-9,-44],[-23,-13],[21,-13],[10,-44]],"#552c52");
      if(id===6){ctx.strokeStyle="#8b799d";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(9,-23);ctx.quadraticCurveTo(31,-23,19,-38);ctx.stroke();}
      if(!riding){box(-9-stride*.4,-23,7,24,"#343a55");box(3+stride*.4,-23,7,24,"#282d47");box(-12-stride*.4,-3,13,5,"#22263c");box(2+stride*.4,-3,13,5,"#22263c");}
      else {box(-10,-23,22,9,"#3c405b");box(face>0?5:-11,-16,7,15,"#454966");box(face>0?5:-15,-3,11,4,"#24283f");}
      box(-12,-46,24,25,suit);box(7,-45,5,24,"#24243c33");box(-9,-43,3,18,"#ffffff26");
      const hand=cheering?-58+wave:riding?-28:-24;
      line(-11,-42,-17,hand,suit,6);line(11,-42,17,cheering?-58-wave:hand,suit,6);
      box(-20,hand,6,6,skin);box(14,cheering?-58-wave:hand,6,6,skin);
      box(-4,-51,8,8,"#835b50");oval(0,-58,12,13,skin);box(-12,-64,4,10,"#4a3542");box(-10,-71,20,5,"#4a3542");
      box(-6,-60,3,3,"#30283b");box(4,-60,3,3,"#30283b");box(-3,-53,7,2,"#985b57");
      if(id===0){poly([[-12,-67],[2,-93],[12,-67]],"#65478a");oval(0,-68,21,5,"#9371b0");box(-6,-74,17,5,"#e7a65c");box(2,-73,5,4,"#fff0a0");}
      if(id===1){oval(0,-60,15,18,"#f6edf0");poly([[-14,-58],[14,-58],[17,-23],[10,-28],[3,-22],[-4,-28],[-12,-22],[-17,-25]],"#e8e0ed");oval(-5,-60,3,5,"#4f4865");oval(5,-60,3,5,"#4f4865");oval(0,-47,3,2,"#a69aac");}
      if(id===2){poly([[-13,-49],[0,-41],[13,-49],[8,-28],[-8,-28]],"#e9dbe2");poly([[0,-41],[-5,-36],[0,-35],[5,-36]],"#d2738e");box(-3,-52,2,3,"#fff5d6");box(2,-52,2,3,"#fff5d6");}
      if(id===3){oval(0,-33,17,15,"#e98237");oval(-5,-34,8,13,"#f29d4f");line(7,-44,8,-22,"#bd5b30",2);poly([[-9,-35],[-4,-41],[0,-35]],"#784036");poly([[3,-35],[8,-41],[12,-35]],"#784036");poly([[-5,-29],[0,-27],[6,-30],[2,-24]],"#784036");box(-1,-77,4,8,"#95ac70");}
      if(id===4){ctx.strokeStyle="#e5edf3";ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,-59,16,19,0,0,Math.PI*2);ctx.stroke();line(-9,-70,5,-73,"#ffffffaa",2);box(-8,-40,15,11,"#4d708b");box(-5,-37,4,3,"#e79c76");box(2,-37,3,3,"#bce798");}
      if(id===5){poly([[-19,-65],[-15,-78],[0,-73],[15,-78],[19,-65]],"#353447");box(-17,-66,34,4,"#e7b77b");oval(0,-70,3,3,"#f1ddc8");box(2,-61,7,5,"#29293c");line(-11,-63,12,-60,"#353042",2);box(-11,-32,23,5,"#b06b68");}
      if(id===6){poly([[-11,-66],[-13,-83],[-2,-70]],"#66617f");poly([[2,-70],[13,-83],[12,-66]],"#66617f");poly([[-9,-69],[-10,-78],[-5,-71]],"#d394aa");poly([[5,-71],[10,-78],[9,-69]],"#d394aa");oval(0,-55,3,2,"#c88f9f");line(-3,-53,-12,-52,"#dfc8dc",1);line(3,-53,12,-52,"#dfc8dc",1);}
      if(id===7){box(-15,-74,30,28,"#a0babb");box(-12,-71,24,22,"#779397");box(-8,-64,6,5,"#f3e4a8");box(3,-64,6,5,"#d4f0e9");box(-5,-54,12,2,"#d2e0d8");line(0,-74,0,-83,"#b5cec4",2);oval(0,-85,3,3,"#f5ae73");box(-7,-40,14,12,"#537078");box(-4,-37,3,3,"#ffda85");box(3,-37,3,3,"#d199e0");}
      if(!riding&&!cheering){ctx.strokeStyle="#bd864f";ctx.lineWidth=2;ctx.beginPath();ctx.arc(23,-20,7,Math.PI,Math.PI*2);ctx.stroke();oval(23,-15,9,9,"#e99945");poly([[18,-17],[21,-20],[23,-16]],"#634357");box(25,-19,3,3,"#634357");box(21,-11,6,2,"#634357");}
      ctx.restore();
    }
    function drawBackgroundHere() {
      if(!sceneryCanvas){const layer=document.createElement("canvas");layer.width=W;layer.height=H;
        if(layer.getContext){const snapshot=ctx.getImageData(0,0,W,H);scenery();layer.getContext("2d").drawImage(ctx.canvas,0,0);ctx.putImageData(snapshot,0,0);sceneryCanvas=layer;}}
      if(sceneryCanvas)ctx.drawImage(sceneryCanvas,0,0);else scenery();
      for(const p of rescue.people.filter(p=>p.status==="safe").sort((a,b)=>a.safeOrder-b.safeOrder)){
        const i=p.safeOrder,x=715+(i%4)*59,y=297+Math.floor(i/4)*37;
        human(p,x,y-Math.max(0,Math.sin(gameClock*5+p.id))*2,"cheer");
      }
      if(rescue.phase!=="rescue")return;
      ctx.fillStyle="rgba(255,208,128,"+(.14+.04*Math.sin(gameClock*4))+")";ctx.fillRect(safeZone.x,safeZone.y,safeZone.w,safeZone.h);
      ctx.strokeStyle="#ffe2a2";ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.strokeRect(safeZone.x+2,safeZone.y+2,safeZone.w-4,safeZone.h-4);ctx.setLineDash([]);
      poly([[809,356],[824,342],[839,356],[829,356],[829,368],[819,368],[819,356]],"#ffeab4");
      text("SAFE HOUSE",safeZone.x+safeZone.w/2,392,14,"#ffeab4");
    }
    drawBackground = function(){if(active())drawBackgroundHere();else old.drawBackground();};
    function drawPlayer(p,who) {
      if(p.dead||p.ghost||p.lives<=0)return;
      const carrying=passenger(who),scale=p.giant>0?1.28:1;
      if(who===role()){drawShieldAura();drawDodgeEffect();}
      drawUnicorn(p.x,p.y,p.face||1,false,p.ray>0,p.giant>0);
      if(carrying)human(carrying,p.x-8*(p.face||1)*scale,p.y-14*scale,"riding",p.face||1);
      if(host()||guest())text(who==="host"?"P1":"P2",p.x,p.y-(carrying?85:66),12,who==="host"?"#ffec9f":"#c2f5fa");
    }
    draw = function() {
      if(!active())return old.draw();
      ctx.save();drawBackgroundHere();const actors=[];
      for(const p of rescue.people)if(p.status==="waiting")actors.push({y:p.y,draw:()=>{
        human(p,p.x,p.y,"waiting",p.face);
        for(let i=0;i<3;i++)box(p.x-13+i*9,p.y-79,7,4,i<p.hp?"#ffdb96":"#795e80");
        if(p.flash>0)text("HEY!",p.x,p.y-87,11,"#ffd296");
        else if(Math.floor(rescue.clock/3)%8===p.id)text(p.id%2?"COOL COSTUME!":"TRICK OR TREAT!",p.x,p.y-87,10,"#eee0ff");
      }});
      for(const z of state.enemies)actors.push({y:z.y,draw:()=>{drawUnicorn(z.x,z.y,z.face,true,false,false);if(z.mode==="windup")text("!",z.x,z.y-67,23,"#ffba88");}});
      const cast=rescue.phase==="won"&&rescue.ending?endingPlayers():players();
      for(const p of cast)actors.push({y:p.y,draw:()=>drawPlayer(p,p.role)});
      for(const z of state.enemies)if(z.mode==="windup"){
        oval(z.targetX,z.targetY+3,39,17,"#ed7c7744");ctx.strokeStyle="#ffc48f";ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(z.targetX,z.targetY+3,39,17,0,0,Math.PI*2);ctx.stroke();
      }
      actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());drawShots();drawParticles();ctx.restore();drawHealthBar();
      box(328,17,304,62,"#26233cdd");box(328,17,304,2,"#e8b580");
      text("LANTERN LANE",480,44,21);text(rescue.rescued+" / "+TOTAL+" TRICK-OR-TREATERS SAFE",480,65,12,"#dcc8e8");
      if(rescue.phase==="won"){
        box(238,104,484,89,"#27253eeb");text("EVERYONE MADE IT HOME!",480,139,24,"#ffe4a5");
        text("MORE TREATS. NO TRICKS.",480,166,15,"#ddc8f1");
        if(rescue.phaseTime>2)text("THANK YOU!",804,230,16,"#fff0b6");
      } else if(rescue.phase==="rescue"){
        const message=noticeTime>0?notice:passenger(role())?"BRING YOUR TRICK-OR-TREATER TO THE SAFE HOUSE":
          rescue.clock<8?"THEY THINK THE ZOMBIES ARE COSTUMES. GET THEM HOME!":
          !rescue.people.some(p=>p.status==="waiting")?"MORE CHILDREN ARE COMING — KEEP THE STREET CLEAR":
          "PROTECT THE CHILDREN. CARRY THEM TO THE LIT HOUSE.";
        box(139,94,682,30,"#26233ccb");text(message,480,114,12,"#ffe3b0");
        if(rescue.clock<8)text("WALK UP TO PICK UP  •  GLOWING PORCH TO DROP OFF  •  A TO ATTACK",480,144,11,"#efdbeb");
      }
    };
  }

  window.__uvzuInstallHalloween = function(code) {
    function once(before,after){if(code.split(before).length!==2)throw new Error("Halloween hook missing: "+before.slice(0,90));code=code.replace(before,()=>after);}
    const movement='(["ICE10", "LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))';
    if(code.split(movement).length!==6)throw new Error("Halloween movement hooks missing");
    code=code.split(movement).join(movement.replace('["ICE10"','["HALO4", "ICE10"'));
    const ending='!["ICE10", "LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)';
    if(code.split(ending).length!==3)throw new Error("Halloween ending hooks missing");
    code=code.split(ending).join(ending.replace('["ICE10"','["HALO4", "ICE10"'));
    once('window.__uvzuLevelTheme = nextCode === "ICE10" ? "ice" :',
      'window.__uvzuLevelTheme = nextCode === "HALO4" ? "halloween" : nextCode === "ICE10" ? "ice" :');
    // Retarget the Forest's existing entry hook. Downtown now enters Halloween,
    // and only the completed Halloween homecoming can continue into the Forest.
    once('if (window.__uvzuCurrentLevelCode !== "CITY3" ||\n          !window.__uvzuGetDowntownState?.()?.finished || nextSent || guest()) return;',
      'if (window.__uvzuCurrentLevelCode !== "HALO4" || nextSent || guest()) return;\n      const halloween = window.__uvzuGetHalloweenState?.();\n      if (halloween?.phase !== "won" || halloween.phaseTime < 8) return;');
    once('  requestAnimationFrame(loop);\n})();','('+halloweenRuntime.toString()+')();\n  requestAnimationFrame(loop);\n})();');
    return code;
  };
})();
