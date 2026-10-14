// TOY11 v2 — Clockwork Toybox. Load after halloween-level.js, before game.js.
(() => {
  function toyRuntime() {
    const LEVEL="TOY11", DURATION=60, STEP_INTERVAL=5, ROUNDS=3;
    const MUSIC_URL="./clockwork-toybox.mp3?v=1";
    const POWER_SECONDS={fire:12,laser:RAY_TIME,jet:12};
    const SETTINGS={
      Easy:{cap:5,spawn:2.45,zombie:67,boss:69,warn:1.15,limb:3,head:5,rest:3.6},
      Normal:{cap:6,spawn:2.15,zombie:78,boss:79,warn:1.03,limb:4,head:6,rest:3.2},
      Hard:{cap:7,spawn:1.9,zombie:88,boss:88,warn:.94,limb:5,head:7,rest:2.9}
    };
    const active=()=>window.__uvzuCurrentLevelCode===LEVEL;
    const host=()=>!!window.__uvzuIsMultiplayerHost?.(),guest=()=>!!window.__uvzuIsMultiplayerGuest?.();
    const role=()=>guest()?"guest":"host",ghost=()=>player.lives<=0||!!window.__uvzuIsLocalGhost?.();
    const tune=()=>SETTINGS[window.__uvzuCurrentDifficultyName]||SETTINGS.Easy;
    const list=x=>Array.isArray(x)?x.filter(Boolean):Object.values(x||{}),copy=x=>JSON.parse(JSON.stringify(x));
    const old={fullRestart,safeLifeReset,loseLife,update,spawnEnemy,updateEnemies,updateShots,killEnemy,
      updateEnding,startFinalWave,headbutt,handleAAction,playerShoot,currentDirection,updateDodgeMovement,
      draw,drawBackground,updateHud,startMusic};
    const session=()=>{const r=window.__uvzuTombTravelNetwork?.room?.()||{};return[r.createdAt||0,r.nextLevelAt||0,r.ghostResetAt||0].join(":");};
    const crew=()=>({loss:0,seq:0,headAt:0,shotAt:0,power:"",until:0,gunUntil:0,missiles:0});
    const newBoss=()=>({x:480,y:406,stage:0,mode:"statue",timer:0,steps:0,attack:0,targetRole:"host",
      aimX:440,aimY:480,fromX:440,fromY:406,foot:0,flash:0,slowedUntil:0,
      angle:0,vx:0,vy:0,bites:0,hand:0,guard:0,locked:false,
      parts:{leftLeg:tune().limb,rightLeg:tune().limb,leftArm:tune().limb,rightArm:tune().limb,head:tune().head},
      partFlash:{},partNext:{},debris:[]});
    let serial=0,seq=0,loss=0,lastPacket=0,hasSnapshot=false,nextSent=false,sceneryCanvas=null;
    let pending=[],grab=null,graceUntil=0,localShotAt=0,notice="",noticeUntil=0,wasFlying=false,aisleSide=0,lastMouth=null;
    const seenHazards=new Set(),seenKills=new Set(),seenSecrets=new Set();
    const hiddenItems=()=>[
      {id:"rocket",kind:"jet",x:56,y:274,claimed:{host:false,guest:false}},
      {id:"fire-engine",kind:"fire",x:904,y:274,claimed:{host:false,guest:false}}
    ];
    const fresh=()=>({level:LEVEL,session:session(),run:Date.now()+"-"+(++serial),phase:"battle",phaseTime:0,
      clock:0,battleTime:0,nextStep:STEP_INTERVAL,spawnTimer:1.1,spawned:0,defeated:0,event:0,
      enemies:[],shots:[],strikes:[],secrets:hiddenItems(),kills:[],bursts:[],boss:newBoss(),crews:{host:crew(),guest:crew()},finished:false});
    let toy=fresh(),music=null,musicPending=false,musicBlocked=false,pageHidden=false;
    const fighting=()=>["battle","arrival","boss"].includes(toy.phase);
    const push=()=>{if(host())window.__uvzuMultiplayerPushEnemyState?.(state.enemies,true);};
    window.__uvzuGetToyState=()=>active()?{...toy,enemies:state.enemies}:null;
    window.__uvzuGetToyStatus=()=>active()?{level:LEVEL,run:toy.run,loss,actions:pending,grab:grab?grab.id:null}:null;
    // Only the two narrow side aisles reach behind the main shop floor.
    function floorMin(p){
      if(p.y<332&&p.x>94&&p.x<866&&aisleSide)p.x=aisleSide<0?94:866;
      const side=p.x<=94?-1:p.x>=866?1:0;aisleSide=p.y<332?side:0;
      return side?266:332;
    }
    window.__uvzuToyFloor=floorMin;
    const say=(message,seconds=2.2)=>{notice=message;noticeUntil=toy.clock+seconds;};
    function players(all=false){
      const result=[{...player,role:role(),dead:ghost(),toyStatus:window.__uvzuGetToyStatus()}];
      const p=window.__uvzuGetRemotePlayer?.();
      if((host()||guest())&&p?.toyStatus?.run===toy.run&&Number.isFinite(p.x)&&Number.isFinite(p.y))
        result.push({...p,role:guest()?"host":"guest",dead:!!p.dead||!!p.ghost||p.lives<=0});
      return all?result:result.filter(p=>!p.dead);
    }
    const nearest=(x,y)=>players().sort((a,b)=>distance(a.x,a.y,x,y)-distance(b.x,b.y,x,y))[0];
    const powerFor=who=>{const c=toy.crews[who];return c?.until>toy.clock?c.power:c?.gunUntil>toy.clock?"laser":"";};
    const powerEnd=who=>powerFor(who)==="laser"?toy.crews[who].gunUntil:toy.crews[who].until;
    const flying=p=>!p.dead&&powerFor(p.role)==="jet"&&!p.toyStatus?.grab;
    function stopMusic(reset=false){
      if(!music)return;if(!music.paused||musicPending)music.pause();
      if(reset&&music.currentTime!==0){try{music.currentTime=0;}catch(_){}}
    }
    const wantsMusic=()=>active()&&gameStarted&&!paused&&!document.hidden&&!pageHidden&&toy.phase!=="lost";
    function syncMusic(retry=false){
      if(!wantsMusic()){stopMusic(!active());return;}
      window.__uvzuStopMainMusic?.();window.stopTombMusic?.();
      if(!music){music=new Audio(MUSIC_URL);music.loop=true;music.volume=.43;music.preload="auto";}
      if(music.paused===false||musicPending||musicBlocked&&!retry)return;
      musicPending=true;musicBlocked=false;
      try{Promise.resolve(music.play()).then(()=>{musicPending=false;if(!wantsMusic())stopMusic(!active());},
        ()=>{musicPending=false;musicBlocked=true;});}catch(_){musicPending=false;musicBlocked=true;}
    }
    startMusic=function(){if(active())syncMusic(true);else{stopMusic(true);old.startMusic();}};
    window.__uvzuStartMainMusic=startMusic;
    const priorMusic=window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic=function(){priorMusic?.();syncMusic(true);};
    const priorStart=window.__uvzuStartGame;
    window.__uvzuStartGame=function(...args){const r=priorStart(...args);syncMusic(true);return r;};
    const priorPause=window.__uvzuSetPaused;
    window.__uvzuSetPaused=function(value){priorPause(value);syncMusic(true);};
    for(const event of ["pointerdown","keydown"])window.addEventListener(event,()=>syncMusic(true));
    document.addEventListener?.("visibilitychange",()=>syncMusic(true));
    window.addEventListener("pagehide",()=>{pageHidden=true;stopMusic();});
    window.addEventListener("pageshow",()=>{pageHidden=false;syncMusic(true);});
    function resetPosition(){
      resetPlayerPosition();player.x=guest()?325:175;player.y=465;
      player.webbedTimer=player.webFlash=player.headTimer=player.dodgeTimer=0;
      player.webTrapX=player.webTrapY=null;player.ray=0;grab=null;wasFlying=false;aisleSide=0;lastMouth=null;
      player.actionLock=.2;localShotAt=0;graceUntil=toy.clock+1.2;
    }
    function initialize(){
      stopMusic(true);window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();
      if(host()||guest())player.lives=window.__uvzuTesterLifeBudget?.(5)??5;
      toy=fresh();state.enemies=toy.enemies;state.mode="play";state.time=0;
      seq=loss=lastPacket=0;pending=[];hasSnapshot=false;nextSent=false;noticeUntil=0;
      seenHazards.clear();seenKills.clear();seenSecrets.clear();resetPosition();
      window.__uvzuLevelTheme="toystore";updateHud();syncMusic(true);push();
    }
    fullRestart=function(){
      if(!active()){nextSent=false;stopMusic(true);return old.fullRestart();}
      if(guest()&&hasSnapshot&&toy.session===session()){window.__uvzuRequestEnemyKill?.("toy-retry-"+toy.run);return;}
      initialize();
    };
    safeLifeReset=function(){
      if(!active())return old.safeLifeReset();
      state.resetQueued=false;state.playerShots.length=state.enemyShots.length=0;resetPosition();
      const points=[{x:105,y:368},{x:240,y:495},{x:805,y:485},{x:875,y:362}];
      const b=toy.boss,p=points.sort((a,c)=>distance(c.x,c.y,b.aimX,b.aimY)-distance(a.x,a.y,b.aimX,b.aimY))[0];
      player.x=p.x;player.y=p.y;state.mode=toy.phase==="battle"?"play":"final";
    };
    loseLife=function(){
      if(!active())return old.loseLife();const before=player.lives;old.loseLife();
      if(player.lives>=before)return;loss++;pending=[];grab=null;player.ray=0;
      if(!guest())Object.assign(toy.crews[role()],crew(),{loss,seq});
      if(!ghost()&&(host()||guest()))safeLifeReset();
      if(!host()&&!guest()&&player.lives<=0){toy.phase="lost";stopMusic();}
      window.__uvzuMultiplayerPush?.(player);push();
    };
    function hurt(crush=false){
      if(ghost()||!fighting()||state.resetQueued||toy.clock<graceUntil||player.invuln>0||player.dodgeTimer>0)return false;
      if(shieldBlockContact())return false;
      player.headbuttStreak=0;player.regenTimer=HEALTH_REGEN_TIME;addParticles(player.x,player.y-20,"red");
      player.hp-=crush?HP_MAX:1;
      if(player.hp<=0){player.invuln=0;loseLife();return false;}else player.invuln=.65;
      return true;
    }
    function rewardEffects(){
      for(const k of toy.kills){
        if(seenKills.has(k.id))continue;seenKills.add(k.id);
        if(toy.clock-k.born<.7)addParticles(k.x,k.y-25,k.method==="fire"?"rainbow":"red");
        if(k.who!==role())continue;state.score+=k.type==="ray"?35:10;
        if(k.method==="head"){player.headbuttStreak++;awardShieldIfReady();}else player.headbuttStreak=0;
      }
      for(const s of toy.secrets){
        if(!s.claimed[role()]||seenSecrets.has(s.id))continue;seenSecrets.add(s.id);state.score+=50;
        say(s.kind==="fire"?"SECRET FLAMETHROWER! HOLD B — 12 SECONDS":"SECRET JETPACK! HOLD B — 6 HOMING MISSILES",3);
      }
    }
    function defeat(i,who,method="head"){
      const e=state.enemies.splice(i,1)[0];if(!e)return;
      toy.defeated++;toy.kills.push({id:e.id,who,method,type:e.type,x:e.x,y:e.y,born:toy.clock});
      // Match the usual gun-zombie reward: the player who earns the kill gets it.
      if(e.type==="ray"&&toy.crews[who])toy.crews[who].gunUntil=toy.clock+RAY_TIME;
      rewardEffects();push();
    }
    function damageEnemy(e,who,method,amount=1){
      const i=state.enemies.findIndex(x=>x.id===e?.id);if(i<0)return;
      e.hp-=amount;e.flash=.2;if(e.hp<=0)defeat(i,who,method);else push();
    }
    function spawn(){
      if(guest()||toy.phase!=="battle"||toy.battleTime>=DURATION||state.enemies.length>=tune().cap)return false;
      const n=toy.spawned++,right=n%2===1;
      state.enemies.push({id:"toy-z-"+toy.run+"-"+n,x:right?W+35:-35,y:[384,485,445,355][n%4],
        w:54,h:34,type:n%7===4?"ray":"normal",hp:1,face:right?-1:1,sep:1,shootTimer:3.1,warning:0,
        aimX:0,aimY:0,vx:0,vy:0,flash:0});return true;
    }
    function collectSecrets(){
      for(const s of toy.secrets)for(const p of players()){
        if(s.claimed[p.role]||p.toyStatus?.grab||Math.abs(p.x-s.x)>22||Math.abs(p.y-s.y)>19)continue;
        s.claimed[p.role]=true;const c=toy.crews[p.role];
        c.power=s.kind;c.until=toy.clock+POWER_SECONDS[s.kind];c.missiles=s.kind==="jet"?6:0;
        rewardEffects();push();
      }
    }
    function tickEnemies(dt){
      for(const e of state.enemies){
        const p=nearest(e.x,e.y);if(!p)continue;e.flash=Math.max(0,e.flash-dt);
        const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;e.face=dx>=0?1:-1;
        const range=e.type==="ray"?210:42;
        if(d>range||Math.abs(dy)>32){e.vx=dx/d*tune().zombie;e.vy=dy/d*tune().zombie*.76;
          e.x+=e.vx*dt;e.y=clamp(e.y+e.vy*dt,338,508);}else e.vx=e.vy=0;
        for(const other of state.enemies){if(other===e)continue;const sx=e.x-other.x,sy=e.y-other.y,gap=Math.hypot(sx,sy);
          if(gap>0&&gap<43){e.x+=sx/gap*11*dt;e.y+=sy/gap*11*dt;}}
        if(e.type!=="ray")continue;
        if(e.warning>0){e.warning-=dt;if(e.warning<=0){
          const sx=e.x+e.face*34,sy=e.y-32,dx=e.aimX-sx,dy=e.aimY-sy,d=Math.hypot(dx,dy)||1;
          const blocked=state.enemies.some(o=>{if(o===e)return false;const ox=o.x-sx,oy=o.y-29-sy,t=(ox*dx+oy*dy)/(d*d);
            return t>.02&&t<.95&&Math.hypot(ox-t*dx,oy-t*dy)<30;});
          if(!blocked)toy.shots.push({id:toy.run+"-s-"+(++toy.event),kind:"enemy",who:"enemy",x:sx,y:sy,
            vx:dx/d*240,vy:dy/d*240,life:3.6,target:""});
          e.shootTimer=3.9;push();}
        }else if((e.shootTimer-=dt)<=0){e.warning=.7;e.aimX=p.x;e.aimY=p.y-29-(flying(p)?45:0);}
      }
    }
    function aimTarget(b){
      const live=players().sort((a,c)=>a.role.localeCompare(c.role));
      return live.find(p=>p.role===b.targetRole)||live[0];
    }
    function chooseTarget(b){
      const live=players().sort((a,c)=>a.role.localeCompare(c.role));b.targetRole=live[b.attack%Math.max(1,live.length)]?.role||"host";
    }
    function mode(name,seconds){toy.boss.mode=name;toy.boss.timer=seconds;toy.boss.vx=toy.boss.vy=0;push();}
    const inOval=(p,x,y,rx,ry)=>Math.hypot((p.x-x)/rx,(p.y-y)/ry)<1;
    function strikeAt(kind,x,y,rx,ry,fromX=x,fromY=y,part=""){
      const s={id:toy.run+"-crush-"+(++toy.event),kind,x,y,rx,ry,fromX,fromY,part,born:toy.clock};
      toy.strikes.push(s);
      for(let i=state.enemies.length-1;i>=0;i--)if(inOval(state.enemies[i],x,y,rx+19,ry+13))defeat(i,"statue","stomp");
      push();return s;
    }
    function stationaryStep(){
      const b=toy.boss;b.foot=1-b.foot;b.fromX=b.x+(b.foot?43:-43);b.fromY=b.y;
      b.aimX=b.fromX;b.aimY=484;mode("stepWarn",.95);
    }
    function wakeBoss(){
      if(toy.phase!=="battle"||toy.battleTime<DURATION||state.enemies.length)return;
      toy.phase="arrival";toy.phaseTime=0;toy.shots=[];toy.strikes=[];
      mode("wake",2.3);state.mode="final";say("THE NUTCRACKER IS WAKING UP!",2.3);
    }
    const limbKey=(part,side)=>(side<0?"left":"right")+part;
    function groundPoint(along,across=0){const b=toy.boss,c=Math.cos(b.angle),s=Math.sin(b.angle);
      return{x:b.x+c*along-s*across,y:b.y+(s*along+c*across)*.5};}
    const mouthPoint=()=>groundPoint(112,0);
    function bossParts(){
      const b=toy.boss,parts=[];
      if(b.stage===0){for(const side of[-1,1]){const key=limbKey("Leg",side);if(b.parts[key]>0)parts.push({key,...footPose(side),r:30});}}
      else if(b.stage===1){for(const side of[-1,1]){const key=limbKey("Arm",side);if(b.parts[key]>0)parts.push({key,...fistPose(side),r:29});}}
      else if(b.stage===2&&b.parts.head>0)parts.push({key:"head",...mouthPoint(),r:34});
      return parts;
    }
    function damagePart(key,who,method,amount=1){
      const b=toy.boss;
      if(toy.phase!=="boss"||b.parts[key]<=0||["kneel","shedArms"].includes(b.mode))return false;
      const eligible=b.stage===0&&key.endsWith("Leg")||b.stage===1&&key.endsWith("Arm")||b.stage===2&&key==="head"&&b.mode==="exhausted";
      if(!eligible){b.guard=.25;return false;}
      if((b.partNext[key]||0)>toy.clock)return false;
      const p=bossParts().find(p=>p.key===key)||{x:b.x,y:b.y};
      b.partNext[key]=toy.clock+.28;b.partFlash[key]=toy.clock+.18;b.flash=.2;
      b.parts[key]=Math.max(0,b.parts[key]-amount);
      toy.bursts.push({x:p.x,y:p.y-24,born:toy.clock,kind:"spark"});
      if(who===role())state.score+=20;
      if(b.parts[key]===0){
        b.debris.push({key,x:p.x,y:p.y,born:toy.clock,side:key.startsWith("left")?-1:1});
        if(key.endsWith("Leg")&&b.parts.leftLeg+b.parts.rightLeg===0){
          b.stage=1;b.angle=player.x<b.x?Math.PI:0;mode("kneel",1.65);
          say("LEGS BROKEN! WATCH THE HANDS — BREAK BOTH ARMS!",3.3);
        }else if(key.endsWith("Arm")&&b.parts.leftArm+b.parts.rightArm===0){
          b.stage=2;grab=null;mode("shedArms",1.15);
          say("ARMS BROKEN! DODGE THREE CHOMPS, THEN HIT HIS HEAD!",3.3);
        }else if(key==="head"){
          b.stage=ROUNDS;toy.phase="won";toy.phaseTime=0;toy.shots=[];toy.strikes=[];grab=null;
          state.mode="toyScene";mode("collapse",4);if(who===role())state.score+=300;
        }else say(key.endsWith("Leg")?"ONE LEG DOWN — BREAK THE OTHER!":"ONE ARM DOWN — KEEP AWAY FROM THE OTHER!",2);
      }
      push();return true;
    }
    function hitBossNear(x,y,who,method,amount=1,reach=47){
      const part=bossParts().filter(p=>Math.abs(p.x-x)<reach+p.r*.3&&Math.abs(p.y-y)<43)
        .sort((a,b)=>distance(a.x,a.y,x,y)-distance(b.x,b.y,x,y))[0];
      return part?damagePart(part.key,who,method,amount):false;
    }
    function beginWalk(){const b=toy.boss;b.steps=0;chooseTarget(b);mode("walk",1.6);}
    function warnStomp(){
      const b=toy.boss;b.foot=1-b.foot;
      if(!b.parts[b.foot?"rightLeg":"leftLeg"])b.foot=1-b.foot;
      b.attack++;chooseTarget(b);b.locked=false;
      b.fromX=b.x+(b.foot?43:-43);b.fromY=b.y;b.aimX=b.fromX;b.aimY=b.y+50;
      mode("stompWarn",tune().warn);
    }
    function aimStomp(b){
      const p=aimTarget(b);if(!p)return;
      b.aimX=clamp(p.x,b.x-112,b.x+112);b.aimY=clamp(p.y,351,499);
    }
    function turnToward(x,y,dt){
      const b=toy.boss,angle=Math.atan2((y-b.y)*2,x-b.x);
      const diff=Math.atan2(Math.sin(angle-b.angle),Math.cos(angle-b.angle));
      b.angle+=clamp(diff,-dt*2.4,dt*2.4);
    }
    function moveProne(dt,speed){
      const b=toy.boss,x=b.x,y=b.y;
      b.x=clamp(b.x+Math.cos(b.angle)*speed*dt,205,755);
      b.y=clamp(b.y+Math.sin(b.angle)*speed*dt*.5,386,436);
      b.vx=dt>0?(b.x-x)/dt:0;b.vy=dt>0?(b.y-y)/dt:0;
    }
    function beginSlither(){const b=toy.boss;chooseTarget(b);mode("slither",b.stage===1?1.7:1.45);}
    function aimGrab(b){
      const p=aimTarget(b);if(!p)return;
      const shoulder=groundPoint(24,b.hand*42),dx=p.x-shoulder.x,dy=p.y-shoulder.y,d=Math.hypot(dx,dy)||1;
      b.aimX=clamp(shoulder.x+dx/d*Math.min(d,180),45,915);b.aimY=clamp(shoulder.y+dy/d*Math.min(d,180),332,503);
    }
    function warnGrab(){
      const b=toy.boss;b.attack++;chooseTarget(b);const p=aimTarget(b)||{x:b.x,y:b.y};
      const hands=[-1,1].filter(s=>b.parts[limbKey("Arm",s)]>0)
        .sort((a,c)=>{const u=groundPoint(24,a*100),v=groundPoint(24,c*100);return distance(u.x,u.y,p.x,p.y)-distance(v.x,v.y,p.x,p.y);});
      b.hand=hands[0]||1;const from=groundPoint(24,b.hand*100);b.fromX=from.x;b.fromY=from.y;b.locked=false;
      mode("grabWarn",tune().warn+.04);aimGrab(b);
    }
    function warnChomp(){
      const b=toy.boss;b.attack++;chooseTarget(b);b.locked=false;const p=aimTarget(b)||{x:b.x+100,y:b.y};
      b.aimX=p.x;b.aimY=p.y;mode("chompWarn",tune().warn);
    }
    function bossTick(dt){
      const b=toy.boss;b.timer-=dt;b.flash=Math.max(0,b.flash-dt);b.guard=Math.max(0,b.guard-dt);
      if(toy.phase==="battle"){
        if(b.mode==="statue"&&toy.battleTime>=toy.nextStep-.95)stationaryStep();
        else if(b.mode==="stepWarn"&&b.timer<=0){
          strikeAt("step",b.aimX,(b.fromY+b.aimY)/2,39,Math.abs(b.aimY-b.fromY)/2+29,b.fromX,b.fromY);
          mode("stepDown",.42);toy.nextStep+=STEP_INTERVAL;
        }else if(b.mode==="stepDown"&&b.timer<=0)mode("stepBack",.6);
        else if(b.mode==="stepBack"&&b.timer<=0)mode("statue",0);
        return;
      }
      if(b.mode==="wake"&&b.timer<=0){toy.phase="boss";toy.phaseTime=0;beginWalk();say("BREAK BOTH LEGS — STAY CLEAR OF HIS STEPS!",3);return;}
      if(b.mode==="walk"){
        const p=aimTarget(b)||nearest(b.x,b.y);if(p){
          const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy)||1,speed=tune().boss*(b.parts.leftLeg&&b.parts.rightLeg?1:.8);
          if(d>82){b.x=clamp(b.x+dx/d*speed*dt,235,725);b.y=clamp(b.y+dy/d*speed*dt*.55,374,463);}
        }
        if(b.timer<=0)warnStomp();return;
      }
      if(b.mode==="stompWarn"){
        if(!b.locked){aimStomp(b);if(b.timer<=.42){b.locked=true;push();}}
        if(!b.parts[b.foot?"rightLeg":"leftLeg"]){mode("legRest",.7);return;}
        if(b.timer<=0){strikeAt("stomp",b.aimX,b.aimY,44,33);b.steps++;mode("stompDown",.38);}return;
      }
      if(b.mode==="stompDown"&&b.timer<=0){
        if(b.steps>=3)mode("legRest",1.3);else{chooseTarget(b);mode("walk",1.3);}return;
      }
      if(b.mode==="legRest"&&b.timer<=0){beginWalk();return;}
      if((b.mode==="kneel"||b.mode==="shedArms")&&b.timer<=0){b.bites=0;b.x=clamp(b.x,205,755);b.y=clamp(b.y,386,436);beginSlither();return;}
      if(b.mode==="slither"){
        const p=aimTarget(b);if(p){turnToward(p.x,p.y,dt);if(distance(p.x,p.y,b.x,b.y)>110)moveProne(dt,tune().boss+(b.stage===1?24:48));else b.vx=b.vy=0;}
        if(b.timer<=0){if(b.stage===1)warnGrab();else warnChomp();}return;
      }
      if(["grabWarn","grabLunge","grabHold"].includes(b.mode)&&!b.parts[limbKey("Arm",b.hand)]){mode("armRest",.7);return;}
      if(b.mode==="grabWarn"){
        if(!b.locked){aimGrab(b);if(b.timer<=.42){b.locked=true;push();}}
        if(b.timer<=0)mode("grabLunge",.28);return;
      }
      if(b.mode==="grabLunge"&&b.timer<=0){
        strikeAt("grab",b.aimX,b.aimY,35,25,b.fromX,b.fromY,limbKey("Arm",b.hand));mode("grabHold",.85);return;
      }
      if(b.mode==="grabHold"&&b.timer<=0){mode("armRest",.85);return;}
      if(b.mode==="armRest"&&b.timer<=0){beginSlither();return;}
      if(b.mode==="chompWarn"){
        if(!b.locked){const p=aimTarget(b);if(p){b.aimX=p.x;b.aimY=p.y;}turnToward(b.aimX,b.aimY,dt*1.6);
          if(b.timer<=.42){b.locked=true;push();}}
        if(b.timer<=0){b.bites++;mode("chompRush",.64);}return;
      }
      if(b.mode==="chompRush"){
        moveProne(dt,310+tune().boss*.7);
        if(b.timer<=0){mode("biteRest",.46);}return;
      }
      if(b.mode==="biteRest"&&b.timer<=0){
        if(b.bites>=3){mode("exhausted",tune().rest);say("HE'S EXHAUSTED — ATTACK HIS HEAD!",tune().rest);}
        else warnChomp();return;
      }
      if(b.mode==="exhausted"&&b.timer<=0){b.bites=0;beginSlither();return;}
      if(b.mode==="collapse"&&b.timer<=0){mode("fallen",0);toy.finished=true;if(host())window.__uvzuSignalLevelCompleted?.();push();}
    }
    function accept(a,who,p){
      const c=toy.crews[who];if(!a||!p||!c||!Number.isFinite(a.seq)||a.seq<=c.seq)return;c.seq=a.seq;
      if(!fighting()||p.dead||a.loss!==c.loss||p.toyStatus?.loss!==a.loss||
        ![a.x,a.y,a.at].every(Number.isFinite)||Math.abs(toy.clock-a.at)>1.8||distance(p.x,p.y,a.x,a.y)>100)return;
      const b=toy.boss;
      if(p.toyStatus?.grab)return;
      if(a.kind==="head"){
        if(toy.clock<c.headAt)return;c.headAt=toy.clock+.24;
        const x=a.x+(a.face||p.face||1)*38;
        for(const e of [...state.enemies])if(Math.abs(e.x-x)<55&&Math.abs(e.y-a.y)<46)
          damageEnemy(e,who,"head");
        if(a.stage===b.stage)hitBossNear(x,a.y,who,"head");
        return;
      }
      if(a.kind!=="shoot"||toy.clock<c.shotAt)return;
      const power=powerFor(who);if(!power)return;
      if(power==="jet"&&c.missiles<=0)return;
      c.shotAt=toy.clock+(power==="fire"?.27:power==="jet"?.6:.27);
      const dir=p.face||1,sx=p.x+dir*51,sy=p.y-32-(flying(p)?45:0);
      if(power==="fire"){
        toy.bursts.push({id:toy.run+"-flame-"+(++toy.event),x:sx,y:sy,face:dir,born:toy.clock,kind:"fire"});
        for(const e of [...state.enemies]){const along=(e.x-sx)*dir;if(along>=-20&&along<190&&Math.abs(e.y-30-sy)<26+Math.max(0,along)*.12)damageEnemy(e,who,"fire",2);}
        const part=bossParts().filter(p=>{const along=(p.x-sx)*dir;return along>=-20&&along<190&&Math.abs(p.y-26-sy)<34+Math.max(0,along)*.12;})
          .sort((a,c)=>distance(a.x,a.y,sx,sy)-distance(c.x,c.y,sx,sy))[0];
        if(part&&a.stage===b.stage)damagePart(part.key,who,"fire");
      }else{
        const targets=state.enemies.filter(e=>power==="jet"||(e.x-p.x)*dir>-15)
          .sort((a,b)=>distance(a.x,a.y,p.x,p.y)-distance(b.x,b.y,p.x,p.y));
        const target=targets[0],part=toy.phase==="boss"?bossParts().filter(q=>power==="jet"||(q.x-p.x)*dir>-15)
          .sort((a,c)=>distance(a.x,a.y,p.x,p.y)-distance(c.x,c.y,p.x,p.y))[0]:null;
        const tx=target?.x??part?.x??(p.x+dir*550);
        const ty=(target?.y??part?.y??p.y)-27;
        const dx=tx-sx,dy=ty-sy,d=Math.hypot(dx,dy)||1,speed=power==="jet"?335:530;
        toy.shots.push({id:toy.run+"-shot-"+who+"-"+a.seq,kind:power==="jet"?"missile":"laser",who,
          x:sx,y:sy,vx:dx/d*speed,vy:dy/d*speed,life:2.8,target:target?.id||(part?"part:"+part.key:"")});
        if(power==="jet")c.missiles--;
      }
      push();
    }
    function act(kind){
      const a={seq:++seq,kind,loss,at:toy.clock,x:player.x,y:player.y,face:player.face,stage:toy.boss.stage};
      if(guest())pending.push(a);else accept(a,role(),{...player,role:role(),dead:ghost(),toyStatus:window.__uvzuGetToyStatus()});
      window.__uvzuMultiplayerPush?.(player);
    }
    currentDirection=function(){return active()&&grab?{dx:0,dy:0}:old.currentDirection();};
    updateDodgeMovement=function(dt){if(active()&&grab){player.dodgeTimer=0;return true;}return old.updateDodgeMovement(dt);};
    function holdGrab(){
      if(!grab)return;
      if(ghost()||!fighting()||toy.clock>=grab.until||!toy.boss.parts[grab.part]||toy.boss.stage!==1){
        grab=null;if(!ghost())player.invuln=Math.max(player.invuln,.65);return;
      }
      player.x=grab.x;player.y=grab.y;player.dodgeTimer=0;
    }
    handleAAction=function(){
      if(active()&&grab)return;return old.handleAAction();
    };
    headbutt=function(){
      if(!active())return old.headbutt();
      if(!fighting()||ghost()||grab||player.headCd>0||player.actionLock>0||player.dodgeTimer>0)return;
      player.headCd=.24;player.headTimer=.15;player.actionLock=.08;
      act("head");
    };
    playerShoot=function(){
      if(!active())return old.playerShoot();
      if(!fighting()||ghost()||grab||toy.clock<localShotAt)return;
      if(!powerFor(role()))return;
      localShotAt=toy.clock+(powerFor(role())==="jet"?.6:.27);act("shoot");
    };
    spawnEnemy=function(...a){if(!active())return old.spawnEnemy(...a);};
    updateEnemies=function(dt){if(!active())return old.updateEnemies(dt);};
    updateShots=function(dt){if(!active())return old.updateShots(dt);};
    startFinalWave=function(){if(!active())return old.startFinalWave();};
    updateEnding=function(dt){if(!active())return old.updateEnding(dt);};
    killEnemy=function(i,reason){if(!active())return old.killEnemy(i,reason);
      if(!guest()&&reason!=="remote")damageEnemy(state.enemies[i],role(),"head");};
    function tickShots(dt){
      for(const s of toy.shots){
        if(s.kind==="missile"){
          const e=state.enemies.find(e=>e.id===s.target),part=bossParts().find(p=>s.target==="part:"+p.key);
          if(e||part){
            const dx=(e?.x??part.x)-s.x;
            const dy=(e?.y??part.y)-27-s.y,d=Math.hypot(dx,dy)||1;
            const bend=1-Math.exp(-dt*5);s.vx=lerp(s.vx,dx/d*335,bend);s.vy=lerp(s.vy,dy/d*335,bend);
          }
        }
        s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
        if(s.kind==="enemy")continue;
        const e=state.enemies.find(e=>distance(s.x,s.y,e.x,e.y-27)<31);
        if(e){s.life=0;damageEnemy(e,s.who,s.kind,s.kind==="missile"?3:1);
          toy.bursts.push({x:s.x,y:s.y,born:toy.clock,kind:"spark"});continue;}
        const part=bossParts().find(p=>distance(s.x,s.y,p.x,p.y-27)<p.r);
        if(toy.phase==="boss"&&part){
          s.life=0;damagePart(part.key,s.who,s.kind,s.kind==="missile"?2:1);toy.bursts.push({x:s.x,y:s.y,born:toy.clock,kind:"spark"});
        }
      }
      toy.shots=toy.shots.filter(s=>s.life>0&&s.x>-60&&s.x<W+60&&s.y>45&&s.y<H+60);
    }
    function hazards(){
      if(!fighting()||ghost()||state.resetQueued)return;
      const air=flying({...player,role:role(),toyStatus:window.__uvzuGetToyStatus()});
      for(const s of toy.strikes){
        if(seenHazards.has(s.id))continue;seenHazards.add(s.id);
        // Each impact is consumed once; old markers cannot damage a late arrival.
        if(toy.clock-s.born>.7||air&&s.kind!=="grab")continue;
        if(inOval(player,s.x,s.y,s.rx+14,s.ry+10)){
          if(s.kind==="grab"){
            if(toy.boss.parts[s.part]>0&&hurt())grab={id:s.id,part:s.part,x:s.x,y:s.y,until:toy.clock+.85};
          }else hurt(true);
        }
      }
      const b=toy.boss,mouth=mouthPoint(),biteId=toy.run+"-bite-"+b.attack;
      if(b.mode==="chompRush"&&!air&&!seenHazards.has(biteId)){
        const from=lastMouth?.id===biteId?lastMouth:mouth,dx=mouth.x-from.x,dy=mouth.y-from.y;
        const t=clamp(((player.x-from.x)*dx+(player.y-from.y)*dy)/(dx*dx+dy*dy||1),0,1);
        if(inOval(player,from.x+dx*t,from.y+dy*t,46,30)){seenHazards.add(biteId);hurt(true);}
      }
      lastMouth={id:biteId,...mouth};
      for(const s of toy.shots)if(s.kind==="enemy"&&!seenHazards.has(s.id)&&distance(s.x,s.y,player.x,player.y-29-(air?45:0))<27){seenHazards.add(s.id);hurt();}
      if(!air&&toy.phase==="battle")for(const e of state.enemies)if(distance(e.x,e.y,player.x,player.y)<36){hurt();break;}
    }
    function guestActions(){
      if(!host())return;
      for(const p of players(true)){
        const c=toy.crews[p.role],s=p.toyStatus;
        if(s.loss!==c.loss)Object.assign(c,crew(),{loss:s.loss,seq:c.seq});
        if(p.role==="guest")for(const a of list(s.actions).sort((a,b)=>a.seq-b.seq))accept(a,"guest",p);
      }
    }
    function received(){
      if(!guest())return;
      const packet=window.__uvzuGetMultiplayerEnemyState?.(),data=packet?.toy;
      if(!data||data.level!==LEVEL||data.session!==session()||packet.updatedAt<=lastPacket)return;
      const reset=data.run!==toy.run;
      if(reset){window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();
        player.lives=window.__uvzuTesterLifeBudget?.(5)??5;loss=seq=0;pending=[];
        seenHazards.clear();seenKills.clear();seenSecrets.clear();}
      toy=copy(data);for(const k of ["enemies","shots","strikes","secrets","kills","bursts"])toy[k]=list(toy[k]);
      toy.boss.debris=list(toy.boss.debris);toy.boss.partFlash||={};toy.boss.partNext||={};toy.crews||={host:crew(),guest:crew()};
      state.enemies=toy.enemies;state.time=toy.battleTime;lastPacket=packet.updatedAt;hasSnapshot=true;
      pending=pending.filter(a=>a.seq>(toy.crews.guest?.seq||0));
      if(reset){resetPosition();syncMusic(true);}rewardEffects();
    }
    function retry(){
      if(!host())return false;const id="toy-retry-"+toy.run;
      if(!window.__uvzuGetGuestKillRequests?.()?.[id])return false;
      window.__uvzuClearGuestKillRequest?.(id);initialize();return true;
    }
    function continueIce(){
      if(window.__uvzuCurrentLevelCode!=="ICE10"||guest()||nextSent)return;
      const ice=window.__uvzuGetIceState?.();if(!ice?.finished||ice.phase!=="won"||ice.phaseTime<6)return;
      nextSent=true;if(host())window.__uvzuSignalNextLevel?.(LEVEL);
      else{window.__uvzuCurrentLevelCode=LEVEL;window.__uvzuLevelTheme="toystore";window.__uvzuUpdateLevelMusic?.();fullRestart();}
    }
    update=function(dt){
      if(!active()){stopMusic(true);old.update(dt);continueIce();return;}
      const travel=window.__uvzuGetNextLevelSignal?.(),reset=window.__uvzuGetGhostResetAt?.();
      if(travel?.at&&travel.at!==window.__uvzuLastAppliedNextLevelAt||reset&&reset!==window.__uvzuLastAppliedGhostResetAt){old.update(dt);return;}
      received();if(retry())return;guestActions();const run=toy.run;
      state.mode=fighting()?toy.phase==="battle"?"play":"final":"toyScene";
      old.update(dt);if(!active()||toy.run!==run)return;
      toy.clock+=dt;toy.phaseTime+=dt;state.time=toy.battleTime;
      if(!guest()){
        toy.enemies=state.enemies;
        if(toy.phase==="battle"){
          toy.battleTime+=dt;toy.spawnTimer-=dt;
          if(toy.spawnTimer<=0&&spawn())toy.spawnTimer=tune().spawn;
          tickEnemies(dt);
        }
        if(fighting()){tickShots(dt);collectSecrets();}
        if(toy.phase!=="lost")bossTick(dt);
        wakeBoss();
        toy.strikes=toy.strikes.filter(s=>toy.clock-s.born<1);
        toy.bursts=toy.bursts.filter(s=>toy.clock-s.born<.45);
      }else{
        state.enemies=toy.enemies;
        for(const e of state.enemies){e.x+=(e.vx||0)*dt;e.y+=(e.vy||0)*dt;}
        for(const s of toy.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;}
        const b=toy.boss;if(b.stage>0&&b.mode!=="kneel"){b.x=clamp(b.x+(b.vx||0)*dt,205,755);b.y=clamp(b.y+(b.vy||0)*dt,386,436);}
      }
      player.x=clamp(player.x,35,W-35);player.y=clamp(player.y,floorMin(player),510);
      holdGrab();hazards();
      const air=flying({...player,role:role(),toyStatus:window.__uvzuGetToyStatus()});
      if(wasFlying&&!air&&!ghost())player.invuln=Math.max(player.invuln,.45);wasFlying=air;
      player.ray=powerFor(role())==="laser"?Math.max(0,powerEnd(role())-toy.clock):0;
      rewardEffects();updateHud();syncMusic();
    };
    updateHud=function(){
      old.updateHud();if(!active())return;
      if(timeEl)timeEl.textContent=toy.phase==="battle"?toy.battleTime<DURATION?"Time: "+Math.ceil(DURATION-toy.battleTime)+"s":"Clear the remaining zombies":
        toy.phase==="won"?"Toy store saved!":"Nutcracker: "+Math.min(3,toy.boss.stage+1)+" / 3";
      const c=toy.crews[role()],power=powerFor(role());
      if(powerLabelEl)powerLabelEl.textContent=grab?"CAUGHT! HE'LL LET GO IN A MOMENT":
        power==="jet"?"JETPACK: "+Math.ceil(powerEnd(role())-toy.clock)+"s · B: "+c.missiles+" missiles":
        power?(power==="fire"?"B: FLAMETHROWER ":"B: LASER ")+Math.ceil(powerEnd(role())-toy.clock)+"s":"A: ATTACK / DODGE · DEFEAT GUN ZOMBIES TO TAKE THEIR GUN";
      if(powerFillEl)powerFillEl.style.width=(power?clamp((powerEnd(role())-toy.clock)/POWER_SECONDS[power]*100,0,100):0)+"%";
    };

    // Cached toy-store scenery; the unicorn sprites remain the game's originals.
    const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
    function oval(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
    function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
    function line(x,y,u,v,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke();}
    function text(value,x,y,size=17,c="#fff1cf"){
      ctx.textAlign="center";ctx.font="900 "+size+"px system-ui,sans-serif";ctx.lineJoin="round";
      ctx.strokeStyle="#263343";ctx.lineWidth=3;ctx.strokeText(value,x,y);ctx.fillStyle=c;ctx.fillText(value,x,y);
    }
    function light(x,y,r,c){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(1,"#ffe8ab00");ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    function star(x,y,r,c){const pts=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;pts.push([x+Math.cos(a)*d,y+Math.sin(a)*d]);}poly(pts,c);}
    function teddy(x,y,s=1,c="#c99360"){
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(0,1,18,5,"#182d4030");oval(-11,-41,7,7,c);oval(11,-41,7,7,c);
      oval(0,-17,16,20,c);oval(-16,-20,7,12,c);oval(16,-20,7,12,c);oval(-10,-2,9,6,"#aa754d");oval(10,-2,9,6,"#aa754d");
      oval(0,-17,10,12,"#edd1a1");oval(0,-37,17,15,c);oval(0,-33,8,6,"#f0d5ae");oval(-6,-40,2,2,"#343344");oval(6,-40,2,2,"#343344");
      oval(0,-35,3,2,"#704b42");poly([[-7,-24],[0,-27],[7,-24],[0,-20]],"#b95360");ctx.restore();
    }
    function rocket(x,y,s=1){
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);poly([[-12,0],[-6,-17],[7,-17],[13,0]],"#d46361");
      box(-7,-30,14,26,"#d9e2df");poly([[-7,-30],[0,-42],[7,-30]],"#f69c76");oval(0,-24,5,5,"#456c88");oval(-1,-25,3,3,"#a8dce1");
      box(-5,-6,10,6,"#65829b");ctx.restore();
    }
    function robotToy(x,y,s=1){
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);box(-9,-27,18,23,"#5da9ab");box(-12,-45,24,19,"#c3d8d6");box(-9,-42,18,12,"#516f89");
      box(-6,-39,4,4,"#fae49b");box(3,-39,4,4,"#fae49b");box(-14,-26,5,17,"#739baf");box(9,-26,5,17,"#739baf");
      box(-9,-4,7,6,"#35516c");box(3,-4,7,6,"#35516c");box(-3,-20,7,6,"#efb45d");line(0,-45,0,-53,"#c3d8d6",2);oval(0,-54,3,3,"#dc7b89");ctx.restore();
    }
    function blocks(x,y,s=1){
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);
      for(const [xx,yy,c,mark]of[[-20,-18,"#d07972","A"],[1,-18,"#75a5bc","B"],[-10,-39,"#d3b862","C"]]){
        box(xx,yy,19,19,"#704f56");box(xx+1,yy+1,16,16,c);box(xx+3,yy+3,12,1,"#fff0c370");text(mark,xx+9,yy+14,11,"#fff2d5");}
      ctx.restore();
    }
    function train(x,y,s=1){
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);box(-25,-19,27,14,"#c76868");box(-21,-27,18,13,"#8aa9b6");box(-18,-24,11,8,"#d8e2c6");
      box(3,-21,25,16,"#6f9e8f");box(5,-33,17,17,"#58817e");box(7,-29,12,9,"#bce2d2");box(0,-24,29,4,"#e5b770");
      box(26,-26,6,21,"#bb6170");for(const xx of[-18,-4,9,24]){oval(xx,-2,5,5,"#3d4c60");oval(xx,-2,2,2,"#ecd6a3");}ctx.restore();
    }
    function shelves(x,w,mirrored=false){
      box(x-6,142,w+12,186,"#35516a");box(x,148,w,172,"#d7b58e");
      const g=ctx.createLinearGradient(0,148,0,322);g.addColorStop(0,"#819da0");g.addColorStop(1,"#587484");ctx.fillStyle=g;ctx.fillRect(x+7,151,w-14,162);
      for(let row=0;row<3;row++){
        const y=194+row*59;
        for(let col=0;col<5;col++){
          const xx=x+31+col*(w-54)/4,kind=(row*3+col+(mirrored?2:0))%5;
          if(kind===0)teddy(xx,y,.67);if(kind===1)rocket(xx,y,.78);if(kind===2)robotToy(xx,y,.73);if(kind===3)blocks(xx,y,.7);if(kind===4)train(xx,y,.55);
        }
        box(x,y+3,w,7,"#efd5ad");box(x,y+10,w,6,"#b78d6e");box(x+11,y+5,22,4,"#f7edd0");box(x+w-34,y+5,22,4,"#f7edd0");
      }
      box(x,147,7,181,"#e6c69e");box(x+w-7,147,7,181,"#b99277");
      box(x-6,135,w+12,13,"#62908c");box(x-6,134,w+12,3,"#b2ccc0");
    }
    function scenery(){
      const wall=ctx.createLinearGradient(0,0,0,338);wall.addColorStop(0,"#edddc3");wall.addColorStop(1,"#c6b59c");ctx.fillStyle=wall;ctx.fillRect(0,0,W,H);
      for(let x=0;x<W;x+=64){box(x,0,32,327,"#ffedcc29");line(x+32,0,x+32,322,"#b09c9120",1);}
      box(0,0,W,18,"#526c78");box(0,19,W,8,"#99aaa6");box(0,30,W,3,"#fff0cf");
      for(const x of[21,934]){box(x,30,7,294,"#729297");box(x-3,29,13,10,"#d6c59f");box(x-3,311,13,16,"#b3ad9b");}
      box(328,142,304,174,"#4a7082");box(338,151,284,159,"#7399a1");
      for(let i=0;i<4;i++){box(349+i*68,155,60,115,"#bed5ca");poly([[349+i*68,155],[380+i*68,155],[349+i*68,227]],"#eff0cc55");}
      box(341,271,278,41,"#ba9875");box(351,281,258,3,"#dfc49a");
      shelves(102,211);shelves(649,210,true);
      for(const [x,c]of[[113,"#bd7da0"],[817,"#76a4a4"]]){
        line(x,31,x,78,"#89796e",2);poly([[x-24,77],[x+24,77],[x+36,96],[x-36,96]],c);oval(x,96,34,5,"#ead6af");
        light(x,101,89,"#fff5c333");
      }
      ctx.beginPath();ctx.strokeStyle="#637b81";ctx.lineWidth=2;ctx.moveTo(0,44);ctx.quadraticCurveTo(480,139,960,44);ctx.stroke();
      for(let i=0;i<21;i++){const x=i*48,y=44+Math.sin(i/20*Math.PI)*43;star(x,y+8,7,["#e6bd67","#c77d91","#7db0b0"][i%3]);}
      // Woodgrain boards stay fixed while the nutcracker moves.
      box(0,325,W,H-325,"#c1a77e");
      for(let row=0;row<8;row++){
        const y=325+row*28;box(0,y,W,27,row%2?"#c6b18d":"#d6bd98");
        line(0,y,W,y,"#9d8e7d",1);
        for(let col=0;col<6;col++){
          const x=col*190+(row%2?91:0);line(x,y,x+4,y+26,"#af967a",1);
          line(x+11,y+9,x+85,y+9,"#ead4b129",1);line(x-71,y+21,x-13,y+21,"#977e6530",1);
        }
      }
      box(0,320,W,6,"#6b7777");box(0,326,W,3,"#ecddbb");
      // Quiet stock aisles continue behind the shelves, well off the battle floor.
      for(const x of[27,866]){
        box(x-4,173,72,156,"#697e83");box(x,178,64,151,"#8c9b98");
        box(x+3,242,58,90,"#b9a17d");
        for(let y=250;y<332;y+=19)line(x+3,y,x+61,y,"#9b8c78",1);
        box(x+6,190,50,32,"#a79883");box(x+7,190,48,4,"#d0bd98");
        box(x+8,221,47,4,"#607b80");teddy(x+19,220,.38);blocks(x+43,220,.4);
        box(x+1,177,3,151,"#c5b99a");box(x+61,177,3,151,"#647e82");
      }
      oval(480,412,115,41,"#927d7470");oval(480,408,111,37,"#809999");oval(480,403,108,34,"#b6c0a8");
      ctx.strokeStyle="#ede0b0";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(480,403,97,28,0,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<9;i++)star(398+i*20,403+Math.sin(i*Math.PI/8)*17,4,"#e8d29c");
      // Big boxed toys frame the floor without restricting the playable area.
      box(12,310,48,40,"#b37c8c");box(16,313,40,29,"#ead5ba");teddy(36,341,.53);
      box(899,307,47,43,"#678c9e");box(904,311,36,31,"#c2d4c4");rocket(922,343,.63);
      for(const [x,y,c]of[[83,339,"#c27080"],[617,334,"#79a8a1"],[855,338,"#e2b85b"]]){box(x,y,14,12,c);box(x+2,y+1,9,2,"#f7e5b980");}
    }
    function background(){
      if(!sceneryCanvas){const layer=document.createElement("canvas");layer.width=W;layer.height=H;
        if(layer.getContext){const snapshot=ctx.getImageData(0,0,W,H);scenery();layer.getContext("2d").drawImage(ctx.canvas,0,0);ctx.putImageData(snapshot,0,0);sceneryCanvas=layer;}}
      if(sceneryCanvas)ctx.drawImage(sceneryCanvas,0,0);else scenery();
    }
    drawBackground=function(){if(active())background();else old.drawBackground();};
    function footPose(side){
      const b=toy.boss,home={x:b.x+side*43,y:b.y},moving=side===(b.foot?1:-1);
      if(!moving)return home;
      if(["stepWarn","stompWarn"].includes(b.mode)){
        const total=b.mode==="stepWarn"?.95:Math.max(.73,tune().warn-b.stage*.10),t=clamp(1-b.timer/total,0,1);
        return{x:lerp(home.x,b.aimX,t),y:lerp(home.y,b.aimY,t)-Math.sin(t*Math.PI*.75)*56};
      }
      if(["stepDown","stompDown"].includes(b.mode))return{x:b.aimX,y:b.aimY};
      if(b.mode==="stepBack"){const t=clamp(1-b.timer/.6,0,1);return{x:lerp(b.aimX,home.x,t),y:lerp(b.aimY,home.y,t)-Math.sin(t*Math.PI)*26};}
      if(b.mode==="walk"){const gait=Math.sin(toy.clock*(5.3+b.stage));return{x:home.x+gait*side*10,y:home.y-Math.max(0,gait*side)*17};}
      return home;
    }
    function fistPose(side){
      const b=toy.boss;
      if(b.stage>0){
        const home=groundPoint(24,side*(100+Math.sin(toy.clock*5)*6));
        if(side===b.hand){
          if(b.mode==="grabWarn")return{x:b.fromX,y:b.fromY-8};
          if(b.mode==="grabLunge"){const t=clamp(1-b.timer/.28,0,1);return{x:lerp(b.fromX,b.aimX,t),y:lerp(b.fromY,b.aimY,t)};}
          if(b.mode==="grabHold")return{x:b.aimX,y:b.aimY};
          if(b.mode==="armRest"){const t=clamp(1-b.timer/.85,0,1);return{x:lerp(b.aimX,home.x,t),y:lerp(b.aimY,home.y,t)};}
        }
        return home;
      }
      return{x:b.x+side*94,y:b.y-99+(b.mode==="walk"?Math.sin(toy.clock*5)*side*9:0)};
    }
    function drawDebris(){
      const b=toy.boss;
      for(const d of b.debris){
        if(d.key==="head")continue;const t=clamp((toy.clock-d.born)/.6,0,1),x=d.x+d.side*t*39,y=d.y-Math.sin(t*Math.PI)*20;
        ctx.save();ctx.translate(x,y);ctx.rotate(d.side*t*.5);oval(0,4,23,6,"#4c45532b");
        if(d.key.endsWith("Leg")){box(-10,-35,20,22,"#cfc4a2");box(-11,-18,23,19,"#3d5363");box(-17,-4,34,10,"#243949");box(-12,-20,25,4,"#dfba6d");}
        else{box(-10,-31,20,21,"#b6515d");box(-12,-13,24,5,"#e9bd6c");box(-15,-8,30,16,"#e2bd93");}
        ctx.restore();
      }
    }
    function drawProne(){
      const b=toy.boss,fall=b.mode==="kneel"?Math.pow(clamp(b.timer/1.65,0,1),2)*110:0;
      oval(b.x,b.y+7,137,30,"#3c3d503b");
      for(const side of[-1,1]){
        const key=limbKey("Arm",side);if(b.parts[key]<=0)continue;
        const s=groundPoint(24,side*40),f=fistPose(side);
        line(s.x,s.y-18-fall,f.x,f.y-17-fall,"#54394a",27);line(s.x,s.y-18-fall,f.x,f.y-17-fall,"#b95458",20);
        line(s.x-3,s.y-22-fall,f.x-3,f.y-21-fall,"#e09675",5);
        box(f.x-18,f.y-26-fall,36,7,"#e8c16b");box(f.x-19,f.y-19-fall,38,24,"#e3bc93");box(f.x-17,f.y-18-fall,28,18,"#f2cea1");
        const open=b.mode==="grabWarn"||b.mode==="grabLunge";
        for(let i=0;i<4;i++)box(f.x-15+i*8,f.y-(open?34:17)-fall,6,open?20:11,"#f1c99f");
        if(b.partFlash[key]>toy.clock)oval(f.x,f.y-10,27,22,"#fff4c280");
      }
      ctx.save();ctx.translate(b.x,b.y-18-fall);ctx.scale(1,.58);ctx.rotate(b.angle);
      const sway=b.mode==="slither"||b.mode==="chompRush"?Math.sin(toy.clock*9)*.035:0;ctx.rotate(sway);
      box(-53,-40,20,80,"#7c4450");box(-50,-37,6,74,"#eac487");
      const coat=ctx.createLinearGradient(0,-45,0,45);coat.addColorStop(0,"#e89074");coat.addColorStop(.45,"#c75c65");coat.addColorStop(1,"#8d4256");
      ctx.fillStyle=coat;ctx.fillRect(-35,-44,99,88);box(-37,-43,15,86,"#344757");box(-39,-13,19,25,"#e2b765");box(-34,-8,9,15,"#72594d");
      for(let i=0;i<3;i++){const x=-5+i*21;line(x,-28,x+3,28,"#eac16f",3);oval(x,-29,4,5,"#ffdc8b");oval(x+3,29,4,5,"#ffdc8b");}
      for(const side of[-1,1]){
        oval(45,side*45,19,9,"#e7bd6b");
        if(b.parts[limbKey("Arm",side)]<=0){poly([[33,side*42],[43,side*36],[50,side*45],[57,side*37],[62,side*49]],"#e7c79d");}
      }
      box(61,-22,17,44,"#c99a7e");
      const headGone=b.parts.head<=0,roll=headGone?clamp(toy.phaseTime/1.2,0,1):0;
      ctx.save();ctx.translate(roll*36,roll*13);ctx.rotate(roll*.14);
      box(76,-35,72,70,"#b98570");box(79,-34,64,63,"#f2ca9e");box(134,-28,9,54,"#d2a07f");
      for(const side of[-1,1])for(let i=0;i<4;i++){oval(80+i*18,side*38,12,10,"#ccd1c3");oval(78+i*18,side*38-2,8,7,"#f2ecd3");}
      // The familiar painted face stays readable as the broken toy swivels.
      const sleepy=b.mode==="exhausted"||headGone;
      line(91,-21,104,-16,"#5c4549",4);line(119,-16,133,-21,"#5c4549",4);
      if(sleepy){line(94,-9,103,-9,"#65464a",3);line(121,-9,130,-9,"#65464a",3);}
      else{oval(99,-8,4,5,"#d67e43");oval(126,-8,4,5,"#d67e43");}
      poly([[111,-14],[118,1],[108,2]],"#cb957a");oval(104,5,11,4,"#66444b");oval(122,5,11,4,"#66444b");
      const jaw=b.mode==="chompWarn"?9:b.mode==="chompRush"?5+Math.sin(toy.clock*33)*5:0;
      box(94,11,39,15+jaw,"#563b47");box(96,12,35,5,"#fff1cd");box(96,22+jaw,35,5,"#eedbb6");
      for(let i=0;i<5;i++)box(101+i*6,12,1,5,"#a88a74");box(89,28+jaw,49,7,"#d5a482");
      box(149,-38,45,76,"#374d5e");box(150,-36,14,72,"#5a7788");box(187,-39,7,78,"#c8ad71");box(145,-43,9,84,"#e5c576");
      star(173,0,14,"#e4b865");line(164,-29,172,-13,"#20303f",3);line(172,-13,165,-6,"#20303f",3);
      ctx.restore();ctx.restore();
      const mouth=mouthPoint();
      if(b.mode==="exhausted"){
        ctx.strokeStyle="#e5f4bb";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(mouth.x,mouth.y-23,43,31,0,0,Math.PI*2);ctx.stroke();
        for(let i=0;i<3;i++)oval(mouth.x-17+i*16,mouth.y-62-((toy.clock*17+i*8)%22),4,7,"#dbe5da99");
      }
      if(b.partFlash.head>toy.clock)oval(mouth.x,mouth.y-20,42,30,"#fff4c280");
      if(b.guard>0){ctx.strokeStyle="#d9e9ed99";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(mouth.x,mouth.y-22,43,30,0,0,Math.PI*2);ctx.stroke();}
    }
    function drawBoss(){
      const b=toy.boss;drawDebris();if(b.stage>0){drawProne();return;}ctx.save();
      oval(b.x,b.y+6,113,24,"#3c3d5044");
      for(const side of[-1,1]){
        const f=fistPose(side);
        const sx=b.x+side*55,sy=b.y-157;
        line(sx,sy,f.x,f.y-16,"#54394a",32);line(sx,sy,f.x,f.y-16,"#b95458",25);
        line(sx-side*4,sy-4,f.x-side*4,f.y-20,"#dd7b68",6);
        box(f.x-20,f.y-28,40,9,"#e6b75f");box(f.x-21,f.y-19,42,25,"#d3ae88");
        box(f.x-18,f.y-18,29,20,"#f0cda3");box(f.x+13,f.y-15,8,17,"#b98f79");
        for(let i=0;i<3;i++)line(f.x-10+i*9,f.y-16,f.x-10+i*9,f.y-4,"#b88773",1);
      }
      for(const side of[-1,1]){
        const key=limbKey("Leg",side);if(b.parts[key]<=0)continue;
        const f=footPose(side);line(b.x+side*29,b.y-89,f.x,f.y-19,"#344351",30);
        line(b.x+side*27,b.y-88,f.x-3,f.y-20,"#edddbc",23);
        line(b.x+side*32,b.y-87,f.x+5,f.y-21,"#b4b09a",6);
        box(f.x-18,f.y-42,35,36,"#364958");box(f.x-17,f.y-41,8,31,"#607586");box(f.x-24,f.y-16,49,19,"#253440");
        box(f.x-24,f.y-17,43,4,"#4e6675");box(f.x-25,f.y,50,5,"#182b36");box(f.x-20,f.y-39,38,5,"#dfb671");
        if(b.partFlash[key]>toy.clock)oval(f.x,f.y-25,27,31,"#fff1b590");
      }
      box(b.x-49,b.y-96,98,17,"#7d4550");
      const coat=ctx.createLinearGradient(b.x-60,0,b.x+60,0);coat.addColorStop(0,"#e17e6b");coat.addColorStop(.45,"#be5260");coat.addColorStop(1,"#8d4058");
      ctx.fillStyle=coat;ctx.fillRect(b.x-57,b.y-177,114,91);
      box(b.x-54,b.y-174,6,83,"#f1b38a");box(b.x+48,b.y-174,9,86,"#743b53");
      box(b.x-57,b.y-108,114,13,"#374450");box(b.x-9,b.y-110,22,17,"#edc76c");box(b.x-4,b.y-106,12,8,"#76544f");
      for(let i=0;i<3;i++){
        const y=b.y-161+i*18;line(b.x-35,y,b.x+35,y+3,"#e7ba69",3);oval(b.x-34,y,4,4,"#ffdf8e");oval(b.x+34,y+3,4,4,"#ffdf8e");
      }
      for(const side of[-1,1]){oval(b.x+side*58,b.y-177,22,8,"#e8c36e");for(let i=0;i<5;i++)line(b.x+side*58-14+i*7,b.y-174,b.x+side*58-14+i*7,b.y-161,"#ca9b4c",3);}
      // Painted wooden face, curly white hair, hinged jaw and a tall toy-soldier hat.
      box(b.x-20,b.y-189,40,17,"#ead0a4");box(b.x-40,b.y-238,80,65,"#b48470");box(b.x-37,b.y-237,70,62,"#f2c99f");
      box(b.x+26,b.y-230,10,49,"#d6a484");
      for(const side of[-1,1])for(let i=0;i<4;i++){oval(b.x+side*42,b.y-228+i*14,12,12,"#ccd1c3");oval(b.x+side*44-3,b.y-231+i*14,7,8,"#f2ecd3");}
      line(b.x-25,b.y-222,b.x-8,b.y-218,"#55424a",5);line(b.x+8,b.y-218,b.x+25,b.y-222,"#55424a",5);
      oval(b.x-17,b.y-211,5,6,toy.phase==="battle"?"#557e86":"#dc854e");oval(b.x+17,b.y-211,5,6,toy.phase==="battle"?"#557e86":"#dc854e");
      box(b.x-19,b.y-213,3,3,"#fff0bb");box(b.x+15,b.y-213,3,3,"#fff0bb");
      poly([[b.x-3,b.y-218],[b.x+6,b.y-204],[b.x-6,b.y-203]],"#cc957c");
      oval(b.x-10,b.y-198,13,5,"#654149");oval(b.x+10,b.y-198,13,5,"#654149");
      const jaw=b.mode==="wake"?3:0;
      box(b.x-21,b.y-190,42,17+jaw,"#653f4b");box(b.x-18,b.y-189,36,7,"#fff0d0");box(b.x-18,b.y-180+jaw,36,4,"#e5d1aa");
      for(let i=0;i<5;i++)box(b.x-13+i*7,b.y-189,1,7,"#ad8a79");
      box(b.x-29,b.y-173+jaw,58,8,"#e5b891");box(b.x-24,b.y-171+jaw,48,4,"#f5d0a4");
      ctx.save();ctx.translate(b.x,b.y-237);ctx.rotate(b.stage>0?(b.stage===1?-.055:.09):0);
      box(-43,-66,86,68,"#354858");box(-42,-66,20,63,"#567284");box(30,-66,13,64,"#253745");
      box(-46,-68,92,8,"#dac07e");box(-46,-4,92,10,"#e7c774");box(-42,-1,83,3,"#ffdf8d");
      star(0,-34,15,"#e8bb65");star(-2,-36,8,"#fae6a3");
      if(b.stage>0){line(19,-62,11,-43,"#151e2d",3);line(11,-43,19,-34,"#151e2d",3);}
      if(b.stage>1){line(-23,-59,-14,-38,"#151e2d",3);line(-14,-38,-20,-14,"#151e2d",3);}
      ctx.restore();
      if(b.flash>0){ctx.globalAlpha=b.flash*.35;oval(b.x,b.y-209,55,45,"#fff0a1");}
      if(b.guard>0){ctx.globalAlpha=.7;ctx.strokeStyle="#c1edf0";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(b.x,b.y-154,65,87,0,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
    function drawSecret(s){
      if(s.claimed[role()])return;
      const x=s.x,y=s.y;oval(x,y+1,15,4,"#4c52552b");
      if(s.kind==="jet")rocket(x,y,.57);
      else{
        box(x-19,y-15,35,12,"#b95b5b");box(x+7,y-23,12,15,"#cf7769");box(x+10,y-21,7,7,"#a9c7c3");
        box(x-17,y-20,26,3,"#cdd1bc");for(let i=0;i<4;i++)box(x-14+i*6,y-23,2,9,"#cdd1bc");
        oval(x-11,y-2,5,5,"#384b5b");oval(x+12,y-2,5,5,"#384b5b");oval(x-11,y-2,2,2,"#d4c29d");oval(x+12,y-2,2,2,"#d4c29d");
      }
    }
    function warning(x,y,rx,ry,kind){
      oval(x,y,rx,ry,"#ce575044");
      ctx.strokeStyle="#ffe39b";ctx.lineWidth=2.5;ctx.setLineDash([7,5]);ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      text("!",x,y+7,22,"#fff2bb");
    }
    function drawPlayer(p){
      if(p.dead||p.ghost||p.lives<=0)return;
      const air=flying(p),q=p,power=powerFor(p.role);
      const y=q.y-(air?45+Math.sin(toy.clock*8)*3:p.toyStatus?.grab?7:0);
      if(air){oval(p.x,p.y+4,30,7,"#34415340");const bx=q.x-15*(p.face||1);
        poly([[bx-9,y-12],[bx,y+14+Math.sin(toy.clock*24)*5],[bx+9,y-12]],"#ec9261");poly([[bx-4,y-13],[bx,y+6],[bx+4,y-13]],"#fff0a3");}
      ctx.save();ctx.translate(0,y-p.y);
      if(p.role===role()){drawShieldAura();drawDodgeEffect();}
      drawUnicorn(p.x,p.y,p.face||1,false,p.ray>0,p.giant>0);
      if(air){box(p.x-21*(p.face||1)-8,p.y-33,17,24,"#476a84");box(p.x-21*(p.face||1)-5,p.y-32,11,19,"#c7d4cb");box(p.x-21*(p.face||1)-9,p.y-10,19,5,"#da9d67");}
      if(power==="fire"){
        ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.face||1,1);
        box(-27,-37,15,25,"#ad5e50");box(-25,-34,11,15,"#d59f62");
        line(-20,-14,25,-22,"#4a4e55",4);box(21,-30,28,9,"#4e6475");oval(48,-26,4,3,"#ffca73");ctx.restore();
      }
      ctx.restore();
      if(host()||guest())text(p.role==="host"?"P1":"P2",q.x,y-77,12,p.role==="host"?"#ffe3a3":"#bbe8f0");
    }
    draw=function(){
      if(!active())return old.draw();ctx.save();background();const b=toy.boss;
      if(["stepWarn","stompWarn","grabWarn"].includes(b.mode)){
        if(b.mode==="stepWarn")warning(b.aimX,(b.fromY+b.aimY)/2,39,Math.abs(b.aimY-b.fromY)/2+29,"step");
        else warning(b.aimX,b.aimY,b.mode==="grabWarn"?35:44,b.mode==="grabWarn"?25:33,b.mode);
      }
      if(b.mode==="chompWarn"){const m=mouthPoint();line(m.x,m.y,b.aimX,b.aimY,"#e2a475a0",6);warning(b.aimX,b.aimY,40,27,"chomp");}
      for(const s of toy.strikes){const age=toy.clock-s.born;if(age>.7)continue;
        ctx.globalAlpha=1-age/.7;ctx.strokeStyle="#efd6ae";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(s.x,s.y,s.rx+age*65,s.ry+age*29,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
      for(const s of toy.secrets)drawSecret(s);
      const actors=[{y:b.y,draw:drawBoss}];
      for(const e of state.enemies)actors.push({y:e.y,draw:()=>{drawUnicorn(e.x,e.y,e.face,true,e.type==="ray",false);if(e.warning>0)text("!",e.x,e.y-70,20,"#ffe4aa");}});
      for(const p of players())actors.push({y:p.toyStatus?.grab?900:p.y,draw:()=>drawPlayer(p)});
      actors.sort((a,c)=>a.y-c.y).forEach(a=>a.draw());
      for(const s of toy.shots){
        if(s.kind==="missile"){
          ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx));poly([[-10,-4],[8,-4],[15,0],[8,4],[-10,4]],"#eae4c8");box(-9,-4,5,8,"#d47370");poly([[-11,-3],[-23-Math.sin(toy.clock*33)*4,0],[-11,3]],"#f5b05d");ctx.restore();
        }else{line(s.x-s.vx*.024,s.y-s.vy*.024,s.x,s.y,s.kind==="enemy"?"#df8b9b":"#76d9df",6);line(s.x-s.vx*.018,s.y-s.vy*.018,s.x,s.y,"#ffefd4",2);}
      }
      for(const f of toy.bursts){const age=toy.clock-f.born;
        if(f.kind==="fire"){for(let i=0;i<9;i++){const x=f.x+f.face*(16+i*18),y=f.y+Math.sin(i*1.8+toy.clock*26)*7;oval(x,y,13+i*1.3,8+i*.7,i%2?"#f9c266cc":"#ec8559cc");}poly([[f.x,f.y-5],[f.x+f.face*115,f.y],[f.x,f.y+5]],"#fff0a7");}
        else for(let i=0;i<7;i++){const a=i*Math.PI*2/7;star(f.x+Math.cos(a)*age*80,f.y+Math.sin(a)*age*70,3,"#ffe7a4");}}
      drawParticles();ctx.restore();ctx.save();ctx.textAlign="left";drawHealthBar();
      box(291,16,378,64,"#2c4857e8");box(291,16,378,3,"#edd08a");text("CLOCKWORK TOYBOX",480,43,20);
      const health=b.stage===0?"LEGS: "+b.parts.leftLeg+" + "+b.parts.rightLeg:b.stage===1?"ARMS: "+b.parts.leftArm+" + "+b.parts.rightArm:"HEAD: "+b.parts.head;
      text(toy.phase==="battle"?"NEXT STEP: "+Math.max(0,Math.ceil(toy.nextStep-toy.battleTime))+"s · WATCH THE STEPPING PATH":
        "ROUND "+Math.min(3,b.stage+1)+" OF 3  ·  "+health,480,65,11,"#d7e6d8");
      if(toy.phase==="won"){
        box(240,94,480,78,"#2c4857ed");text("THE TOY STORE IS SAFE!",480,125,24,"#ffe6a5");text("THAT'S ONE TOY THAT NEEDED A TIME-OUT.",480,152,12,"#e2ece1");
        for(let i=0;i<28;i++){const t=toy.phaseTime-1;if(t<0)break;const x=(i*151+25)%W,y=(t*(27+i%4*9)+i*31)%H;box(x,y,4,6,["#dc8996","#8cbbc2","#e6bc6b"][i%3]);}
      }else if(fighting()){
        let hint=noticeUntil>toy.clock?notice:toy.phase==="battle"?"A: ATTACK / DODGE  ·  DEFEAT GUN ZOMBIES TO TAKE THEIR WEAPON":
          b.stage===0?"ATTACK BOTH LEGS. KEEP CLEAR OF THE MARKED STEPS.":
          b.stage===1?"BREAK BOTH ARMS — DON'T LET HIS HANDS CATCH YOU!":
          b.mode==="exhausted"?"HE'S EXHAUSTED — ATTACK HIS HEAD NOW!":"DODGE THREE CHOMPS. ATTACK WHEN HE TIRES.";
        box(144,92,672,28,"#2c4857d9");text(hint,480,112,12,"#fff0b7");
      }
      ctx.restore();
    };
  }
  window.__uvzuInstallToyStore=function(code){
    function once(before,after){if(code.split(before).length!==2)throw new Error("Toy store hook missing: "+before.slice(0,90));code=code.replace(before,()=>after);}
    const movement='(["HALO4", "ICE10", "LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))';
    if(code.split(movement).length!==6)throw new Error("Toy store movement hooks missing");
    code=code.split(movement).join(movement.replace('["HALO4"','["TOY11", "HALO4"'));
    const ending='!["HALO4", "ICE10", "LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)';
    if(code.split(ending).length!==3)throw new Error("Toy store ending hooks missing");
    code=code.split(ending).join(ending.replace('["HALO4"','["TOY11", "HALO4"'));
    once('!["TOMB1", "LAKE9", "ICE10"].includes(window.__uvzuCurrentLevelCode)',
      '!["TOMB1", "LAKE9", "ICE10", "TOY11"].includes(window.__uvzuCurrentLevelCode)');
    once('window.__uvzuLevelTheme = nextCode === "HALO4" ? "halloween" :',
      'window.__uvzuLevelTheme = nextCode === "TOY11" ? "toystore" : nextCode === "HALO4" ? "halloween" :');
    const floor='player.y = clamp(player.y, H * 0.60, H - 20);';
    if(!code.includes(floor))throw new Error("Toy store floor hooks missing");
    code=code.split(floor).join('player.y = clamp(player.y, window.__uvzuCurrentLevelCode === "TOY11" ? window.__uvzuToyFloor(player) : H * 0.60, H - 20);');
    once('  requestAnimationFrame(loop);\n})();','('+toyRuntime.toString()+')();\n  requestAnimationFrame(loop);\n})();');return code;
  };
})();
