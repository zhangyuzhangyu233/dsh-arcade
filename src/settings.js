/**
 * DSH Settings → dsh-arcade section.
 *
 * The game picker lives in the host settings panel; the entry next to the
 * composer only shows the currently selected game.
 */
import { ping } from './ping.js';
import { gameKind, writeGameKind } from './state.js';
import { BUILD } from './version.js';

export const GAME_OPTIONS = [
  {
    id: 'runner',
    name: '寿司跑酷',
    description: '小女仆在像素赛道上奔跑，吃寿司、躲竹子、踩螃蟹。',
  },
  {
    id: 'fighter',
    name: '深空突袭',
    description: '线框战机绕半圆轨道迎击敌机，拾取奖励、挑战 BOSS 激光。',
  },
];

export function createSettingsPanel(React) {
  const h = React.createElement;

  return function ArcadeSettingsSection() {
    const [kind, setKind] = React.useState(gameKind.get());
    React.useEffect(() => gameKind.subscribe(setKind), []);
    React.useEffect(() => { ping(BUILD, { event: 'settings-section-mounted' }); }, []);

    const pick = (id) => () => {
      gameKind.set(id);
      writeGameKind(id);
      ping(BUILD, { event: 'game-select', game: id });
    };

    return h('div', { className: 'sr-settings' },
      h('div', { className: 'sr-settings-head' },
        h('h3', { className: 'sr-settings-title' }, 'dsh-arcade'),
        h('p', { className: 'sr-settings-desc' },
          '选择输入框左侧入口启动的小游戏；选择会保存在本地。')),
      h('div', { className: 'sr-settings-options' },
        GAME_OPTIONS.map((option) => h('button', {
          key: option.id,
          type: 'button',
          className: `sr-settings-option${kind === option.id ? ' is-active' : ''}`,
          'aria-pressed': kind === option.id,
          onClick: pick(option.id),
        },
        h('span', { className: 'sr-settings-option-name' }, option.name),
        h('span', { className: 'sr-settings-option-desc' }, option.description)))),
    );
  };
}
