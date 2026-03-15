# Mock Gateway 本地测试指南

用于本地测试任务推送和 Agent 聊天响应，无需连接真实的 OpenClaw Gateway。

## 快速开始

### 1. 启动 Mock Gateway

```bash
npm run mock:gateway
```

输出示例：
```
🚀 Mock Gateway WebSocket running on ws://localhost:18789
🚀 Mock Gateway HTTP running on http://localhost:18790
📡 SSE endpoint: http://localhost:18790/api/sse
📬 Task push: http://localhost:18790/api/task-push
```

### 2. 启动 TeamClaw 开发服务器

```bash
npm run dev
```

### 3. 测试方式

有两种测试方式：

#### 方式 A: 浏览器测试工具（推荐）

打开 `http://localhost:3000/test-task-push.html`

**界面功能：**
- **连接 Mock Gateway**: 建立 WebSocket 连接
- **运行完整测试**: 自动连接并发送测试消息
- **发送 DM 消息**: 发送 `agent.dm` 请求（创建新会话）
- **发送 Chat 消息**: 在现有会话中发送消息
- **流式响应输出**: 实时显示收到的 delta/final 消息
- **事件日志**: 查看所有 WebSocket 消息

#### 方式 B: 命令行

```bash
npm run test:task-push
```

这将自动：
1. 连接到 Mock Gateway
2. 发送 `agent.dm` 请求
3. 接收并显示流式响应

## Mock Gateway 功能

### 模拟的 API

| API | 描述 |
|-----|------|
| `agent.chat` | 在现有会话中发送消息，返回流式响应 |
| `agent.dm` | 创建新 DM 会话，返回 sessionKey 并推送流式响应 |
| `snapshot` | 返回模拟的快照数据 |
| `session.list` | 返回空会话列表 |

### 模拟的流式响应

Mock Gateway 会发送以下流式响应：

```
[delta] "我来"
[delta] "帮您"
[delta] "分析"
...
[delta] "任务"
[delta] "...\n\n"
[delta] "任务分析完成："
...
[final] "我来帮您分析这个任务...\n\n任务分析完成：需要创建 3 个子任务。"
```

每个 delta 间隔 300-500ms，模拟真实的流式输出效果。

## 与 TeamClaw 集成测试

如果你想测试 TeamClaw 的完整流程：

### 配置 TeamClaw 连接 Mock Gateway

TeamClaw 默认连接 `ws://localhost:18789`，所以无需额外配置。

### 测试流程

1. 启动 Mock Gateway: `npm run mock:gateway`
2. 启动 TeamClaw: `npm run dev`
3. 打开 `http://localhost:3000`
4. 在 TeamClaw 中创建任务并点击"推送"
5. 观察对话框是否正确：
   - 自动弹出
   - 显示流式回复
   - 正确完成

### 调试技巧

**查看 Gateway 日志：**
Mock Gateway 会在控制台输出所有消息：
```
[Mock] New WebSocket connection
[Mock] Received: challenge
[Mock] Client connected: test-client-xxx role: operator
[Mock] DM request: { agentId: 'main', content: '...' }
[Mock] Sending delta: 我来
...
```

**浏览器控制台：**
在 TeamClaw 页面按 `F12` 打开开发者工具：
- **Console**: 查看 `[ChatPanel]`, `[useChatStream]` 等日志
- **Network > WS**: 查看 WebSocket 消息

**测试工具日志：**
在 `test-task-push.html` 页面查看事件日志和流式输出。

## 常见问题

### Q: 连接失败
```
❌ WebSocket error
```
检查：
1. Mock Gateway 是否已启动：`npm run mock:gateway`
2. 端口 18789 是否被占用

### Q: 消息发送成功但没有响应
检查 Mock Gateway 控制台是否有收到请求。

### Q: 流式响应中断
可能是前端 `handlerActiveRef` 互斥问题，查看浏览器控制台 `[useChatStream]` 日志。

## 修改 Mock 响应

编辑 `scripts/mock-gateway.ts` 中的 `mockResponses` 数组：

```typescript
const mockResponses = [
  { type: 'delta', content: '自定义' },
  { type: 'delta', content: '响应' },
  { type: 'final', content: '完整的回复内容' },
];
```

## 停止测试

按 `Ctrl+C` 停止 Mock Gateway 和 TeamClaw。
