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

    // Ray gun on back instead of ray circle
    if (ray) {
      // back mount
      ctx.fillStyle = zombie ? "#8b1e1e" : "#3f5cff";
      ctx.fillRect(-10, -48, 22, 10);

      // barrel
      ctx.fillStyle = zombie ? "#ff4040" : "#66e7ff";
      ctx.fillRect(8, -45, 14, 4);

      // handle / strap
      ctx.fillStyle = "#333";
      ctx.fillRect(-4, -38, 5, 10);
      ctx.fillRect(-8, -39, 2, 12);

      // tiny glow tip
      ctx.fillStyle = "#fff";
      ctx.fillRect(21, -45, 3, 4);
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

    ctx.restore();
  }`
);