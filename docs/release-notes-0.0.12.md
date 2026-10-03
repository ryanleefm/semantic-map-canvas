# Semantic Map Canvas 0.0.12

## English

This is a regular release (not a pre-release). Phase 13 has passed user acceptance.

### New: Auto and manual display modes

Right-click the empty canvas background and open **Display mode**:

- **Auto** (default): follows zoom with the existing hysteresis and highest-level cap.
- **L1 — Map**, **L2 — Overview**, **L3 — Structure**, **L4 — Detail**: keep the selected display mode while zooming and panning.

Your selection is saved separately for each Canvas and restored after reopening or renaming it. Manual modes do not change node Semantic levels. Central titles continue adapting to available space. Pausing semantic visibility preserves the selected mode.

Manual modes bypass the highest-level cap: selecting Map without L1 nodes can hide every node. Right-click the background and select Auto or Detail to recover. The menu is also available in native canvas settings.

### Installation and upgrade

Requires desktop Obsidian **1.9.14+**. Download **main.js**, **manifest.json**, and **styles.css** from this release. Place them in `.obsidian/plugins/semantic-map-canvas/` inside your vault, then reload the plugin or restart Obsidian. When upgrading, replace only these three files and preserve **data.json**.

The interface remains English. Licensed under MIT, with upstream notices retained.

### Validation and limitations

Build, lint, 106 automated tests and 36 browser layout scenarios passed, followed by user acceptance in Obsidian. Canvas menus rely on internal APIs; mobile and broad third-party theme/plugin compatibility remain unverified. Very small titles require zooming in, and large canvases may pause briefly during initial rendering.

[English guide](https://github.com/ryanleefm/semantic-map-canvas/blob/master/README.md) · [Report an issue](https://github.com/ryanleefm/semantic-map-canvas/issues)

---

## 简体中文

本次为正式 Release（非 Pre-release）。Phase 13 已通过用户验收。

### 新增：自动与手动显示档位

在画布空白处右键，打开 **Display mode**：

- **Auto**（默认）：随缩放自动调整，保留原有滞回和最高层级限制。
- **L1 — Map**、**L2 — Overview**、**L3 — Structure**、**L4 — Detail**：固定所选档位，仍可自由缩放和平移。

每个 Canvas 分别保存选择，重开或重命名后恢复。手动档位不改变节点 Semantic level；中央标题继续适配可用空间，暂停语义显隐也会保留选择。

手动模式不受最高层级限制：没有 L1 节点时选择 Map 可能全部隐藏，空白处右键切回 Auto 或 Detail 即可恢复。画布设置菜单中也可选择档位。

### 安装与升级

需要桌面版 Obsidian **1.9.14 或更新版本**。下载本次 Release 的 **main.js**、**manifest.json**、**styles.css**，放入 vault 的 `.obsidian/plugins/semantic-map-canvas/`，然后重新加载插件或重启 Obsidian。升级时仅替换这三个文件，保留 **data.json**。

插件界面保持英文。采用 MIT 许可证，保留上游声明。

### 验证与限制

构建、Lint、106 项自动化测试和 36 个浏览器排版场景通过，并已通过真实 Obsidian 用户验收。画布菜单仍依赖内部 API；移动端及广泛的第三方主题、插件兼容性尚未验证。极小标题需要放大阅读，大型画布首次显示时可能短暂停顿。

[中文指南](https://github.com/ryanleefm/semantic-map-canvas/blob/master/README.zh-CN.md) · [反馈问题](https://github.com/ryanleefm/semantic-map-canvas/issues)
