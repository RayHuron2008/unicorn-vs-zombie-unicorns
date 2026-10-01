// ICE10: frozen crossing. Load after lake-level.js and before game.js.
(() => {
  function iceRuntime() {
    const LEVEL="ICE10", TOTAL=30, ICE_POWER=5, FREEZE=5, BRIDGE_TIME=10, STAGES=3;
    const BRIDGE_SPEED=200, BRIDGE_FORM=.45, BACK_JUMP=.55, AIM_LOCK=.38, HEAD_X=-111, HEAD_Y=-70;
    const SETTINGS={
      Easy:{cap:3,gap:2.8,speed:47,warning:1.3},
      Normal:{cap:4,gap:2.45,speed:57,warning:1.12},
      Hard:{cap:5,gap:2.1,speed:67,warning:.95}
    };
    const active=()=>window.__uvzuCurrentLevelCode===LEVEL;
    const host=()=>!!window.__uvzuIsMultiplayerHost?.();
    const guest=()=>!!window.__uvzuIsMultiplayerGuest?.();
    const role=()=>guest()?"guest":"host";
    const ghost=()=>player.lives<=0||!!window.__uvzuIsLocalGhost?.();
    const tune=()=>SETTINGS[window.__uvzuCurrentDifficultyName]||SETTINGS.Easy;
    const copy=x=>JSON.parse(JSON.stringify(x));
    const list=x=>Array.isArray(x)?x.filter(Boolean):Object.values(x||{});
    const old={fullRestart,safeLifeReset,loseLife,update,spawnEnemy,updateEnemies,updateShots,
      updateEnding,startFinalWave,killEnemy,headbutt,handleAAction,playerShoot,draw,drawBackground,
      updateHud,startMusic,currentDirection,updateDodgeMovement};
    const session=()=>{const r=window.__uvzuTombTravelNetwork?.room?.()||{};
      return [r.createdAt||0,r.nextLevelAt||0,r.ghostResetAt||0].join(":");};
    const tileCoords=()=>[354,425,494].flatMap((y,row)=>[185,350,515,680,845].map((x,col)=>({
      id:row*5+col,x,y,stress:(row+col)%4===0?.14:0,brokenUntil:0
    })));
    let serial=0,lastPacket=0,hasSnapshot=false,nextSent=false,scenery=null;
    let seq=0,loss=0,freezeUntil=0,graceUntil=0,shotAt=0,hitFlash=0,bridgeWalk=null;
    let pending=[],dragonRetry=null;
    const seenBolts=new Set(),seenBlasts=new Set(),seenKills=new Set(),seenDefeats=new Set();
    const fresh=()=>({level:LEVEL,session:session(),run:Date.now()+"-"+(++serial),clock:0,
      phase:"battle",phaseTime:0,spawned:0,defeated:0,spawnTimer:1.15,event:0,
      enemies:[],tiles:tileCoords(),bolts:[],sinking:[],kills:[],power:{host:0,guest:0},
      acknowledged:{host:0,guest:0},dragon:null,dragonAttempt:0,
      dragonLosses:{host:false,guest:false},finished:false});
    let ice=fresh();
    const push=()=>{if(host())window.__uvzuMultiplayerPushEnemyState?.(state.enemies,true);};
    window.__uvzuGetIceState=()=>active()?{...ice,enemies:state.enemies}:null;
    window.__uvzuGetIceStatus=()=>active()?{level:LEVEL,run:ice.run,loss,freezeUntil,
      bridge:bridgeWalk?{id:bridgeWalk.id,progress:bridgeWalk.progress}:null,
      dragonRetry,actions:pending}:null;
    function stopMusic(){window.__uvzuStopMainMusic?.();window.stopTombMusic?.();}
    startMusic=function(){if(active())stopMusic();else old.startMusic();};
    const priorMusic=window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic=function(){priorMusic?.();if(active())stopMusic();};
    function resetPosition(){
      resetPlayerPosition();player.x=guest()?315:165;player.y=426;
      player.webbedTimer=player.webFlash=0;player.webTrapX=player.webTrapY=null;
      player.actionLock=Math.max(.2,player.actionLock||0);freezeUntil=0;bridgeWalk=null;graceUntil=ice.clock+1.3;
    }
    function initialize(){
      window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();
      if(host()||guest())player.lives=window.__uvzuTesterLifeBudget?.(5)??5;
      ice=fresh();state.enemies=ice.enemies;state.mode="play";state.time=0;
      loss=seq=shotAt=lastPacket=0;hasSnapshot=false;nextSent=false;pending=[];dragonRetry=null;
      seenBolts.clear();seenBlasts.clear();seenKills.clear();seenDefeats.clear();resetPosition();
      window.__uvzuLevelTheme="ice";stopMusic();updateHud();push();
    }
    fullRestart=function(){
      if(!active()){nextSent=false;return old.fullRestart();}
      if(guest()&&hasSnapshot&&ice.session===session()){
        window.__uvzuRequestEnemyKill?.("ice-retry-"+ice.run);return;
      }
      initialize();
    };
    function safeSpot(){
      const options=[{x:110,y:419},{x:270,y:465},{x:475,y:389},{x:765,y:472},{x:904,y:393}];
      return options.filter(p=>!ice.tiles.some(t=>t.brokenUntil>ice.clock&&onTile(p,t)))
        .sort((a,b)=>distance(b.x,b.y,ice.dragon?.x||0,ice.dragon?.y||0)-
          distance(a.x,a.y,ice.dragon?.x||0,ice.dragon?.y||0))[0]||{x:86,y:410};
    }
    safeLifeReset=function(){
      if(!active())return old.safeLifeReset();
      state.resetQueued=false;resetPosition();Object.assign(player,safeSpot());
      state.playerShots.length=state.enemyShots.length=0;
      state.mode=ice.phase==="battle"?"play":"final";
    };
    loseLife=function(){
      if(!active())return old.loseLife();
      const fightingDragon=!!ice.dragon&&["arrival","boss"].includes(ice.phase);
      const before=player.lives;old.loseLife();if(player.lives>=before)return;
      loss++;pending=[];freezeUntil=0;player.webbedTimer=player.webFlash=0;
      player.webTrapX=player.webTrapY=null;
      bridgeWalk=null;if(ice.dragon?.walkers)delete ice.dragon.walkers[role()];
      if((host()||guest())&&!ghost())safeLifeReset();
      if(!host()&&!guest()&&player.lives<=0)ice.phase="lost";
      if(fightingDragon){
        if(guest())dragonRetry={attempt:ice.dragonAttempt,loss};
        else if(host()){
          ice.dragonLosses.host=true;
          if(ice.dragonLosses.guest)initialize();
        }else if(!ghost())restartDragon();
      }
      window.__uvzuMultiplayerPush?.(player);push();
    };
    function resetDragonPlayer(){
      // Reset the encounter without restarting the level or refilling lives.
      bridgeWalk=null;freezeUntil=shotAt=hitFlash=0;pending=[];dragonRetry=null;
      seenBolts.clear();seenBlasts.clear();
      player.webbedTimer=player.webFlash=player.headTimer=player.dodgeTimer=0;
      player.webTrapX=player.webTrapY=null;state.resetQueued=false;
      state.playerShots.length=state.enemyShots.length=0;
      if(!ghost()){
        resetPosition();player.hp=HP_MAX;player.invuln=1.2;
        player.headCd=0;player.dodgeCooldown=player.actionLock=.25;
        player.aConsumed=!!(input.a||keys[" "]);
      }
    }
    function restartDragon(){
      if(host()||guest()||!ice.dragon||!["arrival","boss"].includes(ice.phase))return;
      ice.tiles=tileCoords();ice.sinking=[];ice.power={host:0,guest:0};ice.finished=false;
      state.enemies.length=0;resetDragonPlayer();newDragon();
      window.__uvzuMultiplayerPush?.(player);updateHud();push();
    }
    function players(all=false){
      const result=[{...player,role:role(),dead:ghost(),iceStatus:window.__uvzuGetIceStatus()}];
      const p=window.__uvzuGetRemotePlayer?.();
      if((host()||guest())&&p?.iceStatus?.run===ice.run&&Number.isFinite(p.x)&&Number.isFinite(p.y))
        result.push({...p,role:guest()?"host":"guest",dead:!!p.dead||!!p.ghost||p.lives<=0});
      return all?result:result.filter(p=>!p.dead);
    }
    const nearest=(x,y)=>players().sort((a,b)=>distance(a.x,a.y,x,y)-distance(b.x,b.y,x,y))[0];
    const bridgePoint=(b,t)=>({x:lerp(b.sx,b.ex,t),y:lerp(b.sy,b.ey,t)});
    function jumpPoint(d,w){
      const b=d.bridge,returning=Number.isFinite(w.returnAt);
      const t=clamp((ice.clock-(returning?w.returnAt:w.jumpAt))/BACK_JUMP,0,1);
      const from=returning?w.returnFrom:{x:b.ex,y:b.ey};
      const to=returning?{x:b.ex,y:b.ey}:{x:b.backX,y:b.backY};
      return {x:lerp(from.x,to.x,t),y:lerp(from.y,to.y,t)-Math.sin(t*Math.PI)*48};
    }
    function bridgeRider(p){
      const d=ice.dragon,b=d?.bridge,s=p.iceStatus?.bridge,w=d?.walkers?.[p.role];
      if(!b||s?.id!==b.id||w?.loss!==p.iceStatus?.loss)return null;
      return w;
    }
    function onBridge(p){
      const d=ice.dragon,b=d?.bridge,s=p.iceStatus?.bridge;
      const w=bridgeRider(p);
      if(w&&["bridge","retreat","fall"].includes(d.mode))return true;
      const point=b&&s?bridgePoint(b,clamp(s.progress,0,1)):null;
      return !!(b&&s?.id===b.id&&["bridge","retreat","fall"].includes(d.mode)&&
        distance(p.x,p.y,point.x,point.y)<34);
    }
    function riderPosition(p){
      const d=ice.dragon,w=bridgeRider(p);
      if(!w||!["bridge","retreat","fall"].includes(d.mode))return p;
      if(Number.isFinite(w.jumpAt)&&(!Number.isFinite(w.returnAt)||ice.clock-w.returnAt<BACK_JUMP))
        return jumpPoint(d,w);
      return bridgePoint(d.bridge,clamp(p.iceStatus.bridge.progress,0,1));
    }
    const localRider=()=>bridgeWalk&&ice.dragon?.walkers?.[role()];
    const atMouth=()=>bridgeWalk?.progress>=.995&&ice.dragon?.mode==="bridge"&&
      !Number.isFinite(localRider()?.jumpAt);
    const onBack=()=>bridgeWalk&&ice.dragon?.mode==="bridge"&&
      Number.isFinite(localRider()?.jumpAt)&&ice.clock>=localRider().jumpAt+BACK_JUMP;
    function onTile(p,t){return Math.abs(p.x-t.x)<46&&Math.abs(p.y-t.y)<26;}
    function tileUnder(p){return ice.tiles.find(t=>onTile(p,t));}
    function fall(){
      if(ghost()||ice.clock<graceUntil||state.resetQueued||ice.phase==="won")return;
      // A hole means instant death even at full health or with a shield.
      player.invuln=0;player.hp=0;player.dodgeTimer=0;
      state.mode=ice.phase==="battle"?"play":"final";loseLife();
    }
    function hurt(freeze=true){
      if(ghost()||ice.clock<graceUntil||player.invuln>0||player.dodgeTimer>0)return;
      if(shieldBlockLaser())return;
      player.hp--;hitFlash=.5;player.headbuttStreak=0;player.regenTimer=HEALTH_REGEN_TIME;
      addParticles(player.x,player.y-24,"red");
      if(player.hp<=0){player.invuln=0;loseLife();return;}
      player.invuln=.42;
      if(freeze){freezeUntil=ice.clock+FREEZE;player.webbedTimer=FREEZE;
        player.webTrapX=player.x;player.webTrapY=player.y;player.actionLock=FREEZE;
        player.headTimer=player.dodgeTimer=0;}
      window.__uvzuMultiplayerPush?.(player);
    }
    function thaw(){
      if(ice.clock<freezeUntil&&!ghost()){
        player.webbedTimer=Math.max(player.webbedTimer||0,freezeUntil-ice.clock);
        player.webTrapX??=player.x;player.webTrapY??=player.y;
      }else if(freezeUntil){freezeUntil=0;player.webbedTimer=0;
        player.webTrapX=player.webTrapY=null;player.actionLock=0;}
    }
    function enemyDead(i,who="ice"){
      const e=state.enemies.splice(i,1)[0];if(!e)return;
      ice.kills.push({id:e.id,who,kind:e.type,x:e.x,y:e.y,born:ice.clock});ice.defeated++;
      if(who==="ice")ice.sinking.push({x:e.x,y:e.y,born:ice.clock});
      if(e.type==="iceShooter"&&(who==="host"||who==="guest"))ice.power[who]=ice.clock+ICE_POWER;
      if(who===role()){state.score+=30;seenKills.add(e.id);}
      defeatEffects();push();
    }
    function defeatEffects(){
      for(const k of ice.kills){
        if(seenDefeats.has(k.id))continue;seenDefeats.add(k.id);
        if(ice.clock-k.born>.8||k.who==="ice")continue;
        addParticles(k.x,k.y-20,k.kind==="iceShooter"?"rainbow":"red");
      }
    }
    function strikeEnemy(e,who,amount=1){
      const i=state.enemies.findIndex(x=>x.id===e?.id);if(i<0)return;
      state.enemies[i].hp-=amount;state.enemies[i].flash=.25;
      if(state.enemies[i].hp<=0)enemyDead(i,who);else push();
    }
    function nearbyEnemy(p){
      return state.enemies.filter(e=>(e.x-p.x)*(p.face||1)>-22&&Math.abs(e.y-p.y)<55)
        .sort((a,b)=>distance(a.x,a.y,p.x,p.y)-distance(b.x,b.y,p.x,p.y))[0];
    }
    function accept(a,who,p){
      if(!a||!p||!ice.acknowledged||a.seq<=ice.acknowledged[who])return;
      ice.acknowledged[who]=a.seq;
      if(!["battle","arrival","boss"].includes(ice.phase)||p.dead||p.iceStatus?.loss!==a.loss||
        Math.abs(ice.clock-a.at)>1.5||distance(p.x,p.y,a.x,a.y)>95||
        p.iceStatus?.freezeUntil>ice.clock)return;
      if(ice.dragon&&a.dragonAttempt!==ice.dragonAttempt)return;
      const d=ice.dragon;
      if(a.kind==="bridgeEnter"){
        const b=d?.bridge;
        if(d?.mode==="bridge"&&b&&a.bridgeId===b.id&&d.stage<STAGES&&
          distance(a.x,a.y,b.sx,b.sy)<48&&distance(p.x,p.y,b.sx,b.sy)<72){
          d.walkers[who]={enteredAt:ice.clock,loss:a.loss};push();
        }
      }else if(a.kind==="bridgeJump"){
        const b=d?.bridge,w=d?.walkers?.[who],s=p.iceStatus?.bridge;
        if(d?.mode==="bridge"&&b&&w&&s?.id===b.id&&s.progress>=.995&&
          a.bridgeId===b.id&&w.loss===a.loss&&!Number.isFinite(w.jumpAt)&&
          distance(a.x,a.y,b.ex,b.ey)<26&&
          ice.clock-w.enteredAt>=b.length/BRIDGE_SPEED-.28){
          w.jumpAt=ice.clock;push();
        }
      }else if(a.kind==="strike"){
        const b=d?.bridge,w=d?.walkers?.[who],s=p.iceStatus?.bridge;
        if(d?.mode==="bridge"&&b&&w&&s?.id===b.id&&a.bridgeId===b.id&&
          w.loss===a.loss&&!d.hit&&Number.isFinite(w.jumpAt)&&ice.clock>=w.jumpAt+BACK_JUMP&&
          distance(p.x,p.y,b.backX,b.backY)<26){
          for(const walker of Object.values(d.walkers))if(Number.isFinite(walker.jumpAt)){
            walker.returnFrom=jumpPoint(d,walker);walker.returnAt=ice.clock;
          }
          d.hit=true;d.stage++;d.flash=.8;d.mode=d.stage>=STAGES?"fall":"retreat";
          d.timer=Math.max(d.stage>=STAGES?4:1.6,b.length/BRIDGE_SPEED+BACK_JUMP+.5);
          if(d.stage>=STAGES)d.fallDuration=d.timer;
          d.normal=0;ice.phase=d.stage>=STAGES?"won":"boss";
          ice.phaseTime=0;
          if(ice.phase==="won"){state.enemies.length=0;ice.bolts.length=0;state.mode="iceWin";}
          push();
        }
      }else if(a.kind==="head"&&ice.phase==="battle"){
        const target=state.enemies.filter(e=>Math.abs(e.x-(p.x+(p.face||1)*38))<55&&Math.abs(e.y-p.y)<49)
          .sort((u,v)=>distance(u.x,u.y,p.x,p.y)-distance(v.x,v.y,p.x,p.y))[0];
        if(target)strikeEnemy(target,who);
      }else if(a.kind==="shoot"&&ice.phase==="battle"&&ice.clock<ice.power[who]){
        const aim=nearbyEnemy(p),mx=p.x+(p.face||1)*58,my=p.y-35;
        const dx=(aim?.x??p.x+(p.face||1)*460)-mx;
        const dy=(aim?.y??p.y)-35-my,len=Math.hypot(dx,dy)||1;
        ice.bolts.push({id:ice.run+"-friendly-"+who+"-"+a.seq,team:who,
          x:mx,y:my,vx:dx/len*410,vy:dy/len*340,
          life:1.6,born:ice.clock});push();
      }
    }
    function act(kind){
      const a={seq:++seq,kind,loss,at:ice.clock,x:player.x,y:player.y,
        dragonAttempt:ice.dragonAttempt,bridgeId:bridgeWalk?.id||null};
      if(guest())pending.push(a);else accept(a,role(),{...player,role:role(),iceStatus:window.__uvzuGetIceStatus()});
      window.__uvzuMultiplayerPush?.(player);
    }
    // Walk to the mouth along the ramp, then A hops onto the back.
    currentDirection=function(){return active()&&bridgeWalk?{dx:0,dy:0}:old.currentDirection();};
    updateDodgeMovement=function(dt){
      if(active()&&bridgeWalk){player.dodgeTimer=0;return true;}
      return old.updateDodgeMovement(dt);
    };
    function leaveBridge(drop=false){
      const b=ice.dragon?.bridge;
      if(drop&&b&&bridgeWalk)player.y=clamp(lerp(b.sy,ice.dragon.y+34,bridgeWalk.progress),330,510);
      bridgeWalk=null;player.dodgeTimer=0;window.__uvzuMultiplayerPush?.(player);
    }
    function walkBridge(dt){
      const d=ice.dragon,b=d?.bridge,dir=old.currentDirection();
      if(bridgeWalk&&(!b||bridgeWalk.id!==b.id||!["bridge","retreat","fall"].includes(d.mode)||ghost())){
        leaveBridge(true);return;
      }
      if(!bridgeWalk){
        if(d?.mode!=="bridge"||!b||ice.clock-b.born<BRIDGE_FORM||ghost()||
          ice.clock<freezeUntil||player.dodgeTimer>0)return;
        const toward=(dir.dx*(b.ex-b.sx)+dir.dy*(b.ey-b.sy))/b.length;
        if(distance(player.x,player.y,b.sx,b.sy)>38||toward<=.15)return;
        bridgeWalk={id:b.id,progress:0,entrySeq:seq+1};act("bridgeEnter");
        player.headTimer=player.dodgeTimer=0;
      }
      if(guest()&&d.mode==="bridge"&&!d.walkers?.guest&&
        (ice.acknowledged?.guest||0)>=bridgeWalk.entrySeq){leaveBridge(true);return;}
      const rider=d.walkers?.[role()];
      if(rider&&Number.isFinite(rider.jumpAt)&&
        (d.mode==="bridge"||(Number.isFinite(rider.returnAt)&&ice.clock-rider.returnAt<BACK_JUMP))){
        Object.assign(player,jumpPoint(d,rider));
        player.face=d.mode==="bridge"?1:-1;player.dodgeTimer=0;return;
      }
      const toward=(dir.dx*(b.ex-b.sx)+dir.dy*(b.ey-b.sy))/b.length;
      const speed=d.mode==="bridge"?toward:-1;
      bridgeWalk.progress=clamp(bridgeWalk.progress+speed*BRIDGE_SPEED*dt/b.length,0,1);
      Object.assign(player,bridgePoint(b,bridgeWalk.progress));
      if(Math.abs(speed)>.02)player.face=speed>0?1:-1;
      if(bridgeWalk.progress===0&&speed<0)leaveBridge();
    }
    handleAAction=function(){
      if(!active())return old.handleAAction();
      if(bridgeWalk){
        // The base game clamps ground movement before this hook; keep raised feet on the ice.
        Object.assign(player,riderPosition({...player,role:role(),iceStatus:window.__uvzuGetIceStatus()}));
        if(!(input.a||keys[" "]))player.aConsumed=false;
        else if(!player.aConsumed){
          player.aConsumed=true;
          if(onBack())headbutt();else if(atMouth())act("bridgeJump");
        }
        return;
      }
      if(ice.clock<freezeUntil){if(!(input.a||keys[" "]))player.aConsumed=false;return;}
      old.handleAAction();
    };
    headbutt=function(){
      if(!active())return old.headbutt();
      if(ghost()||ice.clock<freezeUntil||player.headCd>0||player.actionLock>0||player.dodgeTimer>0)return;
      player.headCd=.28;player.headTimer=.15;player.actionLock=.08;
      if(onBack())act("strike");else if(ice.phase==="battle")act("head");
    };
    playerShoot=function(){
      if(!active())return old.playerShoot();
      if(ghost()||ice.clock<freezeUntil||ice.clock<shotAt)return;
      if(onBack()){shotAt=ice.clock+.3;player.headTimer=.18;act("strike");return;}
      if(ice.phase!=="battle"||ice.power[role()]<=ice.clock)return;
      shotAt=ice.clock+.38;act("shoot");
    };
    spawnEnemy=function(...args){if(!active())return old.spawnEnemy(...args);};
    updateShots=function(dt){if(!active())return old.updateShots(dt);};
    updateEnding=function(dt){if(!active())return old.updateEnding(dt);};
    killEnemy=function(i,reason){if(!active())return old.killEnemy(i,reason);
      // Base multiplayer death events never bypass ICE10's thirty-enemy tally.
      if(!guest()&&reason!=="remote"&&ice.phase==="battle")strikeEnemy(state.enemies[i],role());
    };
    startFinalWave=function(){if(!active())return old.startFinalWave();};
    function spawn(){
      if(guest()||ice.phase!=="battle"||ice.spawned>=TOTAL||state.enemies.length>=tune().cap)return false;
      const n=ice.spawned++,right=n%2===1,isIce=n%5===2;
      state.enemies.push({id:"ice-zombie-"+ice.run+"-"+n,type:isIce?"iceShooter":"normal",
        x:right?W+40:-40,y:[422,474,370,493,412][n%5],w:54,h:45,
        hp:isIce?2:1,face:right?-1:1,vx:0,vy:0,sep:1,flash:0,
        shootTimer:2.7+(n%3)*.8,shotWarning:0,targetX:0,targetY:0});return true;
    }
    function tickEnemies(dt){
      for(const e of state.enemies){
        e.flash=Math.max(0,e.flash-dt);
        const p=nearest(e.x,e.y);if(!p)continue;
        const dx=p.x-e.x,dy=p.y-e.y;e.face=dx>=0?1:-1;
        const range=e.type==="iceShooter"?195:48;
        if(Math.abs(dx)>range||Math.abs(dy)>43){const dist=Math.hypot(dx,dy)||1;
          e.vx=dx/dist*tune().speed;e.vy=dy/dist*tune().speed*.72;
          e.x=clamp(e.x+e.vx*dt,33,W-33);e.y=clamp(e.y+e.vy*dt,333,509);
        }else{e.vx=e.vy=0;}
        if(e.type==="iceShooter"){
          if(e.shotWarning>0){e.shotWarning-=dt;
            if(e.shotWarning<=0){const mx=e.x+e.face*58,my=e.y-35;
              const x=e.targetX-mx,y=e.targetY-my,m=Math.hypot(x,y)||1;
              ice.bolts.push({id:ice.run+"-enemy-"+(++ice.event),team:"enemy",x:mx,y:my,
                vx:x/m*255,vy:y/m*255,life:3.4,born:ice.clock});e.lastShot=ice.clock;e.shootTimer=4.1;push();}
          }else if((e.shootTimer-=dt)<=0){e.shotWarning=tune().warning;
            e.targetX=clamp(p.x,30,W-30);e.targetY=clamp(p.y,333,508)-31;push();}
        }
      }
    }
    updateEnemies=function(dt){if(!active())return old.updateEnemies(dt);
      if(!guest()&&ice.phase==="battle")tickEnemies(dt);
    };
    function tiles(dt){
      if(guest()||ice.phase==="won")return;
      const actors=[...players().filter(p=>!onBridge(p)),...state.enemies];
      for(const t of ice.tiles){
        if(t.brokenUntil){if(ice.clock>=t.brokenUntil){t.brokenUntil=0;t.stress=0;}continue;}
        const feet=actors.filter(p=>onTile(p,t));
        if(feet.length)t.stress=Math.min(1,t.stress+dt*(.15+feet.filter(p=>p.role).length*.19));
        else t.stress=Math.max(0,t.stress-dt*.035);
        if(t.stress>=1){t.brokenUntil=ice.clock+7.4;t.stress=1;push();}
      }
      for(let i=state.enemies.length-1;i>=0;i--){
        const t=tileUnder(state.enemies[i]);
        if(t?.brokenUntil>ice.clock)enemyDead(i,"ice");
      }
    }
    function tickBolts(dt){
      if(guest()||ice.phase!=="battle")return;
      for(const b of ice.bolts){
        b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
        if(b.team==="enemy")continue;
        const target=state.enemies.find(e=>Math.abs(e.x-b.x)<30&&Math.abs(e.y-30-b.y)<35);
        if(target){strikeEnemy(target,b.team);b.life=0;}
      }
      ice.bolts=ice.bolts.filter(b=>b.life>0&&b.x>-35&&b.x<W+35&&b.y>280&&b.y<H+30);
    }
    function newDragon(){
      ice.phase="arrival";ice.phaseTime=0;ice.bolts=[];
      ice.dragonAttempt=(ice.dragonAttempt||0)+1;
      ice.dragonLosses={host:false,guest:false};
      ice.dragon={x:802,y:417,stage:0,normal:0,mode:"arrival",timer:2.3,
        bridge:null,walkers:{},hit:false,flash:0,blastId:0,
        aim:{x:165,y:397},headFace:-1,headAngle:0,locked:false};
      state.mode="final";push();
    }
    function aimAtPlayer(d){
      const targets=players(),p=targets.find(p=>p.role===d.targetRole)||nearest(d.x,d.y);
      if(!p)return;
      d.targetRole=p.role;d.aim={x:p.x,y:p.y-29};
      const dx=d.aim.x-(d.x+HEAD_X),dy=d.aim.y-(d.y+HEAD_Y);
      d.headFace=dx<0?-1:1;
      const angle=Math.atan2(dy,dx)-Math.atan2(22,d.headFace*55);
      d.headAngle=Math.atan2(Math.sin(angle),Math.cos(angle));
    }
    function warnDragon(d,supercharged=false){
      d.mode=supercharged?"superWarn":"warn";d.timer=supercharged?1.6:tune().warning;
      d.locked=false;
      // Alternate living players in multiplayer, then follow that player during the wind-up.
      const targets=players().sort((a,b)=>a.role.localeCompare(b.role));
      d.targetRole=targets[d.blastId%Math.max(1,targets.length)]?.role;
      aimAtPlayer(d);push();
    }
    function dragonMouth(d){
      const a=d.headAngle||0,vx=(d.headFace||-1)*55,vy=22;
      return {x:d.x+HEAD_X+vx*Math.cos(a)-vy*Math.sin(a),
        y:d.y+HEAD_Y+vx*Math.sin(a)+vy*Math.cos(a)};
    }
    function breathRay(d){
      const mouth=dragonMouth(d),dx=d.aim.x-(d.x+HEAD_X),dy=d.aim.y-(d.y+HEAD_Y);
      const len=Math.hypot(dx,dy)||1;
      return {...mouth,dx:dx/len,dy:dy/len,length:1250};
    }
    function breathHits(d,p){
      const ray=breathRay(d),dx=p.x-ray.x,dy=p.y-29-ray.y;
      const along=dx*ray.dx+dy*ray.dy,across=Math.abs(dx*ray.dy-dy*ray.dx);
      return along>=-18&&along<=ray.length&&across<(d.mode==="superBlast"?34:28);
    }
    function makeBridge(d){
      const sx=clamp(d.aim.x,80,d.x-325),sy=clamp(d.aim.y+29,351,495);
      const mouth=dragonMouth(d),ex=mouth.x,ey=mouth.y-13;
      d.bridge={id:ice.run+"-dragon-"+ice.dragonAttempt+"-bridge-"+d.blastId,sx,sy,ex,ey,born:ice.clock,
        backX:d.x-26,backY:d.y-71,length:Math.hypot(ex-sx,ey-sy)};
      d.walkers={};d.hit=false;d.mode="bridge";d.timer=BRIDGE_TIME;push();
    }
    function dragonTick(dt){
      const d=ice.dragon;if(!d||ice.phase==="lost")return;
      d.timer-=dt;d.flash=Math.max(0,d.flash-dt);
      if(d.mode==="arrival"){if(d.timer<=0){ice.phase="boss";warnDragon(d);}return;}
      if(d.mode==="warn"||d.mode==="superWarn"){
        if(!d.locked){aimAtPlayer(d);if(d.timer<=AIM_LOCK){d.locked=true;push();}}
        if(d.timer<=0){d.mode=d.mode==="superWarn"?"superBlast":"blast";
          d.timer=d.mode==="superBlast"?.65:.72;d.blastId++;push();}return;
      }
      if(d.mode==="blast"){
        if(d.timer<=0){d.normal++;d.mode="recover";d.timer=1.03;push();}return;
      }
      if(d.mode==="superBlast"){if(d.timer<=0)makeBridge(d);return;}
      if(d.mode==="recover"){
        if(d.timer<=0){
          warnDragon(d,d.normal>=3);
        }return;
      }
      if(d.mode==="retreat"){
        if(d.timer<=0){d.bridge=null;d.walkers={};d.mode="recover";d.timer=.8;push();}return;
      }
      if(d.mode==="bridge"&&d.timer<=0){
        d.walkers={};d.normal=0;d.mode="recover";d.timer=1.2;push();
      }
      if(d.mode==="fall"&&d.timer<=0){d.mode="fallen";d.walkers={};ice.finished=true;
        if(host())window.__uvzuSignalLevelCompleted?.();push();}
    }
    function hazards(){
      if(ghost()||ice.phase==="won"||ice.phase==="lost"||state.resetQueued)return;
      const d=ice.dragon;
      if(bridgeWalk&&onBridge({...player,iceStatus:window.__uvzuGetIceStatus()}))return;
      const tile=tileUnder(player);
      if(tile?.brokenUntil>ice.clock){fall();return;}
      for(const b of ice.bolts){
        if(b.team!=="enemy"||seenBolts.has(b.id)||ice.clock-b.born>3.5)continue;
        if(Math.hypot((player.x-b.x)/27,(player.y-29-b.y)/25)<1){seenBolts.add(b.id);hurt();}
      }
      if(["blast","superBlast"].includes(d?.mode)&&!seenBlasts.has(d.blastId)&&breathHits(d,player)){
        seenBlasts.add(d.blastId);hurt();
      }
      if(ice.phase==="battle")for(const e of state.enemies){
        if(distance(e.x,e.y,player.x,player.y)<37&&player.invuln<=0){hurt(false);break;}
      }
    }
    function guestActions(){
      if(!host())return;const p=players(true).find(p=>p.role==="guest");if(!p)return;
      for(const a of list(p.iceStatus?.actions).sort((a,b)=>a.seq-b.seq))accept(a,"guest",p);
    }
    function received(){
      if(!guest())return;
      const packet=window.__uvzuGetMultiplayerEnemyState?.(),data=packet?.ice;
      if(!data||data.level!==LEVEL||data.session!==session()||packet.updatedAt<=lastPacket)return;
      const reset=data.run!==ice.run,priorAttempt=ice.dragonAttempt||0;
      if(reset){window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();
        player.lives=window.__uvzuTesterLifeBudget?.(5)??5;
        loss=seq=shotAt=0;pending=[];dragonRetry=null;
        seenBolts.clear();seenBlasts.clear();seenKills.clear();seenDefeats.clear();
        resetPosition();stopMusic();}
      ice=copy(data);for(const key of ["enemies","tiles","bolts","sinking","kills"])ice[key]=list(ice[key]);
      if(!reset&&priorAttempt>0&&ice.dragonAttempt>priorAttempt){
        resetDragonPlayer();window.__uvzuMultiplayerPush?.(player);
      }
      state.enemies=ice.enemies;state.time=0;lastPacket=packet.updatedAt;hasSnapshot=true;
      pending=pending.filter(a=>a.seq>(ice.acknowledged?.guest||0));
      defeatEffects();
      for(const k of ice.kills)if(k.who===role()&&!seenKills.has(k.id)){
        seenKills.add(k.id);state.score+=30;
      }
    }
    function receiveRetry(){
      if(!host())return false;const id="ice-retry-"+ice.run;
      if(!window.__uvzuGetGuestKillRequests?.()?.[id])return false;
      window.__uvzuClearGuestKillRequest?.(id);initialize();return true;
    }
    function receiveDragonRetry(){
      if(!host()||!ice.dragon||!["arrival","boss"].includes(ice.phase))return false;
      const p=players(true).find(p=>p.role==="guest"),request=p?.iceStatus?.dragonRetry;
      if(!request||request.attempt!==ice.dragonAttempt||request.loss!==p.iceStatus.loss||
        request.loss<=0||ice.dragonLosses.guest)return false;
      ice.dragonLosses.guest=true;
      if(ice.dragonLosses.host){initialize();return true;}
      push();return false;
    }
    function continueLake(){
      if(window.__uvzuCurrentLevelCode!=="LAKE9"||guest()||nextSent)return;
      const prev=window.__uvzuGetLakeState?.();
      if(!prev?.finished||prev.phaseTime<5.5)return;
      nextSent=true;
      if(host())window.__uvzuSignalNextLevel?.(LEVEL);
      else{window.__uvzuCurrentLevelCode=LEVEL;window.__uvzuLevelTheme="ice";
        window.__uvzuUpdateLevelMusic?.();fullRestart();}
    }
    update=function(dt){
      if(!active()){old.update(dt);continueLake();return;}
      const travel=window.__uvzuGetNextLevelSignal?.(),resetAt=window.__uvzuGetGhostResetAt?.();
      if((travel?.at&&travel.at!==window.__uvzuLastAppliedNextLevelAt)||
        (resetAt&&resetAt!==window.__uvzuLastAppliedGhostResetAt)){old.update(dt);return;}
      received();if(receiveRetry()||receiveDragonRetry())return;guestActions();
      const run=ice.run;
      state.mode=ice.phase==="won"||ice.phase==="lost"?"iceScene":ice.phase==="battle"?"play":"final";
      old.update(dt);if(!active()||ice.run!==run)return;
      ice.clock+=dt;ice.phaseTime+=dt;hitFlash=Math.max(0,hitFlash-dt);
      player.x=clamp(player.x,35,W-35);
      player.y=clamp(player.y,330,510);thaw();
      if(!guest()){
        ice.enemies=state.enemies;
        if(ice.phase==="battle"){
          ice.spawnTimer-=dt;if(ice.spawnTimer<=0&&spawn())ice.spawnTimer=tune().gap;
          tickBolts(dt);
          if(ice.spawned>=TOTAL&&ice.defeated>=TOTAL&&state.enemies.length===0)newDragon();
        }
        if(ice.phase==="battle"||ice.phase==="arrival"||ice.phase==="boss")tiles(dt);
        ice.sinking=ice.sinking.filter(e=>ice.clock-e.born<1.25);
        dragonTick(dt);
      }else{
        state.enemies=ice.enemies;
        for(const e of state.enemies){e.x+=(e.vx||0)*dt;e.y+=(e.vy||0)*dt;}
      }
      walkBridge(dt);hazards();updateHud();
    };
    updateHud=function(){
      old.updateHud();if(!active())return;
      if(timeEl)timeEl.textContent=ice.dragon?"Dragon: "+ice.dragon.stage+" / "+STAGES:
        "Zombies: "+ice.defeated+" / "+TOTAL;
      if(powerLabelEl)powerLabelEl.textContent=ice.clock<freezeUntil?
        "Frozen: "+Math.ceil(freezeUntil-ice.clock)+"s":onBack()?"A / B: STRIKE!":
        atMouth()?"A: Jump onto his back":bridgeWalk?"Walk across the ice":
        ice.power[role()]>ice.clock?"B: Ice breath "+Math.ceil(ice.power[role()]-ice.clock)+"s":"A: Attack";
      if(powerFillEl)powerFillEl.style.width=(ice.power[role()]>ice.clock?
        clamp((ice.power[role()]-ice.clock)/ICE_POWER*100,0,100):0)+"%";
    };

    const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
    function oval(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
    function poly(coords,color){ctx.fillStyle=color;ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}
    function line(x,y,u,v,color,width=2){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke();}
    function label(value,x,y,size=19,color="#f4fbff"){
      ctx.font="900 "+size+"px system-ui,sans-serif";ctx.textAlign="center";ctx.lineJoin="round";
      ctx.lineWidth=4;ctx.strokeStyle="#174065";ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);
    }
    function snowPine(x,y,s,far=false){
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);
      box(-4,-39,8,45,far?"#7094b2":"#435d80");
      for(let tier=0;tier<5;tier++){
        const top=-112+tier*20,w=12+tier*8;
        poly([[0,top],[-w,top+30],[-w*.58,top+27],[-w*1.17,top+41],
          [-w*.1,top+36],[w*.68,top+40],[w*.53,top+28],[w,top+31]],far?"#87aec5":"#487e97");
        poly([[0,top-3],[-w*.83,top+24],[-w*.27,top+19],[-w*.56,top+28],
          [0,top+25],[w*.51,top+28],[w*.28,top+21],[w*.8,top+24]],far?"#d5eaf1":"#e1f5f4");
        line(-w*.34,top+25,w*.4,top+29,far?"#adcbdc":"#9ec8d8",2);
      }
      oval(0,3,47,7,"#e9f8f6");ctx.restore();
    }
    function crystal(x,y,s=1){
      poly([[x-8*s,y],[x-11*s,y-19*s],[x-3*s,y-35*s],[x+7*s,y-26*s],[x+10*s,y-4*s]],"#6095be");
      poly([[x-8*s,y-4*s],[x-9*s,y-20*s],[x-3*s,y-34*s],[x-2*s,y-10*s]],"#d6faff");
      poly([[x-2*s,y-10*s],[x-3*s,y-34*s],[x+7*s,y-26*s],[x+5*s,y-4*s]],"#a0ddec");
      line(x-3*s,y-31*s,x+5*s,y-25*s,"#f4ffff",2);
    }
    function kingdom(){
      // Small buildings, masonry and spires keep the kingdom in the distance.
      poly([[560,273],[580,255],[614,248],[661,234],[703,230],[756,238],[808,250],[848,272]],"#7e9cb9");
      poly([[574,262],[630,243],[691,225],[757,240],[824,260],[794,269],[624,268]],"#e1edf6");
      for(const [x,y,w,h] of [[602,218,24,41],[784,210,27,51],[630,198,30,58],[753,191,23,67]]){
        box(x,y,w,h,"#7198b5");box(x,y,w*.55,h,"#b7d6e4");
        poly([[x-4,y],[x+w*.5,y-19],[x+w+4,y]],"#f0fbff");
        box(x+8,y+13,5,9,"#f7e9bd");
      }
      box(627,205,157,66,"#84a9c0");box(635,211,141,49,"#afcfdd");
      for(let i=0;i<10;i++){
        const x=628+i*16;
        box(x,198,9,13,"#ddf4f9");box(x+5,202,4,9,"#9bbdd3");
      }
      for(const [x,y,w,h] of [[645,159,32,110],[680,124,48,142],[737,169,31,103]]){
        box(x-2,y,w+4,h,"#6788a8");box(x,y,w,h,"#bedce7");
        box(x+w*.59,y,w*.41,h,"#86aac5");box(x+3,y+6,4,h-8,"#e8faff");
        poly([[x-8,y+2],[x+w/2,y-45],[x+w+8,y+2]],"#426d9c");
        poly([[x-7,y],[x+w/2,y-44],[x+w/2-2,y-3]],"#c5edfa");
        poly([[x+w/2,y-44],[x+w/2+6,y-9],[x+w+4,y]],"#80b1d0");
        line(x+w/2,y-46,x+w/2,y-57,"#e2faff",2);
        poly([[x+w/2+1,y-56],[x+w/2+14,y-51],[x+w/2+1,y-47]],"#9bace6");
        box(x-5,y+2,w+10,5,"#effdff");
        for(let row=0;row<4;row++){
          const yy=y+19+row*22;if(yy>y+h-17)continue;
          for(let col=0;col<2;col++){
            const xx=x+8+col*(w-19);
            box(xx-1,yy,6,11,"#537a99");poly([[xx-1,yy],[xx+2,yy-4],[xx+5,yy]],"#537a99");
            box(xx+1,yy+1,2,7,"#ffefb6");
          }
        }
        for(let yy=y+18;yy<y+h;yy+=16)line(x+1,yy,x+w-1,yy,"#739cb04a",1);
      }
      // Gate arch and the snow-covered causeway.
      ctx.fillStyle="#55769a";ctx.beginPath();ctx.moveTo(686,271);ctx.lineTo(686,248);
      ctx.quadraticCurveTo(702,218,718,248);ctx.lineTo(718,271);ctx.fill();
      ctx.strokeStyle="#ecf8f8";ctx.lineWidth=4;ctx.stroke();
      for(let i=0;i<5;i++)line(690+i*6,244,690+i*6,272,"#829eaf",2);
      poly([[687,270],[718,270],[741,285],[662,285]],"#dceef2");
      line(675,280,729,280,"#b2cdda",2);
      for(let i=0;i<16;i++){const x=625+i*10;
        poly([[x,211],[x+4,211],[x+2,216+(i%3)*3]],"#e7fbff");
      }
    }
    function sceneryPaint(){
      const sky=ctx.createLinearGradient(0,0,0,325);
      sky.addColorStop(0,"#596cab");sky.addColorStop(.44,"#90b9d6");sky.addColorStop(1,"#e8f3ee");
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      const light=ctx.createRadialGradient(147,94,2,147,94,138);
      light.addColorStop(0,"#fff5d181");light.addColorStop(1,"#ffecca00");
      ctx.fillStyle=light;ctx.fillRect(0,0,320,260);
      oval(147,95,27,27,"#fff4d6");oval(141,88,20,19,"#fffbed");
      for(const [x,y,s] of [[289,101,1],[456,54,.61],[840,87,.75],[34,157,.58]]){
        ctx.save();ctx.translate(x,y);ctx.scale(s,s);
        poly([[-84,15],[-66,8],[-42,9],[-35,-1],[-14,-4],[4,-17],[29,-13],[39,-2],
          [57,1],[72,14],[96,18],[49,23],[-23,23]],"#dbe9f0b3");
        line(-59,15,63,17,"#f2f8f7a8",3);ctx.restore();
      }
      poly([[0,224],[42,190],[74,203],[171,100],[225,146],[261,131],[339,198],[409,121],
        [450,156],[494,95],[572,180],[656,113],[705,159],[782,96],[857,178],[920,123],[960,158],
        [960,289],[0,289]],"#a8bfda");
      for(const [x,y,s] of [[171,100,1.3],[409,121,1],[494,95,1.25],[656,113,1],[782,96,1.4],[920,123,.95]]){
        poly([[x,y],[x-43*s,y+57*s],[x-24*s,y+50*s],[x-12*s,y+23*s],[x+9*s,y+51*s],
          [x+22*s,y+45*s],[x+56*s,y+74*s]],"#e8f1f7");
        poly([[x,y],[x-9*s,y+30*s],[x+15*s,y+72*s],[x+50*s,y+91*s]],"#8eabc9");
        line(x-27*s,y+65*s,x-48*s,y+106*s,"#c6dce8",3);
      }
      poly([[0,258],[93,210],[143,231],[230,168],[288,233],[335,192],[414,263],
        [509,201],[585,246],[646,229],[697,271],[776,217],[873,255],[937,193],[960,215],
        [960,301],[0,301]],"#698faa");
      poly([[124,241],[230,168],[214,207],[241,201],[265,226],[279,234],[288,252],
        [249,236],[208,224],[163,257]],"#b8d5e4");
      poly([[880,247],[937,193],[960,215],[960,244],[935,227],[912,236]],"#c4e2ea");
      for(let i=0;i<39;i++){const x=i*27-16,y=282+Math.sin(i*1.61)*6;
        if(x>558&&x<855)continue;snowPine(x,y,.33+(i%4)*.045,true);
      }
      kingdom();
      poly([[0,288],[78,276],[145,285],[252,275],[334,287],[463,279],[582,286],
        [690,279],[808,286],[901,277],[960,284],[960,312],[0,312]],"#def0f2");
      poly([[0,303],[105,298],[230,303],[339,299],[471,305],[570,298],[723,307],[856,299],
        [960,307],[960,316],[0,316]],"#97bfce");
      const surface=ctx.createLinearGradient(0,300,0,H);
      surface.addColorStop(0,"#afcfdc");surface.addColorStop(.25,"#a6d5e4");
      surface.addColorStop(.61,"#72b3d0");surface.addColorStop(1,"#5d98b8");
      ctx.fillStyle=surface;ctx.fillRect(0,309,W,H-309);
      // Long transparent facets and broken reflections sit under the walking surface.
      poly([[88,311],[153,311],[324,540],[175,540]],"#eafafd12");
      poly([[333,309],[400,309],[604,540],[466,540]],"#ecf9ff14");
      poly([[697,309],[746,309],[870,507],[769,489]],"#cbdaf828");
      for(let i=0;i<20;i++){
        const yy=313+i*6,xx=638+Math.sin(i*1.73)*19;
        box(xx,yy,132-(i%4)*17,2+(i%3),"#bddbec26");
      }
      for(let i=0;i<80;i++){
        const x=(i*137+37)%965,y=317+(i*71)%224,len=8+i%5*13;
        line(x,y,x+len,y-2,"#dcf8ff"+(i%4===0?"50":"26"),i%3===0?2:1);
        if(i%4===0)line(x+4,y+3,x+len*.6,y+2,"#3f759d35",1);
      }
      for(let i=0;i<15;i++){
        const x=(i*107+59)%960,y=319+(i*61)%208;
        oval(x,y,2+(i%3),1,"#d1eef359");
      }
      // The banks frame the scene while leaving every movement lane clear.
      poly([[0,298],[55,295],[106,307],[72,316],[85,326],[34,326],[0,341]],"#9ebbcf");
      poly([[0,291],[48,289],[100,300],[109,308],[57,314],[0,326]],"#eef9f8");
      poly([[960,294],[915,298],[867,309],[882,321],[933,320],[960,335]],"#bfd8e2");
      poly([[960,286],[919,291],[875,304],[869,311],[925,309],[960,321]],"#f0fbf8");
      snowPine(28,295,.88);snowPine(91,289,.61);snowPine(924,295,.79);snowPine(972,302,1.08);
      crystal(65,315,.59);crystal(83,317,.33);crystal(909,309,.55);
      line(0,309,41,304,"#ffffff",3);line(891,314,944,311,"#f4ffff",2);
    }
    function background(){
      if(!scenery){const layer=document.createElement("canvas");layer.width=W;layer.height=H;
        if(layer.getContext){const before=ctx.getImageData(0,0,W,H);sceneryPaint();
          layer.getContext("2d").drawImage(ctx.canvas,0,0);ctx.putImageData(before,0,0);scenery=layer;}}
      if(scenery)ctx.drawImage(scenery,0,0);else sceneryPaint();
      for(let i=0;i<25;i++){
        const x=((i*127+ice.clock*(5+i%3))%1010)-25,y=(i*89+ice.clock*(6+i%4))%530;
        box(x,y,i%4===0?3:2,i%4===0?3:2,i%3?"#e9faff88":"#ffffffb8");
      }
    }
    drawBackground=function(){if(active())background();else old.drawBackground();};
    function drawTiles(){
      for(const t of ice.tiles){
        const broken=t.brokenUntil>ice.clock;
        if(broken){
          const rim=[[-49,-2],[-39,-20],[-16,-28],[13,-25],[38,-17],[49,3],[28,22],[-7,28],[-36,18]];
          poly(rim.map(([x,y])=>[t.x+x,t.y+y]),"#e3faff");
          poly(rim.map(([x,y])=>[t.x+x*.93,t.y+y*.9+4]),"#3d7f9e");
          poly(rim.map(([x,y])=>[t.x+x*.82,t.y+y*.78]),"#173f67");
          oval(t.x-2,t.y+5,30,11,"#255674");
          for(let i=0;i<5;i++){
            const a=i*1.4,x=t.x+Math.cos(a)*35,y=t.y+Math.sin(a)*18;
            poly([[x-7,y],[x,y-5],[x+8,y+1],[x+1,y+5]],"#bdeefa");
          }
          line(t.x-24,t.y+9,t.x+10,t.y+11,"#82cad779",2);
          if(t.brokenUntil-ice.clock<1.2){ctx.globalAlpha=.35;
            oval(t.x,t.y,41,24,"#ebfaff");ctx.globalAlpha=1;}continue;
        }
        if(t.stress<.14)continue;
        ctx.save();ctx.globalAlpha=clamp(t.stress*.8,.1,.8);
        poly([[t.x-45,t.y-6],[t.x-27,t.y-25],[t.x+14,t.y-22],[t.x+43,t.y+1],
          [t.x+20,t.y+23],[t.x-17,t.y+26]],"#d5f6ff77");
        for(let i=0;i<6;i++){
          const a=i*1.04+t.id*.16,mx=t.x+Math.cos(a)*18,my=t.y+Math.sin(a)*10;
          const ex=t.x+Math.cos(a+.19)*43,ey=t.y+Math.sin(a+.19)*25;
          line(t.x,t.y,mx,my,"#eaffff",3);line(mx,my,ex,ey,"#eaffff",3);
          line(t.x,t.y,mx,my,"#397a9e",1.3);line(mx,my,ex,ey,"#397a9e",1.3);
          if(t.stress>.6)line(mx,my,mx+Math.cos(a-.8)*17,my+Math.sin(a-.8)*11,"#427c9e",1.5);
        }
        if(t.stress>.82){ctx.globalAlpha=.4+Math.sin(ice.clock*16)*.15;
          oval(t.x,t.y,18,9,"#efffff");}
        ctx.restore();
      }
    }
    function drawZombie(e){
      oval(e.x,e.y+9,25,7,"#285a8170");drawUnicorn(e.x,e.y,e.face,true,false,false);
      if(e.type==="iceShooter"){
        const mx=e.x+e.face*55,my=e.y-35;
        line(mx-e.face*7,my+5,mx+e.face*2,my+5,"#bdeeff",2);
        if(e.shotWarning>0){
          const charge=clamp(1-e.shotWarning/tune().warning,0,1);
          iceBall(mx+e.face*3,my,4+charge*7,0,0,false);
          for(let i=0;i<3;i++)snowflake(mx+e.face*(14+i*5),my+Math.sin(ice.clock*9+i)*12,2,"#e8ffff");
        }else if(ice.clock-(e.lastShot??-9)<.24){
          for(let i=0;i<3;i++)oval(mx+e.face*(8+i*6),my+(i-1)*7,7,4,"#d7f9ff77");
        }
      }
      if(e.flash>0)oval(e.x,e.y-27,25,34,"#ffffff55");
      if(e.type==="iceShooter")for(let i=0;i<2;i++)box(e.x-10+i*12,e.y+16,9,4,i<e.hp?"#e4fcff":"#527e95");
    }
    function drawDragon(){
      const d=ice.dragon;if(!d)return;
      const fall=d.mode==="fall"?clamp(((d.fallDuration||4)-d.timer)/2.4,0,1):d.mode==="fallen"?1:0;
      const arrival=d.mode==="arrival"?clamp(d.timer/2.3,0,1):0;
      const x=d.x+arrival*arrival*245,y=d.y-Math.sin(arrival*Math.PI)*41;
      const wingBeat=Math.sin(ice.clock*(arrival?7:1.7))*(arrival?22:3);
      const open=["warn","blast","superWarn","superBlast","bridge","retreat"].includes(d.mode);
      oval(x-6,y+22,147,21,"#25466c4d");oval(x-8,y+22,94,12,"#23436733");
      ctx.save();ctx.translate(x,y+fall*20);ctx.rotate(-fall*.91);
      if(d.flash>0&&Math.floor(ice.clock*17)%2)ctx.globalAlpha=.55;
      // Tail curls upward behind four clawed legs.
      ctx.lineCap="round";ctx.lineJoin="round";
      ctx.beginPath();ctx.moveTo(58,-8);ctx.bezierCurveTo(137,16,140,-22,125,-53);
      ctx.strokeStyle="#25466d";ctx.lineWidth=29;ctx.stroke();
      ctx.strokeStyle="#5f96bc";ctx.lineWidth=22;ctx.stroke();
      ctx.strokeStyle="#a0d6e3";ctx.lineWidth=6;ctx.stroke();
      poly([[122,-37],[130,-60],[144,-74],[126,-72],[114,-54]],"#cbf0f8");
      for(const [xx,yy] of [[98,-6],[116,-18],[122,-32]])
        poly([[xx-5,yy],[xx+6,yy-16],[xx+10,yy+2]],"#b6e6f4");
      for(const lx of [-45,46]){
        poly([[lx,-19],[lx+20,-13],[lx+19,13],[lx+7,28],[lx-20,28],
          [lx-23,23],[lx-8,13]],"#2f557a");
        for(let k=0;k<3;k++)poly([[lx-19+k*8,23],[lx-22+k*8,31],[lx-13+k*8,28]],"#b9e0ea");
      }
      // Translucent wing membranes and separate bony fingers.
      for(const [side,dx,dy] of [[-1,-12,-9],[1,28,8]]){
        ctx.save();ctx.translate(dx,dy);ctx.scale(side,1);
        const wing=ctx.createLinearGradient(12,-150,71,-34);
        wing.addColorStop(0,"#a3c9ed");wing.addColorStop(.55,"#6c92c1");wing.addColorStop(1,"#557aad");
        ctx.beginPath();ctx.moveTo(5,-35);ctx.lineTo(39,-119-wingBeat);
        ctx.lineTo(76,-180-wingBeat);ctx.lineTo(66,-126-wingBeat*.5);
        ctx.quadraticCurveTo(81,-126,104,-138-wingBeat*.3);
        ctx.quadraticCurveTo(91,-107,115,-96);
        ctx.quadraticCurveTo(80,-102,75,-72);ctx.quadraticCurveTo(45,-86,35,-39);
        ctx.closePath();ctx.fillStyle=wing;ctx.fill();ctx.strokeStyle="#2e527d";ctx.lineWidth=3;ctx.stroke();
        for(const [ex,ey] of [[76,-180-wingBeat],[66,-126-wingBeat*.5],[104,-138-wingBeat*.3],[115,-96],[75,-72]]){
          ctx.beginPath();ctx.moveTo(6,-38);ctx.quadraticCurveTo(41,-97,ex,ey);
          ctx.strokeStyle="#aacce69c";ctx.lineWidth=3;ctx.stroke();
        }
        line(39,-119-wingBeat,76,-180-wingBeat,"#d4edf3",3);
        poly([[70,-172-wingBeat],[81,-193-wingBeat],[77,-172-wingBeat]],"#eefcff");
        ctx.restore();
      }
      const skin=ctx.createLinearGradient(0,-78,0,29);
      skin.addColorStop(0,"#91c9df");skin.addColorStop(.4,"#548db9");skin.addColorStop(1,"#315781");
      ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-23,84,43,-.08,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#2b4c72";ctx.lineWidth=3;ctx.stroke();
      oval(-12,-39,58,17,"#b2e0e833");
      oval(-14,-4,59,24,"#aad1dd");
      for(let row=0;row<3;row++)for(let col=0;col<7;col++){
        const sx=-58+col*18+(row%2)*7,sy=-50+row*13;
        if(sx>68)continue;
        poly([[sx-5,sy],[sx,sy-4],[sx+7,sy],[sx+5,sy+6],[sx,sy+8],[sx-5,sy+4]],
          row===0?"#86b7d2":col%2?"#588cb4":"#619abe");
        line(sx-4,sy,sx,sy-3,"#c5e9f080",1);
      }
      for(let i=0;i<6;i++){
        const xx=-53+i*22,yy=-56+Math.abs(i-2.5)*3;
        poly([[xx-9,yy+5],[xx-3,yy-18-(i%2)*9],[xx+9,yy-4],[xx+12,yy+9]],"#244c74");
        poly([[xx-7,yy+2],[xx-3,yy-17-(i%2)*9],[xx+2,yy-2],[xx+9,yy+6]],"#d2f2fa");
        poly([[xx+2,yy-2],[xx-3,yy-17-(i%2)*9],[xx+9,yy-4],[xx+9,yy+6]],"#7bb6d6");
      }
      for(let i=0;i<5;i++)line(-54+i*20,-1,-51+i*20,13,"#7aa5bd",2);
      // Curved neck and plated throat lead to a defined snout and jaw.
      ctx.beginPath();ctx.moveTo(-53,-14);ctx.bezierCurveTo(-77,-35,-66,-92,-104,-89);
      ctx.strokeStyle="#294d74";ctx.lineWidth=43;ctx.stroke();
      ctx.strokeStyle="#669ec3";ctx.lineWidth=35;ctx.stroke();
      ctx.beginPath();ctx.moveTo(-68,-8);ctx.bezierCurveTo(-91,-26,-86,-62,-111,-72);
      ctx.strokeStyle="#c4e4ec";ctx.lineWidth=12;ctx.stroke();
      for(const [px,py] of [[-77,-22],[-83,-35],[-90,-49],[-101,-61]])line(px-6,py+3,px+5,py-2,"#6798b8",2);
      // The snout turns toward the chosen player; the breath uses this same mouth position.
      ctx.save();ctx.translate(HEAD_X,HEAD_Y);ctx.rotate(d.headAngle||0);
      ctx.scale(-(d.headFace||-1),1);ctx.translate(-HEAD_X,-HEAD_Y);
      poly([[-113,-88],[-84,-102],[-66,-123],[-92,-115],[-118,-101]],"#2a4f78");
      poly([[-112,-92],[-88,-108],[-68,-122],[-99,-110]],"#e0f6fa");
      poly([[-98,-82],[-75,-91],[-62,-106],[-88,-99]],"#91c9e4");
      poly([[-127,-88],[-107,-97],[-89,-91],[-93,-72],[-117,-53],[-152,-52],
        [-174,-61],[-174,-73],[-152,-75],[-142,-87]],"#2c5075");
      poly([[-125,-85],[-108,-94],[-92,-89],[-99,-72],[-120,-59],[-153,-57],
        [-170,-64],[-171,-71],[-150,-72],[-139,-84]],"#86bdd4");
      poly([[-141,-83],[-119,-89],[-97,-86],[-119,-78],[-149,-73]],"#b5deeb");
      oval(-128,-76,11,8,"#e9efd2");oval(-131,-75,3,6,"#244263");oval(-133,-78,2,2,"#ffffff");
      line(-139,-83,-122,-83,"#385e85",3);
      oval(-163,-68,2.4,2,"#386685");
      if(open){
        poly([[-165,-59],[-141,-54],[-117,-62],[-124,-41],[-148,-36],[-166,-45]],"#1c385b");
        poly([[-163,-44],[-147,-40],[-123,-46],[-130,-35],[-150,-33],[-169,-41]],"#8ebed0");
        line(-164,-41,-149,-36,"#d2edf1",2);
        for(let i=0;i<4;i++)poly([[-161+i*10,-56],[-157+i*10,-47],[-154+i*10,-56]],"#effbff");
        if(d.mode!=="warn")oval(-148,-46,12,5,"#9ae9ff99");
      }else line(-169,-59,-139,-53,"#335b80",2);
      ctx.restore();
      for(const lx of [-49,36]){
        poly([[lx-11,-9],[lx+16,-8],[lx+19,10],[lx+10,24],[lx+16,34],
          [lx-14,35],[lx-25,29],[lx-20,19]],"#294d74");
        poly([[lx-7,-9],[lx+13,-8],[lx+13,9],[lx+2,23],[lx+10,29],
          [lx-13,30],[lx-18,23],[lx-13,10]],"#699cbf");
        line(lx-7,-5,lx-9,16,"#b0dbe6",3);
        for(let k=0;k<3;k++)poly([[lx-20+k*10,26],[lx-24+k*10,38],[lx-14+k*10,33]],"#e6f6f6");
      }
      ctx.restore();
      if(["warn","blast","superWarn","superBlast"].includes(d.mode))drawBreath(d);
      if(d.bridge&&["bridge","retreat","fall"].includes(d.mode))drawBridge(d);
      if(d.mode==="fall"||d.mode==="fallen")for(let i=0;i<11;i++){
        const a=ice.phaseTime*.7+i*.37;
        oval(x-145+i*25,y+15-Math.abs(Math.sin(a))*39,4,3,"#dffaff");
      }
    }
    function drawBreath(d){
      const r=breathRay(d),firing=["blast","superBlast"].includes(d.mode),supercharged=d.mode.startsWith("super");
      ctx.save();
      if(firing){
        ctx.translate(r.x,r.y);ctx.rotate(Math.atan2(r.dy,r.dx));ctx.lineCap="round";
        line(0,0,r.length,0,"#62bbe85e",supercharged?64:46);
        line(0,0,r.length,0,"#acecf5dc",supercharged?40:26);
        line(0,0,r.length,0,"#efffff",supercharged?16:9);
        for(let i=0;i<38;i++){
          const fx=(i*35+ice.clock*420)%r.length,fy=Math.sin(i*2.1+ice.clock*10)*(supercharged?16:10);
          poly([[fx-20,fy-3],[fx-6,fy-11],[fx+13,fy-8],[fx+29,fy],
            [fx+7,fy+8],[fx-10,fy+6]],i%3?"#e2fcff":"#95d9f3");
          if(i%3===0)snowflake(fx,fy,supercharged?7:5,"#ffffff");
        }
      }else{
        ctx.setLineDash(d.locked?[16,6]:[7,11]);
        line(r.x,r.y,r.x+r.dx*r.length,r.y+r.dy*r.length,d.locked?"#fff2c0cc":"#d5f8ff99",d.locked?3:2);
        ctx.setLineDash([]);ctx.strokeStyle=d.locked?"#fff1bb":"#e5ffff";ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(d.aim.x,d.aim.y+29,29,10,0,0,Math.PI*2);ctx.stroke();
        snowflake(d.aim.x,d.aim.y,supercharged?11:7,d.locked?"#fff6d1":"#dbfcff");
        iceBall(r.x,r.y,supercharged?17:8,0,0,false);
      }
      ctx.restore();
    }
    function drawBridge(d){
      const b=d.bridge,dy=b.ey-b.sy,dx=b.ex-b.sx,nx=-dy/b.length,ny=dx/b.length;
      // The frozen surface grows out from the same mouth that emitted the super breath.
      const formed=clamp((ice.clock-b.born)/BRIDGE_FORM,0,1);
      const sx=lerp(b.ex,b.sx,formed),sy=lerp(b.ey,b.sy,formed)+13,ex=b.ex,ey=b.ey+13,width=24;
      const points=[[sx-nx*width,sy-ny*width],[ex-nx*width,ey-ny*width],
        [ex+nx*width,ey+ny*width],[sx+nx*width,sy+ny*width]];
      poly([points[3],points[2],[points[2][0],points[2][1]+13],
        [points[3][0],points[3][1]+13]],"#528bb9");
      const iceSurface=ctx.createLinearGradient(sx,sy,ex,ey);
      iceSurface.addColorStop(0,"#e4feff");iceSurface.addColorStop(.45,"#bdebf8");iceSurface.addColorStop(1,"#eefeff");
      poly(points,iceSurface);
      line(...points[0],...points[1],"#f5ffff",3);
      line(...points[3],...points[2],"#7db8d4",2);
      for(let i=1;i<12;i++){
        const q=i/12,cx=lerp(sx,ex,q),cy=lerp(sy,ey,q);
        line(cx-nx*18,cy-ny*18,cx+nx*18,cy+ny*18,"#94c6dd",1.5);
        poly([[cx+nx*24-3,cy+ny*24+12],[cx+nx*24+3,cy+ny*24+31+i%3*5],
          [cx+nx*24+9,cy+ny*24+12]],"#d4f6ffdb");
        if(i%2)snowflake(cx,cy,4,"#f6ffff");
      }
      oval(sx,sy,32,12,"#eeffff77");snowflake(sx,sy,12,"#72a9c7");
      oval(ex,ey,17,8,"#e2faff");snowflake(ex-3,ey,5,"#ffffff");
      if(formed<1)iceBall(ex,ey,10,0,0,false);
      if(d.mode==="bridge"&&d.timer<2)for(let i=1;i<7;i++){
        const p=bridgePoint(b,i/7);line(p.x-9,p.y+1,p.x+7,p.y+26,"#527fa7",2);
      }
    }
    function snowflake(x,y,r,color){
      for(let i=0;i<3;i++){
        const a=i*Math.PI/3,dx=Math.cos(a)*r,dy=Math.sin(a)*r;
        line(x-dx,y-dy,x+dx,y+dy,color,r>6?1.6:1);
      }
    }
    function iceBall(x,y,r,vx=0,vy=0,trail=true){
      const speed=Math.hypot(vx,vy)||1,nx=vx/speed,ny=vy/speed;
      if(trail)for(let i=4;i>=1;i--){
        const wobble=Math.sin(ice.clock*17+i*2.6)*3;
        const xx=x-nx*i*10-ny*wobble,yy=y-ny*i*10+nx*wobble;
        oval(xx,yy,Math.max(1,r-i*2),Math.max(1,r-i*2),i<3?"#e0faff42":"#c8edff28");
        snowflake(xx-ny*5,yy+nx*5,2,"#eafcff83");
      }
      oval(x,y,r+3,r+3,"#8ee4ff38");
      const shell=ctx.createRadialGradient(x-r*.36,y-r*.4,1,x,y,r);
      shell.addColorStop(0,"#ffffff");shell.addColorStop(.26,"#ddfbff");
      shell.addColorStop(.65,"#91dbf0");shell.addColorStop(1,"#3e8bb9");
      ctx.fillStyle=shell;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#def9ff";ctx.lineWidth=1.5;ctx.stroke();
      poly([[x-r*.68,y+r*.16],[x-r*.35,y-r*.44],[x+r*.25,y-r*.65],
        [x+r*.49,y+r*.14],[x,y+r*.68]],"#e8ffff55");
      line(x-r*.63,y+r*.16,x-r*.1,y-r*.12,"#498fb296",1);
      line(x-r*.1,y-r*.12,x+r*.39,y+r*.49,"#498fb296",1);
      line(x-r*.1,y-r*.12,x+r*.23,y-r*.66,"#7fc2d5",1);
      oval(x-r*.32,y-r*.42,r*.19,r*.14,"#ffffff");
      snowflake(x+r*.2,y+r*.09,r*.39,"#efffff");
    }
    function drawProjectiles(){
      for(const b of ice.bolts){
        if(b.life<=0)continue;
        iceBall(b.x,b.y,b.team==="enemy"?12:13,b.vx,b.vy);
      }
    }
    function drawPlayer(p){
      if(p.dead||p.ghost||p.lives<=0)return;
      const point=riderPosition(p);
      const x=point.x,y=point.y;
      if(onBridge(p))oval(x,y+14,28,6,"#ffffff88");
      else oval(x,y+14,24,8,"#41688a50");
      if(p.shieldCharges>0){
        ctx.save();ctx.strokeStyle="#e1fbffcc";ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(x+8,y-26,46,46,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
      drawUnicorn(x+(p.headTimer>0?(p.face||1)*5:0),y,p.face||1,false,false,false);
      if(ice.power[p.role]>ice.clock){
        const mx=x+(p.face||1)*56;
        snowflake(mx,y-36,4,"#bdf6ff");snowflake(mx-(p.face||1)*8,y-46,2,"#ecffff");
      }
      if(p.iceStatus?.freezeUntil>ice.clock){
        poly([[x-37,y+10],[x-40,y-39],[x-24,y-70],[x+12,y-77],
          [x+55,y-58],[x+65,y-18],[x+51,y+13]],"#b8effc57");
        line(x-37,y+9,x-39,y-38,"#d9ffff",2);
        line(x-39,y-38,x-24,y-68,"#d9ffff",2);
        line(x-23,y-69,x+10,y-75,"#f0ffff",2);
        poly([[x-33,y-34],[x-22,y-63],[x-12,y-62],[x-27,y-4]],"#eaffff66");
        line(x+38,y-58,x+50,y-32,"#eaffffb8",2);snowflake(x+28,y-22,9,"#eaffffb8");
      }
      if(host()||guest())label(p.role==="host"?"P1":"P2",x,y-70,12);
    }
    draw=function(){
      if(!active())return old.draw();
      ctx.save();background();drawTiles();
      const bridgeVisible=ice.dragon?.bridge&&["bridge","retreat","fall"].includes(ice.dragon.mode);
      if(bridgeVisible)drawDragon();
      const actors=state.enemies.map(e=>({y:e.y,paint:()=>drawZombie(e)}));
      for(const e of ice.sinking)actors.push({y:e.y,paint:()=>{
        const a=clamp((ice.clock-e.born)/1.2,0,1);
        ctx.save();ctx.globalAlpha=1-a;
        ctx.strokeStyle="#defaff";ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(e.x,e.y,17+a*31,6+a*14,0,0,Math.PI*2);ctx.stroke();
        for(let i=0;i<7;i++){
          const px=e.x+(i-3)*a*16,py=e.y-Math.sin(a*Math.PI)*(23+(i%3)*13);
          poly([[px-3,py],[px,py-7],[px+3,py],[px,py+3]],"#d7f7ff");
        }
        ctx.restore();
      }});
      for(const p of players(true))actors.push({y:p.y,paint:()=>drawPlayer(p)});
      actors.sort((a,b)=>a.y-b.y).forEach(a=>a.paint());
      if(!bridgeVisible)drawDragon();drawProjectiles();drawParticles();ctx.restore();
      ctx.save();ctx.textAlign="left";drawHealthBar();ctx.restore();
      box(304,16,352,61,"#1e4966dd");box(304,16,352,3,"#d2f7fc");
      label(ice.dragon?"THE ICE DRAGON":"FROZEN KINGDOM",480,43,20);
      label(ice.dragon?"BACK ATTACKS  "+ice.dragon.stage+" / 3":
        "ZOMBIES  "+ice.defeated+" / "+TOTAL,480,65,15,"#d9f7fb");
      if(ice.phase==="battle"&&ice.clock<9)label(ice.clock<4.7?
        "WATCH FOR CRACKS — KEEP MOVING!":"ICE ZOMBIE DEFEATED? B: ICE BREATH FOR 5s",480,112,16);
      if(ice.phase==="arrival")label("THE ICE IS SHAKING...",480,111,21);
      if(ice.dragon?.mode==="warn"||ice.dragon?.mode==="superWarn")
        label("DODGE THE ICY BREATH!",480,111,19,"#fff2b7");
      if(onBack())label("ON HIS BACK — PRESS A OR B TO STRIKE!",480,112,18,"#fff2b7");
      else if(atMouth())label("PRESS A TO JUMP ONTO HIS BACK!",480,111,19,"#fff2b7");
      else if(ice.dragon?.mode==="bridge")label("WALK UP THE ICE BRIDGE • A: JUMP ONTO HIS BACK",480,111,16,"#e5ffff");
      if(ice.dragon?.mode==="bridge")label("ICE BRIDGE: "+Math.ceil(ice.dragon.timer)+"s",480,139,15,"#fff0c9");
      if(ice.phase==="won"&&ice.phaseTime>1.9){
        box(311,99,338,64,"#244d6cdd");label("DRAGON DEFEATED!",480,139,27);
      }
      if(ice.clock<freezeUntil)label("FROZEN  "+Math.ceil(freezeUntil-ice.clock)+"s",480,183,22,"#e1fcff");
      if(hitFlash>0){ctx.globalAlpha=hitFlash*.55;box(0,0,W,H,"#aadffd");ctx.globalAlpha=1;}
    };
  }
  window.__uvzuInstallIce=function(code){
    function once(before,after){if(code.split(before).length!==2)throw new Error("Ice hook missing: "+before.slice(0,90));
      code=code.replace(before,()=>after);}
    const movement='(["LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))';
    if(code.split(movement).length!==6)throw new Error("Ice movement hooks missing");
    code=code.split(movement).join('(["ICE10", "LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5", "RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode))');
    once('      !["TOMB1", "LAKE9"].includes(window.__uvzuCurrentLevelCode)',
      '      !["TOMB1", "LAKE9", "ICE10"].includes(window.__uvzuCurrentLevelCode)');
    const ending='!["LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)';
    if(code.split(ending).length!==3)throw new Error("Ice ending hooks missing");
    code=code.split(ending).join('!["ICE10", "LAKE9", "LAVA8", "RSCU7", "HUNT6", "CITY3", "FRST5"].includes(window.__uvzuCurrentLevelCode)');
    once('window.__uvzuLevelTheme = nextCode === "LAKE9" ? "lake" :',
      'window.__uvzuLevelTheme = nextCode === "ICE10" ? "ice" : nextCode === "LAKE9" ? "lake" :');
    once('  requestAnimationFrame(loop);\n})();',
      '('+iceRuntime.toString()+')();\n  requestAnimationFrame(loop);\n})();');
    return code;
  };
})();
