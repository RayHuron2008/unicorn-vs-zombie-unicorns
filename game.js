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
  let firebaseEnemyState = null;
        let firebaseLevelCompleted = false;
        let firebaseNextLevelCode = "";
    let firebaseNextLevelAt = 0;
    window.__uvzuLastAppliedNextLevelAt = 0;
    let firebaseEndingSceneAt = 0;
    window.__uvzuLastAppliedEndingSceneAt = 0;
    let firebaseGhostResetAt = 0;
  window.__uvzuLastAppliedGhostResetAt = 0;
  let firebaseLastEnemyDeathWriteAt = 0;
  let firebaseLastGuestKillRequestAt = 0;
    let firebaseLastEnemyStateWriteAt = 0;
    let firebaseEnemyStateWriteBusy = false;
   let firebaseLastAppliedEnemyStateAt = 0;
  window.__uvzuLastAppliedEnemyStateAt = 0;
    window.__uvzuGuestShotFlashes = [];
    const GRAVEYARD_MUSIC_URL = "Graveyard%20Shuffle.mp3";
  let graveyardMusic = null;

  function startGraveyardMusic() {
    if (!graveyardMusic) {
      graveyardMusic = new Audio(GRAVEYARD_MUSIC_URL);
      graveyardMusic.loop = true;
      graveyardMusic.volume = 0.45;
    }

    graveyardMusic.play().catch((err) => {
      console.warn("Graveyard music play blocked:", err);
    });
  }

  function stopGraveyardMusic() {
    if (!graveyardMusic) return;

    graveyardMusic.pause();
    graveyardMusic.currentTime = 0;
  }

   window.__uvzuUpdateLevelMusic = function() {
    if (window.__uvzuLevelTheme === "graveyard") {
      if (window.__uvzuStopMainMusic) {
        window.__uvzuStopMainMusic();
      }

      startGraveyardMusic();
    } else {
      stopGraveyardMusic();
    }
  };

  window.__uvzuAddGuestShotFlash = function(enemy) {
    const remote = window.__uvzuGetRemotePlayer
      ? window.__uvzuGetRemotePlayer()
      : null;

    if (!remote || !enemy) return;

    window.__uvzuGuestShotFlashes.push({
      x1: remote.x + (remote.face || 1) * 34,
      y1: remote.y - 32,
      x2: enemy.x,
      y2: enemy.y - 24,
      until: Date.now() + 180
    });
  };
       let firebaseLocalGhost = false;
  window.__uvzuBothGhostResetStarted = false;

  window.__uvzuIsLocalGhost = function() {
    return firebaseLocalGhost;
  };

  window.__uvzuAreBothPlayersGhosts = function() {
    const remote = window.__uvzuGetRemotePlayer
      ? window.__uvzuGetRemotePlayer()
      : null;

    return !!(
      firebaseLocalGhost &&
      remote &&
      (remote.ghost || remote.dead)
    );
  };
    window.__uvzuGetGhostResetAt = function() {
    return firebaseGhostResetAt;
  };

  window.__uvzuSignalBothGhostReset = function() {
    if (!firebaseRoomCode || !firebasePlayerRole || window.__uvzuBothGhostResetStarted) return;

    window.__uvzuBothGhostResetStarted = true;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const path = "rooms/" + firebaseRoomCode;

        return dbMod.update(dbMod.ref(db, path), {
          status: "ghostReset",
          ghostResetAt: Date.now(),
          enemyDeaths: null,
          guestKillRequests: null,
          enemyState: null,
          levelCompleted: false,
          updatedAt: Date.now()
        });
      })
      .catch((err) => {
        console.error("Both ghost reset signal failed:", err);
        window.__uvzuBothGhostResetStarted = false;
      });
  };

  window.__uvzuMarkLocalDead = function(player) {
    firebaseLocalGhost = true;

    if (!firebaseRoomCode || !firebasePlayerRole) return;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const path = "rooms/" + firebaseRoomCode + "/" + firebasePlayerRole;

        return dbMod.update(dbMod.ref(db, path), {
          dead: true,
          ghost: true,
          lives: 0,
          hp: 0,
          updatedAt: Date.now()
        });
      })
      .catch((err) => {
        console.error("Mark local dead failed:", err);
      });
  };

  window.__uvzuReviveLocalForNextLevel = function(player) {
    firebaseLocalGhost = false;

    if (player) {
      player.lives = 5;
      player.hp = 2;
      player.invuln = 1.2;
    }

    if (!firebaseRoomCode || !firebasePlayerRole) return;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const path = "rooms/" + firebaseRoomCode + "/" + firebasePlayerRole;

        return dbMod.update(dbMod.ref(db, path), {
          dead: false,
          ghost: false,
          lives: 5,
          hp: 2,
          updatedAt: Date.now()
        });
      })
      .catch((err) => {
        console.error("Revive local failed:", err);
      });
  };
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

   async function createFirebaseRoom(roomCode, levelCode, difficultyName) {
    const { dbMod, db } = await getFirebaseDatabase();
    const roomRef = dbMod.ref(db, "rooms/" + roomCode);
    const now = Date.now();

    await dbMod.set(roomRef, {
           roomCode,
      levelCode: levelCode || "RNBW1",
      difficultyName: difficultyName || "Easy",
            status: "lobby",
      countdownStartedAt: null,
      createdAt: now,
            updatedAt: now,
           nextLevelCode: "",
      nextLevelAt: 0,
      endingSceneAt: 0,
      levelCompleted: false,
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
      firebaseEnemyDeaths = room.enemyDeaths || {};
      firebaseEnemyState = room.enemyState || null;
            firebaseLevelCompleted = !!room.levelCompleted;
           firebaseNextLevelCode = room.nextLevelCode || "";
      firebaseNextLevelAt = room.nextLevelAt || 0;
      firebaseEndingSceneAt = room.endingSceneAt || 0;
                firebaseGhostResetAt = room.ghostResetAt || 0;
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
          lives: typeof player.lives === "number" ? player.lives : 0,
          hp: typeof player.hp === "number" ? player.hp : 0,
          dead: firebaseLocalGhost,
          ghost: firebaseLocalGhost,
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
  window.__uvzuMultiplayerEnemyKilled = function(enemyId) {
    if (!firebaseRoomCode || !firebasePlayerRole || enemyId === undefined || enemyId === null) return;

    const now = Date.now();

    if (now - firebaseLastEnemyDeathWriteAt < 40) return;
    firebaseLastEnemyDeathWriteAt = now;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const safeId = String(enemyId).replace(/[^A-Za-z0-9_-]/g, "_");
        const path = "rooms/" + firebaseRoomCode + "/enemyDeaths/" + safeId;

        return dbMod.set(dbMod.ref(db, path), {
          dead: true,
          by: firebasePlayerRole,
          at: now
        });
      })
      .catch((err) => {
        console.error("Enemy death sync failed:", err);
      });
  };
 
  window.__uvzuRequestEnemyKill = function(enemyId) {
    if (!firebaseRoomCode || firebasePlayerRole !== "guest" || enemyId === undefined || enemyId === null) return;

    const now = Date.now();

    if (now - firebaseLastGuestKillRequestAt < 80) return;
    firebaseLastGuestKillRequestAt = now;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const safeId = String(enemyId).replace(/[^A-Za-z0-9_-]/g, "_");
        const path = "rooms/" + firebaseRoomCode + "/guestKillRequests/" + safeId;

        return dbMod.set(dbMod.ref(db, path), {
          requested: true,
          by: "guest",
          at: now
        });
      })
      .catch((err) => {
        console.error("Guest kill request failed:", err);
      });
  };
     window.__uvzuIsMultiplayerGuest = function() {
    return firebasePlayerRole === "guest";
  };

  window.__uvzuIsMultiplayerHost = function() {
    return firebasePlayerRole === "host";
  };

   window.__uvzuGetGuestKillRequests = function() {
    return firebaseCurrentRoom && firebaseCurrentRoom.guestKillRequests
      ? firebaseCurrentRoom.guestKillRequests
      : {};
  };

  window.__uvzuClearGuestKillRequest = function(enemyId) {
    if (!firebaseRoomCode || firebasePlayerRole !== "host" || !enemyId) return;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const safeId = String(enemyId).replace(/[^A-Za-z0-9_-]/g, "_");
        const path = "rooms/" + firebaseRoomCode + "/guestKillRequests/" + safeId;

        return dbMod.remove(dbMod.ref(db, path));
      })
      .catch((err) => {
        console.error("Clear guest kill request failed:", err);
      });
  };

    window.__uvzuMultiplayerPushEnemyState = function(enemies, forceNow = false) {
        if (!firebaseRoomCode || firebasePlayerRole !== "host" || !Array.isArray(enemies)) return;
    if (firebaseEnemyStateWriteBusy) return;

    const now = Date.now();

        if (!forceNow && now - firebaseLastEnemyStateWriteAt < 250) return;

    firebaseLastEnemyStateWriteAt = now;
    firebaseEnemyStateWriteBusy = true;
    const safeEnemies = enemies.slice(0, 8).map((e) => ({
      id: e.id || "",
      x: Math.round(e.x || 0),
      y: Math.round(e.y || 0),
      w: e.w || 54,
      h: e.h || 34,
      face: e.face || 1,
      type: e.type || "normal",
      hp: e.hp || 1,
      shootTimer: e.shootTimer || 0,
      sep: e.sep || 1
    }));

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const path = "rooms/" + firebaseRoomCode + "/enemyState";

        return dbMod.set(dbMod.ref(db, path), {
          enemies: safeEnemies,
          updatedAt: now
        });
      })
            .catch((err) => {
        console.error("Enemy state sync failed:", err);
      })
      .finally(() => {
        firebaseEnemyStateWriteBusy = false;
      });
  };

    window.__uvzuGetMultiplayerEnemyState = function() {
    return firebaseEnemyState;
  };
        window.__uvzuIsLevelCompleted = function() {
    return firebaseLevelCompleted;
  };

  window.__uvzuGetNextLevelSignal = function() {
    return {
      code: firebaseNextLevelCode,
      at: firebaseNextLevelAt
    };
  };
    window.__uvzuGetEndingSceneSignal = function() {
    return {
      at: firebaseEndingSceneAt
    };
  };

  window.__uvzuSignalEndingScene = function() {
    if (!firebaseRoomCode || firebasePlayerRole !== "host") return;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const path = "rooms/" + firebaseRoomCode;

        return dbMod.update(dbMod.ref(db, path), {
          status: "endingScene",
          endingSceneAt: Date.now(),
          levelCompleted: false,
          updatedAt: Date.now()
        });
      })
      .catch((err) => {
        console.error("Ending scene sync failed:", err);
      });
  };

    window.__uvzuSignalNextLevel = function(nextLevelCode) {
    if (!firebaseRoomCode || firebasePlayerRole !== "host") return;

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const path = "rooms/" + firebaseRoomCode;

        return dbMod.update(dbMod.ref(db, path), {
          status: "nextLevel",
          levelCompleted: false,
          nextLevelCode: nextLevelCode || "GRV2",
          nextLevelAt: Date.now(),
          enemyDeaths: null,
          guestKillRequests: null,
          enemyState: null,
          ghostResetAt: 0,
          updatedAt: Date.now()
        });
      })
      .catch((err) => {
        console.error("Next level sync failed:", err);
      });
  };

  window.__uvzuSignalLevelCompleted = function() {
    if (!firebaseRoomCode || !firebasePlayerRole) return;

    if (
      firebasePlayerRole === "host" &&
      window.__uvzuCurrentLevelCode === "RNBW1"
    ) {
      if (window.__uvzuSignalNextLevel) {
        window.__uvzuSignalNextLevel("GRV2");
      }

      return;
    }

    getFirebaseDatabase()
      .then(({ dbMod, db }) => {
        const path = "rooms/" + firebaseRoomCode;

        return dbMod.update(dbMod.ref(db, path), {
          levelCompleted: true,
          status: "levelCompleted",
          completedAt: Date.now(),
          updatedAt: Date.now()
        });
      })
      .catch((err) => {
        console.error("Level completed sync failed:", err);
      });
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

   function startFirstLevelFromMultiplayer(levelCode, difficultyName) {
    const finalLevelCode = (levelCode || "").trim().toUpperCase() || "RNBW1";
    const finalDifficultyName = difficultyName || "Easy";

    const menuOverlay = document.getElementById("menuOverlay");
    const multiplayerOverlay = document.getElementById("multiplayerOverlay");
    const hud = document.getElementById("hud");
    const controls = document.getElementById("controls");

       if (finalLevelCode !== "RNBW1" && finalLevelCode !== "GRV2") {
      alert("That level code is saved for later. Right now only Level 1 and Graveyard exist.");
      return;
    }

              window.__uvzuCurrentLevelCode = finalLevelCode;
       window.__uvzuCurrentDifficultyName = finalDifficultyName;
       window.__uvzuLevelTheme = finalLevelCode === "GRV2" ? "graveyard" : "rainbow";

       if (window.__uvzuUpdateLevelMusic) {
         window.__uvzuUpdateLevelMusic();
       }

    if (typeof window.__uvzuStartGame === "function") {
      window.__uvzuStartGame(finalDifficultyName);
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
            Host chooses the mode for both players.
          </div>

          <select
            id="hostDifficultySelect"
            style="width:100%;box-sizing:border-box;border:3px solid rgba(76,38,112,.65);border-radius:14px;padding:12px;font:900 18px system-ui,sans-serif;text-align:center;color:#4b2670;margin-bottom:10px;"
          >
            <option value="Easy">Easy</option>
            <option value="Normal">Normal</option>
            <option value="Chaos">Chaos</option>
          </select>

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
        const hostDifficultySelect = overlay.querySelector("#hostDifficultySelect");
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
                   startFirstLevelFromMultiplayer(
            firebaseCurrentRoom.levelCode || "RNBW1",
            firebaseCurrentRoom.difficultyName || "Easy"
          );
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
      const difficultyName = hostDifficultySelect.value || "Easy";

      roomCodeBox.textContent = "Creating...";

      try {
               await createFirebaseRoom(code, levelCode, difficultyName);
        roomCodeBox.textContent = code;
               alert("Room created in " + difficultyName + " mode. Give this code to Player 2: " + code);
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
      const difficultyName = hostDifficultySelect.value || "Easy";

      if (levelCode !== "RNBW1" && levelCode !== "GRV2") {
        alert("That level code is saved for later. Use RNBW1 or GRV2.");
        return;
      }

      if (roomCode === "Room Code" || roomCode === "Creating...") {
        roomCode = generateRoomCode();
        roomCodeBox.textContent = "Creating...";

        try {
          await createFirebaseRoom(roomCode, levelCode, difficultyName);
          roomCodeBox.textContent = roomCode;
        } catch (err) {
          console.error(err);
          roomCodeBox.textContent = "Room Code";
          alert("Could not create room. Check Firebase rules.");
          return;
        }
      } else {
        try {
          const { dbMod, db } = await getFirebaseDatabase();
          await dbMod.update(dbMod.ref(db, "rooms/" + roomCode), {
            levelCode,
            difficultyName,
            updatedAt: Date.now()
          });
        } catch (err) {
          console.error(err);
          alert("Could not update the room level code.");
          return;
        }
      }

      lobbyStatusBox.textContent = "Host lobby is ready. Press READY when you are ready.";
      alert("Host lobby is ready in " + difficultyName + " mode using level " + levelCode + ". Give Player 2 the room code, then press READY.");
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
                         <input
          id="singleLevelCodeInput"
          maxlength="5"
          placeholder="LEVEL CODE"
          autocomplete="off"
          autocapitalize="characters"
          style="width:100%;box-sizing:border-box;border:3px solid rgba(76,38,112,.65);border-radius:14px;padding:10px;font:900 16px system-ui,sans-serif;text-align:center;color:#4b2670;margin:8px 0 4px;"
        />

        <div id="menuHint">Choose difficulty, then tap START. Optional code unlocks hidden levels.</div>
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

       const singleLevelCodeInput = overlay.querySelector("#singleLevelCodeInput");

    singleLevelCodeInput.addEventListener("input", () => {
      cleanCodeInput(singleLevelCodeInput, 5, false);
    });

    const playBtn = overlay.querySelector("#playBtn");
    playBtn.addEventListener("click", () => {
            const typedLevelCode = singleLevelCodeInput.value.trim().toUpperCase();

      if (typedLevelCode && typedLevelCode !== "RNBW1" && typedLevelCode !== "GRV2") {
        alert("Unknown level code.");
        return;
      }

     window.__uvzuCurrentLevelCode = typedLevelCode === "GRV2" ? "GRV2" : "RNBW1";
      window.__uvzuLevelTheme = typedLevelCode === "GRV2" ? "graveyard" : "rainbow";

      if (window.__uvzuUpdateLevelMusic) {
        window.__uvzuUpdateLevelMusic();
      }

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
    stopGraveyardMusic();
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
         window.__uvzuLevelTheme = window.__uvzuLevelTheme || "rainbow";
    
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
        "const MIN_Y = GROUND_Y - 58;",
        "const MIN_Y = GROUND_Y - 118;"
      );
      
            code = code.replace(
        "const RAY_TIME = 10;",
        "const RAY_TIME = 5;"
      );
            code = code.replace(
`  function startMusic() {
    music.play().catch(() => {});
  }`,
`  function startMusic() {
    if (window.__uvzuLevelTheme === "graveyard") {
      music.pause();
      music.currentTime = 0;
      return;
    }

    music.play().catch(() => {});
  }

  window.__uvzuStopMainMusic = function() {
    music.pause();
    music.currentTime = 0;
  };

  window.__uvzuStartMainMusic = function() {
    if (window.__uvzuLevelTheme !== "graveyard") {
      music.play().catch(() => {});
    }
  };`
      );

            code = replaceFunction(
        code,
        "drawBackground",
`  function drawBackground() {
    if (window.__uvzuLevelTheme === "graveyard") {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#071026");
      sky.addColorStop(0.55, "#15183b");
      sky.addColorStop(1, "#222034");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#f4f0c8";
      ctx.beginPath();
      ctx.arc(W * 0.78, 78, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(7, 16, 38, 0.30)";
      ctx.beginPath();
      ctx.arc(W * 0.80, 68, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,.75)";
      for (let i = 0; i < 28; i++) {
        const x = (i * 137) % W;
        const y = 24 + ((i * 53) % 145);
        ctx.fillRect(x, y, 2, 2);
      }

      ctx.fillStyle = "#1f3428";
      ctx.fillRect(0, H * 0.58, W, H * 0.42);

      ctx.fillStyle = "#253c30";
      for (let x = -40; x < W + 80; x += 95) {
        ctx.fillRect(x, GROUND_Y - 38, 34, 50);
        ctx.fillRect(x + 6, GROUND_Y - 52, 22, 18);
      }

      ctx.fillStyle = "rgba(190, 205, 215, .20)";
      ctx.fillRect(0, GROUND_Y - 30, W, 22);
      ctx.fillRect(0, GROUND_Y + 4, W, 18);

      ctx.fillStyle = "#5d6670";
      ctx.fillRect(W / 2 - 34, GROUND_Y - 112, 68, 104);

      ctx.fillStyle = "#707984";
      ctx.beginPath();
      ctx.arc(W / 2, GROUND_Y - 112, 34, Math.PI, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#b8c0ca";
      ctx.beginPath();
      ctx.arc(W / 2, GROUND_Y - 91, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#b8c0ca";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 8, GROUND_Y - 78);
      ctx.lineTo(W / 2 - 28, GROUND_Y - 50);
      ctx.moveTo(W / 2 + 8, GROUND_Y - 78);
      ctx.lineTo(W / 2 + 28, GROUND_Y - 50);
      ctx.stroke();

      ctx.fillStyle = "#202025";
      ctx.fillRect(W / 2 - 18, GROUND_Y - 42, 36, 6);

      ctx.fillStyle = "#17191d";
      ctx.fillRect(0, GROUND_Y + 20, W, H - GROUND_Y);

      ctx.fillStyle = "#2f573c";
      ctx.fillRect(0, GROUND_Y + 8, W, 18);
      return;
    }

    ctx.fillStyle = "#77ccff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#a7e9ff";
    ctx.fillRect(0, 90, W, 90);

    ctx.fillStyle = "#8be37a";
    ctx.fillRect(0, H * 0.58, W, H * 0.42);

    drawRainbow(W * 0.62, GROUND_Y + 10, 240);

    drawCloud(120, 70);
    drawCloud(390, 55);
    drawCloud(750, 85);

    drawTree(90, GROUND_Y + 16);
    drawTree(820, GROUND_Y + 18);

    ctx.fillStyle = "#7a4a2a";
    ctx.fillRect(0, GROUND_Y + 20, W, H - GROUND_Y);

    ctx.fillStyle = "#29c768";
    ctx.fillRect(0, GROUND_Y + 8, W, 18);
  }`
      );
      code = code.replace(
        "const wantRay = Math.random() < 0.2;",
        "const wantRay = Math.random() < RAY_CHANCE;"
      );
      code = code.replace(
        "let shootCooldown = 0;",
        "let shootCooldown = 0;\n  let multiplayerEnemyIdCounter = 0;"
      );
            code = code.replace(
`  function startMusic() {
    music.play().catch(() => {});
  }`,
`  function startMusic() {
    if (window.__uvzuLevelTheme === "graveyard") {
      music.pause();
      music.currentTime = 0;
      return;
    }

    music.play().catch(() => {});
  }

  window.__uvzuStopMainMusic = function() {
    music.pause();
    music.currentTime = 0;
  };

  window.__uvzuStartMainMusic = function() {
    if (window.__uvzuLevelTheme !== "graveyard") {
      music.play().catch(() => {});
    }
  };`
      );
            code = code.replace(
`  function startMusic() {
    music.play().catch(() => {});
  }`,
`  function startMusic() {
    if (window.__uvzuLevelTheme === "graveyard") {
      music.pause();
      music.currentTime = 0;
      return;
    }

    music.play().catch(() => {});
  }

  window.__uvzuStopMainMusic = function() {
    music.pause();
    music.currentTime = 0;
  };

  window.__uvzuStartMainMusic = function() {
    if (window.__uvzuLevelTheme !== "graveyard") {
      music.play().catch(() => {});
    }
  };`
      );
        

                code = code.replace(
`    if (player.lives <= 0) {
      fullRestart();
      return;
    }

    state.resetQueued = true;`,
`    if (player.lives <= 0) {
      if (
        (window.__uvzuIsMultiplayerHost && window.__uvzuIsMultiplayerHost()) ||
        (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest())
      ) {
        player.lives = 0;
        player.hp = 0;
        player.invuln = 999999;

        if (window.__uvzuMarkLocalDead) {
          window.__uvzuMarkLocalDead(player);
        }

        state.resetQueued = false;
        return;
      }

      fullRestart();
      return;
    }

    if (
      window.__uvzuCurrentLevelCode === "GRV2" &&
      state.mode === "final"
    ) {
      player.hp = HP_MAX;
      player.invuln = 1.2;
      player.headTimer = 0;
      player.dodgeTimer = 0;
      player.dodgeCooldown = 0.25;
      player.actionLock = 0.25;
      player.webbedTimer = 0;
      state.resetQueued = false;
      updateHud();
      return;
    }

    if (
      (window.__uvzuIsMultiplayerHost && window.__uvzuIsMultiplayerHost()) ||
      (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest())
    ) {
      player.hp = HP_MAX;
      player.invuln = 1.2;
      player.headTimer = 0;
      player.dodgeTimer = 0;
      player.dodgeCooldown = 0.25;
      player.actionLock = 0.25;
      state.resetQueued = false;
      return;
    }

    state.resetQueued = true;`
      );

           code = code.replace(
`    updateHealthRegen(dt);

    if (state.mode === "play" || state.mode === "final") {`,
`    updateHealthRegen(dt);

    player.webbedTimer = Math.max(0, (player.webbedTimer || 0) - dt);
 player.webFlash = Math.max(0, (player.webFlash || 0) - dt);
 window.__uvzuApplySpiderWebTrap = function(player) {
  if (!player) return;

  player.webbedTimer = 2.6;
  player.webFlash = 2.6;
  player.actionLock = 2.6;
  player.headTimer = 0;
  player.dodgeTimer = 0;
  player.dodgeCooldown = Math.max(player.dodgeCooldown || 0, 0.5);
  player.webTrapX = player.x;
  player.webTrapY = player.y;
};

            const nextLevelSignal = window.__uvzuGetNextLevelSignal
      ? window.__uvzuGetNextLevelSignal()
      : null;

    if (
      nextLevelSignal &&
      nextLevelSignal.at &&
      nextLevelSignal.at !== window.__uvzuLastAppliedNextLevelAt
    ) {
      window.__uvzuLastAppliedNextLevelAt = nextLevelSignal.at;

      const nextCode = nextLevelSignal.code || "GRV2";

     window.__uvzuCurrentLevelCode = nextCode;
      window.__uvzuLevelTheme = nextCode === "GRV2" ? "graveyard" : "rainbow";

      if (window.__uvzuUpdateLevelMusic) {
        window.__uvzuUpdateLevelMusic();
      }

      if (window.__uvzuReviveLocalForNextLevel) {
        window.__uvzuReviveLocalForNextLevel(player);
      }

      fullRestart();
      player.lives = 5;
      player.hp = HP_MAX;
      player.invuln = 1.2;
      updateHud();

      return;
    }

      const endingSceneSignal = window.__uvzuGetEndingSceneSignal
      ? window.__uvzuGetEndingSceneSignal()
      : null;

    if (
      endingSceneSignal &&
      endingSceneSignal.at &&
      endingSceneSignal.at !== window.__uvzuLastAppliedEndingSceneAt &&
        (
  window.__uvzuCurrentLevelCode === "RNBW1" ||
  (
    window.__uvzuCurrentLevelCode === "GRV2" &&
    (state.grv2TarantulasKilled || 0) >= 4
  )
) &&
      state.mode !== "npc" &&
      state.mode !== "talk" &&
      state.mode !== "exit" &&
      state.mode !== "fireworks"
    ) {
      window.__uvzuLastAppliedEndingSceneAt = endingSceneSignal.at;

      state.enemies.length = 0;
      state.enemyShots.length = 0;
      state.playerShots.length = 0;

            if (window.__uvzuCurrentLevelCode === "GRV2") {
        startGraveyardFamilyScene();
      } else {
        startNpcScene();
      }

      return;
    }
      const ghostResetAt = window.__uvzuGetGhostResetAt
      ? window.__uvzuGetGhostResetAt()
      : 0;

    if (
      ghostResetAt &&
      ghostResetAt !== window.__uvzuLastAppliedGhostResetAt
    ) {
      window.__uvzuLastAppliedGhostResetAt = ghostResetAt;
      window.__uvzuBothGhostResetStarted = false;

      if (window.__uvzuReviveLocalForNextLevel) {
        window.__uvzuReviveLocalForNextLevel(player);
      }

      fullRestart();
      player.lives = 5;
      player.hp = HP_MAX;
      player.invuln = 1.2;
      updateHud();

      return;
    }

    if (
      window.__uvzuAreBothPlayersGhosts &&
      window.__uvzuAreBothPlayersGhosts() &&
      !window.__uvzuBothGhostResetStarted
    ) {
      if (window.__uvzuSignalBothGhostReset) {
        window.__uvzuSignalBothGhostReset();
      }

      return;
    }
        if (
      window.__uvzuIsLocalGhost &&
      window.__uvzuIsLocalGhost() &&
      state.mode !== "npc" &&
      state.mode !== "talk" &&
      state.mode !== "exit" &&
      state.mode !== "fireworks"
    ) {
      const remote = window.__uvzuGetRemotePlayer
        ? window.__uvzuGetRemotePlayer()
        : null;

      if (remote && typeof remote.x === "number" && typeof remote.y === "number") {
        player.x = remote.x;
        player.y = remote.y;
        player.face = remote.face || player.face;
      }

      player.hp = 0;
      player.invuln = 999999;
      player.headTimer = 0;
      player.dodgeTimer = 0;
      player.ray = 0;
      player.giant = 0;
    }
    if (
      (state.mode === "play" || state.mode === "final") &&
      !(window.__uvzuIsLocalGhost && window.__uvzuIsLocalGhost())
    ) {`
      );

               code = code.replace(
`      if (!updateDodgeMovement(dt)) {
        player.x += dir.dx * speed * dt;
        player.y += dir.dy * speed * 0.72 * dt;
      }`,
`if (player.webbedTimer > 0) {
  player.dodgeTimer = 0;
  player.headTimer = 0;
  player.actionLock = player.webbedTimer;

  if (typeof player.webTrapX === "number") player.x = player.webTrapX;
  if (typeof player.webTrapY === "number") player.y = player.webTrapY;

  if (typeof dir !== "undefined") {
    dir.dx = 0;
    dir.dy = 0;
  }
      } else if (!updateDodgeMovement(dt)) {
        player.x += dir.dx * speed * dt;
        player.y += dir.dy * speed * 0.72 * dt;
      }`
      );
      
      code = code.replace(
        "state.enemies.push({\n      x,",
        "state.enemies.push({\n      id: \"e\" + (++multiplayerEnemyIdCounter),\n      x,"
      );
                 code = code.replace(
        `    const e = state.enemies[index];
    const powered = player.ray > 0 || player.giant > 0;`,
        `    const e = state.enemies[index];

    if (
      e &&
      window.__uvzuCurrentLevelCode === "GRV2" &&
      (e.type === "tarantula" || e.type === "webTarantula") &&
      method !== "remote"
    ) {
      state.grv2TarantulasKilled = (state.grv2TarantulasKilled || 0) + 1;
    }

                if (e && e.id && method !== "remote") {
  if (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest()) {
         if (e.type === "ray") {
      player.ray = Math.max(player.ray || 0, RAY_TIME);
    }

    if (window.__uvzuRequestEnemyKill) {
      window.__uvzuRequestEnemyKill(e.id);
    }
  } else if (window.__uvzuMultiplayerEnemyKilled) {
    window.__uvzuMultiplayerEnemyKilled(e.id);
  }
}

    const powered = player.ray > 0 || player.giant > 0;`
      );
      code = code.replace(
        "state.spawnTimer = rand(0.75, 1.2);",
        "state.spawnTimer = rand(SPAWN_MIN, SPAWN_MAX);"
      );

         code = code.replace(
`        if (state.spawnTimer <= 0 && state.enemies.length < MAX_ENEMIES) {`,
`        if (
          state.spawnTimer <= 0 &&
          state.enemies.length < MAX_ENEMIES &&
          !(window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest())
        ) {`
      );

                     code = code.replace(
`        spawnEnemy("ray");
        state.finalSpawned += 1;
        state.finalSpawnTimer = 0.9;`,
`      if (window.__uvzuCurrentLevelCode === "GRV2") {
  if (typeof state.grv2TarantulasKilled !== "number") {
    state.grv2TarantulasKilled = 0;
  }

  const livingTarantulas = state.enemies.some((enemy) =>
    enemy &&
    (enemy.type === "tarantula" || enemy.type === "webTarantula")
  );

  if (state.finalSpawned >= 1 && livingTarantulas) {
    state.finalSpawnTimer = 0.35;
    return;
  }

  const isSecondGroup = state.finalSpawned >= 1;

  state.enemies.push({
            id: "t" + (++multiplayerEnemyIdCounter),
            x: -70,
            y: GROUND_Y - 4,
            w: 82,
            h: 46,
            face: 1,
            type: isSecondGroup ? "webTarantula" : "tarantula",
            hp: 4,
            shootTimer: 0,
            sep: 1,
            vx: 145,
            vy: 0,
            groundY: GROUND_Y - 4,
            jumpTimer: 0.35,
            webTimer: isSecondGroup ? 1.2 : 999
          });

if (!isSecondGroup) {
          state.enemies.push({
            id: "t" + (++multiplayerEnemyIdCounter),
            x: W + 70,
            y: GROUND_Y - 4,
            w: 82,
            h: 46,
            face: -1,
            type: isSecondGroup ? "webTarantula" : "tarantula",
            hp: 4,
            shootTimer: 0,
            sep: 1,
            vx: -145,
            vy: 0,
            groundY: GROUND_Y - 4,
            jumpTimer: 0.55,
            webTimer: isSecondGroup ? 1.6 : 999
          });
}

          state.finalSpawned += 1;
          state.finalSpawnTimer = 2.2;
        } else {
          spawnEnemy("ray");
          state.finalSpawned += 1;
          state.finalSpawnTimer = 0.9;
        }`
      );

          code = code.replace(
        "e.x += Math.sign(dx) * 105 * dt;",
`if (!(window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest())) {
       if (e.type === "tarantula" || e.type === "webTarantula") {
          if (typeof e.groundY !== "number") e.groundY = GROUND_Y - 4;
          if (typeof e.vx !== "number") e.vx = e.face * 135;
          if (typeof e.vy !== "number") e.vy = 0;
          if (typeof e.jumpTimer !== "number") e.jumpTimer = rand(0.45, 0.85);

          e.jumpTimer -= dt;

          if (e.y >= e.groundY - 2 && e.jumpTimer <= 0) {
            e.vy = -360;
            e.vx = Math.sign(player.x - e.x || e.face || 1) * rand(120, 170);
            e.face = e.vx >= 0 ? 1 : -1;
            e.jumpTimer = rand(0.65, 1.05);
          }

          e.x += e.vx * dt;
          e.vy += 760 * dt;
          e.y += e.vy * dt;

          if (e.y > e.groundY) {
            e.y = e.groundY;
            e.vy = 0;
          }

          if (e.x < 28) {
            e.x = 28;
            e.vx = Math.abs(e.vx);
          }
          if (e.type === "webTarantula") {
            if (typeof e.webTimer !== "number") e.webTimer = rand(1.1, 1.8);

            e.webTimer -= dt;

            if (e.webTimer <= 0) {
              const sx = e.x + e.face * 36;
              const sy = e.y - 18;
              const angle = Math.atan2(player.y - 24 - sy, player.x - sx);

              state.enemyShots.push({
                x: sx,
                y: sy,
                vx: Math.cos(angle) * 245,
                vy: Math.sin(angle) * 245,
                r: 9,
                life: 2.4,
                type: "web"
              });

              e.webTimer = rand(1.7, 2.5);
            }
          }
          if (e.x > W - 28) {
            e.x = W - 28;
            e.vx = -Math.abs(e.vx);
          }
          
        } else {
          e.x += Math.sign(dx) * ENEMY_X_SPEED * dt;`
      );

            
      code = code.replace(
        "e.y += Math.sign(dy) * 70 * dt;",
        "e.y += Math.sign(dy) * ENEMY_Y_SPEED * dt;\n        }\n      }"
      );
                code = code.replace(
`    for (const e of state.enemies) {
      drawUnicorn(e.x, e.y, e.face, true, e.type === "ray", false);
    }`,
`    function drawTarantula(e) {
      const x = e.x;
      const y = e.y;
      const face = e.face || 1;

      ctx.save();

      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      ctx.ellipse(x, y + 18, 42, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#241018";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";

      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(x - 16, y - 6);
        ctx.lineTo(x - 42, y - 24 + i * 9);
        ctx.lineTo(x - 58, y - 8 + i * 10);

        ctx.moveTo(x - 6, y - 4);
        ctx.lineTo(x - 32, y + 2 + i * 11);
        ctx.lineTo(x - 50, y + 20 + i * 5);

        ctx.moveTo(x + 16, y - 6);
        ctx.lineTo(x + 42, y - 24 + i * 9);
        ctx.lineTo(x + 58, y - 8 + i * 10);

        ctx.moveTo(x + 6, y - 4);
        ctx.lineTo(x + 32, y + 2 + i * 11);
        ctx.lineTo(x + 50, y + 20 + i * 5);

        ctx.stroke();
      }

      ctx.fillStyle = "#3a1722";
      ctx.beginPath();
      ctx.ellipse(x, y - 10, 34, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#5b2632";
      ctx.beginPath();
      ctx.ellipse(x + face * 30, y - 14, 18, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f04a4a";
      ctx.beginPath();
      ctx.arc(x + face * 35, y - 18, 3, 0, Math.PI * 2);
      ctx.arc(x + face * 35, y - 9, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#f2eee0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + face * 43, y - 8);
      ctx.lineTo(x + face * 50, y + 4);
      ctx.moveTo(x + face * 39, y - 4);
      ctx.lineTo(x + face * 45, y + 7);
      ctx.stroke();

      if (e.hp > 0 && e.hp < 4) {
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.fillRect(x - 24, y - 48, 48, 5);

        ctx.fillStyle = "#e64545";
        ctx.fillRect(x - 24, y - 48, 12 * e.hp, 5);
      }

      ctx.restore();
    }

    for (const e of state.enemies) {
      if (e.type === "tarantula" || e.type === "webTarantula") {
        drawTarantula(e);
      } else {
        drawUnicorn(e.x, e.y, e.face, true, e.type === "ray", false);
      }
    }`
      );

            code = code.replace(
`          e.hp -= 1;
          state.playerShots.splice(i, 1);

          if (e.hp <= 0) killEnemy(j, "ray");`,
`        if (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest()) {
            e.hp -= 1;

            if (e.hp <= 0) {
              killEnemy(j, "ray");
            }
          } else {
            e.hp -= 1;

            if (e.hp <= 0) killEnemy(j, "ray");
          }

          state.playerShots.splice(i, 1);`
      );
                 code = code.replace(
`        if (rectsOverlap(pBox, bBox)) {
          damagePlayerByLaser();
          state.enemyShots.splice(i, 1);
        }`,
`        if (b.type === "web") {
          const webDx = b.x - player.x;
          const webDy = b.y - (player.y - 24);
          const webDist = Math.hypot(webDx, webDy);

          if (webDist < 48) {
            window.__uvzuApplySpiderWebTrap(player);
            addParticles(player.x, player.y - 20, "shield");
            state.enemyShots.splice(i, 1);
            continue;
          }
        }

        if (rectsOverlap(pBox, bBox)) {
          if (b.type === "web") {
            window.__uvzuApplySpiderWebTrap(player);
            addParticles(player.x, player.y - 20, "shield");
          } else {
            damagePlayerByLaser();
          }

          state.enemyShots.splice(i, 1);
        }`
      );

                 code = code.replace(
`      if (distance(b.x, b.y, player.x, player.y - 24) < b.r + 19) {
        damagePlayerByLaser();
        state.enemyShots.splice(i, 1);
        if (state.resetQueued) return;
        continue;
      }`,
      `      if (distance(b.x, b.y, player.x, player.y - 24) < b.r + 48) {
        if (b.type === "web") {
          window.__uvzuApplySpiderWebTrap(player);
          addParticles(player.x, player.y - 20, "shield");
        } else {
          damagePlayerByLaser();
        }

        state.enemyShots.splice(i, 1);
        if (state.resetQueued) return;
        continue;
      }`
      );
      
            code = code.replace(
`      ctx.fillStyle = "#ff2a2a";
      ctx.fillRect(b.x - 8, b.y - 3, 16, 6);

      ctx.fillStyle = "#fff";
      ctx.fillRect(b.x - 4, b.y - 2, 8, 4);`,
`      if (b.type === "web") {
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;

        ctx.beginPath();
        ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(b.x - 10, b.y);
        ctx.lineTo(b.x + 10, b.y);
        ctx.moveTo(b.x, b.y - 10);
        ctx.lineTo(b.x, b.y + 10);
        ctx.moveTo(b.x - 7, b.y - 7);
        ctx.lineTo(b.x + 7, b.y + 7);
        ctx.moveTo(b.x + 7, b.y - 7);
        ctx.lineTo(b.x - 7, b.y + 7);
        ctx.stroke();

        ctx.restore();
      } else {
        ctx.fillStyle = "#ff2a2a";
        ctx.fillRect(b.x - 8, b.y - 3, 16, 6);

        ctx.fillStyle = "#fff";
        ctx.fillRect(b.x - 4, b.y - 2, 8, 4);
      }`
      );
      
            code = code.replace(
        "e.y += Math.sign(dy) * 70 * dt;",
        "e.y += Math.sign(dy) * ENEMY_Y_SPEED * dt;\n      }"
      );

      code = code.replace(
        "player.giant = GIANT_TIME;",
        "player.giant = GIANT_TIME;\n        player.lives += 1;"
      );
            code = code.replace(
`  function startNpcScene() {`,
`  function startGraveyardFamilyScene() {
    clearBattlefield();

    state.mode = "npc";
    state.endingKind = "graveyardFamily";
    state.npc = null;
    state.dialogTimer = 0;
    state.exitTimer = 0;
    state.victoryTimer = 0;
    state.fireworks.length = 0;

    const ax = W / 2;

    state.family = {
      baseX: ax,
      baseY: GROUND_Y + 2,
      rise: 0,
      cheerTimer: 0,
      mom: { x: ax - 28, y: GROUND_Y + 34, hop: 0 },
      dad: { x: ax + 2, y: GROUND_Y + 36, hop: 0 },
      child: { x: ax + 30, y: GROUND_Y + 40, hop: 0 }
    };
  }

  function startNpcScene() {`
      );

                                              code = replaceFunction(
        code,
        "updateEnding",
`  function updateEnding(dt) {
    function getMultiplayerEndingHero() {
      const remote = window.__uvzuGetRemotePlayer
        ? window.__uvzuGetRemotePlayer()
        : null;

      const localAlive = !(window.__uvzuIsLocalGhost && window.__uvzuIsLocalGhost());
      const remoteAlive = !!(
        remote &&
        typeof remote.x === "number" &&
        typeof remote.y === "number" &&
        !remote.ghost &&
        !remote.dead
      );

      const localIsHost = window.__uvzuIsMultiplayerHost && window.__uvzuIsMultiplayerHost();

      if (localAlive && remoteAlive) {
        if (localIsHost) return player;
        return remote;
      }

      if (localAlive) return player;
      if (remoteAlive) return remote;

      return player;
    }

    const isMultiplayer =
      (window.__uvzuIsMultiplayerHost && window.__uvzuIsMultiplayerHost()) ||
      (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest());

    if (state.endingKind === "graveyardFamily") {
      if (state.mode === "npc") {
        if (!state.family) {
          startGraveyardFamilyScene();
        }

      state.family.rise += 38 * dt;

if (state.family.rise >= 34) {
  state.family.rise = 34;
  state.family.walkTimer = 0;
  state.mode = "approach";
}
      }

      if (state.mode === "approach") {
        state.family.walkTimer += dt;

        const targetX = W / 2 - 130;
        state.family.baseX += (targetX - state.family.baseX) * Math.min(1, dt * 2.6);

        state.family.mom.hop = Math.abs(Math.sin(state.family.walkTimer * 9)) * 4;
        state.family.dad.hop = Math.abs(Math.sin(state.family.walkTimer * 9 + 0.7)) * 4;
        state.family.child.hop = Math.abs(Math.sin(state.family.walkTimer * 11 + 1.2)) * 5;

        if (Math.abs(state.family.baseX - targetX) < 4) {
          state.family.baseX = targetX;
          state.family.mom.hop = 0;
          state.family.dad.hop = 0;
          state.family.child.hop = 0;
         state.dialogTimer = 7.5;
state.mode = "talk";
        }
      }

     if (state.mode === "talk") {
  state.dialogTimer -= dt;

  if (input.a && !player.aConsumed) {
    player.aConsumed = true;
    state.dialogTimer = 0;
  }

  if (!input.a) {
    player.aConsumed = false;
  }

  if (state.dialogTimer <= 0) {
    state.mode = "cheer";
    state.family.cheerTimer = 2.1;
  }
}

      if (state.mode === "cheer") {
        state.family.cheerTimer -= dt;

        const elapsed = 2.1 - Math.max(0, state.family.cheerTimer);
        state.family.mom.hop = Math.max(0, Math.sin(elapsed * 10)) * 8;
        state.family.dad.hop = Math.max(0, Math.sin(elapsed * 10 + 0.8)) * 8;
        state.family.child.hop = Math.max(0, Math.sin(elapsed * 12 + 1.3)) * 10;

        if (state.family.cheerTimer <= 0) {
          state.mode = "fireworks";
          state.fireworks.length = 0;
          state.victoryTimer = 3.5;
        }
      }
    } else {
      if (state.mode === "npc") {
        const hero = isMultiplayer ? getMultiplayerEndingHero() : player;

        if (!state.npc) {
          const fromLeft = hero.x > W / 2;

          state.npc = {
            x: fromLeft ? -30 : W + 30,
            y: GROUND_Y,
            vx: fromLeft ? 160 : -160,
            face: fromLeft ? 1 : -1
          };
        }

        state.npc.x += state.npc.vx * dt;

        const heroX = typeof hero.x === "number" ? hero.x : player.x;
        const target = heroX + (state.npc.vx > 0 ? -70 : 70);

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
        const hero = isMultiplayer ? getMultiplayerEndingHero() : player;

        if (hero === player) {
          player.face = 1;
          player.x += 210 * dt;
        }

        if (state.npc) {
          const heroX = typeof hero.x === "number" ? hero.x : player.x;
          const heroY = typeof hero.y === "number" ? hero.y : player.y;

          state.npc.x = heroX - 15;
          state.npc.y = heroY - 18;
        }

        const exitX = hero === player
          ? player.x
          : (typeof hero.x === "number" ? hero.x + 210 * dt : W + 121);

        if (exitX > W + 120 || state.exitTimer <= 0) {
          state.mode = "fireworks";
          state.npc = null;
          state.fireworks.length = 0;
          state.victoryTimer = 3.5;
        }

        state.exitTimer -= dt;
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
        if (
          ((window.__uvzuIsMultiplayerHost && window.__uvzuIsMultiplayerHost()) ||
          (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest())) &&
          window.__uvzuCurrentLevelCode === "RNBW1"
        ) {
          if (window.__uvzuSignalLevelCompleted) {
            window.__uvzuSignalLevelCompleted();
          }

          return;
        }

        state.mode = "victory";
      }
    }
  }`
      );
                                                        code = code.split("startNpcScene();").join(
`if (
      (window.__uvzuIsMultiplayerHost && window.__uvzuIsMultiplayerHost()) ||
      (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest())
    ) {
      if (window.__uvzuCurrentLevelCode === "RNBW1") {
        if (
          window.__uvzuIsMultiplayerHost &&
          window.__uvzuIsMultiplayerHost() &&
          window.__uvzuSignalEndingScene
        ) {
          window.__uvzuSignalEndingScene();
        }

        startNpcScene();
      } else if (window.__uvzuCurrentLevelCode === "GRV2") {
              if ((state.grv2TarantulasKilled || 0) < 4) {
          return;
        }
        
        if (
          window.__uvzuIsMultiplayerHost &&
          window.__uvzuIsMultiplayerHost() &&
          window.__uvzuSignalEndingScene
        ) {
          window.__uvzuSignalEndingScene();
        }

        startGraveyardFamilyScene();
      } else {
        if (window.__uvzuSignalLevelCompleted) {
          window.__uvzuSignalLevelCompleted();
        }

        state.mode = "fireworks";
        state.npc = null;
        state.enemies.length = 0;
        state.enemyShots.length = 0;
        state.playerShots.length = 0;
        state.fireworks.length = 0;
        state.victoryTimer = 3.5;
      }
    } else {
    if (window.__uvzuCurrentLevelCode === "GRV2") {
  if ((state.grv2TarantulasKilled || 0) < 4) {
    return;
  }

  startGraveyardFamilyScene();
} else {
  startNpcScene();
}
    }`
      );

      code = code.replace(
        "Victory: Stage 1 Completed!",
        "LEVEL COMPLETED!"
      );         
          code = code.replace(
`    updateParticles(dt);
    updateEnding(dt);
    updateHud();
  }`,
`    updateParticles(dt);
    updateEnding(dt);

   if (
      window.__uvzuIsLevelCompleted &&
      window.__uvzuIsLevelCompleted() &&
      !(
        window.__uvzuCurrentLevelCode === "GRV2" &&
        (state.grv2TarantulasKilled || 0) < 4
      ) &&
      state.mode !== "fireworks" &&
      state.mode !== "victory"
    ) {
      state.mode = "fireworks";
      state.npc = null;
      state.enemies.length = 0;
      state.enemyShots.length = 0;
      state.playerShots.length = 0;
      state.fireworks.length = 0;
      state.victoryTimer = 3.5;
    }

    if (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest()) {
      const enemyState = window.__uvzuGetMultiplayerEnemyState
        ? window.__uvzuGetMultiplayerEnemyState()
        : null;

      if (
        enemyState &&
        Array.isArray(enemyState.enemies) &&
        enemyState.updatedAt
      ) {
        window.__uvzuLastAppliedEnemyStateAt = enemyState.updatedAt;

        state.enemies = enemyState.enemies.map((e) => ({
          id: e.id,
          x: e.x,
          y: e.y,
          w: e.w || 54,
          h: e.h || 34,
          face: e.face || 1,
          type: e.type || "normal",
          hp: e.hp || 1,
          shootTimer: e.shootTimer || 0,
          sep: e.sep || 1
        }));
      }
    }

    if (window.__uvzuIsMultiplayerHost && window.__uvzuIsMultiplayerHost()) {
      const guestKillRequests = window.__uvzuGetGuestKillRequests
        ? window.__uvzuGetGuestKillRequests()
        : {};

      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];

               if (enemy && enemy.id && guestKillRequests[enemy.id]) {
          if (window.__uvzuAddGuestShotFlash) {
            window.__uvzuAddGuestShotFlash(enemy);
          }

          killEnemy(i, "remote");

          if (window.__uvzuClearGuestKillRequest) {
            window.__uvzuClearGuestKillRequest(enemy.id);
          }
        }
      }

      if (window.__uvzuMultiplayerPushEnemyState) {
        window.__uvzuMultiplayerPushEnemyState(state.enemies);
      }
    }

    if (window.__uvzuGetEnemyDeaths) {
      const deadEnemies = window.__uvzuGetEnemyDeaths();

      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];

        if (enemy && enemy.id && deadEnemies[enemy.id]) {
          killEnemy(i, "remote");
        }
      }
    }

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
       if (window.__uvzuLevelTheme === "graveyard") {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#050814");
      sky.addColorStop(0.40, "#10172d");
      sky.addColorStop(0.72, "#1e2240");
      sky.addColorStop(1, "#2d2940");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // moon glow
      const moonGlow = ctx.createRadialGradient(W * 0.80, 92, 8, W * 0.80, 92, 95);
      moonGlow.addColorStop(0, "rgba(255,245,210,.95)");
      moonGlow.addColorStop(0.35, "rgba(255,240,190,.55)");
      moonGlow.addColorStop(1, "rgba(255,240,190,0)");
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#efe7bc";
      ctx.beginPath();
      ctx.arc(W * 0.80, 92, 36, 0, Math.PI * 2);
      ctx.fill();

      // moon shadow haze
      ctx.fillStyle = "rgba(80, 95, 135, .20)";
      ctx.beginPath();
      ctx.arc(W * 0.83, 84, 36, 0, Math.PI * 2);
      ctx.fill();

      // stars
      ctx.fillStyle = "rgba(255,255,255,.78)";
      for (let i = 0; i < 36; i++) {
        const x = (i * 127) % W;
        const y = 18 + ((i * 61) % 165);
        ctx.fillRect(x, y, 2, 2);
      }

      // distant haze/hills
      ctx.fillStyle = "#1d2435";
      ctx.beginPath();
      ctx.moveTo(0, H * 0.58);
      ctx.quadraticCurveTo(W * 0.18, H * 0.48, W * 0.35, H * 0.56);
      ctx.quadraticCurveTo(W * 0.53, H * 0.65, W * 0.73, H * 0.54);
      ctx.quadraticCurveTo(W * 0.87, H * 0.46, W, H * 0.52);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#243027";
      ctx.beginPath();
      ctx.moveTo(0, H * 0.66);
      ctx.quadraticCurveTo(W * 0.22, H * 0.57, W * 0.46, H * 0.67);
      ctx.quadraticCurveTo(W * 0.70, H * 0.78, W, H * 0.62);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // big playable cemetery ground, same height feel as Level 1
      const graveGround = ctx.createLinearGradient(0, H * 0.56, 0, H);
      graveGround.addColorStop(0, "#304d35");
      graveGround.addColorStop(0.35, "#263d2f");
      graveGround.addColorStop(0.72, "#202923");
      graveGround.addColorStop(1, "#17191d");
      ctx.fillStyle = graveGround;
      ctx.fillRect(0, H * 0.56, W, H * 0.44);

      // darker rolling cemetery grass lines
      for (let i = 0; i < 8; i++) {
        const y = H * 0.60 + i * 28;
        ctx.strokeStyle = i % 2 === 0
          ? "rgba(210,225,215,.07)"
          : "rgba(5,20,12,.18)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.quadraticCurveTo(W * 0.35, y + 15, W + 20, y - 9);
        ctx.stroke();
      }

     // graveyard fence - pushed far into the background and scaled smaller
ctx.save();
ctx.strokeStyle = "#121217";
ctx.globalAlpha = 0.9;
ctx.lineWidth = 2.5;

for (let x = -10; x < W + 20; x += 18) {
  ctx.beginPath();
  ctx.moveTo(x, GROUND_Y - 148);
  ctx.lineTo(x, GROUND_Y - 126);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, GROUND_Y - 151, 2.6, Math.PI, 0);
  ctx.stroke();
}

ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(0, GROUND_Y - 134);
ctx.lineTo(W, GROUND_Y - 134);
ctx.stroke();

ctx.restore();
      // dead trees
      function deadTree(tx, ty, s) {
        ctx.strokeStyle = "#151117";
        ctx.lineWidth = 8 * s;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - 4 * s, ty - 48 * s);
        ctx.stroke();

        ctx.lineWidth = 5 * s;
        ctx.beginPath();
        ctx.moveTo(tx - 2 * s, ty - 38 * s);
        ctx.lineTo(tx - 24 * s, ty - 58 * s);
        ctx.moveTo(tx - 1 * s, ty - 46 * s);
        ctx.lineTo(tx + 20 * s, ty - 68 * s);
        ctx.moveTo(tx - 2 * s, ty - 24 * s);
        ctx.lineTo(tx - 18 * s, ty - 38 * s);
        ctx.moveTo(tx - 1 * s, ty - 30 * s);
        ctx.lineTo(tx + 17 * s, ty - 46 * s);
        ctx.stroke();
      }
      deadTree(110, GROUND_Y - 8, 1.0);
      deadTree(820, GROUND_Y - 6, 1.15);

            // farther-back tombstones near the fence
      const backStones = [
        [92,  GROUND_Y - 88, 14, 18, false],
        [182, GROUND_Y - 96, 12, 16, true],
        [286, GROUND_Y - 90, 15, 19, false],
        [404, GROUND_Y - 98, 13, 17, false],
        [520, GROUND_Y - 92, 15, 19, true],
        [640, GROUND_Y - 96, 12, 16, false],
        [748, GROUND_Y - 90, 14, 18, false],
        [846, GROUND_Y - 94, 12, 16, true]
      ];

      for (const s of backStones) {
        tombstone(s[0], s[1], s[2], s[3], s[4]);
      }

      // scattered tombstones
      function tombstone(x, y, w, h, cross) {
        ctx.fillStyle = "#5f6773";
        ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.beginPath();
        ctx.arc(x, y - h, w / 2, Math.PI, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.fillRect(x - w / 2 + 3, y - h + 4, Math.max(2, w * 0.14), h - 8);

        if (cross) {
          ctx.fillStyle = "#848c98";
          ctx.fillRect(x - 3, y - h - 14, 6, 22);
          ctx.fillRect(x - 11, y - h - 7, 22, 5);
        }
      }

          const stones = [
        [70,  GROUND_Y - 42, 22, 30, false],
        [136, GROUND_Y - 24, 18, 24, true],
        [205, GROUND_Y - 50, 24, 32, false],
        [286, GROUND_Y - 28, 18, 22, false],

        [382, GROUND_Y - 58, 26, 36, true],
        [470, GROUND_Y - 30, 20, 26, false],

        // keep center lane more open around the angel
        [578, GROUND_Y - 52, 24, 30, false],
        [672, GROUND_Y - 26, 18, 22, true],
        [760, GROUND_Y - 46, 24, 32, false],
        [846, GROUND_Y - 28, 20, 25, false]
      ];
      for (const s of stones) {
        tombstone(s[0], s[1], s[2], s[3], s[4]);
      }
             // cloudy spooky fog
      ctx.save();

      function fogCloud(cx, cy, rx, ry, alpha) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
        g.addColorStop(0, "rgba(225,235,245," + alpha + ")");
        g.addColorStop(0.45, "rgba(225,235,245," + (alpha * 0.65) + ")");
        g.addColorStop(1, "rgba(225,235,245,0)");
        ctx.fillStyle = g;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

            // upper drifting haze
      fogCloud(W * 0.18, GROUND_Y - 34, 130, 38, 0.16);
      fogCloud(W * 0.38, GROUND_Y - 18, 160, 46, 0.18);
      fogCloud(W * 0.62, GROUND_Y - 28, 145, 40, 0.17);
      fogCloud(W * 0.84, GROUND_Y - 14, 125, 34, 0.15);

      // middle body of fog
      fogCloud(W * 0.12, GROUND_Y + 8, 145, 40, 0.18);
      fogCloud(W * 0.34, GROUND_Y + 18, 185, 52, 0.21);
      fogCloud(W * 0.58, GROUND_Y + 12, 178, 50, 0.20);
      fogCloud(W * 0.82, GROUND_Y + 20, 160, 46, 0.18);

      // lower heavier fog near the ground
      fogCloud(W * 0.22, GROUND_Y + 42, 185, 44, 0.17);
      fogCloud(W * 0.50, GROUND_Y + 48, 225, 52, 0.20);
      fogCloud(W * 0.80, GROUND_Y + 44, 190, 44, 0.16);

      // soft base haze so it all blends together
           const baseFog = ctx.createLinearGradient(0, GROUND_Y - 14, 0, GROUND_Y + 64);
      baseFog.addColorStop(0, "rgba(220,230,240,0.02)");
      baseFog.addColorStop(0.20, "rgba(220,230,240,0.08)");
      baseFog.addColorStop(0.55, "rgba(220,230,240,0.16)");
      baseFog.addColorStop(1, "rgba(220,230,240,0.11)");
      ctx.fillStyle = baseFog;
      ctx.fillRect(0, GROUND_Y - 14, W, 86);

      ctx.restore();
      // family hidden behind the angel grave
     if (
  state.family &&
  state.endingKind === "graveyardFamily" &&
  state.mode === "npc"
) {
        function drawHiddenFamilyMember(p, type) {
  const x = p.x;
  const y = p.y - (p.hop || 0);

  const isMom = type === "mom";
  const isDad = type === "dad";
  const isChild = type === "child";

  const shirt = isMom ? "#ff7fa8" : isDad ? "#6ea8ff" : "#ffd86a";
  const headSize = isChild ? 7 : 8;

  ctx.save();

  // MOM: long hair behind head
  if (isMom) {
    ctx.fillStyle = "#4a2b1b";
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // side hair strands
    ctx.fillRect(x - 9, y - 18, 4, 14);
    ctx.fillRect(x + 5, y - 18, 4, 14);
  }

  // head
  ctx.fillStyle = "#8b5a3c";
  ctx.beginPath();
  ctx.arc(x, y - 18, headSize, 0, Math.PI * 2);
  ctx.fill();

  // DAD: bald, so no extra hair
  // CHILD: smaller body

  if (isMom) {
    // dress
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 11, y + 12);
    ctx.lineTo(x + 11, y + 12);
    ctx.closePath();
    ctx.fill();

    // legs
    ctx.fillStyle = "#2d2730";
    ctx.fillRect(x - 5, y + 12, 4, 9);
    ctx.fillRect(x + 1, y + 12, 4, 9);
  } else if (isDad) {
    // taller rectangle body
    ctx.fillStyle = shirt;
    ctx.fillRect(x - 7, y - 10, 14, 19);

    ctx.fillStyle = "#2d2730";
    ctx.fillRect(x - 5, y + 9, 4, 11);
    ctx.fillRect(x + 1, y + 9, 4, 11);
  } else {
    // short child
    ctx.fillStyle = shirt;
    ctx.fillRect(x - 6, y - 10, 12, 14);

    ctx.fillStyle = "#2d2730";
    ctx.fillRect(x - 4, y + 4, 3, 8);
    ctx.fillRect(x + 1, y + 4, 3, 8);
  }

  // arms
  ctx.strokeStyle = shirt;
  ctx.lineWidth = 3;
  ctx.beginPath();

  if (state.mode === "cheer") {
    ctx.moveTo(x - 5, y - 4);
    ctx.lineTo(x - 13, y - 18);
    ctx.moveTo(x + 5, y - 4);
    ctx.lineTo(x + 13, y - 18);
  } else {
    ctx.moveTo(x - 5, y - 3);
    ctx.lineTo(x - 13, y + 4);
    ctx.moveTo(x + 5, y - 3);
    ctx.lineTo(x + 13, y + 4);
  }

  ctx.stroke();
  ctx.restore();
}

        const rise = state.family.rise || 0;
        const baseX = state.family.baseX || W / 2;

        state.family.mom.x = baseX - 30;
state.family.mom.y = GROUND_Y - 20 - rise;

state.family.dad.x = baseX + 2;
state.family.dad.y = GROUND_Y - 18 - rise;

state.family.child.x = baseX + 31;
state.family.child.y = GROUND_Y - 12 - rise;

        drawHiddenFamilyMember(state.family.mom, "mom");
        drawHiddenFamilyMember(state.family.dad, "dad");
        drawHiddenFamilyMember(state.family.child, "child");
      }
           // center angel statue pedestal
      const ax = W / 2;
      const ay = GROUND_Y + 4;

      // faint moonlit glow behind statue
      const angelGlow = ctx.createRadialGradient(ax, ay - 82, 10, ax, ay - 82, 74);
      angelGlow.addColorStop(0, "rgba(210,225,255,.20)");
      angelGlow.addColorStop(0.45, "rgba(170,190,235,.10)");
      angelGlow.addColorStop(1, "rgba(170,190,235,0)");
      ctx.fillStyle = angelGlow;
      ctx.fillRect(ax - 90, ay - 160, 180, 170);

      // shadow behind statue
      ctx.fillStyle = "rgba(0,0,0,.20)";
      ctx.beginPath();
      ctx.ellipse(ax + 3, ay - 12, 44, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // pedestal
      ctx.fillStyle = "#4b515d";
      ctx.fillRect(ax - 40, ay - 50, 80, 40);
      ctx.fillStyle = "#626a76";
      ctx.fillRect(ax - 48, ay - 16, 96, 12);

      // angel wings first (bigger silhouette)
      ctx.fillStyle = "#88919d";
      ctx.beginPath();
      ctx.moveTo(ax - 14, ay - 84);
      ctx.quadraticCurveTo(ax - 58, ay - 114, ax - 66, ay - 74);
      ctx.quadraticCurveTo(ax - 56, ay - 50, ax - 18, ay - 56);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(ax + 14, ay - 84);
      ctx.quadraticCurveTo(ax + 58, ay - 114, ax + 66, ay - 74);
      ctx.quadraticCurveTo(ax + 56, ay - 50, ax + 18, ay - 56);
      ctx.closePath();
      ctx.fill();

      // head
      ctx.fillStyle = "#a8b1bc";
      ctx.beginPath();
      ctx.arc(ax, ay - 106, 12, 0, Math.PI * 2);
      ctx.fill();

      // torso
      ctx.fillRect(ax - 10, ay - 94, 20, 40);

      // robe / lower body
      ctx.beginPath();
      ctx.moveTo(ax - 18, ay - 54);
      ctx.lineTo(ax + 18, ay - 54);
      ctx.lineTo(ax + 12, ay - 18);
      ctx.lineTo(ax - 12, ay - 18);
      ctx.closePath();
      ctx.fill();

      // arms in prayer pose
      ctx.strokeStyle = "#c3cad2";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ax - 8, ay - 82);
      ctx.lineTo(ax - 2, ay - 66);
      ctx.lineTo(ax, ay - 58);
      ctx.lineTo(ax + 2, ay - 66);
      ctx.lineTo(ax + 8, ay - 82);
      ctx.stroke();

      // small base plaque
      ctx.fillStyle = "#2b2d31";
      ctx.fillRect(ax - 18, ay - 34, 36, 6);

     
      // solid ground
      const dirt = ctx.createLinearGradient(0, GROUND_Y + 12, 0, H);
      dirt.addColorStop(0, "#2f5d3f");
      dirt.addColorStop(0.18, "#264232");
      dirt.addColorStop(0.55, "#1f2523");
      dirt.addColorStop(1, "#17191d");
      ctx.fillStyle = dirt;
      ctx.fillRect(0, GROUND_Y + 8, W, H - (GROUND_Y + 8));

      // top grass lip
      ctx.fillStyle = "#447c4e";
      ctx.fillRect(0, GROUND_Y + 6, W, 10);

      ctx.strokeStyle = "rgba(20,35,22,.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 18);
      ctx.quadraticCurveTo(W * 0.24, GROUND_Y + 26, W * 0.5, GROUND_Y + 16);
      ctx.quadraticCurveTo(W * 0.74, GROUND_Y + 8, W, GROUND_Y + 20);
      ctx.stroke();

           return;
    }

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
        `if (!(window.__uvzuIsLocalGhost && window.__uvzuIsLocalGhost())) {
        drawUnicorn(player.x, player.y, player.face, false, player.ray > 0, player.giant > 0);
      } else {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#4b2670";
        ctx.lineWidth = 5;
        ctx.textAlign = "center";
        ctx.font = "900 34px system-ui, sans-serif";
        ctx.strokeText("YOU ARE NOW A GHOST", W / 2, H / 2 - 40);
        ctx.fillText("YOU ARE NOW A GHOST", W / 2, H / 2 - 40);

        ctx.font = "800 20px system-ui, sans-serif";
        ctx.lineWidth = 3;
        ctx.strokeText("Living Player Must Survive Level To Respawn", W / 2, H / 2 + 5);
        ctx.fillText("Living Player Must Survive Level To Respawn", W / 2, H / 2 + 5);

        ctx.textAlign = "left";
        ctx.restore();
      }

      if (window.__uvzuGetRemotePlayer) {
        const remote = window.__uvzuGetRemotePlayer();

        if (
          remote &&
          typeof remote.x === "number" &&
          typeof remote.y === "number" &&
          !remote.ghost &&
          !remote.dead
        ) {
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
      }

        if (
  state.family &&
  state.endingKind === "graveyardFamily" &&
  state.mode !== "npc"
) {
        function drawFamilyMember(p, type) {
  const x = p.x;
  const y = p.y - (p.hop || 0);

  const isMom = type === "mom";
  const isDad = type === "dad";
  const isChild = type === "child";

  const shirt = isMom ? "#ff7fa8" : isDad ? "#6ea8ff" : "#ffd86a";
  const headSize = isChild ? 7 : 8;

  ctx.save();

  // shadow
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath();
  ctx.ellipse(x, y + 20, isChild ? 9 : 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // MOM: long hair behind head
  if (isMom) {
    ctx.fillStyle = "#4a2b1b";
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // side hair strands
    ctx.fillRect(x - 9, y - 18, 4, 14);
    ctx.fillRect(x + 5, y - 18, 4, 14);
  }

  // head
  ctx.fillStyle = "#8b5a3c";
  ctx.beginPath();
  ctx.arc(x, y - 18, headSize, 0, Math.PI * 2);
  ctx.fill();

  if (isMom) {
    // dress
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 11, y + 12);
    ctx.lineTo(x + 11, y + 12);
    ctx.closePath();
    ctx.fill();

    // legs
    ctx.fillStyle = "#2d2730";
    ctx.fillRect(x - 5, y + 12, 4, 9);
    ctx.fillRect(x + 1, y + 12, 4, 9);
  } else if (isDad) {
    // bald dad
    ctx.fillStyle = shirt;
    ctx.fillRect(x - 7, y - 10, 14, 19);

    ctx.fillStyle = "#2d2730";
    ctx.fillRect(x - 5, y + 9, 4, 11);
    ctx.fillRect(x + 1, y + 9, 4, 11);
  } else {
    // short child
    ctx.fillStyle = shirt;
    ctx.fillRect(x - 6, y - 10, 12, 14);

    ctx.fillStyle = "#2d2730";
    ctx.fillRect(x - 4, y + 4, 3, 8);
    ctx.fillRect(x + 1, y + 4, 3, 8);
  }

  // arms
  ctx.strokeStyle = shirt;
  ctx.lineWidth = 3;
  ctx.beginPath();

  if (state.mode === "cheer") {
    ctx.moveTo(x - 5, y - 4);
    ctx.lineTo(x - 13, y - 18);
    ctx.moveTo(x + 5, y - 4);
    ctx.lineTo(x + 13, y - 18);
  } else {
    ctx.moveTo(x - 5, y - 3);
    ctx.lineTo(x - 13, y + 4);
    ctx.moveTo(x + 5, y - 3);
    ctx.lineTo(x + 13, y + 4);
  }

  ctx.stroke();
  ctx.restore();
}
        const rise = state.family.rise || 0;
        const baseX = state.family.baseX || W / 2;

      state.family.mom.x = baseX - 30;
state.family.dad.x = baseX + 2;
state.family.child.x = baseX + 31;

if (state.mode === "approach" || state.mode === "talk" || state.mode === "cheer") {
  state.family.mom.y = GROUND_Y - 4;
  state.family.dad.y = GROUND_Y - 2;
  state.family.child.y = GROUND_Y + 4;
} else {
  state.family.mom.y = GROUND_Y + 36 - rise;
  state.family.dad.y = GROUND_Y + 38 - rise;
  state.family.child.y = GROUND_Y + 43 - rise;
}
        drawFamilyMember(state.family.mom, "mom");
        drawFamilyMember(state.family.dad, "dad");
        drawFamilyMember(state.family.child, "child");

        if (state.mode === "talk") {
          const boxX = W / 2 - 290;
          const boxY = 70;
          const boxW = 580;
          const boxH = 95;

          ctx.save();

          ctx.fillStyle = "rgba(255,255,255,.94)";
          ctx.strokeStyle = "#4b2670";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 16);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#4b2670";
          ctx.font = "900 18px system-ui, sans-serif";
          ctx.fillText("Mom", boxX + 20, boxY + 28);

          ctx.fillStyle = "#1e1530";
          ctx.font = "800 17px system-ui, sans-serif";
          ctx.fillText("You saved us! I thought all of the unicorns", boxX + 20, boxY + 55);
          ctx.fillText("in the world had turned into those creepy eaters.", boxX + 20, boxY + 78);

          ctx.restore();
        }
      }

      if (player.webbedTimer > 0) {
        const pulse = 0.78 + Math.sin((player.webFlash || player.webbedTimer) * 14) * 0.12;

        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = "rgba(255,255,255,0.96)";
        ctx.lineWidth = 3;

        // main cocoon ring
        ctx.beginPath();
        ctx.ellipse(player.x, player.y - 20, 34, 40, 0, 0, Math.PI * 2);
        ctx.stroke();

        // horizontal strands
        ctx.beginPath();
        ctx.moveTo(player.x - 28, player.y - 42);
        ctx.lineTo(player.x + 28, player.y - 42);

        ctx.moveTo(player.x - 32, player.y - 26);
        ctx.lineTo(player.x + 32, player.y - 26);

        ctx.moveTo(player.x - 30, player.y - 10);
        ctx.lineTo(player.x + 30, player.y - 10);

        ctx.moveTo(player.x - 24, player.y + 6);
        ctx.lineTo(player.x + 24, player.y + 6);
        ctx.stroke();

        // vertical + diagonal strands
        ctx.beginPath();
        ctx.moveTo(player.x, player.y - 58);
        ctx.lineTo(player.x, player.y + 14);

        ctx.moveTo(player.x - 22, player.y - 50);
        ctx.lineTo(player.x + 22, player.y + 2);

        ctx.moveTo(player.x + 22, player.y - 50);
        ctx.lineTo(player.x - 22, player.y + 2);

        ctx.moveTo(player.x - 30, player.y - 30);
        ctx.lineTo(player.x + 30, player.y - 18);

        ctx.moveTo(player.x + 30, player.y - 30);
        ctx.lineTo(player.x - 30, player.y - 18);
        ctx.stroke();

        // top knot / extra webbing
        ctx.beginPath();
        ctx.arc(player.x, player.y - 60, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = "900 18px system-ui, sans-serif";
        ctx.fillText("WEBBED!", player.x - 38, player.y - 74);

        ctx.restore();
      }
          
      if (state.endingKind === "graveyardFamily" && state.mode === "talk") {
        const boxX = W / 2 - 290;
        const boxY = 70;
        const boxW = 580;
        const boxH = 105;

        ctx.save();

        ctx.fillStyle = "rgba(255,255,255,.96)";
        ctx.strokeStyle = "#4b2670";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#4b2670";
        ctx.font = "900 18px system-ui, sans-serif";
        ctx.fillText("Mom", boxX + 20, boxY + 28);

        ctx.fillStyle = "#1e1530";
        ctx.font = "800 17px system-ui, sans-serif";
        ctx.fillText("You saved us! I thought all of the unicorns", boxX + 20, boxY + 58);
        ctx.fillText("in the world had turned into those creepy eaters.", boxX + 20, boxY + 82);

        ctx.restore();

        return;
      }
      if (window.__uvzuLevelTheme === "graveyard") {
        ctx.save();

        function frontFog(cx, cy, rx, ry, alpha) {
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
          g.addColorStop(0, "rgba(230,235,245," + alpha + ")");
          g.addColorStop(0.55, "rgba(230,235,245," + (alpha * 0.55) + ")");
          g.addColorStop(1, "rgba(230,235,245,0)");
          ctx.fillStyle = g;

          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        frontFog(W * 0.22, GROUND_Y + 22, 180, 42, 0.10);
        frontFog(W * 0.52, GROUND_Y + 28, 220, 50, 0.12);
        frontFog(W * 0.82, GROUND_Y + 24, 170, 40, 0.09);

        ctx.restore();
      }`
      );
            code = code.replace(
`  function drawShots() {
    for (const b of state.playerShots) {`,
`  function drawShots() {
    if (window.__uvzuGuestShotFlashes) {
      const now = Date.now();
      window.__uvzuGuestShotFlashes = window.__uvzuGuestShotFlashes.filter((flash) => flash.until > now);

      for (const flash of window.__uvzuGuestShotFlashes) {
        ctx.save();
        ctx.globalAlpha = Math.max(0.15, (flash.until - now) / 180);
        ctx.strokeStyle = "#66d9ff";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(flash.x1, flash.y1);
        ctx.lineTo(flash.x2, flash.y2);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(flash.x1, flash.y1);
        ctx.lineTo(flash.x2, flash.y2);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const b of state.playerShots) {`
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

      if (
        (window.__uvzuIsMultiplayerHost && window.__uvzuIsMultiplayerHost()) ||
        (window.__uvzuIsMultiplayerGuest && window.__uvzuIsMultiplayerGuest())
      ) {
        player.lives = 5;
        updateHud();
      }
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
