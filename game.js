(() => {
  "use strict";

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
    box.style.background = "rgba(0,0,0,.92)";
    box.style.color = "white";
    box.style.font = "12px monospace";
    box.style.whiteSpace = "pre-wrap";
    box.textContent =
      "Could not load v46 graphics upgrade.\n\n" +
      String(err && err.stack ? err.stack : err);
    document.body.appendChild(box);
  }

  function replaceFunction(code, name, replacement) {
    const startText = "  function " + name + "(";
    const start = code.indexOf(startText);

    if (start === -1) {
      console.warn("Could not find function:", name);
      return code;
    }

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

  function upgradeGraphics(code) {
    // Keep game easier like we wanted.
    code = code.replace(
      "const MAX_ENEMIES = 4;",
      "const MAX_ENEMIES = 2;"
    );

    code = replaceFunction(
      code,
      "drawBackground",
`  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#6fd7ff");
    sky.addColorStop(0.42, "#bff4ff");
    sky.addColorStop(0.62, "#dfffd0");
    sky.addColorStop(1, "#54c95d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sun glow
    const sunX = W * 0.16;
    const sunY = H * 0.17;
    const sun = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 95);
    sun.addColorStop(0, "rgba(255,255,190,1)");
    sun.addColorStop(0.35, "rgba(255,230,100,.75)");
    sun.addColorStop(1, "rgba(255,230,100,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    // Soft distant hills
    ctx.fillStyle = "#78d870";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    ctx.quadraticCurveTo(W * 0.18, H * 0.42, W * 0.36, H * 0.54);
    ctx.quadraticCurveTo(W * 0.55, H * 0.68, W * 0.77, H * 0.50);
    ctx.quadraticCurveTo(W * 0.9, H * 0.40, W, H * 0.52);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#5fc461";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.64);
    ctx.quadraticCurveTo(W * 0.22, H * 0.48, W * 0.48, H * 0.62);
    ctx.quadraticCurveTo(W * 0.75, H * 0.76, W, H * 0.56);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    drawRainbow(W * 0.62, GROUND_Y + 26, 255);

    drawCloud(120, 70);
    drawCloud(390, 52);
    drawCloud(745, 83);

    drawTree(84, GROUND_Y + 22);
    drawTree(850, GROUND_Y + 22);

    // Main playable meadow with depth stripes
    const meadow = ctx.createLinearGradient(0, H * 0.52, 0, H);
    meadow.addColorStop(0, "#8af06f");
    meadow.addColorStop(0.55, "#4ed35c");
    meadow.addColorStop(1, "#2fab48");
    ctx.fillStyle = meadow;
    ctx.fillRect(0, H * 0.56, W, H * 0.44);

    // Curved grass depth bands
    for (let i = 0; i < 8; i++) {
      const y = H * 0.58 + i * 30;
      ctx.strokeStyle = i % 2 === 0 ? "rgba(255,255,255,.10)" : "rgba(0,120,30,.10)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-30, y);
      ctx.quadraticCurveTo(W * 0.35, y + 18, W + 30, y - 10);
      ctx.stroke();
    }

    // Flowers / meadow detail
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % W;
      const y = H * 0.59 + ((i * 43) % Math.floor(H * 0.34));
      const colors = ["#fff47a", "#ff79c6", "#ffffff", "#ff9f43", "#b36bff"];
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y, 3, 3);
    }

    // Bottom foreground edge
    ctx.fillStyle = "#7b4a2c";
    ctx.fillRect(0, GROUND_Y + 25, W, H - GROUND_Y);

    ctx.fillStyle = "#34c95e";
    ctx.fillRect(0, GROUND_Y + 8, W, 22);
  }`
    );

    code = replaceFunction(
      code,
      "drawCloud",
`  function drawCloud(x, y) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.94)";
    ctx.beginPath();
    ctx.arc(x + 20, y + 18, 20, 0, Math.PI * 2);
    ctx.arc(x + 45, y + 8, 25, 0, Math.PI * 2);
    ctx.arc(x + 72, y + 19, 20, 0, Math.PI * 2);
    ctx.rect(x + 18, y + 18, 68, 24);
    ctx.fill();

    ctx.fillStyle = "rgba(120,180,220,.18)";
    ctx.fillRect(x + 22, y + 36, 62, 6);
    ctx.restore();
  }`
    );

    code = replaceFunction(
      code,
      "drawTree",
`  function drawTree(x, y) {
    ctx.save();

    ctx.fillStyle = "#7b4a24";
    ctx.fillRect(x - 8, y - 72, 16, 72);

    ctx.fillStyle = "#5b351b";
    ctx.fillRect(x - 4, y - 70, 5, 68);

    ctx.fillStyle = "#23994a";
    ctx.beginPath();
    ctx.arc(x - 24, y - 90, 30, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 112, 36, 0, Math.PI * 2);
    ctx.arc(x + 30, y - 88, 31, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#35c763";
    ctx.beginPath();
    ctx.arc(x - 12, y - 118, 21, 0, Math.PI * 2);
    ctx.arc(x + 22, y - 111, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }`
    );

    code = replaceFunction(
      code,
      "drawUnicorn",
`  function drawUnicorn(x, y, face, zombie = false, ray = false, giant = false) {
    const s = giant ? 1.35 : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * s, s);

    // Soft ground shadow
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = "#174b24";
    ctx.beginPath();
    ctx.ellipse(0, 8, 38, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const body = zombie ? "#65d978" : "#ff8cc8";
    const bodyDark = zombie ? "#27a756" : "#ff4ca8";
    const bodyLight = zombie ? "#a9ffbd" : "#ffc3e3";
    const hoof = zombie ? "#235f35" : "#67355b";

    // Body
    ctx.fillStyle = bodyDark;
    ctx.fillRect(-30, -27, 54, 27);

    ctx.fillStyle = body;
    ctx.fillRect(-31, -31, 56, 25);
    ctx.fillRect(-25, -36, 42, 10);

    ctx.fillStyle = bodyLight;
    ctx.fillRect(-21, -30, 31, 8);

    // Legs
    ctx.fillStyle = bodyDark;
    ctx.fillRect(-22, -8, 9, 22);
    ctx.fillRect(8, -8, 9, 22);

    ctx.fillStyle = body;
    ctx.fillRect(-27, -10, 9, 20);
    ctx.fillRect(2, -10, 9, 20);

    ctx.fillStyle = hoof;
    ctx.fillRect(-27, 8, 11, 6);
    ctx.fillRect(-22, 11, 11, 5);
    ctx.fillRect(2, 8, 11, 6);
    ctx.fillRect(8, 11, 11, 5);

    // Neck and head
    ctx.fillStyle = body;
    ctx.fillRect(16, -40, 13, 24);
    ctx.fillRect(25, -49, 31, 24);

    ctx.fillStyle = bodyLight;
    ctx.fillRect(32, -46, 18, 8);

    // Nose
    ctx.fillStyle = zombie ? "#92f0a4" : "#ffb4d8";
    ctx.fillRect(48, -39, 13, 12);

    // Ear
    ctx.fillStyle = bodyDark;
    ctx.fillRect(28, -60, 8, 14);

    ctx.fillStyle = body;
    ctx.fillRect(31, -62, 8, 15);

    // Horn
    ctx.fillStyle = ray ? "#fff6a8" : "#ffe066";
    ctx.beginPath();
    ctx.moveTo(49, -50);
    ctx.lineTo(60, -73);
    ctx.lineTo(39, -54);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#c99b1d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(45, -56);
    ctx.lineTo(53, -62);
    ctx.stroke();

    // Mane
    const mane = zombie
      ? ["#113f2a", "#215f38", "#48cc6a"]
      : ["#ff4d6d", "#ffa94d", "#ffe066", "#66ff66", "#66d9ff", "#b066ff"];

    for (let i = 0; i < mane.length; i++) {
      ctx.fillStyle = mane[i];
      ctx.fillRect(8 - i * 7, -45 + (i % 2) * 3, 9, 17);
    }

    // Tail
    for (let i = 0; i < mane.length; i++) {
      ctx.fillStyle = mane[i];
      ctx.fillRect(-40 - i * 3, -31 + i * 4, 20, 6);
    }

    // Face
    if (zombie) {
      ctx.fillStyle = "#ff2222";
      ctx.fillRect(43, -42, 5, 5);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(50, -34, 4, 4);
      ctx.fillRect(55, -34, 4, 4);

      ctx.strokeStyle = "#1d5e32";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, -43);
      ctx.lineTo(58, -47);
      ctx.stroke();

      if (ray) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = "#ff3030";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(44, -40, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(43, -42, 5, 5);

      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(50, -35, 7, 0.1, Math.PI * 0.85);
      ctx.stroke();

      // Goofy tongue
      ctx.fillStyle = "#ff4f8f";
      ctx.fillRect(54, -30, 8, 7);
    }

    // Ray glow on hero
    if (ray) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = zombie ? "#ff4040" : "#77eaff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(7, -28, 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
    ctx.ellipse(0, 8, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Kid body
    ctx.fillStyle = "#3d5cff";
    ctx.fillRect(-10, -37, 20, 28);

    ctx.fillStyle = "#2b35a8";
    ctx.fillRect(-10, -14, 8, 18);
    ctx.fillRect(2, -14, 8, 18);

    // Head
    ctx.fillStyle = "#ffd6aa";
    ctx.fillRect(-9, -55, 18, 18);

    // Hair
    ctx.fillStyle = "#2b160d";
    ctx.fillRect(-10, -58, 20, 7);
    ctx.fillRect(-9, -53, 5, 6);

    // Face
    ctx.fillStyle = "#111";
    ctx.fillRect(-4, -49, 3, 3);
    ctx.fillRect(4, -49, 3, 3);
    ctx.fillRect(-2, -42, 6, 2);

    ctx.restore();
  }`
    );

    code = replaceFunction(
      code,
      "drawShots",
`  function drawShots() {
    for (const b of state.playerShots) {
      ctx.save();

      const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 22);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(0.45, "rgba(95,230,255,.85)");
      glow.addColorStop(1, "rgba(95,230,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(b.x - 15, b.y - 4, 30, 8);

      ctx.fillStyle = "#66d9ff";
      ctx.fillRect(b.x - 11, b.y - 2, 22, 4);

      ctx.restore();
    }

    for (const b of state.enemyShots) {
      ctx.save();

      const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 20);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(0.4, "rgba(255,40,40,.9)");
      glow.addColorStop(1, "rgba(255,40,40,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff2a2a";
      ctx.fillRect(b.x - 12, b.y - 4, 24, 8);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(b.x - 5, b.y - 2, 10, 4);

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

      ctx.fillStyle = \`hsla(\${p.hue},95%,65%,\${a})\`;
      ctx.fillRect(p.x - 2, p.y - 2, 5, 5);

      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.fillRect(p.x, p.y, 2, 2);

      ctx.restore();
    }
  }`
    );

    return code;
  }

  fetch(OLD_STYLE_GAME_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch old game.js: " + response.status);
      }

      return response.text();
    })
    .then((code) => {
      const upgradedCode = upgradeGraphics(code);
      const run = new Function(
        upgradedCode + "\n//# sourceURL=unicorn-v46-graphics-upgrade.js"
      );
      run();
    })
    .catch(showLoadError);
})();