# Semantic Map Canvas 0.1.1

## English

### New: Max title lines
Right-click an ordinary node or group and choose **Max title lines → Auto, 1 line, 2 lines, 3 lines, 4 lines, or 5 lines**. Each choice is a maximum, not a required number of rows. Settings are saved per node and applied immediately.

### Better central title layout
- Auto uses actual text measurements to reduce premature wrapping, especially for Chinese and mixed-language titles.
- Layout balances width, readable font size and fewer lines. English words stay together where possible.
- Titles remain complete: no ellipsis or truncation. Very long titles shrink further; shorten the title or enlarge the node if needed.
- Inline formulas stay intact. Fractions and matrices do not count as extra title lines. Changing line limits or node size reuses rendered math.
- Existing levels, display modes and settings remain compatible. Missing line settings default to Auto.

### Update
Check for updates in **Settings → Community plugins**. For manual installation, replace **main.js**, **manifest.json**, and **styles.css** in `.obsidian/plugins/semantic-map-canvas/`, preserve **data.json**, then reload the plugin.

Requires desktop Obsidian **1.9.14+**. MIT licensed; interface remains English.

### Validation and limits
User acceptance completed. Build, 115 automated tests and 523 browser functional checks passed; lint has no errors and two existing DOM-helper style warnings. Two additional browser benchmarks record performance.

Initial layout is more expensive: a simulated 1,500-title scene took about 0.55 seconds on the test machine. Cached zoom remains lightweight. This is not a real Obsidian frame-rate measurement. Browser math tests use MathML fixtures; broad third-party compatibility and mobile remain unverified. Downgrading and saving with an older plugin may discard the new line-limit settings.

---

## 简体中文

### 新增：Max title lines
右键普通节点或分组，选择 **Max title lines → Auto、1 line、2 lines、3 lines、4 lines 或 5 lines**。数字表示最多几行，不强制排满。设置按节点保存并立即生效。

### 优化中央标题排版
- Auto 按实际文字尺寸排版，改善中文及混排标题过早换行的问题。
- 综合调整文本框宽度、字号与行数，英文尽量保持完整单词。
- 标题完整保留，不使用省略号、不截断。特别长的标题会进一步缩小，可自行缩短标题或扩大节点。
- 行内公式保持整体，分式和矩阵内部结构不算标题换行。修改行数或节点大小会复用已渲染公式。
- 已有层级、显示档位及配置保持兼容；未设置行数的节点默认为 Auto。

### 升级
在 **设置 → 第三方插件** 中检查更新。手动升级时，替换 `.obsidian/plugins/semantic-map-canvas/` 内的 **main.js**、**manifest.json**、**styles.css**，保留 **data.json**，然后重新加载插件。

需要桌面版 Obsidian **1.9.14 或更新版本**。采用 MIT 许可证，界面保持英文。

### 验证与限制
已通过用户验收。构建、115 项自动化测试、523 个浏览器功能检查通过；Lint 无错误，保留两条已有 DOM 辅助方法风格警告。另有两组浏览器性能记录。

首次排版开销有所增加：测试机器上的 1500 个标题模拟场景约需 0.55 秒，后续缩放继续使用轻量缓存。这不代表真实 Obsidian 帧率。浏览器公式测试使用 MathML 样例；广泛的第三方兼容性及移动端尚未验证。降级到旧插件后再保存配置，可能丢失新增的行数设置。
