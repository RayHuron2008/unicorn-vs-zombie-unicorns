// Volcanic Badlands, level 8. Load before game.js. Level code: LAVA8.
// B breathes fire for five seconds after you defeat a fire-breathing zombie.
(() => {
  function volcanoRuntime() {
    const LEVEL = "LAVA8", DURATION = 60, FIRE_SECONDS = 5, GOLEM_HITS = 4;
    const CRATER = { x: 632, y: 141 };
    const DIFFICULTY = {
      Easy:   { speed: 84, cap: 5, spawn: 2.05, eruption: 5.5, flight: 2.5, golem: 94, smash: .9 },
      Normal: { speed: 96, cap: 6, spawn: 1.8, eruption: 4.8, flight: 2.3, golem: 104, smash: .8 },
      Hard:   { speed: 108, cap: 7, spawn: 1.55, eruption: 4.1, flight: 2.15, golem: 114, smash: .72 }
    };
    const active = () => window.__uvzuCurrentLevelCode === LEVEL;
    const host = () => !!window.__uvzuIsMultiplayerHost?.();
    const guest = () => !!window.__uvzuIsMultiplayerGuest?.();
    const role = () => guest() ? "guest" : "host";
    const ghost = () => player.lives <= 0 || !!window.__uvzuIsLocalGhost?.();
    const tune = () => DIFFICULTY[window.__uvzuCurrentDifficultyName] || DIFFICULTY.Easy;
    const copy = value => JSON.parse(JSON.stringify(value));
    const list = value => Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {});
    const old = { fullRestart, safeLifeReset, update, spawnEnemy, startFinalWave, updateEnemies,
      updateEnding, killEnemy, playerShoot, updateShots, loseLife, draw, drawBackground, updateHud, startMusic };
    const session = () => {
      const room = window.__uvzuTombTravelNetwork?.room?.() || {};
      return [room.createdAt || 0, room.nextLevelAt || 0, room.ghostResetAt || 0].join(":");
    };
    let serial = 0, localLoss = 0, lastPacket = 0, nextSent = false, hasSnapshot = false;
    let breathFlash = 0, fireBlocked = false, notice = "", noticeTime = 0, sceneryCanvas = null;
    let attacks = [], pending = new Map();
    const seenHazards = new Set(), seenRewards = new Set();
    const fresh = () => ({ level: LEVEL, session: session(), run: Date.now()+"-"+(++serial),
      phase: "battle", phaseTime: 0, clock: 0, spawnTimer: .8, meteorTimer: 3.8,
      spawned: 0, defeated: 0, event: 0, eruption: 0, zombies: [], meteors: [], burning: [],
      strikes: [], kills: [], fireUntil: { host: 0, guest: 0 }, losses: { host: 0, guest: 0 },
      boss: null, finished: false });
    let volcano = fresh();
    const fighting = () => volcano.phase === "battle" || volcano.phase === "boss";
    const fireTime = () => fireBlocked || ghost() ? 0 : Math.max(0,(volcano.fireUntil[role()]||0)-volcano.clock);
    window.__uvzuGetVolcanoState = () => active() ? { ...volcano, zombies: state.enemies } : null;
    window.__uvzuGetVolcanoStatus = () => active() ? { level: LEVEL, run: volcano.run, loss: localLoss,
      fire: fireTime(), breathing: breathFlash > 0 && fireTime() > 0, attacks } : null;
    const push = () => { if (host()) window.__uvzuMultiplayerPushEnemyState?.(state.enemies,true); };
    const say = (message, seconds = 2) => { notice=message;noticeTime=seconds; };
    function resetCoopLives() {
      if(host()||guest())player.lives=window.__uvzuTesterLifeBudget?.(5)??5;
    }
    function localReset() {
      breathFlash=0;fireBlocked=true;attacks=[];pending.clear();
      player.webbedTimer=player.webFlash=0;player.webTrapX=player.webTrapY=null;
      resetPlayerPosition();player.x=guest()?330:230;player.y=460;
    }
    function initialize() {
      window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();resetCoopLives();volcano=fresh();
      state.enemies=volcano.zombies;state.mode="play";localLoss=0;lastPacket=0;hasSnapshot=false;
      nextSent=false;seenHazards.clear();seenRewards.clear();noticeTime=0;localReset();
      window.__uvzuLevelTheme="volcano";window.__uvzuStopMainMusic?.();window.stopTombMusic?.();
      updateHud();
    }
    fullRestart = function() {
      if (!active()) { nextSent=false;return old.fullRestart(); }
      if (guest() && hasSnapshot && volcano.session===session()) {
        window.__uvzuRequestEnemyKill?.("lava-retry-"+volcano.run);return;
      }
      initialize();push();
    };
    safeLifeReset = function() {
      if (!active()) return old.safeLifeReset();
      state.resetQueued=false;state.playerShots.length=state.enemyShots.length=0;localReset();
      const positions=[{x:150,y:365},{x:480,y:490},{x:820,y:365}];
      const danger=p=>Math.min(...volcano.meteors.filter(m=>!m.hit).map(m=>Math.hypot(m.x-p.x,m.y-p.y)),
        ...state.enemies.map(z=>Math.hypot(z.x-p.x,z.y-p.y)),volcano.boss?Math.hypot(volcano.boss.x-p.x,volcano.boss.y-p.y):999);
      const safe=positions.sort((a,b)=>danger(b)-danger(a))[0];player.x=safe.x;player.y=safe.y;
      state.mode=fighting()?(volcano.phase==="boss"?"final":"play"):"volcanoScene";
    };
    loseLife = function() {
      if (!active()) return old.loseLife();
      const before=player.lives;old.loseLife();
      if (player.lives<before) {
        localLoss++;fireBlocked=true;breathFlash=0;attacks=[];pending.clear();
        if (!guest()) { volcano.fireUntil[role()]=0;volcano.losses[role()]=localLoss; }
        if (!host()&&!guest()&&player.lives<=0) volcano.phase="lost";
        window.__uvzuMultiplayerPush?.(player);push();
      }
    };
    spawnEnemy = function(...args) { if (!active()) return old.spawnEnemy(...args); };
    updateEnding = function(dt) { if (!active()) return old.updateEnding(dt); };
    startMusic = function() { if(active())window.__uvzuStopMainMusic?.();else old.startMusic(); };
    const previousMusic=window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic=function(){previousMusic?.();if(active()){window.__uvzuStopMainMusic?.();window.stopTombMusic?.();}};
    function allPlayers(includeDead=false) {
      const people=[{...player,role:role(),dead:ghost(),volcanoStatus:window.__uvzuGetVolcanoStatus()}];
      const p=window.__uvzuGetRemotePlayer?.();
      if((host()||guest())&&p?.volcanoStatus?.run===volcano.run&&Number.isFinite(p.x)&&Number.isFinite(p.y)) {
        people.push({...p,role:guest()?"host":"guest",dead:!!p.dead||!!p.ghost||p.lives<=0});
      }
      return includeDead?people:people.filter(p=>!p.dead);
    }
    function nearest(x,y) { return allPlayers().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]; }
    function inFlame(source,target,range=190) {
      const face=source.face||1,along=(target.x-source.x)*face;
      return along>=21&&along<=range&&Math.abs(target.y-source.y)<=21+along*.11;
    }
    function applyRewards() {
      for(const reward of volcano.kills) {
        if(seenRewards.has(reward.id))continue;seenRewards.add(reward.id);
        pending.delete(reward.id);attacks=attacks.filter(a=>a.enemy!==reward.id);
        if(reward.who!==role())continue;
        state.score+=reward.type==="fire"?35:10;
        if(reward.method==="headbutt"){player.headbuttStreak++;awardShieldIfReady();}else player.headbuttStreak=0;
        if(player.ray<=0&&player.giant<=0&&++player.killsForGiant>=20){player.killsForGiant=0;player.giant=GIANT_TIME;player.lives+=1;}
        if(reward.type==="fire"&&!ghost()) { fireBlocked=false;say("FIRE BREATH! HOLD B — 5 SECONDS",2.2); }
      }
    }
    function defeat(index,method,who) {
      if(index<0||index>=state.enemies.length||volcano.phase!=="battle")return;
      const z=state.enemies.splice(index,1)[0];volcano.defeated++;
      volcano.kills.push({id:z.id,who,method,type:z.type,at:volcano.clock});
      if(method==="fire") {
        const attacker=allPlayers().find(p=>p.role===who);
        const face=attacker?(z.x>=attacker.x?1:-1):(z.x<W/2?-1:1);
        volcano.burning.push({id:z.id,x:z.x,y:z.y,face,born:volcano.clock,vx:face*255});
      } else addParticles(z.x,z.y-20,z.type==="fire"?"rainbow":"red");
      if(z.type==="fire"&&(who==="host"||who==="guest"))volcano.fireUntil[who]=volcano.clock+FIRE_SECONDS;
      applyRewards();push();
    }
    killEnemy=function(index,method="other") {
      if(!active())return old.killEnemy(index,method);
      const z=state.enemies[index];if(!z||volcano.phase!=="battle")return;
      if(guest()) {
        if(method==="remote"||pending.has(z.id))return;
        attacks.push({enemy:z.id,method,x:player.x,y:player.y,face:player.face,at:volcano.clock});
        pending.set(z.id,volcano.clock);state.enemies.splice(index,1);window.__uvzuMultiplayerPush?.(player);
      } else defeat(index,method,role());
    };
    function receiveAttacks() {
      if(!host())return;
      const remote=allPlayers(true).find(p=>p.role==="guest");if(!remote)return;
      const status=remote.volcanoStatus;
      if(status.loss!==volcano.losses.guest){volcano.losses.guest=status.loss;volcano.fireUntil.guest=0;}
      if(remote.dead)return;
      for(const a of list(status.attacks)) {
        if(!["headbutt","ray","fire"].includes(a.method)||!Number.isFinite(a.x)||!Number.isFinite(a.y)||volcano.clock-a.at>1.6)continue;
        const i=state.enemies.findIndex(z=>z.id===a.enemy);if(i<0)continue;
        const z=state.enemies[i];
        if(a.method==="fire"&&((volcano.fireUntil.guest||0)<a.at||!inFlame(a,z,225)))continue;
        if(a.method==="headbutt"&&(Math.abs(z.x-a.x)>135||Math.abs(z.y-a.y)>65))continue;
        if(Math.hypot(remote.x-a.x,remote.y-a.y)>260)continue;
        defeat(i,a.method,"guest");
      }
    }
    playerShoot=function() {
      if(!active()||fireTime()<=0)return old.playerShoot();
      if(!fighting()||ghost())return;
      breathFlash=.23;
      for(let i=state.enemies.length-1;i>=0;i--)if(inFlame(player,state.enemies[i]))killEnemy(i,"fire");
      window.__uvzuMultiplayerPush?.(player);
    };
    function spawnZombie() {
      const number=volcano.spawned++,right=number%2===1;
      const fire=number%4===1&&!state.enemies.some(z=>z.type==="fire");
      state.enemies.push({id:"lava-z-"+volcano.run+"-"+number,x:right?W+48:-48,y:[401,477,354,454][number%4],
        w:54,h:34,hp:1,type:fire?"fire":"normal",face:right?-1:1,shootTimer:999,sep:1,
        speed:tune().speed+(number%3)*6,mode:"walk",timer:0,cooldown:fire?1.6:0,flameId:""});
    }
    function tickEnemies(dt) {
      for(const z of state.enemies) {
        z.cooldown=Math.max(0,z.cooldown-dt);
        if(z.mode==="inhale") {
          z.timer-=dt;if(z.timer<=0){z.mode="breath";z.timer=.95;z.flameId=volcano.run+"-flame-"+(++volcano.event);}continue;
        }
        if(z.mode==="breath") { z.timer-=dt;if(z.timer<=0){z.mode="rest";z.timer=.75;z.cooldown=2.6;}continue; }
        if(z.mode==="rest") { z.timer-=dt;if(z.timer<=0)z.mode="walk";continue; }
        const target=nearest(z.x,z.y);if(!target)continue;
        const dx=target.x-z.x,dy=target.y-z.y,d=Math.hypot(dx,dy)||1;z.face=dx>=0?1:-1;
        if(z.type==="fire"&&z.cooldown<=0&&inFlame(z,target,210)) {
          const blocked=state.enemies.some(o=>o!==z&&(o.x-z.x)*z.face>0&&(o.x-z.x)*z.face<(target.x-z.x)*z.face&&Math.abs(o.y-z.y)<34);
          if(!blocked){z.mode="inhale";z.timer=.75;continue;}
        }
        if(d>22){z.x+=dx/d*z.speed*dt;z.y+=dy/d*z.speed*dt*.7;}
        for(const other of state.enemies){if(other===z)continue;const sx=z.x-other.x,sy=z.y-other.y,gap=Math.hypot(sx,sy);
          if(gap>0&&gap<44){z.x+=sx/gap*17*dt;z.y+=sy/gap*17*dt;}}
        z.y=clamp(z.y,337,509);
      }
    }
    updateEnemies=function(dt){if(!active())return old.updateEnemies(dt);if(!guest()&&volcano.phase==="battle")tickEnemies(dt);};
    function launchMeteor() {
      const boss=volcano.phase==="boss",g=volcano.boss;
      const target=boss?nearest(g.x,g.y):allPlayers()[volcano.eruption%Math.max(1,allPlayers().length)];
      const aimed=boss||volcano.eruption%2===0;
      const x=clamp(target&&aimed?target.x+(boss?0:rand(-95,95)):rand(90,870),65,895);
      const y=clamp(target&&aimed?target.y+(boss?0:rand(-40,40)):rand(352,494),344,502);
      const m={id:volcano.run+"-meteor-"+(++volcano.eruption),x,y,born:volcano.clock,flight:tune().flight,hit:false,bossHit:false};
      volcano.meteors.push(m);push();return m;
    }
    const meteorAge=m=>volcano.clock-m.born;
    function impactMeteor(m) {
      if(m.hit)return;m.hit=true;
      for(let i=state.enemies.length-1;i>=0;i--){const z=state.enemies[i];if(Math.abs(z.x-m.x)<49&&Math.abs(z.y-m.y)<32)defeat(i,"meteor","volcano");}
      const b=volcano.boss;
      if(volcano.phase==="boss"&&b&&b.hits<GOLEM_HITS&&Math.abs(b.x-m.x)<82&&Math.abs(b.y-m.y)<53) {
        m.bossHit=true;b.hits++;b.flash=.7;b.mode="stagger";b.timer=1.2;
        say("VOLCANO HIT!  "+b.hits+" / "+GOLEM_HITS,1.7);
        if(b.hits===GOLEM_HITS){volcano.phase="collapse";volcano.phaseTime=0;b.mode="collapse";volcano.strikes=[];state.mode="volcanoScene";}
      }
      push();
    }
    startFinalWave=function(){
      if(!active())return old.startFinalWave();if(volcano.phase!=="battle")return;
      volcano.phase="arrival";volcano.phaseTime=0;volcano.meteors=[];volcano.strikes=[];
      state.enemies.length=state.enemyShots.length=state.playerShots.length=0;
      state.mode="volcanoScene";state.finalSpawned=0;
      volcano.boss={x:W+120,y:447,hits:0,mode:"arrival",timer:2.6,face:-1,flash:0,
        targetX:700,targetY:440,side:-1};
      push();
    };
    function tickBoss(dt) {
      const b=volcano.boss;if(!b)return;b.flash=Math.max(0,b.flash-dt);
      if(volcano.phase==="arrival") {
        b.x=lerp(W+120,735,clamp(volcano.phaseTime/2.6,0,1));
        if(volcano.phaseTime>=2.6){volcano.phase="boss";volcano.phaseTime=0;b.mode="walk";volcano.meteorTimer=.9;state.mode="final";push();}
        return;
      }
      if(volcano.phase!=="boss")return;
      if(b.mode==="windup") {
        b.timer-=dt;
        if(b.timer<=0){b.mode="smash";b.timer=1.1;volcano.strikes.push({id:volcano.run+"-fist-"+(++volcano.event),x:b.targetX,y:b.targetY,born:volcano.clock});push();}
        return;
      }
      if(b.mode==="smash"||b.mode==="stagger") { b.timer-=dt;if(b.timer<=0)b.mode="walk";return; }
      const target=nearest(b.x,b.y);if(!target)return;
      const dx=target.x-b.x,dy=target.y-b.y,d=Math.hypot(dx,dy)||1;b.face=dx>=0?1:-1;
      if(Math.abs(dx)<120&&Math.abs(dy)<62){b.mode="windup";b.timer=tune().smash;b.targetX=target.x;b.targetY=target.y;b.side=b.face;push();}
      else { b.x+=dx/d*tune().golem*dt;b.y+=dy/d*tune().golem*dt*.8;b.x=clamp(b.x,70,W-70);b.y=clamp(b.y,354,490); }
    }
    function localHazards() {
      if(!fighting()||ghost()||state.resetQueued)return;
      for(const m of volcano.meteors) {
        const age=meteorAge(m)-m.flight;
        if(age<0||age>.65||seenHazards.has(m.id))continue;
        seenHazards.add(m.id);
        if(Math.abs(player.x-m.x)<46&&Math.abs(player.y-m.y)<30&&player.invuln<=0&&player.dodgeTimer<=0){loseLife();return;}
      }
      for(const s of volcano.strikes) {
        if(volcano.clock-s.born>.55||seenHazards.has(s.id))continue;seenHazards.add(s.id);
        if(Math.abs(player.x-s.x)<61&&Math.abs(player.y-s.y)<38&&player.invuln<=0&&player.dodgeTimer<=0){if(!shieldBlockContact())loseLife();return;}
      }
      for(let i=state.enemies.length-1;i>=0;i--) {
        const z=state.enemies[i];
        if(z.mode==="breath"&&z.flameId&&!seenHazards.has(z.flameId)&&inFlame(z,player,190)) {
          seenHazards.add(z.flameId);if(player.dodgeTimer<=0)damagePlayerByLaser();if(state.resetQueued||ghost())return;
        }
        if(player.invuln>0||player.dodgeTimer>0)continue;
        if(Math.abs(player.x-z.x)<45&&Math.abs(player.y-z.y)<29) {
          if(player.headTimer>0&&(z.x-player.x)*player.face>=0)killEnemy(i,"headbutt");
          else if(!shieldBlockContact()){loseLife();return;}
        }
      }
    }
    function receiveState() {
      if(!guest())return;const packet=window.__uvzuGetMultiplayerEnemyState?.(),data=packet?.volcano;
      if(!data||data.level!==LEVEL||data.session!==session()||packet.updatedAt<=lastPacket)return;
      const reset=data.run!==volcano.run;
      if(reset){window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();resetCoopLives();localReset();localLoss=0;seenHazards.clear();seenRewards.clear();noticeTime=0;}
      volcano=copy(data);for(const key of ["zombies","meteors","burning","strikes","kills"])volcano[key]=list(volcano[key]);
      volcano.fireUntil||={host:0,guest:0};volcano.losses||={host:0,guest:0};
      lastPacket=packet.updatedAt;hasSnapshot=true;state.enemies=volcano.zombies;state.time=Math.min(DURATION,volcano.clock);
      applyRewards();
    }
    function receiveRetry() {
      if(!host())return false;const id="lava-retry-"+volcano.run;
      if(!window.__uvzuGetGuestKillRequests?.()?.[id])return false;
      window.__uvzuClearGuestKillRequest?.(id);initialize();push();return true;
    }
    function continueNeighborhood() {
      if(window.__uvzuCurrentLevelCode!=="RSCU7"||nextSent||guest())return;
      const r=window.__uvzuGetNeighborhoodState?.();if(r?.phase!=="won"||r.phaseTime<11.2)return;
      nextSent=true;if(host())window.__uvzuSignalNextLevel?.(LEVEL);
      else {window.__uvzuCurrentLevelCode=LEVEL;window.__uvzuLevelTheme="volcano";window.__uvzuUpdateLevelMusic?.();fullRestart();}
    }
    update=function(dt){
      if(!active()){old.update(dt);continueNeighborhood();return;}
      // Apply a room transition before accepting its snapshot. Otherwise a guest can
      // mistake the host's new run for a manual retry and restart both players again.
      const travel=window.__uvzuGetNextLevelSignal?.(),resetAt=window.__uvzuGetGhostResetAt?.();
      if((travel?.at&&travel.at!==window.__uvzuLastAppliedNextLevelAt)||
        (resetAt&&resetAt!==window.__uvzuLastAppliedGhostResetAt)){old.update(dt);return;}
      receiveState();if(receiveRetry())return;receiveAttacks();applyRewards();
      const run=volcano.run;state.mode=fighting()?(volcano.phase==="battle"?"play":"final"):"volcanoScene";
      breathFlash=Math.max(0,breathFlash-dt);noticeTime=Math.max(0,noticeTime-dt);
      old.update(dt);if(!active()||volcano.run!==run)return;
      volcano.phaseTime+=dt;if(volcano.phase!=="lost")volcano.clock+=dt;
      if(!guest()) {
        volcano.zombies=state.enemies;
        if(volcano.phase==="battle") {
          volcano.spawnTimer-=dt;
          if(volcano.spawnTimer<=0&&state.enemies.length<Math.min(8,tune().cap+(allPlayers().length>1?1:0))){spawnZombie();volcano.spawnTimer=tune().spawn;}
        }
        tickBoss(dt);
        if(fighting()) {
          volcano.meteorTimer-=dt;
          if(volcano.meteorTimer<=0){launchMeteor();volcano.meteorTimer=volcano.phase==="boss"?4.5:tune().eruption;}
          for(const m of volcano.meteors)if(!m.hit&&meteorAge(m)>=m.flight)impactMeteor(m);
        }
        for(const b of volcano.burning)b.x+=b.vx*dt;
        volcano.burning=volcano.burning.filter(b=>volcano.clock-b.born<2.2&&b.x>-110&&b.x<W+110);
        volcano.meteors=volcano.meteors.filter(m=>meteorAge(m)<m.flight+.75);
        volcano.strikes=volcano.strikes.filter(s=>volcano.clock-s.born<.8);
        if(volcano.phase==="collapse"&&volcano.phaseTime>=3.5&&!volcano.finished){volcano.finished=true;if(host())window.__uvzuSignalLevelCompleted?.();push();}
      } else {
        for(const [id,at] of pending)if(volcano.clock-at>1.5){pending.delete(id);attacks=attacks.filter(a=>a.enemy!==id);}
        state.enemies=volcano.zombies.filter(z=>!pending.has(z.id));
        for(const b of volcano.burning)b.x+=b.vx*dt;
      }
      localHazards();applyRewards();updateHud();
    };
    updateHud=function(){
      old.updateHud();if(!active())return;
      timeEl.textContent=volcano.phase==="battle"?"Time: "+Math.max(0,Math.ceil(DURATION-volcano.clock))+"s":
        volcano.phase==="arrival"?"Rock golem":volcano.phase==="boss"?"Volcano hits: "+volcano.boss.hits+" / 4":volcano.finished?"Golem defeated!":"";
      if(fireTime()>0){
        if(powerFillEl)powerFillEl.style.width=(fireTime()/FIRE_SECONDS*100)+"%";
        if(powerLabelEl)powerLabelEl.textContent="Fire: "+fireTime().toFixed(1)+"s";
      }
    };

    const box=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
    function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}
    function oval(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
    function line(x,y,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
    function text(value,x,y,size=18,color="#fff0bf"){ctx.textAlign="center";ctx.font="900 "+size+"px system-ui,sans-serif";ctx.lineJoin="round";
      ctx.strokeStyle="#322735";ctx.lineWidth=4;ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);}
    function rock(x,y,s=1,color="#5d505d"){
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);poly([[-24,0],[-29,-12],[-16,-36],[5,-41],[27,-19],[23,1]],color);
      poly([[-16,-36],[5,-41],[27,-19],[3,-13]],"#8a7280");poly([[3,-13],[27,-19],[23,1],[-2,-1]],"#3c3449");
      line(-15,-29,-7,-13,"#b09694",2);ctx.restore();
    }
    function scenery(){
      const sky=ctx.createLinearGradient(0,0,0,350);sky.addColorStop(0,"#49384f");sky.addColorStop(.55,"#ae6563");sky.addColorStop(1,"#f3bc8b");
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);oval(197,105,51,51,"#eb9b7777");oval(197,105,35,35,"#ffd090");
      poly([[0,233],[53,161],[107,218],[175,155],[268,222],[344,147],[435,220],[518,174],[634,225],[760,139],[861,213],[960,170],[960,340],[0,340]],"#85596b");
      poly([[0,283],[103,207],[189,259],[298,182],[435,273],[522,200],[602,277],[715,190],[799,270],[902,210],[960,248],[960,349],[0,349]],"#634457");
      // Basalt volcano with visible lava channels from its crater.
      poly([[356,319],[438,274],[509,222],[582,135],[612,124],[651,125],[682,148],[733,219],[808,284],[877,324]],"#574251");
      poly([[632,133],[682,148],[733,219],[808,284],[877,324],[642,318],[683,232]],"#3b3348");
      poly([[582,135],[612,124],[651,125],[682,148],[653,157],[610,152]],"#b96656");
      oval(CRATER.x,CRATER.y,36,10,"#f9a548");oval(CRATER.x,CRATER.y-2,26,6,"#ffe58f");
      poly([[624,145],[642,149],[625,181],[647,212],[624,243],[650,266],[677,300],[647,317],[606,259],[611,225],[593,191]],"#e7643b");
      poly([[627,151],[635,152],[615,184],[636,213],[616,246],[641,268],[663,302],[654,304],[630,272],[608,247],[628,213],[607,185]],"#ffbd5e");
      poly([[628,154],[631,155],[611,185],[632,213],[611,245],[634,270],[642,273],[616,244],[636,213],[616,185]],"#fff0a0");
      poly([[563,187],[547,241],[512,267],[480,299],[460,297],[500,256],[538,233]],"#95605e");
      for(let i=0;i<18;i++){const x=408+(i*53)%402,y=259+(i*19)%48;rock(x,y,.25+(i%3)*.08);}
      box(0,307,W,40,"#442f43");poly([[0,313],[163,321],[326,307],[447,318],[612,310],[784,317],[960,307],[960,335],[784,331],[615,328],[432,339],[276,327],[118,339],[0,326]],"#e27143");
      poly([[0,318],[151,326],[312,315],[463,328],[624,319],[796,326],[960,314],[960,323],[793,332],[621,324],[465,333],[311,320],[150,332],[0,323]],"#ffc769");
      poly([[0,338],[136,331],[263,340],[421,333],[576,338],[734,331],[877,336],[960,330],[960,H],[0,H]],"#66545e");
      box(0,349,W,10,"#76616a");box(0,359,W,H-359,"#6b5860");
      for(let i=0;i<36;i++){
        const x=(i*137+21)%960,y=367+(i*43)%169;
        line(x,y,x+24,y+4,"#493d50",2);line(x+24,y+4,x+36,y-3,"#493d50",2);
        box(x+7,y-8,5,2,"#998078");box(x+40,y+9,4,2,"#ae89805e");
      }
      for(const [x,y,s] of [[24,345,.85],[307,337,.55],[464,347,.43],[901,345,.66],[938,536,.7],[30,529,.53]])rock(x,y,s);
      poly([[0,509],[57,520],[99,513],[146,535],[193,532],[207,540],[0,540]],"#483b4d");
      line(0,523,50,534,"#f19b58",3);line(52,534,77,528,"#f19b58",3);
    }
    function background(){
      if(!sceneryCanvas){const layer=document.createElement("canvas");layer.width=W;layer.height=H;
        if(layer.getContext){const previous=ctx.getImageData(0,0,W,H);scenery();layer.getContext("2d").drawImage(ctx.canvas,0,0);ctx.putImageData(previous,0,0);sceneryCanvas=layer;}}
      if(sceneryCanvas)ctx.drawImage(sceneryCanvas,0,0);else scenery();
      for(let i=0;i<8;i++){const age=(gameClock*.2+i*.14)%1;oval(CRATER.x-5+Math.sin(i*1.8)*18+age*24,CRATER.y-13-age*125,14+age*22,10+age*18,"rgba(75,57,72,"+(.24*(1-age))+")");}
      for(let i=0;i<12;i++){const age=(gameClock*.16+i*.11)%1;box(CRATER.x+Math.sin(i*1.9)*36+age*14,CRATER.y-12-age*115,2,3,"rgba(255,193,99,"+(.7*(1-age))+")");}
    }
    drawBackground=function(){if(active())background();else old.drawBackground();};
    function flame(x,y,size,seed=0){
      const flicker=Math.sin(gameClock*19+seed)*size*.12;
      poly([[x-size*.6,y],[x-size*.8,y-size*.45],[x-size*.2,y-size*.85],[x-size*.1,y-size*1.8-flicker],[x+size*.35,y-size*.9],[x+size*.75,y-size*.5],[x+size*.55,y]],"#dc513e");
      poly([[x-size*.4,y],[x-size*.45,y-size*.4],[x,y-size*1.35-flicker],[x+size*.42,y-size*.42],[x+size*.32,y]],"#ffac4e");
      poly([[x-size*.2,y],[x,y-size*.73],[x+size*.25,y]],"#fff1a0");
    }
    function breath(source,enemy=false){
      ctx.save();ctx.translate(source.x+(source.face||1)*44,source.y-35);ctx.scale(source.face||1,1);
      poly([[0,-4],[39,-15],[82,-17],[142,-28],[157,-10],[142,3],[99,22],[48,14],[0,6]],enemy?"#d54a3cd9":"#df613fe6");
      poly([[0,-2],[45,-9],[95,-17],[144,-9],[110,10],[62,12],[0,4]],"#ffb553e6");
      poly([[0,0],[39,-5],[94,-4],[118,2],[57,6]],"#fff0a8");
      for(let i=0;i<6;i++){const t=(gameClock*4+i*.19)%1;box(22+t*142,-18+Math.sin(i+gameClock*12)*13,6,3,"#ffe58f");}
      ctx.restore();
    }
    function meteorPosition(m){
      const t=clamp(meteorAge(m)/m.flight,0,1),u=clamp((t-.27)/.73,0,1);
      if(t<.27)return{x:lerp(CRATER.x,m.x-.16*(m.x-CRATER.x),t/.27),y:lerp(CRATER.y,-54,t/.27)};
      return{x:lerp(m.x-.16*(m.x-CRATER.x),m.x,u),y:lerp(-54,m.y-10,u*u)};
    }
    function drawMeteorMarks(){
      for(const m of volcano.meteors){const t=meteorAge(m)/m.flight;if(t>=1)continue;
        const pulse=.2+(.12*(1+Math.sin(gameClock*12)));
        oval(m.x,m.y+3,46,25,"rgba(255,168,70,"+pulse+")");
        ctx.strokeStyle="#ffe397";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(m.x,m.y+3,46,25,0,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-t));ctx.stroke();
        line(m.x-10,m.y+3,m.x+10,m.y+3,"#ffedb8",2);line(m.x,m.y-4,m.x,m.y+10,"#ffedb8",2);
      }
      const b=volcano.boss;if(volcano.phase==="boss"&&b.mode==="windup"){
        oval(b.targetX,b.targetY,61,35,"#e65d6650");ctx.strokeStyle="#f2a09b";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(b.targetX,b.targetY,61,35,0,0,Math.PI*2);ctx.stroke();
      }
    }
    function drawMeteors(){
      for(const m of volcano.meteors){const age=meteorAge(m);if(age<m.flight){
        const p=meteorPosition(m);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(.1*Math.sin(age*3));
        flame(0,4,26,1);oval(0,-3,15,16,"#ffbd59");oval(-2,-5,8,9,"#fff0ad");ctx.restore();
      }else{const t=(age-m.flight)/.75;ctx.save();ctx.globalAlpha=1-t;
        oval(m.x,m.y+7,46+t*30,24+t*12,"#f6c975");
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7;box(m.x+Math.cos(a)*t*92,m.y-9-Math.sin(i*2)*t*68-t*18,6,5,i%2?"#ffe59b":"#e47847");}
        flame(m.x,m.y+10,36*(1-t));ctx.restore();}}
    }
    function drawGolem(){
      const b=volcano.boss;if(!b)return;
      const fall=volcano.phase==="collapse"?clamp((volcano.phaseTime-.25)/1.6,0,1):0;
      const walking=b.mode==="walk"||b.mode==="arrival",stride=walking?Math.sin(gameClock*6)*5:0;
      ctx.save();ctx.translate(b.x,b.y);oval(0,8,81,21,"#32273977");
      ctx.translate(fall*30,fall*26);ctx.rotate(fall*1.15);
      if(b.flash>0&&Math.floor(gameClock*15)%2===0)ctx.globalAlpha=.7;
      for(const side of [-1,1]){
        poly([[side*15,-58],[side*47,-59],[side*52,-22+side*stride],[side*46,5+side*stride],[side*11,5+side*stride]],"#796e7c");
        poly([[side*47,-59],[side*57,-43],[side*52,-22+side*stride],[side*46,5+side*stride],[side*34,-9]],"#4b455d");
        box(side>0?10:-60,-4+side*stride,50,17,"#514955");box(side>0?12:-57,-5+side*stride,40,5,"#b1a091");
      }
      poly([[-51,-144],[-70,-111],[-46,-63],[-25,-49],[40,-53],[66,-94],[51,-146],[15,-162]],"#746977");
      poly([[-51,-144],[15,-162],[51,-146],[31,-119],[-27,-117]],"#aaa095");
      poly([[31,-119],[51,-146],[66,-94],[40,-53],[23,-64]],"#514959");
      poly([[-27,-117],[31,-119],[15,-85],[-17,-87]],"#8d8188");
      poly([[-31,-153],[-40,-181],[-23,-210],[16,-213],[39,-188],[31,-152],[0,-143]],"#92858a");
      poly([[-23,-210],[16,-213],[39,-188],[1,-192]],"#c2b09b");
      poly([[1,-192],[39,-188],[31,-152],[6,-159]],"#685e72");
      // Irregular stone fractures remain visible before the heated impact cracks appear.
      for(const points of [[[-23,-207],[-16,-194],[-22,-186]],[[23,-203],[16,-193],[22,-184]],
        [[-47,-135],[-35,-125],[-41,-105]],[[11,-145],[2,-130],[10,-119]],
        [[-20,-100],[-7,-88],[-14,-72]],[[45,-97],[33,-85],[41,-69]]]){
        line(...points[0],...points[1],"#50475a",2);line(...points[1],...points[2],"#50475a",2);
      }
      box(-23,-181,17,7,"#352d3e");box(9,-181,17,7,"#352d3e");box(-20,-180,12,4,"#ffc36b");box(12,-180,11,4,"#ffc36b");
      poly([[-14,-162],[16,-166],[13,-156],[-9,-154]],"#403749");
      for(let i=0;i<b.hits;i++){
        const x=-31+i*19;line(x,-132,x+7,-109,"#f4a356",3);line(x+7,-109,x-4,-87,"#ffcd6a",3);line(x-4,-87,x+6,-71,"#d36847",2);
      }
      for(const side of [-1,1]){
        const striking=side===b.side&&(b.mode==="windup"||b.mode==="smash");
        let hx=side*90,hy=-64+side*stride;
        if(striking&&b.mode==="windup"){hx=side*84;hy=-194;}
        if(striking&&b.mode==="smash"){hx=b.targetX-b.x;hy=b.targetY-b.y-16;}
        line(side*50,-129,hx,hy,"#464050",32);line(side*51,-134,hx-4,hy-4,"#8d8188",21);
        poly([[hx-25,hy-20],[hx+15,hy-24],[hx+31,hy-4],[hx+21,hy+22],[hx-19,hy+25],[hx-32,hy+4]],"#827682");
        poly([[hx-25,hy-20],[hx+15,hy-24],[hx+31,hy-4],[hx-8,hy-7]],"#bdad9a");
        for(let j=0;j<3;j++)line(hx-15+j*12,hy+8,hx-13+j*12,hy+21,"#4b4054",3);
      }
      ctx.restore();
      if(fall>0){for(let i=0;i<13;i++){const age=volcano.phaseTime,dx=Math.sin(i*2.4)*Math.min(110,age*49);
        rock(b.x+dx,b.y+6-Math.max(0,1-Math.abs(age-1.1))*Math.abs(Math.cos(i))*70,.2+(i%3)*.15,"#7c6d75");}}
    }
    function playerActor(p){
      if(p.dead||p.ghost||p.lives<=0)return;
      if(p.role===role()){drawShieldAura();drawDodgeEffect();}
      drawUnicorn(p.x,p.y,p.face||1,false,p.ray>0,p.giant>0);
      const powered=p.role===role()?fireTime()>0:p.volcanoStatus?.fire>0;
      if(powered){oval(p.x+(p.face||1)*49,p.y-36,4,3,"#ffc774");if(p.role===role()?breathFlash>0:p.volcanoStatus?.breathing)breath(p);}
      if(host()||guest())text(p.role==="host"?"P1":"P2",p.x,p.y-86,12,p.role==="host"?"#ffe6a7":"#bde9f5");
    }
    draw=function(){
      if(!active())return old.draw();ctx.save();background();drawMeteorMarks();
      const actors=state.enemies.map(z=>({y:z.y,draw:()=>{
        drawUnicorn(z.x,z.y,z.face,true,false,false);
        if(z.type==="fire"){
          oval(z.x+z.face*49,z.y-37,6,4,"#ffa252");
          if(z.mode==="inhale"){flame(z.x+z.face*49,z.y-38,8);text("!",z.x,z.y-79,20,"#ffc878");}
          if(z.mode==="breath")breath(z,true);
        }
      }}));
      for(const b of volcano.burning)actors.push({y:b.y,draw:()=>{
        drawUnicorn(b.x,b.y+Math.sin(gameClock*24)*3,b.face,true,false,false);
        for(let i=0;i<4;i++)flame(b.x-25+i*17,b.y-10,19+(i%2)*6,i);
      }});
      for(const p of allPlayers())actors.push({y:p.y,draw:()=>playerActor(p)});
      if(volcano.boss)actors.push({y:volcano.boss.y,draw:drawGolem});
      actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());drawShots();drawParticles();drawMeteors();ctx.restore();drawHealthBar();
      box(277,17,406,58,"#352b40d9");box(277,17,406,3,"#ffbe77");
      text(volcano.boss?"ROCK GOLEM":"VOLCANIC BADLANDS",480,42,21);
      if(volcano.phase==="battle")text("SURVIVE THE ERUPTION",480,64,13,"#f5c49b");
      else if(volcano.boss){for(let i=0;i<GOLEM_HITS;i++)box(442+i*20,54,15,10,i<volcano.boss.hits?"#ffc26b":"#796c82");}
      if(volcano.phase==="arrival")text("LURE THE GOLEM INTO THE FALLING FIREBALLS!",480,102,19,"#ffdc9d");
      else if(volcano.phase==="boss")text("BAIT THE LANDING SPOT. DODGE BEFORE IT HITS.  "+volcano.boss.hits+" / 4",480,101,15,"#ffdc9d");
      else if(volcano.phase==="collapse"&&volcano.phaseTime>2.2){
        box(228,105,504,78,"#352b40e8");text("GOLEM DEFEATED!",480,139,29,"#ffdc9d");text("THE BADLANDS ARE CLEAR.",480,166,16,"#ffe8c7");
      }else if(volcano.phase==="battle"&&volcano.clock<8)text("DODGE FALLING FIREBALLS — A DIRECT HIT COSTS A LIFE",480,101,14,"#ffe5b1");
      if(fireTime()>0){box(316,H-51,328,30,"#352b40de");text("HOLD B: FIRE BREATH  "+fireTime().toFixed(1)+"s",480,H-30,17,"#ffdc91");}
      else if(noticeTime>0)text(notice,480,H-30,16,"#ffdc91");
    };
  }

  window.__uvzuInstallVolcano=function(code){
    function once(before,after){if(code.split(before).length!==2)throw new Error("Volcano hook missing: "+before.slice(0,90));code=code.replace(before,()=>after);}
    const movement='(["RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))';
    if(code.split(movement).length!==6)throw new Error("Volcano movement hooks missing");
    code=code.split(movement).join('(["LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))');
    const ending='!["RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)';
    if(code.split(ending).length!==3)throw new Error("Volcano ending hooks missing");
    code=code.split(ending).join('!["LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)');
    once('window.__uvzuLevelTheme = nextCode === "RSCU7" ? "neighborhood" :','window.__uvzuLevelTheme = nextCode === "LAVA8" ? "volcano" : nextCode === "RSCU7" ? "neighborhood" :');
    once('  requestAnimationFrame(loop);\n})();','('+volcanoRuntime.toString()+')();\n  requestAnimationFrame(loop);\n})();');
    return code;
  };
})();
