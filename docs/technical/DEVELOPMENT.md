# CoMind v2 开发文档

> **读者**：开发者
> **最后更新**：2026-02-28

---

## 1. 项目定位

CoMind V2 是 **AI Agent 管理平台**，作为 **OpenClaw Gateway 的增强型前端**，提供完整的人机协作能力。

```
人类 ←→ CoMind 平台 ←→ OpenClaw 智能体
                    ↘
                      任务、文档、状态、定时任务
```

**核心用户**：OpenClaw 智能体（AI Agent），其次是人类用户。

| 方面 | CoMind | OpenClaw |
|------|--------|----------|
| 角色 | 管理平台 | 智能体运行时 |
| 数据 | SQLite（项目数据）+ Gateway（智能体数据） | 智能体状态、会话、技能 |
| 通信 | WebSocket 连接 Gateway | 提供 WebSocket 服务 |
| 核心 | 任务、文档、成员管理 | AI 推理、工具调用、记忆 |

---

## 2. 架构概览

### 2.1 双数据源架构

```
┌─────────────────────────────────────────────────────────┐
│                      CoMind 前端                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   SQLite 数据                    Gateway 数据           │
│   ├─ tasks                      ├─ agents              │
│   ├─ projects                   ├─ sessions            │
│   ├─ documents                  ├─ cron jobs           │
│   ├─ members                    ├─ skills              │
│   └─ deliveries                 └─ config              │
│                                                         │
│   ↓ Drizzle ORM                 ↓ WebSocket (v3)       │
│                                                         │
│   本地数据库                     OpenClaw Gateway        │
│   data/comind.db                ws://localhost:18789   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流（4 条路径）

1. **用户 → SQLite**：React 组件 → Zustand Store → `lib/data-service.ts`（fetch）→ API Route → Drizzle ORM → SQLite
2. **用户 → Gateway**：React 组件 → Zustand Store → `lib/gateway-client.ts`（WebSocket v3）→ OpenClaw Gateway
3. **实时推送**：API 写操作 → `eventBus.emit()`（`lib/event-bus.ts`）→ SSE `/api/sse` → `DataProvider` 自动刷新 Store
4. **AI MCP**：Agent → `/api/mcp`（或 `/api/mcp/external` + Bearer Token）→ `core/mcp/` 执行器 → DB 写入 + SSE 广播 → 前端刷新

### 2.3 关键设计决策

| 决策 | 说明 |
|------|------|
| Base58 ID | 主键使用 Base58 短 ID（~11 字符），由 API 层生成，非 UUID |
| 服务端/客户端分离 | 涉及 `db`、`fs` 的模块不能在客户端导入 |
| 实时推送 | 所有写操作通过 SSE 广播，前端自动刷新 |
| MCP 协议 | AI 智能体通过 MCP Tools 操作平台数据 |
| Gateway 双模式 | `browser_direct`（浏览器直连 WS）/ `server_proxy`（服务端代理） |

---

## 3. 项目结构

```
comind-v2/
├── app/                          # Next.js 14 App Router
│   ├── page.tsx                  # 首页（重定向到 /dashboard）
│   ├── layout.tsx                # 根布局（I18nProvider）
│   ├── globals.css               # 全局样式
│   ├── dashboard/page.tsx        # 工作台（Gateway 连接+快照+指标）
│   ├── tasks/page.tsx            # 任务看板（泳道+四列+跨项目拖拽）
│   ├── projects/page.tsx         # 项目管理
│   ├── wiki/page.tsx             # 文档 Wiki（多项目标签+类型分类）
│   ├── agents/page.tsx           # Agent 管理（Sessions/Skills/Files 面板）
│   ├── sessions/page.tsx         # 会话管理（筛选/编辑/Thinking Level）
│   ├── skills/page.tsx           # 技能市场（分组/安装/API Key）
│   ├── schedule/page.tsx         # 定时任务（Cron/Interval/At + Gateway RPC）
│   ├── scheduler/page.tsx        # 调度器
│   ├── deliveries/page.tsx       # 文档交付
│   ├── members/page.tsx          # 成员管理
│   ├── settings/page.tsx         # 系统设置
│   ├── settings/openclaw/page.tsx # OpenClaw 配置
│   └── api/                      # 30+ 组 REST API 路由（详见 API.md）
│
├── components/                   # 55+ 个 UI 组件
│   ├── AppShell.tsx              # 应用外壳
│   ├── Sidebar.tsx               # 侧边栏（12 个导航项）
│   ├── Header.tsx                # 顶部栏 + 项目选择器
│   ├── DataProvider.tsx          # 数据初始化 + SSE 实时同步
│   ├── TaskDrawer.tsx            # 任务详情抽屉（防抖编辑）
│   ├── MarkdownEditor.tsx        # Markdown 编辑器
│   ├── GatewayRequired.tsx       # Gateway 断连引导
│   ├── agents/                   # 8 个 Agent 子组件
│   ├── chat/                     # 9 个聊天子组件
│   │   ├── ChatPanel.tsx         # 聊天面板（Gateway+本地双模式，~670 行）
│   │   ├── ChatInputArea.tsx     # 输入区域
│   │   ├── ChatMessageList.tsx   # 消息列表
│   │   ├── ChatSessionList.tsx   # 会话列表
│   │   └── ...
│   ├── sop/                      # 3 个 SOP 子组件
│   │   ├── SOPProgressBar.tsx    # SOP 进度条（compact/expanded）
│   │   ├── SOPTemplateEditor.tsx # SOP 模板编辑器（拖拽排序）
│   │   └── SOPDebugPanel.tsx     # SOP 调试面板
│   ├── openclaw/                 # 2 个 OpenClaw 组件
│   ├── settings/                 # 1 个设置组件
│   └── ui/                       # 14 个 shadcn/ui 基础组件
│
├── store/                        # 16 个 Zustand Store + index.ts
│   ├── index.ts                  # 聚合导出 + useDataInitializer
│   ├── task.store.ts
│   ├── project.store.ts
│   ├── member.store.ts
│   ├── document.store.ts
│   ├── delivery.store.ts
│   ├── schedule.store.ts
│   ├── comment.store.ts
│   ├── tasklog.store.ts
│   ├── openclaw.store.ts
│   ├── openclaw-workspace.store.ts
│   ├── chat.store.ts             # 含 persist（activeGwSessionKey）
│   ├── milestone.store.ts        # 里程碑 CRUD
│   ├── sop-template.store.ts     # SOP 模板 CRUD + 筛选
│   ├── render-template.store.ts  # 渲染模板 CRUD
│   ├── gateway.store.ts          # Gateway 连接/快照/Agent/Session/Skill/Cron
│   └── ui.store.ts
│
├── lib/                          # 核心库（43 个文件）
│   ├── gateway-client.ts         # WebSocket 客户端（Protocol v3）
│   ├── server-gateway-client.ts  # 服务端 Gateway 客户端
│   ├── gateway-proxy.ts          # Gateway 代理
│   ├── gateway-config-db.ts      # Gateway 配置存取
│   ├── gateway-logger.ts         # Gateway 日志
│   ├── data-service.ts           # REST API 数据层
│   ├── event-bus.ts              # SSE 事件总线
│   ├── i18n.ts                   # 国际化（en + zh）
│   ├── validators.ts             # 枚举校验
│   ├── sanitize.ts               # Token 脱敏
│   ├── security.ts               # 安全工具
│   ├── rate-limit.ts             # 速率限制
│   ├── id.ts                     # Base58 ID 生成
│   ├── markdown-sync.ts          # Markdown ↔ 看板双向同步
│   ├── template-engine.ts        # 模板引擎
│   ├── tool-policy.ts            # 工具策略
│   ├── audit-log.ts              # 审计日志
│   ├── api-errors.ts             # API 错误处理
│   ├── doc-templates.ts          # 文档模板
│   ├── chat-action-parser.ts     # 聊天动作解析
│   ├── useEscapeKey.ts           # ESC 键 Hook
│   ├── chat-channel/             # 对话信道模块（8 个文件）
│   ├── openclaw/                 # OpenClaw 同步模块（7 个文件）
│   └── sync/                     # 数据同步模块（4 个文件）
│
├── db/                           # 数据库层
│   ├── schema.ts                 # Drizzle Schema（19 张表）
│   └── index.ts                  # SQLite 连接 + 自动迁移 + WAL
│
├── core/                         # 核心业务逻辑
│   ├── member-resolver.ts        # 成员解析器
│   └── mcp/                      # MCP 指令系统
│       ├── definitions.ts        # 37 个工具定义
│       ├── types.ts              # 指令类型
│       └── executor.ts           # 指令执行器
│
├── hooks/                        # 自定义 Hooks
│   ├── useChatStream.ts          # 聊天流式响应
│   ├── useAutoScroll.ts          # 自动滚动
│   └── ...
│
├── types/index.ts                # Gateway 类型（~30 个 type/interface）
├── middleware.ts                  # API 中间件（安全头/CORS/CSRF/限流）
└── CODING_STANDARDS.md           # 编码规范
```

### 项目统计速查

| 项目 | 数量 |
|------|------|
| 页面路由 | **15** |
| API 路由目录 | **30+** |
| Zustand Store | **16** + index |
| UI 组件 | **60+** |
| Lib 文件 | **45+** |
| 数据库表 | **21** |
| MCP 工具 | **37** |
| Gateway 类型 | **~30** |

---

## 4. Gateway 客户端

### 4.1 WebSocket 协议（Protocol v3）

**文件**：`lib/gateway-client.ts`

**帧格式**：

```typescript
// 请求
{ type: "req", id: "req-1-xxx", method: "cron.list", params: {} }

// 响应
{ type: "res", id: "req-1-xxx", ok: true, payload: { ... } }

// 事件（服务端推送）
{ type: "event", event: "snapshot", payload: { ... }, seq: 42 }
```

**握手流程**：

```
Client                          Gateway
  |-------- WebSocket Open ------->|
  |<-- connect.challenge (nonce) --|
  |-- connect (protocol:3,        |
  |    role:operator,              |
  |    scopes:[read,write],       |
  |    auth:{token:"xxx"}) ------>|
  |<----- hello-ok (policy) ------|
```

### 4.2 双模式连接

| 模式 | 连接方式 | 状态字段 | 数据获取 |
|------|----------|----------|---------|
| `browser_direct` | 浏览器直连 Gateway WS | `connected` | WebSocket 客户端 |
| `server_proxy` | 服务端代理连接 | `serverProxyConnected` | API 代理 + SSE |

**正确的连接判断**：

```tsx
const { connected, connectionMode, serverProxyConnected } = useGatewayStore();

const isConnected = connectionMode === 'server_proxy'
  ? serverProxyConnected
  : connected;

if (!isConnected) return <GatewayRequired />;
```

> ⚠️ 只检查 `connected` 在 `server_proxy` 模式下永远是 `false`

### 4.3 已实现的 API 方法

| 方法 | OpenClaw API | 说明 |
|------|-------------|------|
| `listCronJobs()` | `cron.list` | 获取定时任务列表 |
| `createCronJob(job)` | `cron.add` | 创建定时任务 |
| `deleteCronJob(jobId)` | `cron.remove` | 删除定时任务 |
| `runCronJob(jobId)` | `cron.run` | 手动触发执行 |
| `toggleCronJob(jobId, enabled)` | `cron.toggle` | 启用/禁用任务 |
| `getCronRuns(jobId)` | `cron.runs` | 获取执行历史 |
| `listAgents()` | `agent.list` | 获取 Agent 列表 |
| `listSessions()` | `session.list` | 获取会话列表 |
| `patchSession(key, patch)` | `session.patch` | 修改会话参数 |
| `deleteSession(key)` | `session.delete` | 删除会话 |
| `listSkills()` | `skill.list` | 获取技能列表 |
| `toggleSkill(skillKey, enabled)` | `skill.toggle` | 启用/禁用技能 |
| `saveSkillKey(skillKey, value)` | `skill.save-key` | 保存 API Key |
| `installSkill(skillKey, name, id)` | `skill.install` | 安装技能依赖 |
| `getSnapshot()` | `snapshot.get` | 获取系统快照 |

---

## 5. 核心模块说明

### 5.1 对话信道 `lib/chat-channel/`

统一 AI 对话中的数据交互。

**入口分离**：
- `lib/chat-channel/index.ts` — 服务端入口（完整功能）
- `lib/chat-channel/client.ts` — 客户端入口（仅解析器）

**支持的 Actions**：
- 写入类：`update_task_status`, `add_comment`, `create_document`, `deliver_document` 等
- 状态类：`update_status`, `set_queue`
- SOP 类：`advance_sop_stage`, `request_sop_confirm`, `get_sop_context`, `save_stage_output`, `update_knowledge`, `create_sop_template`, `update_sop_template`, `create_render_template`, `update_render_template`
- 扩展类：`sync_identity`, `get_mcp_token`

**不支持**（需用 MCP API）：
- 查询类：`get_task`, `list_my_tasks`, `search_documents`
- 定时类：`create_schedule`, `update_schedule`, `delete_schedule`
- 配置类：`set_do_not_disturb`, `register_member`

### 5.2 OpenClaw 同步 `lib/openclaw/`

Markdown 文件与 CoMind 数据双向同步。

**同步规则**：
- `comind:tasks` — 批量创建/更新任务
- `comind:deliveries` — 批量提交交付物
- `comind:schedules` — 管理定时调度
- `comind:milestones` — 管理里程碑

### 5.3 MCP 工具 `core/mcp/`

定义和执行 AI 可用的工具（37 个）。

**调用方式**：
- 内部：`POST /api/mcp`
- 外部：`POST /api/mcp/external` + Bearer Token

**新增 MCP 工具步骤**：
1. 在 `definitions.ts` 注册 JSON Schema 定义
2. 在 `app/api/mcp/handlers/` 添加处理器
3. 在 `executor.ts` 添加 switch-case 分发

### 5.4 数据同步 `lib/sync/`

| 文件 | 功能 |
|------|------|
| `task-sync.ts` | 任务数据同步 |
| `delivery-sync.ts` | 交付物同步 |
| `schedule-sync.ts` | 定时任务同步 |
| `milestone-sync.ts` | 里程碑数据同步 |
| `shared.ts` | 共用同步工具 |

---

## 6. 页面数据依赖

| 页面 | 依赖 Store | Gateway 数据 |
|------|-----------|-------------|
| **Dashboard** | project, task, member, document, delivery, gateway | snapshot, health, sessions, cronJobs |
| **Agents** | gateway | agentsList, agentHealth, cronJobs, skills, sessions |
| **Schedule** | gateway, document | cronJobs, cronRuns, agentsList |
| **Sessions** | gateway | sessions |
| **Skills** | gateway | skills |
| **Tasks** | task, member, gateway | agentsList, agentsMainKey |
| **Projects** | project, gateway | cronJobs, agentsList |
| **Members** | member, gateway | agentsList, agentHealthList |
| **Wiki** | document | — |
| **Deliveries** | delivery | — |
| **SOP** | sop-template, render-template, task | — |

**初始化流程**：`DataProvider` → `useDataInitializer()`（`Promise.allSettled` 并行加载所有 Store）→ SSE 连接 → 实时刷新。

---

## 7. 数据库层

**文件**：`db/schema.ts`（21 张表）+ `db/index.ts`（连接管理）

| 表名 | 用途 |
|------|------|
| `projects` | 项目 |
| `members` | 成员（人类+AI） |
| `tasks` | 任务 |
| `task_logs` | 任务操作日志 |
| `comments` | 任务评论 |
| `documents` | Wiki 文档 |
| `milestones` | 里程碑 |
| `openclaw_status` | AI Agent 状态 |
| `scheduled_tasks` | 定时任务（本地） |
| `scheduled_task_history` | 定时任务执行历史 |
| `deliveries` | 文档交付 |
| `chat_sessions` | 聊天会话 |
| `chat_messages` | 聊天消息 |
| `openclaw_workspaces` | OpenClaw 工作区 |
| `openclaw_files` | OpenClaw 文件 |
| `openclaw_versions` | OpenClaw 版本 |
| `openclaw_conflicts` | OpenClaw 冲突 |
| `gateway_configs` | Gateway 配置 |
| `audit_logs` | 审计日志 |
| `sop_templates` | SOP 模板 |
| `render_templates` | 渲染模板 |

**连接配置**：WAL 模式、外键启用、64MB 缓存、5s 忙超时。

**自动迁移**：`db/index.ts` 检测缺失的表/列并增量添加，无需手动编辑 `data/comind.db`。

---

## 8. 开发注意事项

### 必须遵守

| 规则 | 原因 |
|------|------|
| 所有 UI 文本必须用 `t()` | 国际化（`lib/i18n.ts`，en + zh） |
| 敏感字段返回前必须脱敏 | 安全（`lib/sanitize.ts`） |
| 编辑输入必须防抖 500ms | 性能（`useRef<setTimeout>`） |
| PUT/DELETE 必须检查资源存在性 | API 规范（404 if missing） |
| Store 更新必须用 API 返回数据 | 数据一致性 |
| Store fetchXxx 必须 Array.isArray 防御 | API 可能返回分页对象而非裸数组 |
| JSON 字段消费必须 Array.isArray 守卫 | SQLite 读出的 JSON 可能是字符串 |
| PUT 用 `allowedFields` 白名单 | 防止非法字段注入 |
| 级联删除用 `db.transaction()` | 数据完整性 |
| 成功后 `set({ error: null })` | Store 错误状态清理 |

### 常见陷阱

| 陷阱 | 解决方案 |
|------|----------|
| 客户端组件导入 `db` 或 `fs` | 使用 `client.ts` 入口分离 |
| 直接修改 Store 状态 | 使用 `xxxAsync` 方法 |
| `useEffect` 依赖整个对象 | 依赖具体字段 `[task?.id]` |
| 内联 `<style jsx>` | 使用 Tailwind CSS |
| 只检查 `connected` 判断 Gateway | 根据 `connectionMode` 双模式判断 |
| Enter + Blur 双重提交 | `submittedByEnterRef` 防重复 |
| Store 用 `data \|\| []` 处理 API 返回 | 必须用 `Array.isArray(data) ? data : (data?.data \|\| [])` |
| JSON 字段用 truthy 检查 | 必须用 `Array.isArray(field)` 守卫 |
| Gateway RPC 方法名硬编码 | 应与 `gateway-client.ts` 保持一致 |

### 测试要点

```bash
# 查找模块被谁引用（上游兼容性）
grep -r "from '@/lib/chat-channel'" --include="*.ts" --include="*.tsx"

# 查找模块依赖什么（下游依赖）
grep -r "^import" lib/chat-channel/*.ts

# 客户端不能导入服务端模块
grep -r "from '@/lib/chat-channel'" components/
# 应该使用: from '@/lib/chat-channel/client'
```

---

## 9. 相关文档

| 文档 | 用途 | 路径 |
|------|------|------|
| 编码规范 | 开发约束 | `CODING_STANDARDS.md` |
| API 文档 | REST API 详情 | `docs/technical/API.md` |
| 组件文档 | UI 组件说明 | `docs/technical/COMPONENTS.md` |
| OpenClaw 同步设计 | 同步功能设计 | `docs/technical/OPENCLAW_SYNC_DESIGN.md` |
| 产品需求 | 功能规划 | `docs/product/PRD.md` |
| 用户手册 | 使用指南 | `docs/product/USER_GUIDE.md` |
| 技术债 | 待修复问题 | `docs/process/TECH_DEBT.md` |
| Agent 约束 | OpenClaw Agent 协作规范 | `docs/openclaw/CLAUDE.md` |
| 完整规范 | OpenClaw 完整技术细节 | `docs/openclaw/WORKSPACE_STANDARD.md` |
| 迁移归档 | v1→v2 迁移历史 | `docs/archive/DEVELOPMENT_V1_MIGRATION.md` |
