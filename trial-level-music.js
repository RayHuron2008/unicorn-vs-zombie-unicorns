(() => {
  // Optional soundtrack trial. Load this after ice-level.js and before game.js.
  // Removing its script tag restores the previous music settings for these levels.
  function trialLevelMusicRuntime() {
    const songs = {
      FRST5: { src: "./forest-storm-trial.mp3?v=3", volume: .45 },
      HUNT6: { src: "./catchers-chase-trial.mp3?v=3", volume: .45 },
      LAVA8: { src: "./volcanic-badlands-trial.mp3?v=3", volume: .45 },
      ICE10: { src: "./frozen-kingdom-trial.mp3?v=3", volume: .45 }
    };
    const tracks = new Map();
    let enabled = true, pageHidden = false;
    let previousCode = window.__uvzuCurrentLevelCode;
    const currentSong = () => songs[window.__uvzuCurrentLevelCode];
    function lost() {
      switch (window.__uvzuCurrentLevelCode) {
        case "HUNT6": return window.__uvzuGetCatcherState?.()?.phase === "lost";
        case "LAVA8": return window.__uvzuGetVolcanoState?.()?.phase === "lost";
        case "ICE10": return window.__uvzuGetIceState?.()?.phase === "lost";
        default: return false;
      }
    }
    const wanted = item => enabled && currentSong()?.src === item.src &&
      gameStarted && !paused && !document.hidden && !pageHidden && !lost();
    function stop(item, reset = false) {
      if (!item.audio.paused || item.pending) item.audio.pause();
      if (reset && item.audio.currentTime !== 0) {
        try { item.audio.currentTime = 0; } catch (_) {}
      }
    }
    function sync(retry = false) {
      const song = currentSong();
      for (const item of tracks.values()) {
        if (!wanted(item)) stop(item, item.src !== song?.src);
      }
      if (!song || !enabled || !gameStarted || paused || document.hidden || pageHidden || lost()) return;
      window.__uvzuStopMainMusic?.();
      window.stopTombMusic?.();
      let item = tracks.get(song.src);
      if (!item) {
        const audio = new Audio(song.src);
        audio.loop = true;
        audio.volume = song.volume;
        audio.preload = "auto";
        item = { src: song.src, audio, pending: false, blocked: false };
        tracks.set(song.src, item);
      }
      // Leave room for the on-screen dialogue during the Catchers introduction.
      item.audio.volume = window.__uvzuGetCatcherState?.()?.phase === "intro" ? .30 : song.volume;
      if (!item.audio.paused || item.pending || item.blocked && !retry) return;
      item.pending = true;
      item.blocked = false;
      try {
        Promise.resolve(item.audio.play()).then(() => {
          item.pending = false;
          if (!wanted(item)) stop(item, item.src !== currentSong()?.src);
        }, () => { item.pending = false; item.blocked = true; });
      } catch (_) { item.pending = false; item.blocked = true; }
    }
    // A quick audition switch is also available from the browser console.
    window.__uvzuSetTrialMusicEnabled = value => { enabled = !!value; sync(true); };
    const previousMusic = startMusic;
    startMusic = function(...args) { const result = previousMusic(...args); sync(true); return result; };
    const previousLevelMusic = window.__uvzuUpdateLevelMusic;
    window.__uvzuUpdateLevelMusic = function(...args) {
      const result = previousLevelMusic?.(...args); sync(true); return result;
    };
    window.__uvzuStartMainMusic = startMusic;
    const previousStart = window.__uvzuStartGame;
    window.__uvzuStartGame = function(...args) {
      const result = previousStart(...args); sync(true); return result;
    };
    const previousPause = window.__uvzuSetPaused;
    window.__uvzuSetPaused = function(value) { previousPause(value); sync(true); };
    const previousRestart = fullRestart;
    fullRestart = function(...args) {
      for (const item of tracks.values()) stop(item, true);
      const result = previousRestart(...args); sync(true); return result;
    };
    const previousUpdate = update;
    update = function(dt) {
      const result = previousUpdate(dt);
      if (previousCode !== window.__uvzuCurrentLevelCode) {
        previousCode = window.__uvzuCurrentLevelCode;
        previousLevelMusic?.(); sync(true);
      } else sync();
      return result;
    };
    for (const name of ["pointerdown", "keydown"]) {
      window.addEventListener(name, () => sync(true));
    }
    document.addEventListener?.("visibilitychange", () => sync(true));
    window.addEventListener("pagehide", () => {
      pageHidden = true;
      for (const item of tracks.values()) stop(item);
    });
    window.addEventListener("pageshow", () => { pageHidden = false; sync(true); });
  }
  const installIce = window.__uvzuInstallIce;
  if (typeof installIce !== "function") {
    console.warn("Trial music needs ice-level.js to load first.");
    return;
  }
  window.__uvzuInstallIce = function(code) {
    code = installIce(code);
    const hook = "  requestAnimationFrame(loop);\n})();";
    if (code.split(hook).length !== 2) {
      console.warn("Trial music could not attach; the game will keep its previous soundtrack.");
      return code;
    }
    return code.replace(hook, () => "(" + trialLevelMusicRuntime.toString() + ")();\n" + hook);
  };
})();
