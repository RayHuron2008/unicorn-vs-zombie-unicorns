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

  fetch(OLD_STYLE_GAME_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch old game.js: " + response.status);
      }
      return response.text();
    })
    .then((code) => {
      // Difficulty variables. Easy is the default.
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

      // Background upgrade only. Characters stay old-working style for now.
      code = replaceFunction(
        code,
        "drawBackground",
`  function drawBackground() {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#75d8ff");
    sky.addColorStop(0.38, "#c8f4ff");
    sky.addColorStop(0.68, "#b8efad");
    sky.addColorStop(1, "#7dd96b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sun
    const sunX = W * 0.14;
    const sunY = H * 0.16;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 90);
    sunGlow.addColorStop(0, "rgba(255,255,210,1)");
    sunGlow.addColorStop(0.35, "rgba(255,232,120,.8)");
    sunGlow.addColorStop(1, "rgba(255,232,120,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, W, H);

    // Distant hills
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

    // Rainbow
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

    // Clouds
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

    // Trees
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

    // Main meadow
    const meadow = ctx.createLinearGradient(0, H * 0.54, 0, H);
    meadow.addColorStop(0, "#8df06f");
    meadow.addColorStop(0.55, "#4dd45d");
    meadow.addColorStop(1, "#2daa48");
    ctx.fillStyle = meadow;
    ctx.fillRect(0, H * 0.56, W, H * 0.44);

    // Curved grass depth stripes
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

    // Flower dots
    const flowerColors = ["#fff47a", "#ff79c6", "#ffffff", "#ff9f43", "#b36bff"];
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % W;
      const y = H * 0.60 + ((i * 43) % Math.floor(H * 0.28));
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.fillRect(x, y, 3, 3);
    }

    // Foreground edge
    ctx.fillStyle = "#35c85f";
    ctx.fillRect(0, GROUND_Y + 8, W, 22);

    ctx.fillStyle = "#8a5a2f";
    ctx.fillRect(0, GROUND_Y + 25, W, H - GROUND_Y);
  }`
      );

      // Replace the automatic start with a title menu + difficulty start.
      code = replaceBoot(
        code,
`  let last = performance.now();
  let screen = "title";
  let selectedDifficulty = "Easy";

  const menuButtons = [
    { label: "EASY", difficulty: "Easy", x: 120, y: 310, w: 190, h: 58 },
    { label: "NORMAL", difficulty: "Normal", x: 385, y: 310, w: 190, h: 58 },
    { label: "CHAOS", difficulty: "Chaos", x: 650, y: 310, w: 190, h: 58 }
  ];

  function setDifficulty(name) {
    selectedDifficulty = name;

    if (name === "Easy") {
      MAX_ENEMIES = 2;
      ENEMY_X_SPEED = 85;
      ENEMY_Y_SPEED = 55;
      SPAWN_MIN = 1.10;
      SPAWN_MAX = 1.60;
      RAY_CHANCE = 0.12;
    }

    if (name === "Normal") {
      MAX_ENEMIES = 3;
      ENEMY_X_SPEED = 105;
      ENEMY_Y_SPEED = 70;
      SPAWN_MIN = 0.80;
      SPAWN_MAX = 1.25;
      RAY_CHANCE = 0.20;
    }

    if (name === "Chaos") {
      MAX_ENEMIES = 4;
      ENEMY_X_SPEED = 125;
      ENEMY_Y_SPEED = 88;
      SPAWN_MIN = 0.55;
      SPAWN_MAX = 0.95;
      RAY_CHANCE = 0.32;
    }
  }

  function startGame(name) {
    startMusic();
    setDifficulty(name);
    fullRestart();
    screen = "play";
    last = performance.now();
  }

  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches && e.touches[0] ? e.touches[0] : e;
    return {
      x: (touch.clientX - rect.left) * (W / rect.width),
      y: (touch.clientY - rect.top) * (H / rect.height)
    };
  }

  function handleMenuPress(e) {
    if (screen !== "title") return;

    const p = canvasPointFromEvent(e);

    for (const b of menuButtons) {
      if (
        p.x >= b.x &&
        p.x <= b.x + b.w &&
        p.y >= b.y &&
        p.y <= b.y + b.h
      ) {
        e.preventDefault();
        startGame(b.difficulty);
        return;
      }
    }
  }

  canvas.addEventListener("mousedown", handleMenuPress);
  canvas.addEventListener("touchstart", handleMenuPress, { passive: false });

  function drawMenuButton(b, active) {
    ctx.save();

    ctx.fillStyle = active ? "#ff4da3" : "#ffffff";
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = "#4b2670";
    ctx.lineWidth = 5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = active ? "#ffffff" : "#4b2670";
    ctx.font = "bold 27px monospace";
    ctx.textAlign = "center";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 38);

    ctx.restore();
  }

  function drawTitleScreen() {
    drawBackground();

    // dark soft overlay so title is readable
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(0, 0, W, H);

    // wood-style title board
    ctx.save();
    ctx.translate(W / 2, 155);
    ctx.rotate(-0.035);

    ctx.fillStyle = "#c8894e";
    ctx.fillRect(-330, -85, 660, 150);

    ctx.fillStyle = "#e3a86c";
    ctx.fillRect(-315, -72, 630, 124);

    ctx.strokeStyle = "#5b2d18";
    ctx.lineWidth = 8;
    ctx.strokeRect(-330, -85, 660, 150);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#4b2670";
    ctx.lineWidth = 7;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.strokeText("UNICORN", 0, -25);
    ctx.fillText("UNICORN", 0, -25);

    ctx.fillStyle = "#4ef05c";
    ctx.strokeStyle = "#25321a";
    ctx.font = "bold 44px monospace";
    ctx.strokeText("VS ZOMBIE UNICORNS", 0, 35);
    ctx.fillText("VS ZOMBIE UNICORNS", 0, 35);

    ctx.restore();

    // little hero unicorn preview
    drawUnicorn(W * 0.30, 265, 1, false, false, false);

    // little zombie preview
    drawUnicorn(W * 0.70, 265, -1, true, false, false);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.strokeText("Choose Difficulty", W / 2, 292);
    ctx.fillText("Choose Difficulty", W / 2, 292);

    for (const b of menuButtons) {
      drawMenuButton(b, b.difficulty === selectedDifficulty);
    }

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.strokeText("Easy = relaxed   Normal = balanced   Chaos = more zombies", W / 2, 410);
    ctx.fillText("Easy = relaxed   Normal = balanced   Chaos = more zombies", W / 2, 410);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (screen === "title") {
      drawTitleScreen();
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

      const run = new Function(code + "\n//# sourceURL=title-menu-v52.js");
      run();
    })
    .catch(showLoadError);
})();