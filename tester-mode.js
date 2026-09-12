// Temporary Tester Mode, version 2. No permanent gameplay fixes live here.
// The Rainbow final-wave fix is kept separately in rainbow-final-fix.js.
// To remove Tester Mode later, remove its script tag from index.html and reload.
// Its installer call in game.js is optional, so this file can then be deleted.
// Load before game.js, then call __uvzuInstallTester after the level installers.
(() => {
  function testerRuntime() {
    const storageKey = "uvzu-tester-lives-v1";
    let choice = "";
    try {
      const saved = window.sessionStorage?.getItem(storageKey);
      if (saved === "on" || saved === "off") choice = saved;
    } catch (_) {}

    // Ordinary lives apply until the tester is first used. Thereafter the
    // selected budget also applies to retries, new levels, and tomb rewards.
    window.__uvzuTesterLifeBudget = normal => choice ? (choice === "on" ? 99 : 1) : normal;

    const style = document.createElement("style");
    style.textContent = `
      #hud { flex-wrap: wrap; }
      #testerLivesToggle {
        flex-shrink: 0;
        align-self: center;
        padding: 7px 8px;
        border: 2px solid #adb8c7;
        border-radius: 9px;
        background: rgba(23, 30, 44, .94);
        color: #fff;
        font: 800 11px system-ui, sans-serif;
        line-height: 1.2;
        white-space: nowrap;
        touch-action: manipulation;
        pointer-events: auto;
        cursor: pointer;
      }
      #testerLivesToggle[aria-pressed="true"] {
        background: #285b43;
        border-color: #91e5af;
      }
      #testerLivesToggle:disabled { opacity: .5; cursor: default; }
      #testerLivesToggle:focus-visible { outline: 3px solid #ffe590; outline-offset: 2px; }
    `;
    document.head.appendChild(style);
    const button = document.createElement("button");
    button.id = "testerLivesToggle";
    button.type = "button";
    button.title = "Turn on to set 99 lives. Turn off to set 1 life.";
    document.getElementById("hud").appendChild(button);

    function refresh() {
      const status = window.__uvzuGetCatcherStatus?.();
      button.textContent = choice === "on" ? "TESTER: ON" : "TESTER: OFF";
      button.setAttribute("aria-pressed", String(choice === "on"));
      button.disabled = player.lives <= 0 || !!window.__uvzuIsLocalGhost?.() || !!status?.terminal;
      button.hidden = !gameStarted;
    }

    function toggle(event) {
      event?.preventDefault();
      event?.stopPropagation();
      refresh();
      if (button.disabled) return;
      choice = choice === "on" ? "off" : "on";
      try { window.sessionStorage?.setItem(storageKey, choice); } catch (_) {}
      player.lives = window.__uvzuTesterLifeBudget(player.lives);
      // Changing a tester setting is not a respawn or an escape from a trap.
      window.__uvzuSyncTesterLives?.();
      updateHud();
      window.__uvzuMultiplayerPush?.(player);
      button.blur();
    }
    button.addEventListener("click", toggle);
    for (const type of ["pointerdown", "pointerup", "keydown", "keyup"]) {
      button.addEventListener(type, event => event.stopPropagation());
    }

    const previousHud = updateHud;
    updateHud = function() { previousHud(); refresh(); };
    const previousStart = window.__uvzuStartGame;
    window.__uvzuStartGame = function(...args) {
      const result = previousStart(...args);
      refresh();
      return result;
    };
    refresh();
  }

  window.__uvzuInstallTester = function(code) {
    function once(before, after) {
      if (code.split(before).length !== 2) throw new Error("Tester hook missing: " + before.slice(0, 80));
      code = code.replace(before, () => after);
    }

    // Let HUNT6 distinguish a manual lives toggle from an actual life loss.
    once('    window.__uvzuGetCatcherState = () => active() ? hunt : null;',
      '    window.__uvzuSyncTesterLives = () => { oldLives = player.lives; };\n' +
      '    window.__uvzuGetCatcherState = () => active() ? hunt : null;');

    const lifeAssignments = /player\.lives = (3|5|99);/g;
    if ((code.match(lifeAssignments) || []).length !== 6) throw new Error("Tester life-reset hooks changed");
    code = code.replace(lifeAssignments, (_, normal) => 'player.lives = window.__uvzuTesterLifeBudget(' + normal + ');');
    once('player.lives = Math.max(player.lives, 99);',
      'player.lives = window.__uvzuTesterLifeBudget(Math.max(player.lives, 99));');

    // The boot variables and every existing level wrapper are initialized here.
    once('  requestAnimationFrame(loop);\n})();',
      '  requestAnimationFrame(loop);\n(' + testerRuntime.toString() + ')();\n})();');
    return code;
  };
})();
