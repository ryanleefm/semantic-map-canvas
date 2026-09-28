# Semantic Map Canvas 0.0.11 — Public test / 公开测试版

## English

Semantic zoom for the official Obsidian Canvas. This early test release helps you move from detailed notes to a structured overview by zooming out.

### Features

- Four semantic levels for text, file, link, and group nodes: L1 Domain, L2 Core, L3 Structure, and L4 Detail.
- Zoom-dependent display of native content, compact titles, and hidden nodes.
- Coordinated nested group titles: eligible inner groups show central titles while outer containers keep edge titles.
- The farthest display mode follows the highest semantic level present, preventing a blank display caused solely by missing higher-level nodes.
- Central titles wrap and shrink to fit without truncation.
- Local-only operation, without network requests or telemetry.

### Requirements and installation

Desktop Obsidian **1.9.14 or newer**.

1. Download **main.js**, **manifest.json**, and **styles.css** from this release's assets.
2. Create `.obsidian/plugins/semantic-map-canvas/` inside your vault.
3. Copy all three files into that folder.
4. Restart Obsidian and enable **Semantic Map Canvas** under **Settings → Community plugins**.

The automatically generated source archives are not installable plugin packages. The plugin interface is in English.

### Quick start

Right-click a node or group and choose **Semantic level**. Ordinary nodes default to L3; groups default to L2. Zoom out to simplify the view. Run **Semantic Map Canvas: Toggle semantic visibility** to pause or resume the effect.

### Known limitations

- Tiny nodes and very long titles require zooming in to read.
- Large canvases may pause briefly when titles are first created or node geometry changes.
- Mobile and broad theme/plugin compatibility have not been verified.
- Native selection may include visually hidden nodes; pause semantic visibility before bulk editing if needed.
- Uses internal Canvas APIs that may change with Obsidian updates.

Build, lint, and 94 regression tests passed; 36 isolated browser layout scenarios passed during Phase 12. These checks do not replace testing in your own vault.

Please report issues in English or Chinese through [GitHub Issues](https://github.com/ryanleefm/semantic-map-canvas/issues). Include the Obsidian and plugin versions, reproduction steps, and screenshots or a minimal sample with private content removed.

[English guide](https://github.com/ryanleefm/semantic-map-canvas/blob/master/README.md) · [中文指南](https://github.com/ryanleefm/semantic-map-canvas/blob/master/README.zh-CN.md)

---

## 简体中文

为 Obsidian 官方 Canvas 提供语义缩放。这是早期公开测试版，帮助你通过缩小画布，从详细笔记逐步切换到结构化概览。

### 功能

- 文本、文件、链接和分组节点均支持四级语义层级：L1 领域、L2 核心、L3 结构、L4 细节。
- 根据缩放程度显示原生内容、简洁标题，或隐藏节点。
- 协调嵌套分组标题：符合条件的内层分组显示中央标题，外层容器保留边缘标题。
- 根据实际存在的最高语义层级限制最远显示档位，避免仅因缺少高层级节点而显示全空。
- 中央标题自动换行、缩小以适应空间，不截断标题。
- 完全本地运行，无网络请求或遥测。

### 要求与安装

需要桌面版 Obsidian **1.9.14 或更新版本**。

1. 从本次 Release 附件下载 **main.js**、**manifest.json** 和 **styles.css**。
2. 在你的 vault 中创建 `.obsidian/plugins/semantic-map-canvas/`。
3. 将三个文件放入该文件夹。
4. 重启 Obsidian，在 **设置 → 第三方插件** 中启用 **Semantic Map Canvas**。

GitHub 自动生成的源码压缩包不是可直接安装的插件包。插件界面保持英文。

### 快速开始

右键节点或分组，选择 **Semantic level**。普通节点默认 L3，分组默认 L2。缩小画布即可简化展示；执行 **Semantic Map Canvas: Toggle semantic visibility** 可暂停或恢复效果。

### 已知限制

- 极小节点或超长标题需要放大阅读。
- 大型画布首次生成标题或节点几何变化时可能短暂停顿。
- 移动端及广泛的主题、插件兼容性尚未验证。
- 原生选择操作可能包含视觉上隐藏的节点，批量编辑前可暂停语义显隐。
- 使用 Canvas 内部 API，可能受 Obsidian 更新影响。

构建、Lint 和 94 项回归测试通过；Phase 12 的 36 个隔离浏览器排版场景通过。这些检查不能替代在你自己的 vault 中测试。

欢迎用中文或英文在 [GitHub Issues](https://github.com/ryanleefm/semantic-map-canvas/issues) 反馈。请附 Obsidian 与插件版本、复现步骤，以及移除私密内容后的截图或最小样例。

[English guide](https://github.com/ryanleefm/semantic-map-canvas/blob/master/README.md) · [中文指南](https://github.com/ryanleefm/semantic-map-canvas/blob/master/README.zh-CN.md)
