/**
 * React panel: lives in the composer dock (normal flow, real layout space
 * directly above the input card) and mounts the stage DOM for the engine.
 */
import { ASSETS } from './generated/assets.js';
import { ENTRY_MAID } from './generated/entry-maid.js';
import { BASE_SPEED, Engine, speedKmh } from './engine.js';
import { ping } from './ping.js';
import { agentRunning, gameOpen, phaseStore, readBest, themeScheme } from './state.js';
import { BUILD } from './version.js';

export function createGamePanel(React) {
  const h = React.createElement;

  class Boundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { failed: false };
    }
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error, info) {
      ping(BUILD, {
        event: 'render-error',
        error: String((error && error.stack) || error).slice(0, 900),
        where: String((info && info.componentStack) || '').slice(0, 300),
      });
    }
    render() {
      return this.state.failed ? null : h(GamePanelImpl, this.props);
    }
  }

  function GamePanelImpl() {
    const [open, setOpen] = React.useState(gameOpen.get());
    const [running, setRunning] = React.useState(agentRunning.get());
    const [scheme, setScheme] = React.useState(themeScheme.get());
    const [phase, setPhase] = React.useState(phaseStore.get());

    React.useEffect(() => gameOpen.subscribe(setOpen), []);
    React.useEffect(() => agentRunning.subscribe(setRunning), []);
    React.useEffect(() => themeScheme.subscribe(setScheme), []);
    React.useEffect(() => phaseStore.subscribe(setPhase), []);
    React.useEffect(() => { ping(BUILD, { event: 'panel-mounted', open: gameOpen.get() }); }, []);

    const stageRef = React.useRef(null);
    const runnerRef = React.useRef(null);
    const obstaclesRef = React.useRef(null);
    const hazardsRef = React.useRef(null);
    const pitsRef = React.useRef(null);
    const foodsRef = React.useRef(null);
    const popsRef = React.useRef(null);
    const groundRef = React.useRef(null);
    const scoreRef = React.useRef(null);
    const bestRef = React.useRef(null);
    const speedRef = React.useRef(null);
    const powerupsRef = React.useRef(null);
    const powerRef = React.useRef(null);
    const rootRef = React.useRef(null);
    const shadeTitleRef = React.useRef(null);
    const shadeSubRef = React.useRef(null);
    const engineRef = React.useRef(null);
    const entryMaidRef = React.useRef(null);

    const close = React.useCallback(() => { gameOpen.set(false); }, []);

    // Expanded game matches the input card's width. The closed entry is a
    // free-floating maid pinned just left of the input card (no card/scrim).
    React.useEffect(() => {
      if (!open && !running) return undefined;
      const rootEl = rootRef.current;
      const card = document.querySelector('[data-composer-card]');
      if (!rootEl) return undefined;
      const sync = () => {
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        if (cardRect.width <= 240) return;
        if (!gameOpen.get()) {
          const width = 98;
          const left = Math.max(8, Math.round(cardRect.left - width - 10));
          const top = Math.round(cardRect.top + cardRect.height - 78 - 10);
          rootEl.style.position = 'fixed';
          rootEl.style.left = `${left}px`;
          rootEl.style.top = `${top}px`;
          rootEl.style.width = 'auto';
          rootEl.style.maxWidth = 'none';
          rootEl.style.marginLeft = '0px';
          return;
        }
        rootEl.style.position = '';
        rootEl.style.left = '';
        rootEl.style.top = '';
        rootEl.style.width = `${Math.round(cardRect.width)}px`;
        rootEl.style.maxWidth = '100%';
        // The dock spans the whole composer seat; centre the stage exactly on
        // the input card and match its width.
        rootEl.style.marginLeft = '0px';
        const rootRect = rootEl.getBoundingClientRect();
        const delta = cardRect.left - rootRect.left;
        rootEl.style.marginLeft = `${Math.max(0, Math.round(delta))}px`;
      };
      sync();
      let observer = null;
      if (typeof ResizeObserver === 'function' && card) {
        observer = new ResizeObserver(sync);
        observer.observe(card);
      }
      window.addEventListener('resize', sync);
      return () => {
        if (observer) observer.disconnect();
        window.removeEventListener('resize', sync);
      };
    }, [open, running]);

    React.useEffect(() => {
      if (!open) return undefined;
      const dom = {
        root: rootRef.current,
        stage: stageRef.current,
        runner: runnerRef.current,
        obstacles: obstaclesRef.current,
        hazards: hazardsRef.current,
        pits: pitsRef.current,
        foods: foodsRef.current,
        stars: powerupsRef.current,
        pops: popsRef.current,
        ground: groundRef.current,
        score: scoreRef.current,
        best: bestRef.current,
        speed: speedRef.current,
        power: powerRef.current,
        shadeTitle: shadeTitleRef.current,
        shadeSub: shadeSubRef.current,
      };
      if (!dom.root || !dom.stage || !dom.runner) return undefined;
      let engine;
      try {
        engine = new Engine(dom, { intro: true, onPhase: (next) => phaseStore.set(next) });
      } catch (error) {
        ping(BUILD, { event: 'engine-error', error: String((error && error.stack) || error).slice(0, 900) });
        return undefined;
      }
      engineRef.current = engine;
      engine.applyScheme(themeScheme.get());
      if (dom.best) dom.best.textContent = String(readBest());
      window.__DSH_ARCADE_DEBUG__ = {
        engine,
        snapshot: () => ({
          phase: engine.phase,
          score: engine.score,
          bonus: engine.bonus,
          speed: Math.round(engine.speed),
          runnerY: Math.round(engine.runnerY),
          vy: Math.round(engine.vy),
          sliding: engine.sliding,
          foods: engine.foods.length,
          stars: engine.stars.length,
          hazards: engine.hazards.length,
          invincible: engine.invincible,
          shield: engine.shield,
          buffs: Object.keys(engine.buffs).filter((id) => engine.buffs[id] > engine.elapsed).join(','),
          collected: engine.collected,
          frame: engine.frameIndex,
          scheme: engine.scheme,
        }),
      };
      ping(BUILD, { event: 'game-open' });
      // Layout diagnostics for the dock placement (kept tiny; host logs it).
      try {
        const root = dom.root;
        const cs = getComputedStyle(root);
        const rect = root.getBoundingClientRect();
        const chain = [];
        let node = root.parentElement;
        for (let i = 0; i < 4 && node; i += 1) {
          const ncs = getComputedStyle(node);
          const r = node.getBoundingClientRect();
          chain.push({
            tag: node.tagName.toLowerCase(),
            cls: String(node.className || '').slice(0, 60),
            pos: ncs.position,
            display: ncs.display,
            bg: ncs.backgroundColor,
            h: Math.round(r.height),
            w: Math.round(r.width),
          });
          node = node.parentElement;
        }
        ping(BUILD, {
          event: 'layout',
          bg: cs.backgroundColor,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          parent: chain[1] ? { cls: chain[1].cls, display: chain[1].display, h: chain[1].h } : null,
        });
      } catch (error) {
        ping(BUILD, { event: 'layout-error', error: String((error && error.stack) || error).slice(0, 400) });
      }

      const isJumpKey = (event) => event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW';
      const isSlideKey = (event) => event.code === 'ArrowDown' || event.code === 'KeyS';
      const editable = (target) => target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' || target.isContentEditable);
      const onKey = (event) => {
        if (event.key === 'Escape') { close(); return; }
        if (event.repeat || editable(event.target)) return;
        if (isSlideKey(event)) {
          event.preventDefault();
          engine.slide();
          return;
        }
        if (!isJumpKey(event)) return;
        event.preventDefault();
        engine.jump();
      };
      const onKeyUp = (event) => {
        if (isSlideKey(event)) engine.releaseSlide();
        if (isJumpKey(event)) engine.release();
      };
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKeyUp);
      return () => {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKeyUp);
        engine.destroy();
        engineRef.current = null;
        window.__DSH_ARCADE_DEBUG__ = undefined;
        if (gameOpen.get()) gameOpen.set(false);
        ping(BUILD, { event: 'game-close' });
      };
    }, [open, close]);

    React.useEffect(() => {
      if (engineRef.current) engineRef.current.applyScheme(scheme);
    }, [scheme]);

    // Closed-but-streaming: a small road strip above the input, with the maid
    // running on it. Clicking it expands the same strip into the game.
    React.useEffect(() => {
      if (open || !running) return undefined;
      let raf = 0;
      let last = 0;
      let index = 0;
      const step = (now) => {
        raf = requestAnimationFrame(step);
        if (now - last < 20) return;
        last = now;
        const frames = ENTRY_MAID[scheme].frames;
        index = (index + 1) % frames.length;
        if (entryMaidRef.current) entryMaidRef.current.src = frames[index];
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, [open, running, scheme]);

    if (!open && !running) return null;

    if (!open) {
      const openGame = (event) => {
        event.stopPropagation();
        gameOpen.set(true);
      };
      return h('div', {
        ref: rootRef,
        className: 'sr-root sr-entry-root',
        style: { color: scheme === 'dark' ? '#f9fafb' : '#0f1115' },
        'data-arcade': 'stage',
        'data-scheme': scheme,
        'data-sr-mode': 'entry',
        role: 'button',
        'aria-label': '点击开始 dsh-arcade',
        onPointerDown: openGame,
        onMouseDown: (event) => event.stopPropagation(),
        onClick: openGame,
      },
      h('div', { className: 'sr-entry' },
        h('img', {
          ref: entryMaidRef,
          className: 'sr-entry-maid',
          alt: '',
          draggable: false,
          src: ENTRY_MAID[scheme].frames[0],
        }),
      ));
    }

    const tap = (event) => {
      event.stopPropagation();
      if (event.button !== undefined && event.button !== 0) return;
      if (engineRef.current) engineRef.current.jump();
    };
    const stop = (event) => { event.stopPropagation(); };

    return h('div', {
      ref: rootRef,
      className: 'sr-root',
      style: {
        // Inline beats any app rule that might target slot children.
        backgroundColor: scheme === 'dark' ? '#232324' : '#ffffff',
        color: scheme === 'dark' ? '#f9fafb' : '#0f1115',
      },
      'data-arcade': 'stage',
      'data-scheme': scheme,
      'data-sr-mode': 'game',
      'data-sr-phase': phase,
      role: 'application',
      'aria-label': 'dsh-arcade 小游戏',
      onPointerDown: stop,
      onMouseDown: stop,
      onClick: stop,
    },
    h('div', { className: 'sr-stage', ref: stageRef, onPointerDown: tap },
      h('div', { className: 'sr-ground', ref: groundRef }),
      h('div', { className: 'sr-ground2' }),
      h('div', { className: 'sr-obstacles', ref: obstaclesRef }),
      h('div', { className: 'sr-pits', ref: pitsRef }),
      h('div', { className: 'sr-hazards', ref: hazardsRef }),
      h('div', { className: 'sr-foods', ref: foodsRef }),
      h('div', { className: 'sr-stars', ref: powerupsRef }),
      h('img', {
        ref: runnerRef,
        className: 'sr-runner',
        alt: '',
        draggable: false,
        src: ASSETS.maid[scheme].frames[0],
      }),
      h('div', { className: 'sr-pops', ref: popsRef }),
      h('div', { className: 'sr-head' },
        h('span', { className: 'sr-title' }, 'dsh-arcade'),
        h('span', { className: 'sr-spacer' }),
        h('span', { className: 'sr-score' },
          '得分 ',
          h('b', { ref: scoreRef }, '0'),
          ' · 最高 ',
          h('b', { ref: bestRef }, '0'),
        ),
        h('span', { className: 'sr-power', ref: powerRef }),
        h('span', { className: 'sr-speed', ref: speedRef }, `速度 ${Math.round(speedKmh(BASE_SPEED))} km/h`),
      ),
      h('div', { className: 'sr-shade', onPointerDown: tap },
        h('div', { className: 'sr-shade-title', ref: shadeTitleRef }, '撞到啦！'),
        h('div', { className: 'sr-shade-sub', ref: shadeSubRef }, '空格 / 点击 再来一局'),
      ),
      h('button', {
        type: 'button',
        className: 'sr-close',
        'aria-label': '关闭游戏',
        onPointerDown: stop,
        onMouseDown: stop,
        onClick: (event) => { event.stopPropagation(); close(); },
      }, '×'),
    ));
  }

  return Boundary;
}
