# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Sigma List — 艾森豪威尔矩阵待办应用，Vite + Capacitor 跨平台（Web / Android / iOS）。米色海报风，全站 UI 英文。本地存储 + CloudBase 云同步。

## 开发命令

```sh
npm run dev                    # Vite 开发服务器 → http://localhost:3000
npm run build                  # 生产构建 → dist/
npx cap sync                   # 同步 web 资产到原生项目
npx cap open android           # 在 Android Studio 中打开
npx tcb hosting deploy dist -e sigma-list-d7gxfeaenc4b950f6   # 部署到 CloudBase 静态托管
```

APK 构建：
```sh
npm run build; npx cap sync; cd android; ./gradlew assembleDebug
# APK → android/app/build/outputs/apk/debug/app-debug.apk
```

CloudBase 环境 ID：`sigma-list-d7gxfeaenc4b950f6`

## 架构

四视图，共享数据层：

- **数据层**：`tasks` 对象 `{ un, ue, nn, ne }` 按四象限分区，`notes` 数组。通过 `@capacitor/preferences`（原生）或 `localStorage`（浏览器）持久化。每次写入同步推送到 CloudBase 文档数据库，启动时自动拉取合并。30 秒定时轮询 + 页面可见性切换时立即拉取。
- **Task 模型**：`{ id, text, tips, done, ts, updatedAt, dueDate, reminderEnabled, reminderTime }`。旧数据自动迁移补全。
- **Note 模型**：`{ id, title, body, category, ts }`。category 为 `reflections`（人生感悟）或 `ideas`（工作创意）。
- **ID 生成**：`uid()` 为基于时间戳的 13 位数字 ID，存于 `src/utils/dom.js`。
- **视图切换**：`switchView(view)` 控制 matrix / list / calendar / notes 四个视图，通过底部 `.tab-bar` 切换。
- **矩阵视图**：CSS Grid 2x2 四象限，仅显示未完成任务。每个 zone 底部两栏输入表单（任务名 + tips）。桌面端 HTML5 Drag API 同象限内拖拽排序，移动端长按 400ms 触发触摸重排。
- **清单视图**：Active / Done 两段，按象限优先级（un > ue > nn > ne）排序，同象限内按 `updatedAt` 倒序。
- **日历视图**：月网格日历，有到期任务日期显示彩色圆点，点击日期显示当天任务列表。
- **随记视图**：左右双栏——Reflections（暖棕 #B37A6A）/ Ideas（青绿 #5A8F8A），桌面并排、手机堆叠。
- **Task modal**：编辑任务名/tips/截止日期/提醒开关。Esc 关闭，Ctrl+Enter 保存。

**刷新链**：数据变更 → `saveTasks()`/`saveNotes()` → 本地存储 → `pushAll()` 推送到 CloudBase → `refreshAll()` → 各视图 render 函数。

**同步链**：CloudBase 匿名登录 → 文档数据库 `sync_data` 集合，`doc_type` 区分 `tasks`/`notes`，按 `updated_at` 合并。权限设为所有用户可读写（匿名用户跨设备共享）。`src/services/sync.js`。

**APK 架构**：`capacitor.config.json` 中 `server.url` 指向 CloudBase 托管 URL，Android WebView 从远程加载页面，与网页端共享同一数据库源，实现实时同步。

## CSS 变量（色板）

| 变量 | 色值 | 用途 |
|------|------|------|
| `--paper` | `#F4EFE6` | 画布背景 |
| `--ink` | `#2B2B2B` | 主文字 |
| `--accent` | `#D95333` | 强调色 |
| `--q1` | `#D9613C` | Q1 — Urgent & Important (Do First) |
| `--q2` | `#87A89E` | Q2 — Important but not Urgent (Schedule) |
| `--q3` | `#6B8B96` | Q3 — Urgent but not Important (Delegate) |
| `--q4` | `#696969` | Q4 — Not Urgent & Not Important (Delete) |

## 文件结构

```
index.html               # 薄壳入口，空 <div id="app">
capacitor.config.json    # Capacitor 配置，含 server.url 指向 CloudBase 托管
vite.config.js           # Vite 配置 (base: './')
android/                 # Android 原生项目
src/
  main.js / app.js       # 入口 + DOM 构建 + 全部事件绑定
  constants.js           # QS 象限数组、MAX=133、storage keys
  data/                  # storage.js（Preferences/localStorage，含缓存层）+ models.js（createTask/createNote/migrateTask）
  views/                 # matrix / list / notes / calendar / modals
  services/              # notifications / haptics / export / sync (CloudBase)
  utils/                 # dom.js（esc/fmtTime/uid）+ date.js（todayISO/isToday）
  styles/                # 10 个 CSS 文件
```

## 约束

- `MAX = 133`：每象限上限
- 拖拽仅限同象限内，不支持跨象限移动
- 矩阵只渲染未完成项，已完成仅在 List 视图查看
- 字体从 Google Fonts CDN 加载：Display = PT Serif / Condensed = Oswald / Body = Inter
