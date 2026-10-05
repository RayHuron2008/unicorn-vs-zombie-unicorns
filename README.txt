HALLOWEEN LEVEL 4 — LANTERN LANE
Level code: HALO4 (the letter O, then the number 4)

INSTALL
1. Extract Halloween-Level-4.zip.
2. Upload these FOUR files into your repository's main folder, alongside your
   other level files. Upload the extracted files, not the ZIP or its folder.

   ADD      halloween-level.js
   ADD      halloween-lantern-lane.mp3
   REPLACE  game.js
   REPLACE  index.html

3. Keep every other existing file, including the existing level and music files.
4. Once GitHub Pages finishes deploying, reload the game and enter HALO4.
   In multiplayer the host enters HALO4 before starting the room.
5. Say "Done" in the conversation so I can check the uploaded files.

No code copying, extra music edits, or separate image downloads are required.
README.txt is instructions only; it does not need to be uploaded.
The new level is entirely in its own file. game.js only changes the menu/code
registration, multiplayer fields, and installer hook. index.html loads the new
file and refreshes the game.js cache version to 126.

WHAT CHANGED
- Level 4 replaces the planned VHS idea. VHS3 is no longer a selectable code.
- Progression: CITY3 -> HALO4 -> FRST5. Level 7 remains unchanged.
- Moonlit neighborhood, pumpkins, decorations, and a warmly lit safe house.
- Eight children in witch, ghost, vampire, pumpkin, astronaut, pirate, cat, and
  robot costumes. They wander for candy, unaware the zombie unicorns are real.
- Walk up to carry one child; enter the glowing safe-house area to drop off.
  Rescued children remain safe at the house and cheer as their friends arrive.
- Keep the game's usual movement, headbutt, dodge, ray, and shield controls.
- Three children can be outside at once. More arrive throughout the round.
- Zombies attack for up to 60 seconds. The timer cannot award a premature win:
  all eight children must be safely home. Remaining rescues can finish afterward.
- Children have three protection points. If one is caught, retry the rescue.
  Losing a life drops a carried child with a brief protection/recovery window.
- Easy/Normal/Hard tuning and shared two-player rescues, retry, and progression.
- An eight-second homecoming finishes before continuing into the Forest.
- Original 66-second looping Game Boy-inspired chiptune: "Lantern Lane."
  It pauses with the game and stops on loss, page hiding, or level changes.
  If a phone blocks autoplay, tap a game control to retry audio playback.
- Existing unicorn and zombie artwork, music on other levels, headbutt animation,
  and the uploaded freeze fixes are preserved. No speech synthesis was added.
- No dependency on the temporary tester button.

LINE REFERENCES IN THESE DELIVERED FILES
  halloween-level.js line 5:   HALO4, eight children, sixty-second spawn period
  halloween-level.js line 6:   Halloween music filename
  halloween-level.js line 7:   child arrival schedule
  halloween-level.js line 9:   Easy/Normal/Hard tuning
  halloween-level.js line 28:  safe-house drop-off coordinates
  halloween-level.js line 208: pickup and delivery rules
  halloween-level.js line 483: stationary nighttime background
  halloween-level.js line 515: costumed child artwork
  halloween-level.js line 600: engine integration and level routing
  game.js line 360:            player rescue status for multiplayer
  game.js line 512:            shared Halloween state for multiplayer
  game.js line 1189:           multiplayer level-code registration
  game.js line 1580:           single-player level-code registration
  game.js line 6503:           Halloween installer call
  index.html line 232:         new level script
  index.html line 233:         updated game.js cache version

CHECKS
Built against main commit 7b608b4880ee728be9f8b988b40daed7fd85c293.
Parsed and executed the fully assembled game with and without tester-mode.js.
Automated solo/co-op tests covered pickup, contested pickup, delivery, shields,
life loss, passenger recovery, failure/retry, all-eight victory, and transitions.
Live-spawn simulated playthroughs succeeded on all three difficulties.
Rendered and inspected the actual Canvas art for start, carrying, attacks,
multiplayer, and victory. Audio was encoded, decoded, and checked for clipping.
All 70 existing freeze-regression scenarios passed, plus current spider, lake,
and ice/dragon-reset tests. This does not replace a live phone/two-device test.

ROLLBACK
The original files remain recoverable in GitHub history at the commit above.
Restore that commit's game.js and index.html to remove the Halloween integration.
Then the two added Halloween files can be removed if no longer wanted.
