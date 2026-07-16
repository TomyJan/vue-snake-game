# 🐍 Vue Snake Game

A modern Snake game built with Vue 3 + TypeScript, developed by AI under [OpenClaw](https://github.com/openclaw/openclaw) (御坂 / TomyJanClaw).

🎮 **Play:** https://tomyjan.github.io/vue-snake-game/

## AI 开发分工（模型出处）

本仓库由 OpenClaw 代理持续维护。不同阶段使用的主力模型如下，便于对照 commit 与算法演进：

| 阶段 | 模型 | 大致范围 | 做了什么 |
|------|------|----------|----------|
| **早期建设** | **Xiaomi MiMo / mimo-v2.5**（配置名曾为 `mimotokenplan/mimo-v2.5-pro` 等） | 初版脚手架 → 约 `3992eeb` 及更早的大量 AI 迭代 | 游戏本体（Vue3 + Canvas、障碍、特殊食物、主题音效、移动摇杆、Pages 部署等）；AI 从 flood-fill / Greedy / Hamiltonian Cycle / BFS 尾可达，到 `src/composables/ai.ts` 拆分、深前瞻与卡顿修复、吃豆与绕路权重再平衡 |
| **近期 AI 重写** | **Grok-4.5**（`MoeAI/grok-4.5`） | `23fadfe`、`a589b6d`、`1e4dd19`（2026-07-14 起） | 全量重写自动游玩策略：全程 replan-safe 吃豆 + 尾连通；`roomQuality` / **effective free space**；剔除 1 宽死胡同与**奇数 spur（假出路/单数行）**；bench 与 Pages 全权推送 |

### 与 Grok-4.5 直接相关的 commit

| Hash | 说明 |
|------|------|
| [`23fadfe`](https://github.com/TomyJan/vue-snake-game/commit/23fadfe) | 重写 AI：replan-safe 食物路径 + 尾可达绕路 |
| [`a589b6d`](https://github.com/TomyJan/vue-snake-game/commit/a589b6d) | 惩罚 1-wide / 奇数死走廊 |
| [`1e4dd19`](https://github.com/TomyJan/vue-snake-game/commit/1e4dd19) | 从有效空间中硬剔除 odd 1-wide spur（根因：raw flood 把假出路当空间） |
| （本轮持续） | 备选安全吃豆路径 + `analyzeRoom` 单测 + 长蛇软跟尾；见最新 `main` |

> 更早标有 `TomyJan` / `TomyJanClaw`、且落在上表「早期建设」时间线内的提交，按 **mimo-v2.5 时代** 记；若某次会话临时切过模型，以该次对话与默认配置为准。当前默认模型为 **MoeAI/grok-4.5**。

## Features

- 🎮 Classic snake gameplay with smooth Canvas 2D rendering
- ⌨️ Keyboard controls (Arrow keys + WASD)
- 📱 Mobile floating joystick (touch anywhere to activate)
- 🏆 Score system with localStorage high score persistence
- 🤖 AI auto-play（见下方算法；当前为 Grok-4.5 版）
- ⚡ 4 speed levels (Slow / Normal / Fast / Insane)
- 🟡 Bonus food (×3 points, time-limited)
- 🔵 Slow food (❄ temporary speed reduction)
- 🧱 Random obstacles per game（默认 8 个静态障碍）
- ✨ Particle effects on eating
- 🌗 Dark / Light theme toggle
- 🔊 Sound effects (Web Audio API)
- 📐 Responsive mobile layout with viewport lock

## Controls

| Key | Action |
|-----|--------|
| ↑↓←→ / WASD | Move |
| Space | Start / Pause |
| R | Restart |
| Q | Quit to menu |
| Esc | Pause |
| 🤖 | Toggle AI auto-play |

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (port 2333)
pnpm dev

# Run all checks (typecheck + format + test + build)
pnpm ci

# Individual commands
pnpm typecheck      # TypeScript type checking
pnpm test           # Run tests (Vitest)
pnpm format         # Format code (Prettier)
pnpm format:check   # Check formatting
pnpm build          # Production build
```

可选本地 AI bench（仓库内脚本，随算法同步维护）：

```bash
node bench.mjs          # 或 bench-ai.mjs，视当前脚本为准
```

## Project Structure

```
src/
├── components/
│   ├── GameBoard.vue        # Canvas rendering
│   ├── GameControls.vue     # Start/pause/speed/AI/theme/sound
│   ├── MobileControls.vue   # Floating touch joystick
│   └── ScoreBoard.vue       # Score panel
├── composables/
│   ├── ai.ts                # AI 决策（findSafeDirection）← 当前 Grok-4.5 维护
│   ├── useGame.ts           # 游戏循环 / 状态 / 接入 AI
│   ├── useTheme.ts
│   └── useSound.ts
├── utils/
│   ├── constants.ts
│   ├── helpers.ts
│   └── ...
├── types/game.ts
├── App.vue
└── main.ts
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Vue 3 (Composition API) |
| Language | TypeScript |
| Build | Vite |
| Rendering | Canvas 2D API |
| Audio | Web Audio API |
| Styling | CSS Variables |
| Testing | Vitest + jsdom |
| Formatting | Prettier |
| CI/CD | GitHub Actions → GitHub Pages |

## AI Algorithm（当前 · Grok-4.5）

入口：`src/composables/ai.ts` → `findSafeDirection(snake, food, obstacles, tailFrozen)`。

1. **吃豆**：仅当最短食物路径上**每一步**后仍 head→tail 可达（replan-safe），且吃后仍有足够 **effective** 空间时才走。
2. **绕路**：在保尾可达的合法步中选分；分数主要看 **effective free space**（不是 raw flood-fill）。
3. **假出路 / 单数行**：从死端沿 1 宽走廊标记 spur，**从有效空间中剔除**；奇数长度 spur 额外惩罚；可选步中优先不增加 odd spur 的方向。
4. **绝境**：跟尾路径一步，或取即时空间最大的合法步。

历史版本（mimo-v2.5 时代）曾采用纯 flood-fill 打分、Greedy 吃豆+跟尾、Hamiltonian Cycle、多层 BFS 尾可达等，详见 git 历史。

### 近期 bench 参考（障碍×8，本地模拟）

| 版本 | 模型 | 规模 | Avg（约） |
|------|------|------|-----------|
| 旧 flood / 迭代基线 | mimo 时代 | 50 局 | ~900–950 |
| replan-safe 重写 `23fadfe` | Grok-4.5 | 40 局 | ~1712 |
| spur 剔除 `1e4dd19` | Grok-4.5 | 20 局 | ~2005 |
| 备选吃豆路径 + 长蛇软跟尾 | Grok-4.5 | 20 局 | ~2052 |
| 机动性/口袋过滤（mid-game self） | Grok-4.5 | 20 局 | ~2158（但中后期不敢吃，已回退） |
| 放宽吃豆门槛（修 stall） | Grok-4.5 | 20 局 | ~1901 |

数字随随机障碍波动，仅作回归参考。

## Deployment

Auto-deployed via GitHub Actions on every push to `main`：

1. Build `dist/`（`base: /vue-snake-game/`）
2. Deploy to GitHub Pages

维护约定：本项目由 OpenClaw 代理**全权管理**——算法达标后默认 commit + push，并回报 Pages 地址与 commit hash。

## License

MPL-2.0
