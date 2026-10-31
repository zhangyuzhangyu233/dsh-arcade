# 🕹️ dsh-arcade

![dsh-arcade banner](https://raw.githubusercontent.com/zhangyuzhangyu233/dsh-arcade/main/assets/branding/banner-16x9.png)

### 等待模型思考的同时，何不来上一把？

给 **DeepSeek Harness** 的像素街机小游戏插件。模型开始思考时，输入框左侧会出现一个**跑动的小女仆**——点她，道路从左往右铺开，输入框上方直接开始一局：跑酷、吃寿司、踩小螃蟹、躲竹子和深坑。**一局 30 秒、随时关掉、不耽误你回来。**

[![npm](https://img.shields.io/npm/v/@kennielearngames/dsh-arcade?color=ff4d6d)](https://www.npmjs.com/package/@kennielearngames/dsh-arcade)
[![license](https://img.shields.io/badge/license-MIT-3b82f6)](LICENSE)
[![for DSH](https://img.shields.io/badge/made%20for-DeepSeek%20Harness-0ea5e9)](https://github.com/deepseek-ai/deepseek-harness)

---

## ✨ 这一版能玩到什么

| | |
|---|---|
| 👧 **入口小女仆 + 铺路开场** | 模型思考时输入框左侧出现跑动的小女仆；点她，道路从左往右铺开，铺满后她才起跑；开局不再弹出圆角小窗。 |
| 🏃 **30 秒一局** | 无尽跑酷，速度从 20 爬到 200 km/h；关掉即结束，最高分留在本地。 |
| 🍣 **会吃的都在这里** | 白饭、饭团、寿司、拉面、蛋包饭；苹果加速、蛋糕双倍、冰淇淋磁铁、圣代永久护盾。 |
| 🪙 **Token 硬币 & 鲸元券** | 硬币成串出现（5–8 枚一组），每枚 +5，整组吃光再 +40；鲸元券稀有 +200，并把周围的拾取物和陷阱变成双倍分值美食。 |
| 🐼 **竹子要蹲、尖刺要跳** | 从顶部垂下的竹子会真的挡住你——要么 ↓/S 下蹲钻过去，要么被绊倒；尖刺和垂直崖壁深坑只能跳。 |
| 🦀 **Claude Code 小螃蟹** | 从地面爬过来，踩它 +100 并弹起；无敌状态撞上「创飞 +80」；正面裸撞就结束。 |
| ⭐ **无敌星** | 55% 概率出现，10 秒无敌，撞谁创谁。 |
| 🌗 **双主题像素风** | 浅色黑线稿 / 深色白线稿实时切换；所有图标同尺寸、黑白同位图，不闪不跳。 |
| ⚡ **零依赖、即开即玩** | 纯 DOM/CSS 渲染，无 canvas、无音效、无外部请求；打开面板才跑循环，关闭立刻释放。 |

**不抢输入焦点、不弹窗、不发网络请求。** 就是一小块能让你在等待时松口气的街机厅。

## 🚀 安装

### 推荐：在 DSH 插件里安装

在 DeepSeek Harness 的 **插件 / Plugin Manager** 中安装 bundle：

```
@kennielearngames/dsh-arcade
```

### 手动安装（profile 方式）

在 `~/.dsh/profiles/<profile>/package.json` 里加入：

```json
{
  "dependencies": {
    "@kennielearngames/dsh-arcade": "^0.2.0"
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

然后重启 DSH（或由 Plugin Manager 启用 bundle）。也可以在 profile 里用 CLI 加依赖：

```bash
dsh plugin --profile desktop add @kennielearngames/dsh-arcade
```

## 🎮 玩法

开始一个任务，等模型开始思考时，**点输入框左侧跑动的小女仆**：道路从左往右铺开，铺完后小女仆起跑，输入框上方直接开始游戏（不再是圆角小窗，也不影响输入框使用）。鲸鱼尾巴不再作为入口。

| 操作 | 作用 |
|---|---|
| `空格` / `↑` / `W` / 点击游戏区 | 跳跃（跳尖刺、跳坑、踩螃蟹） |
| `↓` / `S` | 下蹲 / 滑铲（钻竹子；空中按会快速下落） |
| `Esc` / 右上角 × | 关闭游戏（关闭后若模型仍在思考，小女仆会回到输入框左侧） |

小提示：竹子只能蹲过去，跳跃会撞头；螃蟹要**落下去踩**，从下面跑过去会撞上；小螃蟹比世界速度快一点，记得提前起跳。

## 🧩 项目结构

```
dsh-arcade/
├─ index.js              # 宿主半：/arcade/* 诊断路由 + 激活日志
├─ client.js             # 构建产物：浏览器 bundle（游戏全部逻辑与素材）
├─ cordis.patch.yml      # 把插件行插入 DSH profile
├─ src/
│  ├─ engine.js          # 跑酷引擎：物理、生成器、金币/鲸元券、竹子/尖刺/坑/小螃蟹
│  ├─ panel.js           # React 面板 + HUD + 键鼠输入
│  ├─ styles.js          # 全部 CSS（sr- 前缀，明暗主题 token）
│  └─ client.js          # 插件接线：思考状态监听、slot 注册、主题同步、入口女仆
├─ assets/branding/      # 像素海岸背景、像素标题、生成的 Banner
├─ tools/                # 构建、素材烘焙、Banner、无浏览器断言
└─ preview/              # 离线预览页（不依赖 DSH）
```

## 🛠️ 开发

```bash
git clone https://github.com/zhangyuzhangyu233/dsh-arcade.git
cd dsh-arcade
npm install

npm run build     # 重建 client.js + preview/bundle.js
npm run check     # 无浏览器引擎断言（拾取物/货币/障碍/无敌/Buff/动画节奏）
```

离线预览（不启动 DSH，直接在浏览器打开）：

```
preview/index.html?theme=dark&jump=1&sim=3000
preview/index.html?theme=light&hazard=1
preview/index.html?theme=dark&slide=1
```

修改素材后重新烘焙（需要原始美术素材与 Python + Pillow）：

```bash
python tools/build-assets.py
```

重新生成 README / Social Banner：

```bash
python tools/make-banner.py
```

> `client.js` 与 `src/generated/*` 是提交进仓库的构建产物；只改引擎/面板/样式时不需要重新烘焙素材。

## 🗺️ Roadmap

dsh-arcade 不打算只做一款游戏。路线是把它变成 DSH 里的「街机架」：

- [x] v0.1 寿司跑酷（当前版本）
- [ ] Arcade Shell：多游戏切换、统一 HUD / 最高分 / 每日挑战
- [ ] 敲 Token（打地鼠式点击小游戏）
- [ ] 接寿司 / 寿司蛇
- [ ] Token Breakout、弹幕「深度求索中」
- [ ] 跨游戏 Token 与皮肤收集（纯外观，无数值付费）

有想玩的小游戏或想改的手感，欢迎开 issue。

## ⚖️ 授权与声明

- 代码以 [MIT](LICENSE) 开源。
- 这是一个**粉丝向项目**，与 Anthropic、DeepSeek 无隶属关系。DeepSeek / DeepSeek Harness 相关名称归深度求索所有；Claude / Claude Code 名称与标志归 Anthropic 所有。像素美术素材随仓库提供，仅供本项目使用；如有权利问题请开 issue 联系。
- 游戏内所有分数、最高分只存在浏览器 `localStorage`，不上传任何数据。

---

### English

**dsh-arcade** is a tiny pixel-art arcade for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). While the model is thinking, click the whale tail next to the composer and play a quick endless runner right above your input box: sushi pickups, whale-token coin trails, a one-time banknote that turns traps into food, invincible stars, ground crabs to stomp, spikes, bamboo you must duck under, and bottomless cliff pits.

Runs for as long as you want, ends the moment you close it, and stores best scores locally. Pure DOM/CSS, no canvas, no audio, no network requests. Code is MIT licensed; fan project, not affiliated with Anthropic or DeepSeek.
