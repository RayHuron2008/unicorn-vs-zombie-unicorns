(() => {
  /* ===========================
     Unicorn vs Zombie Unicorns
     v27 — stable baseline
     =========================== */

  const canvas = document.getElementById("game");
  if (!canvas) {
    alert("Missing <canvas id='game'>");
    return;
  }
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  /* ---------- CONSTANTS ---------- */
  const GROUND_Y = H - 80;
  const PLAYER_SPEED = 220;
  const ENEMY_SPEED = 110;

  const MAX_ENEMIES = 4;
  const STAGE_TIME = 60; // seconds
  const FINAL_RAY_COUNT = 2;

  const HP_MAX = 100;

  /* ---------- STATE ---------- */
  const state = {
    last: performance.now(),
    timer: STAGE_TIME,
    mode: "PLAY", // PLAY, FINAL, NPC, TALK, FIREWORKS, VICTORY

    player: {
      x: 120,
      y: GROUND_Y,
      w: 40,
      h: 30,
      dir: 1,
      hp: HP_MAX,
      lives: 3,
      invuln: 0,
    },

    enemies: [],
    shots: [],
    effects: [],

    finalSpawned: 0,

    npc: { x: -100, y: GROUND_Y, active: false },
    dialogTimer: 0,

    fireworks: [],
  };

  /* ---------- INPUT ---------- */
  const keys = {};
  window.addEventListener("keydown", e => keys[e.key] = true);
  window.addEventListener("keyup", e => keys[e.key] = false);

  /* ---------- HELPERS ---------- */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>a+Math.random()*(b-a);

  function rect(a,b){
    return (
      a.x < b.x+b.w &&
      a.x+a.w > b.x &&
      a.y < b.y+b.h &&
      a.y+a.h > b.y
    );
  }

  /* ---------- SPAWN ---------- */
  function spawnEnemy(ray=false){
    state.enemies.push({
      x: Math.random()<0.5?-60:W+60,
      y: GROUND_Y,
      w: 40,
      h: 30,
      ray,
      shootCd: rand(1,1.6),
      hp: ray?3:1
    });
  }

  spawnEnemy();

  /* ---------- DAMAGE ---------- */
  function hurtPlayer(dmg){
    const p = state.player;
    if (p.invuln>0) return;
    p.hp -= dmg;
    p.invuln = 0.6;
    if (p.hp<=0){
      p.lives--;
      p.hp = HP_MAX;
      if (p.lives<=0){
        location.reload();
      }
    }
  }

  /* ---------- UPDATE ---------- */
  function update(dt){
    const p = state.player;
    p.invuln = Math.max(0,p.invuln-dt);

    /* Movement */
    let dx=0, dy=0;
    if (keys["ArrowLeft"]) dx=-1;
    if (keys["ArrowRight"]) dx=1;
    if (keys["ArrowUp"]) dy=-1;
    if (keys["ArrowDown"]) dy=1;

    p.x += dx*PLAYER_SPEED*dt;
    p.y += dy*PLAYER_SPEED*0.5*dt;
    p.x = clamp(p.x,0,W-p.w);
    p.y = clamp(p.y,GROUND_Y-40,GROUND_Y);
    if (dx!==0) p.dir = dx>0?1:-1;

    /* Timer */
    if (state.mode==="PLAY"){
      state.timer -= dt;
      if (state.timer<=0){
        state.mode="FINAL";
      }
      if (state.enemies.length<MAX_ENEMIES){
        spawnEnemy(Math.random()<0.15);
      }
    }

    if (state.mode==="FINAL"){
      if (state.finalSpawned<FINAL_RAY_COUNT){
        spawnEnemy(true);
        state.finalSpawned++;
      }
      if (state.enemies.length===0){
        state.mode="NPC";
        state.npc.active=true;
      }
    }

    /* Enemies */
    for (let i=state.enemies.length-1;i>=0;i--){
      const e = state.enemies[i];
      const dir = Math.sign(p.x-e.x);
      e.x += dir*ENEMY_SPEED*dt;

      if (rect(
        {x:p.x,y:p.y,w:p.w,h:p.h},
        {x:e.x,y:e.y,w:e.w,h:e.h}
      )){
        hurtPlayer(20);
      }
    }

    /* NPC */
    if (state.mode==="NPC"){
      state.npc.x += 200*dt;
      if (state.npc.x>p.x-80){
        state.mode="TALK";
        state.dialogTimer=2.5;
      }
    }

    if (state.mode==="TALK"){
      state.dialogTimer -= dt;
      if (state.dialogTimer<=0){
        state.mode="FIREWORKS";
      }
    }

    if (state.mode==="FIREWORKS"){
      if (state.fireworks.length<120){
        state.fireworks.push({
          x:rand(100,W-100),
          y:rand(50,200),
          life:1
        });
      } else {
        state.mode="VICTORY";
      }
    }
  }

  /* ---------- DRAW ---------- */
  function draw(){
    ctx.clearRect(0,0,W,H);

    /* Sky */
    ctx.fillStyle="#7ec7ff";
    ctx.fillRect(0,0,W,H);

    /* Ground */
    ctx.fillStyle="#32c86d";
    ctx.fillRect(0,GROUND_Y+20,W,H);

    /* Player */
    const p=state.player;
    ctx.fillStyle="#ff6fa8";
    ctx.fillRect(p.x,p.y,p.w,p.h);

    /* Enemies */
    ctx.fillStyle="#2ecc71";
    state.enemies.forEach(e=>{
      ctx.fillRect(e.x,e.y,e.w,e.h);
    });

    /* NPC */
    if (state.npc.active){
      ctx.fillStyle="#5555ff";
      ctx.fillRect(state.npc.x,state.npc.y,20,30);
    }

    /* Dialog */
    if (state.mode==="TALK"){
      ctx.fillStyle="#fff";
      ctx.fillRect(60,60,W-120,80);
      ctx.fillStyle="#000";
      ctx.font="18px monospace";
      ctx.fillText(
        "You killed all of the zombies here! Thank you! I was so scared.",
        80,105
      );
    }

    /* Fireworks */
    if (state.mode==="FIREWORKS"||state.mode==="VICTORY"){
      state.fireworks.forEach(f=>{
        ctx.fillStyle=`hsla(${rand(0,360)},90%,60%,0.9)`;
        ctx.fillRect(f.x,f.y,4,4);
      });
    }

    if (state.mode==="VICTORY"){
      ctx.fillStyle="#fff";
      ctx.font="32px monospace";
      ctx.fillText("Victory: Stage 1 Completed!",120,280);
    }

    /* HUD */
    ctx.fillStyle="#000";
    ctx.font="14px monospace";
    ctx.fillText(`HP: ${p.hp}`,10,20);
    ctx.fillText(`Lives: ${p.lives}`,10,40);
    ctx.fillText(`Time: ${Math.max(0,Math.ceil(state.timer))}`,10,60);
  }

  /* ---------- LOOP ---------- */
  function loop(t){
    const dt = Math.min(0.033,(t-state.last)/1000);
    state.last=t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
