/* =========================================================
   Unicorn vs Zombie Unicorns — v21 (full file with cutscene)
   - Canvas loop, input, timer (60s), music control
   - Walk-on cutscene + classic arcade top text box
   - Simple “ending animation” so the game doesn’t freeze
   ========================================================= */

(() => {
  // -------------------------------
  // Config / Globals
  // -------------------------------
  const WIDTH = 960;
  const HEIGHT = 540;

  // 60-second test timer for victory checks
  const TEST_TIMER_SECONDS = 60;

  // DOM & Canvas
  const canvas = document.getElementById('game') || (function () {
    const c = document.createElement('canvas');
    c.id = 'game';
    c.width = WIDTH;
    c.height = HEIGHT;
    c.style.display = 'block';
    c.style.margin = '0 auto';
    c.style.background = '#1b1b1b';
    document.body.appendChild(c);
    return c;
  })();
  const ctx = canvas.getContext('2d');

  // Music (replace with your own; must have play/pause)
  // If you already create music elsewhere, set bgm = your object.
  let bgm = (function ensureMusic(){
    const existing = document.getElementById('bgm');
    if (existing && existing.play) return existing;
    // Fallback silent audio to keep API calls safe if you lack assets:
    const a = new Audio();
    a.loop = true;
    // a.src = 'assets/music.ogg'; // <<— your real track here
    return a;
  })();

  // -------------------------------
  // Input
  // -------------------------------
  const input = {
    enabled: true,
    left: false, right: false, up: false, down: false,
    interact: false,
  };
  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down',
    e: 'interact', E: 'interact',
  };
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.key];
    if (!k) return;
    if (!input.enabled && k !== 'interact') return;
    input[k] = true;
    // Prevent scrolling with arrows
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (!k) return;
    input[k] = false;
  });

  // -------------------------------
  // Entities (replace with your real sprites/logic)
  // -------------------------------
  const player = {
    x: 120, y: HEIGHT - 100,
    w: 28, h: 38,
    vx: 0, vy: 0,
    runSpeed: 240,
    color: '#79ffe1',
    facing: 'right',
    setAnimation(name){ /* hook your animation system if any */ },
  };

  // “Unicorn” target to approach
  const unicorn = {
    x: 700, y: HEIGHT - 110,
    w: 42, h: 46,
    color: '#ffd166',
  };

  // Final “zombie” as a trigger for ending animation (stand-in)
  const finalZombie = {
    x: 860, y: HEIGHT - 110,
    w: 42, h: 46,
    alive: true,
    color: '#ef476f',
  };

  // Simple world ground
  const groundY = HEIGHT - 60;

  // -------------------------------
  // Classic Arcade Top Text Box (UI)
  // -------------------------------
  const CutsceneUI = (() => {
    let boxEl = null, txtEl = null, backingEl = null;

    function ensureHud() {
      if (boxEl) return;
      boxEl = document.createElement('div');
      boxEl.id = 'arcadeTopBox';
      Object.assign(boxEl.style, {
        position: 'absolute',
        left: canvas.offsetLeft + 'px',
        top: canvas.offsetTop + 'px',
        width: canvas.width + 'px',
        height: 'auto',
        boxSizing: 'border-box',
        padding: '10px 14px',
        fontFamily: `'Press Start 2P', ui-monospace, monospace`,
        fontSize: '12px',
        letterSpacing: '0.5px',
        lineHeight: '1.4',
        color: '#fff',
        display: 'none',
        zIndex: 9999,
        imageRendering: 'pixelated',
      });
      boxEl.style.border = '4px solid #ffffff';
      boxEl.style.outline = '4px solid #000000';

      backingEl = document.createElement('div');
      Object.assign(backingEl.style, {
        position: 'absolute',
        inset: '0',
        background: 'rgba(0,0,0,0.75)',
        zIndex: '-1',
      });

      txtEl = document.createElement('div');
      txtEl.id = 'arcadeTopText';
      boxEl.appendChild(txtEl);
      boxEl.appendChild(backingEl);
      document.body.appendChild(boxEl);

      // Keep top box aligned over canvas on resize/scroll
      const align = () => {
        const rect = canvas.getBoundingClientRect();
        boxEl.style.left = rect.left + window.scrollX + 'px';
        boxEl.style.top = rect.top + window.scrollY + 'px';
        boxEl.style.width = rect.width + 'px';
      };
      align();
      window.addEventListener('resize', align);
      window.addEventListener('scroll', align);
    }

    function show(text) {
      ensureHud();
      boxEl.style.display = 'block';
      txtEl.textContent = '';
      return typewriter(text, txtEl, 18);
    }
    function hide() { if (boxEl) boxEl.style.display = 'none'; }

    function typewriter(full, el, cps = 16) {
      return new Promise((resolve) => {
        let i = 0;
        const interval = Math.max(10, 1000 / cps);
        const t = setInterval(() => {
          el.textContent = full.slice(0, i++);
          if (i > full.length) {
            clearInterval(t);
            resolve();
          }
        }, interval);
      });
    }

    return { ensureHud, show, hide };
  })();

  // -------------------------------
  // Cutscene Manager (walk-on + music pause)
  // -------------------------------
  const CutsceneManager = (() => {
    const State = { IDLE:'idle', WALK_IN:'walk_in', SHOW_TEXT:'show_text' };
    let state = State.IDLE;
    let ctx = null;

    function startEncounter({
      npc,             // the person who walks in
      playerRef, unicornRef,
      music,
      disableInput, enableInput,
      text = "HEY! WAIT—YOU'RE A UNICORN?!",
      approachOffset = 36,
      matchRunSpeed = true,
      fallbackSpeed = 220,
      resumeMusic = true,
      fromSide = 'left',
      offscreenPad = 40
    }){
      if (state !== State.IDLE) return;
      CutsceneUI.ensureHud();

      // Pause music immediately
      try { music?.pause && music.pause(); } catch {}

      disableInput && disableInput();

      const playerSpeed = (matchRunSpeed && npc.runSpeed) ? npc.runSpeed : fallbackSpeed;
      const targetX = unicornRef.x - approachOffset;

      let startX;
      if (fromSide === 'left') {
        startX = -offscreenPad - (npc.w || 24);
        npc.facing = 'right';
      } else {
        startX = WIDTH + offscreenPad;
        npc.facing = 'left';
      }
      npc.x = startX;

      ctx = {
        npc, targetX, speed: playerSpeed, text,
        music, resumeMusic, enableInput
      };
      npc.setAnimation && npc.setAnimation('run');
      state = State.WALK_IN;
    }

    function update(dt){
      if (!ctx) return;

      if (state === State.WALK_IN){
        const dir = Math.sign(ctx.targetX - ctx.npc.x);
        if (Math.abs(ctx.targetX - ctx.npc.x) <= ctx.speed * dt) {
          ctx.npc.x = ctx.targetX;
          ctx.npc.setAnimation && ctx.npc.setAnimation('idle');
          state = State.SHOW_TEXT;

          CutsceneUI.show(ctx.text).then(() => waitForAdvance().then(finish));
        } else {
          ctx.npc.x += dir * ctx.speed * dt;
          ctx.npc.facing = (dir > 0) ? 'right' : 'left';
        }
      }
    }

    function waitForAdvance(){
      return new Promise((resolve) => {
        const onKey = (e) => {
          if (e.code === 'Space' || e.code === 'Enter') {
            window.removeEventListener('keydown', onKey);
            resolve();
          }
        };
        window.addEventListener('keydown', onKey);
      });
    }

    function finish(){
      CutsceneUI.hide();
      try { if (ctx.resumeMusic && ctx.music?.play) ctx.music.play(); } catch {}
      ctx.enableInput && ctx.enableInput();
      ctx = null;
      state = State.IDLE;
    }

    return {
      startEncounter,
      update,
      get active(){ return state !== State.IDLE; }
    };
  })();

  // -------------------------------
  // NPC (the “person” who walks on)
  // -------------------------------
  const npc = {
    x: -1000, y: groundY - 38,
    w: 26, h: 38,
    runSpeed: 220,
    facing: 'right',
    color: '#06d6a0',
    setAnimation(name){ /* hook if needed */ },
  };

  // -------------------------------
  // Timer / UI
  // -------------------------------
  let timeLeft = TEST_TIMER_SECONDS;
  let showVictory = false;
  let victoryAlpha = 0;

  function drawTimer(){
    ctx.save();
    ctx.font = '20px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`TIME: ${Math.max(0, Math.ceil(timeLeft))}s`, 16, 28);
    ctx.restore();
  }

  function drawVictoryOverlay(){
    if (!showVictory && victoryAlpha <= 0) return;
    ctx.save();
    victoryAlpha = Math.min(1, victoryAlpha + 0.02);
    ctx.globalAlpha = Math.min(0.7, victoryAlpha);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.globalAlpha = Math.min(1, victoryAlpha);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', WIDTH/2, HEIGHT/2);
    ctx.restore();
  }

  // -------------------------------
  // Game Logic
  // -------------------------------
  function disableInput(){ input.enabled = false; }
  function enableInput(){ input.enabled = true; }

  function updatePlayer(dt){
    if (!input.enabled) return;
    player.vx = 0; player.vy = 0;

    if (input.left)  { player.vx -= player.runSpeed; player.facing = 'left'; }
    if (input.right) { player.vx += player.runSpeed; player.facing = 'right'; }
    if (input.up)    { player.vy -= player.runSpeed; }
    if (input.down)  { player.vy += player.runSpeed; }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Stay inside canvas
    player.x = Math.max(0, Math.min(WIDTH - player.w, player.x));
    player.y = Math.max(0, Math.min(groundY - player.h, player.y));
  }

  function rectsOverlap(a,b){
    return !(a.x + a.w < b.x || b.x + b.w < a.x ||
             a.y + a.h < b.y || b.y + b.h < a.y);
  }

  // Trigger cutscene when pressing E near unicorn
  let cutsceneConsumed = false;

  function maybeStartCutscene(){
    if (cutsceneConsumed) return;
    const near = Math.abs(player.x - unicorn.x) < 110 && Math.abs(player.y - unicorn.y) < 60;
    if (near && input.interact){
      cutsceneConsumed = true;
      disableInput();
      CutsceneManager.startEncounter({
        npc, playerRef: player, unicornRef: unicorn,
        music: bgm,
        disableInput,
        enableInput,
        text: "HEY! WAIT—YOU'RE A UNICORN?!",
        fromSide: 'left',
      });
      input.interact = false;
    }
  }

  // Simulate “defeating” final zombie when touching it (to show ending animation)
  function checkFinalZombie(){
    if (finalZombie.alive && rectsOverlap(player, finalZombie)){
      finalZombie.alive = false;
      // Start ending animation, not a freeze
      showVictory = true;
      victoryAlpha = 0;
      // Optionally stop music here too:
      try { bgm?.pause && bgm.pause(); } catch {}
    }
  }

  // -------------------------------
  // Rendering (stub visuals; replace with your art)
  // -------------------------------
  function drawRect(e){
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.w, e.h);
  }

  function render(){
    // Clear
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Ground
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, groundY, WIDTH, HEIGHT - groundY);

    // Entities
    drawRect(player);
    // Unicorn (goal)
    drawRect(unicorn);
    // NPC (walker)
    drawRect(npc);
    // Final zombie placeholder
    if (finalZombie.alive) drawRect(finalZombie);

    // UI
    drawTimer();
    drawVictoryOverlay();
  }

  // -------------------------------
  // Main Loop
  // -------------------------------
  let last = performance.now();
  let running = true;

  function tick(now){
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (running){
      if (!showVictory){
        // Timer counts down only until victory
        timeLeft -= dt;
        if (timeLeft <= 0){
          // Time up -> just show message (you can handle lose/win here)
          showVictory = true;
          victoryAlpha = 0;
          try { bgm?.pause && bgm.pause(); } catch {}
        }
      }

      // Normal updates only if not in cutscene
      if (!CutsceneManager.active){
        updatePlayer(dt);
        maybeStartCutscene();
        checkFinalZombie();
      }

      // Cutscene update always runs (it manages input/music itself)
      CutsceneManager.update(dt);

      render();
    }

    requestAnimationFrame(tick);
  }

  // Boot
  function boot(){
    CutsceneUI.ensureHud();
    // Autoplay music if you have a real src:
    // try { bgm.play(); } catch {}
    requestAnimationFrame(tick);
  }

  boot();

  // Expose some handles for your console/tests
  window.__game = { player, unicorn, npc, finalZombie, CutsceneManager, input, bgm };
})();
