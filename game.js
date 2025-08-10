(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // --- HUD refs ---
  const HUD = {
    lives: document.getElementById('lives'),
    score: document.getElementById('score'),
    powerFill: document.getElementById('powerFill'),
  };

  // --- AUDIO (only main theme) ---
  const audio = {
    main: new Audio('bgm_main.mp3'),
    started: false
  };
  audio.main.loop = true;
  audio.main.volume = 0.7;
  function startAudioIfNeeded(){ if(audio.started) return; audio.started = true; try{ audio.main.currentTime=0; audio.main.play(); }catch(_){} }

  // --- CONSTANTS / HELPERS ---
  const W = canvas.width, H = canvas.height;
  const GROUND_Y = Math.floor(H * 0.78);
  const GROUND_BAND = 56;
  const MIN_Y = GROUND_Y - GROUND_BAND;
  const MAX_Y = GROUND_Y;

  const rand = (a,b)=>a+Math.random()*(b-a);
  const dist = (x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);

  // Spawn/spacing tuning
  const MAX_ENEMIES   = 4;     // on-screen cap
  const MIN_ENEMY_SEP = 120;   // enemy spacing
  const SAFE_RADIUS   = 200;   // don't spawn on player
  const START_GRACE   = 2.0;   // slower first seconds

  // Projectiles
  const ENEMY_BULLET_SPEED = 190;
  const PLAYER_RAY_SPEED   = 280;
  const PLAYER_RAY_SPEED_MEGA = 360;

  // --- STATE ---
  let state = {
    running: true,
    score: 0,
    lives: 3,
    power: 0,
    wave: 1,
    enemies: [],
    bolts: [],          // both enemy and player projectiles
    confetti: [],
    kills: 0,
    spawnTimer: 0,
    time: 0,
    specialTimer: 0,    // >0 when player has ray power
    megaTimer: 0,       // >0 when player is in MEGA mode
    toast: null,        // small on-screen message
    toastT: 0
  };

  const input = { dx:0, dy:0, holding:false, sprint:false };
  const player = {
    x: W*0.25, y: GROUND_Y-8, speed: 2.2, size: 18,
    dashCD: 0, face: 1,
    dashTimer: 0,
    invuln: 0
  };

  // --- INPUT (D-pad + A/B) ---
  function bindInputs(){
    const dpad = document.getElementById('dpad');
    dpad.querySelectorAll('.dir').forEach(btn => {
      const dx = parseFloat(btn.dataset.dx), dy = parseFloat(btn.dataset.dy);
      const start = e => { startAudioIfNeeded(); input.dx=dx; input.dy=dy; input.holding=true; e.preventDefault(); };
      const end = () => { input.holding=false; input.dx=input.dy=0; };
      btn.addEventListener('touchstart', start, {passive:false});
      btn.addEventListener('touchend', end);
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    });
    const btnA=document.getElementById('btnA'), btnB=document.getElementById('btnB');
    btnA.addEventListener('touchstart', e=>{ startAudioIfNeeded(); attack(); e.preventDefault(); });
    btnA.addEventListener('mousedown', ()=>{ startAudioIfNeeded(); attack(); });
    btnB.addEventListener('touchstart', e=>{ startAudioIfNeeded(); input.sprint=true; e.preventDefault(); });
    btnB.addEventListener('touchend', ()=>{ input.sprint=false; });
    btnB.addEventListener('mousedown', ()=>{ startAudioIfNeeded(); input.sprint=true; });
    btnB.addEventListener('mouseup', ()=>{ input.sprint=false; });
  }

  // --- TOAST / ICON HELPERS ---
  function showToast(text, seconds=1.4){
    state.toast = text;
    state.toastT = seconds;
  }

  // --- SPAWNING (gentle + anti-cluster + capped + 1 special max) ---
  function countSpecials(){
    let c=0; for(const e of state.enemies) if(e.special) c++; return c;
  }

  function spawnWaveInitial(){
    const n = 2;
    for(let i=0;i<n;i++) spawnEnemy(false, true);
    if (Math.random() < 0.25) spawnEnemy(true, true); // sometimes one early
  }

  function spawnEnemy(special, initial=false){
    if (state.enemies.length >= MAX_ENEMIES) return;

    // enforce at most one special on screen
    if (special && countSpecials() >= 1) special = false;

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
      x, y,
      vx:0, vy:0,
      hp: special ? 3 : 2,      // killable but tougher
      special,
      cd: special ? rand(0.9,1.4) : 0, // shoot cooldown for special
      face: fromLeft ? 1 : -1
    });
  }

  // --- ATTACKS ---
  function attack(){
    if (state.specialTimer > 0){
      // Ray shot (horizontal)
      const dirX = (input.dx !== 0 ? Math.sign(input.dx) : player.face) || 1;
      const spd = state.megaTimer > 0 ? PLAYER_RAY_SPEED_MEGA : PLAYER_RAY_SPEED;
      state.bolts.push({ x: player.x + dirX*24, y: player.y - 10, vx: dirX*spd, vy: 0, enemy:false, life:0.9, mega:(state.megaTimer>0) });
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
            e.hp -= 2; // headbutt is potent
            addConfetti(e.x,e.y);
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

    // Ray-gun pickup
    if (e.special){
      state.specialTimer = 25; // seconds of ray power
      showToast('🔫 RAY POWER!', 1.6);
    }

    // MEGA mode every 20 kills
    if (state.kills > 0 && state.kills % 20 === 0){
      state.megaTimer = 20;     // 20 seconds big mode
      showToast('🌈 MEGA MODE!', 1.6);
    }

    e.hp = 0;
  }

  // --- FX ---
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
    if (player.invuln > 0) return; // ignore while invulnerable
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
    state.kills = 0;
    state.spawnTimer = 0;
    state.time = 0;
    state.specialTimer = 0;
    state.megaTimer = 0;
    state.toast = null; state.toastT = 0;

    // reset player
    player.x = W * 0.25;
    player.y = GROUND_Y - 8;
    player.face = 1;
    player.dashCD = 0;
    player.dashTimer = 0;
    player.invuln = 0;

    startAudioIfNeeded();
    setTimeout(spawnWaveInitial, 100);
  }

  function gameOver(){
    state.running = false;
    setTimeout(resetGame, 1000);
  }

  // --- UPDATE ---
  function update(dt){
    if(!state.running) return;
    state.time += dt;
    player.invuln = Math.max(0, player.invuln - dt);
    player.dashTimer = Math.max(0, player.dashTimer - dt);
    if (state.specialTimer > 0) state.specialTimer = Math.max(0, state.specialTimer - dt);
    if (state.megaTimer > 0) state.megaTimer = Math.max(0, state.megaTimer - dt);
    if (state.toastT > 0) state.toastT = Math.max(0, state.toastT - dt);

    // Player movement (wider space)
    const spd = player.speed * (input.sprint?1.6:1) * (state.megaTimer>0 ? 1.05 : 1);
    if (input.dx !== 0) player.face = Math.sign(input.dx);
    player.x = Math.max(20, Math.min(W-20, player.x + input.dx*spd*60*dt));
    player.y = Math.max(MIN_Y, Math.min(MAX_Y, player.y + input.dy*spd*52*dt));
    player.dashCD = Math.max(0, player.dashCD - dt);

    // Enemies: chase + tiny vertical drift
    for(const e of state.enemies){
      const dirX = Math.sign(player.x - e.x) || e.face || 1;
      const dirY = Math.sign(player.y - e.y);
      const s = e.special?0.95:0.80;   // special a touch faster
      e.x += dirX * s;
      e.y = Math.max(MIN_Y, Math.min(MAX_Y, e.y + dirY * 0.35));
      e.face = dirX;

      // Special shooters fire horizontally
      if(e.special){
        e.cd -= dt;
        if(e.cd<=0){
          const vx = dirX * ENEMY_BULLET_SPEED;
          state.bolts.push({ x:e.x + dirX*22, y:e.y - 10, vx, vy:0, enemy:true, life:1.5 });
          e.cd = rand(1.0, 1.6);
        }
      }

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

    // Bolts (player + enemy)
    for(let i=state.bolts.length-1;i>=0;i--){
      const b = state.bolts[i];
      b.x += b.vx*dt; b.y += (b.vy||0)*dt; b.life -= dt;
      if(b.life<=0 || b.x<0||b.x>W||b.y<0||b.y>H){ state.bolts.splice(i,1); continue; }

      if(!b.enemy){
        // Player ray hits enemies (mega rays do more)
        for(const e of state.enemies){
          if(Math.hypot(b.x-e.x, b.y-e.y)<18){
            e.hp -= (b.mega ? 3 : 2);
            addConfetti(e.x,e.y);
            if(e.hp<=0) onKill(e);
            state.bolts.splice(i,1);
            break;
          }
        }
      } else {
        // Enemy bullet hits player
        if(player.invuln<=0 && Math.hypot(b.x-player.x, b.y-player.y)<16){
          damagePlayer(); state.bolts.splice(i,1);
        }
      }
    }

    // Clean & confetti lifetimes
    state.enemies = state.enemies.filter(e=>e.hp>0);
    for(let i=state.confetti.length-1;i>=0;i--){
      const c = state.confetti[i]; c.x+=c.vx; c.y+=c.vy; c.t-=dt; if(c.t<=0) state.confetti.splice(i,1);
    }

    // Controlled spawns (slow at start, capped at 4)
    const spawnInterval = state.time < START_GRACE ? 1.3 : 0.9;
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.enemies.length < MAX_ENEMIES){
      const trySpecial = Math.random() < 0.25;
      spawnEnemy(trySpecial);
      state.spawnTimer = spawnInterval + Math.random()*0.4;
    }

    // HUD
    HUD.lives.textContent = `🦄 x ${state.lives}`;
    HUD.score.textContent = `Score: ${state.score}`;
    // power bar shows ray timer if active; otherwise generic power
    const pct = state.specialTimer > 0 ? (state.specialTimer/25)*100 : state.power;
    HUD.powerFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
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
    const baseY = y - 22; // hooves to ground
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(face, 1); // 1 right, -1 left
    ctx.imageSmoothingEnabled = false;

    // Apply MEGA scale (slight)
    const scale = state.megaTimer > 0 ? 1.25 : 1.0;
    ctx.scale(scale, scale);

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
    const mane = e.special ? ['#a6ffc8','#7feeb2','#52d8a0'] : ['#b0ffcf','#8ce6c1','#6cd4b2'];
    drawUnicornFacing(e.x, e.y, e.face || 1, '#86e6b6', mane);
  }

  function drawPickupsUI(){
    // Ray icon when active
    if (state.specialTimer > 0){
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#111'; ctx.fillRect(10, 40, 120, 32);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(10, 40, 120, 32);
      ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
      ctx.fillText('RAY POWER', 20, 60);

      // tiny timer bar
      const w = Math.max(0, Math.min(1, state.specialTimer/25)) * 100;
      ctx.fillStyle = '#00d4ff'; ctx.fillRect(20, 64, w, 4);
      ctx.restore();
    }

    // Mega icon when active
    if (state.megaTimer > 0){
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#111'; ctx.fillRect(10, 76, 120, 32);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(10, 76, 120, 32);
      ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
      ctx.fillText('MEGA MODE', 20, 96);

      const w = Math.max(0, Math.min(1, state.megaTimer/20)) * 100;
      ctx.fillStyle = '#ff69ff'; ctx.fillRect(20, 100, w, 4);
      ctx.restore();
    }

    // Toast (short messages)
    if (state.toast && state.toastT > 0){
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.toastT / 0.4);
      ctx.fillStyle = '#111'; ctx.fillRect(W/2-80, 24, 160, 30);
      ctx.strokeStyle = '#fff'; ctx.strokeRect(W/2-80, 24, 160, 30);
      ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
      ctx.fillText(state.toast, W/2-70, 44);
      ctx.restore();
    }
  }

  function draw(now){
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
    drawBackground();

    // bolts
    for(const b of state.bolts){
      ctx.fillStyle = b.enemy? '#ff6b6b' : (b.mega ? '#ffd800' : '#ffffff');
      const w = b.mega ? 6 : 4;
      ctx.fillRect(Math.floor(b.x)-w/2, Math.floor(b.y)-2, w, 4);
    }

    // confetti
    for(const c of state.confetti){
      ctx.fillStyle = `hsl(${c.hue},90%,60%)`;
      ctx.fillRect(Math.floor(c.x), Math.floor(c.y), 3,3);
    }

    // enemies + player
    for(const e of state.enemies) drawZombie(e);
    drawUnicornFacing(player.x, player.y, player.face);

    // power icons / timers / toast
    drawPickupsUI();
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

  // Start music on first input (any gesture)
  ['touchstart','pointerdown','mousedown','click','keydown'].forEach(ev=>{
    window.addEventListener(ev, startAudioIfNeeded, { once:false });
  });
})();
