/**
 * dsh-arcade · browser half (plugin wiring).
 *
 * Registers the game panel into `conversation.input.dock` — the composer's
 * full-width dock in normal flow, so the stage takes real layout space
 * directly above the input card instead of floating over the conversation.
 * Clicking the shaking whale tail next to "深度求索中" toggles the game.
 */
import { agentRunning, gameOpen, themeScheme } from './state.js';
import { ping } from './ping.js';
import { injectStyle } from './styles.js';
import { createGamePanel } from './panel.js';
import { createSettingsPanel } from './settings.js';
import { BUILD } from './version.js';

/* Injected by tools/build.mjs: enables a one-shot end-to-end self test that
 * drives the real widget in the open GUI and reports through the host log. */
const SELF_TEST = typeof __SELF_TEST__ !== 'undefined' && __SELF_TEST__;

function schemeOf(ctx) {
  try {
    const snapshot = ctx.theme.getTheme();
    const active = snapshot && snapshot.active;
    if (active && active.colorScheme === 'light') return 'light';
    if (active && active.colorScheme === 'dark') return 'dark';
  } catch { /* fall through */ }
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch { return 'dark'; }
}

/* ------------------------------------------------------------------ *
 * One-shot end-to-end self test (only compiled into the diagnostic build)
 * ------------------------------------------------------------------ */
function runSelfTest(closeGame) {
  if (window.__DSH_ARCADE_SELFTEST_DONE__ === BUILD) return;
  window.__DSH_ARCADE_SELFTEST_DONE__ = BUILD;
  const log = (step, extra) => ping(BUILD, { event: `selftest:${step}`, ...extra });
  const icon = () => document.querySelector('[data-chat-running] [class*="_runningIcon"]');
  const clickIcon = () => {
    const el = icon();
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view: window }));
    return true;
  };
  const snap = () => (window.__DSH_ARCADE_DEBUG__ ? window.__DSH_ARCADE_DEBUG__.snapshot() : null);
  const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));

  setTimeout(() => {
    // The real user path is clicking the whale tail, but the tail only exists
    // while a turn is streaming — fall back to the dev handle so the rest of
    // the test still exercises the real panel.
    const found = Boolean(icon());
    const clicked = found ? clickIcon() : false;
    let openedVia = clicked ? 'tail' : 'none';
    if (!clicked && window.__DSH_ARCADE__) {
      window.__DSH_ARCADE__.setOpen(true);
      openedVia = 'api';
    }
    log('tail-click', { iconFound: found, clicked, openedVia, open: gameOpen.get() });
  }, 400);

  setTimeout(() => {
    const root = document.querySelector('[data-arcade]');
    const card = document.querySelector('[data-composer-card]');
    const rootRect = root && root.getBoundingClientRect();
    const cardRect = card && card.getBoundingClientRect();
    log('mounted', {
      hasRoot: Boolean(root),
      width: rootRect ? Math.round(rootRect.width) : null,
      height: rootRect ? Math.round(rootRect.height) : null,
      widthMatchesCard: Boolean(rootRect && cardRect && Math.abs(rootRect.width - cardRect.width) < 1.5),
      leftDelta: Boolean(rootRect && cardRect) ? Math.round(rootRect.left - cardRect.left) : null,
      gapAboveCard: Boolean(rootRect && cardRect) ? Math.round(cardRect.top - rootRect.bottom) : null,
      ...snap(),
    });
    key('keydown');
  }, 1000);

  setTimeout(() => {
    log('airborne', snap());
    key('keyup');
  }, 1220);

  setTimeout(() => { log('mid-run', snap()); }, 2000);

  // Timed jump through the first food slot: verifies the floating food is
  // collected and awards points (obstacles are parked for now).
  setTimeout(() => { key('keydown'); }, 2350);
  setTimeout(() => { key('keyup'); }, 2540);
  setTimeout(() => { log('collect', snap()); }, 3000);

  setTimeout(() => { log('collision', snap()); }, 3400);

  setTimeout(() => {
    const before = snap();
    key('keydown');
    key('keyup');
    setTimeout(() => log('restart', { before, after: snap() }), 200);
  }, 3650);

  setTimeout(() => {
    closeGame();
    log('closed', { open: gameOpen.get() });
  }, 4200);
}

function factory(require) {
  const React = require('react');
  const GamePanel = createGamePanel(React);
  const ArcadeSettings = createSettingsPanel(React);
  return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        injectStyle();

        const syncTheme = () => { themeScheme.set(schemeOf(ctx)); };
        syncTheme();
        ctx.effect(() => ctx.on('theme/change', syncTheme), 'dsh-arcade: theme listener');

        // Track "深度求索中" and hide that host row while the game is expanded,
        // so the road/game occupies the space right above the input box alone.
        const syncRunning = () => {
          const runningRow = document.querySelector('[data-chat-running]');
          agentRunning.set(Boolean(runningRow));
          if (!runningRow) return;
          const hidden = gameOpen.get();
          runningRow.style.visibility = hidden ? 'hidden' : '';
          runningRow.style.pointerEvents = hidden ? 'none' : '';
        };
        const runningObserver = new MutationObserver(syncRunning);
        runningObserver.observe(document.body, { childList: true, subtree: true });
        const stopOpenWatch = gameOpen.subscribe(syncRunning);
        ctx.effect(() => {
          syncRunning();
          return () => { runningObserver.disconnect(); stopOpenWatch(); };
        }, 'dsh-arcade: running state');

        const onError = (event) => {
          const text = String((event && (event.message || event.reason)) || '');
          const file = String((event && event.filename) || '');
          if (!/arcade|running-maid/i.test(text) && !/arcade|running-maid/i.test(file)) return;
          ping(BUILD, { error: text.slice(0, 400) });
        };
        ctx.effect(() => {
          window.addEventListener('error', onError);
          window.addEventListener('unhandledrejection', onError);
          return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onError);
          };
        }, 'arcade: error reporting');

        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'arcade',
          order: 80,
        }, GamePanel));

        // DSH Settings → dsh-arcade: pick which mini-game the composer entry starts.
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-arcade',
          order: 90,
          label: () => 'dsh-arcade',
        }, ArcadeSettings));

        // Tiny dev handle, no model-facing effect.
        Object.defineProperty(window, '__DSH_ARCADE__', {
          value: {
            build: BUILD,
            get open() { return gameOpen.get(); },
            setOpen: (value) => gameOpen.set(Boolean(value)),
            toggle: () => gameOpen.set(!gameOpen.get()),
          },
          configurable: true,
        });

        setTimeout(() => ping(BUILD, { event: 'plugin-applied' }), 60);
        if (SELF_TEST) setTimeout(() => runSelfTest(() => gameOpen.set(false)), 500);
      },
    };
}

// The browser module id must equal the published package name.
window.__ModuleLoader__.load({
  id: '@kennielearngames/dsh-arcade',
  factory,
});
