(() => {
  "use strict";

  function injectLayoutTweaks() {
    const style = document.createElement("style");
    style.textContent = `
      #controls {
        bottom: clamp(34px, 10vh, 72px) !important;
      }

      #menuOverlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        background:
          linear-gradient(rgba(0,0,0,.06), rgba(0,0,0,.16)),
          url("file_00000000122c720cab795833c670e371.png") center center / cover no-repeat;
      }

      #menuShade {
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom, rgba(255,255,255,.02), rgba(0,0,0,.12));
        pointer-events: none;
      }

      #menuPanel {
        position: absolute;
        left: 50%;
        bottom: 22px;
        transform: translateX(-50%);
        width: min(86vw, 560px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }

      .menuBtn {
        appearance: none;
        border: 0;
        border-radius: 20px;
        width: min(56vw, 260px);
        padding: 14px 18px;
        font: 900 24px system-ui, sans-serif;
        color: #fff;
        background: linear-gradient(180deg, #ff84c5, #ff4ca2);
        box-shadow:
          0 6px 0 #b22467,
          inset 0 2px 0 rgba(255,255,255,.35),
          0 8px 18px rgba(0,0,0,.28);
        text-shadow: 0 2px 2px rgba(0,0,0,.35);
      }

      .menuBtn:active {
        transform: translateY(2px);
        box-shadow:
          0 4px 0 #b22467,
          inset 0 2px 0 rgba(255,255,255,.35),
          0 6px 12px rgba(0,0,0,.28);
      }

      #difficultyRow {
        width: 100%;
        display: flex;
        justify-content: center;
        gap: 10px;
      }

      .diffBtn {
        flex: 1;
        max-width: 170px;
        appearance: none;
        border: 3px solid rgba(76, 38, 112, .92);
        border-radius: 16px;
        padding: 10px 8px;
        font: 900 16px system-ui, sans-serif;
        color: #4b2670;
        background: rgba(255,255,255,.92);
        box-shadow:
          inset 0 2px 0 rgba(255,255,255,.60),
          0 5px 14px rgba(0,0,0,.20);
      }

      .diffBtn.active {
        color: #fff;
        background: linear-gradient(180deg, #8b6fff, #5a45d8);
      }

      #menuHint {
        color: #fff;
        font: 700 12px system-ui, sans-serif;
        text-shadow: 0 2px 4px rgba(0,0,0,.6);
      }

      @media (max-width: 700px) {
        #menuPanel {
          bottom: 16px;
          width: 92vw;
          gap: 8px;
        }

        .menuBtn {
          width: 210px;
          font-size: 20px;
          padding: 12px 14px;
        }

        #difficultyRow {
          gap: 6px;
        }

        .diffBtn {
          font-size: 13px;
          padding: 9px 4px;
          border-radius: 13px;
        }

        #menuHint {
          font-size: 11px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectLayoutTweaks);
  } else {
    injectLayoutTweaks();
  }

  const OLD_STYLE_GAME_URL =
    "https://raw.githubusercontent.com/RayHuron2008/unicorn-vs-zombie-unicorns/8ab7caef24e7428def29e858f3cda8cd183fb939/game.js";

  function showLoadError(err) {
    const box = document.createElement("pre");
    box.style.position = "fixed";
    box.style.left = "10px";
    box.style.right = "10px";
    box.style.top = "10px";
    box.style.zIndex = "99999";
    box.style.padding = "12px";
    box.style.borderRadius = "10px";
    box.style.background = "rgba(0,0,0,.9)";
    box.style.color = "white";
    box.style.font = "12px monospace";
    box.style.whiteSpace = "pre-wrap";
    box.textContent =
      "Game failed to load.\n\n" +
      String(err && err.stack ? err.stack : err);
    document.body.appendChild(box);
  }

  function replaceFunction(code, name, replacement) {
    const startText = "  function " + name + "(";
    const start = code.indexOf(startText);
    if (start === -1) return code;

    const braceStart = code.indexOf("{", start);
    let depth = 0;
    let end = braceStart;

    for (; end < code.length; end++) {
      const ch = code[end];
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (depth === 0) {
        end++;
        break;
      }
    }

    return code.slice(0, start) + replacement + code.slice(end);
  }

  function replaceBoot(code, replacement) {
    const startText = "  let last = performance.now();";
    const start = code.indexOf(startText);
    const end = code.lastIndexOf("\n})();");

    if (start === -1 || end === -1 || end <= start) {
      console.warn("Could not replace boot loop");
      return code;
    }

    return code.slice(0, start) + replacement + code.slice(end);
  }

  function createTitleMenu() {
    const existing = document.getElementById("menuOverlay");
    if (existing) existing.remove();

    const hud = document.getElementById("hud");
    const controls = document.getElementById("controls");

    if (hud) hud.style.display = "none";
    if (controls) controls.style.display = "none";

    const overlay = document.createElement("div");
    overlay.id = "menuOverlay";
    overlay.innerHTML = `
      <div id="menuShade"></div>
      <div id="menuPanel">
        <button id="playBtn" class="menuBtn">START</button>
        <div id="difficultyRow">
          <button class="diffBtn active" data-diff="Easy">Easy</button>
          <button class="diffBtn" data-diff="Normal">Normal</button>
          <button class="diffBtn" data-diff="Chaos">Chaos</button>
        </div>
        <div id="menuHint">Choose difficulty, then tap START</div>
      </div>
    `;
    document.body.appendChild(overlay);

    let selected = "Easy";

    const diffButtons = [...overlay.querySelectorAll(".diffBtn")];
    diffButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        selected = btn.dataset.diff;
        diffButtons.forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    const playBtn = overlay.querySelector("#playBtn");
    playBtn.addEventListener("click", () => {
      if (typeof window.__uvzuStartGame === "function") {
        window.__uvzuStartGame(selected);
      }

      overlay.remove();

      if (hud) hud.style.display = "";
      if (controls) controls.style.display = "";
    });
  }

  fetch(OLD_STYLE_GAME_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch old game.js: " + response.status);
      }
      return response.text();
    })
    .then((code) => {
      code = code.replace(
        "const MAX_ENEMIES = 4;",
        `let MAX_ENEMIES = 2;
  let ENEMY_X_SPEED = 85;
  let ENEMY_Y_SPEED = 55;
  let SPAWN_MIN = 1.10;
  let SPAWN_MAX = 1.60;
  let RAY_CHANCE = 0.12;`
      );

      code = code.replace(
        "const wantRay = Math.random() < 0.2;",
        "const wantRay = Math.random() < RAY_CHANCE;"
      );

      code = code.replace(
        "state.spawnTimer = rand(0.75, 1.2);",
        "state.spawnTimer = rand(SPAWN_MIN, SPAWN_MAX);"
      );

      code = code.replace(
        "e.x += Math.sign(dx) * 105 * dt;",
        "e.x += Math.sign(dx) * ENEMY_X_SPEED * dt;"
      );

      code = code.replace(
        "e.y += Math.sign(dy) * 70 * dt;",
        "e.y += Math.sign(dy) * ENEMY_Y_SPEED * dt;"
      );

      code = replaceFunction(
        code,
        "drawBackground",
`  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#75d8ff");
    sky.addColorStop(0.38, "#c8f4ff");
    sky.addColorStop(0.68, "#b8efad");
    sky.addColorStop(1, "#7dd96b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const sunX = W * 0.14;
    const sunY = H * 0.16;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 90);
    sunGlow.addColorStop(0, "rgba(255,255,210,1)");
    sunGlow.addColorStop(0.35, "rgba(255,232,120,.8)");
    sunGlow.addColorStop(1, "rgba(255,232,120,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#79d968";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.58);
    ctx.quadraticCurveTo(W * 0.18, H * 0.43, W * 0.36, H * 0.56);
    ctx.quadraticCurveTo(W * 0.56, H * 0.70, W * 0.77, H * 0.51);
    ctx.quadraticCurveTo(W * 0.90, H * 0.42, W, H * 0.54);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#5dc95f";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.66);
    ctx.quadraticCurveTo(W * 0.24, H * 0.49, W * 0.5, H * 0.64);
    ctx.quadraticCurveTo(W * 0.77, H * 0.79, W, H * 0.58);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    const rx = W * 0.64;
    const ry = H * 0.63;
    const rr = Math.min(W, H) * 0.30;
    const colors = ["#ff4d5a", "#ff9f43", "#ffe45c", "#5fe26b", "#55d8ff", "#9d6bff"];
    ctx.lineWidth = 13;

    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i];
      ctx.beginPath();
      ctx.arc(rx, ry, rr - i * 13, Math.PI, Math.PI * 2);
      ctx.stroke();
    }

    function drawCloud(x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.beginPath();
      ctx.arc(0, 16, 18, 0, Math.PI * 2);
      ctx.arc(24, 8, 24, 0, Math.PI * 2);
      ctx.arc(52, 18, 20, 0, Math.PI * 2);
      ctx.rect(-2, 16, 60, 18);
      ctx.fill();
      ctx.restore();
    }

    drawCloud(95, 70, 1.0);
    drawCloud(315, 48, 0.9);
    drawCloud(650, 88, 1.1);

    function drawTree(x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);

      ctx.fillStyle = "#7a4a28";
      ctx.fillRect(-8, -72, 16, 72);

      ctx.fillStyle = "#239b4e";
      ctx.beginPath();
      ctx.arc(-22, -92, 28, 0, Math.PI * 2);
      ctx.arc(0, -112, 34, 0, Math.PI * 2);
      ctx.arc(25, -90, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#35c763";
      ctx.beginPath();
      ctx.arc(-8, -120, 18, 0, Math.PI * 2);
      ctx.arc(22, -114, 19, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    drawTree(75, GROUND_Y + 18, 0.95);
    drawTree(W - 72, GROUND_Y + 18, 1.05);

    const meadow = ctx.createLinearGradient(0, H * 0.54, 0, H);
    meadow.addColorStop(0, "#8df06f");
    meadow.addColorStop(0.55, "#4dd45d");
    meadow.addColorStop(1, "#2daa48");
    ctx.fillStyle = meadow;
    ctx.fillRect(0, H * 0.56, W, H * 0.44);

    for (let i = 0; i < 8; i++) {
      const y = H * 0.60 + i * 27;
      ctx.strokeStyle = i % 2 === 0
        ? "rgba(255,255,255,.10)"
        : "rgba(10,120,30,.10)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.quadraticCurveTo(W * 0.35, y + 16, W + 20, y - 8);
      ctx.stroke();
    }

    const flowerColors = ["#fff47a", "#ff79c6", "#ffffff", "#ff9f43", "#b36bff"];

    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % W;
      const y = H * 0.60 + ((i * 43) % Math.floor(H * 0.28));
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.fillRect(x, y, 3, 3);
    }

    ctx.fillStyle = "#35c85f";
    ctx.fillRect(0, GROUND_Y + 8, W, 22);

    ctx.fillStyle = "#8a5a2f";
    ctx.fillRect(0, GROUND_Y + 25, W, H - GROUND_Y);
  }`
      );

      code = replaceFunction(
        code,
        "drawUnicorn",
`  function drawUnicorn(x, y, dir = 1, zombie = false, ray = false, shield = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);

    const body = zombie ? "#57c96a" : "#ff8ac4";
    const bodyShade = zombie ? "#2e9c4c" : "#f05aa6";
    const bodyLight = zombie ? "#a7f7ae" : "#ffd1e6";
    const mane = zombie ? "#5b2aa8" : "#ff3ca6";
    const maneAlt = zombie ? "#38d6ff" : "#ffd447";
    const horn = zombie ? "#b18cff" : "#ffd447";
    const hoof = zombie ? "#1f5b34" : "#71305e";

    if (shield) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = "#63e7ff";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, -24, 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Tail
    ctx.fillStyle = mane;
    ctx.beginPath();
    ctx.ellipse(-50, -26, 23, 12, -0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = maneAlt;
    ctx.beginPath();
    ctx.ellipse(-58, -14, 15, 7, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Back legs
    ctx.fillStyle = bodyShade;
    ctx.fillRect(-30, -5, 13, 38);
    ctx.fillRect(17, -5, 13, 38);

    ctx.fillStyle = hoof;
    ctx.fillRect(-33, 28, 19, 8);
    ctx.fillRect(14, 28, 19, 8);

    // Body
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -25, 48, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyLight;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(-10, -18, 27, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Neck
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(30, -50, 18, 30, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(58, -58, 30, 23, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = zombie ? "#bdf0b9" : "#ffc1db";
    ctx.beginPath();
    ctx.ellipse(78, -53, 20, 14, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Ear
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(39, -77);
    ctx.lineTo(47, -105);
    ctx.lineTo(58, -78);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = bodyLight;
    ctx.beginPath();
    ctx.moveTo(45, -81);
    ctx.lineTo(49, -96);
    ctx.lineTo(55, -81);
    ctx.closePath();
    ctx.fill();

    // Horn
    ctx.fillStyle = horn;
    ctx.beginPath();
    ctx.moveTo(68, -79);
    ctx.lineTo(82, -113);
    ctx.lineTo(91, -77);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = zombie ? "#6541c8" : "#b87915";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(75, -91);
    ctx.lineTo(87, -90);
    ctx.moveTo(78, -101);
    ctx.lineTo(85, -100);
    ctx.stroke();

    // Mane on neck
    ctx.fillStyle = mane;
    ctx.beginPath();
    ctx.arc(25, -70, 10, 0, Math.PI * 2);
    ctx.arc(20, -56, 10, 0, Math.PI * 2);
    ctx.arc(22, -42, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = maneAlt;
    ctx.beginPath();
    ctx.arc(31, -66, 6, 0, Math.PI * 2);
    ctx.arc(27, -48, 6, 0, Math.PI * 2);
    ctx.fill();

    // Front legs
    ctx.fillStyle = body;
    ctx.fillRect(41, -5, 13, 38);
    ctx.fillRect(64, -6, 13, 38);

    ctx.fillStyle = hoof;
    ctx.fillRect(38, 28, 19, 8);
    ctx.fillRect(61, 28, 19, 8);

    // Eye
    ctx.fillStyle = zombie ? "#ecff67" : "#ffffff";
    ctx.beginPath();
    ctx.arc(64, -64, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#172033";
    ctx.beginPath();
    ctx.arc(66, -63, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = "#2a1b22";
    ctx.beginPath();
    ctx.arc(84, -56, 2.5, 0, Math.PI * 2);
    ctx.arc(92, -51, 2.5, 0, Math.PI * 2);
    ctx.fill();

    if (zombie) {
      ctx.strokeStyle = "#265c2e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(55, -48);
      ctx.lineTo(64, -43);
      ctx.lineTo(74, -48);
      ctx.stroke();

      ctx.fillStyle = "#9a1d1d";
      ctx.beginPath();
      ctx.arc(8, -15, 3, 0, Math.PI * 2);
      ctx.arc(-17, -31, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#6d243a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(77, -48, 8, 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    // Ray gun on back. No glow circle.
    if (ray) {
      ctx.fillStyle = zombie ? "#5c1b1b" : "#353544";
      ctx.fillRect(-8, -52, 24, 9);

      ctx.fillStyle = zombie ? "#ff4040" : "#6de8ff";
      ctx.fillRect(13, -49, 18, 4);

      ctx.fillStyle = "#222";
      ctx.fillRect(-1, -43, 4, 9);
    }

    ctx.restore();
  }`
      );

      code = replaceBoot(
        code,
`  let last = performance.now();
  let gameStarted = false;

  function applyDifficulty(name) {
    if (name === "Easy") {
      MAX_ENEMIES = 2;
      ENEMY_X_SPEED = 85;
      ENEMY_Y_SPEED = 55;
      SPAWN_MIN = 1.10;
      SPAWN_MAX = 1.60;
      RAY_CHANCE = 0.12;
    } else if (name === "Normal") {
      MAX_ENEMIES = 3;
      ENEMY_X_SPEED = 105;
      ENEMY_Y_SPEED = 70;
      SPAWN_MIN = 0.80;
      SPAWN_MAX = 1.25;
      RAY_CHANCE = 0.20;
    } else {
      MAX_ENEMIES = 4;
      ENEMY_X_SPEED = 125;
      ENEMY_Y_SPEED = 88;
      SPAWN_MIN = 0.55;
      SPAWN_MAX = 0.95;
      RAY_CHANCE = 0.32;
    }
  }

  window.__uvzuStartGame = function(name) {
    applyDifficulty(name || "Easy");
    try { fullRestart(); } catch (e) {}
    try { startMusic && startMusic(); } catch (e) {}
    gameStarted = true;
    last = performance.now();
  };

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (!gameStarted) {
      drawBackground();
      requestAnimationFrame(loop);
      return;
    }

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  updateHud();
  requestAnimationFrame(loop);`
      );

      const run = new Function(code + "\n//# sourceURL=title-menu-v57.js");
      run();

      createTitleMenu();
    })
    .catch(showLoadError);
})();