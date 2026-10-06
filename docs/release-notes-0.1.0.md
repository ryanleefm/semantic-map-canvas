# Semantic Map Canvas 0.1.0

## English

This release improves central titles with inline math and more natural English wrapping. Phase 14 has passed user acceptance in Obsidian.

### Changes

- Ordinary-node central titles now render inline math such as `$E=mc^2$`, `$x_i$`, and `$\frac{a+b}{c+d}$`, including custom short labels and text mixed with multiple formulas.
- Title extraction preserves math characters. Invalid formulas fall back to readable source.
- Ordinary-node and group titles prefer whole English words when wrapping. Very long strings can still break to fit.
- Formulas stay together and participate in adaptive sizing. Zooming reuses rendered formulas; edits and removal cancel stale rendering tasks.

### Install or update

Find **Semantic Map Canvas** in Obsidian's community plugins. Existing users can check for updates in **Settings → Community plugins**.

For manual installation, download **main.js**, **manifest.json**, and **styles.css** from this release into your vault's `.obsidian/plugins/semantic-map-canvas/` folder, then reload the plugin. Preserve **data.json** when updating.

Requires desktop Obsidian **1.9.14+**. Existing semantic levels and Auto/manual selections remain compatible; no settings migration is required. MIT licensed. The plugin interface remains English.

### Scope and validation

Math support is limited to single-line `$…$` in ordinary-node titles; group labels and `$$…$$` blocks are not rendered as math. Escaped dollars, incomplete delimiters and numeric amounts such as `$25$` remain literal. Very small titles may require zooming in.

Production build, 111 automated tests and 42 browser checks passed. Lint has no errors and two DOM-helper style warnings. Browser math geometry uses MathML test fixtures; the real Obsidian feature was subsequently accepted by the user. Mobile, broad third-party compatibility and large-scale formula performance remain unverified.

[English guide](https://github.com/ryanleefm/semantic-map-canvas/blob/master/README.md) · [Report an issue](https://github.com/ryanleefm/semantic-map-canvas/issues)

---

## 简体中文

本次更新为中央标题增加行内数学公式渲染，并优化英文换行。Phase 14 已通过真实 Obsidian 用户验收。

### 更新内容

- 普通节点中央标题支持 `$E=mc^2$`、`$x_i$`、`$\frac{a+b}{c+d}$` 等行内公式，包括自定义短标题及文字与多个公式混排。
- 标题提取保留数学符号；无效公式回退为可读源码。
- 普通节点与分组标题优先保持英文单词完整，超长字符串仍可断行。
- 公式整体参与自适应字号，不在内部随意换行。缩放复用已渲染公式，编辑和移除会取消过期任务。

### 安装与升级

在 Obsidian 社区插件市场搜索 **Semantic Map Canvas**。已安装用户可在 **设置 → 第三方插件** 检查更新。

手动安装时，下载本次 Release 的 **main.js**、**manifest.json**、**styles.css**，放入 vault 的 `.obsidian/plugins/semantic-map-canvas/`，然后重新加载插件。升级时保留 **data.json**。

需要桌面版 Obsidian **1.9.14 或更新版本**。已有语义层级及 Auto/手动档位配置保持兼容，无需迁移。采用 MIT 许可证，插件界面保持英文。

### 支持范围与验证

本阶段仅渲染普通节点标题中的单行 `$…$` 公式；分组名称及 `$$…$$` 块级公式保持文本。转义美元符号、未闭合分隔符及 `$25$` 这样的纯数字金额保持原样。极小标题仍需放大阅读。

生产构建、111 项自动化测试和 42 个浏览器检查通过。Lint 无错误，有两条 DOM 辅助方法的风格警告。浏览器数学尺寸测试使用 MathML 样例，真实 Obsidian 功能随后已获用户验收。移动端、广泛的第三方兼容性及大规模公式性能尚未验证。

[中文指南](https://github.com/ryanleefm/semantic-map-canvas/blob/master/README.zh-CN.md) · [反馈问题](https://github.com/ryanleefm/semantic-map-canvas/issues)
