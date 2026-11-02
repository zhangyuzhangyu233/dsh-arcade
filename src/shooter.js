/**
 * Tempest-lite: a tiny 3D vector tunnel shooter for the dsh-arcade panel.
 *
 * The little fighter is pinned to a 180° arc at the mouth of a wireframe tunnel.
 * Enemies come out of the vanishing point along the bottom arc, the player
 * rotates left/right and fires along the current lane. Stars stream past behind
 * the tunnel. Everything is drawn on a single canvas; the player ship is the
 * provided SMIL-animated SVG inserted inline so its exhaust keeps animating.
 */
import { SHOOTER } from './generated/shooter.js';

const REWARDS = SHOOTER.rewards || {};
const REWARD_META = {
  'double-shot': { name: '双弹道', duration: 12 },
  'triple-shot': { name: '三弹道', duration: 12 },
  'screen-clear': { name: '清屏', duration: 0 },
  'damage-up': { name: '伤害提升', duration: 12 },
  'fire-rate': { name: '射速提升', duration: 12 },
  shield: { name: '护盾', duration: 0 },
  repair: { name: '修复', duration: 0 },
  'piercing-laser': { name: '穿透激光', duration: 10 },
  missile: { name: '导弹解锁', duration: 0 },
  cooldown: { name: '反制冷却', duration: 0 },
};
const DROP_CHANCE = { enemy: 0.08, elite: 0.25, boss: 1 };
const SQUAD_MODES = ['defense', 'assault', 'orbit', 'wedge', 'swarm'];
const PICKUP_LIFE = 9;
const PICKUP_RADIUS = 26;

const FULL_TURN = Math.PI;         // the fighter now flies the whole ring
const ROTATE_SPEED = 2.4;         // rad / s
const FIRE_COOLDOWN = 0.085;       // s
const BULLET_SPEED = 2.6;         // z / s
const BULLET_DAMAGE = 10;
const MAX_HP = 100;
const ULT_MAX = 8;
const COUNTER_COOLDOWN = 3.0;
const ENEMY_MISSILE_SPEED = BULLET_SPEED * 0.9;
const BEST_KEY = 'dsh-arcade.best.fighter';

const ENEMY_TYPES = {
  enemy: { maxHp: 10, damage: 20, points: 10, size: 58 },
  elite: { maxHp: 30, damage: 35, points: 30, size: 78 },
  boss: { maxHp: 200, damage: 45, points: 200, size: 190 },
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function moveToward(current, target, maxDelta) {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

function wrapAngle(a) {
  let value = a;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function moveAngle(current, target, maxDelta) {
  const diff = angleDelta(target, current);
  if (Math.abs(diff) <= maxDelta) return wrapAngle(target);
  return wrapAngle(current + Math.sign(diff) * maxDelta);
}

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Shooter {
  constructor(container, options = {}) {
    this.container = container;
    this.scheme = options.scheme === 'light' ? 'light' : 'dark';
    this.onClose = options.onClose || (() => {});
    this.w = 672;
    this.h = 236;
    this.dpr = Math.min(1.5, window.devicePixelRatio || 1);

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.className = 'sr-fighter-canvas';

    this.player = document.createElement('div');
    this.player.className = 'sr-fighter-player';
    this.player.innerHTML = SHOOTER.playerSvg;

    this.buffHud = document.createElement('div');
    this.buffHud.className = 'sr-fighter-buffs';

    this.hud = document.createElement('div');
    this.hud.className = 'sr-fighter-hud';
    this.hud.innerHTML = ''
      + '<div class="sr-fighter-hud-main">'
      + '<span class="sr-fighter-title">dsh-arcade</span>'
      + '<span class="sr-fighter-score">得分 <b>0</b></span>'
      + '<span class="sr-fighter-best">最高 <b>0</b></span>'
      + '<span class="sr-fighter-wave">波次 1</span>'
      + '</div>'
      + '<div class="sr-fighter-hud-hp"><span class="sr-fighter-hp">HP <b>100</b><i></i></span></div>';

    this.abilityHud = document.createElement('div');
    this.abilityHud.className = 'sr-fighter-abilities';
    this.abilityHud.innerHTML = ''
      + '<span class="sr-fighter-ability sr-fighter-counter">反制 <b>就绪</b></span>'
      + '<span class="sr-fighter-ability sr-fighter-ult">X 电磁炮 <b>未解锁</b></span>';

    this.alert = document.createElement('div');
    this.alert.className = 'sr-fighter-alert';
    this.alert.innerHTML = '<div class="sr-fighter-alert-title"></div><div class="sr-fighter-alert-sub"></div>';

    this.overlay = document.createElement('div');
    this.overlay.className = 'sr-fighter-shade';
    this.overlay.innerHTML = '<div class="sr-fighter-shade-title">坠毁</div>'
      + '<div class="sr-fighter-shade-sub">空格 / 点击 再来一局</div>';

    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.className = 'sr-close';
    this.closeBtn.setAttribute('aria-label', '关闭游戏');
    this.closeBtn.textContent = '×';
    this.closeBtn.addEventListener('click', (event) => { event.stopPropagation(); this.onClose(); });

    container.append(this.canvas, this.player, this.hud, this.buffHud, this.abilityHud, this.alert, this.overlay, this.closeBtn);
    this.colors = this.scheme === 'light'
      ? { bg: '#ffffff', fg: '#0f1115', dim: 'rgba(15,17,21,.32)', star: 'rgba(15,17,21,.25)' }
      : { bg: '#232324', fg: '#f9fafb', dim: 'rgba(255,255,255,.28)', star: 'rgba(255,255,255,.26)' };
    this.images = {};
    for (const [type, art] of Object.entries(SHOOTER.images)) {
      const img = new Image();
      img.src = art[this.scheme];
      this.images[type] = img;
    }
    this.rewardImages = {};
    for (const [id, art] of Object.entries(REWARDS)) {
      const img = new Image();
      img.src = art[this.scheme];
      this.rewardImages[id] = img;
    }
    this.player.classList.toggle('sr-fighter-player--invert', this.scheme === 'dark');

    this.keys = new Set();
    this.raf = 0;
    this.last = 0;
    this.best = this.readBest();
    this.onKeyDown = (event) => this.handleKey(event, true);
    this.onKeyUp = (event) => this.handleKey(event, false);
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    this.overlay.addEventListener('click', () => { if (this.phase === 'over') this.restart(); });
    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this.resize())
      : null;
    if (this.resizeObserver) this.resizeObserver.observe(container);
    this.resize();
    this.reset();
    this.start();
  }

  /* -- lifecycle ---------------------------------------------------- */
  resize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 60) return;
    this.w = Math.round(rect.width);
    this.h = Math.round(rect.height);
    this.arenaSide = Math.min(this.w, this.h);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.playerW = Math.round(clamp(this.w * 0.15, 84, 108));
    this.player.style.width = `${this.playerW}px`;
  }

  start() {
    this.last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) {
        this.last = now;
        return;
      }
      const dt = clamp((now - this.last) / 1000, 0, 0.05);
      this.last = now;
      if (this.phase === 'running') this.update(dt);
      try { this.draw(); } catch (error) { this.drawError = String((error && error.stack) || error); }
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    this.container.replaceChildren();
  }

  /* -- run state ---------------------------------------------------- */
  reset() {
    this.phase = 'running';
    this.score = 0;
    this.hp = MAX_HP;
    this.wave = 1;
    this.playerAngle = 0;
    this.playerRot = 0;
    this.invulnUntil = 0;
    this.hitFlashUntil = 0;
    this.fireTimer = 0;
    this.bullets = [];
    this.enemies = [];
    this.enemyMissiles = [];
    this.playerMissiles = [];
    this.counterUntil = 0;
    this.ultCharge = 0;
    this.ultUnlocked = false;
    this.emUntil = 0;
    this.emAngle = 0;
    this.runTime = 0;
    this.boss = null;
    this.bossPendingUntil = 0;
    this.alertUntil = 0;
    this.bossBullets = [];
    this.bossChargeUntil = 0;
    this.bossHeavyTimer = 6;
    this.laserUntil = 0;
    this.laserAngle = 0;
    this.laserWidth = 0.5;
    this.laserDamage = 60;
    this.laserStartedAt = 0;
    this.laserFlashUntil = 0;
    this.spawnTimer = 0.7;
    this.eliteTimer = 5;
    this.waveTimer = 14;
    this.bossTimer = 0;
    this.waveKills = 0;
    this.particles = [];
    this.floaters = [];
    this.pickups = [];
    this.buffs = {};
    this.shieldHp = 0;
    this.enemySeq = 0;
    this.buffHudTimer = 0;
    this.stars = [];
    for (let i = 0; i < 110; i += 1) this.stars.push(this.newStar(true));
    this.overlay.classList.remove('is-visible');
    this.updateHud();
  }

  restart() {
    this.reset();
  }

  newStar(spread = false) {
    return {
      angle: Math.random() * Math.PI * 2,
      dist: spread ? Math.random() : 0.05 + Math.random() * 0.1,
      speed: 0.35 + Math.random() * 0.9,
      size: 0.6 + Math.random() * 1.4,
    };
  }

  updateHud() {
    const set = (selector, value) => {
      const el = this.hud.querySelector(selector);
      if (el) el.textContent = value;
    };
    set('.sr-fighter-score b', String(this.score));
    set('.sr-fighter-best b', String(Math.max(this.best, this.score)));
    set('.sr-fighter-hp b', String(Math.max(0, Math.ceil(this.hp))));
    const hpEl = this.hud.querySelector('.sr-fighter-hp');
    if (hpEl) hpEl.style.setProperty('--hp', String(clamp(this.hp / MAX_HP, 0, 1)));
    set('.sr-fighter-wave', `波次 ${this.wave}${this.boss ? ' · BOSS' : ''}`);
    this.updateAbilityHud();
  }

  updateAbilityHud() {
    if (!this.abilityHud) return;
    const counter = this.abilityHud.querySelector('.sr-fighter-counter b');
    const ult = this.abilityHud.querySelector('.sr-fighter-ult b');
    const now = performance.now();
    if (counter) {
      const remaining = (this.counterUntil || 0) - now;
      counter.textContent = remaining > 0 ? '装填 ' + (remaining / 1000).toFixed(1) + 's' : '就绪';
    }
    if (ult) {
      if (!this.ultUnlocked) ult.textContent = '未解锁';
      else if (this.ultCharge >= ULT_MAX) ult.textContent = '就绪';
      else ult.textContent = `${this.ultCharge}/${ULT_MAX}`;
    }
    if (this.abilityHud) this.abilityHud.classList.toggle('is-ult-ready', this.ultUnlocked && this.ultCharge >= ULT_MAX);
  }

  readBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }

  saveBest() {
    if (this.score <= this.best) return;
    this.best = this.score;
    try { localStorage.setItem(BEST_KEY, String(this.best)); } catch { /* private mode */ }
  }

  gameOver() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.saveBest();
    this.overlay.classList.add('is-visible');
    const sub = this.overlay.querySelector('.sr-fighter-shade-sub');
    if (sub) sub.textContent = `得分 ${this.score} · 最高 ${this.best} · 空格 / 点击 再来一局`;
    this.updateHud();
    this.ping('over');
  }

  /* -- input -------------------------------------------------------- */
  handleKey(event, down) {
    const key = event.key;
    if (key === 'Escape') {
      if (down) this.onClose();
      return;
    }
    if (key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      if (down && this.phase === 'over') { this.restart(); return; }
      if (down) this.fireCounterMissile();
      return;
    }
    if (key === 'x' || key === 'X') {
      event.preventDefault();
      if (down) this.fireUltimate();
      return;
    }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      event.preventDefault();
      if (down) this.keys.add('left'); else this.keys.delete('left');
      return;
    }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      event.preventDefault();
      if (down) this.keys.add('right'); else this.keys.delete('right');
    }
  }

  /* -- update ------------------------------------------------------- */
  update(dt) {
    if (this.keys.has('left')) this.playerAngle -= ROTATE_SPEED * dt;
    if (this.keys.has('right')) this.playerAngle += ROTATE_SPEED * dt;
    this.playerAngle = clamp(this.playerAngle, -Math.PI / 2, Math.PI / 2);
    this.runTime += dt;

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      const rateLevel = this.buffs.fireRate || 0;
      this.fireTimer = FIRE_COOLDOWN * Math.pow(0.8, rateLevel);
      const lanes = this.buffs.tripleShot ? [-0.16, 0, 0.16]
        : this.buffs.doubleShot ? [-0.08, 0.08] : [0];
      const from = this.project(this.playerAngle, 0);
      const dirX = Math.sin(this.playerRot || 0);
      const dirY = -Math.cos(this.playerRot || 0);
      const noseDist = Math.max(14, this.playerW * 0.18);
      const nose = { x: from.x + dirX * noseDist, y: from.y + dirY * noseDist };
      const damageLevel = this.buffs.damageUp || 0;
      const damage = BULLET_DAMAGE * (damageLevel ? 1 + damageLevel * 0.5 : 1);
      const piercing = Boolean(this.buffs.piercing);
      for (const offset of lanes) {
        const angle = this.playerAngle + offset;
        const to = this.project(angle, 1);
        this.bullets.push({
          angle,
          z: 0.02,
          sx: nose.x,
          sy: nose.y,
          ex: to.x,
          ey: to.y,
          damage,
          piercing,
          hitIds: new Set(),
        });
      }
      this.muzzleUntil = performance.now() + 70;
      this.muzzle = nose;
      const missileLevel = this.buffs.missile || 0;
      if (missileLevel > 0 && Math.random() < missileLevel * 0.08) {
        this.spawnPlayerMissile('buff');
      }
    }
    this.updatePickups(dt);
    this.updatePlayerMissiles(dt);
    this.updateEnemyMissiles(dt);

    for (const bullet of this.bullets) bullet.z += BULLET_SPEED * dt;
    this.bullets = this.bullets.filter((bullet) => bullet.z <= 0.98);

    const diff = this.difficulty();
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !this.boss) {
      this.spawnTimer = Math.max(0.24, (1.05 - this.wave * 0.055) / diff) * (0.8 + Math.random() * 0.5);
      this.spawnEnemy('enemy');
    }
    this.eliteTimer -= dt;
    if (this.eliteTimer <= 0 && !this.boss) {
      this.eliteTimer = Math.max(3.2, (7.2 - this.wave * 0.22) / diff) + Math.random() * 2;
      this.spawnEliteSquad();
    }
    if (this.alertUntil && performance.now() >= this.alertUntil) {
      this.alertUntil = 0;
      this.alert.classList.remove('is-visible');
    }
    if (this.bossPendingUntil && performance.now() >= this.bossPendingUntil) {
      this.bossPendingUntil = 0;
      this.spawnBoss();
    }
    if (this.boss) {
      this.bossTimer += dt;
      const boss = this.boss;
      boss.spawnAge += dt;
      const now = performance.now();
      const phase = boss.hp <= boss.maxHp * 0.5 ? 2 : 1;
      boss.phase = phase;
      if (boss.introUntil) {
        if (now < boss.introUntil) {
          boss.attackTimer = 999;
          boss.missileTimer = 999;
          boss.dashTimer = 999;
          boss.entryOffsetY += (0 - boss.entryOffsetY) * Math.min(1, dt * 3.2);
        } else {
          boss.introUntil = 0;
          boss.entryOffsetY = 0;
          boss.attackTimer = 1.2;
          boss.missileTimer = 2.4;
          boss.dashTimer = 4.8;
        }
      }
      boss.dodgeCooldown -= dt;
      boss.attackTimer -= dt;
      // dodge player bullets that are about to reach it, and back off in depth
      const bossPoint = this.project(boss.angle, boss.z);
      const threat = this.bullets.find((bullet) =>
        bullet.z < boss.z && boss.z - bullet.z < 0.38 &&
        Math.abs(angleDelta(bullet.angle, boss.angle)) < 0.22);
      if (this.bossChargeUntil && now >= this.bossChargeUntil) {
        this.bossChargeUntil = 0;
        this.laserAngle = boss.angle;
        this.laserWidth = phase === 2 ? 0.42 : 0.30;
        this.laserUntil = now + (phase === 2 ? 850 : 760);
        this.laserDamage = phase === 2 ? 85 : 70;
        this.laserStartedAt = now;
        this.laserFlashUntil = now + 180;
        boss.attackTimer = Math.max(boss.attackTimer, 1.2);
        const point = this.project(boss.angle, boss.z);
        this.spawnBurst(point.x, point.y, 10, 120);
      } else if (this.bossChargeUntil) {
        boss.angle = moveAngle(boss.angle, this.playerAngle, (0.9 + phase * 0.25) * dt);
        boss.targetZ = 0.68;
      } else if (threat && boss.dodgeCooldown <= 0) {
        boss.targetZ = phase === 2 ? 0.8 : 0.74;
        const side = Math.sign(angleDelta(threat.angle, boss.angle)) || 1;
        boss.angle = wrapAngle(boss.angle - side * 0.24);
        boss.dodgeCooldown = phase === 2 ? 0.44 : 0.62;
      } else {
        boss.targetZ = 0.55;
        const sway = Math.sin(now / 900 + boss.angle) * 0.42;
        boss.angle = moveAngle(boss.angle, wrapAngle(this.playerAngle + sway), (0.65 + phase * 0.35) * dt);
      }
      boss.dashTimer -= dt;
      if (boss.dashTimer <= 0 && !this.bossChargeUntil) {
        boss.dashTimer = phase === 2 ? 4.0 : 5.0;
        const lanes = [-0.95, -0.55, 0, 0.55, 0.95];
        let lane = lanes[Math.floor(Math.random() * lanes.length)];
        if (Math.abs(angleDelta(lane, boss.angle)) < 0.25) lane = wrapAngle(lane + 0.7);
        boss.angle = clamp(lane, -Math.PI / 2, Math.PI / 2);
        boss.targetZ = 0.7;
        const point = this.project(boss.angle, boss.z);
        this.spawnBurst(point.x, point.y, 12, 130);
      }
      boss.z += clamp((boss.targetZ || 0.55) - boss.z, -0.5 * dt, 0.5 * dt);
      boss.angle = clamp(boss.angle, -Math.PI / 2, Math.PI / 2);
      const laserOn = now < (this.laserUntil || 0);
      if (laserOn && this.boss &&
          Math.abs(angleDelta(this.laserAngle, this.playerAngle)) < this.laserWidth) {
        this.hitPlayer(this.laserDamage || 60);
      }
      if (!this.bossChargeUntil && !laserOn && boss.attackTimer <= 0) {
        boss.attackTimer = (phase === 2 ? 0.95 : 1.2) + Math.random() * 0.3;
        this.spawnEnemyBullet(boss.angle - 0.07, boss.z, ENEMY_TYPES.boss.damage - 10);
        this.spawnEnemyBullet(boss.angle + 0.07, boss.z, ENEMY_TYPES.boss.damage - 10);
        if (phase === 2) this.spawnEnemyBullet(boss.angle, boss.z, ENEMY_TYPES.boss.damage);
        boss.flashUntil = performance.now() + 80;
      }
      boss.missileTimer -= dt;
      if (boss.missileTimer <= 0 && !this.bossChargeUntil && !laserOn) {
        boss.missileTimer = phase === 2 ? 1.7 : 2.4;
        this.spawnEnemyMissile(boss, ENEMY_TYPES.boss.damage - 10);
        if (phase === 2) this.spawnEnemyMissile(boss, ENEMY_TYPES.boss.damage - 15);
      }
      this.bossHeavyTimer -= dt;
      if (!this.bossChargeUntil && this.bossHeavyTimer <= 0) {
        this.bossHeavyTimer = phase === 2 ? 6.2 : 7.8;
        this.bossChargeUntil = now + (phase === 2 ? 900 : 1100);
        this.bossChargeAngle = this.playerAngle;
      }
      if (this.bossTimer > 45) this.boss = null;
    }
    // hostile bullets (minions / elites / boss) always fly, with or without a boss
    for (const bullet of this.bossBullets) bullet.z -= bullet.speed * dt;
    for (const bullet of this.bossBullets) {
      if (bullet.z <= 0.05) {
        bullet.dead = true;
        const safe = performance.now() < this.invulnUntil;
        if (!safe && Math.abs(angleDelta(bullet.angle, this.playerAngle)) < 0.17) {
          this.hitPlayer(bullet.damage);
        }
      }
    }
    this.bossBullets = this.bossBullets.filter((bullet) => !bullet.dead);

    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.wave += 1;
      this.waveTimer = 14;
      if (this.wave >= 2 && !this.ultUnlocked) {
        this.ultUnlocked = true;
        this.spawnFloater(this.w / 2, this.h * 0.3, 'X 电磁炮解锁');
      }
      if (this.wave % 4 === 0 && !this.boss && !this.bossPendingUntil) this.beginBossWarning();
      this.updateHud();
    }

    const speedBase = (0.16 + this.wave * 0.012) * this.difficulty();
    for (const enemy of this.enemies) {
      enemy.spawnAge += dt;
      enemy.wobble += dt * (enemy.type === 'elite' ? 1.4 : 2.2);
      const threat = this.bullets.find((bullet) =>
        bullet.z < enemy.z && enemy.z - bullet.z < 0.32 &&
        Math.abs(angleDelta(bullet.angle, enemy.angle)) < 0.18);
      if (enemy.type === 'enemy') {
        enemy.dodgeCooldown -= dt;
        enemy.fireTimer -= dt;
        enemy.modeTimer -= dt;
        const captain = enemy.captainId
          ? this.enemies.find((other) => other.id === enemy.captainId && !other.dead)
          : null;
        if (captain) {
          // Two squad behaviour trees:
          // - defense: escort screen in front of the captain, absorbing fire
          // - assault: flank wide ahead of the captain and pressure the player
          const mode = captain.squadMode || 'assault';
          let formation;
          let targetZ;
          let ownFire = false;
          if (mode === 'defense') {
            formation = wrapAngle(captain.angle + (enemy.laneOffset || 0) * 0.45);
            targetZ = Math.max(0.18, Math.min(0.92, captain.z - 0.08));
          } else if (mode === 'orbit') {
            formation = wrapAngle(captain.angle + Math.sin(performance.now() / 700 + (enemy.laneOffset || 0) * 5) * 0.5);
            targetZ = Math.min(0.92, captain.z + 0.02);
          } else if (mode === 'wedge') {
            formation = wrapAngle(captain.angle + (enemy.laneOffset || 0) * 1.15);
            targetZ = Math.max(0.16, captain.z - 0.15);
          } else if (mode === 'swarm') {
            formation = wrapAngle(this.playerAngle + (enemy.laneOffset || 0) * 2.6 + Math.sin(enemy.wobble) * 0.35);
            targetZ = 0.2;
            ownFire = true;
          } else {
            formation = wrapAngle(this.playerAngle + (enemy.laneOffset || 0) * 1.6 + Math.sin(enemy.wobble) * 0.12);
            targetZ = Math.max(0.16, Math.min(0.72, captain.z - 0.14));
          }
          enemy.angle = moveAngle(enemy.angle, formation, (1.15 + this.wave * 0.02) * diff * dt);
          enemy.z += clamp(targetZ - enemy.z, -speedBase * 0.8 * dt, speedBase * 0.8 * dt);
          if (ownFire) {
            enemy.fireTimer -= dt;
            if (enemy.fireTimer <= 0 && !this.boss) {
              enemy.fireTimer = Math.max(0.8, (2.4 - this.wave * 0.08) / diff) + Math.random() * 0.5;
              this.spawnEnemyBullet(enemy.angle, enemy.z, ENEMY_TYPES.enemy.damage - 10);
            }
          } else {
            enemy.fireTimer = 99;
          }
        } else {
          if (enemy.fireTimer > 90) enemy.fireTimer = 0.8;
          const desired = wrapAngle(this.playerAngle + (enemy.laneOffset || 0) + Math.sin(enemy.wobble) * 0.12);
          enemy.angle = moveAngle(enemy.angle, desired, (0.75 + this.wave * 0.02) * diff * dt);
          if (threat && enemy.dodgeCooldown <= 0) {
            const side = Math.sign(angleDelta(threat.angle, enemy.angle)) || 1;
            enemy.angle = wrapAngle(enemy.angle + side * 0.28);
            enemy.dodgeCooldown = 0.9;
          }
          if (enemy.z > 0.34) enemy.z -= speedBase * enemy.speedFactor * dt;
          else enemy.z += Math.sin(enemy.wobble * 1.7) * 0.015 * dt;
          if (enemy.modeTimer <= 0) {
            enemy.modeTimer = 2.4 + Math.random() * 2.6;
            if (Math.random() < 0.35) enemy.diveTimer = 0.75;
          }
          if (enemy.diveTimer > 0) {
            enemy.diveTimer -= dt;
            enemy.z -= 0.22 * dt;
          }
          if (enemy.fireTimer <= 0 && !this.boss) {
            enemy.fireTimer = Math.max(0.55, (2.8 - this.wave * 0.12) / diff) + Math.random() * 0.45;
            this.spawnEnemyBullet(enemy.angle, enemy.z, ENEMY_TYPES.enemy.damage - 10);
          }
        }
      } else if (enemy.type === 'elite') {
        enemy.fireTimer -= dt;
        enemy.squadTimer -= dt;
        if (!enemy.squadMode) enemy.squadMode = 'assault';
        if (enemy.hp < enemy.maxHp * 0.4 && enemy.squadMode !== 'defense') {
          enemy.squadMode = 'defense';
          enemy.squadTimer = 7;
        } else if (enemy.squadTimer <= 0) {
          const choices = SQUAD_MODES.filter((mode) => mode !== enemy.squadMode);
          enemy.squadMode = choices[Math.floor(Math.random() * choices.length)];
          enemy.squadTimer = 5.5 + Math.random() * 2.5;
        }
        enemy.missileTimer -= dt;
        enemy.dodgeCooldown -= dt;
        let desired = wrapAngle(this.playerAngle + (enemy.laneOffset || 0) + Math.sin(enemy.wobble) * 0.08);
        if (threat && enemy.dodgeCooldown <= 0) {
          const side = Math.sign(angleDelta(threat.angle, enemy.angle)) || 1;
          desired = wrapAngle(enemy.angle + side * 0.5);
          enemy.dodgeCooldown = 0.6;
        }
        enemy.angle = moveAngle(enemy.angle, desired, (1.25 + this.wave * 0.03) * diff * dt);
        const standoffByMode = { defense: 0.64, assault: 0.44, orbit: 0.5, wedge: 0.4, swarm: 0.52 };
        const standoff = standoffByMode[enemy.squadMode] || 0.44;
        if (threat) enemy.z = Math.min(0.92, enemy.z + 0.3 * dt);
        else if (enemy.z > standoff) enemy.z -= speedBase * 0.55 * dt;
        if (enemy.fireTimer <= 0) {
          const modeFactorByMode = { defense: 1.25, assault: 0.9, orbit: 1.0, wedge: 0.8, swarm: 1.1 };
          const modeFactor = modeFactorByMode[enemy.squadMode] || 0.9;
          enemy.fireTimer = Math.max(1.2, (3.1 - this.wave * 0.1) / diff) * modeFactor + Math.random() * 0.4;
          enemy.burstLeft = 3;
          enemy.burstTimer = 0;
          for (const wing of this.enemies) {
            if (wing.escort && wing.type === 'enemy' && !wing.dead) {
              this.spawnEnemyBullet(wing.angle, wing.z, ENEMY_TYPES.enemy.damage - 10);
            }
          }
        }
        if (enemy.burstLeft > 0) {
          enemy.burstTimer -= dt;
          if (enemy.burstTimer <= 0) {
            this.spawnEnemyBullet(enemy.angle, enemy.z, ENEMY_TYPES.elite.damage - 10);
            enemy.burstLeft -= 1;
            enemy.burstTimer = 0.12;
          }
        }
        if (enemy.missileTimer <= 0) {
          enemy.missileTimer = Math.max(2.0, (5.5 - this.wave * 0.12) / diff);
          this.spawnEnemyMissile(enemy, ENEMY_TYPES.elite.damage - 10);
        }
      }
    }
    for (const enemy of this.enemies) {
      for (const bullet of this.bullets) {
        if (Math.abs(angleDelta(enemy.angle, bullet.angle)) < 0.10 &&
            Math.abs(enemy.z - bullet.z) < 0.055) {
          if (bullet.hitIds && bullet.hitIds.has(enemy.id)) continue;
          enemy.hp -= bullet.damage || BULLET_DAMAGE;
          enemy.flashUntil = performance.now() + 90;
          if (bullet.piercing) bullet.hitIds.add(enemy.id);
          else bullet.dead = true;
          const hitPoint = this.project(enemy.angle, enemy.z);
          this.spawnBurst(hitPoint.x, hitPoint.y, 3, 70);
          if (enemy.hp <= 0) this.killEnemy(enemy);
          if (!bullet.piercing) break;
        }
      }
    }
    if (this.boss) {
      for (const bullet of this.bullets) {
        if (Math.abs(angleDelta(this.boss.angle, bullet.angle)) < 0.30 &&
            Math.abs(this.boss.z - bullet.z) < 0.16) {
          if (bullet.hitIds && bullet.hitIds.has('boss')) continue;
          this.boss.hp -= bullet.damage || BULLET_DAMAGE;
          this.boss.flashUntil = performance.now() + 90;
          if (bullet.piercing) bullet.hitIds.add('boss');
          else bullet.dead = true;
          const hitPoint = this.project(this.boss.angle, this.boss.z);
          this.spawnBurst(hitPoint.x, hitPoint.y, 4, 90);
          if (this.boss.hp <= 0) this.killBoss();
          if (!this.boss) break;
        }
      }
    }
    const invulnerable = performance.now() < this.invulnUntil;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (enemy.z <= 0.05) {
        enemy.dead = true;
        if (!invulnerable && Math.abs(angleDelta(enemy.angle, this.playerAngle)) < 0.20) {
          this.hitPlayer(ENEMY_TYPES[enemy.type].damage);
        }
      }
    }
    this.bullets = this.bullets.filter((bullet) => !bullet.dead);
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);

    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const floater of this.floaters) {
      floater.life -= dt;
      floater.y -= 22 * dt;
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0);

    for (const star of this.stars) {
      star.dist += star.speed * dt;
      if (star.dist >= 1) Object.assign(star, this.newStar(true));
    }
    this.playerAngleVisible = this.playerAngle;
    this.updatePlayer(dt);
  }

  spawnEnemy(type, angleOverride, escort = false) {
    const meta = ENEMY_TYPES[type];
    const spawnAngle = Number.isFinite(angleOverride)
      ? clamp(angleOverride, -Math.PI / 2, Math.PI / 2)
      : (Math.random() * 2 - 1) * (Math.PI / 2 - 0.06);
    const enemy = {
      id: ++this.enemySeq,
      type,
      angle: spawnAngle,
      laneOffset: escort ? (Math.random() * 2 - 1) * 0.16 : (Math.random() * 2 - 1) * 0.5,
      escort,
      modeTimer: 1.5 + Math.random() * 2.5,
      diveTimer: 0,
      spawnAge: 0,
      z: 0.96,
      hp: meta.maxHp,
      maxHp: meta.maxHp,
      speedFactor: type === 'elite' ? 0.85 : 1 + Math.random() * 0.25,
      wobble: Math.random() * Math.PI * 2,
      dodgeCooldown: 0,
      fireTimer: 0.35 + Math.random() * 0.55,
      burstLeft: 0,
      burstTimer: 0,
      missileTimer: type === 'elite' ? 3.2 + Math.random() * 1.8 : 0,
      captainId: null,
      squadMode: null,
      squadTimer: 2.5,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnEliteSquad() {
    const base = (Math.random() * 2 - 1) * (Math.PI / 2 - 0.35);
    const captain = this.spawnEnemy('elite', base);
    captain.squadMode = SQUAD_MODES[Math.floor(Math.random() * SQUAD_MODES.length)];
    captain.squadTimer = 6 + Math.random() * 2;
    const escorts = Math.min(10, 3 + Math.floor(this.wave * 0.55) + Math.floor(Math.random() * 2));
    for (let i = 0; i < escorts; i += 1) {
      const offset = (i - (escorts - 1) / 2) * 0.2 + (Math.random() * 2 - 1) * 0.04;
      const wing = this.spawnEnemy('enemy', base + offset, true);
      wing.captainId = captain.id;
      wing.laneOffset = (i - (escorts - 1) / 2) * 0.22;
    }
  }

  beginBossWarning() {
    this.bossPendingUntil = performance.now() + 2000;
    this.showAlert('⚠ 首领出没', 'BOSS INCOMING');
  }

  showAlert(title, sub, duration = 2000) {
    if (!this.alert) return;
    this.alert.querySelector('.sr-fighter-alert-title').textContent = title;
    this.alert.querySelector('.sr-fighter-alert-sub').textContent = sub;
    this.alert.classList.add('is-visible');
    this.alertUntil = performance.now() + duration;
  }

  spawnBoss() {
    const now = performance.now();
    const hp = 1500 + this.wave * 160;
    this.boss = {
      hp,
      maxHp: hp,
      z: 0.92,
      targetZ: 0.55,
      angle: 0,
      attackTimer: 999,
      dodgeCooldown: 0,
      phase: 1,
      missileTimer: 999,
      dashTimer: 999,
      spawnAge: 0,
      entryOffsetY: -this.h * 0.9,
      introUntil: now + 1300,
    };
    this.bossBullets = [];
    this.bossChargeUntil = 0;
    this.bossHeavyTimer = 7;
    this.bossTimer = 0;
    this.laserUntil = 0;
    this.laserAngle = 0;
    this.laserWidth = 0.5;
    this.laserDamage = 60;
    this.updateHud();
  }

  hitPlayer(damage) {
    if (performance.now() < this.invulnUntil) return;
    let remaining = damage;
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, remaining);
      this.shieldHp -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) this.hp = Math.max(0, this.hp - remaining);
    this.invulnUntil = performance.now() + 1400;
    this.hitFlashUntil = performance.now() + 220;
    const point = this.project(this.playerAngle, 0);
    this.spawnBurst(point.x, point.y, 16, 150);
    this.spawnFloater(point.x, point.y - 18, remaining > 0 ? `-${remaining}` : '护盾');
    if (this.hp <= 0) this.gameOver();
    this.updateHud();
  }

  killEnemy(enemy) {
    enemy.dead = true;
    this.score += ENEMY_TYPES[enemy.type].points;
    this.waveKills += 1;
    const point = this.project(enemy.angle, enemy.z);
    this.spawnBurst(point.x, point.y, 14, 170);
    this.spawnFloater(point.x, point.y - 10, `+${ENEMY_TYPES[enemy.type].points}`);
    this.maybeDrop(enemy.type, point);
    this.addUltCharge(enemy.type === 'elite' ? 2 : 1);
    this.updateHud();
  }

  killBoss() {
    const point = this.project(this.boss.angle, this.boss.z);
    this.spawnBurst(point.x, point.y, 48, 260);
    this.score += ENEMY_TYPES.boss.points;
    this.spawnFloater(point.x, point.y - 20, `+${ENEMY_TYPES.boss.points}`);
    this.maybeDrop('boss', point);
    this.addUltCharge(4);
    this.boss = null;
    this.wave += 1;
    this.waveTimer = 14;
    this.updateHud();
  }

  updatePickups(dt) {
    const target = this.project(this.playerAngle, 0);
    for (const pickup of this.pickups) {
      pickup.life -= dt;
      const dx = target.x - pickup.x;
      const dy = target.y - pickup.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const step = Math.min(dist, 120 * dt);
        pickup.x += (dx / dist) * step;
        pickup.y += (dy / dist) * step;
      }
      if (dist < PICKUP_RADIUS) {
        pickup.dead = true;
        this.collectReward(pickup.type, target);
      }
    }
    this.pickups = this.pickups.filter((pickup) => !pickup.dead && pickup.life > 0);
    this.buffHudTimer -= dt;
    if (this.buffHudTimer <= 0) {
      this.buffHudTimer = 0.25;
      this.updateBuffHud();
      this.updateAbilityHud();
    }
  }

  maybeDrop(kind, point) {
    const drops = kind === 'boss' ? 2 : 1;
    const chance = DROP_CHANCE[kind] || 0;
    for (let i = 0; i < drops; i += 1) {
      if (kind !== 'boss' && Math.random() > chance) continue;
      const ids = Object.keys(REWARD_META).filter((id) =>
        (id !== 'missile' || this.wave >= 3) && (id !== 'cooldown' || this.wave >= 2));
      const type = ids[Math.floor(Math.random() * ids.length)];
      const spread = 18;
      this.pickups.push({
        type,
        x: point.x + (Math.random() * 2 - 1) * spread,
        y: point.y + (Math.random() * 2 - 1) * spread,
        life: PICKUP_LIFE,
        bob: Math.random() * Math.PI * 2,
      });
    }
  }

  collectReward(type, point) {
    const meta = REWARD_META[type];
    if (!meta) return;
    if (type === 'repair') {
      this.hp = Math.min(MAX_HP, this.hp + 40);
    } else if (type === 'screen-clear') {
      for (const enemy of [...this.enemies]) this.killEnemy(enemy);
      this.bossBullets = [];
      if (this.boss) {
        this.boss.hp -= 120;
        if (this.boss.hp <= 0) this.killBoss();
      }
    } else if (type === 'shield') {
      this.shieldHp = 60;
    } else if (type === 'double-shot') {
      if (!this.buffs.tripleShot) this.buffs.doubleShot = 1;
    } else if (type === 'triple-shot') {
      this.buffs.tripleShot = 1;
      this.buffs.doubleShot = 0;
    } else if (type === 'damage-up') {
      this.buffs.damageUp = Math.min(3, (this.buffs.damageUp || 0) + 1);
    } else if (type === 'fire-rate') {
      this.buffs.fireRate = Math.min(3, (this.buffs.fireRate || 0) + 1);
    } else if (type === 'piercing-laser') {
      this.buffs.piercing = 1;
    } else if (type === 'missile') {
      this.buffs.missile = Math.min(3, (this.buffs.missile || 0) + 1);
    } else if (type === 'cooldown') {
      this.buffs.counterCd = Math.min(3, (this.buffs.counterCd || 0) + 1);
    }
    this.spawnBurst(point.x, point.y, 18, 150);
    this.spawnFloater(point.x, point.y - 34, meta.name);
    this.updateBuffHud();
    this.updateHud();
  }

  updateBuffHud() {
    if (!this.buffHud) return;
    const chips = [];
    if (this.shieldHp > 0) chips.push({ id: 'shield', label: '护盾 ' + Math.ceil(this.shieldHp) });
    if (this.buffs.doubleShot) chips.push({ id: 'double-shot', label: '双弹道' });
    if (this.buffs.tripleShot) chips.push({ id: 'triple-shot', label: '三弹道' });
    if (this.buffs.damageUp) chips.push({ id: 'damage-up', label: '伤害 Lv' + this.buffs.damageUp });
    if (this.buffs.fireRate) chips.push({ id: 'fire-rate', label: '射速 Lv' + this.buffs.fireRate });
    if (this.buffs.piercing) chips.push({ id: 'piercing-laser', label: '穿透' });
    if (this.buffs.missile) chips.push({ id: 'missile', label: '导弹 Lv' + this.buffs.missile });
    if (this.buffs.counterCd) chips.push({ id: 'cooldown', label: '反制冷却 Lv' + this.buffs.counterCd });
    const signature = chips.map((chip) => chip.id + ':' + chip.label).join('|');
    if (signature === this.buffSignature) return;
    this.buffSignature = signature;
    this.buffHud.innerHTML = chips.map((chip) => {
      const art = REWARDS[chip.id] && REWARDS[chip.id][this.scheme];
      return '<span class="sr-fighter-buff">' +
        (art ? '<img src="' + art + '" alt="">' : '') +
        chip.label + '</span>';
    }).join('');
  }

  difficulty() {
    return 1 + Math.min(1.5, (this.wave - 1) * 0.1 + this.runTime / 120 * 0.12);
  }

  addUltCharge(value) {
    if (!this.ultUnlocked) return;
    this.ultCharge = Math.min(ULT_MAX, this.ultCharge + value);
    this.updateAbilityHud();
  }

  spawnEnemyBullet(angle, z, damage) {
    this.bossBullets.push({ angle, z: z - 0.02, speed: BULLET_SPEED, damage });
  }

  spawnEnemyMissile(source, damage) {
    if (!source) return;
    this.enemyMissiles.push({
      angle: source.angle,
      z: Math.min(0.95, source.z - 0.02),
      speed: ENEMY_MISSILE_SPEED * this.difficulty(),
      turn: 1.25,
      damage,
      life: 6,
    });
    const point = this.project(source.angle, source.z);
    this.spawnBurst(point.x, point.y, 7, 85);
  }

  updateEnemyMissiles(dt) {
    for (const missile of this.enemyMissiles) {
      missile.life -= dt;
      missile.angle = moveAngle(missile.angle, this.playerAngle, missile.turn * dt);
      missile.z -= missile.speed * dt;
      if (missile.z <= 0.04) {
        missile.dead = true;
        const safe = performance.now() < this.invulnUntil;
        if (!safe && Math.abs(angleDelta(missile.angle, this.playerAngle)) < 0.2) {
          this.hitPlayer(missile.damage);
        }
      }
      if (missile.life <= 0 || missile.z < -0.1) missile.dead = true;
    }
    this.enemyMissiles = this.enemyMissiles.filter((missile) => !missile.dead);
  }

  counterCooldownMs() {
    const level = this.buffs.counterCd || 0;
    return COUNTER_COOLDOWN * Math.pow(0.8, level) * 1000;
  }

  fireCounterMissile() {
    if (this.phase !== 'running') return;
    const now = performance.now();
    if (now < (this.counterUntil || 0)) return;
    this.counterUntil = now + this.counterCooldownMs();
    this.spawnPlayerMissile('counter');
    this.updateAbilityHud();
  }

  fireUltimate() {
    if (this.phase !== 'running' || !this.ultUnlocked || this.ultCharge < ULT_MAX) return;
    this.ultCharge = 0;
    this.emUntil = performance.now() + 420;
    this.emAngle = this.playerAngle;
    const beamAngle = this.emAngle;
    for (const enemy of [...this.enemies]) {
      if (Math.abs(angleDelta(enemy.angle, beamAngle)) < 0.13) {
        enemy.hp -= 120;
        enemy.flashUntil = performance.now() + 90;
        const p = this.project(enemy.angle, enemy.z);
        this.spawnBurst(p.x, p.y, 8, 130);
        if (enemy.hp <= 0) this.killEnemy(enemy);
      }
    }
    if (this.boss && Math.abs(angleDelta(this.boss.angle, beamAngle)) < 0.18) {
      this.boss.hp -= 180;
      this.boss.flashUntil = performance.now() + 120;
      const p = this.project(this.boss.angle, this.boss.z);
      this.spawnBurst(p.x, p.y, 20, 180);
      if (this.boss.hp <= 0) this.killBoss();
    }
    this.bossBullets = this.bossBullets.filter((b) => Math.abs(angleDelta(b.angle, beamAngle)) > 0.12);
    this.enemyMissiles = this.enemyMissiles.filter((m) => Math.abs(angleDelta(m.angle, beamAngle)) > 0.12);
    const vp = this.project(beamAngle, 1);
    this.spawnBurst(vp.x, vp.y, 20, 120);
    this.spawnFloater(this.w / 2, this.h * 0.35, '电磁炮');
    this.updateHud();
  }

  spawnPlayerMissile(kind) {
    const from = this.project(this.playerAngle, 0);
    const dirX = Math.sin(this.playerRot || 0);
    const dirY = -Math.cos(this.playerRot || 0);
    const noseDist = Math.max(14, this.playerW * 0.18);
    this.playerMissiles.push({
      kind,
      angle: this.playerAngle,
      z: 0.03,
      speed: kind === 'counter' ? 1.5 : 1.8,
      turn: 2.4,
      ttl: 4.5,
      damage: kind === 'counter' ? 30 : 25,
      target: null,
      sx: from.x + dirX * noseDist,
      sy: from.y + dirY * noseDist,
    });
  }

  findPlayerMissileTarget(kind) {
    let best = null;
    const consider = (entry) => {
      if (!entry) return;
      const value = Math.abs(angleDelta(entry.angle, this.playerAngle)) + entry.z * 0.4;
      if (!best || value < best.value) best = { ...entry, value };
    };
    for (const missile of this.enemyMissiles) {
      if (!missile.dead) consider({ type: 'missile', ref: missile, angle: missile.angle, z: missile.z });
    }
    if (kind === 'counter' && best) return best;
    for (const enemy of this.enemies) {
      if (!enemy.dead) consider({ type: 'enemy', ref: enemy, angle: enemy.angle, z: enemy.z });
    }
    if (this.boss) consider({ type: 'boss', ref: this.boss, angle: this.boss.angle, z: this.boss.z });
    return best;
  }

  updatePlayerMissiles(dt) {
    for (const missile of this.playerMissiles) {
      missile.ttl -= dt;
      const target = this.findPlayerMissileTarget(missile.kind);
      missile.target = target;
      if (target) {
        missile.angle = moveAngle(missile.angle, target.angle, missile.turn * dt);
        const dz = target.z - missile.z;
        missile.z += Math.sign(dz) * Math.min(Math.abs(dz), missile.speed * dt);
        if (Math.abs(dz) < 0.06 && Math.abs(angleDelta(missile.angle, target.angle)) < 0.12) {
          missile.dead = true;
          const point = this.project(target.angle, target.z);
          this.spawnBurst(point.x, point.y, 10, 140);
          if (target.type === 'missile') {
            target.ref.dead = true;
            this.score += 5;
          } else if (target.type === 'enemy') {
            target.ref.hp -= missile.damage;
            target.ref.flashUntil = performance.now() + 90;
            if (target.ref.hp <= 0) this.killEnemy(target.ref);
          } else if (target.type === 'boss') {
            this.boss.hp -= missile.damage;
            this.boss.flashUntil = performance.now() + 90;
            if (this.boss.hp <= 0) this.killBoss();
          }
          this.updateHud();
        }
      } else {
        missile.z += missile.speed * dt;
      }
      if (missile.ttl <= 0 || missile.z > 1.05) missile.dead = true;
    }
    this.playerMissiles = this.playerMissiles.filter((missile) => !missile.dead);
  }

  spawnBurst(x, y, count, force) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = force * (0.25 + Math.random() * 0.75);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.28 + Math.random() * 0.35,
        maxLife: 0.6,
        size: 0.8 + Math.random() * 1.8,
      });
    }
  }

  spawnFloater(x, y, text) {
    this.floaters.push({ x, y, text, life: 0.9, maxLife: 0.9 });
  }

  /* -- projection --------------------------------------------------- */
  project(angle, z) {
    const s = 1 / (1 + z * 5.2);
    return {
      x: this.w / 2 + Math.sin(angle) * this.w * 0.47 * s,
      y: this.h * 0.52 + Math.cos(angle) * this.h * 0.40 * s,
      s,
    };
  }

  updatePlayer(dt = 0.016) {
    const point = this.project(this.playerAngle, 0);
    const vp = this.project(this.playerAngle, 1);
    const aim = clamp(-this.playerAngle * 0.62, -0.9, 0.9);
    const diff = angleDelta(aim, this.playerRot || 0);
    this.playerRot = (this.playerRot || 0) + diff * Math.min(1, dt * 14);
    this.player.style.transform = `translate3d(${point.x.toFixed(1)}px, ${(point.y - this.h * 0.03).toFixed(1)}px, 0) `
      + `translate(-50%, -78%) rotate(${this.playerRot.toFixed(3)}rad)`;
    const invuln = performance.now() < this.invulnUntil;
    this.player.classList.toggle('is-invulnerable', invuln);
  }

  /* -- drawing ------------------------------------------------------ */
  draw() {
    const { ctx, w, h, colors } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    // warp starfield behind the tunnel
    const cx = w / 2;
    const cy = h * 0.52;
    const maxR = Math.hypot(w, h) * 0.62;
    ctx.strokeStyle = colors.star;
    ctx.fillStyle = colors.star;
    for (const star of this.stars) {
      const r1 = star.dist * maxR;
      const r0 = Math.max(0, r1 - 22 * star.speed);
      const dx = Math.cos(star.angle);
      const dy = Math.sin(star.angle);
      ctx.globalAlpha = clamp(star.dist, 0, 1);
      ctx.lineWidth = star.size;
      ctx.beginPath();
      ctx.moveTo(cx + dx * r0, cy + dy * r0 * 0.62);
      ctx.lineTo(cx + dx * r1, cy + dy * r1 * 0.62);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // enemies, far to near
    const sorted = [...this.enemies].sort((a, b) => b.z - a.z);
    for (const enemy of sorted) this.drawEnemy(enemy);
    if (this.boss) this.drawEnemy({ ...this.boss, type: 'boss' });

    // reward pickups
    for (const pickup of this.pickups) {
      const img = this.rewardImages[pickup.type];
      const bob = Math.sin(performance.now() / 260 + pickup.bob) * 3;
      const size = 28;
      this.ctx.globalAlpha = pickup.life < 2 ? 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 120)) : 0.95;
      if (img && img.complete && img.naturalWidth) {
        this.ctx.drawImage(img, pickup.x - size / 2, pickup.y - size / 2 + bob, size, size);
      } else {
        this.ctx.strokeStyle = this.colors.fg;
        this.ctx.beginPath();
        this.ctx.arc(pickup.x, pickup.y + bob, 10, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.globalAlpha = 1;
    }

    // bullets
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 2;
    for (const bullet of this.bullets) {
      const t = clamp((bullet.z - 0.02) / 0.95, 0, 1);
      const t2 = clamp(t + 0.09, 0, 1);
      const x1 = bullet.sx + (bullet.ex - bullet.sx) * t;
      const y1 = bullet.sy + (bullet.ey - bullet.sy) * t;
      const x2 = bullet.sx + (bullet.ex - bullet.sx) * t2;
      const y2 = bullet.sy + (bullet.ey - bullet.sy) * t2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // hostile tracking missiles — thick trail, warhead ring and lock-on ring
    for (const missile of this.enemyMissiles) {
      const from = this.project(missile.angle, missile.z);
      const to = this.project(missile.angle, missile.z - 0.2);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 90);
      ctx.strokeStyle = colors.fg;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(from.x - 6, from.y + 6);
      ctx.lineTo(from.x, from.y);
      ctx.lineTo(from.x + 6, from.y + 6);
      ctx.stroke();
      ctx.globalAlpha = 0.35 + pulse * 0.5;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(from.x, from.y, 5 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // incoming-missile warning around the player
    if (this.enemyMissiles.some((missile) =>
      missile.z < 0.4 && Math.abs(angleDelta(missile.angle, this.playerAngle)) < 0.35)) {
      const point = this.project(this.playerAngle, 0);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 110);
      ctx.globalAlpha = 0.35 + pulse * 0.45;
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 20 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // player counter / buff missiles
    for (const missile of this.playerMissiles) {
      const from = this.project(missile.angle, missile.z);
      const to = this.project(missile.angle, Math.min(1, missile.z + 0.06));
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = missile.kind === 'counter' ? 2.2 : 1.8;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // X: electromagnetic cannon
    if (performance.now() < (this.emUntil || 0)) {
      const from = this.project(this.emAngle, 0);
      const to = this.project(this.emAngle, 1);
      ctx.strokeStyle = colors.fg;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      for (const offset of [-0.018, 0.018]) {
        const a = this.project(this.emAngle + offset, 0);
        const b = this.project(this.emAngle + offset, 1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // boss burst laser — thick core, moving pulses, shockwave and screen flash
    if (this.boss && performance.now() < (this.laserUntil || 0)) {
      const now = performance.now();
      const origin = this.project(this.laserAngle, this.boss.z);
      const left = this.project(this.laserAngle - this.laserWidth, 0);
      const right = this.project(this.laserAngle + this.laserWidth, 0);
      const center = this.project(this.laserAngle, 1);
      const elapsed = now - (this.laserStartedAt || now);
      const appear = clamp(elapsed / 220, 0, 1);
      ctx.fillStyle = colors.fg;
      ctx.globalAlpha = 0.18 * appear;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 24;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(center.x, center.y);
      ctx.stroke();
      ctx.lineWidth = 10;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(center.x, center.y);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(center.x, center.y);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(center.x, center.y);
      ctx.stroke();
      // moving energy pulses along the beam
      for (let i = 0; i < 4; i += 1) {
        const t = ((now - (this.laserStartedAt || now)) / 260 + i / 4) % 1;
        const x = origin.x + (center.x - origin.x) * t;
        const y = origin.y + (center.y - origin.y) * t;
        ctx.globalAlpha = 0.9 * (1 - Math.abs(t - 0.5) * 0.8);
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.stroke();
      }
      // shockwave at the muzzle and near the target
      const wave = clamp(elapsed / 520, 0, 1);
      ctx.globalAlpha = (1 - wave) * 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, 18 + wave * 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(left.x, left.y, 12 + wave * 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (performance.now() < (this.laserFlashUntil || 0)) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = colors.fg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    // boss projectiles (aimed shots + charged spread)
    for (const bullet of this.bossBullets) {
      const from = this.project(bullet.angle, bullet.z);
      const to = this.project(bullet.angle, bullet.z - 0.10);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = bullet.heavy ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // boss charging telegraph: show the exact danger lane before it fires
    if (this.boss && performance.now() < (this.bossChargeUntil || 0)) {
      const point = this.project(this.boss.angle, this.boss.z);
      const phase = this.boss.hp <= this.boss.maxHp * 0.5 ? 2 : 1;
      const width = phase === 2 ? 0.42 : 0.30;
      const left = this.project(this.boss.angle - width, 0);
      const right = this.project(this.boss.angle + width, 0);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 70);
      ctx.globalAlpha = 0.06 + pulse * 0.06;
      ctx.fillStyle = colors.fg;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.45 + pulse * 0.35;
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(left.x, left.y);
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 24 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // explosion particles + score floaters
    ctx.strokeStyle = colors.fg;
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.lineWidth = particle.size;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - particle.vx * 0.025, particle.y - particle.vy * 0.025);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.fg;
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    for (const floater of this.floaters) {
      ctx.globalAlpha = clamp(floater.life / floater.maxLife, 0, 1);
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;

    // boss HP bar
    if (this.boss) {
      const ratio = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      const barW = Math.min(260, this.w * 0.42);
      const x = (this.w - barW) / 2;
      const y = this.h - 34;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barW, 5);
      ctx.fillStyle = colors.fg;
      ctx.fillRect(x + 1, y + 1, (barW - 2) * ratio, 3);
      ctx.globalAlpha = 0.65;
      ctx.font = '9px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BOSS', this.w / 2, y - 3);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // damage flash
    if (performance.now() < (this.hitFlashUntil || 0)) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = colors.fg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  drawEnemy(enemy) {
    const meta = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.enemy;
    const point = this.project(enemy.angle, enemy.z);
    if (enemy.type === 'boss') point.y += enemy.entryOffsetY || 0;
    if (point.y < -80 || point.x < -80 || point.x > this.w + 80) return;
    const img = this.images[enemy.type] || this.images.enemy;
    const depthScale = 1 / (1 + enemy.z * 2.2);
    const desired = meta.size * depthScale;
    const width = desired / 0.72;
    const height = width * (img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.45);
    if (this.debugEnemies) {
      this.ctx.strokeStyle = '#ff3355';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, Math.max(3, desired / 2), 0, Math.PI * 2);
      this.ctx.stroke();
    }
    const spawnT = clamp(1 - (enemy.spawnAge || 0) / 0.55, 0, 1);
    this.ctx.globalAlpha = 0.92 * (1 - spawnT * 0.75);
    if (img.complete && img.naturalWidth) {
      this.ctx.shadowColor = this.scheme === 'dark' ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.28)';
      this.ctx.shadowBlur = 4;
      const scale = 0.82 + (1 - spawnT) * 0.18;
      this.ctx.drawImage(img, point.x - (width * scale) / 2, point.y - (height * scale) / 2, width * scale, height * scale);
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
    } else {
      this.ctx.strokeStyle = this.colors.fg;
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, desired / 2, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    const flash = performance.now() < (enemy.flashUntil || 0);
    if (flash) {
      this.ctx.globalAlpha = 0.9;
      this.ctx.strokeStyle = this.colors.fg;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, width * 0.55 + 2, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    if (enemy.type === 'elite') {
      const ratio = clamp(enemy.hp / (enemy.maxHp || 1), 0, 1);
      const barW = Math.max(18, width * 0.9);
      const barX = point.x - barW / 2;
      const barY = point.y - height / 2 - 7;
      this.ctx.globalAlpha = 0.8;
      this.ctx.strokeStyle = this.colors.fg;
      this.ctx.lineWidth = 0.8;
      this.ctx.strokeRect(barX, barY, barW, 3);
      this.ctx.fillStyle = this.colors.fg;
      this.ctx.fillRect(barX + 0.5, barY + 0.5, (barW - 1) * ratio, 2);
    }
    this.ctx.globalAlpha = 1;
  }

  /* -- diagnostics -------------------------------------------------- */
  ping(event) {
    try {
      const url = `/arcade/ping?build=fighter&data=${encodeURIComponent(JSON.stringify({
        event, score: this.score, best: this.best, hp: this.hp, wave: this.wave,
      }))}`;
      fetch(url, { cache: 'no-store' }).catch(() => {});
    } catch { /* best effort */ }
  }
}
