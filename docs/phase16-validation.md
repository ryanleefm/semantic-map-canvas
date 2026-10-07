# Phase 16：Title lines 目标行数控制

状态：Phase 16 已通过真实 Obsidian 用户验收，用户已授权发布正式版 0.1.2。

## 交互与兼容

普通节点和 group 右键菜单从 Max title lines 改为 **Title lines**，保留 Auto 和 1–5 lines。
- Auto 继续自动择优，不受五行限制。
- 数字现在表示目标行数：可合理分行时达到所选行数，不再只是上限。
- 所有 1–5 行共用算法，没有对两行的特殊处理。
- 不插入空白行、不插入填充空格，不改变标题原文。
- 正常英文词、中文标点组合、emoji 组合字符及完整公式形成不可拆单元；特别长的连续字符串允许兜底拆分。
- 可断行单元不少于目标行数时，任意 1–5 行都可达到。单元不足时使用单元数量，这是最接近的可行行数。例如 Research 保留一行，Research ideas 最多两行，单个矩阵保持一行。
- 旧 Auto 和 1–5 数值原样保留，按新语义解释。无需迁移，不修改已有 data.json、semantic level、shortLabel 或 displayMode。
- 界面中的设置值表示用户目标；实际回退行数不会改写设置。

## 实现与限制

手动模式先利用当前字体的文本测量及公式实际尺寸，确定合法断行单元；再将连续单元分配为目标行数，使各行测量宽度的平方和最小，减少末行过短。使用单调凸包优化的动态规划，计算量为 O(k*n)，k 最大为 5。算法不依赖少量宽度候选，因此四个汉字分三行这类情况不会被漏掉。

分配后的完整标题按真实 DOM 宽高测量并缩放，舒适字号上限仍约 24 屏幕像素；没有硬性最小字号、不加省略号、不截断。每行居中，字号适配节点可用空间。公式的内部多行结构不算标题行数。特别长内容或过多指定行数会缩得很小，需要用户调整标题或行数。

排版利用 Canvas 文本测量估计分配宽度，最终尺寸由 DOM 验证。字符间字距、字体连字、数学高度等复杂组合可能使实际行宽不完全相同；该优化不承诺对所有字体和数学内容求得全局最大字号。旧 Auto 排版策略保留，不扩大本阶段范围。

DOM 重建仅发生在内容、尺寸、字体、目标行数变化或公式完成时；已有公式节点移动到对应行，不重新渲染数学内容。切回 Auto 会清除行容器并恢复自然排版。缩放继续缓存 transform，旧任务取消、节点移除、画布切换和卸载清理沿用原有机制。

Intl.Segmenter 不可用时，对文本保守地保留不可拆单元；受支持的桌面环境应以实际验收为准。group 仍为纯文本，不扩展完整 Markdown 或分组数学渲染。

## 验证

- 117 项单元/回归测试通过。新增将动态规划与小规模穷举最优解对比，覆盖全部 1–5 行；验证英文词、中文标点、组合 emoji、超长词与大量单元。
- 878 个浏览器功能检查通过，另有 4 组浏览器性能记录。
- 新增独立预期：四个汉字最多四行且可达三行、五个英文词可达 1–5 行、一个/两个英文词及单个/两个公式的回退、中文标点、混排、shortLabel 优先级、首行提取及空标题回退。
- 检查实际行容器非空且不重叠、内容完整、边界、字号适配、字体变化、切回 Auto、尺寸变化、首次加载手动设置及无重复公式渲染。
- 浅深主题、普通/group、中英文与数学混排均覆盖。数学浏览器样例使用原生 MathML，不能代替真实 Obsidian MathJax 验收。
- 样例截图：.test-build/phase16-themes.png；结果：.test-build/phase16-themes.json；测试与 lint 日志分别为 phase16-tests.log、phase16-lint.log。

## 验收

关闭再启用插件，打开：
- Semantic Map Canvas - Phase 16 - Titles.canvas
- Semantic Map Canvas - Phase 16 - Groups.canvas

所有新增节点初始 Auto，未预写元数据。

1. Titles 画布选择 L3 — Structure，右键节点 → Title lines。
2. 对“中文标题”和“one two three four five”逐一选择 1–5 行。前者 1–4 行可达、选 5 回退 4；后者五个选项都应达到指定行数。
3. 对 Research、Research ideas、单个矩阵、两个公式检查不可达回退，不应插入空白行。
4. 检查中文标点、中英文、emoji、分式、上下标和矩阵混排；公式内部结构不能被拆到其他标题行。
5. 对长标题、宽扁、窄高和小节点调整行数、节点尺寸并连续缩放，确认完整、居中且无省略号。
6. 改回 Auto，确认恢复自然排版。公式不应因改变行数而重复闪烁加载。
7. Groups 画布选择 L2 — Overview，重复全部 1–5 行测试。分组内容保持纯文本。
8. 检查已有 Phase 15 节点的数值设置得到保留，并按新目标行数应用；重开画布、重启插件后应恢复。
9. 编辑标题时切换行数或画布，切换浅深主题，再卸载插件，确认没有旧内容写回、残留或报错。

用户已验收通过并授权发布，纳入正式版 0.1.2。

## Browser performance comparison

Median of three runs, local Chrome with simulated Canvas DOM and plain-text titles. The baseline is the frozen 0.1.1 layout implementation; this is not a full Obsidian or MathJax benchmark. Times are milliseconds and vary by device.

| Titles / initial mode | Initial 0.1.1 | Initial Phase 16 | Change all to 5: 0.1.1 | Change all to 5: Phase 16 | Cached zoom / update | Stable scan |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 / AUTO | 81.6 | 70.9 | 83.6 | 35.9 | 0.004 | 0.100 |
| 300 / 3 | 72.4 | 29.0 | 70.4 | 41.1 | 0.005 | 0.100 |
| 1500 / AUTO | 405.1 | 429.1 | 460.7 | 195.3 | 0.033 | 1.600 |
| 1500 / 3 | 668.6 | 225.6 | 617.8 | 406.7 | 0.041 | 0.300 |

Manual partitioning was faster than the old width search in these samples. Auto remains comparable; a large initial layout can still pause briefly. The old numeric setting meant a maximum, so resulting layouts are intentionally different.

Build and test deployment passed. Lint: 0 errors, 3 DOM-helper style warnings. Deployed main.js, manifest.json and styles.css match build SHA-256 values; existing data.json is unchanged.
