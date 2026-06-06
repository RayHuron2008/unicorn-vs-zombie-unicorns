(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  const livesEl = document.getElementById("lives");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const powerFillEl = document.getElementById("powerFill");
  const powerLabelEl = document.getElementById("powerLabel");

  const dpad = document.getElementById("dpad");
  const btnA = document.getElementById("btnA");
  const btnB = document.getElementById("btnB");

  // MUSIC
  // If your file is named bgm_main.mp3.mp3, this code will try that as a backup.
  const musicFiles = ["bgm_main.mp3", "bgm_main.mp3.mp3"];
  let musicIndex = 0;
  let musicStarted = false;
  let music = new Audio(musicFiles[musicIndex]);
  music.loop = true;
  music.volume = 0.6;

  function startMusic() {
    if (musicStarted) return;

    musicStarted = true;

    music.play().catch(() => {
      musicIndex += 1;

      if (musicIndex < musicFiles.length) {
        music = new Audio(musicFiles[musicIndex]);
        music.loop = true;
        music.volume = 0.6;

        music.play().catch(() => {
          musicStarted = false;
        });
      } else {
        musicStarted = false;
      }
    });
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  const GROUND_Y = Math.floor(H * 0.78);
  const MIN_Y = GROUND_Y - 58;
  const MAX_Y = GROUND_Y;

  const LEVEL_TIME = 60;
  const MAX_ENEMIES = 4;
  const FINAL_RAY_COUNT = 2;

  const HP_MAX = 100;
  const DMG_TOUCH = 22;
  const DMG_LASER = 18;

  const RAY_TIME = 10;
  const GIANT_TIME = 20;

  const input = {
    dx: 0,
    dy: 0,
    a: false,
    b: false
  };

  const keys = {};

  window.addEventListener("keydown", e => {
    startMusic();
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
  });

  window.addEventListener("touchstart", () => {
    startMusic();
  }, { passive: true });

  window.addEventListener("mousedown", () => {
    startMusic();
  });

  function bindDpad() {
    if (!dpad) return;

    dpad.querySelectorAll(".dir").forEach(btn => {
      const dx = Number(btn.dataset.dx || 0);
      const dy = Number(btn.dataset.dy || 0);

      const start = e => {
        startMusic();
        input.dx = dx;
        input.dy = dy;
        e.preventDefault();
      };
