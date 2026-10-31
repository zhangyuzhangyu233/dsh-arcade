/**
 * The runner simulation.
 *
 * Endless food run: the maid auto-runs and the player jumps through floating
 * food (bowl 10 / onigiri 15 / sushi 20). Ground obstacles are intentionally
 * removed for now while the icon-based obstacle set is being drawn, so the run
 * has no fail state: close the panel to end the session, and the best score is
 * persisted on teardown.
 *
 * A rare Super Star–style power-up may appear once per run: eating it makes the
 * runner invincible for ten seconds (roughly the Super Mario star's duration).
 * With the monsters still on the drawing board the state is visual-only for
 * now; the "创飞" hook lands where the hazard collision will live.
 */
import { ASSETS } from './generated/assets.js';
import { POWERUPS as POWERUP_ASSETS } from './generated/powerups.js';
import { phaseStore, readBest, writeBest } from './state.js';
import { GROUND_OFFSET, PANEL_HEIGHT, RUNNER_H, RUNNER_X } from './styles.js';

export const BASE_SPEED = 330;      // px / s
/** Speed readout calibration: the HUD shows 20 km/h at the start and ramps up
 *  to MAX_KMH at the top speed. The world speed itself is unchanged; only the
 *  displayed scale is re-anchored so the top speed reads 200 km/h. */
export const BASE_KMH = 20;
export const MAX_KMH = 200;
const MAX_SPEED = 1000;
export function speedKmh(pxPerSecond) {
  const t = Math.min(1, Math.max(0, (pxPerSecond - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)));
  return BASE_KMH + (MAX_KMH - BASE_KMH) * t;
}
const SPEED_GROWTH = 7.7;           // px / s²
const GRAVITY = 2600;               // px / s²
const JUMP_V = 680;                 // px / s  (air time 0.52 s, apex 89 px)
const AIR_TIME = (2 * JUMP_V) / GRAVITY;
const DISTANCE_PER_POINT = 20;
const MAX_LEVEL_SECONDS = 85;
const MIN_FRAME_TIME = 1 / 60;      // display cap: never advance faster than 60fps

/** Every pickup mixes two placements: some sit on the ground (height 0), the
 *  rest float at the item's air height. `groundChance` biases the mix per item
 *  and `AIR_STREAK_LIMIT` guarantees the ground option always comes back. */
export const FOODS = {
  apple:      { points: 0,   drawH: 34, height: 86,  groundChance: 0.55, buff: 'speed' },
  bowl:       { points: 10,  drawH: 32, height: 86,  groundChance: 0.5 },
  onigiri:    { points: 15,  drawH: 36, height: 112, groundChance: 0.45 },
  sushi:      { points: 20,  drawH: 28, height: 140, groundChance: 0.35 },
  ramen:      { points: 25,  drawH: 40, height: 140, groundChance: 0.3 },
  omurice:    { points: 30,  drawH: 38, height: 140, groundChance: 0.3 },
  cake_slice: { points: 20,  drawH: 38, height: 100, groundChance: 0.45, buff: 'double' },
  ice_cream:  { points: 20,  drawH: 40, height: 112, groundChance: 0.45, buff: 'magnet' },
  sundae:     { points: 20,  drawH: 40, height: 100, groundChance: 0.45, buff: 'shield' },
  // Currency pickups are spawned by their own patterns, not by the food pool.
  coin:       { points: 5,   drawH: 28, height: 60,  groundChance: 0.5, coin: true },
  banknote:   { points: 200, drawH: 30, height: 70,  groundChance: 0.5, banknote: true },
};

/** After this many floating spawns in a row the next one is forced onto the
 *  ground, so a run can never end up with an all-air stretch. */
const AIR_STREAK_LIMIT = 3;

/** Super Star–style power-up. Every run rolls once at reset; a hit means one
 *  star shows up at a random moment and grants ten seconds of invincibility.
 *  The duration mirrors the Super Mario star; one constant to retune it. */
export const STAR = { seconds: 10, chance: 0.55, drawH: 44, height: 110, groundChance: 0.5 };

/** Timed buffs. `speed` / `slow` scale the world speed; `double` doubles every
 *  point earned; `magnet` pulls nearby food in. `shield` is separate because it
 *  is permanent until it breaks. */
export const BUFFS = {
  speed: { label: '加速', seconds: 4, speedScale: 1.3 },
  double: { label: '双倍', seconds: 6 },
  magnet: { label: '磁铁', seconds: 6 },
  slow: { label: '缓速', seconds: 5, speedScale: 0.72 },
};
export const SHIELD_LABEL = '护盾';

/** Spawn weights [start-of-run, max-level]. Rice stays the backbone; buff items
 *  stay rare because each one hands out a treat. Values are normalised at roll
 *  time, so they don't have to add up to 100. */
const FOOD_WEIGHTS = {
  bowl:       [40, 26],
  apple:      [3, 2.5],
  onigiri:    [16, 14],
  sushi:      [9, 11],
  ramen:      [5, 7],
  omurice:    [3, 6],
  cake_slice: [0.4, 0.7],
  ice_cream:  [0.4, 0.7],
  sundae:     [0.4, 0.7],
};

/** Duck/slide pose. Holding ↓/S on the ground drops the hitbox low and swaps
 *  the runner to the static slide art; holding it in the air fast-falls and
 *  then slides on landing. A short minimum keeps a quick tap from flickering. */
const SLIDE_MIN_TIME = 0.12;   // s
const SLIDE_FASTFALL = 2.4;    // gravity multiplier while holding down in air

/** Hanging bamboo obstacles: the only way through is to duck (↓/S) under them.
 *  They spawn at the top edge and leave HAZARD_GAP px between the tip and the
 *  ground: a standing hitbox collides, a crouched one slips through. */
const HAZARD_GAP = 50;             // px between the bamboo tip and the ground line
const HAZARD_FIRST = 6;            // seconds of calm before the first one
const HAZARD_SMASH_POINTS = 50;    // reward for plowing through it while invincible

/** Coin trails: standing/air patterns, plus a bonus for clearing the whole
 *  trail without missing one. */
const COIN_GROUP_SIZE = [5, 8];
const COIN_SPACING = 46;
const COIN_GROUP_BONUS = 40;

/** Ground hazards. Spikes: jump over. Pits: jump over or fall in. */
const SPIKE_FIRST = 9;
const SPIKE_SMASH_POINTS = 40;
const PIT_FIRST = 12;

/** One icon size rule for every scoring pickup: the longest side is always
 *  PICKUP_ICON_MAX CSS px. Light/dark share the same baked box, so the icon is
 *  exactly the same size in both themes. */
export const PICKUP_ICON_MAX = 40;

/** Claude Code crab: a stompable little enemy. Land on its shell for points,
 *  plow into it while invincible for a smaller smash reward; touching it on
 *  foot otherwise ends the run. */
const CRAB = {
  first: 14,          // s before the first crab
  gapMin: 10,         // s between crabs when none is on screen
  gapMax: 16,
  drawH: 46,          // CSS px; both theme SVGs share the 24x24 viewBox
  walk: 90,           // extra px/s towards the runner, on top of world speed
  stompPoints: 100,
  smashPoints: 80,
};

/** Level-intro choreography: the road unrolls left -> right, then the maid
 *  starts running. CSS owns the road/HUD reveal; the engine only gates input
 *  and the spawners until the animation has finished. */
const INTRO_TOTAL = 0.62;          // s: 60ms delay + 420ms sweep + ~140ms settle

const frameCache = { light: null, dark: null };
function framesFor(scheme) {
  if (!frameCache[scheme]) {
    frameCache[scheme] = ASSETS.maid[scheme].frames.map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
  }
  return frameCache[scheme];
}

export function levelAt(seconds) {
  return Math.min(1, Math.max(0, seconds / MAX_LEVEL_SECONDS));
}

export function pickFoodType(level) {
  const t = Math.min(1, Math.max(0, level));
  const weights = {};
  let total = 0;
  for (const [id, [start, late]] of Object.entries(FOOD_WEIGHTS)) {
    const weight = start + (late - start) * t;
    weights[id] = weight;
    total += weight;
  }
  let roll = Math.random() * total;
  for (const [id, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return 'bowl';
}

export class Engine {
  constructor(dom, callbacks) {
    this.dom = dom;
    this.callbacks = callbacks || {};
    this.scheme = 'dark';
    this.phase = 'running';
    this.raf = 0;
    this.elapsed = 0;
    this.distance = 0;
    this.speed = BASE_SPEED;
    this.bonus = 0;
    this.score = 0;
    this.collected = 0;
    this.best = readBest();
    this.foods = [];
    this.stars = [];
    this.buffs = { speed: 0, double: 0, magnet: 0, slow: 0 };
    this.shield = false;
    this.airStreak = 0;
    this.hazards = [];
    this.hazardTimer = HAZARD_FIRST;
    this.coinTimer = 1.6;
    this.banknoteTimer = 18 + Math.random() * 12;
    this.spikeTimer = SPIKE_FIRST;
    this.pitTimer = PIT_FIRST;
    this.crabTimer = CRAB.first;
    this.pits = [];
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.distancePoints = 0;
    this.invincible = false;
    this.invincibleUntil = 0;
    this.starPlanned = false;
    this.starAt = 0;
    this.sliding = false;
    this.downHeld = false;
    this.slideStarted = 0;
    this.slideSize = null;
    this.spawnIn = BASE_SPEED * 0.85;
    this.runnerY = 0;
    this.vy = 0;
    this.jumpHeld = false;
    this.frameIndex = 0;
    this.frameClock = 0;
    this.last = 0;
    this.paused = false;
    this.stageW = Math.max(320, dom.stage.clientWidth || 672);
    this.stageH = Math.max(180, dom.stage.clientHeight || PANEL_HEIGHT);
    this.lastScorePaint = 0;
    this.lastPowerPaint = 0;
    this.resize = () => {
      this.stageW = Math.max(320, this.dom.stage.clientWidth || this.stageW);
      this.stageH = Math.max(180, this.dom.stage.clientHeight || this.stageH);
    };
    this.onVisibility = () => { if (document.hidden) this.pause(); else this.resume(); };
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(this.resize) : null;
    if (this.observer) this.observer.observe(dom.stage);
    this.applyScheme(this.scheme);
    this.reset();
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.callbacks.intro && !reduceMotion) this.startIntro();
    this.start();
  }

  /* -- lifecycle ---------------------------------------------------- */
  reset() {
    this.phase = 'running';
    this.elapsed = 0;
    this.lastScorePaint = 0;
    this.lastPowerPaint = 0;
    this.distance = 0;
    this.speed = BASE_SPEED;
    this.bonus = 0;
    this.score = 0;
    this.collected = 0;
    this.runnerY = 0;
    this.vy = 0;
    this.jumpHeld = false;
    this.spawnIn = BASE_SPEED * 0.85;
    this.frameIndex = 0;
    this.frameClock = 0;
    this.dom.root.dataset.srPhase = 'running';
    for (const item of this.foods) item.el.remove();
    this.foods.length = 0;
    this.dom.foods.replaceChildren();
    for (const item of this.stars) item.el.remove();
    this.stars.length = 0;
    if (this.dom.stars) this.dom.stars.replaceChildren();
    this.dom.pops.replaceChildren();
    if (this.dom.obstacles) this.dom.obstacles.replaceChildren();
    if (this.dom.hazards) this.dom.hazards.replaceChildren();
    if (this.dom.pits) this.dom.pits.replaceChildren();
    this.invincible = false;
    this.invincibleUntil = 0;
    this.buffs = { speed: 0, double: 0, magnet: 0, slow: 0 };
    this.shield = false;
    this.airStreak = 0;
    this.hazards = [];
    this.hazardTimer = HAZARD_FIRST;
    this.coinTimer = 1.6;
    this.banknoteTimer = 18 + Math.random() * 12;
    this.spikeTimer = SPIKE_FIRST;
    this.pitTimer = PIT_FIRST;
    this.crabTimer = CRAB.first;
    this.pits = [];
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.distancePoints = 0;
    this.dom.root.dataset.srInvincible = '0';
    this.dom.root.dataset.srPower = '0';
    if (this.dom.power) this.dom.power.textContent = '';
    // One star may show up per run; rerolling here means restart re-rolls too.
    this.starPlanned = Math.random() < STAR.chance;
    this.starAt = 8 + Math.random() * 14;
    this.sliding = false;
    this.downHeld = false;
    this.slideStarted = 0;
    this.slideSize = null;
    if (this.dom.runner) {
      this.dom.runner.style.height = '';
      this.dom.runner.style.width = '';
      if (this.items && this.items[0]) this.dom.runner.src = this.items[0].src;
    }
    this.paintScore(true);
    phaseStore.set('running');
    if (this.callbacks.onPhase) this.callbacks.onPhase('running');
  }

  restart() {
    this.reset();
    this.last = performance.now();
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      if (!this.paused) {
        if (this.phase === 'running') this.update(dt);
        else if (this.phase === 'intro') this.updateIntro(dt);
      }
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Road-reveal intro: no input, no spawning; CSS animates the ground. */
  startIntro() {
    this.phase = 'intro';
    this.introElapsed = 0;
    this.dom.root.dataset.srPhase = 'intro';
    this.dom.root.dataset.srIntro = '1';
    this.frameIndex = 0;
    this.frameClock = 0;
    if (this.dom.runner && this.items && this.items[0]) this.dom.runner.src = this.items[0].src;
    if (this.callbacks.onPhase) this.callbacks.onPhase('intro');
  }

  updateIntro(dt) {
    this.introElapsed += dt;
    if (this.introElapsed < INTRO_TOTAL) return;
    delete this.dom.root.dataset.srIntro;
    this.phase = 'running';
    this.dom.root.dataset.srPhase = 'running';
    this.elapsed = 0;
    this.lastScorePaint = 0;
    this.lastPowerPaint = 0;
    this.frameClock = 0;
    this.frameIndex = 0;
    if (this.callbacks.onPhase) this.callbacks.onPhase('running');
  }

  pause() { this.paused = true; }
  resume() { if (!this.paused) return; this.paused = false; this.last = performance.now(); }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.observer) this.observer.disconnect();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.dom.obstacles) this.dom.obstacles.replaceChildren();
    this.dom.foods.replaceChildren();
    if (this.dom.stars) this.dom.stars.replaceChildren();
    if (this.dom.hazards) this.dom.hazards.replaceChildren();
    if (this.dom.pits) this.dom.pits.replaceChildren();
    this.dom.pops.replaceChildren();
    this.stars.length = 0;
    this.hazards.length = 0;
    this.pits.length = 0;
    // Without a collision end condition the panel close IS the end of the run.
    if (this.score > this.best) { this.best = this.score; writeBest(this.best); }
  }

  /* -- input -------------------------------------------------------- */
  jump() {
    if (this.phase === 'over') { this.restart(); return; }
    if (this.phase !== 'running') return;
    if (this.sliding) this.endSlide();
    // Coyote time: a jump pressed just after leaving the ground still works.
    // A jump pressed in the air is buffered and fires on landing.
    const grounded = this.runnerY <= 0.5 || this.elapsed <= this.coyoteUntil;
    if (!grounded) {
      this.jumpBufferUntil = this.elapsed + 0.12;
      return;
    }
    this.vy = JUMP_V;
    this.runnerY = 0.01;
    this.jumpHeld = true;
  }

  release() {
    this.jumpHeld = false;
    if (this.vy > 220) this.vy = 220; // short hop when the key is tapped
  }

  /** Hold ↓/S: slide on the ground, fast-fall + slide when airborne. */
  slide() {
    if (this.phase !== 'running') return;
    this.downHeld = true;
    if (this.runnerY > 0.5) return; // the landing in update() starts the slide
    this.startSlide();
  }

  releaseSlide() {
    this.downHeld = false;
  }

  startSlide() {
    if (this.sliding || this.phase !== 'running') return;
    this.sliding = true;
    this.slideStarted = this.elapsed;
    this.setPose('slide');
  }

  endSlide() {
    if (!this.sliding) return;
    this.sliding = false;
    this.setPose('run');
  }

  /** Swap between the run animation and the static slide pose. The slide art is
   *  scaled so the character keeps the same on-screen size as the run frames. */
  setPose(pose) {
    const runner = this.dom.runner;
    if (!runner) return;
    const maid = ASSETS.maid[this.scheme];
    if (pose === 'slide') {
      const slide = maid.slide;
      const h = RUNNER_H * slide.height / maid.height;
      const w = h * slide.width / slide.height;
      this.slideSize = { w, h };
      runner.src = slide.src;
      runner.style.height = `${h.toFixed(1)}px`;
      runner.style.width = `${w.toFixed(1)}px`;
    } else {
      this.slideSize = null;
      runner.style.height = '';
      runner.style.width = '';
      const frame = this.items[this.frameIndex >= 0 ? this.frameIndex : 0];
      if (frame) runner.src = frame.src;
    }
  }

  /* -- simulation --------------------------------------------------- */
  update(dt) {
    this.elapsed += dt;
    const baseSpeed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_GROWTH * this.elapsed);
    let speedScale = 1;
    if ((this.buffs.slow || 0) > this.elapsed) speedScale *= BUFFS.slow.speedScale;
    if ((this.buffs.speed || 0) > this.elapsed) speedScale *= BUFFS.speed.speedScale;
    this.speed = baseSpeed * speedScale;
    this.distance += this.speed * dt;

    // Jump physics: lighter gravity while jump is held on the way up, heavier
    // gravity while ↓/S is held in the air (fast-fall into the slide).
    if (this.runnerY > 0 || this.vy !== 0) {
      let gravity = GRAVITY * (this.jumpHeld && this.vy > 0 ? 0.82 : 1);
      if (this.downHeld && this.runnerY > 0) gravity *= SLIDE_FASTFALL;
      this.vy -= gravity * dt;
      this.runnerY += this.vy * dt;
      if (this.runnerY <= 0) {
        this.runnerY = 0;
        this.vy = 0;
        this.coyoteUntil = this.elapsed + 0.08;
        if (this.downHeld) {
          this.startSlide();
        } else if (this.jumpBufferUntil > this.elapsed) {
          // Buffered jump: the player pressed jump just before landing.
          this.jumpBufferUntil = 0;
          this.vy = JUMP_V;
          this.runnerY = 0.01;
          this.jumpHeld = true;
        }
      }
    } else {
      this.coyoteUntil = this.elapsed + 0.08;
    }

    // Run cycle: play the GIF's native frame timing, sped up in step with the
    // world speed so the feet keep pace. The current art is the 1.25x export
    // (16 frames x 20ms = 320ms per stride at base speed).
    if (!this.sliding) {
      const speedScale = BASE_SPEED / this.speed;
      this.frameClock += dt;
      for (let guard = 0; guard < 8; guard += 1) {
        const current = this.frameIndex >= 0 ? this.frameIndex : 0;
        const nativeMs = this.frameTimes && this.frameTimes[current] ? this.frameTimes[current] : 20;
        const frameTime = Math.max(MIN_FRAME_TIME, (nativeMs / 1000) * speedScale);
        if (this.frameClock < frameTime) break;
        this.frameClock -= frameTime;
        this.frameIndex = (current + 1) % this.items.length;
        if (this.dom.runner && this.items[this.frameIndex]) this.dom.runner.src = this.items[this.frameIndex].src;
      }
    }

    const groundY = this.stageH - GROUND_OFFSET;
    // Cache the two runner boxes once per frame; collisions/magnet reuse them.
    const runner = this.runnerBox(groundY);
    const hazardRunner = this.runnerHazardBox(groundY);
    for (const item of this.foods) item.x -= this.speed * dt;
    for (const item of this.stars) item.x -= this.speed * dt;
    for (const item of this.hazards) item.x -= (this.speed + (item.extraSpeed || 0)) * dt;
    for (const pit of this.pits) pit.x -= this.speed * dt;
    if ((this.buffs.magnet || 0) > this.elapsed) this.magnetFoods(dt, groundY, runner);
    this.distancePoints += (this.speed * dt / DISTANCE_PER_POINT) * this.scoreMultiplier();
    this.score = Math.floor(this.distancePoints + this.bonus);

    this.spawnIn -= this.speed * dt;
    if (this.spawnIn <= 0) this.spawn();
    if (this.starPlanned && this.elapsed >= this.starAt) {
      this.starPlanned = false;
      this.spawnStar();
    }

    // Hanging bamboo: keep at most two on screen, then reset the countdown.
    this.hazardTimer -= dt;
    if (this.hazardTimer <= 0) {
      const placed = this.bambooCount() < 2 && this.spawnHazard();
      this.hazardTimer = placed ? this.nextHazardGap() : 0.5;
    }

    // Coin trails are the most frequent pickup; the banknote is rare. Neither
    // may spawn next to a trap.
    const pickupZoneClear = () => !this.trapNear(this.stageW - 100, 320, 110);
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) {
      if (pickupZoneClear()) {
        this.spawnCoinGroup();
        this.coinTimer = 1.6 + Math.random() * 1.4;
      } else {
        this.coinTimer = 0.5;
      }
    }
    this.banknoteTimer -= dt;
    if (this.banknoteTimer <= 0) {
      if (pickupZoneClear() && this.spawnBanknote()) {
        this.banknoteTimer = 22 + Math.random() * 16;
      } else {
        this.banknoteTimer = 0.8;
      }
    }

    // Ground spikes: jump over them.
    this.spikeTimer -= dt;
    if (this.spikeTimer <= 0) {
      const placed = this.spikeCount() < 2 && this.spawnSpikeGroup();
      this.spikeTimer = placed ? (5.6 - 2 * levelAt(this.elapsed)) * (0.8 + Math.random() * 0.5) : 0.5;
    }

    // Ground pits: jump over or fall in.
    this.pitTimer -= dt;
    if (this.pitTimer <= 0) {
      const placed = this.pits.length < 2 && this.spawnPit();
      this.pitTimer = placed ? (13 - 5 * levelAt(this.elapsed)) * (0.8 + Math.random() * 0.5) : 0.5;
    }

    // Claude Code crab: at most one on screen; stomp it for points.
    this.crabTimer -= dt;
    if (this.crabTimer <= 0) {
      const placed = this.crabCount() < 1 && this.spawnCrab();
      this.crabTimer = placed
        ? CRAB.gapMin + Math.random() * (CRAB.gapMax - CRAB.gapMin)
        : 1;
    }

    this.collectFoods(groundY, runner);
    this.collectStars(groundY, runner);
    this.updateHazards(groundY, hazardRunner);
    if (this.pitHit(groundY, runner)) this.gameOver('掉进坑里了！');
    this.cull();
    if (this.sliding && !this.downHeld && this.elapsed - this.slideStarted >= SLIDE_MIN_TIME) {
      this.endSlide();
    }
    if (this.invincible && this.elapsed >= this.invincibleUntil) this.setInvincible(false);
    // The HUD countdown only needs ~10 updates a second, not 60.
    if (this.elapsed - this.lastPowerPaint > 0.1) {
      this.paintPower();
      this.lastPowerPaint = this.elapsed;
    }
    if (this.elapsed - this.lastScorePaint > 0.12) this.paintScore(false);
  }

  spawn() {
    const level = levelAt(this.elapsed);
    const startX = this.stageW + 40;

    // Never drop scoring pickups next to a trap.
    if (this.trapNear(this.stageW - 100, 300, 90)) {
      this.spawnIn = this.nextGap(level);
      return;
    }

    // Food-only cadence for now: keep the old slot rhythm (one food per slot
    // plus an occasional second bowl) so the run still feels the same once the
    // icon obstacles return.
    this.spawnFood(startX, level);
    if (Math.random() < 0.35) {
      this.spawnFood(startX + 130 + Math.round(Math.random() * 60), level, 'bowl');
    }

    this.spawnIn = this.nextGap(level);
  }

  /** Different scoring pickups never overlap: nudge a new spawn to the right
   *  until it clears every existing food and star. */
  freePickupX(x, w, gap = 4) {
    let candidate = x;
    for (let guard = 0; guard < 16; guard += 1) {
      let edge = candidate;
      for (const item of this.foods) {
        if (item.x < candidate + w + gap && item.x + item.w > candidate - gap) {
          edge = Math.max(edge, item.x + item.w + gap);
        }
      }
      for (const star of this.stars) {
        if (star.x < candidate + w + gap && star.x + star.w > candidate - gap) {
          edge = Math.max(edge, star.x + star.w + gap);
        }
      }
      if (edge === candidate) return candidate;
      candidate = edge;
    }
    return candidate;
  }

  spawnFood(centerX, level, forced, opts = {}) {
    const type = forced || pickFoodType(level);
    const def = FOODS[type];
    const asset = ASSETS.foods[type][this.scheme];
    // Longest side fixed at PICKUP_ICON_MAX for every pickup, so icons read as
    // one consistent size; the shared baked box makes light/dark identical.
    const ratio = asset.w / asset.h;
    const h = ratio >= 1 ? Math.max(16, Math.round(PICKUP_ICON_MAX / ratio)) : PICKUP_ICON_MAX;
    const w = ratio >= 1 ? PICKUP_ICON_MAX : Math.max(16, Math.round(PICKUP_ICON_MAX * ratio));
    const img = document.createElement('img');
    img.className = 'sr-food';
    img.alt = '';
    img.draggable = false;
    img.src = asset.src;
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    // Mixed placement: ground pickups are picked up by running through them,
    // floating ones need a jump. The streak guard keeps the ground option alive.
    let height;
    if (opts.height !== undefined) {
      height = opts.height;
    } else {
      const airHeight = def.height || 0;
      const onGround = airHeight === 0 ||
        Math.random() < (def.groundChance ?? 0.45) ||
        this.airStreak >= AIR_STREAK_LIMIT;
      height = onGround ? 0 : airHeight;
      this.airStreak = onGround ? 0 : this.airStreak + 1;
    }
    img.style.bottom = `${GROUND_OFFSET + height}px`;
    const x = this.freePickupX(centerX - w / 2, w);
    img.style.transform = `translate3d(${x}px,0,0)`;
    this.dom.foods.appendChild(img);
    this.foods.push({
      el: img,
      x,
      w,
      h,
      height,
      type,
      points: opts.points ?? def.points,
      group: opts.group || null,
    });
    return this.foods[this.foods.length - 1];
  }

  /* -- trap / pickup spacing helpers --------------------------------- */
  /** True when [x, x+w] sits within `buffer` of any hazard or pit. */
  trapNear(x, w, buffer = 0) {
    for (const hazard of this.hazards) {
      if (hazard.x < x + w + buffer && hazard.x + hazard.w > x - buffer) return true;
    }
    for (const pit of this.pits) {
      if (pit.x < x + w + buffer && pit.x + pit.w > x - buffer) return true;
    }
    return false;
  }

  /** Scoring pickups may not sit next to a trap: clear the ones already in the
   *  blast radius when a trap is placed. */
  clearPickupsNear(x, w, buffer) {
    for (let i = this.foods.length - 1; i >= 0; i -= 1) {
      const item = this.foods[i];
      if (item.x < x + w + buffer && item.x + item.w > x - buffer) {
        item.el.remove();
        this.foods.splice(i, 1);
      }
    }
  }

  /* -- coin trails & whale banknote ---------------------------------- */
  spawnCoinGroup() {
    const level = levelAt(this.elapsed);
    const count = COIN_GROUP_SIZE[0] + Math.floor(Math.random() * (COIN_GROUP_SIZE[1] - COIN_GROUP_SIZE[0] + 1));
    const group = { total: count, collected: 0, done: false };
    const startX = this.stageW + 40;
    const pattern = Math.random();
    for (let i = 0; i < count; i += 1) {
      let height = 0;
      if (pattern < 0.35) {
        // jump arc, mirrors the jump profile (apex ~89px)
        height = Math.round(Math.sin(((i + 1) / (count + 1)) * Math.PI) * (60 + 30 * level));
      } else if (pattern < 0.6) {
        height = 52; // mid-air line, needs a hop
      }
      this.spawnFood(startX + i * COIN_SPACING, level, 'coin', { height, group });
    }
  }

  spawnBanknote() {
    const level = levelAt(this.elapsed);
    if (this.trapNear(this.stageW - 100, 300, 90)) return false;
    this.spawnFood(this.stageW + 40, level, 'banknote', { height: 24 });
    return true;
  }

  /** Banknote: turn every nearby pickup and on-screen hazard into a double-value
   *  food, which is what makes the 200-point note worth going for. */
  applyBanknote() {
    const groundY = this.stageH - GROUND_OFFSET;
    const runner = this.runnerBox(groundY);
    const types = ['omurice', 'ramen', 'sushi'];
    let converted = 0;
    const golden = (el) => {
      if (!el.classList) return;
      el.classList.add('sr-golden');
      setTimeout(() => el.classList.remove('sr-golden'), 900);
    };
    for (const item of [...this.foods]) {
      if (item.type === 'banknote') continue;
      if (item.x + item.w < runner.left - 40) continue;
      const type = types[Math.floor(Math.random() * types.length)];
      const def = FOODS[type];
      const asset = ASSETS.foods[type][this.scheme];
      const center = item.x + item.w / 2;
      item.type = type;
      item.h = def.drawH;
      item.w = Math.max(22, Math.round(def.drawH * asset.w / asset.h));
      item.points = def.points * 2;
      item.x = center - item.w / 2;
      item.el.src = asset.src;
      item.el.style.width = `${item.w}px`;
      item.el.style.height = `${item.h}px`;
      golden(item.el);
      converted += 1;
    }
    for (const hazard of [...this.hazards]) {
      const center = hazard.x + hazard.w / 2;
      this.removeHazard(hazard);
      const type = types[Math.floor(Math.random() * types.length)];
      const item = this.spawnFood(center, levelAt(this.elapsed), type, { height: 0 });
      item.points = 60;
      golden(item.el);
      converted += 1;
    }
    if (converted > 0) {
      this.popText(runner.left + 140, GROUND_OFFSET + 96, `美食化 ×${converted}`);
    }
  }

  removeHazard(hazard) {
    const index = this.hazards.indexOf(hazard);
    if (index >= 0) this.hazards.splice(index, 1);
    hazard.el.remove();
  }

  spawnSpikeGroup() {
    const level = levelAt(this.elapsed);
    const asset = ASSETS.obstacles.spike[this.scheme];
    const h = 44;
    const spikeW = Math.max(14, Math.round(h * asset.w / asset.h));
    // Spikes always come as a group (2-4), packed edge to edge with no gaps.
    const count = 2 + Math.floor(Math.random() * 3);
    const totalW = spikeW * count - (count - 1) * 2;
    // Passability guard: stay well inside one jump's horizontal coverage.
    const jumpCover = this.speed * AIR_TIME;
    if (totalW > Math.min(160, jumpCover * 0.7)) return false;
    const x = this.stageW + 40;
    if (this.trapNear(x, totalW, 150)) return false;
    const el = document.createElement('div');
    el.className = 'sr-hazard sr-spikes';
    el.style.width = `${totalW}px`;
    el.style.height = `${h}px`;
    // Pin the group to the ground explicitly, independent of the stylesheet.
    el.style.top = 'auto';
    el.style.bottom = `${GROUND_OFFSET}px`;
    const imgs = [];
    for (let i = 0; i < count; i += 1) {
      const img = document.createElement('img');
      img.className = 'sr-spike';
      img.alt = '';
      img.draggable = false;
      img.src = asset.src;
      img.style.width = `${spikeW}px`;
      img.style.height = `${h}px`;
      img.style.left = `${i * (spikeW - 2)}px`;
      el.appendChild(img);
      imgs.push(img);
    }
    el.style.transform = `translate3d(${x}px,0,0)`;
    if (this.dom.hazards) this.dom.hazards.appendChild(el);
    this.hazards.push({ el, imgs, x, w: totalW, h, type: 'spike' });
    // No scoring pickups in the danger zone.
    this.clearPickupsNear(x, totalW, 110);
    return true;
  }

  spawnPit() {
    const w = 70 + Math.round(Math.random() * 45);
    const x = this.stageW + 40;
    if (this.trapNear(x, w, 150)) return false;
    const el = document.createElement('div');
    el.className = 'sr-pit';
    el.style.width = `${w}px`;
    el.style.transform = `translate3d(${x}px,0,0)`;
    if (this.dom.pits) this.dom.pits.appendChild(el);
    this.pits.push({ el, x, w });
    this.clearPickupsNear(x, w, 110);
    return true;
  }

  pitHit(groundY, runner = this.runnerBox(groundY)) {
    if (!this.pits.length) return null;
    for (const pit of this.pits) {
      if (runner.right > pit.x + 6 && runner.left < pit.x + pit.w - 6) {
        // Going over a pit requires being airborne; sliding doesn't save you.
        if (this.runnerY < 8 && !this.invincible) return pit;
      }
    }
    return null;
  }

  /** Claude Code crab: a stompable enemy that walks a little faster than the
   *  world so the player has to meet it in the air. */
  spawnCrab() {
    const asset = POWERUP_ASSETS.crab[this.scheme];
    const h = CRAB.drawH;
    const w = Math.max(30, Math.round(h * asset.w / asset.h));
    const x = this.stageW + 40;
    if (this.trapNear(x, w, 140)) return false;
    const el = document.createElement('div');
    el.className = 'sr-hazard sr-crab';
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.top = 'auto';
    el.style.bottom = `${GROUND_OFFSET}px`;
    const img = document.createElement('img');
    img.className = 'sr-crab-icon';
    img.alt = '';
    img.draggable = false;
    img.src = asset.src;
    el.appendChild(img);
    el.style.transform = `translate3d(${x}px,0,0)`;
    if (this.dom.hazards) this.dom.hazards.appendChild(el);
    this.hazards.push({ el, img, x, w, h, type: 'crab', extraSpeed: CRAB.walk });
    this.clearPickupsNear(x, w, 90);
    return true;
  }

  /** The power-up is a wrapper (the engine owns its transform) around a spinning
   *  icon, so the CSS spin and the world scroll never fight over transform. */
  spawnStar() {
    const asset = POWERUP_ASSETS.claude[this.scheme];
    const h = STAR.drawH;
    const w = Math.round(h * asset.w / asset.h);
    const wrap = document.createElement('div');
    wrap.className = 'sr-star';
    const img = document.createElement('img');
    img.className = 'sr-star-icon';
    img.alt = '';
    img.draggable = false;
    img.src = asset.src;
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    wrap.appendChild(img);
    const onGround = Math.random() < (STAR.groundChance ?? 0.5);
    const height = onGround ? 0 : STAR.height;
    const x = this.stageW + 40;
    wrap.style.bottom = `${GROUND_OFFSET + height}px`;
    wrap.style.transform = `translate3d(${x}px,0,0)`;
    if (this.dom.stars) this.dom.stars.appendChild(wrap);
    this.stars.push({ el: wrap, img, x, w, h, height, type: 'claude' });
  }

  nextGap(level) {
    const level01 = Math.min(1, Math.max(0, level));
    // Keep at least one jump's worth of air between food slots, tightening the
    // window from ~1.25 to ~1.05 jump lengths as the run progresses.
    const jumpDistance = this.speed * AIR_TIME;
    const factor = (1.25 - 0.2 * level01) * (0.94 + Math.random() * 0.18);
    return Math.max(96, jumpDistance * factor + 46);
  }

  runnerBox(groundY) {
    const asset = ASSETS.maid[this.scheme];
    if (this.sliding) {
      // The slide art is flat and wide; only the lower half counts as the hitbox
      // so a slide can duck under things that would hit the running pose.
      const size = this.slideSize || { w: RUNNER_H, h: RUNNER_H };
      return {
        left: RUNNER_X + size.w * 0.04,
        right: RUNNER_X + size.w * 0.96,
        top: groundY - this.runnerY - size.h * 0.55,
        bottom: groundY - this.runnerY,
      };
    }
    const displayW = RUNNER_H * asset.width / asset.height;
    return {
      left: RUNNER_X + displayW * 0.16,
      right: RUNNER_X + displayW * 0.74,
      top: groundY - this.runnerY - RUNNER_H * 0.78,
      bottom: groundY - this.runnerY,
    };
  }

  /* -- hanging obstacles (bamboo, duck under it) --------------------- */
  nextHazardGap() {
    const level = levelAt(this.elapsed);
    return (4.4 - 1.8 * level) * (0.85 + Math.random() * 0.4);
  }

  /** Hanging bamboo; scaled so its tip floats HAZARD_GAP px above the ground. */
  spawnHazard(x = this.stageW + 40) {
    const asset = ASSETS.obstacles.bamboo[this.scheme];
    const height = Math.max(90, this.stageH - GROUND_OFFSET - HAZARD_GAP);
    const width = Math.max(40, Math.round(height * asset.w / asset.h));
    if (this.trapNear(x, width, 150)) return false;
    const el = document.createElement('div');
    el.className = 'sr-hazard';
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    const img = document.createElement('img');
    img.className = 'sr-hazard-icon';
    img.alt = '';
    img.draggable = false;
    img.src = asset.src;
    el.appendChild(img);
    el.style.transform = `translate3d(${x}px,0,0)`;
    if (this.dom.hazards) this.dom.hazards.appendChild(el);
    this.hazards.push({ el, img, x, w: width, h: height, type: 'bamboo' });
    // Keep scoring pickups away from the hazard.
    this.clearPickupsNear(x, width, 110);
    return true;
  }

  runnerHazardBox(groundY) {
    // Hazards use a tighter body-only box: the basin the maid carries in front
    // of her must not count as a hit. Sliding already has its own low box.
    if (this.sliding) return this.runnerBox(groundY);
    const asset = ASSETS.maid[this.scheme];
    const displayW = RUNNER_H * asset.width / asset.height;
    return {
      left: RUNNER_X + displayW * 0.2,
      right: RUNNER_X + displayW * 0.62,
      top: groundY - this.runnerY - RUNNER_H * 0.76,
      bottom: groundY - this.runnerY,
    };
  }

  bambooCount() {
    return this.hazards.reduce((n, h) => n + (h.type === 'bamboo' ? 1 : 0), 0);
  }

  spikeCount() {
    return this.hazards.reduce((n, h) => n + (h.type === 'spike' ? 1 : 0), 0);
  }

  crabCount() {
    return this.hazards.reduce((n, h) => n + (h.type === 'crab' ? 1 : 0), 0);
  }

  updateHazards(groundY, runner = this.runnerHazardBox(groundY)) {
    for (const item of [...this.hazards]) {
      if (item.type === 'bamboo') this.updateBamboo(item, runner);
      else if (item.type === 'spike') this.updateSpike(item, runner, groundY);
      else if (item.type === 'crab') this.updateCrab(item, runner, groundY);
    }
  }

  /** Bamboo blocks the runner: standing inside it marks the run blocked; if the
   *  cane scrolls fully past without a duck, the run ends. Ducking (↓/S) at any
   *  point while it passes clears the block. */
  updateBamboo(item, runner) {
    const caneLeft = item.x + item.w * 0.30;
    const caneRight = item.x + item.w * 0.46;
    const horizontal = runner.right > caneLeft && runner.left < caneRight;
    const vertical = runner.top < item.h - 2;
    if (horizontal && vertical) {
      if (this.invincible) {
        this.smashHazard(item, true);
        return;
      }
      if (this.shield) {
        this.breakShield();
        this.popText(item.x + item.w / 2, GROUND_OFFSET + 96, '护盾碎了！');
        this.smashHazard(item, false);
        return;
      }
      if (this.sliding) item.ducked = true;
      else item.blocked = true;
    } else if (horizontal && this.sliding) {
      item.ducked = true;
    }
    if (item.blocked && !item.ducked && caneRight < runner.left) {
      this.gameOver('被竹子绊倒了！');
    }
  }

  /** Ground spikes: only a real jump clears them; sliding does not. */
  updateSpike(item, runner, groundY) {
    const left = item.x + 2;
    const right = item.x + item.w - 2;
    const top = groundY - item.h + 2;
    if (runner.right > left && runner.left < right && runner.bottom > top) {
      if (this.invincible) {
        this.smashHazard(item, true);
        return;
      }
      if (this.shield) {
        this.breakShield();
        this.popText(item.x + item.w / 2, GROUND_OFFSET + 96, '护盾碎了！');
        this.smashHazard(item, false);
        return;
      }
      this.gameOver('踩到尖刺啦！');
    }
  }

  /** Crab enemy: landing on its shell bounces the runner and pays out; running
   *  into it on foot ends the run. Invincible plows give the smash reward. */
  updateCrab(item, runner, groundY) {
    if (runner.right <= item.x + 5 || runner.left >= item.x + item.w - 5) return;
    const feet = groundY - this.runnerY;
    const crabTop = groundY - item.h;
    if (feet <= crabTop + 2) return; // cleanly jumped over it
    if (this.invincible) {
      const gained = CRAB.smashPoints * this.scoreMultiplier();
      this.bonus += gained;
      this.popText(item.x + item.w / 2, GROUND_OFFSET + 100, `创飞 +${gained}`);
      this.smashHazard(item, false);
      return;
    }
    if (this.shield) {
      this.breakShield();
      this.popText(item.x + item.w / 2, GROUND_OFFSET + 96, '护盾碎了！');
      this.smashHazard(item, false);
      return;
    }
    // Stomp: falling onto the shell's top band.
    if (this.vy < 0 && feet <= crabTop + 20) {
      const gained = CRAB.stompPoints * this.scoreMultiplier();
      this.bonus += gained;
      this.popText(item.x + item.w / 2, GROUND_OFFSET + 100, `踩扁 +${gained}`);
      this.vy = 430;
      this.runnerY = Math.max(this.runnerY, 1);
      this.jumpHeld = false;
      this.smashHazard(item, false);
      return;
    }
    this.gameOver('撞到小螃蟹啦！');
  }

  smashHazard(item, reward) {
    const index = this.hazards.indexOf(item);
    if (index >= 0) this.hazards.splice(index, 1);
    if (item.el.classList) item.el.classList.add('sr-hazard-smashed');
    setTimeout(() => item.el.remove(), 520);
    if (!reward) return;
    const gained = HAZARD_SMASH_POINTS * this.scoreMultiplier();
    this.bonus += gained;
    this.popText(item.x + item.w / 2, GROUND_OFFSET + 96, `创飞 +${gained}`);
  }

  collectFoods(groundY, runner = this.runnerBox(groundY)) {
    for (let i = this.foods.length - 1; i >= 0; i -= 1) {
      const item = this.foods[i];
      const box = {
        left: item.x + item.w * 0.1,
        right: item.x + item.w * 0.9,
        top: groundY - item.height - item.h + item.h * 0.1,
        bottom: groundY - item.height - item.h * 0.1,
      };
      const hit = runner.left < box.right && runner.right > box.left &&
        runner.top < box.bottom && runner.bottom > box.top;
      if (!hit) continue;
      item.el.remove();
      this.foods.splice(i, 1);
      this.collected += 1;
      const def = FOODS[item.type] || {};
      const gained = item.points * this.scoreMultiplier();
      this.bonus += gained;
      const cx = item.x + item.w / 2;
      if (gained > 0) this.popPoints(cx, item.height + item.h + 8, gained);
      if (item.group) {
        item.group.collected += 1;
        if (item.group.collected === item.group.total && !item.group.done) {
          item.group.done = true;
          const groupBonus = COIN_GROUP_BONUS * this.scoreMultiplier();
          this.bonus += groupBonus;
          this.popText(cx, item.height + item.h + 32, `整组 +${groupBonus}`);
        }
      }
      if (def.banknote) this.applyBanknote();
      if (def.buff) this.collectBuff(def.buff, cx, item.height + item.h + (gained > 0 ? 28 : 8));
    }
  }

  /** `double` dessert: every point earned while it's up counts twice. */
  scoreMultiplier() {
    return (this.buffs.double || 0) > this.elapsed ? 2 : 1;
  }

  activateBuff(id) {
    if (id === 'shield') {
      this.shield = true;
      this.paintPower();
      return true;
    }
    const def = BUFFS[id];
    if (!def) return false;
    this.buffs[id] = Math.max(this.buffs[id] || 0, this.elapsed) + def.seconds;
    this.paintPower();
    return true;
  }

  breakShield() {
    if (!this.shield) return false;
    this.shield = false;
    this.paintPower();
    return true;
  }

  collectBuff(id, x, bottom) {
    const label = id === 'shield' ? SHIELD_LABEL : (BUFFS[id] && BUFFS[id].label);
    if (!label || !this.activateBuff(id)) return;
    this.popText(x, bottom, `${label}！`);
  }

  /** `magnet` dessert: pull nearby ground pickups in so the runner sweeps them
   *  up without precise alignment. */
  magnetFoods(dt, groundY, runner = this.runnerBox(groundY)) {
    if (!this.foods.length) return;
    const cx = (runner.left + runner.right) / 2;
    const torso = this.runnerY + RUNNER_H * 0.45;
    for (const item of this.foods) {
      const dx = item.x + item.w / 2 - cx;
      if (Math.abs(dx) > 210) continue;
      item.x -= Math.sign(dx) * Math.min(Math.abs(dx), 950 * dt);
      if (item.height > 0) {
        // Floating pickups get reeled down towards the runner as well.
        item.height = Math.max(0, item.height + (torso - item.height) * Math.min(1, 9 * dt));
        item.el.style.bottom = `${GROUND_OFFSET + item.height}px`;
      }
    }
  }

  collectStars(groundY, runner = this.runnerBox(groundY)) {
    if (!this.stars.length) return;
    for (let i = this.stars.length - 1; i >= 0; i -= 1) {
      const item = this.stars[i];
      const box = {
        left: item.x + item.w * 0.1,
        right: item.x + item.w * 0.9,
        top: groundY - item.height - item.h + item.h * 0.1,
        bottom: groundY - item.height - item.h * 0.1,
      };
      const hit = runner.left < box.right && runner.right > box.left &&
        runner.top < box.bottom && runner.bottom > box.top;
      if (!hit) continue;
      item.el.remove();
      this.stars.splice(i, 1);
      this.activateStar();
    }
  }

  /** Public so the preview harness / engine check can trigger it directly. */
  activateStar() {
    this.invincibleUntil = Math.max(this.invincibleUntil, this.elapsed) + STAR.seconds;
    this.setInvincible(true);
    const groundY = this.stageH - GROUND_OFFSET;
    const runner = this.runnerBox(groundY);
    this.popText((runner.left + runner.right) / 2, RUNNER_H + 24, '无敌！');
  }

  setInvincible(active) {
    this.invincible = Boolean(active);
    if (!this.invincible) this.invincibleUntil = 0;
    if (this.dom.root) this.dom.root.dataset.srInvincible = active ? '1' : '0';
    this.paintPower();
  }

  cull() {
    for (let i = this.foods.length - 1; i >= 0; i -= 1) {
      if (this.foods[i].x + this.foods[i].w < -80) {
        this.foods[i].el.remove();
        this.foods.splice(i, 1);
      }
    }
    for (let i = this.stars.length - 1; i >= 0; i -= 1) {
      if (this.stars[i].x + this.stars[i].w < -80) {
        this.stars[i].el.remove();
        this.stars.splice(i, 1);
      }
    }
    for (let i = this.hazards.length - 1; i >= 0; i -= 1) {
      if (this.hazards[i].x + this.hazards[i].w < -80) {
        this.hazards[i].el.remove();
        this.hazards.splice(i, 1);
      }
    }
    for (let i = this.pits.length - 1; i >= 0; i -= 1) {
      if (this.pits[i].x + this.pits[i].w < -80) {
        this.pits[i].el.remove();
        this.pits.splice(i, 1);
      }
    }
  }

  /* -- end of run --------------------------------------------------- *
   * A standing runner hits the hanging bamboo; ducking (slide) slips under.
   * Invincibility smashes it for points, and a shield absorbs one hit.
   */
  gameOver(title = '撞到啦！') {
    if (this.phase !== 'running') return;
    this.endSlide();
    this.phase = 'over';
    this.dom.root.dataset.srPhase = 'over';
    if (this.score > this.best) { this.best = this.score; writeBest(this.best); }
    this.paintScore(true);
    if (this.dom.shadeTitle) this.dom.shadeTitle.textContent = title;
    if (this.dom.shadeSub) this.dom.shadeSub.textContent = `得分 ${this.score} · 最高 ${this.best} · 空格 / 点击 再来一局`;
    phaseStore.set('over');
    if (this.callbacks.onPhase) this.callbacks.onPhase('over');
  }

  /* -- presentation ------------------------------------------------- */
  applyScheme(scheme) {
    this.scheme = scheme === 'light' ? 'light' : 'dark';
    this.items = framesFor(this.scheme);
    this.frameTimes = ASSETS.maid[this.scheme].frameMs || null;
    if (this.dom.runner) {
      if (this.sliding) {
        this.setPose('slide');
      } else {
        this.dom.runner.style.height = '';
        this.dom.runner.style.width = '';
        this.dom.runner.src = this.items[0].src;
      }
    }
    for (const item of this.foods) {
      const asset = ASSETS.foods[item.type][this.scheme];
      if (item.el) item.el.src = asset.src;
    }
    for (const item of this.stars) {
      const asset = POWERUP_ASSETS[item.type][this.scheme];
      if (item.img) item.img.src = asset.src;
    }
    for (const item of this.hazards) {
      const asset = item.type === 'crab'
        ? POWERUP_ASSETS.crab[this.scheme]
        : ASSETS.obstacles[item.type][this.scheme];
      if (item.img) item.img.src = asset.src;
      else if (item.imgs) {
        for (const img of item.imgs) img.src = asset.src;
      }
    }
    this.frameIndex = 0;
  }

  paintScore(force) {
    if (!this.dom.score) return;
    if (!force && String(this.score) === this.dom.score.textContent) { this.paintHint(); return; }
    this.dom.score.textContent = String(this.score);
    if (this.dom.best) this.dom.best.textContent = String(Math.max(this.best, this.score));
    this.paintHint();
    this.lastScorePaint = this.elapsed;
  }

  paintHint() {
    if (!this.dom.speed) return;
    this.dom.speed.textContent = `速度 ${Math.round(speedKmh(this.speed))} km/h`;
  }

  paintPower() {
    const parts = [];
    if (this.invincible) parts.push(`无敌 ${Math.max(0, this.invincibleUntil - this.elapsed).toFixed(1)}s`);
    if (this.shield) parts.push(SHIELD_LABEL);
    for (const [id, def] of Object.entries(BUFFS)) {
      const until = this.buffs[id] || 0;
      if (until > this.elapsed) parts.push(`${def.label} ${(until - this.elapsed).toFixed(1)}s`);
    }
    const active = parts.length > 0;
    if (this.dom.root) {
      // Only touch the DOM attributes when they actually change: paintPower runs
      // every frame, and this keeps the attribute writes off the hot path.
      const powerAttr = active ? '1' : '0';
      if (this.dom.root.dataset.srPower !== powerAttr) this.dom.root.dataset.srPower = powerAttr;
      const shieldAttr = this.shield ? '1' : '0';
      if (this.dom.root.dataset.srShield !== shieldAttr) this.dom.root.dataset.srShield = shieldAttr;
    }
    if (!this.dom.power) return;
    const text = parts.join(' · ');
    if (this.dom.power.textContent !== text) this.dom.power.textContent = text;
  }

  popPoints(x, bottom, points) {
    this.popText(x, bottom, `+${points}`);
  }

  popText(x, bottom, text) {
    const el = document.createElement('span');
    el.className = 'sr-pop';
    el.textContent = text;
    el.style.bottom = `${bottom}px`;
    el.style.transform = `translate3d(${x}px,0,0)`;
    this.dom.pops.appendChild(el);
    setTimeout(() => el.remove(), 760);
  }

  render() {
    if (!this.dom.runner || this.paused) return;
    for (const item of this.foods) item.el.style.transform = `translate3d(${item.x.toFixed(1)}px,0,0)`;
    for (const item of this.stars) item.el.style.transform = `translate3d(${item.x.toFixed(1)}px,0,0)`;
    for (const item of this.hazards) item.el.style.transform = `translate3d(${item.x.toFixed(1)}px,0,0)`;
    for (const pit of this.pits) pit.el.style.transform = `translate3d(${pit.x.toFixed(1)}px,0,0)`;
    this.dom.runner.style.transform = `translate3d(0,${(-this.runnerY).toFixed(1)}px,0)`;
    if (this.dom.ground) this.dom.ground.style.backgroundPositionX = `${(-this.distance % 26).toFixed(1)}px`;
  }
}
