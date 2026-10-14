// TOY11 — Clockwork Toybox. Load after halloween-level.js, before game.js.
(() => {
  function toyRuntime() {
    const LEVEL="TOY11", DURATION=60, STEP_INTERVAL=5, ROUNDS=3;
    const FIST_REST=1, CLIMB_SPEED=385, MUSIC_URL="./clockwork-toybox.mp3?v=1";
    const POWER_SECONDS={fire:5,laser:8,jet:8};
    const SETTINGS={
      Easy:{cap:5,spawn:2.45,zombie:67,boss:69,warn:1.15,lift:3.0},
      Normal:{cap:6,spawn:2.15,zombie:78,boss:79,warn:1.03,lift:2.8},
      Hard:{cap:7,spawn:1.9,zombie:88,boss:88,warn:.94,lift:2.65}
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
    const crew=()=>({loss:0,seq:0,headAt:0,shotAt:0,power:"",until:0,missiles:0});
    const newBoss=()=>({x:480,y:406,stage:0,mode:"statue",timer:0,steps:0,attack:0,targetRole:"host",
      aimX:440,aimY:480,fromX:440,fromY:406,foot:0,flash:0,slowedUntil:0,
      arm:null,walkers:{},bonus:false,guard:0});
    let serial=0,seq=0,loss=0,lastPacket=0,hasSnapshot=false,nextSent=false,sceneryCanvas=null;
    let pending=[],climb=null,graceUntil=0,localShotAt=0,notice="",noticeUntil=0,wasFlying=false;
    const seenHazards=new Set(),seenKills=new Set(),seenGifts=new Set();
    const fresh=()=>({level:LEVEL,session:session(),run:Date.now()+"-"+(++serial),phase:"battle",phaseTime:0,
      clock:0,battleTime:0,nextStep:STEP_INTERVAL,spawnTimer:1.1,spawned:0,defeated:0,event:0,giftSerial:0,
      enemies:[],shots:[],strikes:[],gifts:[],kills:[],bursts:[],boss:newBoss(),crews:{host:crew(),guest:crew()},finished:false});
    let toy=fresh(),music=null,musicPending=false,musicBlocked=false,pageHidden=false;
    const fighting=()=>["battle","arrival","boss"].includes(toy.phase);
    const push=()=>{if(host())window.__uvzuMultiplayerPushEnemyState?.(state.enemies,true);};
    window.__uvzuGetToyState=()=>active()?{...toy,enemies:state.enemies}:null;
    window.__uvzuGetToyStatus=()=>active()?{level:LEVEL,run:toy.run,loss,actions:pending,
      climb:climb?{id:climb.id,progress:climb.progress}:null}:null;
    const say=(message,seconds=2.2)=>{notice=message;noticeUntil=toy.clock+seconds;};
    function players(all=false){
      const result=[{...player,role:role(),dead:ghost(),toyStatus:window.__uvzuGetToyStatus()}];
      const p=window.__uvzuGetRemotePlayer?.();
      if((host()||guest())&&p?.toyStatus?.run===toy.run&&Number.isFinite(p.x)&&Number.isFinite(p.y))
        result.push({...p,role:guest()?"host":"guest",dead:!!p.dead||!!p.ghost||p.lives<=0});
      return all?result:result.filter(p=>!p.dead);
    }
    const nearest=(x,y)=>players().sort((a,b)=>distance(a.x,a.y,x,y)-distance(b.x,b.y,x,y))[0];
    const powerFor=who=>{const c=toy.crews[who];return c&&c.until>toy.clock?c.power:"";};
    const flying=p=>!p.dead&&powerFor(p.role)==="jet"&&!p.toyStatus?.climb;
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
      player.webTrapX=player.webTrapY=null;player.ray=0;climb=null;wasFlying=false;
      player.actionLock=.2;localShotAt=0;graceUntil=toy.clock+1.2;
    }
    function initialize(){
      stopMusic(true);window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();
      if(host()||guest())player.lives=window.__uvzuTesterLifeBudget?.(5)??5;
      toy=fresh();state.enemies=toy.enemies;state.mode="play";state.time=0;
      seq=loss=lastPacket=0;pending=[];hasSnapshot=false;nextSent=false;noticeUntil=0;
      seenHazards.clear();seenKills.clear();seenGifts.clear();resetPosition();
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
      if(player.lives>=before)return;loss++;pending=[];climb=null;player.ray=0;
      if(!guest()){Object.assign(toy.crews[role()],crew(),{loss,seq});delete toy.boss.walkers[role()];}
      if(!ghost()&&(host()||guest()))safeLifeReset();
      if(!host()&&!guest()&&player.lives<=0){toy.phase="lost";stopMusic();}
      window.__uvzuMultiplayerPush?.(player);push();
    };
    function hurt(crush=false){
      if(ghost()||!fighting()||state.resetQueued||toy.clock<graceUntil||player.invuln>0||player.dodgeTimer>0)return;
      if(shieldBlockContact())return;
      player.headbuttStreak=0;player.regenTimer=HEALTH_REGEN_TIME;addParticles(player.x,player.y-20,"red");
      player.hp-=crush?HP_MAX:1;
      if(player.hp<=0){player.invuln=0;loseLife();}else player.invuln=.65;
    }
    function rewardEffects(){
      for(const k of toy.kills){
        if(seenKills.has(k.id))continue;seenKills.add(k.id);
        if(toy.clock-k.born<.7)addParticles(k.x,k.y-25,k.method==="fire"?"rainbow":"red");
        if(k.who!==role())continue;state.score+=k.type==="ray"?35:10;
        if(k.method==="head"){player.headbuttStreak++;awardShieldIfReady();}else player.headbuttStreak=0;
      }
      for(const g of toy.gifts){
        if(!g.opened||seenGifts.has(g.id))continue;seenGifts.add(g.id);
        if(g.who!==role())continue;state.score+=g.kind?25:10;
        say(g.kind==="fire"?"FIRE BREATH! HOLD B — 5 SECONDS":g.kind==="laser"?"LASER GUN! HOLD B — 8 SECONDS":
          g.kind==="jet"?"JETPACK! HOVER + 6 HOMING MISSILES — HOLD B":"A TOY! KEEP LOOKING FOR POWER-UPS.");
      }
    }
    function defeat(i,who,method="head"){
      const e=state.enemies.splice(i,1)[0];if(!e)return;
      toy.defeated++;toy.kills.push({id:e.id,who,method,type:e.type,x:e.x,y:e.y,born:toy.clock});
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
    function spawnGift(x,y,kind){
      if(toy.gifts.filter(g=>!g.opened).length>=8)return;
      const n=toy.giftSerial++;
      toy.gifts.push({id:toy.run+"-gift-"+n,x:clamp(x,60,900),y:clamp(y,351,498),
        fromX:toy.boss.x,fromY:toy.boss.y-120,kind:kind===undefined?["fire",null,"laser",null,"jet",null][n%6]:kind,
        born:toy.clock,opened:false,openedAt:0,who:"",n});
    }
    function dropGift(){
      const b=toy.boss,n=toy.giftSerial,side=n%2?1:-1;
      spawnGift(b.x+side*(130+n%3*34),385+(n*43)%107);
    }
    function collectGifts(){
      const live=players().filter(p=>!p.toyStatus?.climb);
      for(const g of toy.gifts){
        if(g.opened||toy.clock-g.born<.7)continue;
        const p=live.filter(p=>Math.abs(p.x-g.x)<38&&Math.abs(p.y-g.y)<30)
          .sort((a,b)=>distance(a.x,a.y,g.x,g.y)-distance(b.x,b.y,g.x,g.y)||a.role.localeCompare(b.role))[0];
        if(!p)continue;g.opened=true;g.openedAt=toy.clock;g.who=p.role;
        if(g.kind){const c=toy.crews[p.role];c.power=g.kind;c.until=toy.clock+POWER_SECONDS[g.kind];c.missiles=g.kind==="jet"?6:0;}
        rewardEffects();push();
      }
      toy.gifts=toy.gifts.filter(g=>toy.clock-(g.opened?g.openedAt:g.born)<(g.opened?1.2:22));
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
    function mode(name,seconds){toy.boss.mode=name;toy.boss.timer=seconds;push();}
    const inOval=(p,x,y,rx,ry)=>Math.hypot((p.x-x)/rx,(p.y-y)/ry)<1;
    function strikeAt(kind,x,y,rx,ry,fromX=x,fromY=y){
      const s={id:toy.run+"-crush-"+(++toy.event),kind,x,y,rx,ry,fromX,fromY,born:toy.clock};
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
      toy.phase="arrival";toy.phaseTime=0;toy.shots=[];toy.strikes=[];toy.boss.arm=null;
      mode("wake",2.3);state.mode="final";say("THE NUTCRACKER IS WAKING UP!",2.3);
    }
    function beginWalk(){const b=toy.boss;b.arm=null;b.walkers={};b.steps=0;chooseTarget(b);mode("walk",1.6);}
    function warnStomp(){
      const b=toy.boss;b.foot=1-b.foot;b.attack++;chooseTarget(b);b.locked=false;
      b.fromX=b.x+(b.foot?43:-43);b.fromY=b.y;b.aimX=b.fromX;b.aimY=b.y+50;
      mode("stompWarn",Math.max(.73,tune().warn-b.stage*.10));
    }
    function aimStomp(b){
      const p=aimTarget(b);if(!p)return;
      b.aimX=clamp(p.x,b.x-112,b.x+112);b.aimY=clamp(p.y,351,499);
    }
    function warnFist(){
      const b=toy.boss;b.attack++;chooseTarget(b);b.locked=false;b.bonus=false;b.walkers={};
      mode("fistWarn",1.5-b.stage*.12);aimFist(b);
      say("DODGE THE FIST, THEN RUN UP HIS ARM!",2.5);
    }
    function aimFist(b){
      const p=aimTarget(b);if(!p)return;
      b.side=p.x>=b.x?1:-1;
      // The fist lands beside the body, leaving a visible, traversable arm.
      b.aimX=clamp(p.x,b.side>0?b.x+115:b.x-210,b.side>0?b.x+210:b.x-115);
      b.aimX=clamp(b.aimX,80,880);b.aimY=clamp(p.y,368,497);
    }
    function makeArm(){
      const b=toy.boss,ex=b.x+b.side*58,ey=b.y-145;
      b.arm={id:toy.run+"-arm-"+b.attack,sx:b.aimX,sy:b.aimY+6,ex,ey,born:toy.clock,
        length:Math.hypot(ex-b.aimX,ey-(b.aimY+6))};
      b.walkers={};mode("recover",FIST_REST+tune().lift-b.stage*.32);
    }
    function armLift(b){
      if(!b.arm)return 0;if(b.mode==="recoil"||b.mode==="fall")return 0;
      return clamp((toy.clock-b.arm.born-FIST_REST)/(tune().lift-b.stage*.32),0,1)*52;
    }
    function armPoint(b,t){const a=b.arm;return{x:lerp(a.sx,a.ex,t),y:lerp(a.sy-armLift(b),a.ey,t)};}
    function validWalker(p){const b=toy.boss,w=b.walkers?.[p.role],s=p.toyStatus?.climb;
      return b.arm&&s?.id===b.arm.id&&w?.loss===p.toyStatus?.loss?w:null;}
    function riderPosition(p){return validWalker(p)?armPoint(toy.boss,clamp(p.toyStatus.climb.progress,0,1)):p;}
    function strikeFace(who,p){
      const b=toy.boss,w=validWalker(p),s=p.toyStatus?.climb;
      if(toy.phase!=="boss"||b.mode!=="recover"||!w||s.progress<.96||
        toy.clock-w.enteredAt<b.arm.length/(CLIMB_SPEED+80)-.12||distance(p.x,p.y,b.arm.ex,b.arm.ey)>37)return;
      b.stage++;b.flash=.75;toy.phaseTime=0;state.score+=who===role()?300:0;
      // Changing mode immediately deduplicates simultaneous co-op face strikes.
      if(b.stage>=ROUNDS){toy.phase="won";mode("fall",4.8);toy.shots=[];toy.strikes=[];state.mode="toyScene";}
      else{mode("recoil",1.8);say("ROUND "+(b.stage+1)+" — HE'S GETTING FASTER!",2.7);}
      push();
    }
    function hitArmor(kind){
      const b=toy.boss;b.guard=.24;
      if(kind==="missile")b.slowedUntil=Math.max(b.slowedUntil,toy.clock+.7);
      if(b.mode==="recover"&&!b.bonus){b.bonus=true;b.timer+=.65;say("ARM STAGGERED! A LITTLE MORE TIME TO CLIMB.",1.4);}
    }
    function bossTick(dt){
      const b=toy.boss;b.timer-=dt;b.flash=Math.max(0,b.flash-dt);b.guard=Math.max(0,b.guard-dt);
      if(toy.phase==="battle"){
        if(b.mode==="statue"&&toy.battleTime>=toy.nextStep-.95)stationaryStep();
        else if(b.mode==="stepWarn"&&b.timer<=0){
          strikeAt("step",b.aimX,(b.fromY+b.aimY)/2,39,Math.abs(b.aimY-b.fromY)/2+29,b.fromX,b.fromY);
          dropGift();mode("stepDown",.42);toy.nextStep+=STEP_INTERVAL;
        }else if(b.mode==="stepDown"&&b.timer<=0)mode("stepBack",.6);
        else if(b.mode==="stepBack"&&b.timer<=0)mode("statue",0);
        return;
      }
      if(b.mode==="wake"&&b.timer<=0){toy.phase="boss";toy.phaseTime=0;beginWalk();return;}
      if(b.mode==="walk"){
        const p=aimTarget(b)||nearest(b.x,b.y);if(p){
          const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy)||1,speed=(tune().boss+b.stage*18)*(b.slowedUntil>toy.clock?.45:1);
          if(d>82){b.x=clamp(b.x+dx/d*speed*dt,235,725);b.y=clamp(b.y+dy/d*speed*dt*.55,374,463);}
        }
        if(b.timer<=0)warnStomp();return;
      }
      if(b.mode==="stompWarn"){
        if(!b.locked){aimStomp(b);if(b.timer<=.42){b.locked=true;push();}}
        if(b.timer<=0){strikeAt("stomp",b.aimX,b.aimY,44,33);dropGift();b.steps++;mode("stompDown",.38);}return;
      }
      if(b.mode==="stompDown"&&b.timer<=0){
        if(b.steps>=3)warnFist();else{chooseTarget(b);mode("walk",Math.max(.95,1.6-b.stage*.2));}return;
      }
      if(b.mode==="fistWarn"){
        if(!b.locked){aimFist(b);if(b.timer<=.5){b.locked=true;push();}}
        if(b.timer<=0){strikeAt("fist",b.aimX,b.aimY,51,37);mode("fistDown",.16);dropGift();}return;
      }
      if(b.mode==="fistDown"&&b.timer<=0){makeArm();return;}
      if(b.mode==="recover"&&b.timer<=0){b.walkers={};mode("recoil",1.3);say("MISSED THE OPENING — WATCH FOR THE NEXT FIST.");return;}
      if(b.mode==="recoil"&&b.timer<=0){beginWalk();return;}
      if(b.mode==="fall"&&b.timer<=0){mode("fallen",0);toy.finished=true;if(host())window.__uvzuSignalLevelCompleted?.();push();}
    }
    function accept(a,who,p){
      const c=toy.crews[who];if(!a||!p||!c||!Number.isFinite(a.seq)||a.seq<=c.seq)return;c.seq=a.seq;
      if(!fighting()||p.dead||a.loss!==c.loss||p.toyStatus?.loss!==a.loss||
        ![a.x,a.y,a.at].every(Number.isFinite)||Math.abs(toy.clock-a.at)>1.8||distance(p.x,p.y,a.x,a.y)>100)return;
      const b=toy.boss;
      if(a.kind==="enter"){
        const arm=b.arm;
        if(b.mode==="recover"&&arm&&a.armId===arm.id&&a.at-arm.born<=FIST_REST+.04&&
          toy.clock-arm.born<=FIST_REST+.38&&distance(a.x,a.y,arm.sx,arm.sy)<52){
          // A guest may already be partway up the arm when its input packet arrives.
          b.walkers[who]={loss:a.loss,enteredAt:Math.max(arm.born,a.at)};push();}
        return;
      }
      if(a.kind==="head"||a.kind==="face"){
        if(toy.clock<c.headAt)return;c.headAt=toy.clock+.24;
        if(a.kind==="face"){strikeFace(who,p);return;}
        if(p.toyStatus?.climb)return;
        for(const e of [...state.enemies])if(Math.abs(e.x-(p.x+(p.face||1)*38))<55&&Math.abs(e.y-p.y)<46)
          damageEnemy(e,who,"head");
        return;
      }
      if(a.kind!=="shoot"||toy.clock<c.shotAt)return;
      const power=powerFor(who);if(!power||p.toyStatus?.climb)return;
      if(power==="jet"&&c.missiles<=0)return;
      c.shotAt=toy.clock+(power==="fire"?.27:power==="jet"?.6:.27);
      const dir=p.face||1,sx=p.x+dir*51,sy=p.y-32-(flying(p)?45:0);
      if(power==="fire"){
        toy.bursts.push({id:toy.run+"-flame-"+(++toy.event),x:sx,y:sy,face:dir,born:toy.clock,kind:"fire"});
        for(const e of [...state.enemies]){const along=(e.x-sx)*dir;if(along>=-20&&along<190&&Math.abs(e.y-30-sy)<26+Math.max(0,along)*.12)damageEnemy(e,who,"fire",2);}
        if(toy.phase==="boss"&&Math.abs(b.aimX-sx)<195&&Math.abs(b.aimY-25-sy)<70)hitArmor("fire");
      }else{
        const targets=state.enemies.filter(e=>power==="jet"||(e.x-p.x)*dir>-15)
          .sort((a,b)=>distance(a.x,a.y,p.x,p.y)-distance(b.x,b.y,p.x,p.y));
        const target=targets[0],boss=toy.phase==="boss";
        const tx=target?.x??(boss?b.mode==="recover"?b.aimX:b.x:p.x+dir*550);
        const ty=(target?.y??(boss?b.mode==="recover"?b.aimY:b.y-80:p.y))-28;
        const dx=tx-sx,dy=ty-sy,d=Math.hypot(dx,dy)||1,speed=power==="jet"?335:530;
        toy.shots.push({id:toy.run+"-shot-"+who+"-"+a.seq,kind:power==="jet"?"missile":"laser",who,
          x:sx,y:sy,vx:dx/d*speed,vy:dy/d*speed,life:2.8,target:target?.id||"boss"});
        if(power==="jet")c.missiles--;
      }
      push();
    }
    function act(kind){
      const a={seq:++seq,kind,loss,at:toy.clock,x:player.x,y:player.y,armId:climb?.id||null};
      if(guest())pending.push(a);else accept(a,role(),{...player,role:role(),dead:ghost(),toyStatus:window.__uvzuGetToyStatus()});
      window.__uvzuMultiplayerPush?.(player);
    }
    function leaveArm(drop=false){
      if(climb&&drop){player.x=clamp(player.x,45,W-45);player.y=clamp(toy.boss.arm?.sy||toy.boss.y+28,337,506);player.invuln=Math.max(player.invuln,.65);}
      climb=null;player.dodgeTimer=0;window.__uvzuMultiplayerPush?.(player);
    }
    currentDirection=function(){return active()&&climb?{dx:0,dy:0}:old.currentDirection();};
    updateDodgeMovement=function(dt){if(active()&&climb){player.dodgeTimer=0;return true;}return old.updateDodgeMovement(dt);};
    function walkArm(dt){
      const b=toy.boss,a=b.arm,dir=old.currentDirection();
      if(climb&&(!a||a.id!==climb.id||!["recover","recoil","fall"].includes(b.mode)||ghost())){leaveArm(true);return;}
      if(!climb){
        if(b.mode!=="recover"||!a||toy.clock-a.born>FIST_REST||ghost()||player.dodgeTimer>0||toy.clock<graceUntil)return;
        const toward=(dir.dx*(a.ex-a.sx)+dir.dy*(a.ey-a.sy))/a.length;
        if(distance(player.x,player.y,a.sx,a.sy)>42||toward<=.12)return;
        climb={id:a.id,progress:0,entrySeq:seq+1};act("enter");player.headTimer=player.dodgeTimer=0;
      }
      if(guest()&&!b.walkers?.guest&&(toy.crews.guest?.seq||0)>=climb.entrySeq){leaveArm(true);return;}
      const toward=(dir.dx*(a.ex-a.sx)+dir.dy*(a.ey-a.sy))/a.length;
      const forward=b.mode==="recover"?toward:-1;
      const speed=CLIMB_SPEED+(powerFor(role())==="jet"?80:0);
      climb.progress=clamp(climb.progress+forward*speed*dt/a.length,0,1);
      Object.assign(player,armPoint(b,climb.progress));player.face=-b.side;
      if(climb.progress===0&&forward<0)leaveArm();
    }
    handleAAction=function(){
      if(!active()||!climb)return old.handleAAction();
      Object.assign(player,armPoint(toy.boss,climb.progress));
      if(!(input.a||keys[" "]))player.aConsumed=false;
      else if(!player.aConsumed){player.aConsumed=true;headbutt();}
    };
    headbutt=function(){
      if(!active())return old.headbutt();
      if(!fighting()||ghost()||player.headCd>0||player.actionLock>0||player.dodgeTimer>0)return;
      player.headCd=.24;player.headTimer=.15;player.actionLock=.08;
      act(climb?"face":"head");
    };
    playerShoot=function(){
      if(!active())return old.playerShoot();
      if(!fighting()||ghost()||toy.clock<localShotAt)return;
      if(climb){localShotAt=toy.clock+.28;player.headTimer=.15;act("face");return;}
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
          const e=state.enemies.find(e=>e.id===s.target),b=toy.boss;
          if(e||toy.phase==="boss"){
            const dx=(e?.x??(b.mode==="recover"?b.aimX:b.x))-s.x;
            const dy=(e?.y??(b.mode==="recover"?b.aimY:b.y-80))-28-s.y,d=Math.hypot(dx,dy)||1;
            const bend=1-Math.exp(-dt*5);s.vx=lerp(s.vx,dx/d*335,bend);s.vy=lerp(s.vy,dy/d*335,bend);
          }
        }
        s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
        if(s.kind==="enemy")continue;
        const e=state.enemies.find(e=>distance(s.x,s.y,e.x,e.y-27)<31);
        if(e){s.life=0;damageEnemy(e,s.who,s.kind,s.kind==="missile"?3:1);
          toy.bursts.push({x:s.x,y:s.y,born:toy.clock,kind:"spark"});continue;}
        const b=toy.boss;
        if(toy.phase==="boss"&&(inOval({x:s.x,y:s.y},b.x,b.y-125,68,100)||
          b.mode==="recover"&&distance(s.x,s.y,b.aimX,b.aimY-24)<43)){
          s.life=0;hitArmor(s.kind);toy.bursts.push({x:s.x,y:s.y,born:toy.clock,kind:"spark"});
        }
      }
      toy.shots=toy.shots.filter(s=>s.life>0&&s.x>-60&&s.x<W+60&&s.y>45&&s.y<H+60);
    }
    function hazards(){
      if(!fighting()||ghost()||state.resetQueued||climb)return;
      const air=flying({...player,role:role(),toyStatus:window.__uvzuGetToyStatus()});
      for(const s of toy.strikes){
        if(seenHazards.has(s.id))continue;seenHazards.add(s.id);
        // Impact is a single event, not a lingering damage zone. Once the fist
        // has landed safely, the player must be able to approach it and climb.
        if(toy.clock-s.born>.7||air&&s.kind!=="fist")continue;
        if(inOval(player,s.x,s.y,s.rx+14,s.ry+10))hurt(true);
      }
      for(const s of toy.shots)if(s.kind==="enemy"&&!seenHazards.has(s.id)&&distance(s.x,s.y,player.x,player.y-29-(air?45:0))<27){seenHazards.add(s.id);hurt();}
      if(!air&&toy.phase==="battle")for(const e of state.enemies)if(distance(e.x,e.y,player.x,player.y)<36){hurt();break;}
    }
    function guestActions(){
      if(!host())return;
      for(const p of players(true)){
        const c=toy.crews[p.role],s=p.toyStatus;
        if(s.loss!==c.loss){Object.assign(c,crew(),{loss:s.loss,seq:c.seq});delete toy.boss.walkers[p.role];}
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
        seenHazards.clear();seenKills.clear();seenGifts.clear();}
      toy=copy(data);for(const k of ["enemies","shots","strikes","gifts","kills","bursts"])toy[k]=list(toy[k]);
      toy.boss.walkers||={};toy.crews||={host:crew(),guest:crew()};
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
        if(fighting()){tickShots(dt);collectGifts();}
        if(toy.phase!=="lost")bossTick(dt);
        wakeBoss();
        toy.strikes=toy.strikes.filter(s=>toy.clock-s.born<1);
        toy.bursts=toy.bursts.filter(s=>toy.clock-s.born<.45);
      }else{
        state.enemies=toy.enemies;
        for(const e of state.enemies){e.x+=(e.vx||0)*dt;e.y+=(e.vy||0)*dt;}
        for(const s of toy.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;}
      }
      if(!climb){player.x=clamp(player.x,35,W-35);player.y=clamp(player.y,332,510);}
      walkArm(dt);hazards();
      const air=flying({...player,role:role(),toyStatus:window.__uvzuGetToyStatus()});
      if(wasFlying&&!air&&!ghost())player.invuln=Math.max(player.invuln,.45);wasFlying=air;
      player.ray=powerFor(role())==="laser"?Math.max(0,toy.crews[role()].until-toy.clock):0;
      rewardEffects();updateHud();syncMusic();
    };
    updateHud=function(){
      old.updateHud();if(!active())return;
      if(timeEl)timeEl.textContent=toy.phase==="battle"?toy.battleTime<DURATION?"Time: "+Math.ceil(DURATION-toy.battleTime)+"s":"Clear the remaining zombies":
        toy.phase==="won"?"Toy store saved!":"Nutcracker: "+Math.min(3,toy.boss.stage+1)+" / 3";
      const c=toy.crews[role()],power=powerFor(role());
      if(powerLabelEl)powerLabelEl.textContent=climb?climb.progress>=.96?"A / B: HIT HIS FACE!":"RUN UP THE ARM":
        power==="jet"?"JETPACK: "+Math.ceil(c.until-toy.clock)+"s · B: "+c.missiles+" missiles":
        power?(power==="fire"?"B: FIRE BREATH ":"B: LASER ")+Math.ceil(c.until-toy.clock)+"s":"A: ATTACK / DODGE · WALK TO OPEN GIFTS";
      if(powerFillEl)powerFillEl.style.width=(power?clamp((c.until-toy.clock)/POWER_SECONDS[power]*100,0,100):0)+"%";
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
      shelves(35,278);shelves(649,278,true);
      for(const [x,c]of[[113,"#bd7da0"],[817,"#76a4a4"]]){
        line(x,31,x,78,"#89796e",2);poly([[x-24,77],[x+24,77],[x+36,96],[x-36,96]],c);oval(x,96,34,5,"#ead6af");
        light(x,101,89,"#fff5c333");
      }
      ctx.beginPath();ctx.strokeStyle="#637b81";ctx.lineWidth=2;ctx.moveTo(0,44);ctx.quadraticCurveTo(480,139,960,44);ctx.stroke();
      for(let i=0;i<21;i++){const x=i*48,y=44+Math.sin(i/20*Math.PI)*43;star(x,y+8,7,["#e6bd67","#c77d91","#7db0b0"][i%3]);}
      // Woodgrain boards stay fixed while the statue and its presents move.
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
      if(side===b.side){
        if(b.mode==="fistWarn")return{x:b.aimX,y:b.aimY-110-clamp(b.timer/.5,0,1)*27};
        if(b.mode==="fistDown")return{x:b.aimX,y:b.aimY-8};
        if(b.arm&&["recover","recoil","fall"].includes(b.mode))return{x:b.arm.sx,y:b.arm.sy-armLift(b)-9};
      }
      return{x:b.x+side*94,y:b.y-99+(b.mode==="walk"?Math.sin(toy.clock*5)*side*9:0)};
    }
    function drawBoss(){
      const b=toy.boss;ctx.save();
      oval(b.x,b.y+6,113,24,"#3c3d5044");
      if(toy.phase==="won"){
        const t=clamp(toy.phaseTime/3.8,0,1);ctx.translate(b.x,b.y);ctx.rotate(t*t*1.30);ctx.translate(-b.x,-b.y);
      }
      // Art and the climbing path use the same endpoints, including the slow lift.
      for(const side of[-1,1]){
        const f=fistPose(side),extended=side===b.side&&["fistWarn","fistDown","recover","recoil","fall"].includes(b.mode);
        const sx=b.x+side*55,sy=b.y-157;
        line(sx,sy,f.x,f.y-16,"#54394a",32);line(sx,sy,f.x,f.y-16,"#b95458",25);
        line(sx-side*4,sy-4,f.x-side*4,f.y-20,"#dd7b68",6);
        if(extended&&b.arm&&b.mode==="recover"){
          const a=b.arm;line(a.sx,a.sy-armLift(b)-12,a.ex,a.ey-12,"#ffd788",3);
          for(let i=1;i<6;i++){const p=armPoint(b,i/6);line(p.x-7,p.y-11,p.x+7,p.y-11,"#6c3f49",2);}
        }
        box(f.x-20,f.y-28,40,9,"#e6b75f");box(f.x-21,f.y-19,42,25,"#d3ae88");
        box(f.x-18,f.y-18,29,20,"#f0cda3");box(f.x+13,f.y-15,8,17,"#b98f79");
        for(let i=0;i<3;i++)line(f.x-10+i*9,f.y-16,f.x-10+i*9,f.y-4,"#b88773",1);
      }
      for(const side of[-1,1]){
        const f=footPose(side);line(b.x+side*29,b.y-89,f.x,f.y-19,"#344351",30);
        line(b.x+side*27,b.y-88,f.x-3,f.y-20,"#edddbc",23);
        line(b.x+side*32,b.y-87,f.x+5,f.y-21,"#b4b09a",6);
        box(f.x-18,f.y-42,35,36,"#364958");box(f.x-17,f.y-41,8,31,"#607586");box(f.x-24,f.y-16,49,19,"#253440");
        box(f.x-24,f.y-17,43,4,"#4e6675");box(f.x-25,f.y,50,5,"#182b36");box(f.x-20,f.y-39,38,5,"#dfb671");
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
      const jaw=b.mode==="wake"||b.mode==="fistWarn"?3:0;
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
    function giftIcon(kind,x,y){
      if(kind==="fire"){poly([[x-9,y+5],[x-12,y-1],[x-4,y-13],[x-1,y-4],[x+7,y-17],[x+12,y-2],[x+5,y+7]],"#f3914f");poly([[x-4,y+4],[x,y-6],[x+5,y+4]],"#ffe58a");}
      else if(kind==="laser"){box(x-14,y-6,24,9,"#698fa8");box(x-5,y+1,7,10,"#486d89");box(x+9,y-4,7,5,"#a6e6e4");}
      else if(kind==="jet")rocket(x,y+10,.65);
      else star(x,y,10,"#eed486");
    }
    function drawGift(g){
      const t=clamp((toy.clock-g.born)/.7,0,1),x=lerp(g.fromX,g.x,t),y=lerp(g.fromY,g.y,t)-Math.sin(t*Math.PI)*55;
      oval(g.x,g.y+3,19,5,"#34435830");
      const colors=["#d87f91","#70adb2","#8c8abb","#ddaf63"],c=colors[g.n%4];
      const age=g.opened?toy.clock-g.openedAt:0;
      box(x-16,y-26,32,28,"#78556a");box(x-15,y-26,28,24,c);box(x-4,y-26,7,26,"#f4df9f");box(x-15,y-16,30,5,"#f4df9f");
      const lidY=y-30-(g.opened?age*32:0);box(x-19,lidY,38,7,c);box(x-4,lidY,7,7,"#fff0b7");
      if(g.opened){giftIcon(g.kind,x,y-38-age*28);for(let i=0;i<5;i++)star(x+Math.cos(i*1.26)*age*29,y-19+Math.sin(i*1.26)*age*22,3,"#ffe7a6");}
      else{line(x-1,lidY,x-11,lidY-8,"#fce8b5",3);line(x-11,lidY-8,x-12,lidY-2,"#fce8b5",3);line(x+1,lidY,x+11,lidY-9,"#fce8b5",3);}
    }
    function warning(x,y,rx,ry,kind){
      oval(x,y,rx,ry,kind==="arm"?"#91c9b333":"#ce575044");
      ctx.strokeStyle=kind==="arm"?"#eaffb7":"#ffe39b";ctx.lineWidth=2.5;ctx.setLineDash([7,5]);ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      if(kind!=="arm")text("!",x,y+7,22,"#fff2bb");
    }
    function drawPlayer(p){
      if(p.dead||p.ghost||p.lives<=0)return;
      const aboard=validWalker(p),air=flying(p),q=aboard?riderPosition(p):p;
      const y=q.y-(air?45+Math.sin(toy.clock*8)*3:0);
      if(air){oval(p.x,p.y+4,30,7,"#34415340");const bx=q.x-15*(p.face||1);
        poly([[bx-9,y-12],[bx,y+14+Math.sin(toy.clock*24)*5],[bx+9,y-12]],"#ec9261");poly([[bx-4,y-13],[bx,y+6],[bx+4,y-13]],"#fff0a3");}
      ctx.save();ctx.translate(0,y-p.y);
      if(p.role===role()){drawShieldAura();drawDodgeEffect();}
      drawUnicorn(p.x,p.y,p.face||1,false,p.ray>0,p.giant>0);
      if(air){box(p.x-21*(p.face||1)-8,p.y-33,17,24,"#476a84");box(p.x-21*(p.face||1)-5,p.y-32,11,19,"#c7d4cb");box(p.x-21*(p.face||1)-9,p.y-10,19,5,"#da9d67");}
      ctx.restore();
      if(host()||guest())text(p.role==="host"?"P1":"P2",q.x,y-77,12,p.role==="host"?"#ffe3a3":"#bbe8f0");
    }
    draw=function(){
      if(!active())return old.draw();ctx.save();background();const b=toy.boss;
      if(["stepWarn","stompWarn","fistWarn"].includes(b.mode)){
        if(b.mode==="stepWarn")warning(b.aimX,(b.fromY+b.aimY)/2,39,Math.abs(b.aimY-b.fromY)/2+29,"step");
        else warning(b.aimX,b.aimY,b.mode==="fistWarn"?51:44,b.mode==="fistWarn"?37:33,b.mode);
      }
      for(const s of toy.strikes){const age=toy.clock-s.born;if(age>.7)continue;
        ctx.globalAlpha=1-age/.7;ctx.strokeStyle="#efd6ae";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(s.x,s.y,s.rx+age*65,s.ry+age*29,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
      if(b.mode==="recover"&&b.arm&&toy.clock-b.arm.born<FIST_REST)warning(b.arm.sx,b.arm.sy,34,18,"arm");
      const actors=[{y:b.y,draw:drawBoss}];
      for(const g of toy.gifts)actors.push({y:g.y,draw:()=>drawGift(g)});
      for(const e of state.enemies)actors.push({y:e.y,draw:()=>{drawUnicorn(e.x,e.y,e.face,true,e.type==="ray",false);if(e.warning>0)text("!",e.x,e.y-70,20,"#ffe4aa");}});
      for(const p of players())actors.push({y:validWalker(p)?900:p.y,draw:()=>drawPlayer(p)});
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
      text(toy.phase==="battle"?"NEXT STEP: "+Math.max(0,Math.ceil(toy.nextStep-toy.battleTime))+"s · WATCH THE STEPPING PATH":"NUTCRACKER  ·  ROUND "+Math.min(3,b.stage+1)+" OF 3",480,65,11,"#d7e6d8");
      if(toy.phase==="won"){
        box(240,94,480,78,"#2c4857ed");text("THE TOY STORE IS SAFE!",480,125,24,"#ffe6a5");text("THAT'S ONE TOY THAT NEEDED A TIME-OUT.",480,152,12,"#e2ece1");
        for(let i=0;i<28;i++){const t=toy.phaseTime-1;if(t<0)break;const x=(i*151+25)%W,y=(t*(27+i%4*9)+i*31)%H;box(x,y,4,6,["#dc8996","#8cbbc2","#e6bc6b"][i%3]);}
      }else if(fighting()){
        let hint=noticeUntil>toy.clock?notice:toy.phase==="battle"?"A: ATTACK / DODGE  ·  WALK TO OPEN PRESENTS  ·  B: USE PICKUPS":
          b.mode==="recover"?climb?climb.progress>=.96?"A / B — STRIKE HIS FACE!":"KEEP RUNNING UP THE ARM!":
            toy.clock-b.arm.born<FIST_REST?"HIS FIST IS DOWN — RUN TOWARD THE GLOWING HAND!":"HE'S LIFTING HIS ARM — KEEP CLIMBING!":
          b.mode==="fistWarn"?"DODGE THE FIST. THEN RUN UP HIS ARM.":"AVOID HIS STOMPS. WATCH FOR THE FIST OPENING.";
        box(144,92,672,28,"#2c4857d9");text(hint,480,112,12,"#fff0b7");
        if(toy.phase!=="battle"&&b.mode==="recover"){
          const p=armPoint(b,.15);text("RUN UP",p.x,p.y+25,12,"#edffbe");
          text("FACE",b.x,b.y-260,12,"#fff5b9");
        }
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
    once('  requestAnimationFrame(loop);\n})();','('+toyRuntime.toString()+')();\n  requestAnimationFrame(loop);\n})();');return code;
  };
})();
