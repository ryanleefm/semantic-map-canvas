# Phase 13 验收说明（0.0.12，用户验收通过）

## 行为

在活动 Canvas 的空白处右键菜单中增加 Display mode：

| 选项 | 最终显示档位 |
| --- | --- |
| Auto（默认） | 根据缩放、滞回及当前最高层级计算 |
| L1 — Map | MAP |
| L2 — Overview | OVERVIEW |
| L3 — Structure | STRUCTURE |
| L4 — Detail | DETAIL |

手动选择成功保存后立即刷新，不改变实际 zoom、节点层级或 .canvas 文件。手动状态下继续缩放，中央标题仍随空间变化而适配；切回 Auto 时按当前缩放及持续维护的原始滞回状态恢复。手动选择不受最高层级限制：缺少 L1 时选择 L1 — Map 可能全空，可从空白处菜单切回 Auto 或 L4 — Detail。

选择按 Canvas 文件保存在插件 data.json 的 canvases[path].displayMode 中，值为 MAP/OVERVIEW/STRUCTURE/DETAIL；缺失或非法值视为 AUTO，回到 Auto 时删除该可选字段。保持 schema v2，旧节点层级、shortLabel 及 v1 迁移不变。空画布也可保存。重命名、文件夹重命名和删除沿用既有的串行元数据操作。保存失败不更新内存选择，不触发刷新，并弹出英文提示。

暂停语义显隐优先于所有档位，保留所选值；恢复时应用该值。所有界面保持英文，无新高频轮询和缩放磁盘写入。诊断字段 selection/rawMode/effectiveMode/highestLevel 区分用户选择、实际缩放状态和最终显示。

## 菜单兼容性

只读检查本机 Obsidian 1.9.14 安装包确认：空白菜单 onContextMenu 在 showQuickSettingsMenu(menu) 后显示，没有对应的 canvas:menu 事件。canvas:selection-menu 仅适用于多选菜单，不能用于空白菜单。

因此 CanvasMenuBridge 只包装当前 Canvas 实例的 showQuickSettingsMenu：先调用原方法，再追加选项，不改全局 Menu、Canvas 原型或 DOM 右键事件。该方法也用于原生画布设置菜单，所以那里同样可见 Display mode。原生只读模式可能不显示空白处右键菜单，可通过画布设置菜单操作。

切换活动画布或卸载时恢复原描述符；后加载插件若已包装该方法，则保留其方法并停用本插件回调，避免覆盖其他插件。使用 WeakSet 防止同一菜单重复添加。菜单点击时重新解析路径，切换/删除/卸载后的旧菜单不再写入。此接口仍属于内部 API，须在真实 Obsidian 中验收。

## 自动检查

- 106 项回归测试通过，涵盖默认 Auto、四种手动映射、跨阈值缩放、标题适配、编辑保护、空画布、无 L1 全隐藏、暂停恢复、保存失败、旧数据兼容、重命名删除、画布隔离、原始滞回、原生菜单保留、去重、路径重解析和卸载恢复。
- 36 个隔离 Chrome 场景通过，除原有完整标题/字体/尺寸/缓存断言，还检查手动固定档位时的实际文字范围、缩放不重测量、MAP 隐藏、DETAIL 原生展示以及回到 Auto。
- 浏览器测试使用模拟 Canvas DOM；安装包静态检查不等于已完成真实应用交互验收。
- 构建、Lint 与测试部署结果见本次交付消息。

## 用户验收步骤

1. 关闭再启用 Semantic Map Canvas，确认版本 0.0.12。
2. 打开 Semantic Map Canvas - Phase 13.canvas，空白处右键查看 Display mode，确认 Auto 勾选，原生菜单保留。
3. 选择 L3 — Structure，放大到原本的 DETAIL、缩小到 MAP，普通节点保持结构档显示，中央标题字号仍变化。
4. 选择 L2 — Overview，观察分组与普通节点按既有规则展示；选择 L4 — Detail，确认全部原生内容恢复。
5. 样例默认没有 L1，选择 L1 — Map 后应全隐藏；再次空白处右键选择 Auto 或 L4，应恢复。若视口偏离内容，使用原生缩放适配。
6. 更改任一节点为 L1 后再选择 L1 — Map，确认 L1 保留，其他节点按规则隐藏。核对节点的 Semantic level 菜单未变化。
7. 保持某个手动模式，切换到另一个 Canvas，确认默认 Auto 或其自己的选择；切回、关闭重开及重启 Obsidian，选择应恢复。
8. 在有手动选择的 Canvas 中执行 Toggle semantic visibility：暂停时全原生，恢复后重新应用保存的模式。
9. 重命名样例文件后确认选择保留；可另建空 Canvas 保存手动模式，关闭重开检查。
10. 进入编辑、调整节点大小、禁用插件，确认原有编辑保护、标题适配和原生菜单恢复正常。

用户已验收通过，并授权将 0.0.12 作为正式 Release 发布。原有 0.0.11 测试版保持不变。降级至旧插件后再保存元数据可能丢失新增模式字段，因此降级前可备份 data.json。
