     /* Unicorn vs. Zombie Game (version 22)
   Restores unicorn and zombie sprites and rainbow background; includes health bar and timers.
*/

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Canvas size can be adjusted here
canvas.width = 800;
canvas.height = 450;

// Paths to your asset files (put your actual filenames here)
const ASSETS = {
    background: "assets/background.png",
    player:     "assets/unicorn_pink.png",
    zombie:     "assets/zombie_green.png",
    zombieRay:  "assets/zombie_red.png",
    bolt:       "assets/bolt.png",      // graphic for unicorn ray blast
    healthBar:  null,                   // drawn in code; no image needed
    victory:    "assets/fireworks.png"  // optional victory animation
};

// Key input tracking
const input = { up: false, down: false, left: false, right: false, attack: false };

// Game state structure
const state = {
    running: true,
    timer: 0,
    score: 0,
    waveTimer: 0,
    enemies: [],
    bolts: [],
    zombiesKilled: 0,
    health: 3,
    hasRay: false,
    rayTimer: 0,
    levelEnded: false,
    victoryTimer: 0
};

// Store loaded images here
const images = {};

// Preload images and start game
async function loadAssets() {
    const names = Object.keys(ASSETS);
    await Promise.all(
        names.map(name => {
            const src = ASSETS[name];
            if (!src) return Promise.resolve();
            return new Promise(resolve => {
                const img = new Image();
                img.src = src;
                img.onload = () => {
                    images[name] = img;
                    resolve();
                };
            });
        })
    );
}

// Player and enemy constructors
function createPlayer() {
    return {
        x: canvas.width / 2 - 24,
        y: canvas.height - 100,
        w: 48,
        h: 48,
        vx: 0,
        vy: 0,
        speed: 2.5
    };
}

function createEnemy(type) {
    // type: 0 = green zombie, 1 = red zombie w/ ray
    const y = Math.random() * (canvas.height - 150) + 50;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side < 0 ? -50 : canvas.width + 50;
    const speed = 1.2 + Math.random() * 0.6;
    return {
        x, y,
        w: 48,
        h: 48,
        vx: side * speed,
        vy: 0,
        hp: type === 1 ? 2 : 1,
        hasRay: type === 1
    };
}

// Handle on-screen D-pad events for mobile
function setupDPad() {
    const btnUp    = document.getElementById("dpad-up");
    const btnDown  = document.getElementById("dpad-down");
    const btnLeft  = document.getElementById("dpad-left");
    const btnRight = document.getElementById("dpad-right");
    const btnAttack = document.getElementById("btnB");

    function start(direction) { input[direction] = true; }
    function stop(direction)  { input[direction] = false; }

    // For each button: start on touchstart / mousedown, stop on end
    [[btnUp, "up"], [btnDown, "down"], [btnLeft, "left"], [btnRight, "right"]].forEach(([btn, dir]) => {
        btn.addEventListener("touchstart", () => start(dir));
        btn.addEventListener("mousedown", () => start(dir));
        btn.addEventListener("touchend", () => stop(dir));
        btn.addEventListener("mouseup", () => stop(dir));
        btn.addEventListener("mouseleave", () => stop(dir));
    });
    btnAttack.addEventListener("touchstart", () => { input.attack = true; });
    btnAttack.addEventListener("touchend", () => { input.attack = false; });
    btnAttack.addEventListener("mousedown", () => { input.attack = true; });
    btnAttack.addEventListener("mouseup", () => { input.attack = false; });
}

// Update loop for game logic
function update(player, delta) {
    if (!state.running) return;

    // Update timers
    state.timer  += delta;
    state.rayTimer = Math.max(0, state.rayTimer - delta);
    if (state.rayTimer <= 0) {
        state.hasRay = false;
    }

    // End level after 5 minutes (300000 ms)
    if (!state.levelEnded && state.timer >= 300000) {
        state.levelEnded = true;
        state.victoryTimer = 0;
        state.enemies = [];
    }

    // Spawn waves every few seconds until level end
    if (!state.levelEnded) {
        state.waveTimer -= delta;
        if (state.waveTimer <= 0) {
            spawnWave();
            state.waveTimer = 6000; // 6 seconds between waves
        }
    }

    // Update player velocity based on input
    player.vx = 0;
    player.vy = 0;
    if (input.left)  player.vx = -player.speed;
    if (input.right) player.vx =  player.speed;
    if (input.up)    player.vy = -player.speed;
    if (input.down)  player.vy =  player.speed;
    // Restrict to canvas bounds
    player.x = Math.min(Math.max(0, player.x + player.vx), canvas.width - player.w);
    player.y = Math.min(Math.max(40, player.y + player.vy), canvas.height - player.h);

    // Fire ray or headbutt on attack
    if (input.attack) {
        if (state.hasRay) {
            fireBolt(player);
        } else {
            // headbutt is done by collision; no ranged attack
        }
        input.attack = false; // one shot per press
    }

    // Update bolts
    state.bolts = state.bolts.filter(b => {
        b.x += b.vx * delta;
        return b.x < canvas.width;
    });

    // Update enemies and handle collisions
    state.enemies.forEach(enemy => {
        enemy.x += enemy.vx * delta;
        // If enemy has ray, occasionally shoot
        if (enemy.hasRay && Math.random() < 0.005 * delta) {
            shootZombieRay(enemy);
        }
    });

    // Remove off-screen enemies
    state.enemies = state.enemies.filter(e => e.x > -100 && e.x < canvas.width + 100);

    // Ray bolt collisions with enemies
    state.bolts.forEach(bolt => {
        state.enemies.forEach(enemy => {
            if (rectsOverlap(bolt, enemy)) {
                enemy.hp--;
                bolt.x = canvas.width + 100; // remove bolt
                if (enemy.hp <= 0) {
                    enemy.x = canvas.width + 200; // remove enemy
                    state.score++;
                    state.zombiesKilled++;
                    if (enemy.hasRay) {
                        // gain ray gun from red zombie
                        state.hasRay = true;
                        state.rayTimer = 10000; // 10 seconds of ray
                    }
                }
            }
        });
    });

    // Player collides with enemy (headbutt)
    state.enemies.forEach(enemy => {
        if (rectsOverlap(player, enemy)) {
            // headbutt kills enemy unless it's ray zombie; player loses health
            if (enemy.hasRay) {
                state.health--;
            } else {
                state.score++;
                state.zombiesKilled++;
            }
            enemy.x = canvas.width + 200;
        }
    });

    // Player hit by zombie ray blasts (bullets)
    // We'll treat them as simple rectangles stored in state.bolts with a 'hostile' flag
    state.bolts.forEach(bolt => {
        if (bolt.hostile && rectsOverlap(bolt, player)) {
            state.health--;
            bolt.x = canvas.width + 100;
        }
    });

    // Check for game over
    if (state.health <= 0) {
        state.running = false;
    }

    // Handle victory animation after level ends
    if (state.levelEnded) {
        state.victoryTimer += delta;
        if (state.victoryTimer > 5000) {
            // After 5 seconds of celebration, stop running
            state.running = false;
        }
    }
}

// Render everything
function render(player) {
    // Draw background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);

    // Draw player
    ctx.drawImage(images.player, player.x, player.y, player.w, player.h);

    // Draw enemies
    state.enemies.forEach(enemy => {
        const sprite = enemy.hasRay ? images.zombieRay : images.zombie;
        ctx.drawImage(sprite, enemy.x, enemy.y, enemy.w, enemy.h);
    });

    // Draw bolts (player and zombie)
    state.bolts.forEach(b => {
        const sprite = b.hostile ? images.zombieRay : images.bolt;
        ctx.drawImage(sprite, b.x, b.y, b.w, b.h);
    });

    // HUD: Score, timer, health hearts
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(5, 5, 180, 50);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText(`Score: ${state.score}`, 10, 25);
    ctx.fillText(`Zombies: ${state.zombiesKilled}`, 10, 45);

    // Health hearts (simple rectangles)
    for (let i = 0; i < state.health; i++) {
        ctx.fillStyle = "pink";
        ctx.fillRect(200 + i * 25, 10, 20, 20);
        ctx.strokeStyle = "#000";
        ctx.strokeRect(200 + i * 25, 10, 20, 20);
    }

    // Ray gun indicator
    if (state.hasRay) {
        ctx.fillStyle = "lightblue";
        ctx.fillRect(200, 40, 100 * (state.rayTimer / 10000), 10);
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(200, 40, 100, 10);
    }

    // Victory message
    if (state.levelEnded) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = "28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("You killed all of the zombies here!", canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText("Thank you! I was so scared.", canvas.width / 2, canvas.height / 2 + 20);
        if (images.victory) {
            // draw small fireworks image if available
            ctx.drawImage(images.victory, canvas.width / 2 - 50, canvas.height / 2 + 40, 100, 100);
        }
    }

    // Game over overlay
    if (!state.running && !state.levelEnded) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = "28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
    }
}

// Spawn a wave of enemies (one or two standard, maybe a ray one)
function spawnWave() {
    const count = 3 + Math.floor(state.timer / 60000); // more enemies over time
    for (let i = 0; i < count; i++) {
        // Only spawn a ray zombie if none currently on screen
        const type = state.enemies.some(e => e.hasRay) ? 0 : (Math.random() < 0.3 ? 1 : 0);
        state.enemies.push(createEnemy(type));
    }
}

// Create a bolt from player
function fireBolt(player) {
    const bolt = {
        x: player.x + player.w,
        y: player.y + player.h / 2 - 8,
        w: 16,
        h: 16,
        vx: 5,
        vy: 0,
        hostile: false
    };
    state.bolts.push(bolt);
}

// Enemy fires a ray
function shootZombieRay(enemy) {
    const bolt = {
        x: enemy.x + enemy.w / 2 - 8,
        y: enemy.y + enemy.h / 2 - 8,
        w: 16,
        h: 16,
        vx: (state.player.x < enemy.x ? -4 : 4),
        vy: (state.player.y - enemy.y) / 60,
        hostile: true
    };
    state.bolts.push(bolt);
}

// Rectangle collision check
function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

// Main game loop
let last = 0;
function gameLoop(ts) {
    const delta = ts - last;
    last = ts;
    update(state.player, delta);
    render(state.player);
    requestAnimationFrame(gameLoop);
}

// Entry point
(async function() {
    await loadAssets();
    state.player = createPlayer();
    setupDPad();
    last = performance.now();
    requestAnimationFrame(gameLoop);
})(); 
