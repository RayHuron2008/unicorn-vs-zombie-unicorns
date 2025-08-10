(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // --- HUD refs ---
  const HUD = {
    lives: document.getElementById('lives'),
    score: document.getElementById('score'),
    powerFill: document.getElementById('powerFill'),
  };

  // --- AUDIO (root files) ---
  const audio = {
    main: new Audio('bgm_main.mp3'),
    boss: new Audio('bgm_boss.mp3'),
    win:  new Audio('jingle_victory.mp3'),
    over: new Audio('jingle_gameover.mp3'),
    ray:  new Audio('sfx_ray.mp3'),
    bonk: new Audio('sfx_headbutt.mp3'),
    started:false
  };
  audio.main.loop = audio.boss.loop = true;
  [audio.main,audio.boss,audio.win,audio.over].forEach(a=>a.volume=0.7);
  function startAudioIfNeeded(){ if(audio.started) return; audio.started=true; try{ audio.main.currentTime=0; audio.main.play(); }catch(_){} }

  // --- CONSTANTS / HELPERS ---
  const W = canvas.width, H = canvas.height;
  const GROUND_Y = Math.floor(H * 0.78);
  const GROUND_BAND = 56;                  // vertical room to move
  const MIN_Y = GROUND_Y - GROUND_BAND;
  const MAX_Y = GROUND_Y;
  const rand = (a,b)=>a+Math.random()*(b-a);
  const dist = (x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);

  // Spawn/spacing tuning
  const MAX_ENEMIES   = 4;    // hard cap on-screen
  const MIN_ENEMY_SEP = 120;  // keep enemies apart
  const SAFE_RADIUS   = 200;  // don’t spawn right on player
  const START_GRACE   = 2.5;  // slower first seconds

  // --- STATE ---
  let state = {
    running: true,
    score: 0,
    lives: 3,
    power: 0,
    wave: 1,
    enemies: [],
    bolts: [],
    confetti: [],
    specialTimer: 0,
    kills: 0,
    spawnTimer: 0,
    time: 0,
  };

  const input = { dx:0, dy:0, holding:false, sprint:false };
  const player = {
    x: W*0.25, y: GROUND_Y-8, speed: 2.2, size: 18,
    dashCD: 0, face: 1,
    dashTimer: 0,        // during dash
    invuln: 0            // damage immunity
  };

  // --- INPUT (D-pad + A/B) ---
  function bindInputs(){
    const dpad = document.getElementById('dpad');
    dpad.querySelectorAll('.dir').forEach(btn => {
      const dx = parseFloat(btn.dataset.dx), dy = parseFloat(btn.dataset.dy);
      const start = e => { input.dx=dx; input.dy=dy; input.holding=true; startAudioIfNeeded(); e.preventDefault(); };
      const end = () => { input.holding=false; input.dx=input.dy=0; };
      btn.addEventListener('touchstart', start, {passive:false});
      btn.addEventListener('touchend', end);
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    });
    const btnA=document.getElementById('btnA'), btnB=document.getElementById('btnB');
    btnA.addEventListener('touchstart', e=>{ attack(); e.preventDefault(); startAudioIfNeeded(); });
    btnA.addEventListener('mousedown', ()=>attack());
    btnB.addEventListener('touchstart', e=>{ input.sprint=true; e.preventDefault(); startAudioIfNeeded(); });
    btnB.addEventListener('touchend', ()=>{ input.sprint=false; });
    btnB.addEventListener('mousedown', ()=>{ input.sprint=true; });
    btnB.addEventListener('mouseup', ()=>{ input.sprint=false; });
  }

  // --- SPAWNING (gentle + anti-cluster + capped) ---
  function spawnWaveInitial(){
    const n = 2; // gentle start
    for(let i=0;i<n;i++) spawnEnemy(false, true);
    if (Math.random() < 0.25) spawnEnemy(true, true);
  }

  function spawnEnemy(special, initial=false){
    if (state.enemies.length >= MAX_ENEMIES) return;

    const fromLeft = Math.random() < 0.5;
    let x = fromLeft ? -20 : W + 20;
    let y = rand(MIN_Y, MAX_Y);

    // try to find a clean spot (away from player + other enemies)
    let tries = 0;
    while (tries++ < 20) {
      let ok = true;
      if (dist(x,y,player.x,player.y) < SAFE_RADIUS) ok = false;
      if (ok) {
        for (const e of state.enemies) {
          if (dist(x,y,e.x,e.y) < MIN_ENEMY_SEP) { ok = false; break; }
        }
      }
      if (ok) break;
      y = rand(MIN_Y, MAX_Y);
    }

    state.enemies.push({
      x, y, vx:0, vy:0,
      hp: special ? 3 : 1,
      special,
      cd: Math.random()*1.2 + 0.6,
      face: fromLeft ? 1 : -1
    });
  }

  // --- ATTACKS ---
  function attack(){
    if (state.specialTimer > 0){
      // Ray shot (horizontal)
      const dirX = (input.dx !== 0 ? Math.sign(input.dx) : player.face) || 1;
      state.bolts.push({ x: player.x + dirX*24, y: player.y - 10, vx: dirX*280, vy: 0, enemy:false, life:0.9 });
      try { audio.ray.currentTime = 0; audio.ray.play(); } catch(e){}
    } else {
      // Headbutt dash — strong + invulnerable
      if(player.dashCD<=0){
        const a = Math.atan2(input.dy, input.dx) || 0;
        const dashX = Math.cos(a) * 48;
        const dashY = Math.sin(a) * 18;
        player.x = Math.max(20, Math.min(W-20, player.x + dashX));
        player.y = Math.max(MIN_Y, Math.min(MAX_Y, player.y + dashY));
        if (dashX !== 0) player.face = dashX < 0 ? -1 : 1;

        // Safe window
        player.dashTimer = 0.22;
        player.invuln    = 0.35;

        // Damage enemies on contact during dash
        for(const e of state.enemies){
          if (Math.hypot(e.x-player.x, e.y-player.y) < 32){
            e.hp -= 2; // make headbutt lethal
            addConfetti(e.x,e.y);
            try { audio.bonk.currentTime = 0; audio.bonk.play(); } catch(e){}
            if(e.hp<=0) onKill(e);
          }
        }
        player.dashCD = 0.32;
      }
    }
  }

  function onKill(e){
    state.kills += 1;
    state.score += e.special ? 500 : 100;
    state.power = Math.min(100, state.power+12);
    if (state.kills % 10 === 0) state.lives += 1;
    if (e.special){
      state.specialTimer = 30;
      try{ audio.main.pause(); audio.boss.currentTime=0; audio.boss.play(); }catch(_){}
      setTimeout(()=>{ if(state.specialTimer<=0){ try{ audio.boss.pause(); audio.main.play(); }catch(_){}} }, 30500);
    }
    e.hp = 0;
  }

  function addConfetti(x,y){
    for(let i=0;i<14;i++){
      state.confetti.push({
        x,y,
        vx: Math.cos(i/14*Math.PI*2)*(0.6+Math.random()*1.4),
        vy: Math.sin(i/14*Math.PI*2)*(0.6+Math.random()*1.4),
        t:  0.4 + Math.random()*0.5,
        hue: Math.floor(Math.random()*360)
      });
    }
  }

  // --- DAMAGE / GAME OVER / RESTART ---
  function damagePlayer(){
    if (player.invuln > 0) return; // ignore damage while invulnerable
    state.lives -= 1;
    if(state.lives<=0){ gameOver(); }
  }

  function resetGame(){
    // reset state
    state.running = true;
    state.score = 0;
    state.lives = 3;
    state.power = 0;
    state.wave = 1;
    state.enemies = [];
    state.bolts = [];
    state.confetti = [];
    state.specialTimer = 0;
    state.kills = 0;
    state.spawnTimer = 0;
    state.time = 0;

    // reset player
    player.x = W * 0.25;
    player.y = GROUND_Y - 8;
    player.face = 1;
    player.dashCD = 0;
    player.dashTimer = 0;
    player.invuln = 0;

    // music
    try { audio.boss.pause(); audio.main.currentTime = 0; audio.main.play(); } catch(e){}

    // small grace period then spawn
    setTimeout(spawnWaveInitial, 100);
  }

  function gameOver(){
    state.running = false;
    try{ audio.main.pause(); audio.boss.pause(); audio.over.currentTime=0; audio.over.play(); }catch(_){}
    setTimeout(resetGame, 1500); // auto-restart after jingle
  }

  // --- UPDATE ---
  function update(dt){
    if(!state.running) return;
    state.time += dt;
    player.invuln = Math.max(0, player.invuln - dt);
    player.dashTimer = Math.max(0, player.dashTimer - dt);

    // Player movement (wider space)
    const spd = player.speed * (input.sprint?1.6:1);
    if (input.dx !== 0) player.face = Math.sign(input.dx);
    player.x = Math.max(20, Math.min(W-20, player.x + input.dx*spd*60*dt));
    player.y = Math.max(MIN_Y, Math.min(MAX_Y, player.y + input.dy*spd*52*dt));
    player.dashCD = Math.max(0, player.dashCD - dt);

    // Enemies: chase + tiny vertical drift
    for(const e of state.enemies){
      const dirX = Math.sign(player.x - e.x) || e.face || 1;
      const dirY = Math.sign(player.y - e.y);
      const s = e.special?1.05:0.85;  // slightly slower for easier headbutts
      e.x += dirX * s;
      e.y = Math.max(MIN_Y, Math.min(MAX_Y, e.y + dirY * 0.35));
      e.face = dirX;

      // Special shooters fire horizontally
      if(e.special){
        e.cd -= dt;
        if(e.cd<=0){
          const vx = dirX * 190;
          state.bolts.push({ x:e.x + dirX*22, y:e.y - 10, vx, vy:0, enemy:true, life:1.4 });
          e.cd = 1.0 + Math.random()*0.7;
        }
      }

      // Touch damage (off while invulnerable)
      if(Math.hypot(e.x-player.x, e.y-player.y)<26 && player.invuln<=0){
        damagePlayer();
      }
    }

    // Soft separation so enemies don't stack
    for (let i = 0; i < state.enemies.length; i++) {
      for (let j = i + 1; j < state.enemies.length; j++) {
        const a = state.enemies[i], b = state.enemies[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < MIN_ENEMY_SEP) {
          const push = (MIN_ENEMY_SEP - d) * 0.5;
          dx /= d; dy /= d;
          a.x -= dx * push; a.y = Math.max(MIN_Y, Math.min(MAX_Y, a.y - dy * push));
          b.x += dx * push; b.y = Math.max(MIN_Y, Math.min(MAX_Y, b.y + dy * push));
        }
      }
    }

    // Bolts
    for(let i=state.bolts.length-1;i>=0;i--){
      const b = state.bolts[i];
      b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
      if(b.life<=0 || b.x<0||b.x>W||b.y<0||b.y>H){ state.bolts.splice(i,1); continue; }
      if(!b.enemy){
        for(const e of state.enemies){
          if(Math.hypot(b.x-e.x, b.y-e.y)<18){
            e.hp-=2; addConfetti(e.x,e.y);
            if(e.hp<=0) onKill(e);
            state.bolts.splice(i,1);
            break;
          }
        }
      } else {
        if(player.invuln<=0 && Math.hypot(b.x-player.x, b.y-player.y)<16){
          damagePlayer(); state.bolts.splice(i,1);
        }
      }
    }

    // Clean & confetti
    state.enemies = state.enemies.filter(e=>e.hp>0);
    for(let i=state.confetti.length-1;i>=0;i--){
      const c = state.confetti[i]; c.x+=c.vx; c.y+=c.vy; c.t-=dt; if(c.t<=0) state.confetti.splice(i,1);
    }

    // Controlled spawns (slow at start, capped at 4)
    const spawnInterval = state.time < START_GRACE ? 1.3 : 0.9;
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.enemies.length < MAX_ENEMIES){
      spawnEnemy(Math.random()<0.25);
      state.spawnTimer = spawnInterval + Math.random()*0.4;
    }

    // HUD
    HUD.lives.textContent = `🦄 x ${state.lives}`;
    HUD.score.textContent = `Score: ${state.score}`;
    HUD.powerFill.style.width = `${state.power}%`;
  }

  // --- DRAW ---
  function drawBackground(){
    // Sky bands
    const bands = ['#82d8ff','#a8e4ff','#d0f1ff','#e9f9ff'];
    for(let i=0;i<bands.length;i++){
      ctx.fillStyle = bands[i];
      ctx.fillRect(0, i*(H/6), W, H/6);
    }
    // Hills
    ctx.fillStyle = '#2ecc71'; ctx.fillRect(0,H*0.65,W,H*0.35);
    ctx.fillStyle = '#27ae60';
    for(let i=0;i<6;i++){
      const x = i*180 - 60;
      ctx.fillRect(x, H*0.62, 160, 12);
      ctx.fillRect(x+20, H*0.60, 120, 12);
      ctx.fillRect(x+40, H*0.58, 80,  12);
    }
    // Rainbow
    const arcs = ['#ff3b6b','#ff8a00','#ffe600','#19ff00','#00c3ff','#8a2be2'];
    for(let i=0;i<arcs.length;i++){
      ctx.strokeStyle = arcs[i]; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.arc(W*0.6, H*0.78, 220-i*18, Math.PI, Math.PI*2); ctx.stroke();
    }
    // Ground strip
    ctx.fillStyle = '#7b4e2b';
    ctx.fillRect(0, GROUND_Y + 8, W, H - (GROUND_Y+8));
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(0, GROUND_Y, W, 8);
  }

  function drawUnicornFacing(x, y, face, main='#ff9bd4', mane=['#ff3b6b','#ffb86b','#ffe27a','#9dff8b','#6be3ff','#c59bff']){
    const baseY = y - 22; // align hooves to ground
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(face, 1); // face: 1 right, -1 left
    ctx.imageSmoothingEnabled = false;

    // body + head
    ctx.fillStyle = main; ctx.fillRect(-18,-10, 34,20);
    ctx.fillRect(14,-8, 12,14);
    // legs
    ctx.fillStyle = '#2b1c3b';
    ctx.fillRect(-14,8, 6,14);
    ctx.fillRect(-2,8, 6,14);
    ctx.fillRect(8,8, 6,14);
    ctx.fillRect(18,8, 6,14);
    // horn + mane + eye
    ctx.fillStyle = '#ffe35a'; ctx.fillRect(24,-10, 2,8);
    for(let i=0;i<mane.length;i++){ ctx.fillStyle = mane[i]; ctx.fillRect(-10,-12+i*2, 28,2); }
    ctx.fillStyle = '#000'; ctx.fillRect(22,-2,2,2);
    ctx.restore();
  }

  function drawZombie(e){
    drawUnicornFacing(e.x, e.y, e.face || 1, '#86e6b6', ['#b0ffcf','#8ce6c1','#6cd4b2']);
  }

  function draw(now){
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
    drawBackground();

    // bolts
    for(const b of state.bolts){
      ctx.fillStyle = b.enemy? '#ff6b6b' : '#ffffff';
      ctx.fillRect(Math.floor(b.x)-2, Math.floor(b.y)-2, 4,4);
    }
    // confetti
    for(const c of state.confetti){
      ctx.fillStyle = `hsl(${c.hue},90%,60%)`;
      ctx.fillRect(Math.floor(c.x), Math.floor(c.y), 3,3);
    }
    // enemies + player
    for(const e of state.enemies) drawZombie(e);
    drawUnicornFacing(player.x, player.y, player.face);
  }

  // --- LOOP ---
  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.033,(now-last)/1000); last=now;
    if(state.running) update(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  function init(){ bindInputs(); spawnWaveInitial(); requestAnimationFrame(loop); }
  init();

  // Start music on first input
  const first = () => { startAudioIfNeeded(); window.removeEventListener('touchstart', first); window.removeEventListener('mousedown', first); };
  window.addEventListener('touchstart', first, { once:true });
  window.addEventListener('mousedown', first, { once:true });
})();
