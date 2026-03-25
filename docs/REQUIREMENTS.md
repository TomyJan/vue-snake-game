# Vue Snake Game - 贪吃蛇小游戏

## 项目简介
使用 Vue 3 + TypeScript + Vite 构建的现代化贪吃蛇网页小游戏。

## 功能需求

### 核心功能
- [x] 经典贪吃蛇玩法：控制蛇移动、吃食物变长、撞墙/撞自己则游戏结束
- [x] 键盘方向键控制（↑↓←→）
- [x] WASD 键控制
- [x] 分数系统：每吃一个食物 +10 分
- [x] 游戏速度随分数递增
- [x] 游戏结束判定与重新开始

### 界面功能
- [x] 游戏画布（Canvas 渲染）
- [x] 实时分数显示
- [x] 最高分记录（localStorage 持久化）
- [x] 开始/暂停/重新开始按钮
- [x] 游戏结束弹窗
- [x] 响应式布局，适配不同屏幕

### 增强功能
- [x] 深色/浅色主题切换
- [x] 移动端触控支持（虚拟方向键）
- [x] 游戏音效（吃食物、碰撞、开始）
- [x] 食物动画（闪烁/呼吸效果）
- [x] 蛇身渐变色

## 技术栈
- **框架**: Vue 3 (Composition API + `<script setup>`)
- **语言**: TypeScript
- **构建工具**: Vite
- **样式**: CSS3（CSS Variables 主题系统）
- **状态管理**: Vue 3 reactive + composable
- **渲染**: Canvas 2D API
- **音效**: Web Audio API

## 项目结构
```
vue-snake-game/
├── public/
├── src/
│   ├── components/
│   │   ├── GameBoard.vue      # 游戏画布
│   │   ├── ScoreBoard.vue     # 分数面板
│   │   ├── GameControls.vue   # 控制按钮
│   │   ├── GameOverModal.vue  # 结束弹窗
│   │   └── MobileControls.vue # 移动端方向键
│   ├── composables/
│   │   ├── useGame.ts         # 游戏逻辑
│   │   ├── useTheme.ts        # 主题切换
│   │   └── useSound.ts        # 音效管理
│   ├── types/
│   │   └── game.ts            # TypeScript 类型定义
│   ├── utils/
│   │   ├── constants.ts       # 游戏常量
│   │   └── helpers.ts         # 辅助函数
│   ├── App.vue                # 根组件
│   ├── main.ts                # 入口文件
│   └── style.css              # 全局样式
├── docs/
│   └── REQUIREMENTS.md        # 本文档
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 开发规范
- 使用 Conventional Commits 规范
- 组件名使用 PascalCase
- Composable 函数以 `use` 开头
- 类型定义在 `types/` 目录
- 常量在 `utils/constants.ts`
