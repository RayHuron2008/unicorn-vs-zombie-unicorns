// Permanent early-level improvements, version 1.
// Rainbow/Graveyard scenery and humans, lethal spider contact, corrected finale
// counts, Graveyard music retry, and silent Forest music. Unicorn art is unchanged.
// Load before game.js; install after the level additions and Rainbow final fix.
(() => {
  function classicRuntime() {
    const classic = code => window.__uvzuCurrentLevelCode === code;
    const previousRestart = fullRestart;
    fullRestart = function() {
      previousRestart();
      if (classic("GRV2")) {
        state.grv2TarantulasKilled = 0;
        window.__uvzuLastAppliedEndingSceneAt = window.__uvzuGetEndingSceneSignal?.()?.at || 0;
      }
    };
    const previousMusic = startMusic;
    const previousLevelMusic = window.__uvzuUpdateLevelMusic;
    const silentLevel = () => ["CITY3", "FRST5", "HUNT6"].includes(window.__uvzuCurrentLevelCode);

    window.__uvzuUpdateLevelMusic = function() {
      previousLevelMusic?.();
      if (silentLevel()) {
        window.__uvzuStopMainMusic?.();
        window.stopTombMusic?.();
      }
    };
    startMusic = function() {
      // A rejected initial play needs another attempt inside a real input event.
      if (classic("GRV2") || silentLevel()) {
        window.__uvzuUpdateLevelMusic();
        return;
      }
      previousMusic();
    };
    window.__uvzuStartMainMusic = startMusic;
    for (const eventName of ["pointerdown", "pointerup"]) {
      window.addEventListener(eventName, () => {
        if (gameStarted && !paused) startMusic();
      }, { capture: true });
    }

    // Static scenery is rendered once per level, so detail stays inexpensive
    // on phones. It never consumes the gameplay random-number generator.
    let brush = ctx;
    const scenery = new Map();
    const box = (x, y, w, h, color) => {
      brush.fillStyle = color;
      brush.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    function polygon(points, color) {
      brush.fillStyle = color;
      brush.beginPath();
      points.forEach(([x, y], i) => i ? brush.lineTo(x, y) : brush.moveTo(x, y));
      brush.closePath(); brush.fill();
    }
    function ellipse(x, y, rx, ry, color) {
      brush.fillStyle = color; brush.beginPath();
      brush.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); brush.fill();
    }
    function sky(top, bottom) {
      const fill = brush.createLinearGradient(0, 0, 0, H);
      fill.addColorStop(0, top); fill.addColorStop(1, bottom);
      brush.fillStyle = fill; brush.fillRect(0, 0, W, H);
    }
    function cloud(x, y, scale, light, shade) {
      brush.save(); brush.translate(x, y); brush.scale(scale, scale);
      polygon([[-70, 13], [-70, 0], [-52, 0], [-52, -13], [-31, -13], [-31, -25],
        [-6, -25], [-6, -32], [22, -32], [22, -20], [47, -20], [47, -7], [68, -7],
        [68, 5], [88, 5], [88, 17], [-52, 17]], shade);
      polygon([[-58, 1], [-47, 1], [-47, -9], [-26, -9], [-26, -22], [-2, -22],
        [-2, -28], [18, -28], [18, -16], [39, -16], [39, -4], [57, -4],
        [57, 6], [77, 6], [77, 10], [-58, 10]], light);
      brush.restore();
    }
    function leafyTree(x, y, scale) {
      brush.save(); brush.translate(x, y); brush.scale(scale, scale);
      ellipse(4, 2, 48, 8, "#426f45");
      polygon([[-10, 0], [-8, -79], [-34, -104], [-28, -109], [-3, -88],
        [7, -129], [17, -128], [10, -79], [32, -98], [38, -91], [12, -65], [14, 0]], "#65513b");
      box(-5, -79, 5, 76, "#947247"); box(8, -56, 5, 49, "#443f30");
      polygon([[-62, -78], [-72, -106], [-58, -127], [-39, -129], [-31, -156],
        [-4, -169], [21, -159], [35, -141], [54, -139], [67, -115], [60, -87],
        [31, -70], [-3, -62], [-33, -68]], "#376a46");
      polygon([[-60, -110], [-49, -130], [-24, -130], [-24, -151], [-2, -161],
        [19, -150], [21, -132], [43, -132], [58, -115], [42, -98], [10, -92],
        [-4, -106], [-34, -98]], "#538d4d");
      box(-45, -128, 22, 8, "#75a65a"); box(-17, -151, 24, 8, "#83b462");
      box(18, -124, 25, 8, "#76a85c"); box(-18, -106, 18, 7, "#73a25a");
      brush.restore();
    }
    function grassAndFlowers(night) {
      const ground = H * .59;
      const sample = (index, salt) => {
        let value = Math.imul(index + salt, 1597334677);
        value = Math.imul(value ^ (value >>> 16), 2246822519);
        return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
      };
      for (let i = 0; i < 165; i++) {
        const x = sample(i,71) * W, y = ground + 9 + sample(i,389) * H * .38;
        const size = 2 + Math.floor((y - ground) / 75);
        box(x, y, 9 + i % 9, 2, night ? "#283f3e" : "#527f46");
        box(x + 2, y - size, 2, size + 1, night ? "#527063" : "#89ae5b");
        if (i % 3 === 0) box(x + 7, y - size - 2, 2, size + 2, night ? "#426354" : "#7aa452");
        if (!night && i % 4 === 0) {
          const color = ["#f2d97e", "#d294b8", "#f5e9bc", "#ac9bd0"][i % 7 % 4];
          box(x + 2, y - size - 6, 3, 8, "#3e743e");
          box(x - 1, y - size - 6, 9, 3, color);
          box(x + 2, y - size - 9, 3, 9, color);
          box(x + 2, y - size - 6, 3, 3, "#eac266");
        }
      }
    }
    function rainbowScenery() {
      sky("#5dadda", "#d5e6ae");
      ellipse(W * .16, H * .19, 43, 43, "#eddb99");
      ellipse(W * .16 - 4, H * .19 - 4, 35, 35, "#fff0b3");
      cloud(W * .34, H * .18, .87, "#f8eed0", "#c7ddd8");
      cloud(W * .84, H * .15, 1.05, "#f3eed2", "#c5dbd3");
      cloud(W * .05, H * .30, .65, "#eee9cd", "#c2d7cc");
      const colors = ["#e68586", "#eeb479", "#f2da89", "#8bc48f", "#82bcd3", "#a49aca"];
      brush.save(); brush.lineWidth = 10;
      for (let i = 0; i < colors.length; i++) {
        brush.strokeStyle = colors[i]; brush.beginPath();
        brush.arc(W * .64, H * .64, H * .43 - i * 10, Math.PI, Math.PI * 2); brush.stroke();
      }
      brush.restore();
      polygon([[0, H * .48], [W * .12, H * .34], [W * .26, H * .48], [W * .41, H * .39],
        [W * .52, H * .49], [W * .68, H * .35], [W * .86, H * .48], [W, H * .40],
        [W, H * .63], [0, H * .63]], "#80aca0");
      polygon([[0, H * .56], [W * .13, H * .47], [W * .32, H * .51], [W * .45, H * .58],
        [W * .64, H * .49], [W * .82, H * .52], [W, H * .49], [W, H * .68], [0, H * .68]], "#6eaa71");
      polygon([[0, H * .58], [W * .22, H * .55], [W * .42, H * .63], [W * .65, H * .57],
        [W * .82, H * .56], [W, H * .61], [W, H], [0, H]], "#689c52");
      box(0, H * .63, W, H * .37, "#679449");
      polygon([[0, H * .74], [W * .26, H * .69], [W * .53, H * .73], [W, H * .67],
        [W, H * .78], [W * .59, H * .81], [W * .29, H * .77], [0, H * .83]], "#78a253");
      polygon([[0, H * .93], [W * .30, H * .90], [W * .65, H * .97], [W, H * .89],
        [W, H], [0, H]], "#568343");
      for (let i = 0; i < 18; i++) {
        const x = i * 59 - 10, y = H * .596;
        box(x, y, 7, 32, "#816742"); box(x, y, 3, 29, "#b29b63");
        box(x - 1, y - 3, 9, 4, "#c4aa70");
        box(x + 7, y + 9, 51, 5, "#9b8152"); box(x + 7, y + 20, 51, 5, "#897044");
      }
      leafyTree(W * .075, H * .62, 1.1);
      leafyTree(W * .95, H * .61, .96);
      leafyTree(W * .23, H * .58, .40);
      leafyTree(W * .82, H * .58, .43);
      grassAndFlowers(false);
      for (const [x, y] of [[34, H - 13], [W - 40, H - 20], [W * .89, H - 50]]) {
        polygon([[x - 24, y], [x - 27, y - 13], [x - 12, y - 22], [x, y - 17],
          [x + 15, y - 25], [x + 30, y - 11], [x + 25, y]], "#356c43");
        box(x - 16, y - 18, 17, 5, "#75a65b"); box(x + 6, y - 18, 16, 5, "#589149");
      }
    }
    function bareTree(x, y, scale, distant = false) {
      brush.save(); brush.translate(x, y); brush.scale(scale, scale);
      const dark = distant ? "#293b4b" : "#2a3134";
      polygon([[-13, 0], [-8, -62], [-16, -104], [-7, -148], [1, -154],
        [-3, -108], [8, -76], [13, -25], [24, 0]], dark);
      polygon([[-7, -65], [-40, -88], [-54, -122], [-49, -126], [-33, -98],
        [-19, -91], [-35, -134], [-28, -130], [-9, -86]], dark);
      polygon([[0, -103], [29, -121], [42, -153], [48, -157], [35, -117],
        [66, -127], [58, -117], [10, -89]], dark);
      polygon([[7, -48], [35, -70], [48, -96], [52, -91], [43, -67], [12, -35]], dark);
      if (!distant) {
        polygon([[-4, -139], [-5, -105], [4, -73], [6, -7], [1, -7], [-1, -68], [-10, -104]], "#4e5751");
        box(-1, -42, 3, 28, "#677369");
      }
      brush.restore();
    }
    function stone(x, y, scale, cross, index) {
      brush.save(); brush.translate(x, y); brush.scale(scale, scale);
      ellipse(3, 2, 25, 5, "#233837");
      box(-21, -4, 44, 7, "#414c50");
      box(-19, -7, 39, 4, "#6b7878");
      polygon([[-16, -6], [-16, -41], [-11, -49], [9, -49], [16, -42], [16, -6]], "#7a8987");
      polygon([[9, -49], [18, -43], [20, -7], [12, -7], [12, -42]], "#414f56");
      polygon([[-13, -9], [-13, -39], [-8, -45], [8, -45], [11, -39], [11, -9]], "#5c6d70");
      box(-11, -40, 4, 29, "#8d9c92");
      if (cross) {
        box(-4, -66, 8, 35, "#667875"); box(-14, -57, 28, 7, "#667875");
        box(-3, -66, 3, 33, "#b0bba1"); box(-14, -57, 27, 2, "#a6b39e");
      } else {
        box(-3, -36, 4, 12, "#b3bea5"); box(-7, -33, 12, 3, "#b3bea5");
      }
      box(-5, -20, 11, 2, "#394d53"); box(-3, -15, 7, 2, "#394d53");
      if (index % 3 === 0) {
        polygon([[7, -42], [1, -34], [6, -30], [3, -24], [9, -30], [5, -34], [10, -42]], "#35494c");
      }
      box(-16, -11, 9, 5, "#54765a"); box(-19, -4, 14, 4, "#678160");
      brush.restore();
    }
    function mausoleum(x, y) {
      box(x - 72, y - 4, 147, 10, "#25333e");
      box(x - 61, y - 97, 122, 91, "#50606a");
      box(x + 45, y - 97, 17, 92, "#344651");
      for (let row = 0; row < 5; row++) {
        box(x - 60, y - 88 + row * 18, 121, 2, "#394c57");
        for (let col = 0; col < 4; col++) box(x - 45 + col * 30 + row % 2 * 12, y - 86 + row * 18, 2, 15, "#3f515b");
      }
      polygon([[x - 76, y - 100], [x, y - 139], [x + 76, y - 100]], "#728185");
      polygon([[x - 57, y - 105], [x, y - 132], [x + 57, y - 105]], "#414f5b");
      box(x - 74, y - 102, 148, 8, "#84908c");
      box(x - 20, y - 70, 40, 64, "#202c38");
      polygon([[x - 20, y - 70], [x - 12, y - 84], [x + 12, y - 84], [x + 20, y - 70]], "#202c38");
      box(x - 1, y - 80, 2, 74, "#3b4d59"); box(x - 15, y - 61, 2, 42, "#3b4d59");
      for (const side of [-1, 1]) {
        box(x + side * 43 - 8, y - 91, 16, 81, "#7a8987");
        box(x + side * 43 - 5, y - 89, 4, 77, "#a3aea0");
        box(x + side * 43 + 4, y - 89, 4, 78, "#445762");
        box(x + side * 43 - 12, y - 17, 24, 8, "#87938c");
      }
      box(x - 8, y - 121, 16, 3, "#a1ad9e");
      box(x - 65, y - 9, 130, 6, "#737e7a");
      box(x - 69, y - 3, 138, 6, "#4c5d62");
      box(x + 48, y - 35, 12, 27, "#3e594c"); box(x + 55, y - 53, 6, 22, "#506958");
    }
    function graveyardScenery() {
      sky("#172538", "#485568");
      for (let i = 0; i < 40; i++) box((i * 127 + 53) % W, 25 + i * 37 % 170, i % 6 ? 2 : 3, 2, "#b7c2b9");
      const glow = brush.createRadialGradient(W * .75, 94, 18, W * .75, 94, 100);
      glow.addColorStop(0, "rgba(221,223,181,.22)"); glow.addColorStop(1, "rgba(221,223,181,0)");
      brush.fillStyle = glow; brush.fillRect(W * .75 - 105, 0, 210, 200);
      ellipse(W * .75, 94, 35, 35, "#d5d9b5");
      ellipse(W * .75 - 5, 88, 29, 28, "#ece9c6");
      ellipse(W * .75 + 13, 100, 8, 6, "#bec9ad"); ellipse(W * .75 - 12, 79, 5, 4, "#cbd2b4");
      cloud(W * .18, 133, 1.25, "#394c60", "#304357");
      cloud(W * .57, 170, 1.6, "#3e5162", "#344756");
      cloud(W * .88, 153, .82, "#435364", "#344653");
      polygon([[0, H * .48], [W * .18, H * .43], [W * .37, H * .50], [W * .53, H * .46],
        [W * .71, H * .50], [W * .91, H * .42], [W, H * .45], [W, H * .65], [0, H * .65]], "#2b4050");
      for (let i = 0; i < 12; i++) bareTree(i * 93 - 20, H * .56, .45 + i % 3 * .11, true);
      box(0, H * .555, W, H * .445, "#344f49");
      polygon([[0, H * .68], [W * .27, H * .62], [W * .54, H * .70], [W, H * .63],
        [W, H * .80], [W * .54, H * .82], [W * .24, H * .76], [0, H * .83]], "#3e5950");
      polygon([[0, H * .91], [W * .24, H * .86], [W * .64, H * .94], [W, H * .87],
        [W, H], [0, H]], "#304942");
      const fenceY = H * .55;
      box(0, fenceY + 3, W, 10, "#54625d"); box(0, fenceY + 13, W, 5, "#263b3c");
      for (let i = 0; i < 56; i++) {
        const x = i * 18 - 7;
        box(x, fenceY - 32, 3, 35, "#1c3039"); box(x, fenceY - 31, 1, 31, "#73877f");
        polygon([[x - 3, fenceY - 31], [x + 1, fenceY - 40], [x + 5, fenceY - 31]], "#20333a");
      }
      box(0, fenceY - 21, W, 3, "#213840"); box(0, fenceY - 8, W, 3, "#20353c");
      for (const x of [21, W * .38, W * .65, W - 24]) {
        box(x - 8, fenceY - 42, 18, 50, "#5f6f6c"); box(x - 11, fenceY - 46, 24, 6, "#8a9688");
        box(x - 7, fenceY - 38, 4, 42, "#8e9a8b"); box(x + 5, fenceY - 38, 5, 44, "#3b5156");
      }
      mausoleum(W * .80, H * .56);
      for (let i = 0; i < 10; i++) stone(53 + i * 96, H * .63 + i % 2 * 9, .52, i % 4 === 1, i);
      bareTree(W * .095, H * .71, 1.05);
      bareTree(W * .96, H * .69, .88);
      grassAndFlowers(true);
      const stones = [[.045,.78,.76,0],[.18,.75,.86,1],[.29,.79,.74,0],[.41,.72,.78,0],
        [.60,.77,.83,1],[.70,.72,.70,0],[.85,.80,.88,0],[.96,.78,.70,1],
        [.07,.94,.82,0],[.22,.92,.70,1],[.34,.96,.67,0],[.68,.95,.72,0],[.83,.92,.82,1],[.95,.97,.80,0]];
      stones.forEach(([x,y,s,cross], i) => stone(W*x,H*y,s,cross,i));
      brush.save(); brush.globalAlpha = .07;
      for (const [x,y,rx] of [[.12,.68,.18],[.44,.73,.23],[.81,.69,.20],[.24,.88,.22],[.74,.92,.23]]) {
        ellipse(W*x,H*y,W*rx,10,"#bbd0c5");
      }
      brush.restore();
    }
    function statue() {
      const x = W / 2, y = H - 8;
      ellipse(x + 4, y - 4, 58, 9, "rgba(17,29,34,.4)");
      box(x - 44, y - 51, 88, 39, "#536575"); box(x - 42, y - 49, 9, 34, "#869994");
      box(x + 32, y - 49, 12, 37, "#364b59"); box(x - 48, y - 54, 96, 8, "#9ca9a0");
      box(x - 51, y - 15, 102, 12, "#61777f"); box(x - 51, y - 15, 102, 3, "#a7b3a4");
      for (const side of [-1, 1]) {
        brush.save(); brush.translate(x,y); brush.scale(side,1);
        polygon([[10,-88],[25,-108],[47,-115],[60,-103],[65,-81],[55,-63],[30,-56],[13,-64]], "#7b9199");
        polygon([[18,-86],[31,-103],[47,-110],[55,-99],[56,-80], [42,-65],[25,-64]], "#a4b5ad");
        for (let i=0;i<4;i++) polygon([[25+i*7,-101+i*3],[28+i*7,-97+i*3],
          [22+i*7,-70+i],[18+i*7,-65+i]], "#6b8591");
        brush.restore();
      }
      polygon([[x-10,y-94],[x+10,y-94],[x+14,y-74],[x+12,y-58],[x+20,y-23],
        [x-20,y-23],[x-12,y-58],[x-14,y-74]], "#a6b6ad");
      polygon([[x+4,y-91],[x+11,y-82],[x+8,y-58],[x+17,y-25],[x+4,y-25],[x-2,y-59]], "#748e99");
      box(x-8,y-117,16,21,"#c8ceaf"); box(x+5,y-114,5,17,"#8fa5a2");
      box(x-8,y-120,16,5,"#879d9d"); box(x-10,y-115,4,12,"#879d9d");
      box(x-4,y-108,2,2,"#536b79"); box(x+3,y-108,2,2,"#536b79");
      polygon([[x-11,y-80],[x-6,y-84],[x,y-72],[x+6,y-84],[x+11,y-80],
        [x+4,y-65],[x-4,y-65]], "#ced3b8");
      box(x-1,y-81,2,16,"#849b9c");
      box(x-18,y-36,36,12,"#293f4d"); box(x-12,y-32,24,2,"#90a295"); box(x-8,y-28,16,1,"#718d8d");
    }
    function backgroundLayer(name, paint) {
      let layer = scenery.get(name);
      if (!layer) {
        const image = document.createElement("canvas");
        image.width = W; image.height = H;
        const imageContext = image.getContext?.("2d");
        if (!imageContext) { paint(); return; }
        brush = imageContext;
        try { paint(); } finally { brush = ctx; }
        layer = image; scenery.set(name, layer);
      }
      ctx.drawImage(layer, 0, 0);
    }
    function human(x, y, type, walking, cheering, face = 1) {
      const child = type === "child", mom = type === "mom", dad = type === "dad";
      const family = mom || dad || child;
      const scale = child ? .64 : family ? .83 : 1;
      const skin = family ? "#a76e4c" : "#e7b38b";
      const skinShade = family ? "#744b38" : "#bd805f";
      const shirt = mom ? "#cf79a0" : dad ? "#6e9dbb" : child ? "#dfbd60" : "#8064b1";
      const shade = mom ? "#954e78" : dad ? "#426b92" : child ? "#a98541" : "#53417e";
      const stride = walking ? Math.sin(gameClock * 11) * 5 : 0;
      ctx.save(); ctx.translate(Math.round(x),Math.round(y)); ctx.scale(scale,scale);
      ellipse(0,2,16,4,"rgba(20,31,35,.24)");
      box(-8-stride*.35,-22,7,22,"#354251"); box(2+stride*.35,-22,7,22,"#253343");
      box(-9-stride*.35,-3,11,5,"#222c37"); box(1+stride*.35,-3,12,5,"#1b2731");
      box(-9-stride*.35,-3,9,2,"#768080"); box(2+stride*.35,-3,8,2,"#5a696f");
      if (mom) box(-12,-58,25,25,"#3d2c2a");
      box(-11,-42,23,22,shirt); box(6,-39,6,19,shade); box(-8,-40,4,18,"rgba(255,235,195,.17)");
      if (mom) {
        polygon([[-11,-35],[11,-35],[15,-18],[-15,-18]],shirt);
        polygon([[6,-35],[11,-35],[15,-18],[6,-18]],shade); box(-15,-20,30,3,shade);
      } else {
        box(-11,-22,23,3,shade); box(-3,-23,5,3,"#c0b893");
      }
      const handY = cheering ? -57 : -25;
      box(-16,cheering ? -53 : -40,6,cheering ? 17 : 14,shade);
      box(12,cheering ? -53 : -40,6,cheering ? 17 : 14,shirt);
      box(-16,handY-stride*.3,6,8,skinShade); box(12,handY+stride*.3,6,8,skin);
      box(-4,-45,9,7,skinShade); box(-9,-61,19,18,skin); box(6,-58,5,14,skinShade);
      box(-11,-54,3,6,skinShade); box(10,-54,3,6,skin);
      if (!dad) {
        box(-10,-64,21,6,"#3b2c2b"); box(-10,-60,4,8,"#3b2c2b");
        box(-6,-63,12,2,"#604438");
        if (mom) { box(8,-60,6,29,"#3b2c2b"); box(10,-50,3,17,"#584034"); }
      } else { box(-7,-62,14,2,"#be8357"); }
      box(-6,-54,3,2,"#352b2d"); box(2,-54,3,2,"#352b2d");
      box(face > 0 ? 3 : -6,-51,2,3,skinShade); box(-3,-47,7,2,"#704537");
      box(-2,-47,5,1,"#e6c296");
      ctx.restore();
    }
    function familyMember(p, type) {
      human(p.x, p.y + (type === "child" ? 12 : 20) - (p.hop || 0), type,
        state.mode === "approach", state.mode === "cheer");
    }
    const previousBackground = drawBackground;
    drawBackground = function() {
      if (classic("RNBW1")) {
        ctx.save(); backgroundLayer("rainbow",rainbowScenery); ctx.restore(); return;
      }
      if (!classic("GRV2")) return previousBackground();
      ctx.save(); backgroundLayer("graveyard",graveyardScenery);
      if (state.family && state.endingKind === "graveyardFamily" && state.mode === "npc") {
        const baseX = state.family.baseX || W/2, rise = state.family.rise || 0;
        Object.assign(state.family.mom,{x:baseX-30,y:H-42-rise});
        Object.assign(state.family.dad,{x:baseX+2,y:H-40-rise});
        Object.assign(state.family.child,{x:baseX+31,y:H-34-rise});
        for (const type of ["mom","dad","child"]) familyMember(state.family[type],type);
      }
      statue(); ctx.restore();
    };
    const previousNpc = drawNpc;
    drawNpc = function() {
      if (classic("GRV2") && state.family && state.endingKind === "graveyardFamily") {
        if (state.mode !== "npc") {
          const x = state.family.baseX || W/2;
          const y = lerp(H-76,GROUND_Y-4,clamp((state.family.walkTimer||0)/1.1,0,1));
          Object.assign(state.family.mom,{x:x-30,y});
          Object.assign(state.family.dad,{x:x+2,y:y+2});
          Object.assign(state.family.child,{x:x+31,y:y+8});
          for (const type of ["mom","dad","child"]) familyMember(state.family[type],type);
        }
        return;
      }
      if (!classic("RNBW1")) return previousNpc();
      if (state.npc) human(state.npc.x,state.npc.y+4,"npc",state.mode==="npc"||state.mode==="exit",false,state.npc.face||1);
    };
    const previousDialog = drawDialog;
    drawDialog = function() {
      if (!classic("GRV2") || state.endingKind !== "graveyardFamily") return previousDialog();
      if (state.mode !== "talk") return;
      const x = W/2-290, y = 70;
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.strokeStyle = "#4b2670";
      ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(x,y,580,95,16); ctx.fill(); ctx.stroke();
      ctx.textAlign = "left"; ctx.fillStyle = "#4b2670"; ctx.font = "900 18px system-ui,sans-serif";
      ctx.fillText("Mom",x+20,y+28); ctx.fillStyle = "#1e1530"; ctx.font = "800 17px system-ui,sans-serif";
      ctx.fillText("You saved us! I thought all of the unicorns",x+20,y+55);
      ctx.fillText("in the world had turned into those creepy eaters.",x+20,y+78); ctx.restore();
    };
  }

  window.__uvzuInstallClassicLevels = function(code) {
    function once(before, after) {
      if (code.split(before).length !== 2) throw new Error("Classic level hook missing: " + before.slice(0,90));
      code = code.replace(before, () => after);
    }
    // Spider flight must continue when it is horizontally above the player.
    once('      if (Math.abs(dx) > stopDistance) {',
      '      if (Math.abs(dx) > stopDistance || e.type === "tarantula" || e.type === "webTarantula") {');
    once('          if (\n  player.webbedTimer > 0 &&\n  Math.abs(e.x - player.x) < 42 &&\n  Math.abs((e.y - 12) - (player.y - 20)) < 38\n) {\n  // A spider touching a webbed player is an instant kill.\n  player.hp = 1;\n  player.invuln = 0;\n\n  damagePlayerByLaser();\n\n  player.webbedTimer = 0;\n  player.webFlash = 0;\n}',
      '          // Spider contact is handled below for both local and shared enemies.');
    once('      if (rectsOverlap(pBox, eBox)) {\n        const enemyIsInFront =',
      '      if (rectsOverlap(pBox, eBox)) {\n' +
      '        if (window.__uvzuCurrentLevelCode === "GRV2" &&\n' +
      '            (e.type === "tarantula" || e.type === "webTarantula")) {\n' +
      '          if (player.invuln <= 0) { loseLife(); updateHud(); return; }\n' +
      '          continue;\n' +
      '        }\n' +
      '        const enemyIsInFront =');
    // Easy has three spiders; Normal/Hard have four. Only confirmed host kills
    // decide a co-op win, and guests then follow the host's ending signal.
    const expected = '(window.__uvzuCurrentDifficultyName === "Easy" ? 3 : 4)';
    const shortCount = '(state.grv2TarantulasKilled || 0) < 4';
    if (code.split(shortCount).length !== 8) throw new Error("Graveyard victory-count hooks changed");
    code = code.split(shortCount).join('(state.grv2TarantulasKilled || 0) < ' + expected);
    once('(state.grv2TarantulasKilled || 0) >= 4',
      '(state.mode === "final" && (window.__uvzuIsMultiplayerGuest?.() || (state.grv2TarantulasKilled || 0) >= ' + expected + '))');
    once('(e.type === "tarantula" || e.type === "webTarantula") &&\n      method !== "remote"',
      '(e.type === "tarantula" || e.type === "webTarantula") &&\n      (method !== "remote" || window.__uvzuIsMultiplayerHost?.())');
    const authority = '(window.__uvzuCurrentLevelCode !== "RNBW1" || !window.__uvzuIsMultiplayerGuest?.())';
    if (code.split(authority).length !== 3) throw new Error("Final-wave authority hooks changed");
    code = code.split(authority).join('(!["RNBW1", "GRV2"].includes(window.__uvzuCurrentLevelCode) || !window.__uvzuIsMultiplayerGuest?.())');
    once('  requestAnimationFrame(loop);\n})();',
      '(' + classicRuntime.toString() + ')();\n  requestAnimationFrame(loop);\n})();');
    return code;
  };
})();
