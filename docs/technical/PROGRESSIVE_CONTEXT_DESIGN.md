# Agent 渐进式上下文设计方案

**版本**: v1.0 | **日期**: 2026-03-08 | **状态**: 设计确认

---

## 一、核心设计

### 1.1 三层渐进式披露

```
L1 索引层（默认推送）→ L2 详情层（按需获取）→ L3 关联层（深度探索）
     < 500 tokens          500-2000 tokens        按需分页
```

### 1.2 三通路能力

| 通路 | 定位 | L1 | L2/L3 | 适用场景 |
|------|------|----|----|----------|
| **MCP** | 独立全能力 | 工具调用 | 工具调用 | 远程 Agent、Cowork |
| **对话信道** | 指令下发 + 兜底获取 | 推送 | 请求-响应 | 实时交互、远程推送 |
| **Workspace** | 优先获取（混合模式） | 文件生成 | 文件读取 | 本机 Agent |

### 1.3 双运行模式

| 模式 | 触发条件 | L1 | L2/L3 获取 |
|------|----------|----|----|
| **仅对话信道** | Workspace 未配置/失效 | 信道推送 | 信道请求 |
| **混合模式** | Workspace 心跳通过 | 信道推送 | 优先读文件，失败用信道 |

---

## 二、MCP 工具设计（P0）

### 2.1 统一上下文获取协议

> 与对话信道共享同一套请求-响应格式，避免重复实现。

```typescript
// 请求格式（MCP 参数 / 对话信道消息体）
interface ContextRequest {
  type: ContextType;      // 如 'previous_output', 'knowledge_section'
  params: Record<string, string>;
}

// 响应格式（MCP 返回 / 对话信道响应）
interface ContextResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### 2.2 工具定义（新增分层工具）

```typescript
// ===== 任务 =====
list_my_tasks_brief: { status?, limit? } → TaskIndex[]
get_task_detail: { taskId, include? } → TaskDetail

// ===== 知识库 =====
list_knowledge_docs: { type?, search? } → KnowledgeIndex[]
get_doc_section: { docId, sectionId } → KnowledgeSection

// ===== SOP =====
get_current_stage: { taskId } → SOPCurrentStage
get_previous_output: { taskId, stageId? } → SOPPreviousOutput[]
get_knowledge_layer: { taskId, layer: "L1"-"L5" } → string

// ===== 交付 =====
list_my_deliveries_brief: { status? } → DeliveryIndex[]
get_delivery_detail: { deliveryId } → DeliveryDetail
```

### 2.3 现有工具完整梳理

> 共 37 个工具，分为**上下文获取类**（需适配）和**操作执行类**（保持不变）。

#### 上下文获取类工具（12个，需适配分层）

| 工具 | 当前行为 | 适配方案 | 分层逻辑 |
|------|----------|----------|----------|
| `get_task` | 返回完整任务详情 | ✅ 适配 | 无参 → L1 索引；传 `detail=true` → L2 详情 |
| `list_my_tasks` | 返回完整任务列表 | ✅ 适配 | 无参 → L1 索引（仅 id/title/status）；传 `detail=true` → L2 详情 |
| `get_project` | 返回完整项目详情 | ✅ 适配 | 无参 → L1 索引；传 `detail=true` → L2 详情 |
| `get_project_members` | 返回完整成员列表 | ✅ 适配 | 无参 → L1 索引（id/name/type）；传 `detail=true` → L2 详情 |
| `get_document` | 返回完整文档内容 | ✅ 适配 | 无参 → L1 索引；传 `section_id` → L2 章节 |
| `search_documents` | 返回搜索结果 | ✅ 适配 | 默认 → L1 索引；传 `include_content=true` → L2 详情 |
| `list_schedules` | 返回定时任务列表 | ✅ 适配 | 无参 → L1 索引；传 `detail=true` → L2 详情 |
| `list_my_deliveries` | 返回交付列表 | ✅ 适配 | 无参 → L1 索引；传 `detail=true` → L2 详情 |
| `get_delivery` | 返回交付详情 | ✅ 适配 | 无参 → L1 索引；传 `detail=true` → L2 详情 |
| `list_milestones` | 返回里程碑列表 | ✅ 适配 | 无参 → L1 索引；传 `detail=true` → L2 详情 |
| `get_template` | 返回渲染后模板 | ✅ 适配 | 保持原样（已按需渲染） |
| `list_templates` | 返回模板列表 | ✅ 适配 | 无参 → L1 索引；传 `detail=true` → L2 详情 |

#### 操作执行类工具（25个，保持不变）

| 类别 | 工具 | 行为 |
|------|------|------|
| 任务操作 | `update_task_status`, `add_task_comment`, `create_check_item`, `complete_check_item` | ✅ 保持 |
| 文档操作 | `create_document`, `update_document` | ✅ 保持 |
| 状态操作 | `update_status`, `set_queue`, `set_do_not_disturb` | ✅ 保持 |
| 定时任务 | `create_schedule`, `delete_schedule`, `update_schedule` | ✅ 保持 |
| 交付操作 | `deliver_document`, `review_delivery` | ✅ 保持 |
| 成员管理 | `register_member` | ✅ 保持 |
| 里程碑 | `create_milestone`, `update_milestone`, `delete_milestone` | ✅ 保持 |
| SOP 执行 | `advance_sop_stage`, `request_sop_confirm`, `get_sop_context`, `save_stage_output` | ✅ 保持 |
| 知识库 | `update_knowledge` | ✅ 保持 |
| 模板创建 | `create_sop_template`, `update_sop_template`, `create_render_template`, `update_render_template` | ✅ 保持 |

#### 适配优先级

| 优先级 | 工具 | 原因 |
|--------|------|------|
| **P0** | `get_task`, `list_my_tasks`, `get_document` | 高频使用，上下文消耗大 |
| **P1** | `get_sop_context` | SOP 场景核心，当前已部分支持分层 |
| **P2** | 其他上下文获取工具 | 使用频率较低 |

#### 推荐适配方案：选项 C（透明兼容）

```typescript
// 示例：get_task 适配后
get_task: {
  parameters: {
    task_id: { type: 'string' },
    detail: { type: 'boolean', description: '是否返回完整详情（默认 false，仅返回索引）' },
    include: { type: 'array', items: { enum: ['comments', 'checklist', 'history'] } }
  }
}

// 返回格式
// L1（无参或 detail=false）: { id, title, status, assignees, projectId }
// L2（detail=true）: { ...完整详情, comments?, checklist?, history? }
```

**优势**：
1. API 兼容：旧调用方式仍可工作（但返回更精简）
2. 按需获取：Agent 可通过参数控制返回粒度
3. 无迁移成本：不删除工具，不新增工具名

---

## 三、对话信道设计（P0）

### 3.1 协议格式（与 MCP 统一）

**L1 推送（Markdown 格式）**：
```markdown
## 📋 SOP 推送

**任务**: {{title}} ({{taskId}})
**当前阶段**: {{currentStage.index}}/{{currentStage.total}}
**指令**: {{currentStage.instruction}}

### 可用上下文
{{#if workspaceActive}}
- 前序产出: `.context/sop/previous-outputs/`
- 知识库: `.context/sop/knowledge/`
{{else}}
- 回复 `请求上下文: - 类型: previous_output - 参数: {}` 获取
{{/if}}
```

**L2/L3 请求（规范化 Markdown）**：
```markdown
请求上下文:
- 类型: previous_output
- 参数: { stageId: "stage-1" }
```

**响应（JSON）**：
```json
{
  "type": "context_response",
  "responses": [{ "type": "previous_output", "success": true, "data": {...} }]
}
```

### 3.2 请求解析

```typescript
// 正则匹配规范化格式
const pattern = /请求上下文:\s*\n(\s*-\s*类型:\s*(\w+)\s*\n\s*-\s*参数:\s*(\{[^}]*\}))+/g;
```

---

## 四、Workspace 设计（P1）

### 4.1 目录结构

```
.context/
├── index.md                 # 总索引
├── heartbeat.json           # 心跳文件（自检）
├── sop/
│   ├── current-stage.md     # 当前阶段（L1）
│   ├── previous-outputs/    # 前序产出（L2）
│   └── knowledge/           # 知识层级（L2）
├── tasks/
│   ├── index.md             # 任务索引
│   └── {id}/
│       ├── brief.md         # 摘要（L1）
│       └── detail.md        # 详情（L2）
└── knowledge/
    └── {docId}/
        ├── index.md         # 章节索引
        └── sections/{id}.md # 章节内容
```

### 4.2 心跳自检流程

```
TeamClaw 写入 heartbeat.json → Agent 读取确认 → 回复确认 → 切换到混合模式
                    ↓ 超时
              保持仅对话信道模式
```

心跳文件：
```json
{ "timestamp": "...", "sessionId": "...", "status": "active" }
```

### 4.3 文件生成策略

| 层级 | 策略 | 说明 |
|------|------|------|
| L1 | 始终生成 | 任务/SOP 推送时立即写入 |
| L2 | Agent 触发生成 | 首次读取不存在时，通过对话请求并缓存 |

---

## 五、实现优先级

| 优先级 | 内容 | 原因 |
|--------|------|------|
| **P0** | MCP 工具扩展 | 远程 Agent 必需，与对话信道共享协议 |
| **P0** | 对话信道 L1 推送 + 请求-响应 | 指令下发入口，统一协议 |
| **P1** | Workspace 索引 + 心跳 | 混合模式基础 |
| **P2** | Workspace 详情文件 | 优化本地读取体验 |

---

## 六、待讨论事项

### 6.1 MCP 工具兼容性 ✅ 已决策

**推荐方案**：选项 C（透明兼容）

- **不新增工具**：避免工具数量膨胀
- **不删除工具**：保持 API 兼容性
- **适配参数**：旧工具增加 `detail` / `include` 等参数
- **默认 L1**：无参调用返回索引，减少默认上下文消耗

**适配范围**：12 个上下文获取类工具（见 2.3 章节）

**风险**：旧调用方可能依赖完整返回，需评估兼容性影响。

### 6.2 Workspace 文件生成时机

**选项 A**：推送时预生成 L1 + L2（首次推送慢，后续快）
**选项 B**：推送时生成 L1，L2 按需生成（平衡）
**选项 C**：全部按需生成（首次推送快，首次读取需等待）

**建议**：选项 B
- L1 在推送时立即生成（< 500 tokens，速度快）
- L2 在 Agent 首次读取时生成并缓存
- 避免 L2 大量文件预生成阻塞推送

---

## 七、现有功能依赖分析

### 7.1 数据流依赖图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              触发入口                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  用户操作 → 前端组件 → Store → API Route → DB 写入 → eventBus.emit → SSE    │
│  定时任务 → Cron 触发 → API → 同上                                          │
│  Agent 调用 → MCP / Chat → API → 同上                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           推送/上下文生成                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  task-push → 模板引擎 → Chat 会话                                           │
│  chat-context → 模板引擎 → AI 系统注入                                      │
│  SOP 推送 → 知识库解析 → 阶段上下文                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 核心模块依赖

| 模块 | 文件 | 依赖表 | 上游 | 下游 |
|------|------|--------|------|------|
| **任务推送** | `app/api/task-push/route.ts` | tasks, projects, members, documents, sopTemplates, openclawFiles | 前端推送按钮、定时任务 | Chat 会话 (sessionKey) |
| **SOP 执行** | `app/api/tasks/[id]/sop-advance/route.ts` | tasks, sopTemplates, documents | 任务推送、Agent 推进 | 阶段产出、知识库查询 |
| **聊天上下文** | `app/api/chat-context/route.ts` | projects, tasks, members, scheduledTasks, documents, comments | Chat 会话初始化 | AI 系统上下文注入 |
| **SSE 广播** | `lib/event-bus.ts` | 无（纯内存） | API 写操作 (eventBus.emit) | DataProvider (前端刷新) |
| **MCP 执行** | `core/mcp/executor.ts` | 所有 Store, `/api/mcp` | Agent 工具调用 | DB 写入、SSE 广播 |
| **模板引擎** | `lib/template-engine.ts` | members, projects, tasks | task-push, chat-context, skills | 系统上下文获取 |

### 7.3 渐进式上下文接入点

| 功能 | 当前实现 | 渐进式改造点 |
|------|----------|--------------|
| **任务推送** | 一次性渲染完整模板 | L1：推送索引 + 可用上下文列表；L2/L3：Agent 按需请求 |
| **SOP 推送** | 注入全部知识库层级 | 按阶段配置的 `knowledgeLayers` 分层推送 |
| **聊天上下文** | 一次性返回完整上下文 | 改为「索引 + 详情请求」模式 |
| **MCP 工具** | 返回完整详情 | 增加 `detail` 参数，默认返回索引 |

### 7.4 SSE 事件类型与触发场景

| 事件类型 | 触发场景 | 前端刷新 |
|----------|----------|----------|
| `task_update` | 任务创建/更新/删除 | TaskStore, ProjectStore |
| `document_update` | 文档创建/更新/删除 | DocumentStore |
| `sop_template_update` | SOP 模板变更 | SOPTemplateStore |
| `sop_confirm_request` | SOP 阶段需人工确认 | TaskStore |
| `delivery_update` | 交付物变更 | DeliveryStore |
| `schedule_update` | 定时任务变更 | ScheduledTaskStore |

### 7.5 Agent 通信三通路现状

| 通路 | 当前能力 | 渐进式改造需求 |
|------|----------|----------------|
| **MCP** | 37 个工具，完整 CRUD | 上下文获取类工具适配分层 |
| **对话信道** | 任务推送模板、Chat 回复 | 增加 L2/L3 请求-响应协议 |
| **Workspace** | 无（新增能力） | 需实现目录结构、心跳自检、文件生成 |

### 7.6 数据库表关系

```
projects ← tasks → sopTemplates → documents (知识库)
    ↓          ↓                     ↓
members ← assignees              knowledgeLayers
              ↓
         stageHistory (JSON)
              ↓
         stageOutputs
```

### 7.7 改造影响评估

| 改造点 | 影响范围 | 兼容性风险 | 建议 |
|--------|----------|------------|------|
| MCP 工具适配 | 所有 Agent 调用 | 中：旧调用返回精简数据 | 增加 `detail` 参数，默认 L1 |
| 任务推送模板 | 任务推送流程 | 低：模板格式变更 | 新增 L1 模板，保留旧模板 |
| Chat 上下文 | Chat 会话初始化 | 低：独立 API | 新增 `/api/chat-context/detail` |
| Workspace | 新增能力 | 无：可选功能 | 先实现 MCP + Chat，P1 再加 Workspace |

---

## 八、核心收益

| 指标 | 当前 | 优化后 | 节省 |
|------|------|--------|------|
| SOP 推送 | ~3000 tokens | ~800 tokens | 73% |
| 知识库查询 | ~5000 tokens | ~300 tokens | 94% |
| 任务推送 | ~1500 tokens | ~400 tokens | 73% |
