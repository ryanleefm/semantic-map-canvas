# Semantic Map Canvas

增强 Obsidian 官方 Canvas 的语义缩放插件。当前开发版 **0.0.11** 已实现 Phase 1–12：四级语义属性、节点与连线显隐、可读的 group 中央标题，嵌套 group 的标题协调，MAP 全局档，以及按当前最高层级限制最远显示档位。

## 四个显示档位

| 档位 | 普通节点 | group |
| --- | --- | --- |
| DETAIL | L1–L4 原生完整内容 | 原生边缘标题 |
| STRUCTURE | L1–L3 简短标签；L4 隐藏 | L1/L2 边缘标题；L3 可用中央标题；L4 隐藏 |
| OVERVIEW | L1/L2 简短标签；L3/L4 隐藏 | L1 边缘标题；L2 可用中央标题；L3/L4 隐藏 |
| MAP | L1 简短标签；L2–L4 隐藏 | L1 可用中央标题；L2–L4 隐藏 |

当内部仍有同等或更高优先级的可见对象，或正在编辑的对象时，group 保留边缘标题。同为默认 L2 的嵌套 group，从外到内保留容器标题，只在最内层可概括区域显示中央标题。

组内的重要普通节点按自身层级保留，不再统一隐藏。隐藏外层 group 不自动隐藏全部内部对象。任一端点隐藏时，对应连线、箭头和连线标签一起隐藏。

包含关系按完整矩形判断；部分交叠不算包含，相同矩形的 group 视为同级。本阶段不对任意相交标题做自动避让或重排。

初始档位阈值为 10% / 25% / 60%；运行中使用 9% / 11%、23% / 27%、58% / 62% 的滞回区间。可一次跨越多个档位。缩放只改变渲染状态，不写入节点位置、尺寸或删除状态。

最终显示档位受当前画布最高层级限制：L1→MAP、L2→OVERVIEW、L3→STRUCTURE、L4→DETAIL。最高层级按实际存在的普通节点和 group 统计，采用默认值，忽略已删除节点留下的元数据。没有 L1 时不再因进入 MAP 而全空。

实际缩放和滞回状态机保持独立，限制后的档位只用于显示；层级或节点变化后及时更新。实际 zoom 不受限制，极度缩小或平移离开内容仍可能看不清对象。空画布保持原生状态。

## 测试与操作

测试插件安装在 `D:\semantic-map-canvas\VaultsforTest\.obsidian\plugins\semantic-map-canvas`。关闭再启用 **Semantic Map Canvas** 以加载 0.0.11。

当前阶段请按 [Phase 12 验证说明](docs/phase12-validation.md) 测试新建的 **Phase 12 - Ordinary** 和 **Phase 12 - Groups** 画布。

旧档位限制回归可打开 **Semantic Map Canvas - Phase 11.canvas**，不设置 L1 直接缩小，检查最终显示停在 OVERVIEW；单节点层级测试使用 **Semantic Map Canvas - Phase 11 - Ordinary.canvas**。完整步骤见 [Phase 11 验证说明](docs/phase11-validation.md)，历史性能记录见 [Phase 10 报告](docs/phase10-validation.md)。旧阶段文档保留各自交付时的验收规则，以本阶段说明为准。

找不到隐藏节点时，可以放大，或执行 **Semantic Map Canvas: Toggle semantic visibility** 暂停显隐；再次执行恢复。暂停仅在本次插件运行期间有效。

禁用插件、切到普通笔记或切换活动 Canvas 时，清除旧画布上的辅助标签和 CSS 类。仅处理活动 Canvas，后台分屏恢复原生显示。原生选择和编辑由 Obsidian 管理，框选仍可能包含视觉上隐藏的节点；批量编辑前可先暂停显隐。

## 层级和存储

普通 text/file/link 节点及 group 均可右键选择 **Semantic level**：
- L1 Domain（领域）
- L2 Core（核心）
- L3 Structure（结构）
- L4 Detail（细节）

普通节点默认 L3，group 默认 L2；移动节点或改变包含关系不会自动修改层级。

元数据按 Canvas 路径与节点 ID 保存在插件自己的 `data.json`。重命名路径会迁移元数据，删除 Canvas 清理其记录；删除单个节点保留元数据以支持撤销。保存失败保留之前的内存状态并提示。

旧 schema v1 数据加载时先保存验证过的 `data.schema-v1.backup.json`，再迁移至 schema v2：旧 L1→L2、L2→L3、L3→L4，保留 shortLabel，不重复迁移。恢复说明见 [Phase 7 验证说明](docs/phase7-validation.md)。Phase 8–12 继续使用 schema v2，无新增迁移。

普通节点简短标签优先使用已有 shortLabel，否则使用文本首个非空行、文件名或网址主机名。标签只显示纯文本，不执行 HTML；自定义 shortLabel 的 UI 尚未实现。

普通节点与 group 中央标题自动换行并适配节点空间，完整显示所选标题，不截断、不限制行数。最大约 24px 屏幕字号，空间不足继续缩小；极小节点需放大阅读。group 使用原始名称，空名称显示 Untitled group。标题、尺寸或字体改变时重新测量，缩放复用缓存。编辑时恢复原生内容，退出概括状态后清理辅助标签。

## 开发

基于 [Obsidian 官方 sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin)，使用 TypeScript、Obsidian Plugin API、esbuild 和 npm。

```powershell
npm ci
npm run dev
npm run build
npm run lint
npm test
npm run deploy:test
npm run benchmark
npm run test:visual
```

部署只复制 main.js、manifest.json、styles.css，保留测试 vault 的已有 data.json。linkedom 仅用于开发测试，不进入插件包。

- `src/canvas/`：活动 Canvas、菜单、缩放采样、只读运行时兼容层。
- `src/semantic/DisplayMode.ts`：最高层级统计与最终显示档位限制。
- `src/semantic/VisibilityEngine.ts`：层级及档位的基础规则、最终连线显隐。
- `src/semantic/GroupHierarchy.ts`、`GroupVisibility.ts`：包含关系、嵌套标题协调与编辑保护。
- `src/rendering/`：辅助 CSS 类、标签和原生控件的显隐及清理。
- `src/semantic/SemanticStore.ts`、`MetadataSchema.ts`、`MetadataBackup.ts`：存储、校验、迁移及备份。
- `tests/`：缩放、存储、嵌套规则及 DOM 回归测试。

模式、活动文件或层级变化时及时刷新；同档位约每 300ms 检查移动、编辑和 DOM 替换。缩放每 100ms 采样并更新已有中央标题的补偿变量，无变化时不重新生成标签或写 DOM；几何未变时复用包含关系，但仍读取当前层级、编辑状态和 DOM。未修改或包装 Canvas 方法。

最低版本为桌面 Obsidian 1.9.14。内部 API 和 DOM 可能随版本变化；自动化测试不能代替真实窗口和其他插件兼容性验收。调研记录见 [Canvas runtime](docs/canvas-runtime.md)。节点尺寸预设尚未实现。

5000 节点压力基准仍有首次挂载和几何重算的停顿风险；模拟 DOM 测量不代表真实帧率。本版本尚未公开发布。