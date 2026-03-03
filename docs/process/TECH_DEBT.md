# CoMind 技术债务

> 记录所有技术债务，按优先级分类。实现新需求时必须检查是否可以顺便解决。

---

## 技术债索引

| ID | 标题 | 优先级 | 状态 | 影响范围 |
|----|------|--------|------|----------|
| TD-001 | Gateway 唯一标识问题 | P2 | open | 成员匹配 |
| TD-002 | UUID → Base58 ID 迁移失败 | P1 | open | 数据库 |
| TD-003 | openclaw-gateway 内存泄漏 | P1 | open | 服务器性能 |
| TD-004 | chat-action-parser 待迁移 | P1 | resolved | 对话信道 |
| TD-005 | Browser Direct 模式 Chat Actions 全局监听 | P2 | open | 对话信道 |
| TD-006 | 5 个文件超 800 行需模块拆分（原 8 个，3 个已拆分） | P1 | in_progress | 代码组织 |
| TD-007 | 跨页面重复模式未抽象（删除确认已迁移 9/13） | P2 | in_progress | 可维护性 |
| TD-008 | Gateway 客户端未抽象为 Provider 接口 | P2 | open | 多平台扩展 |
| TD-009 | Phase 10 数据统计/分析面板未实现 | P2 | open | 功能缺失 |
| TD-010 | Phase 11 插件扩展机制未实现 | P3 | open | 功能缺失 |
| TD-011 | Gateway RPC 方法名未共享常量 | P2 | open | Gateway 双客户端 |

---

## 优先级说明

| 优先级 | 说明 | 处理时机 |
|--------|------|----------|
| **P0** | 阻塞性问题，影响核心功能 | 立即处理 |
| **P1** | 重要问题，影响稳定性/性能 | 尽快处理 |
| **P2** | 中等问题，影响用户体验 | 有空处理 |
| **P3** | 低优先级，优化建议 | 视情况处理 |

---

## TD-001: Gateway 唯一标识问题

**优先级**：P2
**状态**：open
**创建时间**：2026-02-20
**影响范围**：成员匹配

### 问题描述

当用户连接不同的 OpenClaw Gateway 时，需要区分不同 Gateway 中的 Agent。当前使用 `openclawGatewayUrl + openclawAgentId` 作为复合键来匹配 AI 成员，但这个方案存在可靠性问题。

### 当前方案

**复合键**：`(openclawGatewayUrl, openclawAgentId)`

**问题**：
1. **URL 可能变化** - Gateway 的 WebSocket URL 可能因为网络环境变化而改变
2. **Token 可能变化** - Gateway 的 Token 可能被重新生成
3. **无法持久识别** - URL/Token 变化后，之前创建的 AI 成员记录无法匹配到新的连接

### 已调研的方案

1. **Gateway deviceId** - OpenClaw Gateway 有全局唯一 deviceId，但未在协议中暴露
2. **用户手动设置别名** - 不够可靠
3. **Token Hash** - URL 和 Token 都可能变化
4. **设备认证（ED25519）** - 实现复杂，跨设备无法同步

### 建议方案

向 OpenClaw 提 Feature Request，请求在 `hello-ok` 响应中暴露 Gateway 的 `deviceId`。

### 相关代码

- `db/schema.ts` - `members` 表
- `store/gateway.store.ts` - `refreshAgents` 函数
- `app/members/page.tsx` - `getLocalAIMember` 函数

### 更新记录

- 2026-02-20：初始记录

---

## TD-002: UUID → Base58 ID 迁移失败

**优先级**：P1
**状态**：open
**创建时间**：2026-02-20
**影响范围**：数据库

### 问题描述

服务器构建时出现 UUID → Base58 ID 迁移失败错误：

```
[CoMind-v2] Migration failed, rolled back: SqliteError: FOREIGN KEY constraint failed
```

### 根本原因

迁移过程中存在外键约束冲突，可能是：
1. 某些关联记录的 ID 未同步更新
2. 迁移顺序不正确
3. 存在孤立的关联记录

### 影响

- 迁移回滚后不影响运行，但每次构建都会尝试迁移
- 可能导致旧 UUID 格式数据无法正确转换

### 建议方案

1. 检查外键关联表，确保迁移顺序正确
2. 先迁移主表，再迁移关联表
3. 处理孤立记录

### 相关代码

- `db/index.ts` - 迁移逻辑

### 更新记录

- 2026-02-20：初始记录

---

## TD-003: openclaw-gateway 内存泄漏

**优先级**：P1
**状态**：open
**创建时间**：2026-02-20
**影响范围**：服务器性能

### 问题描述

openclaw-gateway 进程运行 3 天后内存从 465MB 膨胀到 1.4GB，占用服务器 40% 内存。

### 影响

- 服务器内存紧张（总共 3.5GB）
- 系统变慢
- 需要定期手动重启

### 临时解决方案

定期重启 openclaw-gateway 进程。

### 建议方案

1. 向 OpenClaw 团队报告内存泄漏问题
2. 设置定时任务每周重启一次

### 相关命令

```bash
# 重启 openclaw-gateway
pkill -f openclaw-gateway && nohup openclaw-gateway > /var/log/openclaw-gateway.log 2>&1 &
```

### 更新记录

- 2026-02-20：初始记录，临时解决方案验证有效

---

## TD-004: chat-action-parser 待迁移

**优先级**：P1
**状态**：resolved
**创建时间**：2026-02-20
**解决时间**：2026-02-20
**影响范围**：对话信道

### 问题描述

对话信道数据交互模块已重构为 `lib/chat-channel/`，但旧的 `lib/chat-action-parser.ts` 和 `app/api/chat-actions/route.ts` 仍在使用中，存在以下问题：

1. **代码重复**：新旧两套解析和执行逻辑
2. **功能不完整**：旧模块缺少 `get_mcp_token`、`sync_identity` 等新功能
3. **维护困难**：修改功能需要同步两处代码

### 解决方案

1. 创建客户端入口 `lib/chat-channel/client.ts`，只导出解析器相关功能
2. 迁移 `ChatPanel.tsx` 使用 `@/lib/chat-channel/client`
3. 迁移 `/api/chat-actions` 使用 `@/lib/chat-channel` 的 `executeActions`
4. 标记旧模块为 `@deprecated`

### 相关代码

- `lib/chat-action-parser.ts` - 已废弃
- `app/api/chat-actions/route.ts` - 已迁移
- `lib/chat-channel/` - 新模块
- `lib/chat-channel/client.ts` - 客户端入口
- `components/chat/ChatPanel.tsx` - 已迁移

### 更新记录

- 2026-02-20：初始记录，REQ-002 完成后发现
- 2026-02-20：完成迁移，创建客户端入口解决服务端/客户端模块问题

---

## TD-005: Browser Direct 模式 Chat Actions 全局监听

**优先级**：P2
**状态**：open
**创建时间**：2026-02-22
**影响范围**：对话信道

### 问题描述

当前 Chat Actions 自动解析执行（F2）仅在 `server_proxy` 模式下工作——由 `ServerGatewayClient` 在服务端监听 chat 事件并自动处理。

在 `browser_direct` 模式下，WebSocket 连接由浏览器直接建立（`lib/gateway-client.ts`），chat 事件只在前端 `ChatPanel` 打开时才被处理。如果用户未打开对应会话的 ChatPanel，AI 发送的 actions 将不会被执行。

### 当前状态

- **server_proxy 模式**：✅ 已实现（`server-gateway-client.ts` → `handleChatActions`）
- **browser_direct 模式**：❌ 未实现，需要全局监听方案

### 需要考虑的问题

1. **生命周期**：浏览器页面关闭/刷新后监听中断，actions 丢失
2. **重复执行**：ChatPanel 和全局监听器可能同时处理同一条消息
3. **离线场景**：用户关闭浏览器后 AI 的消息完全无法处理
4. **多标签页**：多个浏览器标签页可能同时监听同一会话

### 可能方案

1. **前端全局监听器**：在 `DataProvider` 或 `AppShell` 层注册全局 chat 事件处理器，不依赖 ChatPanel
   - 优点：实现简单
   - 缺点：浏览器关闭后失效

2. **混合模式**：browser_direct 模式下仍通过服务端中转 action 执行请求
   - 优点：可靠性更高
   - 缺点：架构更复杂

3. **推荐用户使用 server_proxy 模式**：在 UI 中提示 browser_direct 模式下 actions 自动执行功能受限
   - 优点：零开发成本
   - 缺点：功能受限

### 相关代码

- `lib/server-gateway-client.ts` - server_proxy 模式的 `handleChatActions` 实现
- `lib/gateway-client.ts` - browser_direct 模式的 WebSocket 客户端
- `components/chat/ChatPanel.tsx` - 前端 chat 消息处理
- `lib/chat-channel/` - actions 解析与执行模块

### 更新记录

- 2026-02-22：初始记录，F1 需求 pending，等待优化方案确定

---

## TD-006: 5 个文件超 800 行需模块拆分

**优先级**：P1
**状态**：in_progress
**创建时间**：2026-02-22
**影响范围**：代码组织、可维护性

### 问题描述

原 8 个文件超过 800 行编码规范上限，已拆分 3 个，剩余 5 个仍超标：

| 文件 | 原行数 | 当前行数 | 状态 |
|------|--------|---------|------|
| `components/chat/ChatPanel.tsx` | ~1527 | 674 | ✅ 已拆分（提取子组件 + hooks） |
| `app/agents/page.tsx` | 1275 | 326 | ✅ 已拆分（提取到 `components/agents/`） |
| `lib/markdown-sync.ts` | 1082 | 392 | ✅ 已拆分（提取到 `lib/sync/` 子模块） |
| `app/tasks/page.tsx` | 817 | **1203** | ❌ 反而增长（新增泳道视图等功能） |
| `app/wiki/page.tsx` | 811 | **986** | ❌ 仍超标 |
| `lib/server-gateway-client.ts` | 1129 | **942** | ⚠️ 缩减但仍超标 |
| `store/gateway.store.ts` | 992 | **897** | ⚠️ 仍超标 |
| `app/schedule/page.tsx` | 822 | **822** | ⚠️ 仍超标 |

### 拆分方案

按优先级逐步拆分：
- **P0**：`tasks/page.tsx`（1203 行，最严重）— 提取泳道视图、看板视图为独立组件
- **P1**：`wiki/page.tsx`（986 行）— 提取编辑器、知识图谱、交付对话框为独立组件
- **P1**：`server-gateway-client.ts`（942 行）— 提取 chat action 处理、消息格式化为独立模块
- **P2**：`gateway.store.ts`（897 行）— 提取 CRUD 操作为独立模块
- **P3**：`schedule/page.tsx`（822 行）— 提取新建/编辑对话框为独立组件

### 更新记录

- 2026-02-22：初始记录，开始 Phase 1 拆分
- 2026-02-22：ChatPanel 拆分完成（1527 → ~670 行），提取 useChatStream、useAutoScroll、ChatInputArea、ChatMessageList、ChatSessionList
- 2026-03-02：Review 审计更新——agents/page.tsx 已拆分至 326 行，markdown-sync.ts 已拆分至 392 行；tasks/page.tsx 因新功能增长至 1203 行，wiki/page.tsx 增长至 986 行

---

## TD-007: 跨页面重复模式未抽象

**优先级**：P2
**状态**：in_progress
**创建时间**：2026-02-22
**影响范围**：可维护性、代码复用

### 问题描述

多个页面存在相同的交互模式但各自实现，导致代码重复和行为不一致：

| 重复模式 | 出现次数 | 现有抽象 | 当前状态 |
|----------|---------|---------|----------|
| 删除确认 | 13 处 | `useConfirmAction` + `ConfirmDialog` ✅ | ⚠️ 已迁移 9/13：`members/page.tsx`、`Sidebar.tsx` 仍手写弹窗；`WorkspaceCard.tsx`、`GatewayConfigPanel.tsx` 仍用原生 `confirm()` |
| 防抖保存 | 3 处 | 无 | ❌ `TaskDrawer.tsx`、`wiki/page.tsx`、`lib/openclaw/config.ts` 各自实现 |
| 空状态展示 | 11+ 处 | 无 | ❌ 每处内联硬编码文案 + 样式不统一 |
| 列表筛选/搜索 | 5 处 | 无 | ❌ 每处各自实现 useMemo + filter |
| 内联编辑 | 3 处 | 无 | ❌ 实现方式各异 |

### 建议方案

提取公共抽象：
1. `hooks/useDebouncedCallback.ts` — 防抖回调
2. `components/EmptyState.tsx` — 统一空状态
3. `hooks/useFilteredList.ts` — 列表筛选
4. 迁移剩余 4 处到 `useConfirmAction`：`members/page.tsx`、`Sidebar.tsx`、`WorkspaceCard.tsx`、`GatewayConfigPanel.tsx`

### 更新记录

- 2026-02-22：初始记录
- 2026-03-02：Review 审计更新——`useConfirmAction` 已迁移 9/13 处（TaskDrawer、MilestoneManager、deliveries、wiki、agents、projects、tasks、schedule、sessions）；空状态实际有 11+ 处重复；防抖保存发现第 3 处（`lib/openclaw/config.ts`）

---

## TD-008: Gateway 客户端未抽象为 Provider 接口

**优先级**：P2
**状态**：open
**创建时间**：2026-02-22
**影响范围**：多平台扩展

### 问题描述

当前 Gateway 客户端直接耦合 OpenClaw 协议，不支持其他平台（如 Knot 等 OpenClaw 封装运行时）的统一管理。未来需要支持多 Gateway 平台时，需要引入 Provider 抽象层。

### 当前架构

```
gateway.store.ts → lib/gateway-client.ts (浏览器 WebSocket)
                 → lib/server-gateway-client.ts (服务端 WebSocket)
                 → lib/gateway-proxy.ts (代理转发)
```

所有文件直接实现 OpenClaw Protocol v3 细节。

### 目标架构

```
gateway.store.ts → GatewayProvider (接口)
                     ├── OpenClawProvider (WebSocket v3)
                     ├── KnotProvider (AG-UI 协议)
                     └── CustomProvider (未来扩展)
```

### 相关代码

- `lib/gateway-client.ts` — 浏览器端 OpenClaw 客户端
- `lib/server-gateway-client.ts` — 服务端 OpenClaw 客户端
- `lib/gateway-proxy.ts` — 代理客户端
- `store/gateway.store.ts` — Gateway 状态管理
- `app/api/chat-reply/route.ts` — 已有 OpenClaw/Knot 路由分发

### 更新记录

- 2026-02-22：初始记录，与 PRD Phase 14 对应

---

## TD-009: Phase 10 数据统计/分析面板未实现

**优先级**：P2
**状态**：open
**创建时间**：2026-02-22
**影响范围**：功能缺失

### 问题描述

PRD Phase 10 规划了 Dashboard 数据可视化功能（任务完成率、Agent 活跃度等），目前未实现。

### 建议方案

1. 集成图表库（recharts 或 chart.js）
2. 增加统计 API 端点
3. Dashboard 页面添加数据面板

### 更新记录

- 2026-02-22：从 PRD Phase 10 迁移为技术债

---

## TD-010: Phase 11 插件扩展机制未实现

**优先级**：P3
**状态**：open
**创建时间**：2026-02-22
**影响范围**：功能缺失

### 问题描述

PRD Phase 11 规划了第三方插件加载机制，目前未实现。

### 建议方案

1. 定义插件接口标准
2. 实现插件加载器
3. 提供插件开发 SDK

### 更新记录

- 2026-02-22：从 PRD Phase 11 迁移为技术债

---

## TD-011: Gateway RPC 方法名未共享常量

**优先级**：P2
**状态**：open
**创建时间**：2026-02-25
**影响范围**：Gateway 双客户端

### 问题描述

`gateway-client.ts`（浏览器直连）和 `gateway-proxy.ts`（服务端代理）两个 Gateway 客户端独立定义 RPC 方法名字符串。v2.2.5 之前 `gateway-proxy.ts` 使用了错误的方法名（`cron.create`/`cron.delete` 而非正确的 `cron.add`/`cron.remove`），因为两个文件无共享常量引用。

### 根本原因

RPC 方法名以字符串字面量散落在两个客户端中，无编译时保障。新增或修改 RPC 方法时，容易遗漏其中一个客户端。

### 影响

- `server_proxy` 模式下创建/删除 cron job 失败（已在 v2.2.5 修复）
- 未来新增 RPC 方法时可能再次出现不一致

### 建议方案

1. 创建 `lib/gateway-rpc-methods.ts`，导出所有 RPC 方法名常量
2. `gateway-client.ts` 和 `gateway-proxy.ts` 均从该文件引用
3. 添加 TypeScript 类型约束，确保方法名合法

### 相关代码

- `lib/gateway-client.ts` — 浏览器端 RPC 调用
- `lib/gateway-proxy.ts` — 服务端代理 RPC 调用
- BUG-032 — 本次发现的方法名不一致问题

### 更新记录

- 2026-02-25：初始记录，由全量审查 BUG-032 发现

---

## 技术债模板

```markdown
## TD-XXX: 标题

**优先级**：P0/P1/P2/P3
**状态**：open / in_progress / resolved / wontfix
**创建时间**：YYYY-MM-DD
**影响范围**：简述影响范围

### 问题描述

[详细描述问题]

### 根本原因

[分析根本原因]

### 影响

[描述对系统/用户的影响]

### 建议方案

[提出解决方案]

### 相关代码

- `path/to/file.ts` - 说明

### 更新记录

- YYYY-MM-DD：初始记录
- YYYY-MM-DD：更新内容
```

---

## 贡献指南

发现新问题或解决问题时，请更新此文档：

1. **发现新问题**：使用模板创建新条目
2. **解决问题**：更新状态为 `resolved`，记录解决方案
3. **放弃解决**：更新状态为 `wontfix`，说明原因

---

## 处理检查清单

实现新需求时，检查是否可以顺便解决技术债：

- [ ] 查看技术债索引
- [ ] 评估是否与当前需求相关
- [ ] 如果相关，评估解决成本
- [ ] 如果成本可控，顺便解决
- [ ] 更新技术债状态
