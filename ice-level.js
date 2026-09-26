// ICE10: frozen crossing. Load after lake-level.js and before game.js.
(() => {
  function iceRuntime() {
    const LEVEL="ICE10", TOTAL=30, ICE_POWER=5, FREEZE=5, BRIDGE_TIME=10, STAGES=3;
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
      updateHud,startMusic};
    const session=()=>{const r=window.__uvzuTombTravelNetwork?.room?.()||{};
      return [r.createdAt||0,r.nextLevelAt||0,r.ghostResetAt||0].join(":");};
    const tileCoords=()=>[354,425,494].flatMap((y,row)=>[185,350,515,680,845].map((x,col)=>({
      id:row*5+col,x,y,stress:(row+col)%4===0?.14:0,brokenUntil:0
    })));
    let serial=0,lastPacket=0,hasSnapshot=false,nextSent=false,scenery=null;
    let seq=0,loss=0,freezeUntil=0,graceUntil=0,shotAt=0,hitFlash=0,mountFlash=0;
    let pending=[];
    const seenBolts=new Set(),seenBlasts=new Set(),seenKills=new Set();
    const fresh=()=>({level:LEVEL,session:session(),run:Date.now()+"-"+(++serial),clock:0,
      phase:"battle",phaseTime:0,spawned:0,defeated:0,spawnTimer:1.15,event:0,
      enemies:[],tiles:tileCoords(),bolts:[],sinking:[],kills:[],power:{host:0,guest:0},
      acknowledged:{host:0,guest:0},dragon:null,finished:false});
    let ice=fresh();
    const push=()=>{if(host())window.__uvzuMultiplayerPushEnemyState?.(state.enemies,true);};
    window.__uvzuGetIceState=()=>active()?{...ice,enemies:state.enemies}:null;
    window.__uvzuGetIceStatus=()=>active()?{level:LEVEL,run:ice.run,loss,freezeUntil,
      mounted:ice.dragon?.mount===role(),actions:pending}:null;
    function stopMusic(){window.__uvzuStopMainMusic?.();window.stopTombMusic?.();}
    startMusic=function(){if(active())stopMusic();else old.startMusic();};
    const priorMusic=window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic=function(){priorMusic?.();if(active())stopMusic();};
    function resetPosition(){
      resetPlayerPosition();player.x=guest()?315:165;player.y=426;
      player.webbedTimer=player.webFlash=0;player.webTrapX=player.webTrapY=null;
      player.actionLock=Math.max(.2,player.actionLock||0);freezeUntil=0;graceUntil=ice.clock+1.3;
    }
    function initialize(){
      window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();
      if(host()||guest())player.lives=window.__uvzuTesterLifeBudget?.(5)??5;
      ice=fresh();state.enemies=ice.enemies;state.mode="play";state.time=0;
      loss=seq=shotAt=lastPacket=0;hasSnapshot=false;nextSent=false;pending=[];
      seenBolts.clear();seenBlasts.clear();seenKills.clear();resetPosition();
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
      const before=player.lives;old.loseLife();if(player.lives>=before)return;
      loss++;pending=[];freezeUntil=0;player.webbedTimer=player.webFlash=0;
      player.webTrapX=player.webTrapY=null;
      if(ice.dragon?.mount===role())ice.dragon.mount=null;
      if((host()||guest())&&!ghost())safeLifeReset();
      if(!host()&&!guest()&&player.lives<=0)ice.phase="lost";
      window.__uvzuMultiplayerPush?.(player);push();
    };
    function players(all=false){
      const result=[{...player,role:role(),dead:ghost(),iceStatus:window.__uvzuGetIceStatus()}];
      const p=window.__uvzuGetRemotePlayer?.();
      if((host()||guest())&&p?.iceStatus?.run===ice.run&&Number.isFinite(p.x)&&Number.isFinite(p.y))
        result.push({...p,role:guest()?"host":"guest",dead:!!p.dead||!!p.ghost||p.lives<=0});
      return all?result:result.filter(p=>!p.dead);
    }
    const nearest=(x,y)=>players().sort((a,b)=>distance(a.x,a.y,x,y)-distance(b.x,b.y,x,y))[0];
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
      ice.kills.push({id:e.id,who,kind:e.type});ice.defeated++;
      ice.sinking.push({...e,born:ice.clock});
      if(e.type==="iceShooter"&&(who==="host"||who==="guest"))ice.power[who]=ice.clock+ICE_POWER;
      if(who===role()){state.score+=30;seenKills.add(e.id);}
      push();
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
      const d=ice.dragon;
      if(a.kind==="mount"){
        if(d?.mode==="bridge"&&d.mount===null&&d.stage<STAGES&&
          p.x>d.x-185&&Math.abs(p.y-d.bridgeY)<47){
          d.mount=who;d.hit=false;d.mountAt=ice.clock;d.fromX=p.x;d.fromY=p.y;push();
        }
      }else if(a.kind==="strike"){
        if(d?.mode==="bridge"&&d.mount===who&&!d.hit&&ice.clock-d.mountAt>.35){
          d.hit=true;d.stage++;d.flash=.8;d.mount=null;d.mode=d.stage>=STAGES?"fall":"recover";
          d.timer=d.stage>=STAGES?2.8:1.6;d.normal=0;ice.phase=d.stage>=STAGES?"won":"boss";
          ice.phaseTime=0;
          if(ice.phase==="won"){state.enemies.length=0;ice.bolts.length=0;state.mode="iceWin";}
          push();
        }
      }else if(a.kind==="head"&&ice.phase==="battle"){
        const target=state.enemies.filter(e=>Math.abs(e.x-(p.x+(p.face||1)*38))<55&&Math.abs(e.y-p.y)<49)
          .sort((u,v)=>distance(u.x,u.y,p.x,p.y)-distance(v.x,v.y,p.x,p.y))[0];
        if(target)strikeEnemy(target,who);
      }else if(a.kind==="shoot"&&ice.phase==="battle"&&ice.clock<ice.power[who]){
        const aim=nearbyEnemy(p),dx=(aim?.x??p.x+(p.face||1)*460)-p.x;
        const dy=(aim?.y??p.y)-p.y,len=Math.hypot(dx,dy)||1;
        ice.bolts.push({id:ice.run+"-friendly-"+who+"-"+a.seq,team:who,
          x:p.x+(p.face||1)*30,y:p.y-31,vx:dx/len*410,vy:dy/len*340,
          life:1.6,born:ice.clock});push();
      }
    }
    function act(kind){
      const a={seq:++seq,kind,loss,at:ice.clock,x:player.x,y:player.y};
      if(guest())pending.push(a);else accept(a,role(),{...player,role:role(),iceStatus:window.__uvzuGetIceStatus()});
      window.__uvzuMultiplayerPush?.(player);
    }
    function canMount(){const d=ice.dragon;
      return d?.mode==="bridge"&&d.mount===null&&!ghost()&&ice.clock>=freezeUntil&&
        player.x>d.x-185&&Math.abs(player.y-d.bridgeY)<47;}
    handleAAction=function(){
      if(!active())return old.handleAAction();
      if(ice.dragon?.mount===role()){
        if(!(input.a||keys[" "]))player.aConsumed=false;
        else player.aConsumed=true;return;
      }
      if((input.a||keys[" "])&&!player.aConsumed&&canMount()){
        player.aConsumed=true;act("mount");mountFlash=.5;return;
      }
      if(ice.clock<freezeUntil){if(!(input.a||keys[" "]))player.aConsumed=false;return;}
      old.handleAAction();
    };
    headbutt=function(){
      if(!active())return old.headbutt();
      if(ghost()||ice.clock<freezeUntil||player.headCd>0||player.actionLock>0||player.dodgeTimer>0)return;
      player.headCd=.28;player.headTimer=.15;player.actionLock=.08;
      if(ice.phase==="battle")act("head");
    };
    playerShoot=function(){
      if(!active())return old.playerShoot();
      if(ghost()||ice.clock<freezeUntil||ice.clock<shotAt)return;
      if(ice.dragon?.mount===role()){shotAt=ice.clock+.3;act("strike");return;}
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
            if(e.shotWarning<=0){const x=e.targetX-e.x,y=e.targetY-(e.y-32),m=Math.hypot(x,y)||1;
              ice.bolts.push({id:ice.run+"-enemy-"+(++ice.event),team:"enemy",x:e.x+e.face*28,y:e.y-32,
                vx:x/m*255,vy:y/m*255,life:3.4,born:ice.clock});e.shootTimer=4.1;push();}
          }else if((e.shootTimer-=dt)<=0){e.shotWarning=tune().warning;
            e.targetX=clamp(p.x,30,W-30);e.targetY=clamp(p.y,333,508);push();}
        }
      }
    }
    updateEnemies=function(dt){if(!active())return old.updateEnemies(dt);
      if(!guest()&&ice.phase==="battle")tickEnemies(dt);
    };
    function tiles(dt){
      if(guest()||ice.phase==="won")return;
      const actors=[...players(),...state.enemies];
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
      ice.dragon={x:802,y:417,stage:0,normal:0,mode:"arrival",timer:2.3,
        bridgeY:420,mount:null,hit:false,flash:0,blastId:0,targetY:420};
      state.mode="final";push();
    }
    function dragonTick(dt){
      const d=ice.dragon;if(!d)return;
      d.timer-=dt;d.flash=Math.max(0,d.flash-dt);
      if(d.mode==="arrival"){if(d.timer<=0){ice.phase="boss";d.mode="warn";d.timer=tune().warning;
        d.targetY=nearest(d.x,d.y)?.y||420;}return;}
      if(d.mode==="warn"){
        if(d.timer<=0){d.mode="blast";d.timer=.72;d.blastId++;push();}return;
      }
      if(d.mode==="blast"){
        if(d.timer<=0){d.normal++;d.mode="recover";d.timer=1.03;push();}return;
      }
      if(d.mode==="recover"){
        if(d.timer<=0){
          if(d.normal>=3){d.mode="superWarn";d.timer=1.6;d.bridgeY=clamp(nearest(d.x,d.y)?.y||420,383,445);}
          else{d.mode="warn";d.timer=tune().warning;d.targetY=clamp(nearest(d.x,d.y)?.y||420,344,494);}
          push();
        }return;
      }
      if(d.mode==="superWarn"){
        if(d.timer<=0){d.mode="bridge";d.timer=BRIDGE_TIME;d.mount=null;push();}return;
      }
      if(d.mode==="bridge"&&d.timer<=0){
        d.mount=null;d.normal=0;d.mode="recover";d.timer=1.2;push();
      }
      if(d.mode==="fall"&&d.timer<=0){d.mode="fallen";ice.finished=true;
        if(host())window.__uvzuSignalLevelCompleted?.();push();}
    }
    function hazards(){
      if(ghost()||ice.phase==="won"||ice.phase==="lost"||state.resetQueued)return;
      const d=ice.dragon;
      if(d?.mount===role())return;
      const tile=tileUnder(player);
      if(tile?.brokenUntil>ice.clock){fall();return;}
      for(const b of ice.bolts){
        if(b.team!=="enemy"||seenBolts.has(b.id)||ice.clock-b.born>3.5)continue;
        if(Math.hypot((player.x-b.x)/27,(player.y-29-b.y)/25)<1){seenBolts.add(b.id);hurt();}
      }
      if(d?.mode==="blast"&&!seenBlasts.has(d.blastId)&&
        player.x<d.x-58&&Math.abs(player.y-d.targetY)<26){
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
      const reset=data.run!==ice.run;
      if(reset){window.__uvzuReviveLocalForNextLevel?.(player);old.fullRestart();
        player.lives=window.__uvzuTesterLifeBudget?.(5)??5;
        loss=seq=shotAt=0;pending=[];seenBolts.clear();seenBlasts.clear();seenKills.clear();
        resetPosition();stopMusic();}
      ice=copy(data);for(const key of ["enemies","tiles","bolts","sinking","kills"])ice[key]=list(ice[key]);
      state.enemies=ice.enemies;state.time=0;lastPacket=packet.updatedAt;hasSnapshot=true;
      pending=pending.filter(a=>a.seq>(ice.acknowledged?.guest||0));
      for(const k of ice.kills)if(k.who===role()&&!seenKills.has(k.id)){
        seenKills.add(k.id);state.score+=30;
      }
    }
    function receiveRetry(){
      if(!host())return false;const id="ice-retry-"+ice.run;
      if(!window.__uvzuGetGuestKillRequests?.()?.[id])return false;
      window.__uvzuClearGuestKillRequest?.(id);initialize();return true;
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
      received();if(receiveRetry())return;guestActions();
      const run=ice.run;
      state.mode=ice.phase==="won"||ice.phase==="lost"?"iceScene":ice.phase==="battle"?"play":"final";
      if(ice.dragon?.mount===role()&&!ghost()){
        player.x=ice.dragon.x-54;player.y=ice.dragon.y-74;player.webbedTimer=0;
      }
      old.update(dt);if(!active()||ice.run!==run)return;
      ice.clock+=dt;ice.phaseTime+=dt;hitFlash=Math.max(0,hitFlash-dt);
      mountFlash=Math.max(0,mountFlash-dt);player.x=clamp(player.x,35,W-35);
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
      hazards();updateHud();
    };
    updateHud=function(){
      old.updateHud();if(!active())return;
      if(timeEl)timeEl.textContent=ice.dragon?"Dragon: "+ice.dragon.stage+" / "+STAGES:
        "Zombies: "+ice.defeated+" / "+TOTAL;
      if(powerLabelEl)powerLabelEl.textContent=ice.clock<freezeUntil?
        "Frozen: "+Math.ceil(freezeUntil-ice.clock)+"s":ice.dragon?.mount===role()?"B: STRIKE!":
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
    function sceneryPaint(){
      const sky=ctx.createLinearGradient(0,0,0,355);
      sky.addColorStop(0,"#5c93c6");sky.addColorStop(.66,"#b1dff0");sky.addColorStop(1,"#edfbf4");
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      oval(160,101,42,42,"#f6f9f3");oval(160,101,51,51,"#f6f9f366");
      for(const [x,y,s] of [[300,98,1],[704,75,.72],[80,187,.6]]){
        oval(x,y,72*s,11*s,"#e9f5f9bb");oval(x-21*s,y-8*s,32*s,18*s,"#f3fbfe");
        oval(x+15*s,y-11*s,40*s,21*s,"#f3fbfe");
      }
      poly([[0,229],[115,151],[187,196],[300,107],[407,207],[524,146],[617,189],
        [738,133],[853,199],[960,163],[960,320],[0,320]],"#a8cfe0");
      poly([[0,248],[98,188],[157,233],[284,159],[382,253],[495,185],[585,247],
        [704,171],[798,250],[931,192],[960,225],[960,325],[0,325]],"#789ebc");
      for(let i=0;i<24;i++){const x=i*46-13,y=272+(i*47)%22;
        line(x,y,x,y-40-(i%3)*12,"#496e84",4);
        poly([[x-18,y-20],[x,y-67-(i%3)*12],[x+18,y-20]],i%3?"#518299":"#46768f");
        poly([[x-21,y-2],[x,y-48-(i%3)*12],[x+21,y-2]],i%3?"#517d95":"#406f88");
        line(x-15,y-12,x+12,y-13,"#d9f3f5",3);
      }
      // The kingdom sits across the water, behind the lake edge.
      box(625,150,202,130,"#6a9cba");box(642,135,42,141,"#87b9cf");
      box(700,116,54,162,"#85b6ce");box(776,143,37,136,"#80afc5");
      for(const [x,y,w] of [[622,150,64],[695,116,66],[771,143,48]]){
        poly([[x-9,y+3],[x+w/2,y-44],[x+w+9,y+3]],"#eafcfa");
        poly([[x+7,y-4],[x+w/2,y-36],[x+w-7,y-4]],"#bce4f3");
        for(let j=0;j<3;j++)box(x+11+j*15,y+18,5,10,"#d7f8fe");
      }
      box(703,223,40,56,"#417995");poly([[700,224],[723,202],[747,224]],"#e9f8fa");
      for(let i=0;i<10;i++)box(629+i*20,146,10,13,"#d9f4fa");
      poly([[0,283],[130,265],[258,280],[401,270],[553,284],[719,274],[837,279],
        [960,266],[960,321],[0,321]],"#cce8ee");
      const surface=ctx.createLinearGradient(0,305,0,H);
      surface.addColorStop(0,"#badfe9");surface.addColorStop(.42,"#81bbce");surface.addColorStop(1,"#b7e0e8");
      ctx.fillStyle=surface;ctx.fillRect(0,303,W,H-303);
      for(let i=0;i<33;i++){const x=(i*149+29)%970,y=320+(i*67)%217;
        line(x,y,x+22+i%5*4,y,"#e9faff99",2);
      }
      poly([[0,303],[92,302],[67,328],[0,339]],"#e9f6f4");
      poly([[960,298],[894,300],[912,320],[960,327]],"#e6f6f4");
    }
    function background(){
      if(!scenery){const layer=document.createElement("canvas");layer.width=W;layer.height=H;
        if(layer.getContext){const before=ctx.getImageData(0,0,W,H);sceneryPaint();
          layer.getContext("2d").drawImage(ctx.canvas,0,0);ctx.putImageData(before,0,0);scenery=layer;}}
      if(scenery)ctx.drawImage(scenery,0,0);else sceneryPaint();
    }
    drawBackground=function(){if(active())background();else old.drawBackground();};
    function drawTiles(){
      for(const t of ice.tiles){
        const broken=t.brokenUntil>ice.clock;
        if(broken){oval(t.x,t.y,47,28,"#254e75");oval(t.x,t.y,38,21,"#153a62");
          for(let i=0;i<6;i++)line(t.x+Math.cos(i*6)*35,t.y+Math.sin(i*7)*19,
            t.x+Math.cos(i*5)*47,t.y+Math.sin(i*7)*27,"#eafcff",3);
          if(t.brokenUntil-ice.clock<1.2){ctx.globalAlpha=.35;
            oval(t.x,t.y,41,24,"#ebfaff");ctx.globalAlpha=1;}continue;
        }
        if(t.stress<.14)continue;
        ctx.save();ctx.globalAlpha=clamp(t.stress*.8,.1,.8);
        oval(t.x,t.y,46,27,"#e8fcff66");line(t.x-18,t.y-8,t.x+4,t.y+2,"#477da0",2);
        line(t.x+4,t.y+2,t.x+25,t.y-7,"#477da0",2);
        line(t.x+4,t.y+2,t.x-8,t.y+19,"#477da0",2);
        if(t.stress>.58){line(t.x-22,t.y-17,t.x-8,t.y-2,"#315d85",2);
          line(t.x+4,t.y+2,t.x+22,t.y+18,"#315d85",2);}
        ctx.restore();
      }
    }
    function drawZombie(e){
      oval(e.x,e.y+9,25,7,"#285a8170");drawUnicorn(e.x,e.y,e.face,true,false,false);
      if(e.type==="iceShooter"){
        oval(e.x+e.face*26,e.y-29,8,7,"#a7f5ff");
        poly([[e.x-9,e.y-55],[e.x-3,e.y-76],[e.x+4,e.y-55]],"#caf8ff");
        if(e.shotWarning>0){label("!",e.x,e.y-76,22,"#e6fbff");
          line(e.x+e.face*25,e.y-31,e.targetX,e.targetY-30,"#9fe6fa88",2);}
      }
      if(e.flash>0)oval(e.x,e.y-27,25,34,"#ffffff55");
      if(e.type==="iceShooter")for(let i=0;i<2;i++)box(e.x-10+i*12,e.y+16,9,4,i<e.hp?"#e4fcff":"#527e95");
    }
    function drawDragon(){
      const d=ice.dragon;if(!d)return;
      const fall=d.mode==="fall"?clamp((2.8-d.timer)/2.4,0,1):d.mode==="fallen"?1:0;
      const x=d.x,y=d.y,wingBeat=d.mode==="arrival"?Math.sin(ice.clock*7)*18:0;
      oval(x,y+20,154,21,"#305e8266");
      ctx.save();ctx.translate(x,y-fall*30);ctx.rotate(-fall*.65);
      if(d.flash>0&&Math.floor(ice.clock*17)%2)ctx.globalAlpha=.55;
      poly([[-83,-24],[-162,-37],[-194,-15],[-167,-3],[-128,1],[-78,13]],"#507da0");
      poly([[-13,-33],[-125,-132-wingBeat],[-106,-96-wingBeat],[-147,-105-wingBeat],
        [-71,-10]],"#629bbc");
      poly([[11,-35],[73,-150+wingBeat],[89,-99+wingBeat],[119,-112+wingBeat],
        [46,-12]],"#5a8cb2");
      for(let i=0;i<6;i++)poly([[-70+i*24,-47],[-60+i*24,-66-(i%2)*7],
        [-49+i*24,-42]],"#def6f8");
      oval(-12,-14,96,47,"#32688f");oval(6,-25,79,40,"#6badd1");
      oval(18,-5,58,24,"#a6d6e4");
      for(const lx of [-44,21]){
        poly([[lx,-2],[lx+10,18],[lx-1,40],[lx-23,38],[lx-19,14]],"#3c789e");
        for(let k=0;k<3;k++)poly([[lx-20+k*7,34],[lx-19+k*7,49],[lx-15+k*7,35]],"#c9eff4");
      }
      poly([[-20,-37],[-98,-75],[-132,-71],[-145,-59],[-119,-41],[-81,-34]],"#366d93");
      poly([[-68,-66],[-84,-98],[-98,-70]],"#b8e7f1");
      poly([[-99,-68],[-111,-91],[-119,-65]],"#b8e7f1");
      oval(-120,-57,8,8,"#fff0b9");oval(-123,-57,3,5,"#1d385c");
      oval(-148,-54,3,3,"#214a74");
      line(-135,-43,-157,-41,"#c4ebf1",3);
      ctx.restore();
      if(d.mode==="warn"||d.mode==="blast"||d.mode==="superWarn"){
        const yline=d.mode==="superWarn"?d.bridgeY:d.targetY;
        line(0,yline,x-122,yline,d.mode==="blast"?"#d9faff":"#a7edff88",
          d.mode==="blast"?22:d.mode==="superWarn"?8:3);
        if(d.mode==="blast")for(let i=0;i<14;i++){
          const fx=(i*59+(ice.clock*240)%59)%(x-125);
          poly([[fx,yline-8],[fx+13,yline-22-(i%3)*7],[fx+29,yline+2]],
            i%3?"#c1edff":"#f5fdff");
        }
      }
      if(d.mode==="bridge"){
        const by=d.bridgeY;
        poly([[x-510,by+14],[x-448,by-3],[x-330,by-8],[x-215,by-14],
          [x-119,by-25],[x-116,by+9],[x-228,by+22],[x-350,by+27]],"#b2e5f1cc");
        line(x-510,by+14,x-120,by-25,"#f1fcff",5);
        line(x-120,by-25,x-145,y-42,"#effdff",6);
        for(let i=0;i<8;i++)poly([[x-160-i*45,by+6],
          [x-153-i*45,by-15-(i%3)*6],[x-142-i*45,by+8]],"#d8f6ff");
        if(d.mount===null)label("A: JUMP ON HIS BACK",x-215,by-63,15);
        label(Math.ceil(d.timer)+"s",x-89,by-67,17,"#fff4cb");
      }
      if(d.mode==="fall"||d.mode==="fallen")for(let i=0;i<11;i++){
        const a=ice.phaseTime*.7+i*.37;
        oval(x-145+i*25,y+15-Math.abs(Math.sin(a))*39,4,3,"#dffaff");
      }
    }
    function drawProjectiles(){
      for(const b of ice.bolts){
        if(b.life<=0)continue;
        oval(b.x,b.y,b.team==="enemy"?11:12,b.team==="enemy"?11:8,"#4b93bc99");
        oval(b.x,b.y,b.team==="enemy"?8:9,b.team==="enemy"?8:6,"#d4faff");
        oval(b.x-2,b.y-3,3,3,"#ffffff");
      }
    }
    function drawPlayer(p){
      if(p.dead||p.ghost||p.lives<=0)return;
      const mounted=ice.dragon?.mount===p.role,d=ice.dragon;
      const jump=mounted?clamp((ice.clock-d.mountAt)/.36,0,1):0;
      const x=mounted?lerp(d.fromX??p.x,d.x-54,jump):p.x;
      const y=mounted?lerp(d.fromY??p.y,d.y-74,jump)-Math.sin(jump*Math.PI)*51:p.y;
      if(mounted)oval(x,y+18,28,6,"#ffffff88");
      else oval(x,y+14,24,8,"#41688a50");
      drawUnicorn(x,y,p.face||1,false,false,false);
      if(p.iceStatus?.freezeUntil>ice.clock){
        oval(x,y-28,29,38,"#aeeeff70");
        poly([[x-25,y-49],[x-18,y-65],[x-10,y-51]],"#f4ffff");
        poly([[x+15,y-52],[x+24,y-68],[x+30,y-49]],"#d6f8ff");
      }
      if(host()||guest())label(p.role==="host"?"P1":"P2",x,y-70,12);
    }
    draw=function(){
      if(!active())return old.draw();
      ctx.save();background();drawTiles();
      if(ice.dragon?.mode==="bridge")drawDragon();
      const actors=state.enemies.map(e=>({y:e.y,paint:()=>drawZombie(e)}));
      for(const e of ice.sinking)actors.push({y:e.y,paint:()=>{
        const a=clamp((ice.clock-e.born)/1.2,0,1);
        ctx.save();ctx.globalAlpha=1-a;drawZombie({...e,y:e.y+a*48});ctx.restore();
      }});
      for(const p of players(true))actors.push({y:p.y,paint:()=>drawPlayer(p)});
      actors.sort((a,b)=>a.y-b.y).forEach(a=>a.paint());
      if(ice.dragon?.mode!=="bridge")drawDragon();drawProjectiles();ctx.restore();
      box(304,16,352,61,"#1e4966dd");box(304,16,352,3,"#d2f7fc");
      label(ice.dragon?"THE ICE DRAGON":"FROZEN KINGDOM",480,43,20);
      label(ice.dragon?"BACK ATTACKS  "+ice.dragon.stage+" / 3:":
        "ZOMBIES  "+ice.defeated+" / "+TOTAL,480,65,15,"#d9f7fb");
      if(ice.phase==="battle"&&ice.clock<9)label(ice.clock<4.7?
        "WATCH FOR CRACKS — KEEP MOVING!":"ICE ZOMBIE DEFEATED? B: ICE BREATH FOR 5s",480,112,16);
      if(ice.phase==="arrival")label("THE ICE IS SHAKING...",480,111,21);
      if(ice.dragon?.mode==="warn"||ice.dragon?.mode==="superWarn")
        label("DODGE THE ICY BREATH!",480,111,19,"#fff2b7");
      if(ice.dragon?.mount===role())label("PRESS B TO STRIKE!",480,112,20,"#fff2b7");
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
