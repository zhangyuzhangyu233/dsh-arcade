# 🕹️ dsh-arcade

![dsh-arcade banner](https://raw.githubusercontent.com/zhangyuzhangyu233/dsh-arcade/main/assets/branding/banner-16x9.png)

### 深度求索的几十秒空白，不再是无聊的走神，而是一场说走就走的指尖冒险。

[![npm](https://img.shields.io/npm/v/@kennielearngames/dsh-arcade?color=ff4d6d)](https://www.npmjs.com/package/@kennielearngames/dsh-arcade)
[![license](https://img.shields.io/badge/license-MIT-3b82f6)](LICENSE)
[![for DSH](https://img.shields.io/badge/made%20for-DeepSeek%20Harness-0ea5e9)](https://github.com/deepseek-ai/deepseek-harness)

**dsh-arcade** 是一款专为 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 打造的嵌入式复古街机插件。

敲下回车，当模型进入「深度求索中」的思考时刻，输入框旁会悄悄亮起一道属于你的传送门——可能是欢快奔跑的像素小女仆，也可能是一架蓄势待发的矢量战机。轻点即玩，在输入框上方直接开启一场纯正的街机对决；按下 `Esc` 瞬间退场，丝滑无痕，绝不抢占输入焦点，绝不打断思考节奏。

用一局酣畅的赛博工间操，把等待的焦灼，变成下一轮灵感的助燃剂。

---

## ✨ 为什么你会喜欢它？

| 亮点 | 体验 |
|---|---|
| 👧 **静候召见，随叫随到** | 模型思考时，输入框左侧安静浮现迎宾入口。轻点展开，关闭即走，不遮挡任何正文。 |
| 🏃 **寿司跑酷 · 极速狂飙** | 16 帧手绘像素动画！从 20 km/h 一路飙向 200 km/h。滑铲穿竹林、腾空跃深坑、凌空踩扁小螃蟹，更有无敌星带你横冲直撞。 |
| 🚀 **深空突袭 · 矢量弧线** | 致敬经典 Tempest 的 3D 透视半圆轨道战机。左右倾侧压弯走位，机头自动倾泻火力，在枪林弹雨中迎战敌阵与蓄力激光 BOSS。 |
| 🌗 **昼夜变幻，浑然一体** | 原生同步 DSH 明暗主题——白天是清爽黑线稿手绘风，夜晚是空灵白线极简流光，与对话界面浑然天成。 |
| 🍃 **极度克制，零扰体验** | 纯 Canvas + SVG + 原生 DOM 驱动，不争夺键盘焦点，无外部网络请求，无突兀音效轰炸，关闭即完全休眠。 |
| ⚙️ **原生接入，随心切换** | 无缝打通 DSH 设置中心（**Settings → `dsh-arcade`**），随时翻牌你钟爱的值班游戏，配置本地永久保存。 |

---

## 🕹️ 玩法与操作指南

在 DeepSeek Harness 里发起对话，当模型开始思考时，**点击输入框左侧的小图标**，游戏舞台便会在输入框上方无缝展开。

想要换个口味？打开 **DSH 设置 → `dsh-arcade`**，即可在「寿司跑酷 / 深空突袭」之间一键切换。

### 🏃 寿司跑酷 (Sushi Run)
> 极速奔跑，大口干饭！速度会从 20 km/h 逐渐爬升至 200 km/h，手速与反应的极限试炼。

| 操作 | 对应动作 | 技巧心得 |
|---|---|---|
| `空格` / `↑` / `W` / 点击舞台 | **起跳** | 跨越地刺陷阱与致命深坑；下落时可精准踩扁小螃蟹（+100 分） |
| `↓` / `S` | **滑铲 / 俯冲急降** | 地面滑铲安全穿过悬空竹林；空中按下可触发 2.4 倍重力快速下坠，落地自动接滑铲 |
| `Esc` / 右上角 × | **收工离场** | 瞬间收起舞台；若模型仍在思考，入口小女仆依然会在一旁为你待命 |

💡 **老司机贴士**：
- **竹子**离地面极近，起跳必撞头，唯有滑铲可以潇洒穿过；
- **小螃蟹**横冲直撞，迎面硬撞会摔倒，一定要算好抛物线**从天而降踩上去**；
- 路上散落着各类美食：吃寿司与拉面补积分，吃蛋糕享双倍得分，吃冰淇淋化身磁铁全图吸附，偶遇超稀有的**无敌星**更能进入 10 秒无敌狂暴状态，一路撞碎所有障碍物！

---

### 🚀 深空突袭 (Deep-Space Arc)
> 环形轨道，自动巡航！在深邃星空中用华丽机动撕碎一切阻碍。

| 操作 | 对应动作 | 技巧心得 |
|---|---|---|
| `←` / `→` / `A` / `D` | **环轨机动** | 沿 180° 半圆轨道左右滑移，机身会伴随机动产生大角度压弯倾侧 |
| **自动开火** | **全速连射** | 机头方向持续倾泻高频激光，专注走位即可，无需疯狂按键 |
| `空格` | **反制导弹** | 3 秒基础冷却，优先拦截追踪导弹；可拾取「反制冷却」叠层缩短装填 |
| `X` | **电磁主炮** | 第 2 波解锁，击坠蓄能；满能量后呼叫休伯利安号主炮，贯穿当前航道 |
| `Esc` / 右上角 × | **撤离战区** | 随时退出，秒回聊天界面 |

💡 **空战指南**：
- 战机拥有 100 点初始装甲。普通突击兵、精英僚机、巨型旗舰 BOSS 轮番来袭；
- 击破敌机有概率掉落战术升级：**双联弹道**、**三向散射**、**攻击力强化（可叠 3 层）**、**超高射速（可叠 3 层）**、**高能穿透激光**、**高能护盾**、**紧急抢修**、**全屏歼灭弹**，以及后期才会出现的**导弹解锁**与**反制冷却**；
- **精英不再单独出现**：队长会带 3–10 名护卫，在防御、进攻、环绕、楔形、游击等阵列之间动态切换；护卫会随队长齐射，也可能在前方当人墙；
- **BOSS 拥有狡黠的规避 AI**：会预判玩家弹道侧跳与后撤，发射双发/三发弹幕、追踪导弹，并在蓄力完成后发射带危险航道预览的爆发激光。看到虚线预警时，请尽快离开光束范围！

---

## 🚀 安装指南

### 推荐：DSH 插件管理器一键安装
在 DeepSeek Harness 的 **插件 / Plugin Manager** 中直接搜索并安装：
```text
@kennielearngames/dsh-arcade
```

### 进阶：Profile 配置文件手动引入
在你的配置文件 `~/.dsh/profiles/<profile>/package.json` 中加入：
```json
{
  "dependencies": {
    "@kennielearngames/dsh-arcade": "^0.4.0"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@kennielearngames/dsh-arcade"
      ]
    }
  }
}
```

或直接在对应 profile 目录下运行 DSH CLI：
```bash
dsh plugin --profile desktop add @kennielearngames/dsh-arcade
```
重启或重载 DSH 窗口即可尽情体验。

---

## 🧩 项目结构

dsh-arcade 遵循极简、无侵入的宿主/渲染隔离架构：
- **宿主进程 (Host)**：仅注册 `/arcade/*` 极简诊断路由与激活标记，绝不碰触任何会话、Token 或文件系统敏感数据；
- **渲染前端 (Client)**：单文件自包含 bundle，通过 `conversation.input.dock` 插槽精准嵌入输入框正上方，并借由 `settings.section` 提供原生设置面板。

```text
dsh-arcade/
├─ index.js              # 宿主半：极简 /arcade 路由注入与状态自检
├─ client.js             # 渲染半：生产环境打包产物（零外部请求，内嵌所有矢量与像素资产）
├─ cordis.patch.yml      # DSH 插件加载声明
├─ src/
│  ├─ engine.js          # 寿司跑酷核心：无头物理引擎、动态配平、障碍与增益判定
│  ├─ shooter.js         # 深空突袭核心：半圆轨道透视、弹道碰撞、敌机 AI 与 BOSS 激光
│  ├─ settings.js        # DSH 设置中心面板（React 驱动）
│  ├─ panel.js           # 舞台自适应挂载、HUD、键盘事件与焦点管理
│  ├─ styles.js          # 样式隔离层（sr- 专属前缀，明暗主题 Token）
│  └─ client.js          # 插件生命周期连接器：思考状态监听、槽位装配、主题响应
├─ assets/               # 原始美术资产（黑白双主题 SVG、像素背景、跑酷动图）
├─ tools/                # 构建工具箱：自动化素材烘焙、无头物理断言测试、Banner 生成器
└─ preview/              # 离线沙盒页面（不启动 DSH 也可独立调试）
```

---

## 🛠️ 本地开发与贡献

想要调教跳跃手感、打磨敌机 AI，或是给街机厅添砖加瓦？非常欢迎！

```bash
# 1. 克隆代码仓库
git clone https://github.com/zhangyuzhangyu233/dsh-arcade.git
cd dsh-arcade

# 2. 安装构建依赖
npm install

# 3. 编译打包全套生产产物（包含 client.js 与 preview bundle）
npm run build

# 4. 运行无头物理引擎断言测试
npm run check
```

### 独立离线预览
无需启动庞大的 DSH 宿主环境，直接在浏览器中打开 `preview/index.html` 即可独立调试：
- `preview/index.html?theme=dark&jump=1&sim=3000` (深色主题跳跃手感验证)
- `preview/index.html?theme=light&hazard=1` (浅色主题障碍物判定调试)
- `preview/index.html?theme=dark&slide=1` (滑铲姿态与碰撞箱调试)

---

## 🗺️ 街机厅扩建计划 (Roadmap)

dsh-arcade 的愿景不只是一两款小游戏，而是慢慢长成 DSH 里一个温暖生动的赛博补给站：

- [x] **v0.1** 寿司跑酷核心玩法（寿司、拉面、Token 币、基础障碍）
- [x] **v0.2** 女仆入场动画、铺路开场动效、无边框沉浸式舞台
- [x] **v0.3** 深空突袭上线（3D 线框战机、敌机编队、BOSS 激光死光）+ DSH 设置中心无缝切换游戏
- [x] **v0.4** 深空突袭战术升级：反制导弹、电磁主炮、导弹/反制冷却奖励、精英带队与五种阵型、BOSS 预警与爆发激光
- [ ] **Arcade Shell**：统一 HUD、跨局最高记录榜单、每日挑战
- [ ] **敲 Token**：快节奏打地鼠式点击解压游戏
- [ ] **贪吃寿司蛇**：复古像素吞食蛇
- [ ] **Token Breakout**：弹幕版「深度求索中」破砖大作战
- [ ] **皮肤与陈列室**：纯外观向的像素奖杯与彩蛋收集（不含任何数值买数值机制）

---

## 🤝 参与共建

> 如果你有想玩的游戏玩法，欢迎直接提交 [Issue](https://github.com/zhangyuzhangyu233/dsh-arcade/issues) 聊聊灵感；
> 如果你擅长像素画、矢量动画或小游戏物理，欢迎提交 [Pull Request](https://github.com/zhangyuzhangyu233/dsh-arcade/pulls)！

如果你在等待模型思考的缝隙里，因这个小插件感受到了片刻乐趣，欢迎点一颗 **Star ⭐** 支持一下！

---

## ⚖️ 开源协议与声明

- 本项目采用 [MIT License](LICENSE) 开源。
- **粉丝向作品**：本项目与 DeepSeek、Anthropic 无任何隶属关系。相关名称、标志产权归各官方所有。项目内像素与矢量图元为本项目创作，仅供社区爱好者交流与游玩。
- **绝对隐私安全**：所有游戏得分、最高记录与偏好设置仅保留在用户浏览器的 `localStorage` 中，绝不回传任何数据。

---

### 🌐 English

**dsh-arcade** is an ultra-polite, retro-inspired mini-arcade docked seamlessly above your [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) composer.

Instead of alt-tabbing away and losing your train of thought while the AI is thinking, a charming animated maid or wireframe fighter quietly appears next to the input box. Click it to unfold a retro arcade stage right inside the composer dock:

- 🏃 **Sushi Run**: High-speed pixel parkour climbing from 20 to 200 km/h. Feast on sushi and ramen, slide under low bamboo groves, leap over spikes and pits, stomp on Claude Code crabs, and rampage with Super Star invincibility!
- 🚀 **Deep-Space Arc**: Tempest-inspired vector orbital shooter. Bank and carve through a 180° curved perspective plane, auto-fire lasers, dodge incoming swarms, grab tactical weapon upgrades, and face off against evasive laser-charging boss flagships!

**Key Highlights**:
- **Zero Distraction**: Never steals input focus. Press `Esc` or click × to instantly return to your conversation.
- **Pure & Polite**: 100% offline, zero external requests, no jarring audio, zero telemetry.
- **Native DSH Fit**: Seamlessly adapts to Light/Dark themes and lets you switch your default standby game directly in **DSH Settings → `dsh-arcade`**.
