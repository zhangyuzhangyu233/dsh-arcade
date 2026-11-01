# 🕹️ dsh-arcade

![dsh-arcade banner](https://raw.githubusercontent.com/zhangyuzhangyu233/dsh-arcade/main/assets/branding/banner-16x9.png)

### 等待模型思考的同时，何不来上一把？

给 **DeepSeek Harness** 的街机小游戏插件。模型开始思考时，输入框左侧会出现入口——点它，输入框上方直接开一局：可以跑寿司、踩小螃蟹、躲竹子，也可以开线框战机在深空里迎击敌机、捡奖励、打 BOSS。**随时关掉、不耽误你回来。**

现在包含两款游戏，**在 DSH 设置里的 `dsh-arcade` 分区切换**，选择会保存在本地。

[![npm](https://img.shields.io/npm/v/@kennielearngames/dsh-arcade?color=ff4d6d)](https://www.npmjs.com/package/@kennielearngames/dsh-arcade)
[![license](https://img.shields.io/badge/license-MIT-3b82f6)](LICENSE)
[![for DSH](https://img.shields.io/badge/made%20for-DeepSeek%20Harness-0ea5e9)](https://github.com/deepseek-ai/deepseek-harness)

---

## ✨ 这一版能玩到什么

| | |
|---|---|
| 👧 **入口女仆 / 战机** | 模型思考时输入框左侧出现当前游戏入口：小女仆或线框战机；在 **DSH 设置 → `dsh-arcade`** 里切换，选择保存在本地。 |
| 🏃 **寿司跑酷** | 无边跑酷，速度 20 → 200 km/h；寿司、硬币、鲸元券、竹子、尖刺、坑、小螃蟹、无敌星。 |
| 🚀 **深空突袭** | 半圆轨道线框射击：自动开火、敌机/精英/BOSS、HP 与血条、概率掉落 8 种永久/叠层奖励、BOSS 蓄力激光。 |
| 🎁 **奖励道具** | 双弹道、三弹道、伤害（可叠 3 层）、射速（可叠 3 层）、穿透、护盾（破前永久）、修复、清屏。 |
| 🌗 **双主题** | 浅色黑线稿 / 深色白线稿实时切换；两款游戏共用入口与主题。 |
| ⚡ **零依赖** | 纯 DOM/CSS + Canvas 渲染，无音效、无外部请求；打开面板才跑循环，关闭立即释放。 |

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
    "@kennielearngames/dsh-arcade": "^0.3.0"
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

开始一个任务，等模型开始思考时，**点输入框左侧的当前游戏入口**（小女仆或战机），输入框上方直接开始游戏，不影响输入框使用。

**切换游戏**：DSH 设置 → `dsh-arcade` 分区，选「寿司跑酷 / 深空突袭」。入口会立刻换成对应图标；选择保存在 `localStorage`。

### 寿司跑酷

| 操作 | 作用 |
|---|---|
| `空格` / `↑` / `W` / 点击游戏区 | 跳跃（跳尖刺、跳坑、踩螃蟹） |
| `↓` / `S` | 下蹲 / 滑铲（钻竹子；空中按会快速下落） |
| `Esc` / 右上角 × | 关闭游戏（关闭后若模型仍在思考，入口会回到输入框左侧） |

小提示：竹子只能蹲过去，跳跃会撞头；螃蟹要**落下去踩**，从下面跑过去会撞上。

### 深空突袭

| 操作 | 作用 |
|---|---|
| `←` / `→` / `A` / `D` | 沿半圆轨道左右移动，机体会随之压弯 |
| 自动开火 | 从机头持续射击，无需按键 |
| `Esc` / 右上角 × | 关闭游戏 |

- 玩家 HP 100；小兵 / 精英 / BOSS 血量各自不同；击坠会概率掉奖励。
- 奖励：双弹道、三弹道、伤害（3 层）、射速（3 层）、穿透、护盾、修复、清屏。
- BOSS 会瞄准、侧移/后退躲避，并蓄力发射大范围激光。


## 🧩 项目结构

```
dsh-arcade/
├─ index.js              # 宿主半：/arcade/* 诊断路由 + 激活日志
├─ client.js             # 构建产物：浏览器 bundle（游戏全部逻辑与素材）
├─ cordis.patch.yml      # 把插件行插入 DSH profile
├─ src/
│  ├─ engine.js          # 跑酷引擎：物理、生成器、金币/鲸元券、竹子/尖刺/坑/小螃蟹
│  ├─ shooter.js         # 深空突袭：半圆轨道、HP/奖励/BOSS AI/激光
│  ├─ settings.js        # DSH 设置里的 dsh-arcade 游戏选择分区
│  ├─ panel.js           # React 面板 + HUD + 键鼠输入
│  ├─ styles.js          # 全部 CSS（sr- 前缀，明暗主题 token）
│  └─ client.js          # 插件接线：思考状态监听、slot 注册、主题同步、入口女仆
├─ assets/shooter/       # 战机/敌机/BOSS/奖励图标线稿（黑白双主题）
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

- [x] v0.1 寿司跑酷
- [x] v0.2 入口女仆 / 铺路开场 / 无边框游戏区
- [x] v0.3 深空突袭（线框战机、奖励道具、BOSS 激光）+ DSH 设置内切换游戏
- [ ] Arcade Shell：统一 HUD / 最高分 / 每日挑战
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

**dsh-arcade** is a two-game arcade for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). While the model is thinking, click the entry left of the composer: play a pixel sushi runner (sushi, whale-token coin trails, crabs, bamboo, spikes, pits), or a wireframe deep-space fighter (HP, elites, a dodging laser boss, eight reward pickups). Switch games under **Settings → `dsh-arcade`**; scores and the selection stay local. Pure DOM/CSS + Canvas, no audio, no network requests. Code is MIT licensed; fan project, not affiliated with Anthropic or DeepSeek.

Runs for as long as you want, ends the moment you close it, and stores best scores and the selected game locally. Code is MIT licensed; fan project, not affiliated with Anthropic or DeepSeek.
