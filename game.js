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
    let firebaseCurrentRoom = null;
  let firebaseCountdownTimer = null;
  let firebaseCountdownStarted = false;
    let firebaseRemoteDrawX = null;
  let firebaseRemoteDrawY = null;
  let firebaseRemoteTargetX = null;
  let firebaseRemoteTargetY = null;
  let firebaseEnemyDeaths = {};
  let firebaseLastEnemyDeathWriteAt = 0;
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
            status: "lobby",
      countdownStartedAt: null,
      createdAt: now,
      updatedAt: now,
      host: {
        connected: true,
        ready: false,
        micOn: false,
        hearVoice: true,
        x: 0,
        y: 0
      },
      guest: {
        connected: false,
        ready: false,
        micOn: false,
        hearVoice: true,
        x: 0,
        y: 0
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
      status: "lobby",
      updatedAt: Date.now(),
      "guest/connected": true,
      "guest/ready": false,
      "guest/micOn": false,
      "guest/hearVoice": true
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
      firebaseCurrentRoom = room;

      const otherRole = firebasePlayerRole === "host" ? "guest" : "host";
      const other = room[otherRole];

            if (other && other.connected && typeof other.x === "number") {
        firebaseRemotePlayer = other;
        firebaseRemoteTargetX = other.x;
        firebaseRemoteTargetY = other.y;

        if (firebaseRemoteDrawX === null || firebaseRemoteDrawY === null) {
          firebaseRemoteDrawX = other.x;
          firebaseRemoteDrawY = other.y;
        }
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
    if (!firebaseRemotePlayer) return null;

    if (
      firebaseRemoteDrawX !== null &&
      firebaseRemoteDrawY !== null &&
      firebaseRemoteTargetX !== null &&
      firebaseRemoteTargetY !== null
    ) {
      firebaseRemoteDrawX += (firebaseRemoteTargetX - firebaseRemoteDrawX) * 0.25;
      firebaseRemoteDrawY += (firebaseRemoteTargetY - firebaseRemoteDrawY) * 0.25;

      return {
        ...firebaseRemotePlayer,
        x: firebaseRemoteDrawX,
        y: firebaseRemoteDrawY
      };
    }

    return firebaseRemotePlayer;
  };
    async function setFirebaseReady(isReady) {
    if (!firebaseRoomCode || !firebasePlayerRole) return;

    const { dbMod, db } = await getFirebaseDatabase();
    const roomRef = dbMod.ref(db, "rooms/" + firebaseRoomCode);
    const path = "rooms/" + firebaseRoomCode + "/" + firebasePlayerRole;

    await dbMod.update(dbMod.ref(db, path), {
      ready: !!isReady
    });

    const snapshot = await dbMod.get(roomRef);

    if (!snapshot.exists()) return;

    const room = snapshot.val();
    const hostReady = !!(room.host && room.host.ready);
    const guestReady = !!(room.guest && room.guest.ready);

    if (hostReady && guestReady && room.status === "lobby") {
      await dbMod.update(roomRef, {
        status: "countdown",
        countdownStartedAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  }
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

          <div id="lobbyStatusBox">Not in lobby yet</div>

          <button id="readyGameBtn" class="pauseBtn">READY</button>

          <div class="multiplayerSmallText">
            Voice chat controls will go here later. For now this lobby waits until both players are ready.
          </div>

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
            Firebase rooms are active. Player syncing comes next.
          </div>
        </div>

        <button id="closeMultiplayerBtn" class="pauseBtn exit">BACK</button>
      </div>
    `;

    document.body.appendChild(overlay);

        const roomCodeBox = overlay.querySelector("#roomCodeBox");
    const lobbyStatusBox = overlay.querySelector("#lobbyStatusBox");
    const readyGameBtn = overlay.querySelector("#readyGameBtn");
    const joinCodeInput = overlay.querySelector("#joinCodeInput");
    const hostLevelCodeInput = overlay.querySelector("#hostLevelCodeInput");
    readyGameBtn.addEventListener("click", async () => {
      if (!firebaseRoomCode || !firebasePlayerRole) {
        alert("Create or join a room first.");
        return;
      }

      readyGameBtn.textContent = "READY ✓";
      lobbyStatusBox.textContent = "You are ready. Waiting for the other player...";

      try {
        await setFirebaseReady(true);
      } catch (err) {
        console.error(err);
        readyGameBtn.textContent = "READY";
        lobbyStatusBox.textContent = "Ready failed. Try again.";
      }
    });   
 function updateLobbyStatus() {
      if (!firebaseCurrentRoom || !lobbyStatusBox) return;

      const hostReady = !!(firebaseCurrentRoom.host && firebaseCurrentRoom.host.ready);
      const guestReady = !!(firebaseCurrentRoom.guest && firebaseCurrentRoom.guest.ready);

      if (firebaseCurrentRoom.status === "countdown" && firebaseCurrentRoom.countdownStartedAt) {
        const elapsed = Math.floor((Date.now() - firebaseCurrentRoom.countdownStartedAt) / 1000);
        const left = Math.max(0, 10 - elapsed);

                lobbyStatusBox.textContent = "Starting in " + left + "...";

        if (left <= 0 && !firebaseCountdownStarted) {
          firebaseCountdownStarted = true;
          startFirstLevelFromMultiplayer(firebaseCurrentRoom.levelCode || "RNBW1");
        }

        return;
      }

      lobbyStatusBox.textContent =
        "Host: " + (hostReady ? "READY" : "WAITING") +
        " | Guest: " + (guestReady ? "READY" : "WAITING");
    }

    setInterval(updateLobbyStatus, 250);
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

            lobbyStatusBox.textContent = "Host lobby is ready. Press READY when you are ready.";
      alert("Host lobby is ready. Give Player 2 the room code, then press READY.");
    });

    overlay.querySelector("#joinGameBtn").addEventListener("click", async () => {
      const code = joinCodeInput.value.trim().toUpperCase();

      if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)) {
        alert("Enter a room code like A7K2M-F9Q1Z");
        return;
      }

            try {
        const room = await joinFirebaseRoom(code);
        roomCodeBox.textContent = code;
        lobbyStatusBox.textContent = "Joined lobby. Press READY when you are ready.";
        alert("Joined room " + code + ". Press READY when you are ready.");
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
        <div style="font: 900 16px system-ui, sans-serif; color: #4b2670;">
          Level Code: RNBW1
        </div>
        <button id="resumeBtn" class="pauseBtn">RESUME</button>
        <button id="pauseControlsBtn" class="pauseBtn">CONTROLS</button>
        <button id="exitBtn" class="pauseBtn exit">EXIT TO MENU</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.style.pointerEvents = "none";
    setTimeout(() => {
      overlay.style.pointerEvents = "";
    }, 300);

    overlay.querySelector("#resumeBtn").addEventListener("click", () => {
      const controlsPopup = document.getElementById("controlsOverlay");
      if (controlsPopup) controlsPopup.remove();

      const multiplayerPopup = document.getElementById("multiplayerOverlay");
      if (multiplayerPopup) multiplayerPopup.remove();

      overlay.remove();
      window.__uvzuSetPaused(false);
      if (controls) controls.style.display = "";
    });

    overlay.querySelector("#pauseControlsBtn").addEventListener("click", () => {
      createControlsPopup();
    });

        overlay.querySelector("#exitBtn").addEventListener("pointerup", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = window.location.pathname + "?v=" + Date.now();
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
        const multiplayerOpen = document.getElementById("multiplayerOverlay");

        if (menuOpen || pauseOpen || controlsOpen || multiplayerOpen) return;

        if (
          e.target.closest &&
          e.target.closest("#controls, #dpad, #ab, .dir, .ab, button, input")
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

      code = code.replace(
        "player.giant = GIANT_TIME;",
        "player.giant = GIANT_TIME;\n        player.lives += 1;"
      );

            code = replaceFunction(
        code,
        "updateEnding",
`  function updateEnding(dt) {
    if (state.mode === "npc") {
      if (!state.npc) {
        const fromLeft = player.x > W / 2;

        state.npc = {
          x: fromLeft ? -30 : W + 30,
          y: GROUND_Y,
          vx: fromLeft ? 160 : -160,
          face: fromLeft ? 1 : -1
        };
      }

      state.npc.x += state.npc.vx * dt;

      const target = player.x + (state.npc.vx > 0 ? -70 : 70);

      if (
        (state.npc.vx > 0 && state.npc.x >= target) ||
        (state.npc.vx < 0 && state.npc.x <= target)
      ) {
        state.npc.x = target;
        state.dialogTimer = 2.5;
        state.mode = "talk";
      }
    }

    if (state.mode === "talk") {
      state.dialogTimer -= dt;

      if (state.dialogTimer <= 0) {
        state.mode = "exit";
        state.exitTimer = 1.7;
      }
    }

    if (state.mode === "exit") {
      player.face = 1;
      player.x += 210 * dt;

      if (state.npc) {
        state.npc.x = player.x - 15;
        state.npc.y = player.y - 18;
      }

      if (player.x > W + 120) {
        state.mode = "fireworks";
        state.npc = null;
        state.fireworks.length = 0;
        state.victoryTimer = 3.5;
      }
    }

    if (state.mode === "fireworks") {
      state.victoryTimer -= dt;

      if (Math.random() < 0.15) spawnFirework();

      for (let i = state.fireworks.length - 1; i >= 0; i--) {
        const f = state.fireworks[i];

        f.life -= dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 40 * dt;

        if (f.life <= 0) state.fireworks.splice(i, 1);
      }

      if (state.victoryTimer <= 0) {
        state.mode = "victory";
      }
    }
  }`
      );
      code = code.replace(
`    updateParticles(dt);
    updateEnding(dt);
    updateHud();
  }`,
`    updateParticles(dt);
    updateEnding(dt);
    updateHud();

    if (window.__uvzuMultiplayerPush) {
      window.__uvzuMultiplayerPush(player);
    }
  }`
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
      code = code.replace(
        "drawUnicorn(player.x, player.y, player.face, false, player.ray > 0, player.giant > 0);",
        `drawUnicorn(player.x, player.y, player.face, false, player.ray > 0, player.giant > 0);

      if (window.__uvzuGetRemotePlayer) {
        const remote = window.__uvzuGetRemotePlayer();

        if (remote && typeof remote.x === "number" && typeof remote.y === "number") {
          ctx.save();
          ctx.globalAlpha = 0.82;
          drawUnicorn(remote.x, remote.y, remote.face || 1, false, remote.ray > 0, remote.giant > 0);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#4b2670";
          ctx.lineWidth = 3;
          ctx.font = "900 18px system-ui, sans-serif";
          ctx.strokeText("P2", remote.x - 13, remote.y - 72);
          ctx.fillText("P2", remote.x - 13, remote.y - 72);
          ctx.restore();
        }
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

      const bootStart = code.indexOf("  let last = performance.now();");
      const bootEnd = code.lastIndexOf("\n})();");

      if (bootStart === -1 || bootEnd === -1 || bootEnd <= bootStart) {
        throw new Error("Could not replace game boot loop");
      }

      const replacementBoot = `  let last = performance.now();
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

  window.__uvzuStartGame = function(name) {
    applyDifficulty(name || "Easy");

    try {
      fullRestart();
    } catch (e) {}

    try {
      startMusic && startMusic();
    } catch (e) {}

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
  requestAnimationFrame(loop);`;

      code = code.slice(0, bootStart) + replacementBoot + code.slice(bootEnd);

      const run = new Function(code + "\n//# sourceURL=graphics-v78.js");
      run();

      createTitleMenu();
    })
    .catch(showLoadError);
})();