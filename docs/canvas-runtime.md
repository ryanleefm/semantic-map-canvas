# Canvas runtime 调研与实现决定

调研日期：2026-09-26。以下将源码证据、安装包静态核查和仍需手动验证的部分区分记录。

## 来源与许可

| 来源 | 本次固定提交 | 核查内容 |
| --- | --- | --- |
| [官方 sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin/tree/07ceb81d1fb3384af611ebf665a1ec42a7e5926d) | `07ceb81d1fb3384af611ebf665a1ec42a7e5926d` | src/main.ts 生命周期；esbuild、TypeScript、ESLint、manifest、部署说明 |
| [Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas/tree/e402f51c30c050572053a37f119dede9f65f6271) | `e402f51c30c050572053a37f119dede9f65f6271` | main.ts、patchers/canvas-patcher.ts、@types/Canvas.d.ts |
| [Canvas Enhance](https://github.com/joeytoday/obsidian-canvas-enhance/tree/2c0463ab8f8dbf328162375ee873138118831091) | `2c0463ab8f8dbf328162375ee873138118831091` | 同上及 canvas-extensions/overview-mode-canvas-extension.ts |

官方模板为 0BSD，保留 LICENSE。Advanced Canvas 为 GPL-3.0，Canvas Enhance 为 AGPL-3.0；仅研究其访问方式，没有复制其实现、类型声明或样式。当前插件实现独立编写，不依赖这两个插件。

## Canvas instance

Advanced Canvas 用 `workspace.getActiveViewOfType(TextFileView)` 获取当前视图，检查 `getViewType() === 'canvas'` 后读取内部 `view.canvas`；Canvas Enhance 使用相同模式，但基类为 `ItemView`。二者也通过 `getLeavesOfType('canvas')` 列举 Canvas。

本轮采用 TextFileView 路线，仅观察活动视图。公共 API 部分与 `.file.path` 用官方类型；内部 `.canvas` 在 Adapter 中按 unknown 验证。没有实例时返回 null，下次采样自动重试；切换视图或同一实例装载不同文件时重置缩放模式。

## Zoom 与 viewport

两个参考项目均包装内部 `markViewportChanged`，再发出各自带前缀的 workspace 事件；这些事件是插件自行添加的，不能当成 Obsidian 官方原生事件。

Canvas Enhance 的 overview 使用 `2 ** canvas.tZoom`，读的是动画**目标**比例。两个项目的 zoom-to-bbox 逻辑也通过 `Math.log2(scale)` 写入 tZoom。这说明不能直接把内部 log2 刻度当作百分比。

另外只读检查了本机 `D:\Obsidian\resources\obsidian.asar`：package.json 标明 **1.9.14**。app.js 的 Canvas 初始化为 zoom=0、scale=1、tZoom=0；动画帧根据 zoom 的插值计算 `2 ** zoom` 并更新 scale；nodes、edges 初始化为 Map。`markViewportChanged` 标记变更并请求动画帧。这是安装包静态证据，**不是已在正在运行的 Obsidian 窗口里完成交互验收**。

本实现使用 `2 ** canvas.zoom` 读取当前动画比例，不访问 tZoom 或 scale，也不写任何 viewport 字段。

选择每 100ms 只读采样的原因：本轮只需模式检测，能覆盖不同输入方式和程序触发的 zoom，且不必 patch 方法或依赖第三方事件。代价是约 100ms 延迟、后台节流及极短暂越界可能被跳过。单次采样是 O(1)，仅读活动视图、zoom 和 Map.size；不枚举全部节点、不遍历 DOM、不监听每个 wheel 重建界面。

`onViewportChanged` 是本插件的采样接口名称，本阶段只报告缩放、活动文件/实例、节点/连线数量变化；纯平移不会触发回调。

## 本轮实际使用的 undocumented API

| 成员 | 用途 | 保护方式 |
| --- | --- | --- |
| `CanvasView.canvas` | 获取实例 | 必须是 Canvas 类型视图且实例为 object |
| `canvas.zoom` | 读取当前 log2 缩放 | 有限数检查；转换结果必须有限且 > 0 |
| `canvas.nodes` | 节点列表与数量 | 校验 size/get/values 的 Map 结构 |
| `canvas.edges` | 连线列表与数量 | 同上 |

所有访问集中在 `CanvasAdapter.ts`。内部声明字段为 unknown，仅在运行时验证后使用。Map 采用结构检查而非 `instanceof Map`，避免分离窗口的跨 realm 误判。

后续调研线索：node 的 `nodeEl`、`getData()`；group 由节点数据的 type 标识；edge 的 `lineGroupEl` 与 `lineEndGroupEl` 是不同的元素，显隐时须一起考虑。它们本轮**未使用**，等 Phase 4–6 时再根据实际 DOM 验证；不提前实现空的渲染模块。

## 生命周期与兼容性

- onLayoutReady 后启动一个计时器；插件通过 register 注册 disposer，禁用时清理。
- 加入 unloaded 标志，避免布局就绪回调在禁用后重新创建计时器。
- 没有 monkey patch、DOM 注入、CSS class 修改、文件保存调用或历史栈操作。
- shape 不符或读取异常：输出一次 warning，停止本次处理，后续轮询尝试恢复；恢复后再次故障可重新告警。
- 原型默认 console.debug，可在 DevTools 的 Verbose 级别看到；不输出笔记正文、文件路径或完整实例。
- 当前只观察活动 Canvas，未做后台分屏、嵌入 Canvas 和移动端验收。Obsidian 内部表示改变时必须更新 Adapter；shape 检查无法识别所有语义改变（例如字段仍是 number 但单位改变）。

## 验证范围

自动化测试包括初始分类、两个滞回区间、跳档、非法输入、缩放对数转换、节点几何保持不变、非 Canvas / 延迟初始化、跨 realm Map、故障恢复、快照去重、活动文件切换、重复启停、卸载前尚未 layout-ready 等情况。

测试使用模拟 host，真实 UI 的缩放手感、实际插件启用、与其他插件共同运行仍需按 README 在 test vault 手动验收。TypeScript、lint、自动化测试及 dev watch 的实际运行结果在交付时报告。

本轮执行结果：TypeScript + esbuild 生产构建通过；官方规则 ESLint 通过；9 项自动化测试全部通过；`npm run dev` 初始编译及源文件变更后的自动重建通过，验证后已停止进程。已部署到测试 vault，并核对 main.js、manifest.json 的 SHA-256 一致。

构建依赖已固定并生成 package-lock.json。为兼容本机 Node 22.11，将 typescript-eslint 固定到 8.46.4；干净安装及完整依赖树检查通过。沿用模板的 ESLint 9，npm 会提示该主版本已停止支持；当前检查可运行，未来升级 Node 工具链时再一并迁移 ESLint。所有依赖仅用于开发，不打包进入插件运行依赖。


## Phase 4：节点语义层级（0.0.2）

本机 Obsidian 1.9.14 安装包中，节点菜单触发 `canvas:node-menu` 事件。插件直接订阅此事件，不修改 Canvas 方法。事件名称未列入官方 Workspace 类型，在 Adapter 中集中封装并通过 `Plugin.registerEvent` 卸载。

新增内部读取：`node.getData()` 的 id/type、`node.canvas`、`canvas.view.file.path` 和 `canvas.nodes.get(id)`。菜单打开及点击时均检查节点是否仍属于画布。只接受 text/file/link 节点。子菜单 `MenuItem.setSubmenu()` 未公开在 Obsidian API 类型中，亦封装在 Adapter 内。

元数据格式为 `schemaVersion: 1`，默认 L2。使用插件自身的 `loadData/saveData`，写入串行化。保存失败不提交内存；损坏或未知版本的数据会禁用层级编辑，避免覆盖原数据。文件及目录重命名通过 vault 事件迁移路径，删除节点时保留元数据以支持 Canvas undo。用户已在真实 Obsidian 中验收菜单和持久化。

## 名称迁移（0.0.3）

插件对外名称和 ID 分别更改为 **Semantic Map Canvas**、`semantic-map-canvas`。测试 vault 的插件目录连同 `data.json` 迁移，启用列表同步更新。源码业务概念（如 Semantic level）保持原名。项目工作目录 现已更名为 `D:\semantic-map-canvas`。

重命名后需完全退出并重启 Obsidian。新 ID 尚未公开发布；内部 Canvas API 的兼容风险与之前相同。

## Phase 5：语义显隐（0.0.4）

新增只读兼容模块 CanvasRenderAdapter，与 CanvasAdapter 同属 canvas 兼容层。读取 node.getData()、nodeEl、containerEl、isEditing，edge.getData()、lineGroupEl、lineEndGroupEl、labelElement.wrapperEl，以及 nodeInteractionLayer.target/interactionEl、menu.menuEl 和 selection。所有字段仅用于确定渲染对象，不写节点或选择数据。

CSS 兼容选择器集中在 styles.css：原生 canvas-node-container、canvas-node-label，以及 Canvas 自带的 --zoom-multiplier。业务渲染层只管理 smc-semantic-* 类和自建纯文本标签。原生元素保留；恢复时删除插件类和标签。模式切换立即触发对账，同档位下通过定期只读扫描发现移动、内容或 DOM 改变，无变化时不写 DOM。

Phase 5 的规则、编辑例外、活动画布范围及验收方法见 phase5-validation.md。DOM 恢复测试曾发现共享交互层清理遗漏，已修复并加入回归覆盖。

## Phase 6：group 概览标签

本机 Obsidian 1.9.14 的 group 根节点为 .canvas-node-group，labelEl（.canvas-group-label）直接挂在 nodeEl 下；containerEl 中的内容负责背景。group 名称来自 getData().label。focusLabel 通过 contenteditable="true" 进入编辑，并不设置 node.isEditing，因此单独检测该属性。

原生 --zoom-multiplier 使用 sqrt(1 / zoom)，不能保持固定的屏幕字号。GroupOverviewRenderer 使用实际线性 zoom 反向补偿，在自行注入的 overlay 上设置 CSS 变量。字号目标为 24px，受区域大小约束可降低到 12px；最多三行，内容限制在边界内。所有长度仅影响辅助 DOM，不写 Canvas 数据。

OVERVIEW 隐藏原生标题并显示中央标题；原生编辑属性通过 CSS 立即恢复输入框并隐藏 overlay，随后扫描释放该 group 的辅助标签。其他档位、暂停、切换、异常和卸载都会移除辅助标签及类。原生标签的文本、内联样式和 contenteditable 状态均由 Obsidian 自身管理。

## Phase 8：嵌套协调

VisibilityEngine 为每个节点生成最终可见性，并为 group 显式生成 container / summary / hidden 状态。STRUCTURE 的 L3、OVERVIEW 的 L2 是概括候选；较高层级 group 保持原生容器，较低层级隐藏。GroupOverviewRenderer 只接收最终 summary 集合，并在 STRUCTURE 和 OVERVIEW 中复用字号补偿。

GroupHierarchy 使用完整矩形包含；group 间要求至少一条边严格位于内部，排除相同矩形与自身，避免循环。按宽、高、ID 稳定排序由内到外处理。无需建立唯一直接父级，保留所有包含关系，避免共享重点对象只保护一个重叠容器。含有同级/更高优先级可见后代、编辑对象或未知可见类型的概括候选改为边缘标题。

编辑同时读取普通 node.isEditing 和 group labelEl 的 contenteditable。隐藏 group 只给其自身原生 nodeEl 添加隐藏类，官方 Canvas 的其他节点是独立 DOM，后代不被父子 DOM 级联隐藏。group 连线及原生控件按最终计划同步处理。模式恢复、异常、切换和禁用沿用统一清理。

## Phase 9：MAP 全局档

ZoomMode 增加 MAP。按 MAP、OVERVIEW、STRUCTURE、DETAIL 有序检查全部跨越边界，支持单次采样从任意档位跳到任意档位。首次分类阈值为 10% / 25% / 60%；MAP 独立使用 ±1% 滞回（9%/11%），原两条边界保持 ±2%。配置校验要求所有数值有限、滞回非负且各带不相交。

VisibilityEngine 在 MAP 将可见层级上限设为 L1，继续调用同一嵌套协调与编辑保护。控制器对所有非 DETAIL 档位复用中央标签缩放补偿，因此无须新增 DOM 渲染路径。CanvasObserver 原有日志自动报告 MAP，并在切换活动画布后重置状态。不更改元数据 schema 或默认层级。

## Phase 10：几何缓存与整体回归

GroupContainmentCache 仅缓存节点几何签名、内层优先 ID 顺序和包含 ID 列表。控制器每次完整扫描仍读取当前运行时数据；几何未变时将缓存 ID 映射到本次 RenderNode，避免旧编辑状态、层级或 DOM 被保留。几何/节点类型/ID/顺序/数量变化重新计算。暂停、切换、卸载和异常路径清理缓存。

缓存不跳过显隐规则，store revision 变化仍即时刷新；不改变 100ms 缩放采样、约 300ms 常规扫描。性能方法、耗时与边界见 phase10-validation.md。首次进入和持续移动的大画布仍可能停顿。

## Phase 11：动态显示档位上限

DisplayMode 根据当前 RenderNode 的实际 ID 和类型统计最高层级，未知类型排除，未挂载 DOM 不排除；返回 rawMode / effectiveMode / highestLevel。原始档位由 CanvasObserver 独立维护，显示限制绝不反馈给 getZoomMode。

VisibilityController 在每次完整扫描中先计算显示限制，再用 effectiveMode 渲染。DETAIL 也保持采样，避免丢失最高层级变化；短采样仍只更新已有 group 的实际 zoom 补偿。状态变化日志使用结构化值，不记录路径或节点内容。没有有效节点时返回原生 DETAIL；异常、暂停和切换时清除已确认显示状态。
