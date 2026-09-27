# Phase 11 验证说明（0.0.10）

状态：Phase 1–10 已完成并获用户认可。Phase 11 已通过用户验收。

## 行为

根据当前活动 Canvas 中实际存在的 text/file/link/group 节点，统计最高语义层级（数字最小者），限制最远显示档位：

| 最高层级 | 最远最终显示档位 |
| --- | --- |
| L1 Domain | MAP |
| L2 Core | OVERVIEW |
| L3 Structure | STRUCTURE |
| L4 Detail | DETAIL |

默认普通节点为 L3，group 为 L2。统计包括未挂载 DOM 和当前视觉隐藏的实际节点，不包括已删除节点残留的元数据。未知类型不参与统计，保留原有保守显示行为。空画布或只有未知类型时保持原生 DETAIL 状态。

实际 zoom 不受限制，原始缩放状态机仍使用 10%/25%/60% 初始阈值及既有滞回；最终显示档位单独限制，绝不反馈给原始缩放状态机。只是在较远缩放下保留相应的显示内容，不改节点层级或视口。极度缩小后对象仍可能太小，平移到内容之外仍可能看不到对象。

## 在 Obsidian 中验收

1. 关闭再启用 **Semantic Map Canvas**，加载 0.0.10。
2. 打开 **Semantic Map Canvas - Phase 11.canvas**，先不设置任何层级。group 默认 L2、普通内容默认 L3。
3. 持续缩小至 9% 以下：实际缩放已达到 MAP 范围，但最终显示应停在 OVERVIEW。内层主题仍显示中央标题，不再因缺少 L1 而全空。
4. 将最外层 group 设为 L1，再缩小至 MAP 范围：外层显示中央标题、L2 内层收起。在该缩放比例下把外层恢复 L2，应立即恢复 OVERVIEW 内容，不必先放大。
5. 外层保持 L2。另建一个组外普通节点并设为 L1，在很小的缩放比例下删除这个唯一 L1，然后使用原生 undo/redo：删除时回到 OVERVIEW，撤销恢复 L1 后回到 MAP。其旧元数据在删除后不应阻止回退。
6. 打开 **Semantic Map Canvas - Phase 11 - Ordinary.canvas**。只有一个默认 L3 普通节点，持续缩小时应保持 STRUCTURE 的简短标签。
7. 将这一个节点设为 L4：持续缩小时保持原生 DETAIL 内容；设回 L3、L2 或 L1，应及时更新最终档位。不要新增默认 L3 说明节点，否则画布最高等级不再是 L4。
8. 切回包含 group 的画布，确认限制按当前画布重新计算。编辑低优先级内容时沿用编辑保护，不自动提升记录的层级。
9. 在原始 MAP/OVERVIEW 的 9%–11% 滞回区间测试层级变化：新增 L1 后使用实际缩放状态机保留的档位，不因为之前被限制为 OVERVIEW 而重置原始状态。
10. 暂停/恢复、切换普通笔记、禁用插件后，辅助标签及隐藏样式应正确清理。

## 诊断

Console 勾选 Verbose，过滤 Semantic Map Canvas：
- 原有 Zoom mode 日志表示实际 zoom 的原始档位。
- Semantic display 日志中的 rawMode 表示原始档位，effectiveMode 表示实际用于渲染的最终档位，highestLevel 表示当前最高层级。
- 三者任一变化时自动记录一次；稳定采样不重复记录，不输出路径、节点 ID 或内容。
- **Log active canvas diagnostics** 命令可主动打印最近确认的显示状态；暂停或尚未取得状态时报告 paused / unavailable。

例：rawMode: MAP、effectiveMode: OVERVIEW、highestLevel: 2，表示缩放已很远，但当前没有 L1，因此保持 OVERVIEW 显示。

## 实现与范围

- DisplayMode 是独立纯规则模块；CanvasObserver 继续维护原始缩放滞回，VisibilityController 只把最终档位交给显隐规则。
- 按现有刷新机制读取当前节点，层级修订、节点数量变化或画布切换时及时刷新；同数量替换、延迟加载和几何/编辑变化沿用约 300ms 扫描。
- 即使最终或原始档位为 DETAIL，也继续定期检查，不因提前返回漏掉新增重要节点。
- 不进行每次滚轮事件的文件扫描，不新增磁盘读取、存储 schema 或设置面板。
- group 字号仍按真实 zoom 补偿；嵌套协调、重要子节点和编辑保护、连线、缓存及恢复机制保持。
- 读取异常时清理插件渲染并恢复原生状态，后续采样可以恢复。
- 部署保留既有 data.json 和画布，新增独立测试文件。

## 已执行验证

- 90 项测试、TypeScript/正式构建和 ESLint 通过。
- 最高 L1–L4 × 四个原始档位的完整限制矩阵。
- 普通 text/file/link/group 的深缩放可见性，默认值、残留元数据和未知类型。
- 唯一 L1 的新增、删除、恢复及修改；相同数量替换；DETAIL 限制下继续发现变化。
- 空画布、未挂载 DOM 的节点、切换文件、编辑保护、状态变化日志、暂停/卸载/异常恢复。
- CanvasObserver 和 VisibilityController 联合验证：限制后的档位不影响原始 9%/11% 滞回。
- 既有存储、嵌套、连线、生命周期和无变化 DOM 测试继续通过。
- Chrome headless 使用实际控制器和 styles.css，在 8% 缩放下验证最高 L2/L3/L4/L1 分别对应 OVERVIEW/STRUCTURE/DETAIL/MAP，CSS 显隐与中央标签位置通过，截图已检查。

浏览器外壳为模拟 Canvas，真实 Obsidian 交互仍以本阶段用户验收为准。Phase 10 性能数字是当时版本的记录，本阶段不将其直接作为新增 DETAIL 扫描的性能保证。
