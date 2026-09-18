// Neighborhood rescue, level 7, revision 2. Load before game.js.
// Level code: RSCU7. All gameplay, scenery, and rescue synchronization live here.
(() => {
  function neighborhoodRuntime() {
    const LEVEL = "RSCU7", TOTAL = 8, SPAWN_SECONDS = 60;
    const RELEASE_AT = [0, 0, 12, 20, 28, 36, 44, 52];
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
    const seenStrikes = new Set();
    const fresh = () => ({ level: LEVEL, session: session(), run: Date.now() + "-" + (++serial),
      clock: 0, phase: "rescue", phaseTime: 0, rescued: 0, spawned: 0, spawnTimer: 6,
      nextNeighbor: 0, revealTimer: 0, event: 0, failure: "", zombies: [], strikes: [],
      lastRescuer: "", ending: null,
      people: spots.map(([x,y], id) => ({ id, x, y, hp: 3, status: "inside", carrier: "",
        loss: 0, safeOrder: -1, invuln: 0, pickupDelay: 0, flash: 0, face: 1, walking: false })) });
    let rescue = fresh();
    window.__uvzuGetNeighborhoodState = () => active() ? { ...rescue, zombies: state.enemies } : null;
    window.__uvzuGetNeighborhoodStatus = () => active() ? { level: LEVEL, run: rescue.run, loss } : null;
    const push = () => { if (host()) window.__uvzuMultiplayerPushEnemyState?.(state.enemies, true); };
    const say = (message, seconds = 1.8) => { notice = message; noticeTime = seconds; };
    const inSafeZone = p => p.x >= safeZone.x && p.x <= safeZone.x + safeZone.w &&
      p.y >= safeZone.y && p.y <= safeZone.y + safeZone.h;
    const passenger = who => rescue.people.find(p => p.status === "riding" && p.carrier === who);
    function localPosition() {
      resetPlayerPosition();
      player.x = guest() ? 330 : 250; player.y = 447;
      player.webbedTimer = player.webFlash = 0; player.webTrapX = player.webTrapY = null;
    }
    function removeResult() {
      document.getElementById("neighborhoodResult")?.remove(); retryWaiting = false;
    }
    function initialize() {
      window.__uvzuReviveLocalForNextLevel?.(player);
      old.fullRestart(); rescue = fresh(); loss = 0; seenStrikes.clear();
      hasSnapshot = false; lastPacket = 0; noticeTime = 0; nextSent = false;
      removeResult(); localPosition(); state.mode = "play"; state.enemies = rescue.zombies;
      window.__uvzuLevelTheme = "neighborhood";
      window.__uvzuStopMainMusic?.(); window.stopTombMusic?.();
      revealNeighbors(); updateHud();
    }
    fullRestart = function() {
      if (!active()) { nextSent = false; removeResult(); return old.fullRestart(); }
      // A guest's retry is a request; only the host creates the new shared run.
      if (guest() && hasSnapshot && rescue.session === session()) {
        retryWaiting = true;
        window.__uvzuRequestEnemyKill?.("rescue-retry-" + rescue.run);
        const button = document.getElementById("neighborhoodRetry");
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
    startMusic = function() { if (active()) window.__uvzuStopMainMusic?.(); else old.startMusic(); };
    const previousMusic = window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic = function() {
      previousMusic?.(); if (active()) { window.__uvzuStopMainMusic?.(); window.stopTombMusic?.(); }
    };
    function finish(phase, reason = "") {
      if (rescue.phase !== "rescue") return;
      rescue.phase = phase; rescue.phaseTime = 0; rescue.failure = reason;
      state.mode = "rescueScene"; rescue.strikes = [];
      state.playerShots.length = state.enemyShots.length = 0;
      if (phase === "won") {
        state.enemies.length = 0; beginThankYou();
        if (host()) window.__uvzuSignalLevelCompleted?.();
      }
      push();
    }
    // The host records one ending for both screens, including who made the last rescue.
    function beginThankYou() {
      const live = players(), hero = live.find(p => p.role === rescue.lastRescuer) || live[0];
      if (!hero) return;
      rescue.ending = { hero: hero.role, ladyId: 7,
        participants: live.map(p => ({ role: p.role, fromX: p.x, fromY: p.y,
          x: p.role === hero.role ? 710 : 590, y: p.role === hero.role ? 435 : 450 })) };
    }
    function endingPlayers() {
      const walk = clamp(rescue.phaseTime / 2, 0, 1);
      return list(rescue.ending?.participants).map(p => ({ role: p.role,
        x: p.fromX + (p.x-p.fromX)*walk, y: p.fromY + (p.y-p.fromY)*walk,
        face: 1, lives: 1, ray: 0, giant: 0, dead: false, ghost: false }));
    }
    function ladyPose() {
      if (rescue.phase !== "won" || !rescue.ending) return null;
      const hero = list(rescue.ending.participants).find(p => p.role === rescue.ending.hero);
      const person = rescue.people.find(p => p.id === rescue.ending.ladyId);
      if (!hero || !person) return null;
      const age = rescue.phaseTime, index = person.safeOrder;
      const route = [
        [.6, 718+(index%6)*40, 297-Math.floor(index/6)*29],
        [1.5, 840, 310], [2.2, 840, 365], [3.2, hero.x+68, hero.y]
      ];
      let x=route[0][1], y=route[0][2];
      for (let i=1;i<route.length;i++) {
        if (age < route[i-1][0]) break;
        const t=clamp((age-route[i-1][0])/(route[i][0]-route[i-1][0]),0,1);
        x=route[i-1][1]+(route[i][1]-route[i-1][1])*t;
        y=route[i-1][2]+(route[i][2]-route[i-1][2])*t;
      }
      const lean = age < 6.3 ? clamp((age-5.9)/.4,0,1) : 1-clamp((age-7)/.5,0,1);
      return { person, x, y, hero, behindFence: age < 1.65,
        walking: age >= .6 && age < 3.2, lean, speaking: age >= 3.2 && age < 6.3 };
    }
    function heartPose() {
      const lady = ladyPose(), age = rescue.phaseTime-6.3;
      if (!lady || age < 0 || age >= 2.5) return null;
      return { x: lady.hero.x+46, y: lady.hero.y-66-age*22,
        scale: Math.min(1,age/.18)*(.95+Math.sin(age*7)*.08), alpha: clamp((2.5-age)/.6,0,1) };
    }
    function updateThankYou() {
      if (rescue.phase !== "won" || !rescue.ending) return;
      const pose = endingPlayers().find(p => p.role === role());
      if (!pose) return;
      player.x=pose.x; player.y=pose.y; player.face=1; player.ray=player.giant=0;
      player.headTimer=player.dodgeTimer=0; player.invuln=999999;
    }
    const previousGameOver = window.__uvzuShowGameOver;
    window.__uvzuShowGameOver = function(retry) {
      if (!active()) return previousGameOver?.(retry);
      finish("failed", "You ran out of lives. Give the neighborhood another try!");
    };
    function dropPassenger(who) {
      const p = passenger(who); if (!p) return;
      p.status = "waiting"; p.carrier = "";
      p.x = clamp(p.x, 65, 905); p.y = clamp(p.y, 340, 500);
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
      if ((host() || guest()) && remote?.neighborhoodStatus?.run === rescue.run &&
          Number.isFinite(remote.x) && Number.isFinite(remote.y)) {
        all.push({ ...remote, role: guest() ? "host" : "guest", loss: remote.neighborhoodStatus.loss || 0,
          dead: !!remote.dead || !!remote.ghost || remote.lives <= 0 });
      }
      return includeDead ? all : all.filter(p => !p.dead);
    }
    function revealNeighbors() {
      let outside = rescue.people.filter(p => p.status === "waiting" || p.status === "riding").length;
      while (outside < 2 && rescue.nextNeighbor < TOTAL && rescue.revealTimer <= 0 &&
          rescue.clock >= RELEASE_AT[rescue.nextNeighbor]) {
        const p = rescue.people[rescue.nextNeighbor++]; p.status = "waiting"; p.invuln = 3;
        outside++; if (rescue.nextNeighbor > 2) { rescue.revealTimer = 1.8; say("ANOTHER NEIGHBOR NEEDS A RIDE!"); }
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
            state.score += 100; say("SAFE!  " + rescue.rescued + " / " + TOTAL + " NEIGHBORS"); push();
          }
        } else if (p.status === "waiting" && p.pickupDelay <= 0) {
          // Stable role ordering makes simultaneous pickups resolve to one carrier.
          const carrier = live.filter(q => !passenger(q.role) && Math.abs(q.x-p.x) < 36 && Math.abs(q.y-p.y) < 31)
            .sort((a,b) => a.role.localeCompare(b.role))[0];
          if (carrier) {
            p.status = "riding"; p.carrier = carrier.role; p.loss = carrier.loss;
            p.x = carrier.x; p.y = carrier.y; p.face = carrier.face;
            say("TAKE YOUR PASSENGER TO THE GLOWING SAFE SPOT!"); push();
          }
        }
      }
      if (rescue.rescued === TOTAL) { finish("won"); return; }
      rescue.revealTimer = Math.max(0, rescue.revealTimer - dt); revealNeighbors();
    }
    function spawnZombie() {
      const number = rescue.spawned++, right = number % 3 === 2;
      state.enemies.push({ id: "rescue-z-" + rescue.run + "-" + number,
        x: right ? W + 46 : -46, y: right ? 480 : 360 + (number % 3) * 60,
        w: 54, h: 34, face: right ? -1 : 1, type: "normal", hp: 1, shootTimer: 999, sep: 1,
        speed: 44 + number % 4 * 4, mode: "walk", timer: 0, cooldown: 0,
        targetX: 0, targetY: 0, targetPerson: -1 });
    }
    function hitPerson(p) {
      if (!p || p.status !== "waiting" || p.invuln > 0) return;
      p.hp--; p.invuln = 3; p.flash = .4;
      if (p.hp <= 0) { finish("failed", "A neighbor was caught. Keep the zombies away and try again!"); return; }
      say("A NEIGHBOR NEEDS HELP!"); push();
    }
    function zombieStrike(z) {
      const strike = { id: rescue.run + "-" + (++rescue.event), x: z.targetX, y: z.targetY, born: rescue.clock };
      rescue.strikes.push(strike);
      const p = rescue.people.find(person => person.id === z.targetPerson);
      if (p && Math.abs(p.x-strike.x) < 46 && Math.abs(p.y-strike.y) < 30) hitPerson(p);
      push();
    }
    function tickZombies(dt) {
      const waiting = rescue.people.filter(p => p.status === "waiting"), live = players();
      for (const z of state.enemies) {
        z.cooldown = Math.max(0, z.cooldown-dt);
        if (z.mode === "windup") {
          z.timer -= dt;
          if (z.timer <= 0) { z.mode = "rest"; z.timer = .6; z.cooldown = 1.8; zombieStrike(z); }
          if (rescue.phase !== "rescue") break;
          continue;
        }
        if (z.mode === "rest") { z.timer -= dt; if (z.timer <= 0) z.mode = "walk"; continue; }
        const targets = waiting.map(p => ({ ...p, civilian: true })).concat(live);
        targets.sort((a,b) => Math.hypot(a.x-z.x,(a.y-z.y)*1.25) - Math.hypot(b.x-z.x,(b.y-z.y)*1.25));
        const target = targets[0]; if (!target) continue;
        const dx = target.x-z.x, dy = target.y-z.y, d = Math.hypot(dx,dy) || 1;
        z.face = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 48 && Math.abs(dy) < 27 && z.cooldown <= 0) {
          z.mode = "windup"; z.timer = .75; z.targetX = target.x; z.targetY = target.y;
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
        const nearest = state.enemies.slice().sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
        if (!nearest || Math.hypot(nearest.x-p.x,nearest.y-p.y) > 100) continue;
        const dx = p.x-nearest.x, dy = p.y-nearest.y, d = Math.hypot(dx,dy) || 1;
        p.x = clamp(p.x + dx/d*18*dt, 85, 684); p.y = clamp(p.y + dy/d*18*dt, 345, 493);
        p.face = dx >= 0 ? 1 : -1; p.walking = true;
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
      const packet = window.__uvzuGetMultiplayerEnemyState?.(), data = packet?.neighborhood;
      if (!data || data.level !== LEVEL || data.session !== session() || packet.updatedAt <= lastPacket) return;
      const reset = data.run !== rescue.run;
      if (reset) {
        window.__uvzuReviveLocalForNextLevel?.(player); old.fullRestart(); localPosition();
        loss = 0; seenStrikes.clear(); removeResult(); noticeTime = 0;
      }
      lastPacket = packet.updatedAt; hasSnapshot = true;
      const before = rescue.rescued; rescue = copy(data);
      rescue.people = list(rescue.people); rescue.zombies = list(rescue.zombies); rescue.strikes = list(rescue.strikes);
      if (!reset && rescue.rescued > before) say("SAFE!  " + rescue.rescued + " / " + TOTAL + " NEIGHBORS");
      state.time = rescue.clock; state.enemies = rescue.zombies;
    }
    function receiveRetry() {
      if (!host()) return false;
      const id = "rescue-retry-" + rescue.run;
      if (!window.__uvzuGetGuestKillRequests?.()?.[id]) return false;
      window.__uvzuClearGuestKillRequest?.(id); initialize(); push(); return true;
    }
    function showResult() {
      if (rescue.phase !== "failed" || document.getElementById("neighborhoodResult")) return;
      const overlay = document.createElement("div"); overlay.id = "neighborhoodResult";
      overlay.style.cssText = "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#13293bb3;padding:24px;font-family:system-ui,sans-serif;text-align:center;color:white";
      const card = document.createElement("div");
      card.style.cssText = "max-width:440px;background:#173b46;border:3px solid #ffe69c;border-radius:18px;padding:28px;box-shadow:0 16px 60px #0008";
      const title = document.createElement("h2"); title.textContent = "RESCUE INTERRUPTED";
      const description = document.createElement("p"); description.textContent = rescue.failure;
      const button = document.createElement("button"); button.id = "neighborhoodRetry";
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
    function continueHunt() {
      if (window.__uvzuCurrentLevelCode !== "HUNT6" || nextSent || guest()) return;
      const hunt = window.__uvzuGetCatcherState?.();
      if (!hunt?.finished || hunt.phase !== "wreck" || hunt.phaseTime < 11) return;
      nextSent = true;
      if (host()) window.__uvzuSignalNextLevel?.(LEVEL);
      else {
        window.__uvzuCurrentLevelCode = LEVEL; window.__uvzuLevelTheme = "neighborhood";
        window.__uvzuUpdateLevelMusic?.(); fullRestart();
      }
    }
    update = function(dt) {
      if (!active()) { old.update(dt); continueHunt(); return; }
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
          if (rescue.clock < SPAWN_SECONDS && rescue.spawnTimer <= 0 && state.enemies.length < (host() ? 5 : 4)) {
            spawnZombie(); rescue.spawnTimer = 4.8;
          }
          rescue.strikes = rescue.strikes.filter(s => rescue.clock-s.born < 1);
        }
      } else {
        // The full snapshot keeps windup telegraphs that the base enemy packet omits.
        state.enemies = rescue.zombies;
        if (rescue.phase === "rescue") rescue.clock += dt;
      }
      updateThankYou(); localHazards(); showResult(); updateHud();
    };
    updateHud = function() {
      old.updateHud(); if (!active()) return;
      if (timeEl) timeEl.textContent = rescue.phase === "won" ? "Everyone safe!" : rescue.phase === "failed" ? "Try again" :
        rescue.clock < SPAWN_SECONDS ? "Time: " + Math.ceil(SPAWN_SECONDS-rescue.clock) + "s" : "Finish the rescue!";
      if (scoreEl) scoreEl.textContent = "Safe: " + rescue.rescued + " / " + TOTAL;
    };

    // Canvas scenery and human sprites match the shaded style of the later levels.
    const box = (x,y,w,h,color) => { ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
    function oval(x,y,rx,ry,color) { ctx.fillStyle=color; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill(); }
    function poly(points,color) { ctx.fillStyle=color; ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill(); }
    function line(x,y,x2,y2,color,width=2) { ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke(); }
    function text(value,x,y,size=18,color="#fff8e4",align="center") {
      ctx.textAlign=align;ctx.font="900 "+size+"px system-ui,sans-serif";ctx.lineJoin="round";
      ctx.strokeStyle="#24494c";ctx.lineWidth=4;ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);
    }
    function tree(x,y,s=1) {
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);
      oval(0,0,38,9,"#549552");box(-6,-74,13,77,"#8a6247");box(1,-73,6,77,"#644e40");
      poly([[-3,-32],[-26,-62],[-21,-66],[5,-38]],"#7c5b40");
      oval(-22,-75,31,32,"#398457");oval(22,-79,35,37,"#388b58");oval(-2,-101,39,37,"#4eab62");
      oval(-15,-109,27,24,"#70bf69");oval(23,-94,24,26,"#65b862");oval(-29,-78,15,13,"#7bc76e");
      box(-17,-111,7,5,"#a0d37d");box(21,-94,5,5,"#a0d37d");ctx.restore();
    }
    function flower(x,y,c) { box(x,y,2,9,"#3b8859");box(x-3,y-2,8,5,c);box(x-1,y-4,4,9,c);box(x,y-1,2,3,"#ffec92"); }
    function windowBox(x,y,w=30,h=33) {
      box(x-4,y-4,w+8,h+8,"#e4eee2");box(x,y,w,h,"#477586");box(x+3,y+3,w-6,h-6,"#a9dce2");
      poly([[x+3,y+3],[x+w-3,y+3],[x+3,y+h-3]],"#d2f0ea");box(x+w/2-2,y,4,h,"#f6f4dc");box(x,y+h/2-2,w,4,"#f6f4dc");
      box(x-6,y+h+2,w+12,6,"#f5edd7");box(x-3,y+h+8,w+6,8,"#d37c62");
      for(let i=0;i<4;i++)flower(x+2+i*8,y+h+7,i%2?"#f1a9c3":"#ffc767");
    }
    function house(x,y,w,wall,roof,door) {
      box(x+9,y+100,w+12,14,"#699b63");box(x,y,w,112,wall);box(x+w-19,y,19,112,"#00000018");
      for(let k=0;k<7;k++)box(x,y+15+k*13,w,1,"#ffffff32");
      box(x+20,y-59,21,35,"#b3826d");box(x+18,y-61,25,7,"#e2bf9a");
      poly([[x-15,y+4],[x+w/2,y-69],[x+w+15,y+4]],"#384d5e");
      poly([[x-13,y-3],[x+w/2,y-77],[x+w+13,y-3]],roof);
      for(let i=0;i<4;i++)line(x+6+i*15,y-14-i*15,x+w-6-i*15,y-14-i*15,"#ffffff25",3);
      box(x-10,y-2,w+20,8,"#fff5d9");
      windowBox(x+17,y+27);windowBox(x+w-51,y+27);
      box(x+w/2-20,y+39,40,73,"#f6e9cb");box(x+w/2-15,y+45,30,65,door);
      box(x+w/2-10,y+51,20,20,"#b6dedb");box(x+w/2+8,y+83,3,3,"#ffe084");
      box(x+w/2-27,y+107,54,7,"#bbafa0");box(x+w/2-32,y+114,64,6,"#e2d9bc");
      poly([[x+w/2-32,y+120],[x+w/2+32,y+120],[x+w/2+43,334],[x+w/2-43,334]],"#e0d4b8");
    }
    function scenery() {
      const sky=ctx.createLinearGradient(0,0,0,315);sky.addColorStop(0,"#65c7eb");sky.addColorStop(1,"#e2f5d9");
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      oval(77,71,49,49,"#ffe79c66");oval(77,71,32,32,"#fff3a3");
      for(const [x,y,s] of [[255,66,1],[527,42,.75],[809,80,.9]]) {
        oval(x,y,42*s,15*s,"#e9fbf5");oval(x-20*s,y-7*s,23*s,18*s,"#f6fff4");oval(x+7*s,y-13*s,29*s,23*s,"#f6fff4");
      }
      poly([[0,196],[72,156],[188,186],[309,143],[421,182],[560,151],[712,177],[842,144],[960,182],[960,307],[0,307]],"#83bf86");
      for(let i=0;i<16;i++)oval(i*67,213+(i%3)*9,40,44,"#73b47a");
      box(0,268,W,83,"#91c66b");box(0,308,W,31,"#9ecd73");
      house(85,197,167,"#f2be79","#ce7566","#60979b");
      house(351,189,185,"#accbc6","#6b86a6","#bf786f");
      house(688,184,193,"#e4b4c7","#9583b0","#597c92");
      tree(27,316,.93);tree(300,304,.84);tree(599,304,1.02);tree(922,291,.95);
      for(let i=0;i<33;i++){const x=(i*83+29)%960,y=310+(i%3)*9;if(x>705&&x<890)continue;flower(x,y,["#ed8fbd","#ffe89b","#a490d1"][i%3]);}
      box(0,336,W,19,"#e9dec4");box(0,350,W,8,"#bfb9a4");box(0,358,W,161,"#87959b");
      box(0,358,W,5,"#677d88");box(0,364,W,4,"#9eaba9");
      for(let x=0;x<W;x+=64)line(x,337,x+3,350,"#c7bfaa",1);
      for(let x=17;x<W;x+=119)box(x,439,60,5,"#e9e2b5");
      for(let i=0;i<29;i++)box((i*97)%W,377+(i*19)%128,3,1,"#c2cbb934");
      box(0,519,W,7,"#d2ccb4");box(0,526,W,14,"#7dbb66");
      for(let i=0;i<17;i++)box(i*63+14,530,14,3,"#a6d776");
      // Mailboxes, a hydrant, and planted front gardens give the street depth.
      for(const [x,c] of [[276,"#6c97af"],[647,"#cc7372"]]) {
        box(x,305,6,35,"#957457");box(x-8,295,29,17,c);box(x-8,308,29,4,"#4b6577");box(x+14,287,3,16,"#f5e6b6");box(x+14,287,10,6,"#d86c66");
      }
      oval(53,354,15,4,"#6a807b55");box(46,332,15,23,"#c67b54");box(44,329,19,7,"#edaa6e");
      box(48,324,11,6,"#f3bc82");box(39,339,7,8,"#df995f");box(60,339,7,8,"#df995f");
      box(699,268,248,62,"#8bbe74");box(706,274,234,49,"#a2ce81");
      for(let i=0;i<10;i++)box(713+i*23,302+(i%3)*7,8,2,"#c5df9b");
    }
    function fence() {
      const age=rescue.phaseTime;
      const opening=rescue.phase==="won"?Math.min(clamp((age-.55)/.5,0,1),1-clamp((age-2.2)/.6,0,1)):0;
      box(698,296,119,7,"#e8dcb7");box(698,316,119,7,"#e8dcb7");
      box(877,296,68,7,"#e8dcb7");box(877,316,68,7,"#e8dcb7");
      for(let x=699;x<947;x+=18) {
        if(x>=817&&x<877)continue;
        poly([[x,284],[x+6,277],[x+12,284],[x+12,334],[x,334]],"#fff5d5");box(x+9,285,3,49,"#ccbda2");box(x+3,297,2,2,"#ad9c85");
      }
      // The gate swings inward while the lady steps into the street.
      ctx.save();ctx.translate(877,0);ctx.transform(1-opening*.84,-opening*.25,0,1,0,0);
      box(-60,296,60,7,"#e8dcb7");box(-60,316,60,7,"#e8dcb7");
      for(let x=-60;x<0;x+=18) {
        poly([[x,284],[x+6,277],[x+12,284],[x+12,334],[x,334]],"#fff5d5");box(x+9,285,3,49,"#ccbda2");
      }
      box(-63,297,65,24,"#356857");box(-59,300,57,18,"#477f61");
      text("SAFE",-30,314,12,"#fff3c6");ctx.restore();
    }
    const outfits = [
      ["#bf815a","#865437","#efb25e","#b77c45","#493430"],
      ["#ebba94","#bc8666","#9083c1","#655f99","#67472d"],
      ["#855840","#5f3e32","#e47e85","#ae5469","#302c31"],
      ["#e4ad81","#b57b5a","#6498b5","#3d6f91","#8c573a"],
      ["#b27757","#804f3f","#b1ca79","#748f57","#3a3034"],
      ["#f0c99c","#c19670","#e6a179","#b67061","#cfbe9b"],
      ["#92634a","#664234","#74bab1","#4c8989","#372b2d"],
      ["#e1ae88","#b57d60","#d18bab","#9b5b8c","#594838"]
    ];
    function human(p,x,y,pose="waiting",face=1,lean=0) {
      const [skin,shade,shirt,dark,hair]=outfits[p.id%outfits.length];
      const child=p.id===4, s=child ? .67 : .82, riding=pose==="riding", cheering=pose==="cheer";
      const stride=p.walking?Math.sin(gameClock*11+p.id)*4:0;
      const wave=cheering?Math.sin(gameClock*8+p.id)*4:0;
      ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(s,s);
      if(p.flash>0&&Math.floor(gameClock*16)%2===0)ctx.globalAlpha=.5;
      if(!riding)oval(0,2,15,4,"#1e454233");
      if(!riding) {
        box(-9-stride*.35,-23,7,23,"#425260");box(3+stride*.35,-23,7,23,"#2e3e50");
        box(-11-stride*.35,-3,12,5,"#293747");box(2+stride*.35,-3,12,5,"#24323e");
      } else {
        box(-10,-22,22,8,"#344452");box(face>0?5:-11,-18,7,14,"#425466");
        box(face>0?5:-15,-6,11,5,"#273344");
      }
      ctx.save();ctx.translate(0,-22);ctx.rotate(face*.38*lean);ctx.translate(0,22);
      if(p.id%3===1)box(-12,-59,26,31,hair);
      box(-11,-43,23,22,shirt);box(7,-41,5,20,dark);box(-8,-40,4,18,"#fff7d629");box(-11,-23,23,3,dark);
      const hand=cheering?-60+wave:riding?-28:-25;
      box(-16,cheering?-55+wave:-40,6,cheering?17:14,dark);box(12,cheering?-55-wave:-40,6,cheering?17:14,shirt);
      box(-16,hand,6,7,shade);box(12,cheering?-60-wave:hand,6,7,skin);
      box(-4,-47,9,7,shade);box(-9,-62,19,18,skin);box(7,-59,4,14,shade);
      box(-11,-55,3,6,shade);box(10,-55,3,6,skin);
      box(-10,-65,21,6,hair);box(-10,-60,4,8,hair);box(-7,-64,13,2,"#fff4d026");
      if(p.id%3===1)box(9,-61,5,23,hair);
      box(-6,-55,3,2,"#393038");box(3,-55,3,2,"#393038");box(face>0?4:-6,-51,2,3,shade);
      if(lean>.5) { box(-7,-54,6,2,"#634341");box(-11,-48,5,3,"#c57583"); }
      else { box(-3,-48,7,2,"#794b45");if(cheering)box(-2,-48,5,1,"#fff1ce"); }
      ctx.restore();ctx.restore();
    }
    function drawLady(pose) {
      if (!pose) return;
      const person = { ...pose.person, walking: pose.walking };
      human(person,pose.x,pose.y,pose.lean>0?"kiss":rescue.phaseTime>=8.8?"cheer":"waiting",-1,pose.lean);
    }
    function drawThankYou() {
      const lady=ladyPose();if(!lady)return;
      if(lady.speaking) {
        const x=554,y=230,w=343,h=84;
        box(x+3,y+4,w,h,"#173b4655");box(x,y,w,h,"#fff4d9");
        poly([[lady.x-18,y+h-1],[lady.x+8,y+h-1],[lady.x-2,lady.y-64]],"#fff4d9");
        text("thank you!",x+w/2,y+32,21,"#fff2ad");
        text("You're the sweetest,",x+w/2,y+61,21,"#fff2ad");
      }
      const heart=heartPose();if(!heart)return;
      ctx.save();ctx.globalAlpha=heart.alpha;ctx.translate(heart.x,heart.y);ctx.scale(heart.scale,heart.scale);
      poly([[-13,-3],[-13,-10],[-8,-14],[-3,-14],[0,-10],[3,-14],[8,-14],[13,-10],[13,-3],[9,2],[0,11],[-9,2]],"#9e3f66");
      poly([[-11,-3],[-11,-9],[-7,-12],[-4,-12],[0,-7],[4,-12],[7,-12],[11,-9],[11,-3],[7,2],[0,8],[-7,2]],"#ff729c");
      box(-8,-9,4,3,"#ffe8ef");ctx.restore();
    }
    function drawBackgroundHere() {
      // Stationary scenery: only people, attack warnings, and the rescue marker animate.
      if (!sceneryCanvas) {
        const layer=document.createElement("canvas");layer.width=W;layer.height=H;
        if(layer.getContext) { const snapshot=ctx.getImageData(0,0,W,H);scenery();layer.getContext("2d").drawImage(ctx.canvas,0,0);ctx.putImageData(snapshot,0,0);sceneryCanvas=layer; }
      }
      if(sceneryCanvas)ctx.drawImage(sceneryCanvas,0,0);else scenery();
      const lady=ladyPose();
      for(const p of rescue.people.filter(p=>p.status==="safe" && (!lady || p.id!==lady.person.id))) {
        const index=p.safeOrder, x=718+(index%6)*40, y=297-Math.floor(index/6)*29;
        human(p,x,y-Math.max(0,Math.sin(gameClock*5+p.id))*3,"cheer");
      }
      if(lady?.behindFence)drawLady(lady);
      fence();
      if(rescue.phase==="won")return;
      const pulse=.55+.12*Math.sin(gameClock*4);
      ctx.fillStyle="rgba(202,249,133,"+pulse+")";ctx.fillRect(safeZone.x,safeZone.y,safeZone.w,safeZone.h);
      ctx.strokeStyle="#f7ffd1";ctx.lineWidth=3;ctx.setLineDash([9,6]);ctx.strokeRect(safeZone.x+2,safeZone.y+2,safeZone.w-4,safeZone.h-4);ctx.setLineDash([]);
      text("DROP OFF HERE",safeZone.x+safeZone.w/2,safeZone.y+safeZone.h-12,14,"#fffbd0");
      poly([[815,342],[829,342],[829,350],[837,350],[822,362],[807,350],[815,350]],"#f7ffd1");
    }
    drawBackground = function() { if(active())drawBackgroundHere();else old.drawBackground(); };
    function drawPlayer(p,who) {
      if(p.dead||p.ghost||p.lives<=0)return;
      const carrying=passenger(who), scale=p.giant>0?1.28:1;
      if(who===role()) { drawShieldAura();drawDodgeEffect(); }
      drawUnicorn(p.x,p.y,p.face||1,false,p.ray>0,p.giant>0);
      if(carrying)human(carrying,p.x-8*(p.face||1)*scale,p.y-14*scale,"riding",p.face||1);
      if(host()||guest())text(who==="host"?"P1":"P2",p.x,p.y-(carrying?85:66),12,who==="host"?"#ffec9f":"#c2f5fa");
    }
    draw = function() {
      if(!active())return old.draw();
      ctx.save();drawBackgroundHere();
      const actors=[];
      for(const p of rescue.people)if(p.status==="waiting")actors.push({ y:p.y, draw:()=>{
        human(p,p.x,p.y,"waiting",p.face);
        const marker=p.id===4?55:68;
        for(let i=0;i<3;i++)box(p.x-13+i*9,p.y-marker,7,4,i<p.hp?"#ffe199":"#925f69");
        text("HELP!",p.x,p.y-marker-7,12,"#fff2b7");
      }});
      for(const z of state.enemies)actors.push({y:z.y,draw:()=>{
        drawUnicorn(z.x,z.y,z.face,true,false,false);
        if(z.mode==="windup")text("!",z.x,z.y-67,23,"#ffd382");
      }});
      const lady=ladyPose(), cast=rescue.phase==="won"&&rescue.ending?endingPlayers():players();
      for(const p of cast)actors.push({y:p.y,draw:()=>drawPlayer(p,p.role)});
      if(lady&&!lady.behindFence)actors.push({y:lady.y+.1,draw:()=>drawLady(lady)});
      for(const z of state.enemies)if(z.mode==="windup") {
        oval(z.targetX,z.targetY+3,39,17,"#dc635940");ctx.strokeStyle="#ffd690";ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(z.targetX,z.targetY+3,39,17,0,0,Math.PI*2);ctx.stroke();
      }
      actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());drawShots();drawParticles();drawThankYou();
      ctx.restore();drawHealthBar();
      box(299,17,362,64,"#214c5ddd");box(299,17,362,3,"#ffe6a0");
      text("NEIGHBORHOOD RESCUE",480,44,20);text(rescue.rescued+" / "+TOTAL+" NEIGHBORS SAFE",480,67,14,"#d8f0c0");
      if(rescue.phase==="won") {
        box(222,99,516,82,"#214c5de8");text("EVERYONE IS SAFE!",480,133,28,"#ffeaa7");
        text("YOU BROUGHT THE NEIGHBORHOOD HOME.",480,161,15,"#e0f2cf");
      } else if(rescue.phase==="rescue") {
        const message=noticeTime>0?notice:passenger(role())?"CARRY YOUR NEIGHBOR TO THE GLOWING SAFE SPOT":
          rescue.clock<8?"WALK UP TO A NEIGHBOR TO GIVE THEM A RIDE":
          !rescue.people.some(p=>p.status==="waiting")?"MORE NEIGHBORS ARE COMING — KEEP THE STREET CLEAR":
          "PROTECT THE NEIGHBORS. BRING EVERYONE TO THE FENCE.";
        box(172,94,616,30,"#214c5dbd");text(message,480,115,13,"#fff0b5");
        if(rescue.clock<8)text("A: HEADBUTT / DODGE    •    PICKUP & DROP-OFF ARE AUTOMATIC",480,145,12,"#fff8dc");
      }
    };
  }

  window.__uvzuInstallNeighborhood = function(code) {
    function once(before,after) {
      if(code.split(before).length!==2)throw new Error("Neighborhood hook missing: "+before.slice(0,80));
      code=code.replace(before,()=>after);
    }
    const movement='(["HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))';
    if(code.split(movement).length!==6)throw new Error("Neighborhood movement hooks missing");
    code=code.split(movement).join('(["RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))');
    const ending='!["HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)';
    if(code.split(ending).length!==3)throw new Error("Neighborhood ending hooks missing");
    code=code.split(ending).join('!["RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)');
    once('window.__uvzuLevelTheme = nextCode === "HUNT6" ? "catchers" :',
      'window.__uvzuLevelTheme = nextCode === "RSCU7" ? "neighborhood" : nextCode === "HUNT6" ? "catchers" :');
    once('  requestAnimationFrame(loop);\n})();', '('+neighborhoodRuntime.toString()+')();\n  requestAnimationFrame(loop);\n})();');
    return code;
  };
})();
