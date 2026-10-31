/**
 * Offline preview harness. Not part of the plugin bundle: it renders the exact
 * same stage DOM/CSS/engine outside DSH so the visuals and physics can be
 * inspected (and screenshotted) without touching the live GUI.
 *
 *   ?theme=dark|light   color scheme (default dark)
 *   ?jump=1             auto-jump once mid-run
 *   ?slide=1            hold the slide pose (for screenshots)
 *   ?hazard=1           spawn one hanging bamboo obstacle (for screenshots)
 *   ?power=1            activate the star power-up before reporting
 *   ?buff=double|magnet|slow  activate one dessert buff before reporting
 *   ?intro=1            play the level intro (road unrolls left -> right)
 *   ?at=3200            ms after which the state is written to #out
 */
import { ASSETS } from './generated/assets.js';
import { BASE_SPEED, Engine, speedKmh } from './engine.js';
import { injectStyle } from './styles.js';
import { themeScheme } from './state.js';

const params = new URLSearchParams(location.search);
const scheme = params.get('theme') === 'light' ? 'light' : 'dark';

themeScheme.set(scheme);
injectStyle();

const dark = scheme === 'dark';
document.body.style.background = dark ? '#151517' : '#ffffff';
document.body.style.color = dark ? '#f9fafb' : '#0f1115';
const card = document.querySelector('[data-composer-card]');
if (card) {
  card.style.background = dark ? '#2c2c2e' : '#ffffff';
  card.style.border = `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(15,17,21,.12)'}`;
}

const dock = document.getElementById('dock');
const root = document.createElement('div');
root.className = 'sr-root';
root.dataset.srPhase = 'running';
root.dataset.scheme = scheme;
root.dataset.arcade = 'stage';
root.style.backgroundColor = dark ? '#232324' : '#ffffff';
root.style.color = dark ? '#f9fafb' : '#0f1115';
root.style.width = '672px';
root.style.marginLeft = '0px';

const stage = document.createElement('div');
stage.className = 'sr-stage';
const ground = document.createElement('div');
ground.className = 'sr-ground';
const ground2 = document.createElement('div');
ground2.className = 'sr-ground2';
const obstacles = document.createElement('div');
obstacles.className = 'sr-obstacles';
const pits = document.createElement('div');
pits.className = 'sr-pits';
const hazards = document.createElement('div');
hazards.className = 'sr-hazards';
const foods = document.createElement('div');
foods.className = 'sr-foods';
const stars = document.createElement('div');
stars.className = 'sr-stars';
const runner = document.createElement('img');
runner.className = 'sr-runner';
runner.alt = '';
runner.draggable = false;
runner.src = ASSETS.maid[scheme].frames[0];
const pops = document.createElement('div');
pops.className = 'sr-pops';
const head = document.createElement('div');
head.className = 'sr-head';
head.innerHTML = '<span class="sr-title">dsh-arcade</span>'
  + '<span class="sr-spacer"></span>'
  + '<span class="sr-score">得分 <b id="score">0</b> · 最高 <b id="best">0</b></span>'
  + '<span class="sr-power" id="power"></span>'
  + '<span class="sr-speed" id="speed">速度 ' + Math.round(speedKmh(BASE_SPEED)) + ' km/h</span>';

stage.append(ground, ground2, obstacles, pits, hazards, foods, stars, runner, pops, head);
root.append(stage);
dock.append(root);

const engine = new Engine({
  root,
  stage,
  runner,
  obstacles,
  pits,
  hazards,
  foods,
  stars,
  pops,
  ground,
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  speed: document.getElementById('speed'),
  power: document.getElementById('power'),
  shadeTitle: null,
  shadeSub: null,
}, { intro: params.get('intro') === '1', onPhase: () => {} });
engine.applyScheme(scheme);

// Minimal keyboard controls so the preview can be driven by hand too.
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') {
    event.preventDefault();
    engine.slide();
  } else if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
    event.preventDefault();
    engine.jump();
  }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowDown' || event.code === 'KeyS') engine.releaseSlide();
  if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') engine.release();
});

if (params.get('jump') === '1') {
  setTimeout(() => engine.jump(), 2350);
  setTimeout(() => engine.release(), 2540);
}

// Deterministic simulation for screenshots: headless virtual time does not
// reliably drive requestAnimationFrame, so advance the engine synchronously.
const sim = Number(params.get('sim') || 0);
if (sim > 0) {
  engine.paused = true;
  const jumpAt = Number(params.get('jumpAt') || 2350);
  const stepMs = 1000 / 120;
  let t = 0;
  while (t < sim) {
    if (params.get('jump') === '1' && t <= jumpAt && t + stepMs > jumpAt) engine.jump();
    if (params.get('jump') === '1' && t <= jumpAt + 200 && t + stepMs > jumpAt + 200) engine.release();
    engine.update(stepMs / 1000);
    t += stepMs;
  }
  engine.render();
}

if (params.get('slide') === '1') {
  engine.slide();
  engine.update(0.02);
  engine.render();
}

if (params.get('power') === '1') {
  engine.activateStar();
  engine.update(0.0001);
  engine.render();
}

if (params.get('buff')) {
  engine.activateBuff(params.get('buff'));
  engine.update(0.0001);
  engine.render();
}

if (params.get('hazard') === '1') {
  engine.spawnHazard(420);
  engine.update(0.0001);
  engine.render();
}

const at = Number(params.get('at') || 3200);
setTimeout(() => {
  const rect = root.getBoundingClientRect();
  const report = {
    theme: scheme,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    bg: getComputedStyle(root).backgroundColor,
    score: engine.score,
    bonus: engine.bonus,
    collected: engine.collected,
    foods: engine.foods.length,
    stars: engine.stars.length,
    hazards: engine.hazards.length,
    spikes: engine.spikeCount ? engine.spikeCount() : 0,
    pits: engine.pits.length,
    coins: engine.foods.filter((item) => item.type === 'coin').length,
    invincible: engine.invincible,
    shield: engine.shield,
    buffs: Object.keys(engine.buffs).filter((id) => engine.buffs[id] > engine.elapsed),
    sliding: engine.sliding,
    powerLabel: document.getElementById('power').textContent,
    runnerY: Math.round(engine.runnerY),
    speed: Math.round(engine.speed),
  };
  const out = document.getElementById('out');
  out.textContent = JSON.stringify(report);
  document.title = `PREVIEW ${JSON.stringify(report)}`;
}, at);
