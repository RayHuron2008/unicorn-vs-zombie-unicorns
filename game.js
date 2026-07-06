(() => {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBTqmoJpoO2OHpBxQUwAvbuW-8ICDJmUkE",
    authDomain: "unicorn-zombie-multiplayer.firebaseapp.com",
    databaseURL: "https://unicorn-zombie-multiplayer-default-rtdb.firebaseio.com",
    projectId: "unicorn-zombie-multiplayer",
    storageBucket: "unicorn-zombie-multiplayer.firebasestorage.app",
    messagingSenderId: "297435363171",
    appId: "1:297435363171:web:1a247d65ee8b3590e28556",
    measurementId: "G-ZCJ2JD8JDF"
  };

  let firebaseReady = null;
  let firebaseRoomCode = "";
  let firebasePlayerRole = "";
  let firebaseRemotePlayer = null;
  let firebaseRoomListenerStarted = false;
  let firebaseLastWriteAt = 0;

  async function getFirebaseDatabase() {
    if (!firebaseReady) {
      firebaseReady = Promise.all([
        import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js")
      ]).then(([appMod, dbMod]) => {
        const app = appMod.initializeApp(FIREBASE_CONFIG);
        const db = dbMod.getDatabase(app);
        return { dbMod, db };
      });
    }

    return firebaseReady;
  }

  async function createFirebaseRoom(roomCode, levelCode) {
    const { dbMod, db } = await getFirebaseDatabase();
    const roomRef = dbMod.ref(db, "rooms/" + roomCode);
    const now = Date.now();

    await dbMod.set(roomRef, {
      roomCode,
      levelCode: levelCode || "RNBW1",
      status: "waiting",
      createdAt: now,
      updatedAt: now,
      host: {
        connected: true,
        ready: true,
        x: 0,
        y: 0,
        face: 1,
        ray: 0,
        giant: 0
      },
      guest: {
        connected: false,
        ready: false,
        x: 0,
        y: 0,
        face: 1,
        ray: 0,
        giant: 0
      }
    });

    firebaseRoomCode = roomCode;
    firebasePlayerRole = "host";
    firebaseRemotePlayer = null;
    firebaseRoomListenerStarted = false;

    await startFirebaseRoomListener(roomCode);
  }

  async function joinFirebaseRoom(roomCode) {
    const { dbMod, db } = await getFirebaseDatabase();
    const roomRef = dbMod.ref(db, "rooms/" + roomCode);
    const snapshot = await dbMod.get(roomRef);

    if (!snapshot.exists()) {
      throw new Error("Room not found.");
    }

    const room = snapshot.val();

    await dbMod.update(roomRef, {
      status: "playing",
      updatedAt: Date.now(),
      "guest/connected": true,
      "guest/ready": true
    });

    firebaseRoomCode = roomCode;
    firebasePlayerRole = "guest";
    firebaseRemotePlayer = null;
    firebaseRoomListenerStarted = false;

    await startFirebaseRoomListener(roomCode);

    return room;
  }

  async function startFirebaseRoomListener(roomCode) {
    if (firebaseRoomListenerStarted) return;

    const { dbMod, db } = await getFirebaseDatabase();
    const roomRef = dbMod.ref(db, "rooms/" + roomCode);

    firebaseRoomListenerStarted = true;

    dbMod.onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const room = snapshot.val();
      const otherRole = firebasePlayerRole === "host" ? "guest" : "host";
      const other = room[otherRole];

      if (other && other.connected) {
        firebaseRemotePlayer = other;
      }
    });
  }

  window.__uvzuMultiplayerPush = function(player) {
    if (!firebaseRoomCode || !firebasePlayerRole || !player) return;

    const now = Date.now();

    if (now - firebaseLastWriteAt < 80) return;
    firebaseLastWriteAt = now;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const path = "rooms/" + firebaseRoomCode + "/" + firebasePlayerRole;

        return dbMod.update(dbMod.ref(db, path), {
          connected: true,
          ready: true,
          x: Math.round(player.x),
          y: Math.round(player.y),
          face: player.face || 1,
          ray: player.ray || 0,
          giant: player.giant || 0,
          updatedAt: now
        });
      })
      .catch((err) => {
        console.error("Multiplayer position write failed:", err);
      });
  };

  window.__uvzuGetRemotePlayer = function() {
    return firebaseRemotePlayer;
  };

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

      #titleControlsBtn,
      #titleMultiplayerBtn {
        position: absolute;
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

      #titleControlsBtn {
        right: 18px;
      }

      #titleMultiplayerBtn {
        left: 18px;
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

      #controlsOverlay,
      #multiplayerOverlay {
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.42);
      }

      #multiplayerOverlay {
        z-index: 10002;
      }

      #controlsPanel,
      #multiplayerPanel {
        width: min(86vw, 390px);
        max-height: min(78vh, 390px);
        padding: 20px;
        border-radius: 24px;
        background: rgba(255,255,255,.96);
        border: 4px solid rgba(76, 38, 112, .95);
        box-shadow: 0 10px 24px rgba(0,0,0,.35);
        display: flex;
        flex-direction: column;
      }

      #multiplayerPanel {
        gap: 12px;
        text-align: center;
      }

      #controlsTitle,
      #multiplayerTitle {
        font: 900 28px system-ui, sans-serif;
        color: #4b2670;
        text-align: center;
        margin-bottom: 12px;
        flex: 0 0 auto;
      }

      #controlsText,
      #multiplayerBody {
        font: 800 16px system-ui, sans-serif;
        color: #333;
        line-height: 1.55;
        overflow-y: auto;
        max-height: 230px;
        padding-right: 8px;
        flex: 1 1 auto;
      }

      #controlsText .section,
      .multiplayerSection {
        margin-top: 12px;
        color: #4b2670;
        font-weight: 900;
      }

      .multiplayerSection:first-child {
        margin-top: 0;
      }

      .multiplayerSmallText {
        font: 800 13px system-ui, sans-serif;
        color: #444;
        line-height: 1.35;
        margin-bottom: 8px;
      }

      #roomCodeBox {
        min-height: 30px;
        padding: 10px;
        border-radius: 14px;
        background: rgba(76, 38, 112, .10);
        font: 900 22px monospace;
        color: #4b2670;
        letter-spacing: 1px;
        margin-bottom: 10px;
      }

      #joinCodeInput,
      #hostLevelCodeInput {
        width: 100%;
        box-sizing: border-box;
        border: 3px solid rgba(76, 38, 112, .65);
        border-radius: 14px;
        padding: 12px;
        font: 900 20px monospace;
        text-align: center;
        color: #4b2670;
        text-transform: uppercase;
        margin-bottom: 10px;
      }

      #multiplayerHint {
        font: 800 13px system-ui, sans-serif;
        color: #444;
        line-height: 1.35;
      }

      #closeControlsBtn,
      #closeMultiplayerBtn {
        margin-top: 16px;
        width: 100%;
        flex: 0 0 auto;
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

        #titleControlsBtn,
        #titleMultiplayerBtn {
          bottom: 10px;
          font-size: 12px;
          padding: 8px 10px;
        }

        #titleControlsBtn {
          right: 10px;
        }

        #titleMultiplayerBtn {
          left: 10px;
        }

        #controlsPanel,
        #multiplayerPanel {
          max-height: 76vh;
          padding: 16px;
        }

        #controlsText,
        #multiplayerBody {
          font-size: 14px;
          max-height: 155px;
        }

        #multiplayerTitle {
          font-size: 24px;
        }

        #roomCodeBox {
          font-size: 18px;
        }

        #joinCodeInput,
        #hostLevelCodeInput {
          font-size: 16px;
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

          <div class="section">DASH</div>
          <div>Direction + A = Dash</div>
          <div>Dash helps dodge zombies and ray shots</div>

          <div class="section">GIANT MODE</div>
          <div>20 kills = Giant mode</div>
          <div>Giant mode = +1 extra life</div>

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

  function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let raw = "";

    for (let i = 0; i < 10; i++) {
      raw += chars[Math.floor(Math.random() * chars.length)];
    }

    return raw.slice(0, 5) + "-" + raw.slice(5);
  }

  function cleanCodeInput(input, maxChars, addDash) {
    let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (addDash && value.length > 5) {
      value = value.slice(0, 5) + "-" + value.slice(5, 10);
    } else {
      value = value.slice(0, maxChars);
    }

    input.value = value;
    return value;
  }

  function startFirstLevelFromMultiplayer(levelCode) {
    const finalLevelCode = (levelCode || "").trim().toUpperCase() || "RNBW1";

    const menuOverlay = document.getElementById("menuOverlay");
    const multiplayerOverlay = document.getElementById("multiplayerOverlay");
    const hud = document.getElementById("hud");
    const controls = document.getElementById("controls");

    if (finalLevelCode !== "RNBW1") {
      alert("That level code is saved for later. Right now only Level 1 exists.");
      return;
    }

    if (typeof window.__uvzuStartGame === "function") {
      window.__uvzuStartGame("Easy");
    }

    if (multiplayerOverlay) multiplayerOverlay.remove();
    if (menuOverlay) menuOverlay.remove();

    if (hud) hud.style.display = "";
    if (controls) controls.style.display = "";
  }

  function createMultiplayerPopup() {
    if (document.getElementById("multiplayerOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "multiplayerOverlay";
    overlay.innerHTML = `
      <div id="multiplayerPanel">
        <div id="multiplayerTitle">MULTIPLAYER</div>

        <div id="multiplayerBody">
          <div class="multiplayerSection">HOST GAME</div>
          <div class="multiplayerSmallText">
            Host creates a real online room code.
          </div>

          <button id="hostGameBtn" class="pauseBtn">HOST GAME</button>

          <div id="roomCodeBox">Room Code</div>

          <div class="multiplayerSmallText">
            Level Code for the joining player. Blank = Level 1.
          </div>

          <input
            id="hostLevelCodeInput"
            maxlength="5"
            placeholder="LEVEL CODE"
            autocomplete="off"
            autocapitalize="characters"
          />

          <button id="startHostGameBtn" class="pauseBtn">START HOST GAME</button>

          <div class="multiplayerSection">JOIN GAME</div>
          <div class="multiplayerSmallText">
            Enter the host room code.
          </div>

          <input
            id="joinCodeInput"
            maxlength="11"
            placeholder="ENTER ROOM CODE"
            autocomplete="off"
            autocapitalize="characters"
          />

          <button id="joinGameBtn" class="pauseBtn">JOIN GAME</button>

          <div id="multiplayerHint">
            Firebase player syncing is active. Enemies sync comes next.
          </div>
        </div>

        <button id="closeMultiplayerBtn" class="pauseBtn exit">BACK</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const roomCodeBox = overlay.querySelector("#roomCodeBox");
    const joinCodeInput = overlay.querySelector("#joinCodeInput");
    const hostLevelCodeInput = overlay.querySelector("#hostLevelCodeInput");

    overlay.querySelector("#hostGameBtn").addEventListener("click", async () => {
      const code = generateRoomCode();
      const levelCode = hostLevelCodeInput.value.trim().toUpperCase() || "RNBW1";

      roomCodeBox.textContent = "Creating...";

      try {
        await createFirebaseRoom(code, levelCode);
        roomCodeBox.textContent = code;
        alert("Room created. Give this code to Player 2: " + code);
      } catch (err) {
        console.error(err);
        roomCodeBox.textContent = "Room Code";
        alert("Could not create room. Check Firebase rules.");
      }
    });

    hostLevelCodeInput.addEventListener("input", () => {
      cleanCodeInput(hostLevelCodeInput, 5, false);
    });

    joinCodeInput.addEventListener("input", () => {
      cleanCodeInput(joinCodeInput, 10, true);
    });

    overlay.querySelector("#startHostGameBtn").addEventListener("click", async () => {
      let roomCode = roomCodeBox.textContent.trim();
      const levelCode = hostLevelCodeInput.value.trim().toUpperCase() || "RNBW1";

      if (roomCode === "Room Code" || roomCode === "Creating...") {
        roomCode = generateRoomCode();
        roomCodeBox.textContent = "Creating...";

        try {
          await createFirebaseRoom(roomCode, levelCode);
          roomCodeBox.textContent = roomCode;
        } catch (err) {
          console.error(err);
          roomCodeBox.textContent = "Room Code";
          alert("Could not create room. Check Firebase rules.");
          return;
        }
      }

      startFirstLevelFromMultiplayer(levelCode);
    });

    overlay.querySelector("#joinGameBtn").addEventListener("click", async () => {
      const code = joinCodeInput.value.trim().toUpperCase();

      if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)) {
        alert("Enter a room code like A7K2M-F9Q1Z");
        return;
      }

      try {
        const room = await joinFirebaseRoom(code);
        alert("Joined room " + code + ". Starting level.");
        startFirstLevelFromMultiplayer(room.levelCode || "RNBW1");
      } catch (err) {
        console.error(err);
        alert("Room not found. Check the code and try again.");
      }
    });

    overlay.querySelector("#closeMultiplayerBtn").addEventListener("click", () => {
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

    const multiplayerPopup = document.getElementById("multiplayerOverlay");
    if (multiplayerPopup) multiplayerPopup.remove();

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

      <button id="titleMultiplayerBtn">MULTIPLAYER</button>
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
      createMultiplayerPopup();
    });

    overlay.querySelector("#titleControlsBtn").addEventListener("click", () => {
      createControlsPopup();
    });

    const playBtn = overlay.querySelector("#playBtn");
    playBtn.addEventListener("click", () => {
      firebaseRoomCode = "";
      firebasePlayerRole = "";
      firebaseRemotePlayer = null;
      firebaseRoomListenerStarted = false;

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
        <div style="font: 900 16px system-ui, sans-serif; color: #4