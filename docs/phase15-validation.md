# Phase 15：中央标题最大行数与自动排版

状态：已通过用户验收，菜单命名为 Max title lines；用户已授权发布正式版 0.1.1。

## 功能

普通节点（文本、文件、链接）及 group 的右键菜单增加 **Max title lines**：
Auto（默认）、1 line、2 lines、3 lines、4 lines、5 lines。

数字表示最多几行，不要求排满。完整保留内容，不使用省略号、不截断，空间不足时允许字号继续缩小。过长标题需要用户自行缩短或调整已有 shortLabel。标题行数不改变原生详细内容、group 边缘标题、语义层级或显示档位。

设置位于插件 data.json 的 schema v2 节点可选字段 titleLines，不写入 .canvas。Auto 省略该字段。旧数据和非法值回退 Auto；正常保留已有 level、shortLabel 和每画布 displayMode。保存成功后立即刷新，失败维持原值。文件/文件夹重命名、删除沿用已有生命周期。当前版本回退到旧插件后再修改元数据，旧插件可能丢弃不认识的 titleLines 字段。

## 排版与性能

- 实测当前字体下不换行宽度，以及完整单词所需宽度，替代统一按 0.65 倍字号估算中英文的做法。
- 使用浏览器中文严格换行规则和英文词边界；特别长的字符串仍可兜底断行。
- 最多比较十个候选宽度，合并相同候选；单行已达到舒适字号时提前结束。逐轮批量写入、测量，避免逐个节点交替读写。
- 舒适字号上限沿用约 24 屏幕像素，同时对过多行数施加偏好权重。候选中选择兼顾字号和少换行的布局，并非数学上的全局最优。
- 手动模式丢弃超过行数上限的候选，始终保留完整单行作为兜底；数学分式、矩阵作为整体，不把内部结构计入标题行数。
- 标题内容、尺寸、字体、行数设置或公式渲染完成才使布局失效。连续缩放沿用布局，只更新 transform，因此行数不会随每次滚轮事件抖动；重新排版时使用当时的缩放比例。
- 不新增轮询、网络请求或依赖；改变行数/尺寸不重复渲染公式。保留异步取消及卸载清理。
- 首次布局成本高于 0.1.0，大型画布可能短暂停顿，不能宣称零性能代价。

## 自动验证

115 项单元/回归测试通过，包括菜单选中状态、立即刷新、保存恢复、非法值、失败恢复、重命名删除、旧菜单失效及公式缓存。

523 个浏览器功能检查通过，另记录 2 组批量性能结果。覆盖浅/深主题、普通/group 标题、Auto 和全部 1–5 行、中英文、标点、emoji、长词和网址、窄高和极小节点，以及公式、分式、矩阵和混排。检查实际行片段、完整性、中心位置、边界、英文词完整性、节点尺寸变化、首次加载手动限制及无测量缩放缓存。

数学浏览器样例使用原生 MathML，单元测试使用可控数学 API；不代表已验证真实 Obsidian MathJax 本阶段兼容性。真实菜单、数学样式及交互仍需用户验收。

本地结果：
- .test-build/phase15-tests.log
- .test-build/phase15-themes.json
- .test-build/phase15-themes.png
- .test-build/phase15-lint.log

## 测试画布与验收

关闭再启用插件，加载本次部署，然后打开：
- Semantic Map Canvas - Phase 15 - Titles.canvas
- Semantic Map Canvas - Phase 15 - Groups.canvas

测试文件均为新增，所有节点初始 Auto，不修改已有 data.json。

1. Titles 画布选择 L3 — Structure，先观察 Auto：短标题应更倾向单行，中等标题减少过早换行。
2. 右键节点 → Max title lines，依次选择 1–5 lines，确认选中标记和立即更新。数字是上限，短标题选 5 lines 仍可以一行。
3. 长标题选 1 line，应完整缩小且无省略号；再选 Auto 比较字号与行数。空标题应继续显示 Untitled。
4. 分别检查中文、英文、中英混排、长词、网址，以及上下标、分式、矩阵、多公式和无效公式回退。矩阵内部多行不算标题多行。
5. 拖动节点边缘改变宽高，连续缩放，切换 Auto / 手动显示档位，确认行数限制、完整性和原有显隐规则。
6. Groups 画布选择 L2 — Overview，重复行数设置。group 中的公式源码仍作为普通文字，不扩展数学渲染。
7. 为几个节点设置不同上限，关闭重开画布、关闭再启用插件；确认选择恢复。重命名测试画布后再确认。
8. 编辑标题、切换画布、切换浅深主题及卸载插件，确认原生显示恢复、没有残留或报错。

用户已验收通过，纳入正式版 0.1.1。

## Browser measurements (local Chrome, simulated Canvas DOM)

| Scenario | 0.1.0 approximate initial layout (ms) | Phase 15 initial layout (ms) | Zoom-only update (ms) | Stable scan (ms) |
| --- | ---: | ---: | ---: | ---: |
| 300 plain titles | 9.9 | 97.6 | 0.013 | 0.100 |
| 1500 plain titles | 37.5 | 554.5 | 0.034 | 0.300 |

Medians of three runs. The baseline reproduces the former width/fit strategy; this is not a full old-plugin benchmark. The scene excludes Obsidian, MathJax startup and real Canvas drawing. Initial layout is materially more expensive; cached zoom remains lightweight. Results vary by device.

| Auto example (500 x 300 node, 30% zoom) | Previous lines | New lines | Previous screen font px | New screen font px |
| --- | ---: | ---: | ---: | ---: |
| Chinese short | 2 | 1 | 24.0 | 24.0 |
| Chinese medium | 4 | 3 | 13.9 | 18.5 |
| English short | 2 | 1 | 21.3 | 18.4 |
| English sentence | 5 | 5 | 11.1 | 11.1 |
