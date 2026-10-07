# Semantic Map Canvas 0.1.2

## English

### Title lines now controls the target row count
Right-click an ordinary node or group and choose **Title lines → Auto or 1–5 lines**. Manual choices now request that number of rows, rather than setting a maximum. Existing numeric settings are preserved and use the new behavior; Auto remains automatic.

Manual layout balances row lengths using legal break points. English words, punctuation groups, emoji clusters and complete formulas stay together. When there are too few breakable units, the title uses the closest feasible count: one word or one formula stays on one row. No blank rows are inserted.

Titles remain complete, centered and scaled to fit, without ellipsis or truncation. Changing rows or node size reuses rendered formulas. Fraction and matrix internals do not count as title rows. Group labels remain plain text.

### Update
Check for updates in **Settings → Community plugins**. For manual installation, replace **main.js**, **manifest.json**, and **styles.css** in `.obsidian/plugins/semantic-map-canvas/`, preserve **data.json**, then reload the plugin.

Requires desktop Obsidian **1.9.14+**. MIT licensed. Existing levels, short labels and display modes remain compatible; no data migration is needed.

### Validation and limits
User acceptance completed. Production build, 117 automated tests and 878 browser functional checks passed. Lint reports no errors and three DOM-helper style warnings. Four browser benchmarks compare the new layout with 0.1.1; manual layout was faster in the measured scenes, while Auto remained comparable. Large initial layouts may still pause briefly.

Browser formula tests use MathML fixtures, not the Obsidian MathJax runtime. Very long titles can become small. Row balancing uses measured width estimates and does not guarantee globally optimal typography for every font or formula. Mobile and broad third-party compatibility remain unverified.

---

## 简体中文

### Title lines 现在控制目标行数
右键普通节点或分组，选择 **Title lines → Auto 或 1–5 lines**。手动选项现在表示希望显示的行数，而不再只是最大行数。已有数字设置保留并按新语义生效，Auto 仍自动排版。

手动排版利用合理断点均衡各行长度，保留完整英文词、标点组合、emoji 组合字符及公式。可断行单元不足时，采用最接近的可行行数：一个单词或一个公式仍保持一行，不插入空白行凑数。

标题完整保留、居中并缩放以适应节点，不使用省略号、不截断。修改行数或节点尺寸复用已渲染公式；分式、矩阵内部结构不算标题行数。分组名称仍为纯文本。

### 升级
在 **设置 → 第三方插件** 中检查更新。手动升级时，替换 `.obsidian/plugins/semantic-map-canvas/` 中的 **main.js**、**manifest.json**、**styles.css**，保留 **data.json**，然后重新加载插件。

需要桌面版 Obsidian **1.9.14 或更新版本**，采用 MIT 许可证。已有层级、短标题及显示档位保持兼容，无需迁移数据。

### 验证与限制
已通过用户验收。生产构建、117 项自动化测试及 878 个浏览器功能检查通过。Lint 无错误，有三条 DOM 辅助方法风格警告。另完成四组与 0.1.1 的浏览器性能对比：测得的手动排版更快，Auto 开销相近；大型画布首次排版仍可能短暂停顿。

浏览器公式测试使用 MathML 样例，不代表 Obsidian MathJax 运行环境。极长标题仍可能缩得很小。分行利用测量宽度估计，不保证所有字体和公式组合的全局最优排版。移动端及广泛的第三方兼容性尚未验证。
