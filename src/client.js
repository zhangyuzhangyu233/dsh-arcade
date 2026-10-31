/**
 * dsh-arcade · browser half (plugin wiring).
 *
 * Registers the game panel into `conversation.input.dock` — the composer's
 * full-width dock in normal flow, so the stage takes real layout space
 * directly above the input card instead of floating over the conversation.
 * Clicking the shaking whale tail next to "深度求索中" toggles the game.
 */
import { gameOpen, themeScheme } from './state.js';
import { ping } from './ping.js';
import { injectStyle } from './styles.js';
import { createGamePanel } from './panel.js';
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

/** True only for a click on the running indicator's whale icon. */
function tailClicked(target) {
  if (!target || typeof target.closest !== 'function') return false;
  const running = target.closest('[data-chat-running]');
  if (!running) return false;
  const icon = running.querySelector('[class*="_runningIcon"]');
  if (icon && icon.contains(target)) return true;
  // Class hashes are build-specific: fall back to the still whale SVG's box.
  const still = running.querySelector('svg');
  const holder = still && still.parentElement;
  return Boolean(holder && holder.contains(target));
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
  return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        injectStyle();

        const syncTheme = () => { themeScheme.set(schemeOf(ctx)); };
        syncTheme();
        ctx.effect(() => ctx.on('theme/change', syncTheme), 'dsh-arcade: theme listener');

        const onClick = (event) => {
          if (!tailClicked(event.target)) return;
          gameOpen.set(!gameOpen.get());
        };
        ctx.effect(() => {
          document.addEventListener('click', onClick, true);
          return () => document.removeEventListener('click', onClick, true);
        }, 'arcade: whale tail click');

        const onError = (event) => {
          const text = String((event && (event.message || event.reason)) || '');
          const file = String((event && event.filename) || '');
          if (!/arcade/i.test(text) && !/arcade/i.test(file)) return;
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

// The same bundle registers under both the published scoped package name and the
// local development profile id, so one artifact works in either installation.
const CLIENT_IDS = ['@kennielearngames/dsh-arcade', 'dsh-sushi-run'];
for (const id of CLIENT_IDS) window.__ModuleLoader__.load({ id, factory });
