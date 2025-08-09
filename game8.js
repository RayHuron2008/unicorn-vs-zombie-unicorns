(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = {
    lives: document.getElementById('lives'),
    score: document.getElementById('score'),
    powerFill: document.getElementById('powerFill'),
    pauseBtn: document.getElementById('pauseBtn'),
  };
  const pauseMenu = document.getElementById('pauseMenu');
  const resumeBtn = document.getElementById('resume');
  const restartBtn = document.getElementById('restart');
  const muteToggle = document.getElementById('muteToggle');
  // --- FORCE HIDE PAUSE OVERLAY & SHOW VERSION TAG ---
  function forceHidePauseOverlay(){
    try { pauseMenu.hidden = true; } catch(e){}
  }
  // Hide it immediately and after any user interaction (covers iOS oddities)
  forceHidePauseOverlay();
  window.addEventListener('touchstart', forceHidePauseOverlay);
  window.addEventListener('mousedown', forceHidePauseOverlay);
  // Tag for visual verification
  const __UVZU_VERSION__ = 'v8';


  // Controls
  const joystick = document.getElementById('joystick');
  const stick = document.getElementById('stick');
  const btnA = document.getElementById('btnA'); // Attack / Ray
  const btnB = document.getElementById('btnB'); // Sprint

  // --- AUDIO (pre-wired) --- //
  const audio = {
    musicMain: new Audio('assets/bgm_main.mp3'),
    musicBoss: new Audio('assets/bgm_boss.mp3'),
    victory:   new Audio('assets/jingle_victory.mp3'),
    gameover:  new Audio('assets/jingle_gameover.mp3'),
    sfxRay:    new Audio('assets/sfx_ray.mp3'),        // optional
    sfxBonk:   new Audio('assets/sfx_headbutt.mp3'),   // optional
    enabled: true,
    started: false
  };
  [audio.musicMain, audio.musicBoss].forEach(a => a.loop = true);
  [audio.musicMain, audio.musicBoss, audio.victory, audio.gameover].forEach(a => a.volume = 0.7);
  if (muteToggle) muteToggle.checked = false;

  function startAudioIfNeeded() {
    if (!audio.enabled || audio.started) return;
    audio.started = true;
    try {
      audio.musicMain.currentTime = 0;
      audio.musicMain.play();
    } catch(e){/* ignored */}
  }
  function playBossMusic() {
    if (!audio.enabled) return;
    audio.musicMain.pause();
    try { audio.musicBoss.currentTime = 0; audio.musicBoss.play(); } catch(e){}
  }
  function playMainMusic() {
    if (!audio.enabled) return;
    audio.musicBoss.pause();
    try { audio.musicMain.currentTime = 0; audio.musicMain.play(); } catch(e){}
  }

  if (muteToggle) {
    muteToggle.addEventListener('change', () => {
      audio.enabled = !muteToggle.checked;
      const all = [audio.musicMain, audio.musicBoss, audio.victory, audio.gameover, audio.sfxRay, audio.sfxBonk].filter(Boolean);
      if (!audio.enabled) {
        all.forEach(a => { try{ a.pause(); }catch(e){} });
      } else {
        startAudioIfNeeded();
      }
    });
  }

  // Game constants
  const W = canvas.width, H = canvas.height;
  const TWO_PI = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (x1,y1,x2,y2) => Math.hypot(x2-x1, y2-y1);
  const rand = (a,b) => a + Math.random()*(b-a);

  let state = {
    running: true,   // start running
    score: 0,
    lives: 3,
    power: 0,
    wave: 1,
    corruption: 0,
    enemies: [],
    bullets: [],
    effects: [],
    specialTimer: 0,
  };

  const player = {
    x: W*0.5, y: H*0.6,
    vx: 0, vy: 0,
    speed: 2.1,
    sprintMult: 1.7,
    size: 20,
    heading: 0,
    dashing: false,
    dashCooldown: 0,
  };

  // Virtual joystick
  let joyActive = false;

  function setupJoystick() {
    function onStart(e){
      joyActive = true;
      const t = (e.touches ? e.touches[0] : e);
      updateStick(t.clientX, t.clientY);
      e.preventDefault();
      startAudioIfNeeded();
    }
    function onMove(e){
      if(!joyActive) return;
      const t = (e.touches ? e.touches[0] : e);
      updateStick(t.clientX, t.clientY);
      e.preventDefault();
    }
    function onEnd(){
      joyActive = false;
      stick.style.left = '47px';
      stick.style.top  = '47px';
      input.dx = 0; input.dy = 0;
    }

    joystick.addEventListener('touchstart', onStart, {passive:false});
    joystick.addEventListener('touchmove', onMove, {passive:false});
    joystick.addEventListener('touchend', onEnd);
    joystick.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  }

  const input = { dx:0, dy:0, sprint:false, attack:false };
  function updateStick(cx, cy){
    const jr = joystick.getBoundingClientRect();
    const center = { x: jr.left + jr.width/2, y: jr.top + jr.height/2 };
    const angle = Math.atan2(cy - center.y, cx - center.x);
    const maxR = jr.width*0.35;
    const d = Math.min(maxR, Math.hypot(cx - center.x, cy - center.y));
    const sx = Math.cos(angle)*d;
    const sy = Math.sin(angle)*d;
    stick.style.left = (jr.width/2 + sx - stick.offsetWidth/2) + 'px';
    stick.style.top  = (jr.height/2 + sy - stick.offsetHeight/2) + 'px';
    input.dx = (sx/maxR);
    input.dy = (sy/maxR);
  }

  // Buttons
  btnA.addEventListener('touchstart', e => { input.attack = true; e.preventDefault(); startAudioIfNeeded(); });
  btnA.addEventListener('mousedown', () => { input.attack = true; startAudioIfNeeded(); });
  btnB.addEventListener('touchstart', e => { input.sprint = true; e.preventDefault(); startAudioIfNeeded(); });
  btnB.addEventListener('touchend', e => { input.sprint = false; e.preventDefault(); });
  btnB.addEventListener('mousedown', () => input.sprint = true);
  btnB.addEventListener('mouseup', () => input.sprint = false);
  window.addEventListener('mouseup', () => input.attack = false);
  window.addEventListener('touchend', () => input.attack = false);

  // Pause
  function setPaused(p){
    state.running = !p;
    try { pauseMenu.hidden = true; } catch(e){}
  }
  hud.pauseBtn.addEventListener('click', () => setPaused(true));
  resumeBtn.addEventListener('click', () => { setPaused(false); startAudioIfNeeded(); });
  restartBtn.addEventListener('click', () => { location.reload(); });

  // Ensure we never start paused; also dismiss overlay on first interaction anywhere
  setTimeout(() => { setPaused(false); }, 0);
  const firstStart = () => { setPaused(false); startAudioIfNeeded(); window.removeEventListener('touchstart', firstStart); window.removeEventListener('mousedown', firstStart); };
  window.addEventListener('touchstart', firstStart, { once:true });
  window.addEventListener('mousedown', firstStart, { once:true });

  // Spawning
  function spawnWave(){
    const base = 6 + state.wave*2;
    for(let i=0;i<base;i++) spawnEnemy();
    if(Math.random() < 0.4) spawnEnemy(true);
  }

  function spawnEnemy(special=false){
    const side = Math.floor(Math.random()*4);
    let x=0,y=0;
    if(side===0){ x = -30; y = Math.random()*H; }
    if(side===1){ x = W+30; y = Math.random()*H; }
    if(side===2){ x = Math.random()*W; y = -30; }
    if(side===3){ x = Math.random()*W; y = H+30; }
    const speed = special ? (1.1 + Math.random()*0.5) : (0.8 + Math.random()*0.6);
    state.enemies.push({ x,y,vx:0,vy:0,size: 18, hp: special?3:1, special, fireCooldown: 0.8 + Math.random()*1.0 });
  }

  function rainbowBackground(t){
    const g = ctx.createLinearGradient(0, 0, W, H);
    const colors = ['#ff3b6b','#ff8a00','#ffe600','#19ff00','#00c3ff','#8a2be2'];
    colors.forEach((c,i)=> g.addColorStop((i/colors.length), c));
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
    for(let i=0;i<5;i++){
      const cx = (t*0.02 + i*200) % (W+200) - 200;
      const cy = 60 + i*60 + Math.sin((t*0.001)+i)*10;
      drawCloud(cx, cy);
    }
  }
  function drawCloud(x,y){
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x,y,22,0,Math.PI*2);
    ctx.arc(x+24,y+6,18,0,Math.PI*2);
    ctx.arc(x-20,y+10,16,0,Math.PI*2);
    ctx.fill();
  }

  function drawUnicorn(x,y,dir,mainColor='#ffdff6',maneGradient=true){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(dir);
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.ellipse(0,0,22,14,0,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(20,-4,12,10,0,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10,10); ctx.lineTo(-14,18);
    ctx.moveTo(0,10); ctx.lineTo(-4,20);
    ctx.moveTo(8,10); ctx.lineTo(6,20);
    ctx.moveTo(16,10); ctx.lineTo(18,20);
    ctx.stroke();
    ctx.strokeStyle = '#ffe35a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30,-8); ctx.lineTo(38,-14);
    ctx.stroke();
    if(maneGradient){
      const g = ctx.createLinearGradient(-10,-10,30,10);
      g.addColorStop(0,'#ff3b6b'); g.addColorStop(0.25,'#ff8a00');
      g.addColorStop(0.5,'#ffe600'); g.addColorStop(0.75,'#19ff00');
      g.addColorStop(1,'#00c3ff');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = '#b0ffcf';
    }
    ctx.beginPath();
    ctx.ellipse(8,-10,16,8,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(24,-6,2.5,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawZombie(u){
    ctx.save();
    const dir = Math.atan2(u.vy, u.vx);
    drawUnicorn(u.x, u.y, dir, '#d7ffe8', false);
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(u.x+20, u.y-8, 2.5, 0, Math.PI*2);
    ctx.arc(u.x+26, u.y-6, 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,200,170,0.7)';
    ctx.fillRect(u.x-5, u.y+2, 10, 6);
    ctx.restore();
  }

  function drawPlayer(){
    const dir = Math.atan2(player.vy, player.vx);
    drawUnicorn(player.x, player.y, dir);
    if(state.specialTimer > 0){
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x+36*Math.cos(dir), player.y+36*Math.sin(dir), 10, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  function update(dt){
    if(!state.running) return;

    const mag = Math.hypot(input.dx, input.dy);
    let spd = player.speed * (input.sprint ? player.sprintMult : 1);
    if(mag>0.05){
      player.vx = (input.dx/mag) * spd;
      player.vy = (input.dy/mag) * spd;
    } else {
      player.vx *= 0.85;
      player.vy *= 0.85;
    }
    player.x = Math.max(24, Math.min(canvas.width-24, player.x + player.vx));
    player.y = Math.max(24, Math.min(canvas.height-24, player.y + player.vy));

    if(input.attack){
      if(state.specialTimer > 0){
        if(player.dashCooldown <= 0){
          fireRay();
          if (audio.enabled && audio.sfxRay) { try { audio.sfxRay.currentTime = 0; audio.sfxRay.play(); } catch(e){} }
          player.dashCooldown = 0.2;
        }
      } else {
        if(player.dashCooldown <= 0){
          const dir = Math.atan2(player.vy, player.vx) || 0;
          const dx = Math.cos(dir), dy = Math.sin(dir);
          player.x = Math.max(24, Math.min(canvas.width-24, player.x + dx*40));
          player.y = Math.max(24, Math.min(canvas.height-24, player.y + dy*40));
          for(const e of state.enemies){
            const d = Math.hypot(player.x - e.x, player.y - e.y);
            if(d < 34){
              e.hp -= 1;
              state.score += e.special ? 500 : 100;
              addConfetti(e.x,e.y);
              if (audio.enabled && audio.sfxBonk) { try { audio.sfxBonk.currentTime = 0; audio.sfxBonk.play(); } catch(e){} }
              if(e.hp<=0){ killEnemy(e); }
            }
          }
          player.dashCooldown = 0.35;
        }
      }
      input.attack = false;
    }

    player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    state.enemies.forEach(e => {
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      const s = (e.special ? 1.3 : 1.0);
      e.vx = Math.cos(a) * s;
      e.vy = Math.sin(a) * s;
      e.x += e.vx;
      e.y += e.vy;
      if(e.special){
        e.fireCooldown -= dt;
        if(e.fireCooldown <= 0){
          spawnEnemyBolt(e);
          e.fireCooldown = (0.9 + Math.random()*0.9);
        }
      }
    });

    for(let i=state.bullets.length-1;i>=0;i--){
      const b = state.bullets[i];
      b.x += b.vx * dt * 240;
      b.y += b.vy * dt * 240;
      b.life -= dt;
      if(b.life <= 0 || b.x<0||b.x>canvas.width||b.y<0||b.y>canvas.height){
        state.bullets.splice(i,1);
        continue;
      }
      if(b.enemy && Math.hypot(b.x-player.x, b.y-player.y) < 16){
        state.bullets.splice(i,1);
        damagePlayer();
      }
      if(!b.enemy){
        for(const e of state.enemies){
          if(Math.hypot(b.x-e.x, b.y-e.y) < 18){
            e.hp -= 1;
            if(e.hp<=0){
              state.score += e.special ? 500 : 100;
              addConfetti(e.x,e.y);
              killEnemy(e);
            }
          }
        }
      }
    }

    state.enemies = state.enemies.filter(e => e.hp>0 && e.x>-50 && e.x<canvas.width+50 && e.y>-50 && e.y<canvas.height+50);

    for(let i=state.effects.length-1;i>=0;i--){
      const fx = state.effects[i];
      fx.x += fx.vx*dt*60;
      fx.y += fx.vy*dt*60;
      fx.life -= dt;
      if(fx.life<=0) state.effects.splice(i,1);
    }

    if(state.specialTimer>0){
      state.specialTimer = Math.max(0, state.specialTimer - dt);
    }

    if(state.enemies.length < Math.max(2, 4 + state.wave)){
      if(Math.random() < 0.01) spawnEnemy(Math.random()<0.2);
    }
  }

  function fireRay(){
    const dir = Math.atan2(player.vy, player.vx) || 0;
    const dx = Math.cos(dir), dy = Math.sin(dir);
    state.bullets.push({ x: player.x + dx*26, y: player.y + dy*26, vx: dx, vy: dy, enemy:false, life: 0.8 });
  }

  function spawnEnemyBolt(e){
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    const vx = Math.cos(a), vy = Math.sin(a);
    state.bullets.push({ x: e.x + vx*24, y: e.y + vy*24, vx, vy, enemy:true, life: 2.0 });
  }

  let killsThisRun = 0;
  function killEnemy(e){
    state.power = Math.max(0, Math.min(100, state.power + 12));
    killsThisRun++;
    if(killsThisRun % 10 === 0){
      state.lives++;
      updateHUD();
    }
    if(e.special){
      state.specialTimer = 30.0;
      playBossMusic();
      setTimeout(() => { if (state.specialTimer <= 0) playMainMusic(); }, 30500);
    }
    e.hp = 0;
  }

  function addConfetti(x,y){
    for(let i=0;i<16;i++){
      state.effects.push({
        x,y,
        vx: Math.cos(i/16*Math.PI*2)*(0.4 + Math.random()*1.6),
        vy: Math.sin(i/16*Math.PI*2)*(0.4 + Math.random()*1.6),
        life: (0.4 + Math.random()*0.5),
        hue: Math.floor(Math.random()*360)
      });
    }
  }

  function damagePlayer(){
    state.lives -= 1;
    updateHUD();
    if(state.lives <= 0){
      gameOver();
    } else {
      player.x = canvas.width*0.5;
      player.y = canvas.height*0.7;
      state.specialTimer = 0;
      playMainMusic();
    }
  }

  function onVictory(){
    if (!audio.enabled) return;
    try {
      audio.musicMain.pause();
      audio.musicBoss.pause();
      audio.victory.currentTime = 0;
      audio.victory.play();
    } catch(e){}
  }

  function gameOver(){
    setPaused(true);
    pauseMenu.querySelector('h2').textContent = "Game Over";
    if (audio.enabled) {
      try {
        audio.musicMain.pause();
        audio.musicBoss.pause();
        audio.gameover.currentTime = 0;
        audio.gameover.play();
      } catch(e){}
    }
  }

  function updateHUD(){
    hud.lives.textContent = `🦄 x ${state.lives}`;
    hud.score.textContent = `Score: ${state.score}`;
    hud.powerFill.style.width = `${state.power}%`;
  }

  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.033, (now - last)/1000);
    last = now;
    if(state.running){
      update(dt);
      draw(now);
    }
    requestAnimationFrame(loop);
  }

  function draw(now){
    // version tag
    ctx.save(); ctx.globalAlpha=0.7; ctx.fillStyle='#fff'; ctx.font='12px system-ui, sans-serif'; ctx.fillText(__UVZU_VERSION__, 6, 16); ctx.restore();
    ctx.fillStyle = '#052c58';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    rainbowBackground(now);

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 4;
    for(let i=0;i<5;i++){
      ctx.beginPath();
      ctx.arc(canvas.width*0.5, canvas.height*0.9, 180+i*20, Math.PI, Math.PI*2);
      ctx.stroke();
    }

    state.enemies.forEach(drawZombie);
    drawPlayer();

    for(const b of state.bullets){
      ctx.fillStyle = b.enemy ? 'rgba(255,90,90,0.9)' : 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(b.x,b.y, b.enemy?4:3, 0, Math.PI*2);
      ctx.fill();
    }

    for(const fx of state.effects){
      ctx.fillStyle = `hsla(${fx.hue}, 90%, 60%, ${Math.max(0, fx.life)})`;
      ctx.fillRect(fx.x, fx.y, 3, 3);
    }
  }

  function init(){
    updateHUD();
    spawnWave();
    requestAnimationFrame(loop);
  }
  init();
  setTimeout(()=>{ try{ pauseMenu.hidden=true; }catch(e){}; }, 0);
})();