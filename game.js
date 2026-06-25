(() => {
  "use strict";

  // Keep controls at the comfortable middle-low position
  function adjustControls() {
    const style = document.createElement("style");
    style.textContent = `
      #controls {
        bottom: clamp(50px, 13vh, 100px) !important;
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", adjustControls);
  } else {
    adjustControls();
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

  fetch(OLD_STYLE_GAME_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch old game.js: " + response.status);
      }
      return response.text();
    })
    .then((code) => {
      // Easier enemy count
      code = code.replace(
        "const MAX_ENEMIES = 4;",
        "const MAX_ENEMIES = 2;"
      );

      // -----------------------------
      // BACKGROUND UPGRADE (same as v50)
      // -----------------------------
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

      // -----------------------------
      // CHARACTER / ENEMY UPGRADE
      // -----------------------------
      code = replaceFunction(
        code,
        "drawUnicorn",
`  function drawUnicorn(x, y, face, zombie = false, ray = false, giant = false) {
    const s = giant ? 1.28 : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * s, s);

    // shadow
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

    // body
    ctx.fillStyle = bodyDark;
    ctx.fillRect(-28, -25, 52, 23);

    ctx.fillStyle = body;
    ctx.fillRect(-30, -30, 56, 25);

    // belly highlight
    ctx.fillStyle = bodyLight;
    ctx.fillRect(-18, -25, 27, 7);

    // legs
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

    // neck
    ctx.fillStyle = body;
    ctx.fillRect(14, -40, 12, 15);

    // head
    ctx.fillStyle = body;
    ctx.fillRect(22, -50, 30, 22);

    // muzzle
    ctx.fillStyle = zombie ? "#bff7cc" : "#ffd0e6";
    ctx.fillRect(42, -40, 14, 10);

    // ears
    ctx.fillStyle = bodyDark;
    ctx.fillRect(24, -60, 7, 11);
    ctx.fillStyle = body;
    ctx.fillRect(31, -62, 8, 13);

    // horn
    ctx.fillStyle = zombie ? "#ffe56e" : "#ffe56e";
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

    // mane
    const mane = zombie
      ? ["#18482d", "#27663d", "#44bf67"]
      : ["#ff4f72", "#ff9b43", "#ffe661", "#62eb66", "#62d7ff", "#aa6fff"];

    for (let i = 0; i < mane.length; i++) {
      ctx.fillStyle = mane[i];
      ctx.fillRect(12 - i * 6, -42 + (i % 2) * 2, 8, 15);
    }

    // tail
    for (let i = 0; i < mane.length; i++) {
      ctx.fillStyle = mane[i];
      ctx.fillRect(-38 - i * 2, -27 + i * 4, 16, 5);
    }

    // ray gun on back
    if (ray) {
      // mount
      ctx.fillStyle = zombie ? "#6a1c1c" : "#3a3a46";
      ctx.fillRect(-8, -45, 20, 9);

      // barrel
      ctx.fillStyle = zombie ? "#ff4040" : "#6de8ff";
      ctx.fillRect(7, -42, 13, 4);

      // handle
      ctx.fillStyle = "#262626";
      ctx.fillRect(-2, -36, 4, 8);

      // tip
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(19, -42, 2, 4);
    }

    // face
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

      // tongue
      ctx.fillStyle = "#ff4d8d";
      ctx.fillRect(49, -31, 7, 6);
    }

    ctx.restore();
  }`
      );

      // -----------------------------
      // NPC LOOK
      // -----------------------------
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

    // body
    ctx.fillStyle = "#4664ff";
    ctx.fillRect(-10, -36, 20, 26);

    // legs
    ctx.fillStyle = "#273594";
    ctx.fillRect(-9, -10, 7, 14);
    ctx.fillRect(2, -10, 7, 14);

    // head
    ctx.fillStyle = "#ffd6ad";
    ctx.fillRect(-9, -54, 18, 18);

    // hair
    ctx.fillStyle = "#2b170e";
    ctx.fillRect(-10, -58, 20, 7);
    ctx.fillRect(-9, -53, 4, 6);

    // face
    ctx.fillStyle = "#111";
    ctx.fillRect(-4, -48, 2, 2);
    ctx.fillRect(4, -48, 2, 2);
    ctx.fillRect(-2, -42, 5, 2);

    ctx.restore();
  }`
      );

      // -----------------------------
      // SHOTS LOOK BETTER
      // -----------------------------
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

      // -----------------------------
      // PARTICLES
      // -----------------------------
      code = replaceFunction(
        code,
        "drawParticles",
`  function drawParticles() {
    for (const p of state.particles) {
      const a = clamp(p.life / 0.65, 0, 1);

      ctx.save();
      ctx.globalAlpha = a;

      ctx.fillStyle = \`hsla(\${p.hue},95%,65%,\${a})\`;
      ctx.fillRect(p.x - 2, p.y - 2, 5, 5);

      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.fillRect(p.x, p.y, 2, 2);

      ctx.restore();
    }
  }`
      );

      const run = new Function(code + "\n//# sourceURL=graphics-upgrade-v51.js");
      run();
    })
    .catch(showLoadError);
})();