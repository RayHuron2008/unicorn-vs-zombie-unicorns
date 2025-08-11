(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // --- HUD refs ---
  const HUD = {
    lives: document.getElementById('lives'),
    score: document.getElementById('score'),
    powerFill: document.getElementById('powerFill'),
    root: document.getElementById('hud')
  };

  // HUD Ray icon (🔫)
  let rayIcon = document.getElementById('rayIcon');
  if (!rayIcon) {
    rayIcon = document.createElement('div');
    rayIcon.id = 'rayIcon';
    rayIcon.textContent = '🔫';
    rayIcon.style.cssText = 'background:rgba(0,0,0,.35);padding:6px 10px;border:2px solid rgba(255,255,255,.25);border-radius:8px;margin:0 6px;display:none;color:#fff;font-family:-apple-system,system-ui,Arial;font-size:14px;';
    HUD.root.insertBefore(rayIcon, HUD.root.children[2] || null);
  }

  // --- AUDIO (only main theme) ---
  const audio = { main: new Audio('bgm_main.mp3'), started: false };
  audio.main.loop = true; audio.main.volume = 0.7;
  function startAudioIfNeeded(){ if(audio.started) return; audio.started=true; try{ audio.main.currentTime=0; audio.main.play(); }catch(_){} }

  // --- CONSTANTS / HELPERS ---
  const W = canvas.width, H = canvas.height;
  const GROUND_Y = Math.floor(H * 0.78);
  const GROUND_BAND = 56;
  const MIN_Y = GROUND_Y - GROUND_BAND;
  const MAX_Y = GROUND_Y;
  const rand=(a,b)=>a+Math.random()*(b-a);
  const dist=(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);

  const MAX_ENEMIES=4, MIN_ENEMY_SEP=120, SAFE_RADIUS=200, START_GRACE=2.0;
  const ENEMY_BULLET_SPEED=190, PLAYER_RAY_SPEED=280, PLAYER_RAY_SPEED_MEGA=360;

  // --- STATE ---
  let state = {
    running:true, score:0, lives:3, power:0, wave:1,
    enemies:[], bolts:[], confetti:[],
    kills:0, killsForMega:0,
    spawnTimer:0, time:0,
    specialTimer:0,  // Ray power (25s)
    megaTimer:0,     // Mega (20s)
    toast:null, toastT:0
  };

  const input = { dx:0, dy:0, holding:false, sprint:false };
  const player = { x:W*0.25, y:GROUND_Y-8, speed:2.2, size:18, dashCD:0, face:1, dashTimer:0, invuln:0 };

  // --- INPUT ---
  function bindInputs(){
    const dpad=document.getElementById('dpad');
    dpad.querySelectorAll('.dir').forEach(btn=>{
      const dx=+btn.dataset.dx, dy=+btn.dataset.dy;
      const start=e=>{ startAudioIfNeeded(); input.dx=dx; input.dy=dy; input.holding=true; e.preventDefault(); };
      const end=()=>{ input.holding=false; input.dx=input.dy=0; };
      btn.addEventListener('touchstart',start,{passive:false}); btn.addEventListener('touchend',end);
      btn.addEventListener('mousedown',start); btn.addEventListener('mouseup',end); btn.addEventListener('mouseleave',end);
    });
    const btnA=document.getElementById('btnA'), btnB=document.getElementById('btnB');
    btnA.addEventListener('touchstart',e=>{ startAudioIfNeeded(); attack(); e.preventDefault(); });
    btnA.addEventListener('mousedown',()=>{ startAudioIfNeeded(); attack(); });
    btnB.addEventListener('touchstart',e=>{ startAudioIfNeeded(); input.sprint=true; e.preventDefault(); });
    btnB.addEventListener('touchend',()=>{ input.sprint=false; });
    btnB.addEventListener('mousedown',()=>{ startAudioIfNeeded(); input.sprint=true; });
    btnB.addEventListener('mouseup',()=>{ input.sprint=false; });
  }

  // --- TOAST ---
  function showToast(t,sec=1.4){ state.toast=t; state.toastT=sec; }

  // --- SPAWN (max one special) ---
  const countSpecials=()=>state.enemies.reduce((n,e)=>n+(e.special?1:0),0);
  function spawnWaveInitial(){ for(let i=0;i<2;i++) spawnEnemy(false,true); if(Math.random()<0.25) spawnEnemy(true,true); }
  function spawnEnemy(trySpecial,initial=false){
    if(state.enemies.length>=MAX_ENEMIES) return;
    let special = !!trySpecial && countSpecials()===0;
    const fromLeft=Math.random()<0.5; let x=fromLeft?-20:W+20; let y=rand(MIN_Y,MAX_Y);
    let tries=0; while(tries++<20){
      let ok=dist(x,y,player.x,player.y)>=SAFE_RADIUS;
      if(ok) for(const e of state.enemies){ if(dist(x,y,e.x,e.y)<MIN_ENEMY_SEP){ ok=false; break; } }
      if(ok) break; y=rand(MIN_Y,MAX_Y);
    }
    state.enemies.push({ x,y,vx:0,vy:0, hp:special?3:2, special, cd:special?rand(0.9,1.4):0, face: fromLeft?1:-1 });
  }

  // --- HORN TIP WORLD COORDS ---
  // Sprite anchor: translate(x, y-22). Horn rect drawn at local (24,-10) size 2x8.
  function hornTip(entity, isPlayer=false){
    const face = entity.face || 1;
    const scale = (isPlayer && state.megaTimer>0) ? 1.25 : 1.0;
    const baseY = entity.y - 22;
    const lx = 26;        // horn tip local X (24 + width 2)
    const ly = -10;       // top of horn
    const wx = entity.x + face * (lx * scale);
    const wy = baseY + ly * scale;
    return { x: wx, y: wy + 4*scale }; // center-ish along the horn
  }

  // --- ATTACKS ---
  function attack(){
    if (state.specialTimer > 0){
      const dirX = (input.dx!==0?Math.sign(input.dx):player.face)||1;
      const tip = hornTip(player, true);
      const spd = state.megaTimer>0 ? PLAYER_RAY_SPEED_MEGA : PLAYER_RAY_SPEED;
      state.bolts.push({ x:tip.x, y:tip.y, vx:dirX*spd, vy:0, enemy:false, life:0.9, mega:(state.megaTimer>0), rainbow:true, born:state.time });
    } else if (player.dashCD<=0){
      const a = Math.atan2(input.dy, input.dx) || 0;
      const dx = Math.cos(a)*48, dy = Math.sin(a)*18;
      player.x = Math.max(20, Math.min(W-20, player.x+dx));
      player.y = Math.max(MIN_Y, Math.min(MAX_Y, player.y+dy));
      if (dx!==0) player.face = dx<0?-1:1;
      player.dashTimer=0.22; player.invuln=0.35;
      for(const e of state.enemies){
        if(dist(e.x,e.y,player.x,player.y)<32){ e.hp-=2; addConfetti(e.x,e.y); if(e.hp<=0) onKill(e); }
      }
      player.dashCD=0.32;
    }
  }

  function onKill(e){
    state.kills+=1; state.score+= e.special?500:100;
    if(state.kills%10===0) state.lives+=1;

    const inPower = (state.specialTimer>0) || (state.megaTimer>0);

    // Mega progress only if NOT powered
    if(!inPower){
      state.killsForMega+=1;
      if(state.killsForMega>=20){ state.killsForMega=0; state.megaTimer=20; showToast('🌈 MEGA MODE!',1.6); }
    }

    // Ray pickup only if NOT powered and you killed a special
    if(e.special && !inPower){
      state.specialTimer=25; showToast('🔫 RAY POWER!',1.6);
    }
    e.hp=0;
  }

  // --- FX ---
  function addConfetti(x,y){
    for(let i=0;i<14;i++){
      state.confetti.push({ x,y, vx:Math.cos(i/14*Math.PI*2)*(0.6+Math.random()*1.4), vy:Math.sin(i/14*Math.PI*2)*(0.6+Math.random()*1.4), t:0.4+Math.random()*0.5, hue:Math.floor(Math.random()*360) });
    }
  }

  // --- DAMAGE / GAME OVER ---
  function damagePlayer(){ if(player.invuln>0) return; state.lives-=1; if(state.lives<=0) gameOver(); }
  function resetGame(){
    state.running=true; state.score=0; state.lives=3; state.power=0; state.wave=1;
    state.enemies=[]; state.bolts=[]; state.confetti=[];
    state.kills=0; state.killsForMega=0; state.spawnTimer=0; state.time=0;
    state.specialTimer=0; state.megaTimer=0; state.toast=null; state.toastT=0;
    player.x=W*0.25; player.y=GROUND_Y-8; player.face=1; player.dashCD=0; player.dashTimer=0; player.invuln=0;
    startAudioIfNeeded(); setTimeout(spawnWaveInitial,100);
  }
  function gameOver(){ state.running=false; setTimeout(resetGame,1000); }

  // --- UPDATE ---
  function update(dt){
    if(!state.running) return;
    state.time+=dt;
    player.invuln=Math.max(0,player.invuln-dt);
    player.dashTimer=Math.max(0,player.dashTimer-dt);
    if(state.specialTimer>0) state.specialTimer=Math.max(0,state.specialTimer-dt);
    if(state.megaTimer>0) state.megaTimer=Math.max(0,state.megaTimer-dt);
    if(state.toastT>0) state.toastT=Math.max(0,state.toastT-dt);

    rayIcon.style.display = state.specialTimer>0 ? 'block' : 'none';

    // Player movement
    const spd = player.speed*(input.sprint?1.6:1)*(state.megaTimer>0?1.05:1);
    if(input.dx!==0) player.face=Math.sign(input.dx);
    player.x=Math.max(20,Math.min(W-20,player.x+input.dx*spd*60*dt));
    player.y=Math.max(MIN_Y,Math.min(MAX_Y,player.y+input.dy*spd*52*dt));
    player.dashCD=Math.max(0,player.dashCD-dt);

    // Enemies
    for(const e of state.enemies){
      const dirX = Math.sign(player.x-e.x)||e.face||1;
      const dirY = Math.sign(player.y-e.y);
      const s = e.special?0.95:0.80;
      e.x+=dirX*s; e.y=Math.max(MIN_Y,Math.min(MAX_Y,e.y+dirY*0.35)); e.face=dirX;

      // Special shooters: fire from horn tip (red)
      if(e.special){
        e.cd-=dt;
        if(e.cd<=0){
          const tip = hornTip(e,false);
          const vx = dirX*ENEMY_BULLET_SPEED;
          state.bolts.push({ x:tip.x, y:tip.y, vx, vy:0, enemy:true, life:1.5, color:'#ff2a2a' });
          e.cd=rand(1.0,1.6);
        }
      }

      if (dist(e.x,e.y,player.x,player.y)<26 && player.invuln<=0) damagePlayer();
    }

    // Soft separation
    for(let i=0;i<state.enemies.length;i++){
      for(let j=i+1;j<state.enemies.length;j++){
        const a=state.enemies[i], b=state.enemies[j];
        let dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
        if(d>0 && d<MIN_ENEMY_SEP){
          const push=(MIN_ENEMY_SEP-d)*0.5; dx/=d; dy/=d;
          a.x-=dx*push; a.y=Math.max(MIN_Y,Math.min(MAX_Y,a.y-dy*push));
          b.x+=dx*push; b.y=Math.max(MIN_Y,Math.min(MAX_Y,b.y+dy*push));
        }
      }
    }

    // Bolts
    for(let i=state.bolts.length-1;i>=0;i--){
      const b=state.bolts[i];
      b.x+=b.vx*dt; b.y+=(b.vy||0)*dt; b.life-=dt;
      if(b.life<=0 || b.x<0||b.x>W||b.y<0||b.y>H){ state.bolts.splice(i,1); continue; }

      if(!b.enemy){
        for(const e of state.enemies){
          if(dist(b.x,b.y,e.x,e.y)<18){
            e.hp -= (b.mega?3:2); addConfetti(e.x,e.y);
            if(e.hp<=0) onKill(e);
            state.bolts.splice(i,1); break;
          }
        }
      } else {
        if(player.invuln<=0 && dist(b.x,b.y,player.x,player.y)<16){ damagePlayer(); state.bolts.splice(i,1); }
      }
    }

    // Clean & confetti
    state.enemies = state.enemies.filter(e=>e.hp>0);
    for(let i=state.confetti.length-1;i>=0;i--){ const c=state.confetti[i]; c.x+=c.vx; c.y+=c.vy; c.t-=dt; if(c.t<=0) state.confetti.splice(i,1); }

    // Controlled spawns (cap 4; enforce single special)
    const spawnInterval = state.time<START_GRACE ? 1.3 : 0.9;
    state.spawnTimer-=dt;
    if(state.spawnTimer<=0 && state.enemies.length<MAX_ENEMIES){
      const wantSpecial = Math.random()<0.25;
      spawnEnemy(wantSpecial && countSpecials()===0);
      state.spawnTimer = spawnInterval + Math.random()*0.4;
    }

    // HUD
    HUD.lives.textContent = `🦄 x ${state.lives}`;
    HUD.score.textContent = `Score: ${state.score}`;
    const pct = state.specialTimer>0 ? (state.specialTimer/25)*100 : state.power;
    HUD.powerFill.style.width = `${Math.max(0,Math.min(100,pct))}%`;
  }

  // --- DRAW ---
  function drawBackground(){
    const bands=['#82d8ff','#a8e4ff','#d0f1ff','#e9f9ff'];
    for(let i=0;i<bands.length;i++){ ctx.fillStyle=bands[i]; ctx.fillRect(0,i*(H/6),W,H/6); }
    ctx.fillStyle='#2ecc71'; ctx.fillRect(0,H*0.65,W,H*0.35);
    ctx.fillStyle='#27ae60';
    for(let i=0;i<6;i++){ const x=i*180-60; ctx.fillRect(x,H*0.62,160,12); ctx.fillRect(x+20,H*0.60,120,12); ctx.fillRect(x+40,H*0.58,80,12); }
    const arcs=['#ff3b6b','#ff8a00','#ffe600','#19ff00','#00c3ff','#8a2be2'];
    for(let i=0;i<arcs.length;i++){ ctx.strokeStyle=arcs[i]; ctx.lineWidth=18; ctx.beginPath(); ctx.arc(W*0.6,H*0.78,220-i*18,Math.PI,Math.PI*2); ctx.stroke(); }
    ctx.fillStyle='#7b4e2b'; ctx.fillRect(0,GROUND_Y+8,W,H-(GROUND_Y+8));
    ctx.fillStyle='#2ecc71'; ctx.fillRect(0,GROUND_Y, W,8);
  }

  function drawUnicornFacing(x,y,face,main='#ff9bd4',mane=['#ff3b6b','#ffb86b','#ffe27a','#9dff8b','#6be3ff','#c59bff'], eye='#000'){
    const baseY=y-22;
    ctx.save(); ctx.translate(x,baseY); ctx.scale(face,1); ctx.imageSmoothingEnabled=false;
    const scale = state.megaTimer>0 && main==='#ff9bd4' ? 1.25 : 1.0; // only scale player in mega
    ctx.scale(scale,scale);
    // body + head
    ctx.fillStyle=main; ctx.fillRect(-18,-10,34,20); ctx.fillRect(14,-8,12,14);
    // legs
    ctx.fillStyle='#2b1c3b'; ctx.fillRect(-14,8,6,14); ctx.fillRect(-2,8,6,14); ctx.fillRect(8,8,6,14); ctx.fillRect(18,8,6,14);
    // horn
    ctx.fillStyle='#ffe35a'; ctx.fillRect(24,-10,2,8);
    // mane
    for(let i=0;i<mane.length;i++){ ctx.fillStyle=mane[i]; ctx.fillRect(-10,-12+i*2,28,2); }
    // eye
    ctx.fillStyle=eye; ctx.fillRect(22,-2,2,2);
    ctx.restore();
  }

  function drawZombie(e){
    const mane = e.special ? ['#a6ffc8','#7feeb2','#52d8a0'] : ['#b0ffcf','#8ce6c1','#6cd4b2'];
    drawUnicornFacing(e.x,e.y,e.face||1,'#86e6b6',mane,'#ff2a2a'); // red eyes
  }

  function drawPickupsUI(){
    if(state.toast && state.toastT>0){
      ctx.save(); ctx.globalAlpha=Math.min(1,state.toastT/0.4);
      ctx.fillStyle='#111'; ctx.fillRect(W/2-80,24,160,30);
      ctx.strokeStyle='#fff'; ctx.strokeRect(W/2-80,24,160,30);
      ctx.fillStyle='#fff'; ctx.font='14px monospace'; ctx.fillText(state.toast,W/2-70,44);
      ctx.restore();
    }
  }

  function drawProjectiles(){
    for(const b of state.bolts){
      if(b.enemy){
        ctx.fillStyle = b.color || '#ff2a2a'; // enemy = red
        ctx.fillRect(Math.floor(b.x)-3, Math.floor(b.y)-2, 6, 4);
      } else {
        // player rainbow beam (simple hue cycle)
        if(b.rainbow){
          const t = (state.time - (b.born||0)) * 360; // degrees per sec
          ctx.fillStyle = `hsl(${(t%360)|0}, 90%, 60%)`;
        } else {
          ctx.fillStyle = b.mega ? '#ffd800' : '#ffffff';
        }
        const w = b.mega ? 6 : 4;
        ctx.fillRect(Math.floor(b.x)-w/2, Math.floor(b.y)-2, w, 4);
      }
    }
  }

  function draw(now){
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    drawBackground();
    drawProjectiles();
    for(const c of state.confetti){ ctx.fillStyle=`hsl(${c.hue},90%,60%)`; ctx.fillRect(Math.floor(c.x),Math.floor(c.y),3,3); }
    for(const e of state.enemies) drawZombie(e);
    drawUnicornFacing(player.x,player.y,player.face);
    drawPickupsUI();
  }

  // --- LOOP ---
  let last=performance.now();
  function loop(now){
    const dt=Math.min(0.033,(now-last)/1000); last=now;
    if(state.running) update(dt);
    draw(now); requestAnimationFrame(loop);
  }

  function init(){ bindInputs(); spawnWaveInitial(); requestAnimationFrame(loop); }
  init();
  ['touchstart','pointerdown','mousedown','click','keydown'].forEach(ev=>window.addEventListener(ev,startAudioIfNeeded,{once:false}));
})();
