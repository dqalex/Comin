# CoMind V2 使用指引

> 本文档提供 CoMind 平台的完整使用指南，涵盖功能介绍、REST API、MCP 指令系统、Skill 集成及约束文件使用方法。

---

## 目录

1. [功能介绍](#1-功能介绍)
2. [REST API 使用](#2-rest-api-使用)
3. [MCP 指令系统](#3-mcp-指令系统)
4. [Skill 使用](#4-skill-使用)
5. [约束文件规范](#5-约束文件规范)
6. [最佳实践](#6-最佳实践)

---

## 1. 功能介绍

### 1.1 工作台 (Dashboard)

**路由**: `/dashboard`

工作台是系统的入口页面，提供：
- **连接状态**: OpenClaw Gateway 连接状态实时显示
- **系统快照**: CPU、内存、运行时间等系统信息
- **模块导航**: 各功能模块的快速入口
- **数据统计**: 任务数、项目数、成员数等概览

### 1.2 任务管理

**路由**: `/tasks`

#### 核心功能

| 功能 | 说明 |
|------|------|
| 泳道看板 | 按项目/成员分组显示，支持拖拽排序 |
| 四列状态 | 待办 → 进行中 → 审核中 → 已完成 |
| 里程碑管理 | 按里程碑子分组、跨里程碑拖拽移动、里程碑 CRUD |
| 批量操作 | 多选后批量变更状态、批量删除（含确认对话框） |
| 子任务进度 | 任务卡片显示 checkItems 进度条和完成计数 |
| 检查项 | 子任务管理，支持完成进度追踪 |
| 评论系统 | 任务讨论、汇报进展 |
| 操作日志 | 完整变更历史记录（含前端操作自动记录） |
| 与 AI 讨论 | 任务页面可直接发起与 AI 的对话 |

#### Markdown 任务语法

在文档中使用以下语法创建任务：

```markdown
- [ ] 普通任务          # status: todo, priority: medium
- [!] 高优先级任务       # status: todo, priority: high
- [-] 低优先级任务       # status: todo, priority: low
- [~] 进行中任务         # status: in_progress
- [?] 待审核任务         # status: reviewing
- [x] 已完成任务         # status: completed
```

#### 任务引用语法

```markdown
@张三                    # 分配给成员张三
[[需求文档]]             # 关联文档
#task_abc123            # 引用任务 ID
```

### 1.3 文档 Wiki

**路由**: `/wiki`

#### 核心功能

| 功能 | 说明 |
|------|------|
| Markdown 编辑 | 完整的 Markdown 编辑支持 |
| 双向链接 | `[[文档标题]]` 自动建立关联 |
| 反向链接 | 自动计算并显示哪些文档引用了当前文档 |
| 知识图谱 | 可视化文档关联网络 |
| 批注系统 | 非编辑模式下选中文本添加批注，面板跳转定位+闪烁动画 |
| 与 AI 讨论 | 标题栏 MessageSquare 按钮，构造文档引用消息发送给 AI |
| 文档类型 | guide/reference/report/note/decision/task_list/scheduled_task/other |

#### 文档类型说明

| 类型 | 用途 |
|------|------|
| `guide` | 使用手册/指南 |
| `reference` | 参考文档 |
| `report` | 研究/分析报告 |
| `note` | 日常笔记（默认） |
| `decision` | 决策记录 |
| `task_list` | 包含任务的文档 |
| `scheduled_task` | 定时任务关联文档 |
| `other` | 未分类 |

### 1.4 项目管理

**路由**: `/projects`

- 项目创建、编辑、删除
- 项目成员分配
- 项目维度任务/文档过滤
- 当前项目切换（持久化到 localStorage）

### 1.5 Agent 管理

**路由**: `/agents`

集成 OpenClaw Gateway 的 Agent 能力：
- Agent 列表查看
- Agent 状态监控
- Agent 配置管理
- Agent 文件编辑

### 1.6 会话管理

**路由**: `/sessions`

- 活跃会话列表
- 会话参数配置：
  - Thinking Level: off/minimal/low/medium/high/xhigh
  - Verbose Level: inherit/off/on/full
  - Reasoning Level: off/on/stream
- Token 用量统计
- 会话删除

### 1.7 技能市场

**路由**: `/skills`

- 技能列表（workspace/built-in 分组）
- 技能启用/禁用
- 依赖安装（brew/node/go/uv）
- API Key 配置

### 1.8 定时任务

**路由**: `/schedule`

#### 调度模式

| 模式 | 说明 | 示例 |
|------|------|------|
| `every` | 间隔执行 | 每 5 分钟执行一次 |
| `at` | 一次性定时 | 指定时间执行一次 |
| `cron` | Cron 表达式 | 标准 Cron + 时区 |

#### 任务类型

| 类型 | 说明 |
|------|------|
| `report` | 报告生成 |
| `summary` | 摘要汇总 |
| `backup` | 数据备份 |
| `notification` | 通知提醒 |
| `custom` | 自定义任务 |

### 1.9 文档交付

**路由**: `/deliveries`

#### 审核流程

```
待审核 (pending) → 已通过 (approved) / 已拒绝 (rejected) / 需修改 (revision_needed)
```

**附加功能**：
- 交付物删除（审核弹窗内删除按钮+确认对话框）
- 与 AI 讨论交付物（MessageSquare 按钮，构造交付物引用消息）
- 审核通知自动发送给 AI（browser_direct 模式兼容）

#### 支持平台

| 平台 | 说明 |
|------|------|
| `local` | CoMind 内部文档 |
| `tencent-doc` | 腾讯文档 |
| `feishu` | 飞书 |
| `notion` | Notion |
| `other` | 其他平台 |

### 1.10 SOP 工作流

**路由**: `/sop`

#### 核心概念

SOP（标准化操作流程）引擎让 AI Agent 按预定义的多阶段工作流自动执行复杂任务。

#### 阶段类型

| 类型 | 说明 |
|------|------|
| `input` | 人工输入阶段，收集用户表单数据 |
| `ai_auto` | AI 自动执行，完成后自动推进 |
| `ai_with_confirm` | AI 执行后需人工确认再推进 |
| `manual` | 纯人工操作阶段 |
| `render` | 可视化渲染阶段（自动创建 Content Studio 文档） |
| `export` | 导出阶段 |
| `review` | 最终审核阶段 |

#### 使用流程

1. 在 `/sop` 页面创建或选择 SOP 模板
2. 在任务看板创建任务时关联 SOP 模板
3. 推送任务给 AI，AI 通过 MCP 工具按阶段执行
4. 人工在 TaskDrawer 中确认/驳回/跳过阶段
5. 所有阶段完成后任务自动进入 reviewing 状态

#### Know-how 知识库

SOP 模板可关联 Know-how 文档，按 L1-L5 五层结构组织：
- **L1 概述**：背景和目标
- **L2 核心知识**：关键方法论
- **L3 工具方法**：具体工具使用
- **L4 经验教训**：历史经验（AI 可自动追加）
- **L5 统计数据**：执行统计

#### 内置模板

| 模板 | 阶段数 | 用途 |
|------|--------|------|
| 竞品调研 SOP | 5 | 竞品信息收集→分析→报告 |
| 内容营销 SOP | 6 | 选题→创作→审核→发布 |
| 周报月报 SOP | 4 | 数据收集→汇总→渲染→审核 |
| Bug 分析 SOP | 5 | 复现→根因→修复→验证→知识沉淀 |
| 数据分析 SOP | 5 | 需求→采集→分析→可视化→审核 |

### 1.11 成员管理

**路由**: `/members`

#### 成员类型

| 类型 | 说明 |
|------|------|
| `human` | 人类成员 |
| `ai` | AI Agent 成员 |

#### AI 成员配置

| 配置项 | 说明 |
|--------|------|
| 部署模式 | cloud/local/knot |
| 执行模式 | chat_only/api_first/api_only |
| 模型配置 | 模型选择、温度设置 |
| 能力声明 | 擅长工具、任务类型 |

### 1.12 聊天

**触发方式**: 浮动面板，可在任务/项目/定时任务页面发起

#### 功能

- 多会话管理
- 实体绑定（任务/项目/定时任务）
- AI 回复（支持 Knot/OpenClaw 双模式）
- MCP 指令解析

### 1.12 OpenClaw 同步

**路由**: `/settings/openclaw`

#### 核心能力

| 功能 | 说明 |
|------|------|
| Workspace 管理 | 配置本地 Markdown 目录 |
| 实时监听 | 文件变更自动同步 |
| 版本历史 | 文件版本记录、回滚 |
| 冲突处理 | 双向编辑冲突检测 |
| 离线缓存 | 网络中断时本地缓存 |

#### 同步模式

| 模式 | 触发条件 | 说明 |
|------|---------|------|
| `init` | 索引不存在 | 首次同步，全量扫描 |
| `auto_sync` | 心跳 active | 目录实时监听 + 定时扫描 |
| `mcp` | 心跳超时/无索引 | MCP API 同步 |
| `offline` | 网络中断 | 本地缓存，只读 |

---

## 2. REST API 使用

### 2.1 通用规范

#### 请求格式

```typescript
// Content-Type: application/json
{
  "field1": "value1",
  "field2": "value2"
}
```

#### 响应格式

```typescript
// 成功响应 — GET 列表端点返回裸数组
[{ "id": "xxx", ... }, ...]

// 成功响应 — GET 分页端点（传 page/limit 参数时）
{ "data": [...], "total": 100, "page": 1, "limit": 20 }

// 成功响应 — 单资源 GET/PUT/POST
{ "id": "xxx", "field": "value", ... }

// 错误响应
{ "error": "错误信息" }
```

#### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 2.2 成员 API

#### 获取成员列表

```http
GET /api/members
```

**响应**:
```json
{
  "data": [
    {
      "id": "user_001",
      "name": "张三",
      "type": "human",
      "email": "zhangsan@example.com",
      "online": true
    },
    {
      "id": "agent_001",
      "name": "OpenClaw Agent",
      "type": "ai",
      "openclawApiToken": "****1234"  // 脱敏显示
    }
  ]
}
```

#### 创建成员

```http
POST /api/members
Content-Type: application/json

{
  "name": "新成员",
  "type": "human",
  "email": "new@example.com"
}
```

#### 更新成员

```http
PUT /api/members/[id]
Content-Type: application/json

{
  "name": "更新后的名称"
}
```

#### 删除成员

```http
DELETE /api/members/[id]
```

### 2.3 任务 API

#### 获取任务列表

```http
GET /api/tasks
GET /api/tasks?projectId=xxx
```

**响应**:
```json
{
  "data": [
    {
      "id": "task_001",
      "title": "实现用户登录功能",
      "status": "in_progress",
      "priority": "high",
      "projectId": "proj_001",
      "assignees": ["user_001", "agent_001"],
      "checkItems": [
        { "id": "ci_001", "text": "设计登录页面", "completed": true },
        { "id": "ci_002", "text": "实现后端接口", "completed": false }
      ],
      "deadline": 1700000000000,
      "createdAt": 1699000000000,
      "updatedAt": 1699500000000
    }
  ]
}
```

#### 创建任务

```http
POST /api/tasks
Content-Type: application/json

{
  "title": "新任务",
  "description": "任务描述",
  "projectId": "proj_001",
  "priority": "medium",
  "assignees": ["user_001"],
  "deadline": "2024-01-01T00:00:00Z"
}
```

#### 更新任务状态

```http
PUT /api/tasks/[id]
Content-Type: application/json

{
  "status": "completed",
  "progress": 100
}
```

**状态枚举**: `todo` | `in_progress` | `reviewing` | `completed`

**优先级枚举**: `high` | `medium` | `low`

### 2.4 项目 API

#### 获取项目列表

```http
GET /api/projects
```

#### 获取项目详情

```http
GET /api/projects/[id]
```

**响应**:
```json
{
  "data": {
    "id": "proj_001",
    "name": "CoMind V2",
    "description": "新一代 AI Agent 管理平台",
    "members": ["user_001", "agent_001"],
    "taskCount": 25,
    "completedCount": 10
  }
}
```

### 2.5 文档 API

#### 获取文档列表

```http
GET /api/documents
GET /api/documents?projectId=xxx&full=true
```

#### 创建文档

```http
POST /api/documents
Content-Type: application/json

{
  "title": "需求文档",
  "content": "# 需求文档\n\n## 概述\n...",
  "type": "report",
  "projectId": "proj_001",
  "projectTags": ["P0", "核心功能"]
}
```

#### 更新文档

```http
PUT /api/documents/[id]
Content-Type: application/json

{
  "content": "更新后的内容",
  "type": "decision"
}
```

### 2.6 交付 API

#### 获取交付列表

```http
GET /api/deliveries
```

#### 提交交付

```http
POST /api/deliveries
Content-Type: application/json

{
  "title": "竞品分析报告",
  "documentId": "doc_001",
  "platform": "local",
  "taskId": "task_001"
}
```

#### 审核交付

```http
PUT /api/deliveries/[id]
Content-Type: application/json

{
  "status": "approved",
  "reviewComment": "内容详实，通过审核"
}
```

**状态枚举**: `pending` | `approved` | `rejected` | `revision_needed`

### 2.7 聊天 API

#### 获取会话列表

```http
GET /api/chat-sessions
```

#### 创建会话

```http
POST /api/chat-sessions
Content-Type: application/json

{
  "memberId": "agent_001",
  "title": "需求讨论",
  "entityType": "task",
  "entityId": "task_001"
}
```

#### 获取消息列表

```http
GET /api/chat-messages?sessionId=xxx
```

#### 发送消息

```http
POST /api/chat-messages
Content-Type: application/json

{
  "sessionId": "session_001",
  "role": "user",
  "content": "请帮我分析一下竞品情况"
}
```

#### AI 回复

```http
POST /api/chat-reply
Content-Type: application/json

{
  "sessionId": "session_001",
  "memberId": "agent_001"
}
```

### 2.8 SSE 实时推送

```http
GET /api/sse
```

连接后接收实时事件：

```typescript
// 事件格式
event: task-updated
data: {"id": "task_001", "status": "completed"}

event: document-created
data: {"id": "doc_001", "title": "新文档"}

event: status-changed
data: {"memberId": "agent_001", "status": "working"}
```

---

## 3. MCP 指令系统

### 3.1 概述

MCP (Model Context Protocol) 指令系统提供标准化的 AI 操作接口，支持 AI 成员通过结构化指令操作平台数据。

**版本信息**：
- CoMind MCP Tools: v2.4.0
- 工具数量: 28 个
- 协议版本: OpenClaw Gateway Protocol v3

### 3.2 调用方式

#### 内部调用

```http
POST /api/mcp
Content-Type: application/json

{
  "tool": "update_task_status",
  "parameters": {
    "task_id": "task_001",
    "status": "in_progress"
  }
}
```

#### 外部调用（需认证）

```http
POST /api/mcp/external
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json

{
  "tool": "update_task_status",
  "parameters": {
    "task_id": "task_001",
    "status": "in_progress"
  }
}
```

#### MCP External API 配置

外部调用需要 Bearer Token 认证，使用 AI 成员的 `openclawApiToken`。

**获取 API Token 方式**：

1. **通过 CoMind 界面**（推荐）：
   - 进入「成员管理」页面
   - 点击 AI 成员卡片，打开编辑对话框
   - 点击「生成 Token」按钮
   - 复制生成的 Token（仅显示一次）
   - 点击「保存」保存 Token

2. **通过 API 查询**：
   ```bash
   # 查询 AI 成员
   curl http://localhost:3000/api/members | jq '.[] | select(.type=="ai")'
   
   # 为成员生成 Token
   curl -X PUT http://localhost:3000/api/members/{member_id} \
     -H "Content-Type: application/json" \
     -d '{"openclawApiToken": "your-new-token"}'
   ```

3. **WebSocket 主动请求**（OpenClaw Gateway 集成）：
   ```javascript
   // Gateway 发送事件请求配置
   { type: 'event', event: 'comind.config.request', id: 'req-xxx' }
   
   // CoMind 响应
   { type: 'res', id: 'req-xxx', ok: true, 
     payload: { baseUrl: 'http://localhost:3000', apiToken: 'xxx' } }
   ```

**自动获取 MCP 配置**：

当 CoMind 已连接 OpenClaw Gateway 时，成员管理页面会显示连接状态提示。OpenClaw Agent 可以通过 `comind.config.request` WebSocket 事件自动获取 MCP 配置（包含 `baseUrl` 和 `apiToken`），无需手动配置环境变量。

**环境变量配置**（OpenClaw 侧）：

```bash
# 同服务器部署
COMIND_BASE_URL=http://localhost:3000
COMIND_API_TOKEN=your_api_token_here

# 跨服务器部署（需要 SSH 隧道）
# ssh -L 3000:localhost:3000 root@server
COMIND_BASE_URL=http://localhost:3000
COMIND_API_TOKEN=your_api_token_here
```

#### 批量调用

```json
{
  "batch": [
    { "tool": "update_task_status", "parameters": { "task_id": "task_001", "status": "in_progress" } },
    { "tool": "update_status", "parameters": { "status": "working", "task_id": "task_001" } }
  ]
}
```

### 3.3 工具列表

#### 任务相关

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `get_task` | `task_id` | 获取任务详情 |
| `update_task_status` | `task_id`, `status` | 更新任务状态 |
| `add_task_comment` | `task_id`, `content` | 添加评论 |
| `create_check_item` | `task_id`, `text` | 创建检查项 |
| `complete_check_item` | `task_id`, `item_id` | 完成检查项 |

#### 项目相关

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `get_project` | `project_id` | 获取项目详情 |
| `get_project_members` | `project_id` | 获取项目成员 |

#### 文档相关

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `get_document` | `document_id` 或 `title` | 获取文档 |
| `create_document` | `title`, `content` | 创建文档 |
| `update_document` | `document_id`, `content` | 更新文档 |
| `search_documents` | `query` | 搜索文档 |

#### 状态面板

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `update_status` | `status` | 更新 AI 状态 |
| `set_queue` | `queued_tasks` | 设置任务队列 |
| `set_do_not_disturb` | `interruptible` | 免打扰模式 |

#### 定时任务

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `create_schedule` | `title`, `task_type`, `schedule_type` | 创建定时任务 |
| `list_schedules` | - | 获取定时任务列表 |
| `update_schedule` | `schedule_id` | 更新定时任务 |
| `delete_schedule` | `schedule_id` | 删除定时任务 |

#### 交付相关

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `deliver_document` | `title`, `platform` | 提交文档交付 |
| `review_delivery` | `delivery_id`, `status` | 审核交付 |
| `list_my_deliveries` | - | 获取当前成员的交付物列表 |
| `get_delivery` | `delivery_id` | 获取交付物详情（含审核意见） |

#### 其他

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `register_member` | `name`, `endpoint` | AI 自注册 |
| `get_template` | `template_name` | 获取渲染后的模板 |
| `list_templates` | - | 列出所有模板 |

#### 里程碑

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `create_milestone` | `title`, `project_id` | 创建里程碑 |
| `list_milestones` | - | 获取里程碑列表 |
| `update_milestone` | `milestone_id` | 更新里程碑 |
| `delete_milestone` | `milestone_id` | 删除里程碑 |

#### SOP 引擎

| 工具 | 必填参数 | 说明 |
|------|---------|------|
| `advance_sop_stage` | `task_id` | 推进 SOP 到下一阶段 |
| `request_sop_confirm` | `task_id`, `confirm_message`, `stage_output` | 请求人工确认 |
| `get_sop_context` | `task_id` | 获取 SOP 执行上下文（含分层知识库） |
| `save_stage_output` | `task_id`, `output` | 保存阶段产出（不推进） |
| `update_knowledge` | `document_id`, `content` | 向知识库追加经验（智能 L4 追加） |
| `create_sop_template` | `name`, `stages` | AI 创建 SOP 模板（draft 状态） |
| `update_sop_template` | `template_id` | 更新 SOP 模板 |
| `create_render_template` | `name`, `html_template` | 创建渲染模板 |
| `update_render_template` | `template_id` | 更新渲染模板 |

### 3.4 详细参数说明

#### update_task_status

```typescript
{
  task_id: string;           // 任务 ID
  status: 'todo' | 'in_progress' | 'reviewing' | 'completed';
  progress?: number;         // 进度 0-100
  message?: string;          // 状态变更说明
}
```

#### create_document

```typescript
{
  title: string;             // 文档标题
  content: string;           // 文档内容（Markdown）
  doc_type?: 'report' | 'note' | 'decision' | 'scheduled_task' | 'task_list' | 'other';
  project_id?: string;       // 关联项目 ID
}
```

#### update_status

```typescript
{
  status: 'idle' | 'working' | 'waiting' | 'offline';
  current_action?: string;   // 当前操作描述
  task_id?: string;          // 当前任务 ID
  progress?: number;         // 进度 0-100
  member_id?: string;        // AI 成员 ID（可选）
}
```

#### set_queue

```typescript
{
  queued_tasks: Array<{
    id: string;              // 任务 ID
    title: string;           // 任务标题
  }>;
  member_id?: string;        // AI 成员 ID（可选）
}
```

#### deliver_document

```typescript
{
  title: string;             // 文档标题
  platform: 'tencent-doc' | 'feishu' | 'notion' | 'local' | 'other';
  description?: string;      // 文档描述
  document_id?: string;      // CoMind 内部文档 ID（platform=local 时必填）
  external_url?: string;     // 外部文档链接（外部平台时必填）
  task_id?: string;          // 关联任务 ID
}
```

#### create_schedule

```typescript
{
  title: string;             // 定时任务标题
  task_type: 'report' | 'summary' | 'backup' | 'notification' | 'custom';
  schedule_type: 'once' | 'daily' | 'weekly' | 'monthly';
  schedule_time?: string;    // 执行时间 "HH:MM"
  schedule_days?: number[];  // 执行日期（周几/每月几号）
  description?: string;      // 任务描述
  config?: object;           // 任务配置参数
}
```

### 3.5 对话中嵌入 Actions

在对话回复末尾可嵌入 JSON actions：

```json
{"actions": [
  {"type": "update_task", "task_id": "xxx", "status": "in_progress"},
  {"type": "add_comment", "task_id": "xxx", "content": "分析完成"},
  {"type": "update_status", "status": "working"},
  {"type": "deliver_document", "title": "报告", "platform": "local", "document_id": "xxx"},
  {"type": "ask_user", "question": "需要覆盖哪些竞品?", "options": ["A","B","C"]},
  {"type": "request_info", "info_type": "document", "query": "竞品分析"}
]}
```

### 3.6 完整示例

#### 场景：执行任务并汇报

```json
// 1. 接受任务
POST /api/mcp/external
{
  "tool": "update_task_status",
  "parameters": {
    "task_id": "task_001",
    "status": "in_progress",
    "message": "开始执行任务"
  }
}

// 2. 更新 AI 状态
POST /api/mcp/external
{
  "tool": "update_status",
  "parameters": {
    "status": "working",
    "task_id": "task_001",
    "current_action": "正在分析需求"
  }
}

// 3. 添加进展评论
POST /api/mcp/external
{
  "tool": "add_task_comment",
  "parameters": {
    "task_id": "task_001",
    "content": "## 进展汇报\n\n已完成初步分析，发现以下要点：\n1. ...\n2. ..."
  }
}

// 4. 提交交付物
POST /api/mcp/external
{
  "tool": "deliver_document",
  "parameters": {
    "title": "分析报告",
    "platform": "local",
    "document_id": "doc_001",
    "task_id": "task_001"
  }
}

// 5. 完成任务
POST /api/mcp/external
{
  "tool": "update_task_status",
  "parameters": {
    "task_id": "task_001",
    "status": "completed",
    "progress": 100
  }
}

// 6. 更新状态为空闲
POST /api/mcp/external
{
  "tool": "update_status",
  "parameters": {
    "status": "idle"
  }
}
```

---

## 4. Skill 使用

### 4.1 概述

CoMind 提供内置 Skill 文档，供 AI 成员参考执行标准化操作。Skill 文档位于 `skills/comind/` 目录。

### 4.2 Skill 结构

```
skills/comind/
├── SKILL.md                 # 主文档：AI 成员操作手册
└── references/              # 模板文件
    ├── system-info.md       # 系统信息模板
    ├── task-board.md        # 任务看板模板
    ├── task-push.md         # 任务推送模板
    ├── schedules.md         # 定时任务模板
    ├── deliveries.md        # 交付列表模板
    ├── chat-project.md      # 项目对话模板
    ├── chat-task.md         # 任务对话模板
    ├── chat-schedule.md     # 定时任务对话模板
    └── doc-template-*.md    # 文档模板
```

### 4.3 核心原则

**Markdown 优先**：涉及 ≥2 条记录的写操作，必须使用 Markdown 文档同步。单条字段更新使用 API。

| 操作类型 | 推荐方式 | 说明 |
|---------|---------|------|
| 批量创建任务 | MD 同步 | `create_document(comind:tasks)` |
| 批量提交交付 | MD 同步 | `create_document(comind:deliveries)` |
| 单字段更新 | API | `update_task_status` |
| 评论、查询 | API | `add_task_comment`, `get_task` |

### 4.4 实体映射

| Markdown 元素 | CoMind 表 | 映射规则 |
|--------------|----------|---------|
| 文档 | documents | title 从 Front Matter 或 H1 解析 |
| 任务行 | tasks | 按标题匹配，自动创建/更新 |
| `@成员名` | members | 按名称模糊匹配，转 ID |
| `[[文档名]]` | documents | 按标题匹配，建立关联 |
| `#task_xxx` | tasks | 精确 ID 引用或标题匹配 |
| Front Matter | 各表字段 | 自动解析填充 |

### 4.5 使用模板

#### 任务看板模板

```markdown
---
title: Sprint-1 任务看板
type: comind:tasks
project: comind-v2
created: 2026-02-18
---

# Sprint-1 任务看板

## 高优先级
- [!] 实现用户认证 @张三 [[需求文档]]
- [!] 完成数据库设计 @agent_001

## 进行中
- [~] 前端页面开发 @李四

## 待审核
- [?] API 文档编写

## 已完成
- [x] 项目初始化
```

#### 交付列表模板

```markdown
---
title: Sprint-1 交付清单
type: comind:deliveries
project: comind-v2
---

# Sprint-1 交付清单

## 已完成交付

### 需求文档
- 平台: local
- 文档: [[需求文档-v2]]
- 状态: 已审核通过
- 任务: #task_abc123

### 技术方案
- 平台: feishu
- 链接: https://feishu.cn/xxx
- 状态: 待审核
```

### 4.6 环境变量配置

AI 成员使用 Skill 需要配置以下环境变量：

```bash
COMIND_BASE_URL=http://localhost:3000
COMIND_API_TOKEN=your_mcp_api_token
```

---

## 5. 约束文件规范

### 5.1 概述

约束文件定义了 OpenClaw 与 CoMind 的协作规范，确保双方数据一致性。主要文档：
- `docs/openclaw/CLAUDE.md` - OpenClaw Agent 协作约束
- `docs/openclaw/WORKSPACE_STANDARD.md` - Workspace 标准

### 5.2 Front Matter 必填字段

```yaml
---
title: 文档标题          # 必填
type: report            # 必填: report/note/decision/task_output
project: comind-v2      # 必填: 项目名（必须与 CoMind 项目名一致）
created: 2026-02-18T10:00:00Z  # 必填
updated: 2026-02-18T10:00:00Z  # 必填
version: 1.0.0          # 必填
---
```

### 5.3 可选字段

```yaml
tags: [标签]                    # 标签列表
related_tasks: [task_abc123]    # 关联任务 ID
contains_tasks: true            # 触发任务解析
task_assignees: [成员]          # 任务默认分配
is_delivery: true               # 标记为交付物
```

### 5.4 任务识别规则

| 语法 | 状态 | 优先级 |
|------|------|--------|
| `- [ ]` | todo | medium |
| `- [!]` | todo | high |
| `- [-]` | todo | low |
| `- [~]` | in_progress | - |
| `- [?]` | reviewing | - |
| `- [x]` | completed | - |

### 5.5 文档链接规范

| 类型 | 格式 | 说明 |
|------|------|------|
| 双向链接 | `[[文档标题]]` | 文档内容中引用 |
| 精确 ID | `doc:<UUID>` | 交付物 link 字段 |
| 任务引用 | `#task_xxx` | 引用任务 |
| 成员提及 | `@成员名` | 分配任务 |

### 5.6 目录结构规范

```
~/.openclaw/workspace/
├── CLAUDE.md              # 约束文件
├── .comind-index          # 索引（CoMind 维护）
├── .comind-pending        # 离线缓存
├── documents/
│   ├── reports/           # 报告类
│   ├── notes/             # 笔记类
│   └── task-outputs/      # 任务产出
└── projects/
    └── {project-name}/    # 项目专属目录
```

### 5.7 索引文件格式

```yaml
# .comind-index
version: 1.0.0
workspace_id: ws_abc123

heartbeat:
  status: active              # active | inactive | offline
  last_heartbeat: 2026-02-18T10:00:00Z
  interval: 120               # 秒

instances:
  inst_001:
    name: MacBook Pro
    is_primary: true          # 主实例可写
    last_heartbeat: 2026-02-18T10:00:00Z

files:
  documents/reports/报告.md:
    id: 2k3j4h5g6d7s
    hash: abc123
    version: 2
```

### 5.8 心跳机制

| 配置项 | 低配 | 正常 |
|-------|------|------|
| 心跳间隔 | 180s | 120s |
| 超时判定 | 缺失 3 次 | 缺失 2 次 |
| 同步防抖 | 2s | 1s |

**多实例竞争规则**：
- `is_primary: true` 的实例可写
- 按启动时间竞争，先启动优先
- 心跳超时后其他实例可接管

### 5.9 离线缓存

网络中断时写入 `.comind-pending`：

```yaml
pending_changes:
  - type: create
    path: documents/新文档.md
    hash: abc123
    timestamp: 2026-02-18T10:00:00Z
  - type: update
    path: documents/报告.md
    hash: def456
    expected_version: 2
```

恢复连接后自动重试。

### 5.10 禁止事项

- ❌ 无 project 关联
- ❌ @ 不存在的成员
- ❌ 省略必填 Front Matter
- ❌ 引用不存在的文档

---

## 6. 最佳实践

### 6.1 AI 成员工作流程

```
收到指令
├─ task-push 模板 → 执行任务流程
├─ chat-* 模板   → 对话协作流程
├─ 定时调度      → 定时任务流程
└─ 自主巡检      → 任务巡检流程

执行中:
├─ 批量写操作(≥2条) → Markdown 同步
├─ 单字段更新       → API 调用
├─ 状态面板         → 实时更新
└─ 完成             → 更新状态 + 汇报
```

### 6.2 任务执行标准流程

1. **接受** — `update_task_status(in_progress)` + `update_status(working)`
2. **获取上下文** — 调 API 获取任务详情、项目信息
3. **分解子任务** — MD 优先批量创建；API 备选单条创建
4. **执行+汇报** — 定期添加评论 + 更新进度
5. **产出交付物** — 创建文档 + 提交交付
6. **完成** — `update_task_status(completed)` + `update_status(idle)`

### 6.3 状态面板维护规则

| 时机 | 操作 |
|------|------|
| 接到任务 | `update_status("working", task_id=xxx)` |
| 执行中 | `update_status("working", progress=N)` |
| 需要提问 | `update_status("waiting")` |
| 收到回复 | `update_status("working")` |
| 完成任务 | `update_status("idle")` |
| 关键操作 | `set_do_not_disturb(false)` |
| 操作结束 | `set_do_not_disturb(true)` |

### 6.4 交付物链接规范

| 平台 | 必填字段 | 链接格式 |
|------|---------|---------|
| local | `document_id` | `doc:<UUID>` |
| 外部平台 | `external_url` | 完整 URL |

**优先级**：CoMind 内部链接必须有 → 外部链接按需附加

### 6.5 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 网络超时 | 写入 `.comind-pending`，恢复后重试 |
| 认证失败 | 检查 `COMIND_API_TOKEN` |
| 资源不存在 | 返回 404，提示用户确认 |
| 冲突检测 | 记录到冲突表，等待解决 |

---

## 附录

### A. 枚举值速查

| 字段 | 可选值 |
|------|--------|
| 任务状态 | `todo`, `in_progress`, `reviewing`, `completed` |
| 优先级 | `high`, `medium`, `low` |
| AI 状态 | `idle`, `working`, `waiting`, `offline` |
| 文档类型 | `guide`, `reference`, `note`, `report`, `decision`, `scheduled_task`, `task_list`, `other` |
| 交付平台 | `tencent-doc`, `feishu`, `notion`, `local`, `other` |
| 审核状态 | `pending`, `approved`, `rejected`, `revision_needed` |
| 定时周期 | `once`, `daily`, `weekly`, `monthly` |
| 定时类型 | `report`, `summary`, `backup`, `notification`, `custom` |
| 成员类型 | `human`, `ai` |
| 部署模式 | `cloud`, `local`, `knot` |
| 执行模式 | `chat_only`, `api_first`, `api_only` |

### B. HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 409 | 冲突（版本不匹配） |
| 500 | 服务器错误 |

### C. 相关文档链接

| 文档 | 路径 |
|------|------|
| 编码规范 | `CODING_STANDARDS.md` |
| 产品需求 | `docs/product/PRD.md` |
| OpenClaw Agent 协作约束 | `docs/openclaw/CLAUDE.md` |
| 同步功能设计 | `docs/technical/OPENCLAW_SYNC_DESIGN.md` |
| Workspace 标准 | `docs/openclaw/WORKSPACE_STANDARD.md` |
| AI 成员操作手册 | `skills/comind/SKILL.md` |

---

*本文档由 CoMind 团队维护，最后更新: 2026-02-28*
