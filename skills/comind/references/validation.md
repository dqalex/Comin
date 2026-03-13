# 验证场景清单

> 本文档列出所有必须使用 MCP 验证的场景。核心工作流程见 SKILL.md。

## 前置：获取 MCP Token 进行验证

MCP API 需要 Token 认证。获取方式：

在对话中获取 Token，无需手动配置：
```json
// 获取 Token（首次自动创建）
{"tool": "get_agent_mcp_token", "parameters": {}}

// 列出所有 Token
{"tool": "list_agent_mcp_tokens", "parameters": {}}

// 撤销 Token
{"tool": "revoke_agent_mcp_token", "parameters": {"token_id": "amt_xxx"}}
```

**安全机制**：SHA-256 哈希 + AES-256-GCM 加密，外部 API 调用时 member_id 自动注入。
---

## 为什么必须验证？

TeamClaw 有三种交互通道，但只有 MCP API 提供显式错误返回：

| 通道 | 可靠性 | 错误反馈 |
|------|--------|---------|
| 对话信道 Actions | 依赖 WebSocket | ❌ 解析失败静默丢弃 |
| Markdown 同步 | Front Matter 解析 | ❌ 失败仅记录日志 |
| **MCP API** | 独立 HTTP | ✅ 显式错误返回 |

## 验证场景

### 场景 1：文档同步创建任务

```yaml
操作: create_document({ type: "teamclaw:tasks", ... })
验证: list_my_tasks() → 确认任务数量和内容
原因: Front Matter 解析失败静默，需显式验证
```

**验证代码**：
```json
{"tool": "list_my_tasks", "parameters": {"status": "todo"}}
// 确认：
// - 任务数量正确
// - assignees 正确（@成员名 匹配成功）
// - project_id 正确（项目名匹配成功）
```

### 场景 2：文档同步创建交付

```yaml
操作: create_document({ delivery_status: "pending", ... })
验证: list_my_deliveries(status: "pending") → 确认交付记录存在
原因: 交付记录关联复杂，需确认 memberId、documentId 正确
```

**验证代码**：
```json
{"tool": "list_my_deliveries", "parameters": {"status": "pending"}}
{"tool": "get_delivery", "parameters": {"delivery_id": "从上面返回的 ID"}}
// 确认 document_id、task_id 关联正确
```

### 场景 3：对话 Actions 更新状态

```yaml
操作: {"actions": [{"type": "update_task_status", ...}]}
验证: get_task(task_id) → 确认状态已变更
原因: WebSocket 断连时 Actions 可能丢失
```

**验证代码**：
```json
{"tool": "get_task", "parameters": {"task_id": "xxx"}}
// 确认 status 为期望值
```

### 场景 4：批量操作

```yaml
操作: 文档同步批量创建 N 条记录
验证: list_my_tasks() / list_my_deliveries() → 确认数量
原因: 部分记录可能因解析失败被跳过
```

### 场景 5：关键状态变更

```yaml
操作: 任务完成 / 交付提交 / 状态切换
验证: get_task() / get_delivery() → 确认状态
原因: 关键操作需 100% 确认成功
```

### 场景 6：跨系统同步

```yaml
操作: 外部文档系统同步到 TeamClaw
验证: search_documents(query) → 确认文档已同步
原因: 外部系统可能延迟或失败
```

## 常见验证失败原因

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 任务数量不足 | 部分行格式错误 | 检查 `- [ ]` 语法 |
| assignees 为空 | 成员名不存在 | 确认成员名拼写或手动分配 |
| project_id 为空 | 项目名不存在 | 使用项目 ID 或确认项目存在 |
| 交付记录未创建 | delivery_status 格式错误 | 确认 YAML 格式正确 |

## 验证时机

```
执行操作 → 立即验证 → 确认成功 → 继续下一步
           ↓
        验证失败 → 检查原因 → 重试或补救
```

**重要**：不要假设操作成功，始终验证！
