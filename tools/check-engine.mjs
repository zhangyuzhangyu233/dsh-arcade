// Deterministic engine smoke check — no browser, no GUI, no screenshots.
//
//   node tools/check-engine.mjs
//
// Stubs just enough DOM for `src/engine.js`, then drives the simulation at a
// fixed 120 Hz and auto-jumps whenever a collectible is about to pass the
// runner. Asserts the things a visual check cannot: food spawns, food is
// collectable, the score/bonus move, the run keeps going (no fail state while
// the ground obstacles are parked), and the star power-up activates/expires.
import { ASSETS } from '../src/generated/assets.js';
import { POWERUPS as POWERUP_ASSETS } from '../src/generated/powerups.js';
import { BUFFS, Engine, FOODS, MAX_KMH, PICKUP_ICON_MAX, STAR, pickFoodType, speedKmh } from '../src/engine.js';
import { CSS, GROUND_OFFSET } from '../src/styles.js';

const stage = { clientWidth: 672, clientHeight: 236 };
const container = () => ({
  children: [],
  appendChild(el) { this.children.push(el); },
  replaceChildren() { this.children.length = 0; },
});
const el = () => ({ style: {}, dataset: {}, textContent: '', src: '', remove() {} });

const dom = {
  root: el(),
  stage,
  runner: el(),
  obstacles: container(),
  pits: container(),
  hazards: container(),
  foods: container(),
  stars: container(),
  pops: container(),
  ground: el(),
  score: el(),
  best: el(),
  speed: el(),
  power: el(),
  shadeTitle: el(),
  shadeSub: el(),
};

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.Image = class { constructor() { this.src = ''; } };
globalThis.document = {
  hidden: false,
  createElement: (tag) => ({
    ...el(),
    tagName: tag,
    className: '',
    alt: '',
    draggable: false,
    appendChild() {},
  }),
  addEventListener: () => {},
  removeEventListener: () => {},
};

const engine = new Engine(dom, {});
engine.paused = true; // manual stepping; the stubbed rAF never runs
// Mute every spawner on this engine: obstacle/currency behaviour gets its own
// dedicated engine below so the long food/buff test stays deterministic.
engine.hazardTimer = 1e9;
engine.spikeTimer = 1e9;
engine.pitTimer = 1e9;
engine.coinTimer = 1e9;
engine.banknoteTimer = 1e9;
engine.crabTimer = 1e9;

const step = 1 / 120;
const seconds = 20;
let jumps = 0;

for (let t = 0; t < seconds; t += step) {
  engine.update(step);
  if (engine.runnerY > 0.5) continue;
  const groundY = engine.stageH - GROUND_OFFSET;
  const runner = engine.runnerBox(groundY);
  const ahead = engine.foods
    .map((item) => ({ item, dx: item.x - runner.right }))
    .filter(({ dx }) => dx >= -10 && dx <= 70)
    .sort((a, b) => a.dx - b.dx)[0];
  if (ahead) { engine.jump(); jumps += 1; }
}

// -- star power-up -------------------------------------------------------
engine.starPlanned = false;
engine.stars.length = 0;
dom.stars.replaceChildren();
engine.setInvincible(false); // the timed run may already have grabbed a star
const starsBefore = engine.stars.length;
engine.spawnStar();
const spawned = engine.stars.length - starsBefore;
// Drop the spawned item again: otherwise the world scroll carries it into the
// runner mid-test and re-triggers invincibility while we are timing it out.
const spawnedStar = engine.stars.pop();
if (spawnedStar) spawnedStar.el.remove();
engine.activateStar();
const during = {
  invincible: engine.invincible,
  attr: dom.root.dataset.srInvincible,
  label: dom.power.textContent,
};
for (let t = 0; t < STAR.seconds + 0.25; t += step) engine.update(step);
const after = {
  invincible: engine.invincible,
  attr: dom.root.dataset.srInvincible,
  label: dom.power.textContent,
};

// -- duck/slide pose -----------------------------------------------------
engine.releaseSlide();
for (let t = 0; t < 0.2; t += step) engine.update(step);
const groundY = engine.stageH - GROUND_OFFSET;
const standingTop = engine.runnerBox(groundY).top;
engine.slide();
for (let t = 0; t < 0.05; t += step) engine.update(step);
const slideBox = engine.runnerBox(groundY);
const slideDuring = {
  sliding: engine.sliding,
  topDelta: Math.round(slideBox.top - standingTop),
  poseHeight: dom.runner.style.height,
  srcIsData: String(dom.runner.src).startsWith('data:image/'),
};
engine.releaseSlide();
for (let t = 0; t < 0.4; t += step) engine.update(step);
const slideAfter = {
  sliding: engine.sliding,
  poseHeight: dom.runner.style.height,
};

// -- run animation cadence (native 20 ms/frame at base speed) -----------
const dom2 = {
  root: el(),
  stage,
  runner: el(),
  obstacles: container(),
  pits: container(),
  hazards: container(),
  foods: container(),
  stars: container(),
  pops: container(),
  ground: el(),
  score: el(),
  best: el(),
  speed: el(),
  power: el(),
  shadeTitle: el(),
  shadeSub: el(),
};
const engine2 = new Engine(dom2, {});
engine2.paused = true;
let advances = 0;
let previous = engine2.frameIndex;
for (let t = 0; t < 0.34; t += step) {
  engine2.update(step);
  if (engine2.frameIndex !== previous) {
    advances += 1;
    previous = engine2.frameIndex;
  }
}
const cadence = {
  advances,
  nativeCycleMs: engine2.frameTimes.reduce((sum, ms) => sum + ms, 0),
  frames: engine2.items.length,
};
engine2.destroy();

// -- hazards, spikes, pits & currency (dedicated engine) ------------------
const dom3 = {
  root: el(),
  stage,
  runner: el(),
  obstacles: container(),
  pits: container(),
  hazards: container(),
  foods: container(),
  stars: container(),
  pops: container(),
  ground: el(),
  score: el(),
  best: el(),
  speed: el(),
  power: el(),
  shadeTitle: el(),
  shadeSub: el(),
};
const engine3 = new Engine(dom3, {});
engine3.paused = true;
const muteTimers = (engine) => {
  engine.hazardTimer = 1e9;
  engine.spikeTimer = 1e9;
  engine.pitTimer = 1e9;
  engine.coinTimer = 1e9;
  engine.banknoteTimer = 1e9;
  engine.crabTimer = 1e9;
  engine.spawnIn = 1e9;
};
const fresh = () => { engine3.restart(); muteTimers(engine3); };
const ground3 = engine3.stageH - GROUND_OFFSET;
const overlapX = () => engine3.runnerBox(ground3).left - 10;
const runFrames = (frames) => { for (let i = 0; i < frames; i += 1) engine3.update(1 / 120); };
const hazardArt = Boolean(ASSETS.obstacles && ASSETS.obstacles.bamboo && ASSETS.obstacles.spike &&
  ASSETS.obstacles.bamboo.light && ASSETS.obstacles.spike.dark);

// Bamboo blocks: standing until it scrolls past ends the run; ducking passes.
fresh();
engine3.spawnHazard(overlapX());
runFrames(120);
const standingCrash = engine3.phase === 'over' && /竹子/.test(dom3.shadeTitle.textContent);

fresh();
engine3.slide();
engine3.spawnHazard(overlapX());
runFrames(120);
const duckPasses = engine3.phase === 'running';
engine3.releaseSlide();

fresh();
engine3.activateStar();
const bonusBeforeSmash = engine3.bonus;
engine3.spawnHazard(overlapX());
engine3.update(0.001);
const starSmashes = engine3.phase === 'running' && engine3.bambooCount() === 0 && engine3.bonus > bonusBeforeSmash;

fresh();
engine3.activateBuff('shield');
engine3.spawnHazard(overlapX());
engine3.update(0.001);
const shieldAbsorbs = engine3.phase === 'running' && engine3.shield === false && engine3.bambooCount() === 0;

fresh();
engine3.spawnHazard(0);
const basinHazard = engine3.hazards[engine3.hazards.length - 1];
const bodyBox = engine3.runnerHazardBox(ground3);
const visualBox = engine3.runnerBox(ground3);
basinHazard.x = bodyBox.right + 4 - basinHazard.w * 0.30;
basinHazard.el.style.transform = `translate3d(${basinHazard.x}px,0,0)`;
engine3.update(0.001);
const basinIgnored = engine3.phase === 'running' && basinHazard.x < visualBox.right;

fresh();
engine3.spawnHazard(overlapX());
engine3.update(0.001);
const autoSpawns = engine3.bambooCount() >= 1;

// Spikes: touching them on foot ends the run, jumping clears them.
fresh();
engine3.spawnSpikeGroup();
let spike = engine3.hazards[engine3.hazards.length - 1];
const spikeGrounded = spike.el.style.bottom === `${GROUND_OFFSET}px` && spike.el.style.top === 'auto';
const spikeGrouped = spike.imgs.length >= 2; // spikes always come in groups
spike.x = engine3.runnerHazardBox(ground3).left - 2;
spike.el.style.transform = `translate3d(${spike.x}px,0,0)`;
engine3.update(0.001);
const spikeKills = engine3.phase === 'over' && /尖刺/.test(dom3.shadeTitle.textContent);

fresh();
engine3.runnerY = 60;
engine3.vy = 0;
engine3.spawnSpikeGroup();
spike = engine3.hazards[engine3.hazards.length - 1];
spike.x = engine3.runnerHazardBox(ground3).left - 2;
spike.el.style.transform = `translate3d(${spike.x}px,0,0)`;
engine3.update(0.001);
const spikeJumpClears = engine3.phase === 'running';

// Trap neighbourhoods: no scoring pickups around a trap, and two traps cannot
// be stacked right on top of each other.
fresh();
engine3.spawnFood(engine3.stageW + 20, 0.2, 'bowl');
engine3.spawnSpikeGroup();
const trap = engine3.hazards[engine3.hazards.length - 1];
const pickupNearTrap = engine3.foods.some((item) => item.x < trap.x + trap.w + 110 &&
  item.x + item.w > trap.x - 110);
const trapSpacing = engine3.spawnSpikeGroup() === false;
const trapClear = !pickupNearTrap && trapSpacing;

// Pits: fall in when grounded, clear them in the air.
fresh();
engine3.spawnPit();
engine3.pits[0].x = engine3.runnerBox(ground3).left;
engine3.pits[0].el.style.transform = `translate3d(${engine3.pits[0].x}px,0,0)`;
engine3.update(0.001);
const pitKills = engine3.phase === 'over' && /坑/.test(dom3.shadeTitle.textContent);

fresh();
engine3.runnerY = 60;
engine3.vy = 0;
engine3.spawnPit();
engine3.pits[0].x = engine3.runnerBox(ground3).left;
engine3.pits[0].el.style.transform = `translate3d(${engine3.pits[0].x}px,0,0)`;
engine3.update(0.001);
const pitJumpClears = engine3.phase === 'running';

// Coin trails: clearing the whole group pays the group bonus.
fresh();
engine3.spawnCoinGroup();
const coins = engine3.foods.filter((item) => item.type === 'coin');
const coinGroup = coins.length ? coins[0].group : null;
const bonusBeforeCoins = engine3.bonus;
if (coinGroup) {
  for (const coin of coins) {
    const runner = engine3.runnerBox(ground3);
    coin.x = runner.left;
    coin.height = 0;
    coin.el.style.bottom = `${GROUND_OFFSET}px`;
    engine3.collectFoods(ground3);
  }
}
const coinGroupBonus = Boolean(coinGroup && coinGroup.done) &&
  engine3.bonus >= bonusBeforeCoins + coins.length * 5 + 40;

// Whale banknote: +200 and converts nearby pickups + traps into rich food.
fresh();
engine3.spawnHazard(engine3.stageW * 0.6);
engine3.spawnFood(engine3.stageW * 0.7, 0.2, 'bowl');
const hazardsBeforeNote = engine3.hazards.length;
engine3.spawnFood(engine3.stageW * 0.8, 0.2, 'banknote', { height: 24 });
const note = engine3.foods[engine3.foods.length - 1];
note.x = engine3.runnerBox(ground3).left;
engine3.collectFoods(ground3);
const convertedFood = engine3.foods.some((item) => item.points >= 40);
const banknoteWorks = engine3.hazards.length < hazardsBeforeNote && convertedFood;

// Claude Code crab: stomping pays out + bounces, side hits end the run,
// invincibility smashes it for points.
const crabArt = Boolean(POWERUP_ASSETS.crab && POWERUP_ASSETS.crab.light && POWERUP_ASSETS.crab.dark) &&
  POWERUP_ASSETS.crab.light.w === POWERUP_ASSETS.crab.dark.w &&
  POWERUP_ASSETS.crab.light.h === POWERUP_ASSETS.crab.dark.h;

fresh();
engine3.spawnCrab();
let crab = engine3.hazards[engine3.hazards.length - 1];
crab.x = engine3.runnerHazardBox(ground3).left;
engine3.runnerY = crab.h - 4;
engine3.vy = -300;
const bonusBeforeStomp = engine3.bonus;
engine3.update(0.001);
const crabStomp = engine3.phase === 'running' && engine3.crabCount() === 0 &&
  engine3.bonus >= bonusBeforeStomp + 100 && engine3.vy > 0;

fresh();
engine3.spawnCrab();
crab = engine3.hazards[engine3.hazards.length - 1];
crab.x = engine3.runnerHazardBox(ground3).left;
engine3.update(0.001);
const crabKills = engine3.phase === 'over' && /螃蟹/.test(dom3.shadeTitle.textContent);

fresh();
engine3.activateStar();
engine3.spawnCrab();
crab = engine3.hazards[engine3.hazards.length - 1];
crab.x = engine3.runnerHazardBox(ground3).left;
const bonusBeforeCrabSmash = engine3.bonus;
engine3.update(0.001);
const crabSmash = engine3.phase === 'running' && engine3.crabCount() === 0 &&
  engine3.bonus > bonusBeforeCrabSmash;

engine3.destroy();
const hazardTests = {
  hazardArt,
  standingCrash,
  duckPasses,
  starSmashes,
  shieldAbsorbs,
  basinIgnored,
  autoSpawns,
  spikeGrounded,
  spikeGrouped,
  spikeKills,
  spikeJumpClears,
  pitKills,
  pitJumpClears,
  trapClear,
  coinGroupBonus,
  banknoteWorks,
  crabArt,
  crabStomp,
  crabKills,
  crabSmash,
};



// -- pickups: ground placement, same size across themes, pool weights -----
const expectedFoods = ['apple', 'bowl', 'onigiri', 'sushi', 'ramen', 'omurice',
  'cake_slice', 'ice_cream', 'sundae', 'coin', 'banknote'];
const missingFoods = expectedFoods.filter((id) => !FOODS[id] || !ASSETS.foods[id] ||
  !ASSETS.foods[id].light || !ASSETS.foods[id].dark);
const sizeMismatch = expectedFoods.filter((id) => {
  const art = ASSETS.foods[id];
  return !art || !art.light || !art.dark || art.light.w !== art.dark.w || art.light.h !== art.dark.h;
});
let riceHits = 0;
const rolls = 4000;
let unknownFood = null;
for (let i = 0; i < rolls; i += 1) {
  const id = pickFoodType(0.25);
  if (!FOODS[id]) { unknownFood = id; break; }
  if (id === 'bowl' || id === 'onigiri' || id === 'sushi') riceHits += 1;
}
const riceShare = Number((riceHits / rolls).toFixed(2));


// Different scoring pickups must never overlap each other.
const overlappingPickups = [];
for (let i = 0; i < engine.foods.length; i += 1) {
  for (let j = i + 1; j < engine.foods.length; j += 1) {
    const a = engine.foods[i];
    const b = engine.foods[j];
    if (a.x < b.x + b.w && a.x + a.w > b.x) overlappingPickups.push();
  }
}
const groundY2 = engine.stageH - GROUND_OFFSET;
const wrongPlacement = [];
const iconSizes = [];
for (const id of expectedFoods) {
  engine.spawnFood(engine.runnerBox(groundY2).right + 40, 0.2, id);
  const item = engine.foods[engine.foods.length - 1];
  const def = FOODS[id];
  if (!item || (item.height !== 0 && item.height !== def.height)) wrongPlacement.push(id);
  else if (item.el.style.bottom !== `${GROUND_OFFSET + item.height}px`) wrongPlacement.push(`${id}:bottom`);
  if (item) iconSizes.push([id, item.w, item.h]);
  if (item) {
    engine.foods.pop();
    item.el.remove();
  }
}
// Every pickup icon uses one size rule: longest side == PICKUP_ICON_MAX, and
// the light/dark baked boxes are identical so both themes render the same size.
const uniformIcons = iconSizes.length === expectedFoods.length &&
  iconSizes.every(([, w, h]) => Math.max(w, h) === PICKUP_ICON_MAX) &&
  expectedFoods.every((id) => {
    const art = ASSETS.foods[id];
    return art && art.light.w === art.dark.w && art.light.h === art.dark.h;
  });
// Roll enough spawns to confirm the ground/air mix; the air-streak guard makes
// a run of floating spawns impossible.
engine.airStreak = 0;
const placements = { ground: 0, air: 0 };
for (let i = 0; i < 120; i += 1) {
  engine.spawnFood(900, 0.2, 'bowl');
  const item = engine.foods[engine.foods.length - 1];
  if (item) {
    if (item.height === 0) placements.ground += 1;
    else placements.air += 1;
    engine.foods.pop();
    item.el.remove();
  }
}
const groundShare = Number((placements.ground / Math.max(1, placements.ground + placements.air)).toFixed(2));

// Clean slate for the buff timings: drop anything the timed run picked up and
// freeze spawning so random desserts can't refresh a buff mid-test.
engine.buffs = { speed: 0, double: 0, magnet: 0, slow: 0 };
engine.shield = false;
engine.setInvincible(false);
engine.starPlanned = false;
engine.stars.length = 0;
dom.stars.replaceChildren();
engine.foods.length = 0;
dom.foods.replaceChildren();
engine.spawnIn = 1e9;
engine.update(0.0001); // refresh engine.speed with the clean buff state

// -- buffs: double / speed / slow / magnet / shield -----------------------
engine.activateBuff('double');
const doubleMultiplier = engine.scoreMultiplier();
const speedBeforeBoost = engine.speed;
engine.activateBuff('speed');
engine.update(0.01);
const speedRatio = speedBeforeBoost > 0 ? Number((engine.speed / speedBeforeBoost).toFixed(2)) : 0;
const speedBeforeSlow = engine.speed;
engine.activateBuff('slow');
engine.update(0.01);
const slowRatio = speedBeforeSlow > 0 ? Number((engine.speed / speedBeforeSlow).toFixed(2)) : 0;
const buffHud = dom.power.textContent;

engine.activateBuff('magnet');
engine.spawnFood(engine.runnerBox(groundY2).right + 150, 0.2, 'bowl');
const magnetFood = engine.foods[engine.foods.length - 1];
const magnetStartX = magnetFood.x;
engine.magnetFoods(0.2, groundY2);
const magnetPulled = magnetFood.x < magnetStartX - 50;

// Stop the world from spawning new pickups while we time the buffs out, so a
// randomly spawned dessert can't quietly refresh a buff mid-test.
engine.spawnIn = 1e9;
engine.foods.length = 0;
dom.foods.replaceChildren();
for (let t = 0; t < 7; t += step) engine.update(step);
const timedBuffsExpired = !/双倍|加速|磁铁|缓速/.test(dom.power.textContent) && engine.scoreMultiplier() === 1;

engine.activateBuff('shield');
const shieldGranted = engine.shield === true;
for (let t = 0; t < 8; t += step) engine.update(step);
const shieldPersists = engine.shield === true && /护盾/.test(dom.power.textContent);
const shieldBroke = engine.breakShield() === true && engine.shield === false && !/护盾/.test(dom.power.textContent);
engine.spawnIn = 100;
engine.spawnFood(600, 0.2, 'bowl'); // keep the "food on screen" invariant after the frozen test window
const buffs = {
  missingFoods,
  sizeMismatch,
  wrongPlacement,
  uniformIcons,
  placements,
  groundShare,
  unknownFood,
  riceShare,
  doubleMultiplier,
  speedRatio,
  expectedSpeedRatio: BUFFS.speed.speedScale,
  slowRatio,
  expectedSlowRatio: BUFFS.slow.speedScale,
  buffHud,
  magnetPulled,
  timedBuffsExpired,
  shieldGranted,
  shieldPersists,
  shieldBroke,
};

const result = {
  seconds,
  jumps,
  score: engine.score,
  bonus: engine.bonus,
  collected: engine.collected,
  foodsOnScreen: engine.foods.length,
  phase: engine.phase,
  speed: Math.round(engine.speed),
  kmh: Math.round(speedKmh(engine.speed)),
  speedLabel: dom.speed.textContent,
  star: { spawned, during, after, seconds: STAR.seconds, chance: STAR.chance },
  slide: { during: slideDuring, after: slideAfter },
  cadence,
  buffs,
  hazards: hazardTests,
  collectedLedger: engine.collected > 0,
};

console.log(JSON.stringify(result, null, 2));

const problems = [];
if (engine.phase !== 'running') problems.push('run ended unexpectedly (no obstacles are active)');
if (engine.score <= 0) problems.push('score did not advance');
if (engine.collected < 1) problems.push('no food was collected');
if (engine.bonus < 10) problems.push('collected food did not award points');
if (engine.foods.length < 1) problems.push('no food left on screen at the end of the run');
if (!/ km\/h$/.test(dom.speed.textContent)) problems.push('speed readout is not in km/h');
if (/×/.test(dom.speed.textContent)) problems.push('speed readout still uses the old multiplier');
const shown = Number((dom.speed.textContent.match(/\d+/) || [])[0]);
if (!(shown >= 19 && shown <= 201)) problems.push(`speed readout out of range: ${shown}`);
if (MAX_KMH !== 200 || speedKmh(1000) !== 200) problems.push('speed readout top speed is not 200 km/h');
if (STAR.seconds !== 10) problems.push(`star duration is ${STAR.seconds}s, expected 10s`);
if (!(STAR.chance > 0 && STAR.chance < 1)) problems.push('star chance is not a probability');
if (!Array.isArray(engine.frameTimes) || engine.frameTimes.length !== engine.items.length) {
  problems.push('native run-frame timing is missing from the baked assets');
} else if (engine.frameTimes.reduce((sum, ms) => sum + ms, 0) !== 320) {
  problems.push(`run cycle is ${engine.frameTimes.reduce((sum, ms) => sum + ms, 0)}ms, expected the native 320ms (1.25x art)`);
}
if (spawned !== 1) problems.push(`star did not spawn (${spawned})`);
if (!during.invincible || during.attr !== '1' || !/^无敌/.test(during.label)) {
  problems.push('star did not activate invincibility');
}
if (after.invincible || after.attr !== '0' || /无敌/.test(after.label)) {
  problems.push('invincibility did not expire');
}
if (!slideDuring.sliding) problems.push('slide pose did not engage');
if (!(slideDuring.topDelta > 10)) problems.push('slide hitbox is not lower than the standing one');
if (!slideDuring.srcIsData || !/px$/.test(slideDuring.poseHeight)) {
  problems.push('slide pose did not swap in the static slide art');
}
if (slideAfter.sliding || slideAfter.poseHeight !== '') problems.push('slide did not end on release');
if (!(cadence.advances >= 15 && cadence.advances <= 19)) {
  problems.push(`run animation advanced ${cadence.advances} frames in 0.34s, expected ~17 (native 320ms 16-frame 1.25x art)`);
}
if (buffs.missingFoods.length) problems.push(`missing pickup art: ${buffs.missingFoods.join(', ')}`);
if (buffs.sizeMismatch.length) problems.push(`light/dark size mismatch: ${buffs.sizeMismatch.join(', ')}`);
if (buffs.wrongPlacement.length) problems.push(`pickups at unexpected heights: ${buffs.wrongPlacement.join(', ')}`);
if (!buffs.uniformIcons) problems.push('pickup icons are not all the same size across themes/types');
if (!hazardTests.crabArt) problems.push('crab SVG is missing or its themed sizes differ');
if (!hazardTests.crabStomp) problems.push('stomping the crab does not bounce/score');
if (!hazardTests.crabKills) problems.push('walking into the crab does not end the run');
if (!hazardTests.crabSmash) problems.push('invincible crab smash does not score');
if (!(buffs.placements.ground > 0)) problems.push('no ground pickups were generated');
if (!(buffs.placements.air > 0)) problems.push('no floating pickups were generated');
if (!(buffs.groundShare > 0.2)) problems.push(`ground pickups too rare (${buffs.groundShare})`);
if (buffs.unknownFood) problems.push(`pickFoodType returned unknown food: ${buffs.unknownFood}`);
if (!(buffs.riceShare > 0.55 && buffs.riceShare < 0.86)) {
  problems.push(`rice share ${buffs.riceShare} outside the 0.55-0.86 backbone band`);
}
if (buffs.doubleMultiplier !== 2) problems.push('double buff does not double the score');
if (!(Math.abs(buffs.speedRatio - buffs.expectedSpeedRatio) < 0.02)) {
  problems.push(`speed buff ratio ${buffs.speedRatio}, expected ${buffs.expectedSpeedRatio}`);
}
if (!(Math.abs(buffs.slowRatio - buffs.expectedSlowRatio) < 0.02)) {
  problems.push(`slow buff ratio ${buffs.slowRatio}, expected ${buffs.expectedSlowRatio}`);
}
if (!/双倍/.test(buffs.buffHud) || !/加速/.test(buffs.buffHud) || !/缓速/.test(buffs.buffHud)) {
  problems.push('buff HUD labels missing');
}
if (!buffs.magnetPulled) problems.push('magnet buff did not pull pickups in');
if (!buffs.timedBuffsExpired) problems.push('timed buffs did not expire');
if (!buffs.shieldGranted || !buffs.shieldPersists) problems.push('shield is not permanent until broken');
if (!buffs.shieldBroke) problems.push('shield did not break / clear on breakShield()');
if (!hazardTests.hazardArt) problems.push('hanging bamboo art is missing from the baked assets');
if (!hazardTests.standingCrash) problems.push('standing runner did not crash into the bamboo');
if (!hazardTests.duckPasses) problems.push('ducking (slide) did not pass under the bamboo');
if (!hazardTests.starSmashes) problems.push('invincibility did not smash the bamboo');
if (!hazardTests.shieldAbsorbs) problems.push('shield did not absorb the bamboo hit');
if (!hazardTests.basinIgnored) problems.push('the basin carried in front still counts as a bamboo hit');
if (!hazardTests.autoSpawns) problems.push('bamboo obstacles are not spawning automatically');
if (!hazardTests.spikeKills || !hazardTests.spikeJumpClears) problems.push('spike hazard is not jumpable');
if (!hazardTests.spikeGrounded) problems.push('spikes are not pinned to the ground');
if (!hazardTests.spikeGrouped) problems.push('spikes are not spawning as a packed group');
if (!hazardTests.trapClear) problems.push('scoring pickups spawn next to traps, or traps overlap');
if (!/\.sr-hazard\.sr-spikes\{[^}]*bottom:\d+px/.test(CSS)) problems.push('spike ground CSS lost its px unit');
if (!/\.sr-pit\{[^}]*bottom:-?\d+px/.test(CSS)) problems.push('pit ground CSS lost its px unit');
if (overlappingPickups.length) problems.push('scoring pickups overlap each other');
if (!hazardTests.pitKills || !hazardTests.pitJumpClears) problems.push('ground pit is not jumpable');
if (!hazardTests.coinGroupBonus) problems.push('coin trail group bonus is missing');
if (!hazardTests.banknoteWorks) problems.push('whale banknote conversion is not working');
if (problems.length) {
  console.error(`FAIL: ${problems.join('; ')}`);
  process.exit(1);
}
console.log('PASS: 11 pickups at a uniform 40px icon size (light/dark identical), coin trails + banknote conversion, vertical slot pits, spike groups, Claude Code crab stomp/smash/hit, bamboo block-dodge, buffs/shield/invincibility, 200 km/h readout, native 1.25x cadence');

engine.destroy();
