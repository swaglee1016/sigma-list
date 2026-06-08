# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Sigma List — 单文件 HTML 待办应用，包含艾森豪威尔矩阵、清单视图和随记功能。纯前端，无构建系统，无框架。视觉风格为米色海报风（复古教育海报版 Eisenhower Matrix），全站 UI 为英文。

## 开发方式

直接编辑 `index.html`，浏览器打开即可验证。无 lint、test、build 命令。

## 架构

三层视图，共享数据层：

- **数据层**：`tasks` 对象 `{ un, ue, nn, ne }` 按四象限分区，`notes` 数组存随记。通过 `localStorage` 持久化（key: `sigma-list-data`, `sigma-notes-data`）。
- **Task 数据模型**：`{ id, text, tips, done, ts, updatedAt }`。`tips` 为可选注意事项，`updatedAt` 记录最后变动时间。旧数据自动迁移补全缺失字段。
- **视图切换**：`switchView(view)` 控制三个视图（matrix/list/notes）的显隐，通过 `.nav-tab` 绑定。
- **矩阵视图**：CSS Grid 2x2 四象限，仅显示未完成任务。每个 zone 底部有两栏输入表单（任务名 + tips）。item 点击打开 task modal 编辑，✓ 按钮标记完成。支持同象限内拖拽排序。
- **清单视图**：分 Active / Done 两段，按 `updatedAt` 倒序排列。每项显示 quadrant tag、任务名、tips 摘要（最多 2 行省略）、时间戳、✓/↺ 完成切换、× 删除。
- **随记视图**：卡片网格 + 新增栏 + 模态编辑器，`renderNotes()` 驱动。

**关键函数调用链**：数据变更 → `saveTasks()`/`saveNotes()` → `renderMatrix()` + `renderList()` / `renderNotes()`

**Task modal**：`openTaskModal(q, id)` 打开，`saveTaskFromModal()` 保存，`deleteTaskFromModal()` 删除。Esc 关闭，Ctrl+Enter 保存。

## 调色板（CSS 变量）

| 变量 | 色值 | 用途 |
|------|------|------|
| `--paper` | `#F4EFE6` | 画布背景 |
| `--ink` | `#2B2B2B` | 主文字 |
| `--accent` | `#D95333` | 强调色 |
| `--q-ue` | `#D9613C` | 左上 — Urgent & Important |
| `--q-un` | `#87A89E` | 右上 — Important but not urgent |
| `--q-ne` | `#6B8B96` | 左下 — Urgent but not Important |
| `--q-nn` | `#696969` | 右下 — Not Urgent & Not Important |

## 字体栈

- Display（标题/The）：`'PT Serif', 'Noto Serif SC', serif`
- Condensed（EISENHOWER MATRIX）：`'Oswald', 'Noto Sans SC', sans-serif`
- Body：`'Inter', 'Noto Sans SC', system-ui, sans-serif`

## 文件结构

```
index.html       # 唯一文件，HTML + CSS + JS 全部内联
CLAUDE.md
```

## 约束

- `MAX = 133`：每个象限上限 133 条
- `uid()` 生成基于时间戳的数字 ID
- 拖拽仅限同象限内排序，不支持跨象限移动
- 所有 CSS 变量定义在 `:root`，按 `var(--xxx)` 引用
- 矩阵只渲染未完成项，已完成的仅在 List 视图查看
