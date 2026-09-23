// Lake catapults, level 9. Load after volcano-level.js and before game.js.
// LAKE9: sink all 12 enemy boats, then fight the fish. No level countdown.
(() => {
  function lakeRuntime() {
    const LEVEL="LAKE9", TOTAL_BOATS=12, MAGAZINE=3, RELOAD=5, FISH_HP=12, SWIM_TIME=10;
    const MUSIC_URL="./Aquatic%20Adventure.m4a";
    const SHOT_GAP=.45, FLIGHT=.95;
    const SETTINGS={
      Easy:   { cap:3, gap:4.8, boatSpeed:39, warning:1.05, rockFlight:1.35, fishSpeed:110, jumpWarning:1.3 },
      Normal: { cap:4, gap:4.3, boatSpeed:45, warning:.95, rockFlight:1.25, fishSpeed:125, jumpWarning:1.15 },
      Hard:   { cap:5, gap:3.9, boatSpeed:51, warning:.85, rockFlight:1.15, fishSpeed:140, jumpWarning:1.05 }
    };
    const active=()=>window.__uvzuCurrentLevelCode===LEVEL;
    const host=()=>!!window.__uvzuIsMultiplayerHost?.(), guest=()=>!!window.__uvzuIsMultiplayerGuest?.();
    const role=()=>guest()?"guest":"host", ghost=()=>player.lives<=0||!!window.__uvzuIsLocalGhost?.();
    const tune=()=>SETTINGS[window.__uvzuCurrentDifficultyName]||SETTINGS.Easy;
    const list=value=>Array.isArray(value)?value.filter(Boolean):Object.values(value||{});
    const copy=value=>JSON.parse(JSON.stringify(value));
    const old={fullRestart,safeLifeReset,update,spawnEnemy,updateEnemies,startFinalWave,updateEnding,
      playerShoot,headbutt,killEnemy,updateShots,loseLife,draw,drawBackground,updateHud,startMusic};
    const session=()=>{const r=window.__uvzuTombTravelNetwork?.room?.()||{};return[r.createdAt||0,r.nextLevelAt||0,r.ghostResetAt||0].join(":");};
    const crew=()=>({ammo:MAGAZINE,reloadAt:0,shotAt:0,lastSeq:0,loss:0});
    let serial=0,lastPacket=0,hasSnapshot=false,nextSent=false,sceneryCanvas=null,lakeMusic=null;
    let hull=3,ammo=MAGAZINE,reloadAt=0,shotAt=0,shotSeq=0,loss=0,lastThrow=-99,hitFlash=0,swallow=null,graceUntil=0;
    let pendingShots=[];
    const seenHazards=new Set(),seenRewards=new Set();
    const fresh=()=>({level:LEVEL,session:session(),run:Date.now()+"-"+(++serial),phase:"battle",phaseTime:0,
      clock:0,spawnTimer:1,spawned:0,event:0,boats:[],rocks:[],sinking:[],bites:[],kills:[],
      crews:{host:crew(),guest:crew()},fish:null,finished:false});
    let lake=fresh();
    const fighting=()=>lake.phase==="battle"||lake.phase==="boss";
    const push=()=>{if(host())window.__uvzuMultiplayerPushEnemyState?.(state.enemies,true);};
    const wantsLakeMusic=()=>active()&&gameStarted&&!paused&&!document.hidden&&lake.phase!=="lost";
    function stopLakeMusic(reset=false){
      if(!lakeMusic)return;
      if(!lakeMusic.paused)lakeMusic.pause();
      if(reset)lakeMusic.currentTime=0;
    }
    function playLakeMusic(){
      if(!wantsLakeMusic()){stopLakeMusic(!active());return;}
      window.__uvzuStopMainMusic?.();window.stopTombMusic?.();
      if(!lakeMusic){lakeMusic=new Audio(MUSIC_URL);lakeMusic.loop=true;lakeMusic.volume=.45;lakeMusic.preload="auto";}
      if(lakeMusic.paused===false)return;
      try{lakeMusic.play()?.then(()=>{if(!wantsLakeMusic())stopLakeMusic(!active());}).catch(()=>{});}catch(_){}
    }
    window.__uvzuGetLakeState=()=>active()?{...lake,boats:state.enemies}:null;
    window.__uvzuGetLakeStatus=()=>active()?{level:LEVEL,run:lake.run,hull,ammo,reloadAt,loss,lastThrow,swallow,launches:pendingShots}:null;
    function resetPosition() {
      resetPlayerPosition();player.x=guest()?330:220;player.y=448;
      player.webbedTimer=player.webFlash=0;player.webTrapX=player.webTrapY=null;
      hull=3;ammo=MAGAZINE;reloadAt=shotAt=0;lastThrow=-99;hitFlash=0;swallow=null;pendingShots=[];
      graceUntil=lake.clock+1.2;
    }
    function coopLives(){if(host()||guest())player.lives=window.__uvzuTesterLifeBudget?.(5)??5;}
    function initialize(){
      stopLakeMusic(true);
      window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();coopLives();lake=fresh();
      state.enemies=lake.boats;state.mode="play";loss=shotSeq=lastPacket=0;hasSnapshot=false;nextSent=false;
      seenHazards.clear();seenRewards.clear();resetPosition();
      window.__uvzuLevelTheme="lake";window.__uvzuStopMainMusic?.();window.stopTombMusic?.();updateHud();playLakeMusic();
    }
    fullRestart=function(){
      if(!active()){stopLakeMusic(true);nextSent=false;return old.fullRestart();}
      if(guest()&&hasSnapshot&&lake.session===session()){window.__uvzuRequestEnemyKill?.("lake-retry-"+lake.run);return;}
      initialize();push();
    };
    safeLifeReset=function(){
      if(!active())return old.safeLifeReset();
      state.resetQueued=false;resetPosition();
      const points=[{x:125,y:365},{x:480,y:500},{x:835,y:365}];
      const danger=p=>Math.min(lake.fish?Math.hypot(lake.fish.x-p.x,lake.fish.y-p.y):999,
        ...lake.rocks.filter(s=>s.team==="enemy"&&!s.hit).map(s=>Math.hypot(s.x-p.x,s.y-p.y)));
      const p=points.sort((a,b)=>danger(b)-danger(a))[0];player.x=p.x;player.y=p.y;
      state.playerShots.length=state.enemyShots.length=0;state.mode=lake.phase==="boss"?"final":"play";
    };
    loseLife=function(){
      if(!active())return old.loseLife();const before=player.lives;old.loseLife();
      if(player.lives>=before)return;
      loss++;pendingShots=[];swallow=null;hull=3;ammo=MAGAZINE;reloadAt=shotAt=0;
      if(!guest()){const c=lake.crews[role()];Object.assign(c,crew(),{loss,lastSeq:shotSeq});}
      if(!ghost()&&(host()||guest()))safeLifeReset();
      if(!host()&&!guest()&&player.lives<=0)lake.phase="lost";
      window.__uvzuMultiplayerPush?.(player);push();
    };
    spawnEnemy=function(...args){if(!active())return old.spawnEnemy(...args);};
    headbutt=function(){if(!active())return old.headbutt();};
    killEnemy=function(...args){if(!active())return old.killEnemy(...args);};
    updateShots=function(dt){if(!active())return old.updateShots(dt);};
    updateEnding=function(dt){if(!active())return old.updateEnding(dt);};
    startMusic=function(){if(active())playLakeMusic();else{stopLakeMusic(true);old.startMusic();}};
    const previousMusic=window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic=function(){previousMusic?.();playLakeMusic();};
    const previousStart=window.__uvzuStartGame;
    window.__uvzuStartGame=function(...args){const result=previousStart(...args);playLakeMusic();return result;};
    const previousPause=window.__uvzuSetPaused;
    window.__uvzuSetPaused=function(value){previousPause(value);playLakeMusic();};
    window.addEventListener("keydown",()=>{if(active())playLakeMusic();});
    window.addEventListener("pointerdown",()=>{if(active())playLakeMusic();});
    document.addEventListener?.("visibilitychange",playLakeMusic);
    window.addEventListener("pagehide",()=>stopLakeMusic());
    window.addEventListener("pageshow",playLakeMusic);
    function players(includeUnavailable=false){
      const result=[{...player,role:role(),dead:ghost(),lakeStatus:window.__uvzuGetLakeStatus()}];
      const remote=window.__uvzuGetRemotePlayer?.();
      if((host()||guest())&&remote?.lakeStatus?.run===lake.run&&Number.isFinite(remote.x)&&Number.isFinite(remote.y))
        result.push({...remote,role:guest()?"host":"guest",dead:!!remote.dead||!!remote.ghost||remote.lives<=0});
      return includeUnavailable?result:result.filter(p=>!p.dead&&!p.lakeStatus?.swallow);
    }
    const nearest=(x,y)=>players().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
    function reloadLocal(){if(ammo===0&&lake.clock>=reloadAt){ammo=MAGAZINE;reloadAt=0;}}
    function targetFor(p){
      const targets=lake.phase==="battle"?state.enemies:lake.fish?.mode==="swim"?[lake.fish]:[];
      const target=targets.filter(z=>(z.x-p.x)*(p.face||1)>-15&&z.x>20&&z.x<W-20&&Math.abs(z.y-p.y)<180)
        .sort((a,b)=>Math.hypot(a.x-p.x,(a.y-p.y)*1.4)-Math.hypot(b.x-p.x,(b.y-p.y)*1.4))[0];
      return target?{x:clamp(target.x+(target.vx||0)*FLIGHT,45,W-45),y:clamp(target.y+(target.vy||0)*FLIGHT,331,504)}:
        {x:clamp(p.x+(p.face||1)*370,35,W-35),y:p.y};
    }
    function acceptShot(a,who){
      const c=lake.crews[who];
      if(!c||a.seq<=c.lastSeq)return;c.lastSeq=a.seq;
      if(!fighting()||a.loss!==c.loss||!Number.isFinite(a.at)||lake.clock-a.at>2||a.at>lake.clock+.35||
        ![a.fromX,a.fromY,a.x,a.y].every(Number.isFinite))return;
      if(c.ammo===0&&a.at>=c.reloadAt-.025){c.ammo=MAGAZINE;c.reloadAt=0;}
      if(c.ammo<=0||a.at<c.shotAt-.025)return;
      c.ammo--;c.shotAt=a.at+SHOT_GAP;if(c.ammo===0)c.reloadAt=a.at+RELOAD;
      lake.rocks.push({id:lake.run+"-"+who+"-"+a.seq,team:who,fromX:a.fromX,fromY:a.fromY,
        x:clamp(a.x,35,W-35),y:clamp(a.y,325,510),born:a.at,flight:FLIGHT,hit:false});
      push();
    }
    playerShoot=function(){
      if(!active())return old.playerShoot();reloadLocal();
      if(!fighting()||ghost()||swallow||ammo<=0||lake.clock<shotAt)return;
      const target=targetFor(player),a={seq:++shotSeq,loss,at:lake.clock,fromX:player.x,fromY:player.y,x:target.x,y:target.y};
      ammo--;shotAt=lake.clock+SHOT_GAP;lastThrow=lake.clock;if(ammo===0)reloadAt=lake.clock+RELOAD;
      if(guest())pendingShots.push(a);else acceptShot(a,role());
      window.__uvzuMultiplayerPush?.(player);updateHud();
    };
    function receiveLaunches(){
      if(!host())return;const p=players(true).find(p=>p.role==="guest");if(!p)return;
      const status=p.lakeStatus,c=lake.crews.guest;
      if(status.loss!==c.loss)Object.assign(c,crew(),{loss:status.loss,lastSeq:c.lastSeq});
      if(p.dead)return;
      for(const a of list(status.launches).sort((a,b)=>a.seq-b.seq)){
        if(status.swallow&&a.at>status.swallow.at)continue;
        if(Math.hypot(p.x-a.fromX,p.y-a.fromY)>340)continue;
        acceptShot(a,"guest");
      }
    }
    function rewards(){
      for(const k of lake.kills){if(seenRewards.has(k.id))continue;seenRewards.add(k.id);if(k.who===role())state.score+=30;}
    }
    function sinkBoat(index,who){
      const b=state.enemies.splice(index,1)[0];if(!b)return;
      lake.kills.push({id:b.id,who});lake.sinking.push({...b,born:lake.clock});rewards();push();
    }
    function spawnBoat(){
      // Sinking boats occupy a slot until they disappear, even in multiplayer.
      if(guest()||lake.phase!=="battle"||lake.spawned>=TOTAL_BOATS||
        state.enemies.length+lake.sinking.length>=tune().cap)return false;
      const n=lake.spawned++,right=n%2===1;
      state.enemies.push({id:"lake-boat-"+lake.run+"-"+n,type:"lakeBoat",x:right?W+65:-65,y:[380,472,415,350][n%4],
        w:98,h:45,hp:3,face:right?-1:1,mode:"sail",ammo:MAGAZINE,reloadAt:0,timer:.8,
        targetX:480,targetY:430,vx:0,vy:0,lastThrow:-99,flash:0,shootTimer:999,sep:1});
      return true;
    }
    function enemyLaunch(b){
      lake.rocks.push({id:lake.run+"-enemy-"+(++lake.event),team:"enemy",fromX:b.x,fromY:b.y,x:b.targetX,y:b.targetY,
        born:lake.clock,flight:tune().rockFlight,hit:false});
      b.ammo--;b.lastThrow=lake.clock;
      if(b.ammo===0){b.mode="reload";b.reloadAt=lake.clock+RELOAD;}else{b.mode="recover";b.timer=.65;}
      push();
    }
    function tickBoats(dt){
      for(const b of state.enemies){
        b.vx=b.vy=0;b.flash=Math.max(0,b.flash-dt);
        if(b.mode==="windup"){b.timer-=dt;if(b.timer<=0)enemyLaunch(b);continue;}
        if(b.mode==="recover"){b.timer-=dt;if(b.timer<=0)b.mode="sail";continue;}
        if(b.mode==="reload"){if(lake.clock>=b.reloadAt){b.ammo=MAGAZINE;b.mode="sail";}else continue;}
        const p=nearest(b.x,b.y);if(!p)continue;
        const dx=p.x-b.x,dy=p.y-b.y;b.face=dx>=0?1:-1;
        if(b.x<75||b.x>W-75||Math.abs(dx)>330||Math.abs(dy)>80){
          const d=Math.hypot(dx,dy)||1;b.vx=dx/d*tune().boatSpeed;b.vy=dy/d*tune().boatSpeed*.6;
          b.x+=b.vx*dt;b.y=clamp(b.y+b.vy*dt,345,493);
        }else{
          b.mode="windup";b.timer=tune().warning;b.targetX=clamp(p.x,55,W-55);b.targetY=clamp(p.y,330,505);
        }
      }
    }
    updateEnemies=function(dt){if(!active())return old.updateEnemies(dt);if(!guest()&&lake.phase==="battle")tickBoats(dt);};
    startFinalWave=function(){
      if(!active())return old.startFinalWave();
      if(guest()||lake.phase!=="battle"||lake.spawned<TOTAL_BOATS||
        lake.kills.length<TOTAL_BOATS||state.enemies.length>0)return;
      lake.phase="arrival";lake.phaseTime=0;lake.rocks=[];lake.bites=[];state.enemies.length=0;pendingShots=[];
      state.mode="lakeScene";state.playerShots.length=state.enemyShots.length=0;state.finalSpawned=0;
      lake.fish={x:760,y:413,hits:0,mode:"arrival",face:-1,timer:0,vx:0,vy:0,flash:0,jumps:0,
        fromX:760,fromY:413,targetX:480,targetY:445,attack:0,born:lake.clock,wayX:150,wayY:420};
      push();
    };
    function beginJump(){
      const b=lake.fish,live=players();const p=live[b.jumps%Math.max(1,live.length)]||{x:480,y:430};
      b.jumps++;b.mode="warning";b.timer=tune().jumpWarning;b.vx=b.vy=0;b.attack=++lake.event;
      b.fromX=b.x;b.fromY=b.y;b.targetX=p.x;b.targetY=p.y;b.face=p.x>=b.x?1:-1;b.born=lake.clock;push();
    }
    function setSwimCourse(){
      const b=lake.fish;b.wayX=b.x>480?120:840;b.wayY=365+((b.jumps*53+Math.round(b.x))%120);
    }
    function tickFish(dt){
      const b=lake.fish;if(!b)return;b.flash=Math.max(0,b.flash-dt);
      if(lake.phase==="arrival"){if(lake.phaseTime>=2.6){lake.phase="boss";lake.phaseTime=0;beginJump();}return;}
      if(lake.phase!=="boss")return;
      b.timer-=dt;
      if(b.mode==="warning"){
        if(b.timer<=0){b.mode="leap";b.timer=.95;b.born=lake.clock;push();}return;
      }
      if(b.mode==="leap"){
        const t=clamp((lake.clock-b.born)/.95,0,1);b.x=lerp(b.fromX,b.targetX,t);b.y=lerp(b.fromY,b.targetY,t);
        if(b.timer<=0){
          b.x=b.targetX;b.y=b.targetY;b.mode="swim";b.timer=SWIM_TIME;b.born=lake.clock;
          lake.bites.push({id:lake.run+"-leap-"+b.attack,x:b.x,y:b.y,born:lake.clock});setSwimCourse();push();
        }return;
      }
      if(b.mode==="swim"){
        if(b.timer<=0){beginJump();return;}
        let dx=b.wayX-b.x,dy=b.wayY-b.y,d=Math.hypot(dx,dy);
        if(d<12){setSwimCourse();dx=b.wayX-b.x;dy=b.wayY-b.y;d=Math.hypot(dx,dy);}
        b.vx=dx/(d||1)*tune().fishSpeed;b.vy=dy/(d||1)*tune().fishSpeed*.65;
        b.x=clamp(b.x+b.vx*dt,85,W-85);b.y=clamp(b.y+b.vy*dt,343,496);b.face=b.vx>=0?1:-1;
      }
    }
    function impactRock(s){
      if(s.hit)return;s.hit=true;
      if(s.team==="host"||s.team==="guest"){
        if(lake.phase==="battle"){
          const candidates=state.enemies.map((b,i)=>({b,i,d:Math.hypot((b.x-s.x)/56,(b.y-s.y)/31)})).filter(p=>p.d<1);
          candidates.sort((a,b)=>a.d-b.d);
          if(candidates.length){const {b,i}=candidates[0];b.hp--;b.flash=.3;if(b.hp<=0)sinkBoat(i,s.team);}
        }else if(lake.phase==="boss"&&lake.fish.mode==="swim"){
          const b=lake.fish;
          if(Math.hypot((b.x-s.x)/128,(b.y-s.y)/43)<1){
            b.hits++;b.flash=.25;
            if(b.hits===FISH_HP){lake.phase="won";lake.phaseTime=0;b.mode="sinking";b.vx=b.vy=0;lake.bites=[];state.mode="lakeScene";swallow=null;}
          }
        }
      }
      push();
    }
    function startSwallow(){
      if(swallow||ghost()||lake.clock<graceUntil||!fighting())return;
      const b=lake.fish;
      swallow={at:lake.clock,until:lake.clock+.8,x:player.x,y:player.y,toX:b.x+b.face*86,toY:b.y-16};
      player.headTimer=player.dodgeTimer=0;state.mode="lakeScene";
      window.__uvzuMultiplayerPush?.(player);
    }
    function hazards(){
      if(!fighting()||ghost()||state.resetQueued||swallow)return;
      for(const s of lake.rocks){
        const age=lake.clock-s.born-s.flight;
        if(s.team!=="enemy"||age<0||age>.7||seenHazards.has(s.id))continue;seenHazards.add(s.id);
        if(Math.hypot((player.x-s.x)/46,(player.y-s.y)/27)<1&&player.invuln<=0&&player.dodgeTimer<=0){
          hull--;hitFlash=.5;player.invuln=.65;
          if(hull<=0){player.invuln=0;loseLife();return;}
        }
      }
      for(const bite of lake.bites){
        if(lake.clock-bite.born>.7||seenHazards.has(bite.id))continue;seenHazards.add(bite.id);
        if(Math.hypot((player.x-bite.x)/110,(player.y-bite.y)/48)<1){startSwallow();if(swallow)return;}
      }
      const b=lake.fish;
      // A quick row can evade rocks; rowing directly through the fish still gets swallowed.
      if(lake.phase==="boss"&&b.mode==="swim"&&Math.hypot((player.x-b.x)/124,(player.y-b.y)/40)<1)startSwallow();
    }
    function receiveState(){
      if(!guest())return;const packet=window.__uvzuGetMultiplayerEnemyState?.(),data=packet?.lake;
      if(!data||data.level!==LEVEL||data.session!==session()||packet.updatedAt<=lastPacket)return;
      const reset=data.run!==lake.run;
      if(reset){
        stopLakeMusic(true);
        window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();coopLives();resetPosition();
        loss=shotSeq=0;seenRewards.clear();seenHazards.clear();
      }
      lake=copy(data);for(const key of ["boats","rocks","sinking","bites","kills"])lake[key]=list(lake[key]);
      lake.crews||={host:crew(),guest:crew()};state.enemies=lake.boats;state.time=0;
      lastPacket=packet.updatedAt;hasSnapshot=true;pendingShots=pendingShots.filter(a=>a.seq>(lake.crews.guest?.lastSeq||0));
      if(lake.phase==="won")swallow=null;rewards();if(reset)playLakeMusic();
    }
    function receiveRetry(){
      if(!host())return false;const id="lake-retry-"+lake.run;
      if(!window.__uvzuGetGuestKillRequests?.()?.[id])return false;
      window.__uvzuClearGuestKillRequest?.(id);initialize();push();return true;
    }
    function continueVolcano(){
      if(window.__uvzuCurrentLevelCode!=="LAVA8"||guest()||nextSent)return;
      const v=window.__uvzuGetVolcanoState?.();if(!v?.finished||v.phaseTime<7.5)return;
      nextSent=true;
      if(host())window.__uvzuSignalNextLevel?.(LEVEL);
      else{window.__uvzuCurrentLevelCode=LEVEL;window.__uvzuLevelTheme="lake";window.__uvzuUpdateLevelMusic?.();fullRestart();}
    }
    update=function(dt){
      if(!active()){stopLakeMusic(true);old.update(dt);continueVolcano();return;}
      const travel=window.__uvzuGetNextLevelSignal?.(),resetAt=window.__uvzuGetGhostResetAt?.();
      if((travel?.at&&travel.at!==window.__uvzuLastAppliedNextLevelAt)||(resetAt&&resetAt!==window.__uvzuLastAppliedGhostResetAt)){old.update(dt);return;}
      receiveState();if(receiveRetry())return;receiveLaunches();rewards();reloadLocal();
      const run=lake.run;
      state.mode=fighting()&&!swallow?(lake.phase==="battle"?"play":"final"):"lakeScene";
      old.update(dt);if(!active()||lake.run!==run)return;
      lake.phaseTime+=dt;if(lake.phase!=="lost")lake.clock+=dt;hitFlash=Math.max(0,hitFlash-dt);
      player.x=clamp(player.x,60,W-60);player.y=clamp(player.y,330,500);
      if(!guest()){
        lake.boats=state.enemies;
        if(lake.phase==="battle"){
          lake.spawnTimer-=dt;
          if(lake.spawnTimer<=0&&spawnBoat())lake.spawnTimer=tune().gap;
        }
        tickFish(dt);
        if(fighting())for(const s of lake.rocks)if(!s.hit&&lake.clock-s.born>=s.flight)impactRock(s);
        if(lake.phase==="battle")startFinalWave();
        lake.rocks=lake.rocks.filter(s=>lake.clock-s.born<s.flight+.8);
        lake.sinking=lake.sinking.filter(b=>lake.clock-b.born<2.2);lake.bites=lake.bites.filter(b=>lake.clock-b.born<.8);
        if(lake.phase==="won"&&lake.phaseTime>=3.6&&!lake.finished){lake.finished=true;if(host())window.__uvzuSignalLevelCompleted?.();push();}
      }else{
        state.enemies=lake.boats;
        for(const b of state.enemies){b.x+=(b.vx||0)*dt;b.y+=(b.vy||0)*dt;b.flash=Math.max(0,(b.flash||0)-dt);}
        if(lake.fish?.mode==="swim"){lake.fish.x+=lake.fish.vx*dt;lake.fish.y+=lake.fish.vy*dt;lake.fish.timer=Math.max(0,lake.fish.timer-dt);}
      }
      if(swallow&&lake.clock>=swallow.until&&fighting()){
        swallow=null;state.mode=lake.phase==="boss"?"final":"play";player.invuln=0;loseLife();
      }
      hazards();rewards();reloadLocal();if(lake.phase==="lost")stopLakeMusic();updateHud();
    };
    updateHud=function(){
      old.updateHud();if(!active())return;
      if(livesEl)livesEl.textContent="Lives: "+player.lives+" | Boat: "+(ghost()?0:hull)+" / 3";
      if(timeEl)timeEl.textContent=lake.phase==="battle"?"Boats sunk: "+lake.kills.length+" / "+TOTAL_BOATS:
        lake.phase==="boss"?"Fish hits: "+lake.fish.hits+" / 12":lake.phase==="won"?"Fish defeated!":"";
      if(powerLabelEl)powerLabelEl.textContent=ammo>0?"Rocks: "+ammo+" / 3":"Reload: "+Math.max(0,Math.ceil(reloadAt-lake.clock))+"s";
      if(powerFillEl)powerFillEl.style.width=(ammo>0?ammo/MAGAZINE*100:clamp(1-(reloadAt-lake.clock)/RELOAD,0,1)*100)+"%";
    };

    const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
    function oval(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
    function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}
    function line(x,y,x2,y2,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
    function text(value,x,y,size=18,color="#fff4cc"){
      ctx.font="900 "+size+"px system-ui,sans-serif";ctx.textAlign="center";ctx.lineJoin="round";
      ctx.lineWidth=4;ctx.strokeStyle="#193f57";ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);
    }
    function scenery(){
      const sky=ctx.createLinearGradient(0,0,0,300);sky.addColorStop(0,"#7ebee0");sky.addColorStop(1,"#e3efca");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      oval(170,109,41,41,"#ffe8a1");oval(170,109,51,51,"#ffedb328");
      for(const [x,y,s] of [[320,88,1],[782,101,.85],[90,177,.55]]){
        oval(x,y,62*s,10*s,"#f5f5dc");oval(x-28*s,y-8*s,27*s,13*s,"#f5f5dc");oval(x+10*s,y-12*s,38*s,17*s,"#f5f5dc");
      }
      poly([[0,211],[106,142],[179,172],[273,128],[396,220],[501,174],[563,192],[668,137],[755,190],[862,145],[960,197],[960,285],[0,285]],"#88b1ac");
      poly([[0,247],[112,181],[214,238],[317,172],[439,248],[572,198],[653,238],[762,183],[887,229],[960,202],[960,289],[0,289]],"#5e9b90");
      poly([[0,257],[181,237],[326,258],[465,238],[596,255],[753,239],[960,262],[960,304],[0,304]],"#60865d");
      for(let i=0;i<36;i++){const x=i*28,y=251+Math.sin(i*2.4)*9;box(x-3,y-9,6,33,"#68775d");
        poly([[x-15,y+10],[x,y-29],[x+15,y+10]],i%2?"#477b65":"#548a66");}
      poly([[0,281],[108,275],[277,287],[473,277],[652,285],[803,276],[960,285],[960,302],[0,302]],"#b7be8c");
      const water=ctx.createLinearGradient(0,282,0,H);water.addColorStop(0,"#71b9b6");water.addColorStop(.25,"#419caf");water.addColorStop(1,"#287990");
      ctx.fillStyle=water;ctx.fillRect(0,293,W,H-293);box(0,294,W,3,"#cae2bf");
      for(let i=0;i<35;i++){const x=(i*113+23)%960,y=303+(i*37)%226;line(x,y,x+19+(i%4)*9,y,"#95d2ca44",2);}
      poly([[0,298],[37,299],[59,316],[31,329],[0,334]],"#92a871");
      poly([[960,305],[928,308],[912,322],[935,334],[960,329]],"#8da76e");
      for(const side of [0,1])for(let i=0;i<7;i++){const x=side?960-i*7:i*7,y=312+i%3*6;
        line(x,y,x-4,y-27,"#537d59",3);line(x,y,x+5,y-19,"#718c5a",2);box(x-6,y-31,5,9,"#9b7450");}
      for(const [x,y] of [[40,451],[918,478],[64,507]]){oval(x,y,16,5,"#4f9a70");line(x,y,x+11,y-3,"#9fc584",1);}
    }
    function background(){
      if(!sceneryCanvas){const layer=document.createElement("canvas");layer.width=W;layer.height=H;
        if(layer.getContext){const before=ctx.getImageData(0,0,W,H);scenery();layer.getContext("2d").drawImage(ctx.canvas,0,0);ctx.putImageData(before,0,0);sceneryCanvas=layer;}}
      if(sceneryCanvas)ctx.drawImage(sceneryCanvas,0,0);else scenery();
      for(let i=0;i<26;i++){
        const x=((i*147+gameClock*(i%2?5:-4))%1020+1020)%1020-30,y=306+(i*43)%220;
        line(x,y,x+18,y-1,"#ace0d06b",2);line(x+21,y-1,x+30,y,"#ace0d04f",1);
      }
    }
    drawBackground=function(){if(active())background();else old.drawBackground();};
    function stone(x,y,size=8){poly([[x-size,y-2],[x-size*.6,y-size],[x+size*.5,y-size*.85],[x+size,y],[x+size*.3,y+size*.7],[x-size*.7,y+size*.5]],"#718493");
      poly([[x-size*.6,y-size],[x+size*.5,y-size*.85],[x+size,y],[x-size*.2,y-1]],"#c9d0cf");}
    function boat(p,enemy=false,scale=1,alpha=1){
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y+Math.sin(gameClock*3+p.x*.02)*1.5);ctx.scale(scale,scale);
      oval(0,23,62,13,"#18516855");line(-69,17,-43,19,"#b8e9dc99",2);line(47,20,74,17,"#b8e9dc88",2);
      oval(0,-7,55,16,"#8aabb6");oval(0,-9,46,10,"#426275");
      const face=p.face||1,status=p.lakeStatus||p,loaded=status.ammo||0,thrown=lake.clock-(status.lastThrow??-99);
      ctx.save();ctx.translate(-face*32,-5);ctx.scale(face,1);
      box(-17,-7,34,8,"#725437");poly([[-10,-8],[0,-36],[11,-8]],"#987349");box(-3,-32,7,24,"#c09a65");
      ctx.save();ctx.translate(0,-25);ctx.rotate(thrown<.28?-.6+thrown*2:loaded? .3:1.05);
      line(-13,7,18,-25,"#d2b487",5);oval(19,-27,10,5,"#6b594c");if(loaded&&thrown>.3)stone(19,-31,7);ctx.restore();
      for(let i=0;i<loaded;i++)stone(-11+i*9,-9,4);ctx.restore();
      ctx.save();ctx.scale(.77,.77);drawUnicorn(face*10,-12,face,enemy,false,false);ctx.restore();
      const metal=ctx.createLinearGradient(0,-8,0,29);metal.addColorStop(0,"#cfdfdd");metal.addColorStop(.45,"#91aeb9");metal.addColorStop(1,"#526e86");
      ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(-55,-8);ctx.quadraticCurveTo(-47,31,0,30);ctx.quadraticCurveTo(47,31,55,-8);ctx.quadraticCurveTo(0,14,-55,-8);ctx.fill();
      ctx.strokeStyle="#385e74";ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle="#e1ebe1";ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(0,-7,53,14,0,0,Math.PI);ctx.stroke();
      for(const x of [-33,-13,13,33]){oval(x,14,2,2,"#496d82");oval(x-1,13,1,1,"#e0ede5");}
      if(enemy&&p.flash>0){oval(0,4,49,18,"#fff2c355");}
      if(enemy){
        for(let i=0;i<3;i++)box(-14+i*11,36,8,4,i<p.hp?"#b9e5c7":"#315f70");
        if(p.mode==="windup")text("!",0,-80,21,"#ffd296");
        if(p.mode==="reload")text(Math.max(0,Math.ceil(p.reloadAt-lake.clock))+"s",0,-76,12,"#d1e5db");
      }else if(host()||guest())text(p.role==="host"?"P1":"P2",0,-80,12,p.role==="host"?"#ffe9ae":"#c4eff8");
      ctx.restore();
    }
    function fishPose(){
      const b=lake.fish;if(!b)return null;
      if(b.mode==="leap"){const t=clamp((lake.clock-b.born)/.95,0,1);return{x:lerp(b.fromX,b.targetX,t),y:lerp(b.fromY,b.targetY,t)-Math.sin(t*Math.PI)*158,turn:-Math.sin(t*Math.PI)*.55};}
      return{x:b.x,y:b.y,turn:0};
    }
    function drawFish(){
      const b=lake.fish,p=fishPose();if(!b)return;
      const sink=lake.phase==="won"?clamp((lake.phaseTime-.5)/2.7,0,1):0;
      const mouth=b.mode==="leap"||players(true).some(p=>p.lakeStatus?.swallow);
      const sway=Math.sin(gameClock*3.4)*7;
      oval(b.x,b.y+14,144,31,"rgba(27,88,114,"+(.42*(1-sink))+")");
      ctx.save();ctx.translate(p.x,p.y+sink*58);ctx.scale(b.face||1,1);
      ctx.rotate(p.turn+sink*.9);ctx.globalAlpha=1-sink;
      if(b.mode==="warning"||b.mode==="arrival")ctx.globalAlpha=.45;
      if(b.flash>0&&Math.floor(gameClock*20)%2===0)ctx.globalAlpha*=.65;
      // A long tail, four paddles and an armored back make it feel like an old lake guardian.
      poly([[-82,-20],[-117,-26],[-151,-44+sway],[-164,-38+sway],[-145,-14+sway],
        [-169,11+sway],[-149,15+sway],[-106,8],[-77,5]],"#225665");
      poly([[-121,-25],[-156,-38+sway],[-145,-17+sway],[-115,-8]],"#5b968c");
      poly([[-60,-13],[-27,1],[-71,47+sway*.4],[-91,53+sway*.4],[-84,31]],"#225a67");
      poly([[19,-12],[57,-8],[77,35-sway*.4],[63,46-sway*.4],[26,21]],"#285d67");
      for(let i=0;i<6;i++){
        const x=-78+i*22,y=-57-Math.sin(i*.65)*5;
        poly([[x-13,y+18],[x,y-8-(i%2)*5],[x+13,y+18]],"#245463");
        line(x-5,y+8,x,y-2-(i%2)*5,"#8cb8a3",2);
      }
      oval(-10,-17,109,48,"#204e5d");oval(-9,-21,104,44,"#43817f");
      oval(-4,2,91,24,"#80aa96");oval(-24,-38,74,16,"#579b8d");
      for(let i=0;i<5;i++){
        const x=-78+i*30;
        poly([[x-13,-39],[x,-49-(i%2)*4],[x+15,-39],[x+11,-24],[x-10,-25]],
          i%2?"#316e73":"#36797a");
        line(x-9,-34,x+6,-39-(i%2)*3,"#91b9a4",2);
      }
      for(const [x,y] of [[-70,-8],[-36,-4],[1,-8],[37,-9],[68,-10]]){
        oval(x,y,5,3,"#a5c4a6");oval(x+5,y+9,3,2,"#537e77");
      }
      poly([[-6,3],[28,9],[5,51-sway*.4],[-12,55-sway*.4],[-21,30]],"#285d67");
      poly([[32,-1],[61,9],[65,55+sway*.4],[45,62+sway*.4],[27,35]],"#326d72");
      line(38,27,52,49+sway*.4,"#8db7a3",3);
      // The raised neck and broad, blunt snout keep the silhouette clear on a phone.
      ctx.lineCap="round";ctx.beginPath();ctx.moveTo(42,-34);ctx.quadraticCurveTo(58,-88,91,-66);
      ctx.strokeStyle="#204e5d";ctx.lineWidth=38;ctx.stroke();
      ctx.strokeStyle="#4c8a82";ctx.lineWidth=29;ctx.stroke();
      line(62,-66,74,-77,"#98bca1",3);
      poly([[66,-71],[74,-88],[102,-93],[119,-85],[125,-71],[149,-65],
        [151,-51],[134,-42],[102,-45],[77,-55]],"#204e5d");
      poly([[70,-70],[78,-85],[104,-89],[119,-80],[123,-67],[145,-62],
        [146,-53],[132,-47],[102,-49],[80,-57]],"#6ca392");
      poly([[75,-67],[90,-84],[118,-80],[129,-63],[109,-66]],"#417d7b");
      for(let i=0;i<3;i++)poly([[75+i*10,-78],[80+i*10,-95-i%2*4],[86+i*10,-79]],"#376d72");
      line(91,-83,107,-82,"#295b64",3);
      oval(101,-73,9,8,"#efc77f");oval(104,-73,3.8,6,"#263d49");oval(105,-76,2,2,"#fff6db");
      oval(137,-60,2.5,2.5,"#325b63");
      if(mouth){
        oval(129,-42,23,20,"#244955");
        poly([[110,-36],[126,-40],[150,-35],[145,-23],[128,-22],[114,-27]],"#69988b");
        for(let i=0;i<3;i++)poly([[121+i*9,-49],[128+i*9,-48],[125+i*9,-41]],"#e8ddbc");
        oval(133,-30,12,4,"#af8980");
      }else{line(119,-49,142,-46,"#28535d",3);line(142,-46,147,-51,"#28535d",2);}
      ctx.restore();
      if(b.mode!=="leap"){ctx.save();ctx.globalAlpha=1-sink;line(b.x-125,b.y+14,b.x-45,b.y+18,"#bfe9d3bb",3);line(b.x+43,b.y+19,b.x+135,b.y+13,"#bfe9d3aa",3);ctx.restore();}
      if(sink>0&&lake.phaseTime<4)for(let i=0;i<9;i++){const age=(lake.phaseTime*.45+i*.13)%1;oval(b.x+Math.sin(i*3)*105,b.y+21-age*48,3+age*3,2+age*2,"#c2ede69c");}
    }
    function visibleRocks(){
      const rocks=lake.rocks.slice(),ids=new Set(rocks.map(s=>s.id));
      if(guest())for(const a of pendingShots){const id=lake.run+"-guest-"+a.seq;
        if(!ids.has(id)&&lake.clock-a.at<FLIGHT+.6)rocks.push({id,team:"guest",fromX:a.fromX,fromY:a.fromY,x:a.x,y:a.y,born:a.at,flight:FLIGHT,hit:false});}
      return rocks;
    }
    function marks(){
      for(const s of visibleRocks()){
        const t=(lake.clock-s.born)/s.flight;if(t>=1||t<0)continue;
        oval(s.x,s.y+9,s.team==="enemy"?44:24,s.team==="enemy"?23:11,s.team==="enemy"?"#e2a19a3d":"#d6ead92d");
        ctx.strokeStyle=s.team==="enemy"?"#ffd1b0":"#d0eee17a";ctx.lineWidth=2;ctx.beginPath();
        ctx.ellipse(s.x,s.y+9,s.team==="enemy"?44:24,s.team==="enemy"?23:11,0,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-t));ctx.stroke();
      }
      const b=lake.fish;
      if(lake.phase==="boss"&&(b.mode==="warning"||b.mode==="leap")){
        const pulse=Math.sin(gameClock*11)*4;oval(b.targetX,b.targetY+7,110+pulse,45+pulse*.4,"#163f6355");
        ctx.strokeStyle="#ffdda1";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(b.targetX,b.targetY+7,110,45,0,0,Math.PI*2);ctx.stroke();
        for(let i=0;i<3;i++)oval(b.targetX-35+i*36,b.targetY-2-Math.sin(gameClock*8+i)*5,5,3,"#bde7d4");
        text("MOVE!",b.targetX,b.targetY+14,17,"#ffe3a7");
      }
    }
    function drawRocks(){
      for(const s of visibleRocks()){
        const t=(lake.clock-s.born)/s.flight;if(t<0)continue;
        if(t<1){const x=lerp(s.fromX,s.x,t),y=lerp(s.fromY-48,s.y-6,t)-Math.sin(t*Math.PI)*116;stone(x,y,9);}
        else{const age=(lake.clock-s.born-s.flight)/.8;ctx.save();ctx.globalAlpha=Math.max(0,1-age);
          oval(s.x,s.y+12,16+age*42,7+age*17,"#c9eee182");
          for(let i=0;i<5;i++)line(s.x+(i-2)*age*20,s.y+5,s.x+(i-2)*age*26,s.y+5-Math.sin(Math.min(1,age)*Math.PI)*(24+i%2*15),"#d1f0df",3);
          ctx.restore();}
      }
    }
    function playerBoat(p){
      if(p.dead||p.ghost||p.lives<=0)return;
      const status=p.lakeStatus||{},capture=status.swallow;
      if(capture){const t=clamp((lake.clock-capture.at)/.8,0,1);
        const b=lake.fish,toX=b?b.x+b.face*100:capture.toX,toY=b?b.y-16:capture.toY;
        boat({...p,x:lerp(capture.x,toX,t),y:lerp(capture.y,toY,t)},false,1-t*.9,1-t);return;}
      const alpha=p.role===role()&&hitFlash>0&&Math.floor(gameClock*18)%2===0?.5:1;boat(p,false,1,alpha);
    }
    draw=function(){
      if(!active())return old.draw();
      ctx.save();background();marks();
      const actors=state.enemies.map(b=>({y:b.y,draw:()=>boat(b,true)}));
      for(const b of lake.sinking)actors.push({y:b.y,draw:()=>{const t=clamp((lake.clock-b.born)/2.2,0,1);boat({...b,y:b.y+t*30},true,1-t*.35,1-t);}});
      for(const p of players(true))actors.push({y:p.lakeStatus?.swallow?(lake.fish?.y||p.y)+80:p.y,draw:()=>playerBoat(p)});
      if(lake.fish)actors.push({y:lake.fish.y+(lake.fish.mode==="leap"?60:0),draw:drawFish});
      actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());drawRocks();ctx.restore();
      box(312,17,336,57,"#1c455cdc");box(312,17,336,3,"#e5daa0");
      text(lake.fish?"ANCIENT LAKE CREATURE":"LAKE CATAPULTS",480,42,21);
      if(lake.fish){for(let i=0;i<FISH_HP;i++)box(367+i*19,55,14,9,i<lake.fish.hits?"#f5ce8a":"#7fa3a6");}
      else text("SINK ALL "+TOTAL_BOATS+" ENEMY BOATS",480,64,12,"#d9eacb");
      if(lake.phase==="battle"&&lake.clock<9)text(lake.clock<5?"B: LAUNCH ROCK   •   3 SHOTS, THEN RELOAD 5s":
        "FACE YOUR TARGET   •   A + DIRECTION: QUICK ROW",480,102,17,"#fff0b6");
      if(lake.phase==="arrival")text("SOMETHING ANCIENT IS BENEATH THE BOATS...",480,103,19,"#fff0b6");
      if(lake.phase==="boss")text(lake.fish.mode==="swim"?"ATTACK WHILE IT SWIMS!  "+Math.ceil(lake.fish.timer)+"s":
        "WATCH THE RING — IT'S ABOUT TO LEAP!",480,102,18,"#fff0b6");
      if(lake.phase==="won"&&lake.phaseTime>2.5){box(264,104,432,75,"#1d455dde");text("THE LAKE IS CLEAR!",480,139,26);text("LAKE CREATURE DEFEATED",480,164,15,"#cee9d1");}
      box(14,50,186,25,"#1c455ccc");text("BOAT "+(ghost()?0:hull)+" / 3",107,68,15,"#d7edcf");
      if(fighting()&&!ghost()){box(331,H-37,298,29,"#1c455cd9");text(swallow?"SWALLOWED!":ammo>0?"B: ROCKS  "+ammo+" / 3":
        "RELOADING  "+Math.max(0,Math.ceil(reloadAt-lake.clock))+"s",480,H-17,16,"#ffe6a9");}
    };
  }
  window.__uvzuInstallLake=function(code){
    function once(before,after){if(code.split(before).length!==2)throw new Error("Lake hook missing: "+before.slice(0,90));code=code.replace(before,()=>after);}
    // Skip the base game's timed battle logic only for this level.
    once('      window.__uvzuCurrentLevelCode !== "TOMB1"\n    ) {\n      state.time += dt;',
      '      !["TOMB1", "LAKE9"].includes(window.__uvzuCurrentLevelCode)\n    ) {\n      state.time += dt;');
    const movement='(["LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))';
    if(code.split(movement).length!==6)throw new Error("Lake movement hooks missing");
    code=code.split(movement).join('(["LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))');
    const ending='!["LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)';
    if(code.split(ending).length!==3)throw new Error("Lake ending hooks missing");
    code=code.split(ending).join('!["LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)');
    once('window.__uvzuLevelTheme = nextCode === "LAVA8" ? "volcano" :','window.__uvzuLevelTheme = nextCode === "LAKE9" ? "lake" : nextCode === "LAVA8" ? "volcano" :');
    once('  requestAnimationFrame(loop);\n})();','('+lakeRuntime.toString()+')();\n  requestAnimationFrame(loop);\n})();');
    return code;
  };
})();
