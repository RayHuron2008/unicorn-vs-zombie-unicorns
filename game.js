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

      #titleControlsBtn {
        position: absolute;
        right: 18px;
        bottom: 18px;
        z-index: 10000;
        appearance: none;
        border: 3px solid rgba(76, 38, 112, .92);
        border-radius: 16px;
        padding: 10px 14px;
        font: 900 14px system-ui, sans-serif;
        color: #4b2670;
        background: rgba(255,255,255,.92);
        box-shadow:
          inset 0 2px 0 rgba(255,255,255,.60),
          0 5px 14px rgba(0,0,0,.20);
      }

      #pauseOverlay {
        position: fixed;
        inset: 0;
        z-index: 9998;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.38);
      }

      #pausePanel {
        width: min(82vw, 360px);
        padding: 20px;
        border-radius: 24px;
        background: rgba(255,255,255,.94);
        border: 4px solid rgba(76, 38, 112, .95);
        display: flex;
        flex-direction: column;
        gap: 14px;
        text-align: center;
        box-shadow: 0 10px 24px rgba(0,0,0,.35);
      }

      #pauseTitle {
        font: 900 30px system-ui, sans-serif;
        color: #4b2670;
      }

      .pauseBtn {
        appearance: none;
        border: 0;
        border-radius: 18px;
        padding: 14px 16px;
        font: 900 22px system-ui, sans-serif;
        color: #fff;
        background: linear-gradient(180deg, #8b6fff, #5a45d8);
        box-shadow:
          0 6px 0 #332086,
          inset 0 2px 0 rgba(255,255,255,.35),
          0 8px 18px rgba(0,0,0,.24);
      }

      .pauseBtn.exit {
        background: linear-gradient(180deg, #ff84c5, #ff4ca2);
        box-shadow:
          0 6px 0 #b22467,
          inset 0 2px 0 rgba(255,255,255,.35),
          0 8px 18px rgba(0,0,0,.24);
      }

      #controlsOverlay {
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.42);
      }

      #controlsPanel {
        width: min(86vw, 390px);
        padding: 20px;
        border-radius: 24px;
        background: rgba(255,255,255,.96);
        border: 4px solid rgba(76, 38, 112, .95);
        box-shadow: 0 10px 24px rgba(0,0,0,.35);
      }

      #controlsTitle {
        font: 900 28px system-ui, sans-serif;
        color: #4b2670;
        text-align: center;
        margin-bottom: 12px;
      }

      #controlsText {
        font: 800 16px system-ui, sans-serif;
        color: #333;
        line-height: 1.55;
      }

      #controlsText .section {
        margin-top: 12px;
        color: #4b2670;
        font-weight: 900;
      }

      #closeControlsBtn {
        margin-top: 16px;
        width: 100%;
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

        #titleControlsBtn {
          right: 10px;
          bottom: 10px;
          font-size: 12px;
          padding: 8px 10px;
        }

        #controlsText {
          font-size: 14px;
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

  function createControlsPopup() {
    if (document.getElementById("controlsOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "controlsOverlay";
    overlay.innerHTML = `
      <div id="controlsPanel">
        <div id="controlsTitle">CONTROLS</div>

        <div id="controlsText">
          <div>D-pad = Move</div>
          <div>A = Headbutt / attack</div>
          <div>B = Shoot ray when powered</div>
          <div>Double tap game screen = Pause</div>

          <div class="section">SPECIAL</div>
          <div>Headbutt streak = Land headbutts without getting hit</div>
          <div>10 headbutts in a row = Earn a shield</div>
          <div>Shield = Blocks one hit</div>
        </div>

        <button id="closeControlsBtn" class="pauseBtn">BACK</button>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#closeControlsBtn").addEventListener("click", () => {
      overlay.remove();
    });
  }

  function createTitleMenu() {
    const existing = document.getElementById("menuOverlay");
    if (existing) existing.remove();

    const pause = document.getElementById("pauseOverlay");
    if (pause) pause.remove();

    const controlsPopup = document.getElementById("controlsOverlay");
    if (controlsPopup) controlsPopup.remove();

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

      <button id="titleControlsBtn">CONTROLS</button>
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

   overlay.querySelector("#titleMultiplayerBtn").addEventListener("click", () => {
  alert("2 player online multiplayer coming soon");
}); overlay.querySelector("#titleControlsBtn").addEventListener("click", () => {
      createControlsPopup();
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

  function createPauseMenu() {
    if (document.getElementById("pauseOverlay")) return;
    if (typeof window.__uvzuSetPaused !== "function") return;

    const controls = document.getElementById("controls");
    if (controls) controls.style.display = "none";

    window.__uvzuSetPaused(true);

    const overlay = document.createElement("div");
    overlay.id = "pauseOverlay";
    overlay.innerHTML = `
      <div id="pausePanel">
        <div id="pauseTitle">PAUSED</div>
        <button id="resumeBtn" class="pauseBtn">RESUME</button>
        <button id="pauseControlsBtn" class="pauseBtn">CONTROLS</button>
        <button id="exitBtn" class="pauseBtn exit">EXIT TO MENU</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#resumeBtn").addEventListener("click", () => {
      const controlsPopup = document.getElementById("controlsOverlay");
      if (controlsPopup) controlsPopup.remove();

      overlay.remove();
      window.__uvzuSetPaused(false);
      if (controls) controls.style.display = "";
    });

    overlay.querySelector("#pauseControlsBtn").addEventListener("click", () => {
      createControlsPopup();
    });

    overlay.querySelector("#exitBtn").addEventListener("click", () => {
  window.location.reload();
});
  }

  function setupScreenPauseGesture() {
    let lastTapAt = 0;

    document.addEventListener(
      "pointerup",
      (e) => {
        const menuOpen = document.getElementById("menuOverlay");
        const pauseOpen = document.getElementById("pauseOverlay");
        const controlsOpen = document.getElementById("controlsOverlay");

        if (menuOpen || pauseOpen || controlsOpen) return;

        if (
          e.target.closest &&
          e.target.closest("#controls, #dpad, #ab, .dir, .ab, button")
        ) {
          return;
        }

        if (
          typeof window.__uvzuIsPlaying !== "function" ||
          !window.__uvzuIsPlaying()
        ) {
          return;
        }

        const now = Date.now();

        if (now - lastTapAt < 300) {
          lastTapAt = 0;
          createPauseMenu();
          return;
        }

        lastTapAt = now;
      },
      true
    );
  }

  setupScreenPauseGesture();

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
`  function drawUnicorn(x, y, face, zombie = false, ray = false, giant = false) {
    const s = giant ? 1.28 : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * s, s);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#154220";
    ctx.beginPath();
    ctx.ellipse(0, 9, 36, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const body = zombie ? "#62d978" : "#ff8cc7";
    const bodyDark = zombie ? "#299c55" : "#f04f9d";
    const bodyLight = zombie ? "#a6ffbf" : "#ffc5e1";
    const hoof = zombie ? "#235f35" : "#6a3c61";

    ctx.fillStyle = bodyDark;
    ctx.fillRect(-28, -25, 52, 23);

    ctx.fillStyle = body;
    ctx.fillRect(-30, -30, 56, 25);

    ctx.fillStyle = bodyLight;
    ctx.fillRect(-18, -25, 27, 7);

    ctx.fillStyle = body;
    ctx.fillRect(-24, -8, 8, 18);
    ctx.fillRect(-8, -8, 8, 18);
    ctx.fillRect(6, -8, 8, 18);
    ctx.fillRect(20, -8, 8, 18);

    ctx.fillStyle = hoof;
    ctx.fillRect(-24, 8, 8, 5);
    ctx.fillRect(-8, 8, 8, 5);
    ctx.fillRect(6, 8, 8, 5);
    ctx.fillRect(20, 8, 8, 5);

    ctx.fillStyle = body;
    ctx.fillRect(14, -40, 12, 15);

    ctx.fillStyle = body;
    ctx.fillRect(22, -50, 30, 22);

    ctx.fillStyle = zombie ? "#bff7cc" : "#ffd0e6";
    ctx.fillRect(42, -40, 14, 10);

    ctx.fillStyle = bodyDark;
    ctx.fillRect(24, -60, 7, 11);
    ctx.fillStyle = body;
    ctx.fillRect(31, -62, 8, 13);

    ctx.fillStyle = "#ffe56e";
    ctx.beginPath();
    ctx.moveTo(37, -52);
    ctx.lineTo(48, -74);
    ctx.lineTo(30, -56);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#c29a1b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(35, -58);
    ctx.lineTo(42, -64);
    ctx.stroke();

    const mane = zombie
      ? ["#18482d", "#27663d", "#44bf67"]
      : ["#ff4f72", "#ff9b43", "#ffe661", "#62eb66", "#62d7ff", "#aa6fff"];

    for (let i = 0; i < mane.length; i++) {
      ctx.fillStyle = mane[i];
      ctx.fillRect(12 - i * 6, -42 + (i % 2) * 2, 8, 15);
    }

    for (let i = 0; i < mane.length; i++) {
      ctx.fillStyle = mane[i];
      ctx.fillRect(-38 - i * 2, -27 + i * 4, 16, 5);
    }

    if (ray) {
      ctx.fillStyle = zombie ? "#6a1c1c" : "#3a3a46";
      ctx.fillRect(-8, -45, 20, 9);

      ctx.fillStyle = zombie ? "#ff4040" : "#6de8ff";
      ctx.fillRect(7, -42, 13, 4);

      ctx.fillStyle = "#262626";
      ctx.fillRect(-2, -36, 4, 8);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(19, -42, 2, 4);
    }

    if (zombie) {
      ctx.fillStyle = "#ff2626";
      ctx.fillRect(38, -44, 4, 4);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(46, -36, 3, 3);
      ctx.fillRect(50, -36, 3, 3);

      ctx.strokeStyle = "#1b5e2c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(44, -45);
      ctx.lineTo(52, -48);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(38, -44, 4, 4);

      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(45, -35, 6, 0.15, Math.PI * 0.9);
      ctx.stroke();

      ctx.fillStyle = "#ff4d8d";
      ctx.fillRect(49, -31, 7, 6);
    }

    ctx.restore();
  }`
      );

      code = replaceFunction(
        code,
        "drawNpc",
`  function drawNpc() {
    if (!state.npc) return;

    const n = state.npc;

    ctx.save();
    ctx.translate(n.x, n.y);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#174b24";
    ctx.beginPath();
    ctx.ellipse(0, 8, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#4664ff";
    ctx.fillRect(-10, -36, 20, 26);

    ctx.fillStyle = "#273594";
    ctx.fillRect(-9, -10, 7, 14);
    ctx.fillRect(2, -10, 7, 14);

    ctx.fillStyle = "#ffd6ad";
    ctx.fillRect(-9, -54, 18, 18);

    ctx.fillStyle = "#2b170e";
    ctx.fillRect(-10, -58, 20, 7);
    ctx.fillRect(-9, -53, 4, 6);

    ctx.fillStyle = "#111";
    ctx.fillRect(-4, -48, 2, 2);
    ctx.fillRect(4, -48, 2, 2);
    ctx.fillRect(-2, -42, 5, 2);

    ctx.restore();
  }`
      );

      code = replaceFunction(
        code,
        "drawShots",
`  function drawShots() {
    for (const b of state.playerShots) {
      ctx.save();

      const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 18);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(0.45, "rgba(110,235,255,.85)");
      glow.addColorStop(1, "rgba(110,235,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(b.x - 11, b.y - 3, 22, 6);

      ctx.fillStyle = "#6de8ff";
      ctx.fillRect(b.x - 8, b.y - 2, 16, 4);

      ctx.restore();
    }

    for (const b of state.enemyShots) {
      ctx.save();

      const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 16);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(0.45, "rgba(255,70,70,.92)");
      glow.addColorStop(1, "rgba(255,70,70,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(b.x - 9, b.y - 3, 18, 6);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(b.x - 4, b.y - 1, 8, 2);

      ctx.restore();
    }
  }`
      );

      code = replaceFunction(
        code,
        "drawParticles",
`  function drawParticles() {
    for (const p of state.particles) {
      const a = clamp(p.life / 0.65, 0, 1);

      ctx.save();
      ctx.globalAlpha = a;

      ctx.fillStyle = "hsla(" + p.hue + ",95%,65%," + a + ")";
      ctx.fillRect(p.x - 2, p.y - 2, 5, 5);

      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.fillRect(p.x, p.y, 2, 2);

      ctx.restore();
    }
  }`
      );

      code = replaceBoot(
        code,
`  let last = performance.now();
  let gameStarted = false;
  let paused = false;

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

  window.__uvzuIsPlaying = function() {
    return gameStarted && !paused;
  };

  window.__uvzuSetPaused = function(value) {
    paused = !!value;
    last = performance.now();
  };

  window.__uvzuExitGameToTitle = function() {
    paused = false;
    gameStarted = false;

    try { fullRestart(); } catch (e) {}
    try { updateHud(); } catch (e) {}

    last = performance.now();
  };

  window.__uvzuStartGame = function(name) {
    applyDifficulty(name || "Easy");
    try { fullRestart(); } catch (e) {}
    try { startMusic && startMusic(); } catch (e) {}
    paused = false;
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

    if (paused) {
      draw();
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

      const run = new Function(code + "\n//# sourceURL=title-menu-v60.js");
      run();

      createTitleMenu();
    })
    .catch(showLoadError);
})();