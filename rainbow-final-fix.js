// Permanent Rainbow final-wave fix, version 1. Keep this file in the game.
// Independent of Tester Mode: no lives settings, tester buttons, or storage.
// Load before game.js and call __uvzuInstallRainbowFinalFix after the levels.
(() => {
  window.__uvzuInstallRainbowFinalFix = function(code) {
    function once(before, after) {
      if (code.split(before).length !== 2) {
        throw new Error("Rainbow final-wave hook missing: " + before.slice(0, 80));
      }
      code = code.replace(before, () => after);
    }

    // Losing a spare life must not delete the final zombies and count as a win.
    once('  function safeLifeReset() {\n    state.resetQueued = false;',
      '  function safeLifeReset() {\n' +
      '    if (window.__uvzuCurrentLevelCode === "RNBW1" && state.mode === "final") {\n' +
      '      state.resetQueued = false;\n' +
      '      state.playerShots.length = state.enemyShots.length = state.particles.length = 0;\n' +
      '      resetPlayerPosition();\n' +
      '      for (const enemy of state.enemies) enemy.shootTimer = Math.max(enemy.shootTimer || 0, 1);\n' +
      '      return;\n' +
      '    }\n' +
      '    state.resetQueued = false;');

    // Guests wait for the host's ending signal, rather than a briefly empty
    // local enemy list between shared snapshots.
    const authority = '(window.__uvzuCurrentLevelCode !== "RNBW1" || !window.__uvzuIsMultiplayerGuest?.())';
    once('      state.finalSpawned >= FINAL_RAY_COUNT &&\n      state.enemies.length === 0',
      '      state.finalSpawned >= FINAL_RAY_COUNT &&\n      state.enemies.length === 0 &&\n      ' + authority);
    once('      if (state.finalSpawned >= FINAL_RAY_COUNT && state.enemies.length === 0) {',
      '      if (state.finalSpawned >= FINAL_RAY_COUNT && state.enemies.length === 0 && ' + authority + ') {');

    return code;
  };
})();
