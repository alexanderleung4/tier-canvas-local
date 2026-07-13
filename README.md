# 从夯到拉排版生成器

一款完全在浏览器本地运行的中文 Tier List 排版、录制与 PNG 导出工具。图片与项目数据只保存在本机 IndexedDB，不会上传至服务器。

![16:9 主界面预览](output/playwright/final-16-9.png)

## 功能

- 多图上传：支持 PNG、JPG/JPEG、WebP，保留原比例、不裁切。
- 插入式拖拽：图片可在等候区、任意层级间移动并重排；层级本身也可拖拽重排。
- 自由层级：添加、删除、双击改名；删除层级时其中图片会按原顺序移回等候区。
- 自适应画布：16:9、9:16、1:1 固定逻辑画布整体缩放；层级颜色随位置从红色过渡至白色。
- 本地持久化：刷新后自动恢复项目；支持撤销、重做和键盘快捷键。
- 纯画布导出：可导出 1× / 2× / 4× PNG，工具栏、垃圾桶和滚动条不会写入图片。
- 演示模式：隐藏工具栏，便于录制排名过程。

<p align="center">
  <img src="output/playwright/final-9-16.png" alt="9:16 竖屏画布" width="31%" />
  <img src="output/playwright/final-1-1.png" alt="1:1 方形画布" width="45%" />
</p>

## 一键启动（Windows）

直接双击仓库根目录中的 [`启动应用.bat`](启动应用.bat)。它会先检查 Node.js 20+：缺失或版本过低时，会通过 Windows Package Manager（`winget`）安装当前 Node.js LTS；Windows 仍会要求用户确认安装权限。没有 `winget` 时，脚本会自动打开 [Node.js 官方下载页](https://nodejs.org/en/download)。

Node.js 安装完成后，再次双击启动文件即可自动安装项目依赖（首次）并打开本地开发服务器。

也可以在终端运行：

```bash
npm install
npm run dev
```

## 开发与验证

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run preview
```

当前验证状态：TypeScript 类型检查通过、12 项单元测试通过、Playwright 主流程通过、生产构建通过，`npm audit` 为 0 个漏洞。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl / Cmd + Z` | 撤销 |
| `Ctrl / Cmd + Shift + Z` | 重做 |
| `Delete / Backspace` | 删除当前选中图片 |
| `Escape` | 取消编辑 / 退出演示模式 |

## 技术栈

React · TypeScript · Vite · dnd-kit · Zustand · Dexie (IndexedDB) · html-to-image · Vitest · Playwright

## 边界

首版不包含云同步、账号、后端、真实协作或项目 ZIP 导入/导出。浏览器本地存储空间由当前浏览器控制；空间不足时应用会给出提示。
