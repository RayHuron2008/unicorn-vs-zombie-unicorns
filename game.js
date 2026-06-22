(() => {
  "use strict";

  // Move the D-pad and A/B buttons higher on the screen.
  // Change 24vh higher/lower if needed.
  function raiseControls() {
    const style = document.createElement("style");
    style.textContent = `
      #controls {
        bottom: clamp(50px, 13vh, 100px) !important;
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", raiseControls);
  } else {
    raiseControls();
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
      "Could not load old-style game code.\n\n" +
      String(err && err.stack ? err.stack : err);
    document.body.appendChild(box);
  }

  fetch(OLD_STYLE_GAME_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch old game.js: " + response.status);
      }
      return response.text();
    })
    .then((code) => {
      // Restore the old game style, but make it easier.
      code = code.replace(
        "const MAX_ENEMIES = 4;",
        "const MAX_ENEMIES = 2;"
      );

      const run = new Function(code + "\n//# sourceURL=old-style-game-v44.js");
      run();
    })
    .catch(showLoadError);
})();