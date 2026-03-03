# CoMind API 文档

> 记录所有 API 接口，按模块分类。

---

## API 索引

| 模块 | 端点 | 方法 | 功能 |
|------|------|------|------|
| 成员 | `/api/members` | GET/POST | 成员列表/创建 |
| 成员 | `/api/members/[id]` | GET/PUT/DELETE | 成员详情/更新/删除 |
| 任务 | `/api/tasks` | GET/POST | 任务列表/创建 |
| 任务 | `/api/tasks/[id]` | GET/PUT/DELETE | 任务详情/更新/删除 |
| 任务 | `/api/tasks/[id]/logs` | GET | 任务操作日志 |
| 任务 | `/api/tasks/[id]/comments` | GET/POST | 任务评论 |
| 项目 | `/api/projects` | GET/POST | 项目列表/创建 |
| 项目 | `/api/projects/[id]` | GET/PUT/DELETE | 项目详情/更新/删除 |
| 文档 | `/api/documents` | GET/POST | 文档列表/创建 |
| 文档 | `/api/documents/[id]` | GET/PUT/DELETE | 文档详情/更新/删除 |
| 交付 | `/api/deliveries` | GET/POST | 交付列表/创建 |
| 交付 | `/api/deliveries/[id]` | GET/PUT/DELETE | 交付详情/审核/删除 |
| 定时任务 | `/api/scheduled-tasks` | GET/POST | 定时任务列表/创建 |
| 定时任务 | `/api/scheduled-tasks/[id]` | GET/PUT/DELETE | 定时任务详情/更新/删除 |
| 聊天会话 | `/api/chat-sessions` | GET/POST | 聊天会话列表/创建 |
| 聊天会话 | `/api/chat-sessions/[id]` | GET/PUT/DELETE | 会话详情/更新/删除 |
| 聊天消息 | `/api/chat-messages` | GET/POST | 聊天消息列表/发送 |
| 聊天消息 | `/api/chat-messages/[id]` | DELETE | 删除消息 |
| 聊天回复 | `/api/chat-reply` | POST | AI 聊天回复 |
| 聊天上下文 | `/api/chat-context` | POST | 获取聊天上下文 |
| 聊天动作 | `/api/chat-actions` | POST | 执行对话信道 Actions |
| OpenClaw | `/api/openclaw-status` | GET/POST | OpenClaw 状态 |
| OpenClaw | `/api/openclaw-status/[id]` | PUT/DELETE | 状态更新/删除 |
| MCP | `/api/mcp` | POST | MCP 工具调用（内部） |
| MCP | `/api/mcp/external` | POST | MCP 工具调用（外部认证） |
| SSE | `/api/sse` | GET | 服务器推送事件 |
| Gateway | `/api/gateway/config` | GET/POST/DELETE | Gateway 配置管理 |
| Gateway | `/api/gateway/request` | POST | Gateway 代理请求 |
| Gateway | `/api/gateway/reconnect` | POST | Gateway 重连 |
| 健康检查 | `/api/health` | GET | 服务健康状态 |
| 里程碑 | `/api/milestones` | GET/POST | 里程碑列表/创建 |
| 里程碑 | `/api/milestones/[id]` | GET/PUT/DELETE | 里程碑详情/更新/删除 |
| 任务刷新 | `/api/tasks/refresh` | POST | 手动刷新任务列表 |
| OpenClaw | `/api/openclaw-status/check-stale` | POST | 检查并重置超时 Agent 状态 |
| SOP 模板 | `/api/sop-templates` | GET/POST | SOP 模板列表/创建 |
| SOP 模板 | `/api/sop-templates/[id]` | GET/PUT/DELETE | SOP 模板详情/更新/删除 |
| SOP 模板 | `/api/sop-templates/[id]/export` | GET | 导出 SOP 模板 |
| SOP 模板 | `/api/sop-templates/import` | POST | 导入 SOP 模板 |
| SOP 阶段 | `/api/tasks/[id]/sop-advance` | POST | SOP 阶段推进（start/confirm/reject/skip） |
| 渲染模板 | `/api/render-templates` | GET/POST | 渲染模板列表/创建 |
| 渲染模板 | `/api/render-templates/[id]` | GET/PUT/DELETE | 渲染模板详情/更新/删除 |
| 调试 | `/api/debug` | GET/POST | 系统诊断/修复 |

---

## 通用说明

### 响应格式

**成功响应**：
```json
{
  "data": { ... },
  "error": null
}
```

**错误响应**：
```json
{
  "data": null,
  "error": "错误信息"
}
```

### 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 认证

- 大部分 API 不需要认证（本地开发）
- `/api/mcp/external` 需要 Bearer Token 认证：
  ```
  Authorization: Bearer <token>
  ```

---

## 成员 API

### GET /api/members

获取所有成员列表

**响应**：
```json
[
  {
    "id": "member-xxx",
    "name": "Alex",
    "type": "human",
    "email": "alex@example.com",
    "online": false,
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000
  }
]
```

### POST /api/members

创建成员

**请求体**：
```json
{
  "name": "Scout",
  "type": "ai",
  "email": "scout@example.com",
  "openclawName": "scout",
  "openclawEndpoint": "ws://localhost:18789",
  "openclawApiToken": "xxx"
}
```

**响应**：返回创建的成员对象

### GET /api/members/[id]

获取单个成员详情

### PUT /api/members/[id]

更新成员信息

**请求体**：需要更新的字段

**注意**：
- `openclawApiToken` 会自动加密存储
- 响应中 `openclawApiToken` 会被脱敏为 `***`

### DELETE /api/members/[id]

删除成员（级联删除关联数据）

---

## 任务 API

### GET /api/tasks

获取任务列表

**查询参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| projectId | string | 按项目筛选 |
| status | string | 按状态筛选 |
| assigneeId | string | 按负责人筛选 |

### POST /api/tasks

创建任务

**请求体**：
```json
{
  "title": "任务标题",
  "description": "任务描述",
  "projectId": "project-xxx",
  "assignees": ["member-xxx"],
  "priority": "high",
  "deadline": 1700000000000
}
```

### GET /api/tasks/[id]

获取任务详情

### PUT /api/tasks/[id]

更新任务

**请求体**：需要更新的字段

**允许更新的字段**：
- title, description, status, progress
- priority, deadline, assignees
- checkItems, attachments

### DELETE /api/tasks/[id]

删除任务（级联删除日志和评论）

---

## 项目 API

### GET /api/projects

获取项目列表

### POST /api/projects

创建项目

**请求体**：
```json
{
  "name": "项目名称",
  "description": "项目描述"
}
```

### GET /api/projects/[id]

获取项目详情

### PUT /api/projects/[id]

更新项目

### DELETE /api/projects/[id]

删除项目（级联删除关联任务和文档）

---

## 文档 API

### GET /api/documents

获取文档列表

**查询参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| projectId | string | 按项目筛选 |
| type | string | 按类型筛选 |

### POST /api/documents

创建文档

**请求体**：
```json
{
  "title": "文档标题",
  "content": "# 文档内容\n\n...",
  "projectId": "project-xxx",
  "type": "note"
}
```

### GET /api/documents/[id]

获取文档详情

### PUT /api/documents/[id]

更新文档

### DELETE /api/documents/[id]

删除文档

---

## MCP API

### POST /api/mcp

MCP 工具调用（内部使用）

### POST /api/mcp/external

外部 MCP 调用（需要认证）

**认证**：
```
Authorization: Bearer <COMIND_API_TOKEN>
```

**请求体**：
```json
{
  "tool": "update_task_status",
  "parameters": {
    "task_id": "task-xxx",
    "status": "completed"
  }
}
```

**批量调用**：
```json
{
  "batch": [
    { "tool": "update_task_status", "parameters": { "task_id": "xxx", "status": "completed" } },
    { "tool": "add_comment", "parameters": { "task_id": "xxx", "content": "完成" } }
  ]
}
```

**可用工具**：

| 工具 | 功能 | 必填参数 |
|------|------|----------|
| `update_task_status` | 更新任务状态 | task_id, status |
| `add_task_comment` | 添加评论 | task_id, content |
| `create_check_item` | 创建检查项 | task_id, text |
| `complete_check_item` | 完成检查项 | task_id, item_id |
| `create_document` | 创建文档 | title, content |
| `update_document` | 更新文档 | document_id, content |
| `get_document` | 获取文档 | document_id 或 title |
| `search_documents` | 搜索文档 | query |
| `deliver_document` | 提交交付 | title, platform |
| `review_delivery` | 审核交付 | delivery_id, status |
| `list_my_deliveries` | 获取我的交付物 | - |
| `get_delivery` | 获取交付详情 | delivery_id |
| `update_status` | 更新 AI 状态 | status |
| `set_queue` | 设置任务队列 | queued_tasks |
| `set_do_not_disturb` | 免打扰模式 | interruptible |
| `list_my_tasks` | 获取我的任务 | - |
| `get_task` | 获取任务详情 | task_id |
| `get_project` | 获取项目详情 | project_id |
| `get_project_members` | 获取项目成员 | project_id |
| `create_schedule` | 创建定时任务 | title, task_type, schedule_type |
| `list_schedules` | 列出定时任务 | - |
| `update_schedule` | 更新定时任务 | schedule_id |
| `delete_schedule` | 删除定时任务 | schedule_id |
| `register_member` | AI 自注册 | name, endpoint |
| `get_template` | 获取模板 | template_name |
| `list_templates` | 列出模板 | - |
| `create_milestone` | 创建里程碑 | title, project_id |
| `list_milestones` | 获取里程碑列表 | - |
| `update_milestone` | 更新里程碑 | milestone_id |
| `delete_milestone` | 删除里程碑 | milestone_id |

---

## SSE API

### GET /api/sse

服务器推送事件流

**响应**：
```
Content-Type: text/event-stream

event: task_updated
data: {"taskId": "task-xxx"}

event: member_updated
data: {"memberId": "member-xxx"}
```

**事件类型**：
- `task_created` / `task_updated` / `task_deleted`
- `member_created` / `member_updated` / `member_deleted`
- `document_created` / `document_updated` / `document_deleted`
- Gateway 事件（服务端代理模式）：
  - `gateway_event` / `gateway_agent_update` / `gateway_session_update`
  - `gateway_chat_event` / `gateway_cron_update` / `gateway_config_update`
  - `gateway_status_update`

---

## Gateway API（服务端代理模式）

### GET /api/gateway/config

获取当前 Gateway 配置

**响应**：
```json
{
  "data": {
    "id": "abc123",
    "url": "ws://localhost:18789",
    "mode": "server_proxy",
    "status": "connected"
  },
  "error": null
}
```

### POST /api/gateway/config

保存 Gateway 配置

**请求体**：
```json
{
  "url": "ws://localhost:18789",
  "token": "your-gateway-token",
  "mode": "server_proxy"
}
```

**参数说明**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | Gateway WebSocket URL (ws:// 或 wss://) |
| token | string | 是* | Gateway Token（新配置必填，更新时留空保持不变） |
| mode | string | 否 | 连接模式：`server_proxy`（默认）或 `browser_direct` |

**响应**：
```json
{
  "data": { "id": "abc123", "mode": "server_proxy" },
  "error": null
}
```

### DELETE /api/gateway/config?id={id}

删除 Gateway 配置

### POST /api/gateway/request

代理请求到 Gateway（仅服务端代理模式）

**请求体**：
```json
{
  "method": "agents.list",
  "params": {}
}
```

**响应**：
```json
{
  "data": { "agents": [...] },
  "error": null
}
```

**注意**：
- 仅在服务端代理模式下可用
- 浏览器直连模式应直接连接 Gateway

---

## 里程碑 API

### GET /api/milestones

获取里程碑列表

**查询参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| projectId | string | 按项目筛选 |

### POST /api/milestones

创建里程碑

**请求体**：
```json
{
  "title": "Sprint 1",
  "description": "第一个迭代",
  "projectId": "project-xxx",
  "status": "active",
  "dueDate": 1700000000000
}
```

### GET /api/milestones/[id]

获取里程碑详情

### PUT /api/milestones/[id]

更新里程碑

### DELETE /api/milestones/[id]

删除里程碑

---

## 其他 API

### POST /api/chat-reply

处理聊天回复，解析 Actions

### POST /api/chat-context

获取聊天上下文

### POST /api/chat-actions

执行对话信道 Actions

### GET /api/openclaw-status

获取 OpenClaw 状态

### GET /api/scheduled-tasks

获取定时任务列表

### POST /api/scheduled-tasks

创建定时任务

### GET /api/deliveries

获取交付记录列表

---

## SOP MCP 工具

> 以下工具通过 `/api/mcp` 或 `/api/mcp/external` 调用

### advance_sop_stage

推进 SOP 到下一阶段。若当前阶段为 `ai_with_confirm` 且 `waiting_confirm`，拒绝直接推进。

```json
{ "tool": "advance_sop_stage", "parameters": { "task_id": "xxx" } }
```

### request_sop_confirm

AI 请求人工确认当前阶段产出，触发 `sop_confirm_request` SSE 事件。

```json
{ "tool": "request_sop_confirm", "parameters": { "task_id": "xxx", "confirm_message": "请确认", "stage_output": "内容" } }
```

### get_sop_context

获取 SOP 执行上下文（阶段信息、知识库分层内容、前序产出）。

```json
{ "tool": "get_sop_context", "parameters": { "task_id": "xxx" } }
```

### save_stage_output

保存阶段产出但不推进（保留已有 status）。

```json
{ "tool": "save_stage_output", "parameters": { "task_id": "xxx", "output": "内容" } }
```

### update_knowledge

向 Know-how 知识库智能追加经验（L4 层自动定位）。

```json
{ "tool": "update_knowledge", "parameters": { "document_id": "xxx", "content": "经验内容" } }
```

### create_sop_template / update_sop_template

AI 创建/更新 SOP 模板（draft 状态）。

### create_render_template / update_render_template

创建/更新渲染模板（HTML + slots + sections）。

---

## 贡献指南

新增或修改 API 时，请更新此文档：

1. 更新 API 索引表
2. 添加详细接口说明
3. 提供请求/响应示例
4. 说明认证要求
