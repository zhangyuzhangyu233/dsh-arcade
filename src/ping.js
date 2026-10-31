/**
 * Diagnostics breadcrumb. The host half (index.js) appends every ping to
 * `%TEMP%/dsh-arcade/diagnostics.log`, which is how the Web build can be
 * verified from outside the browser. Best effort by design: never throws.
 */
import { gameOpen, themeScheme } from './state.js';

export const PING_URL = '/arcade/ping';

export function ping(build, extra) {
  try {
    const running = document.querySelector('[data-chat-running]');
    const icon = running && running.querySelector('[class*="_runningIcon"]');
    const card = document.querySelector('[data-composer-card]');
    const data = {
      build,
      scheme: themeScheme.get(),
      open: gameOpen.get(),
      cardW: card ? Math.round(card.getBoundingClientRect().width) : null,
      running: Boolean(running),
      iconFound: Boolean(icon),
      iconClass: icon ? String(icon.className).slice(0, 120) : null,
      ...extra,
    };
    fetch(`${PING_URL}?build=${encodeURIComponent(build)}&data=${encodeURIComponent(JSON.stringify(data))}`,
      { cache: 'no-store' }).catch(() => {});
  } catch { /* diagnostics are best effort */ }
}
