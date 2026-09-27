# Phase 7 验证说明（0.0.6）

状态：Phase 1–7 已由用户在真实 Obsidian 中验收通过。本说明保留 Phase 7 的交付范围；后续 group 显示规则见 Phase 8。

## 本阶段范围

普通 text/file/link 节点和 group 均可右键设置：
- L1 Domain（领域）
- L2 Core（核心）
- L3 Structure（结构）
- L4 Detail（细节）

未设置的普通节点默认 L3，group 默认 L2。手动设置优先，移动或改变包含关系不会自动调整层级。

本阶段只完成 group 层级的设置和存储，group 继续沿用 Phase 6 的显示方式。嵌套 group 中央标题重叠将在 Phase 8 处理；MAP 全局档将在 Phase 9 实现。

## 在 Obsidian 中验收

1. 在测试 vault 关闭再启用 **Semantic Map Canvas**，加载 0.0.6。已有 schema v1 数据会在这次加载时自动备份并迁移。
2. 打开 **Semantic Map Canvas - Phase 7.canvas**，在 DETAIL 比例下查看。
3. 右键新的普通节点 → **Semantic level**：应看到四个选项，默认勾选 **L3 Structure**。
4. 右键外层或内层 group 的边框 → **Semantic level**：应看到同样的四个选项，默认勾选 **L2 Core**。
5. 将外层 group 设为 **L1 Domain**，内层保持 **L2 Core**，把某个普通节点设为 **L4 Detail**。重新打开菜单，勾选应对应。
6. 关闭再启用插件，确认以上设置仍保留；也可以移动 group 或内部节点，确认层级不随位置改变。
7. 打开以前已设置过层级的画布：原 **L1 Core** 应成为 **L2 Core**，原 **L2 Structure** 成为 **L3 Structure**，原 **L3 Detail** 成为 **L4 Detail**，原有 shortLabel 保留。
8. 再次重载，确认层级不会继续增加。
9. 在旧画布上缩放：普通节点原有显隐效果应保持；L4 在 STRUCTURE 隐藏，OVERVIEW 保留组外 L1/L2，组内普通节点仍隐藏。group 依然显示原来的概览中央标题，不会因设置 L4 就隐藏。
10. 暂停显隐、切换画布或禁用插件，应正常恢复原生显示。

初次分类仍按 25% / 60%；滞回边界仍为 23%/27%、58%/62%。

## 数据迁移与恢复

- 新数据使用 schemaVersion 2，按 Canvas 路径与节点 ID 保存，不写入 .canvas。
- 首次加载完整校验旧数据后，先在插件目录创建并读回验证 **data.schema-v1.backup.json**，再保存迁移后的 data.json。
- 目录：VaultsforTest/.obsidian/plugins/semantic-map-canvas。
- 相同备份可在重试时复用；已有不同内容时使用 .1、.2 等后缀，不覆盖已有备份。
- 无旧数据时不创建旧格式备份；已经是 schema v2 时不重复迁移。
- 备份失败时不启动迁移；迁移写入失败时尝试恢复旧数据。若恢复也失败，控制台明确提示从备份恢复，并停止层级编辑和语义渲染，保留原生 Canvas。
- 需要手动恢复时先禁用插件，保留当前 data.json，选择对应的完整 schema-v1 备份复制为 data.json，再启用 0.0.6 即可重新迁移。备份只包含迁移前的设置，不包含升级后新设置。
- 0.0.5 无法直接读取 schema v2；如需降级，应使用匹配的旧数据备份。

部署脚本本身只复制插件产物，不提前迁移正在运行的 vault 数据。实际备份与迁移在新版插件加载时执行。

## 已执行自动化验证

52 项测试通过，TypeScript/正式构建及 ESLint 通过。覆盖：
- 四级菜单、普通节点默认值、group 默认值、手动设置与重载。
- 旧层级映射、shortLabel 和路径/ID 保留、仅迁移一次。
- 损坏及未来版本数据拒绝写入、备份失败不迁移。
- 部分写入失败时恢复旧数据；恢复失败时保留备份并阻止继续编辑。
- 备份读回校验、重复使用相同备份、不覆盖不同备份。
- 真实 JSON 文件的备份、迁移、保存及重载。
- 原有节点/连线显隐、group 标题、编辑例外和清理恢复无回归。
- Canvas 几何和原始内容未被渲染逻辑改变。

自动化使用模拟 Obsidian API 与 DOM；上述真实应用菜单和重载行为仍需用户验收。Phase 8 尚未开始。
