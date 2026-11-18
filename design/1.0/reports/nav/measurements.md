# 单侧栏导航实测 — FINAL（仅导航候选）

[最终实拍对照图](nav-comparison-final.png) · [M1 原图](m1-real-1440.png) · [新候选原图](nav-final-1440.png) · [展开菜单](nav-final-open-1440.png) · [窄屏键盘状态](nav-final-open-1024.png)。旧的[方案对照图](nav-comparison-proposal.png)右半为以旧版收栏状态制作的**示意**，不用于候选验收。

**条件。** 旧版从 `6cb520c` 只读导出；新版取本次仅导航候选的已构建客户端（SHA-256 `d120ac84213b88771ad501bd4aa7bdeba6cf3265c8a6f05b68527a86e92fff8d`）。分别运行真实 DSH，使用相同生成器的临时合成研究目录、隔离 DSH home 与 Atlas state，空白无痕 Chromium，device scale 1。宿主侧栏展开，主题 Auto 随宿主显示 Day；Desk 草稿为空，命令面板查 `#worm`，Shift+Enter 将第一条结果开在右栏，停在课题开头。未发送、未编辑。两套 fixture、临时浏览器与基线导出已回收。

| 1440 × 900 | M1 基线 | 导航候选 |
| --- | --- | --- |
| 宿主侧栏 / Atlas 常驻侧栏 | 280 / 56 px | 280 / 无 |
| 左、右栏的起始 x 坐标 | 336 / 888 | 280 / 860 |
| 左 Desk / 右 Worm 宽度 | 552 / 552 px | 580 / 580 px |
| 唯一目的地入口 | 常驻图标栏 | 左标签条内、tablist 外，仅一个 83×28 px 按钮，x=286、y=6；右标签条不重复 |

**交互。** 开菜单后实测面板 240×515 px，x=286、y=38；`Places` 与 `Workspace actions` 各七项。Esc 关闭并回焦 `Atlas destinations`。1024×768、宿主侧栏仍展开且保留双栏时，按钮和菜单位置不变，菜单都在屏内。按钮聚焦后 ↓ 打开菜单并聚焦 Desk，按 `L` 移至 Library，Enter 打开独立 Library 标签，右侧仍是原 Worm algorithm。无常驻 Atlas rail。这里未测试讨论未读数据或 M2 其他功能。
