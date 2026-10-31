/** All game styling. Class names are prefixed `sr-` to stay out of the app's way.
 *
 * Colors are local variables rather than app tokens so the stage is always
 * fully opaque (the app's alias tokens can resolve differently per surface).
 * The values mirror the official light/dark palettes.
 */
export const PANEL_HEIGHT = 236;
export const GROUND_OFFSET = 27;
export const RUNNER_X = 62;
export const RUNNER_H = 78;

export const CSS = `
.sr-root{--sr-bg:#ffffff;--sr-fg:#0f1115;--sr-muted:#61666b;--sr-line:rgba(15,17,21,.16);--sr-soft:rgba(15,17,21,.06);
  position:relative;box-sizing:border-box;width:100%;max-width:100%;height:${PANEL_HEIGHT}px;
  margin:0 auto;border-radius:16px;overflow:hidden;pointer-events:auto;user-select:none;-webkit-user-select:none;
  border:1px solid var(--sr-line);background:var(--sr-bg);color:var(--sr-fg);
  box-shadow:0 10px 30px rgba(0,0,0,.18);font-family:inherit;-webkit-app-region:no-drag;
  animation:sr-root-in .26s ease-out}
/* Entry: a free-floating running maid pinned to the left of the input box,
   with no card/scrim over the page. */
.sr-root[data-sr-mode=entry]{position:fixed;z-index:40;width:auto;height:auto;background:transparent;
  border:none;box-shadow:none;padding:0;overflow:visible;animation:none;cursor:pointer;pointer-events:auto}
.sr-root[data-sr-mode=entry] .sr-entry{position:relative;display:flex;align-items:flex-end;overflow:visible}
.sr-entry-maid{display:block;height:78px;width:auto;image-rendering:pixelated;
  filter:drop-shadow(0 2px 0 rgba(0,0,0,.14))}
.sr-root[data-sr-mode=game]{border:none;box-shadow:none;background:transparent}
.sr-root[data-sr-mode=game] .sr-stage{border-radius:0;background:var(--sr-bg)}
.sr-root[data-scheme=dark]{--sr-bg:#232324;--sr-fg:#f9fafb;--sr-muted:#adb2b8;--sr-line:rgba(255,255,255,.18);--sr-soft:rgba(255,255,255,.07)}
.sr-stage{position:absolute;inset:0;overflow:hidden;border-radius:16px}
.sr-ground{position:absolute;left:0;right:0;bottom:${GROUND_OFFSET}px;height:1.5px;background:var(--sr-line)}
.sr-ground2{position:absolute;left:0;right:0;bottom:${GROUND_OFFSET - 5}px;height:1px;opacity:.5;
  background:repeating-linear-gradient(90deg,var(--sr-line) 0 9px,transparent 9px 26px)}
/* Level intro: the road unrolls from left to right, then the maid starts. */
.sr-root[data-sr-intro='1'] .sr-ground,
.sr-root[data-sr-intro='1'] .sr-ground2{
  clip-path:inset(0 100% 0 0);
  animation:sr-road-reveal .42s .06s cubic-bezier(.16,1,.3,1) forwards;
}
@keyframes sr-road-reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.sr-root[data-sr-intro='1'] .sr-head{opacity:0;animation:sr-head-in .24s .42s ease-out forwards}
@keyframes sr-head-in{to{opacity:1}}
@keyframes sr-root-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
/* Running-indicator entry: the maid replaces the host's whale tail while a turn streams. */
.sr-tail-maid{width:98px;height:78px;max-width:none;max-height:none;object-fit:contain;
  margin:-27px 2px -27px 0;vertical-align:middle;flex:0 0 auto;
  image-rendering:pixelated;cursor:pointer;transform-origin:50% 100%}
.sr-tail-maid:active{transform:translateY(1px)}
.sr-tail-maid:hover{filter:drop-shadow(0 0 3px rgba(255,214,120,.85))}
@media (prefers-reduced-motion: reduce){
  .sr-root{animation:none}
  .sr-root[data-sr-intro='1'] .sr-ground,
  .sr-root[data-sr-intro='1'] .sr-ground2{animation:none;clip-path:none}
  .sr-root[data-sr-intro='1'] .sr-head{animation:none;opacity:1}
}
.sr-runner{position:absolute;bottom:${GROUND_OFFSET - 1}px;left:${RUNNER_X}px;height:${RUNNER_H}px;width:auto;
  pointer-events:none;transform-origin:50% 100%}
.sr-root[data-sr-phase=over] .sr-runner{opacity:.45}
.sr-obstacles,.sr-foods,.sr-stars,.sr-pops{position:absolute;inset:0;pointer-events:none}
/* Hanging bamboo obstacle: it starts at the top edge and its tip floats
   HAZARD_GAP px above the ground, so a standing runner hits it and ducking
   (↓/S) slips under. Only the inner icon animates away when it is smashed. */
.sr-hazards{position:absolute;inset:0;pointer-events:none}
.sr-hazard{position:absolute;top:0;left:0;pointer-events:none;will-change:transform}
.sr-hazard-icon{display:block;width:100%;height:100%}
/* Ground pits: a slot in the ground line with two vertical cliff walls that
   drop out of sight — no filled black block. */
.sr-pits{position:absolute;inset:0;pointer-events:none}
.sr-pit{position:absolute;left:0;bottom:-2px;height:${GROUND_OFFSET + 4}px;box-sizing:border-box;
  border-left:2px solid var(--sr-fg);border-right:2px solid var(--sr-fg);
  background:var(--sr-bg)}
/* Ground spikes are packed edge to edge; the group wrapper sits on the ground. */
.sr-hazard.sr-spikes{top:auto;bottom:${GROUND_OFFSET}px}
/* Claude Code crab enemy, parked on the ground with a little walk bob. */
.sr-hazard.sr-crab{top:auto;bottom:${GROUND_OFFSET}px}
.sr-crab-icon{display:block;width:100%;height:100%;animation:sr-crab-bob .5s ease-in-out infinite}
@keyframes sr-crab-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.sr-spike{position:absolute;bottom:0;display:block}
.sr-hazard-smashed .sr-hazard-icon,
.sr-hazard-smashed .sr-spike,
.sr-hazard-smashed .sr-crab-icon{animation:sr-hazard-smash .5s ease-out forwards}
@keyframes sr-hazard-smash{to{transform:translate3d(30px,-96px,0) rotate(18deg);opacity:0}}
/* Currency gained a short golden pop when the banknote converts it to food. */
.sr-golden{animation:sr-golden .9s ease-out}
@keyframes sr-golden{0%{filter:drop-shadow(0 0 0 rgba(255,200,80,0))}
  30%{filter:drop-shadow(0 0 7px rgba(255,200,80,.9))}
  100%{filter:drop-shadow(0 0 0 rgba(255,200,80,0))}}
.sr-food{position:absolute;left:0;will-change:transform;pointer-events:none;
  filter:drop-shadow(0 2px 3px rgba(127,127,127,.18))}
/* Super-star power-up (the Claude mark). The wrapper is moved by the engine;
   only the inner icon spins, so the two transforms never fight. */
.sr-star{position:absolute;left:0;pointer-events:none;will-change:transform;z-index:2}
.sr-star-icon{display:block;animation:sr-star-spin 6s linear infinite;
  filter:drop-shadow(0 0 5px var(--sr-fg)) drop-shadow(0 0 10px rgba(255,214,120,.3))}
@keyframes sr-star-spin{to{transform:rotate(360deg)}}
/* While invincible the runner gets a restrained warm aura that slowly
   breathes — deliberately no rainbow colour cycling. The header badge carries
   the countdown, so the stage itself stays calm. */
.sr-root[data-sr-invincible='1'] .sr-runner{animation:sr-invincible-aura 2.2s ease-in-out infinite alternate}
@keyframes sr-invincible-aura{
  from{filter:drop-shadow(0 0 3px rgba(226,178,94,.22))}
  to{filter:drop-shadow(0 0 7px rgba(226,178,94,.48))}
}
/* Sundae shield: a thin, static cool outline. It lasts until it breaks, so it
   deliberately doesn't pulse or fight with the star aura. */
.sr-root[data-sr-shield='1'] .sr-runner{filter:drop-shadow(0 0 2.5px rgba(122,170,255,.6))}
.sr-power{display:none;align-items:center;padding:2px 7px;border-radius:999px;font-size:10.5px;font-weight:600;
  line-height:1.4;letter-spacing:.02em;color:#8a5a00;background:rgba(245,158,11,.2);
  font-variant-numeric:tabular-nums;white-space:nowrap}
.sr-root[data-scheme=dark] .sr-power{color:#fcd34d;background:rgba(251,191,36,.16)}
.sr-root[data-sr-power='1'] .sr-power{display:inline-flex}
.sr-pop{position:absolute;left:0;bottom:${GROUND_OFFSET + 78}px;font-size:12.5px;font-weight:600;
  font-variant-numeric:tabular-nums;color:var(--sr-fg);white-space:nowrap;
  animation:sr-pop .72s cubic-bezier(.2,.7,.3,1) forwards;pointer-events:none}
@keyframes sr-pop{0%{opacity:0;transform:translate3d(0,6px,0) scale(.9)}
  18%{opacity:1}100%{opacity:0;transform:translate3d(0,-34px,0) scale(1)}}
.sr-head{position:absolute;top:0;left:0;right:0;height:34px;display:flex;align-items:center;gap:8px;
  padding:0 38px 0 14px;font-size:12px;line-height:1;color:var(--sr-muted);
  pointer-events:none;z-index:3;background:linear-gradient(180deg,var(--sr-bg) 34%,transparent)}
.sr-title{font-weight:600;color:var(--sr-fg);font-size:12.5px;letter-spacing:.02em}
.sr-hint{display:none}
.sr-spacer{flex:1}
.sr-score{font-variant-numeric:tabular-nums;white-space:nowrap}
.sr-score b{font-weight:600;color:var(--sr-fg);font-size:12.5px}
.sr-speed{margin-left:6px;opacity:.78;white-space:nowrap}
.sr-close{position:absolute;top:6px;right:7px;width:24px;height:24px;display:grid;place-items:center;
  border:0;border-radius:8px;background:transparent;color:var(--sr-muted);
  font-size:16px;line-height:1;cursor:pointer;z-index:4;padding:0}
.sr-close:hover{background:var(--sr-soft);color:var(--sr-fg)}
.sr-shade{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:7px;
  z-index:2;background:color-mix(in srgb,var(--sr-bg) 80%,transparent);cursor:pointer}
.sr-root[data-sr-phase=over] .sr-shade{display:flex}
.sr-shade-title{font-size:15px;font-weight:600;color:var(--sr-fg)}
.sr-shade-sub{font-size:12px;color:var(--sr-muted);font-variant-numeric:tabular-nums}
/* Make the running indicator's whale tail read as a game button. */
[data-chat-running] [class*="_runningIcon"]{cursor:pointer;border-radius:6px;transition:transform .14s ease}
[data-chat-running] [class*="_runningIcon"]:hover{transform:scale(1.22)}
@media (prefers-reduced-motion:reduce){
  .sr-pop{animation-duration:.01s}
  .sr-star-icon{animation-duration:60s}
  .sr-root[data-sr-invincible='1'] .sr-runner{animation:none;filter:drop-shadow(0 0 5px rgba(226,178,94,.35))}}
`;

export function injectStyle() {
  // Upsert instead of insert-once: a client-HMR swap keeps the old tag around,
  // and stale CSS would leave the rebuilt widget unstyled.
  let tag = document.getElementById('dsh-arcade-style');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'dsh-arcade-style';
    document.head.appendChild(tag);
  }
  if (tag.textContent !== CSS) tag.textContent = CSS;
}
