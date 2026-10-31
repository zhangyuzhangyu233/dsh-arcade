/** Tiny observable stores shared by the panel, the engine, and the plugin. */
export function createStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (value === next) return;
      value = next;
      for (const listener of [...listeners]) {
        try { listener(value); } catch { /* one bad listener must not break the rest */ }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const gameOpen = createStore(false);
export const themeScheme = createStore('dark');
export const phaseStore = createStore('running');
/** True while the host is streaming a turn ("深度求索中" indicator is present). */
export const agentRunning = createStore(false);

const BEST_KEY = 'dsh-arcade.best';

export function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

export function writeBest(value) {
  try { localStorage.setItem(BEST_KEY, String(value)); } catch { /* private mode */ }
}
