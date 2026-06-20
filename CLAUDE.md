# CLAUDE.md

## 项目概述

Sigma List — 艾森豪威尔矩阵待办应用，Vite + Capacitor 跨平台（Web / Android / iOS）。米色海报风，全站 UI 英文。本地存储 + TiDB Cloud 云同步。

## 开发命令

```sh
npm run dev           # Vite 开发服务器 → http://localhost:3000
npm run build         # 生产构建 → dist/
npx cap sync          # 同步 web 资产到原生项目
npx cap open android  # 在 Android Studio 中打开
```

## 架构

四视图，共享数据层：

- **数据层**：`tasks` 对象 `{ un, ue, nn, ne }` 按四象限分区，`notes` 数组。通过 `@capacitor/preferences`（原生）或 `localStorage`（浏览器）持久化，每次写入同步推送到 TiDB Cloud，启动时自动拉取合并。
- **Task 模型**：`{ id, text, tips, done, ts, updatedAt, dueDate, reminderEnabled, reminderTime }`。旧数据自动迁移补全。
- **Note 模型**：`{ id, title, body, category, ts }`。category 为 `reflections`（人生感悟）或 `ideas`（工作创意）。
- **视图切换**：`switchView(view)` 控制 matrix / list / calendar / notes 四个视图，通过底部 `.tab-bar` 切换。
- **矩阵视图**：CSS Grid 2x2 四象限，仅显示未完成任务。每个 zone 底部两栏输入表单（任务名 + tips）。点击打开 task modal，✓ 按钮标记完成。桌面端 HTML5 Drag API 拖拽排序，移动端长按 400ms 触发触摸重排。同象限内拖拽。
- **清单视图**：Active / Done 两段，按象限优先级（un > ue > nn > ne）排序，同象限内按 `updatedAt` 倒序。
- **日历视图**：月网格日历，有到期任务日期显示彩色圆点，点击日期显示当天任务列表。左右箭头切换月份。
- **随记视图**：左右双栏布局——Reflections（人生感悟，暖棕色 #B37A6A）/ Ideas（工作创意，青绿色 #5A8F8A）。每栏独立输入区 + 卡片列表，桌面并排、手机堆叠。
- **Task modal**：编辑任务名/tips/截止日期/提醒开关。Esc 关闭，Ctrl+Enter 保存。

**刷新链**：数据变更 → `saveTasks()`/`saveNotes()` → 本地存储 + 推送到 TiDB Cloud → `pushAll()` → `refreshAll()` → 各视图 render 函数。
**同步链**：启动时 `pullAndMerge()` 从云端拉取，按 id + 时间戳合并。`src/services/sync.js`。

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
index.html               # 薄壳入口
capacitor.config.json    # Capacitor 配置
vite.config.js           # Vite 配置
package.json             # 依赖与脚本
android/                 # Android 原生项目（npx cap add android）
src/
  main.js / app.js       # 入口 + DOM 构建 + 事件绑定
  constants.js           # QS 数组、MAX=133、storage keys
  data/                  # storage.js（Preferences/localStorage）+ models.js
  views/                 # matrix / list / notes / calendar / modals
  services/              # notifications / haptics / export / sync (TiDB Cloud)
  utils/                 # dom.js + date.js
  styles/                # 10 个 CSS 文件（见 styles/ 目录）
public/fonts/            # 自托管字体（预留）
```

## 约束

- `MAX = 133`：每象限上限
- `uid()` 生成基于时间戳的数字 ID
- 拖拽仅限同象限内，不支持跨象限移动
- 矩阵只渲染未完成项，已完成仅在 List 视图查看
- 字体从 Google Fonts CDN 加载（未自托管）
- 字体栈：Display = PT Serif / Condensed = Oswald / Body = Inter
