# Chat 流式响应测试指南

完整的测试方案，用于验证任务推送后的 Agent 流式回复功能。

## 测试架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   Mock Gateway  │ ◄────────────────► │    TeamClaw     │
│  (ws://18789)   │                    │  (localhost)    │
└─────────────────┘                    └─────────────────┘
         │                                      │
         │         流式响应 (delta/final)        │
         └──────────────────────────────────────┘
```

## 快速测试（推荐）

### 1. 启动服务

**终端 1 - Mock Gateway:**
```bash
npm run mock:gateway
```

**终端 2 - TeamClaw:**
```bash
npm run dev
```

### 2. 运行测试

选择以下任意一种方式：

#### A. 自动化集成测试（最快）
```bash
npm run test:chat:auto
```
自动连接 Gateway，发送测试消息，验证流式响应。

#### B. 浏览器测试工具（可视化）
打开 `http://localhost:3000/test-task-push.html`

点击 **"运行完整测试"** 按钮，观察：
- 连接状态变化
- 实时流式输出
- 事件日志

#### C. 命令行测试
```bash
npm run test:task-push
```
纯命令行输出，适合 CI/CD。

#### D. Vitest 集成测试
```bash
npm run test:chat
```
使用 Vitest 运行单元化测试。

#### E. Playwright E2E 测试
```bash
npm run test:chat:e2e
```
在真实浏览器中测试 UI 交互。

## 测试文件说明

### 服务端模拟

| 文件 | 说明 |
|------|------|
| `scripts/mock-gateway.ts` | Mock Gateway 服务器，模拟 OpenClaw 协议 |

### 测试脚本

| 文件 | 类型 | 说明 |
|------|------|------|
| `scripts/test-task-push.ts` | CLI | 命令行测试工具 |
| `scripts/test-chat-integration.ts` | CLI | 集成测试脚本（自动启动 Gateway） |
| `scripts/test-full-automation.ts` | CLI | 完整自动化测试 |
| `tests/integration/chat-stream.test.ts` | Vitest | 集成测试套件 |
| `tests/e2e/chat-stream.spec.ts` | Playwright | E2E 浏览器测试 |
| `public/test-task-push.html` | Web | 浏览器测试工具页面 |

## 测试用例

### 基础测试
- ✅ 连接到 Mock Gateway
- ✅ 完成身份认证（challenge → connect → hello-ok）
- ✅ 发送 DM 请求（agent.dm）
- ✅ 接收流式响应（多个 delta）
- ✅ 接收 Final 消息

### 高级测试
- ✅ Session Key 一致性验证
- ✅ 多条消息连续发送
- ✅ 实时流式显示效果
- ✅ 错误处理

## 调试指南

### 问题 1: 连接失败
```
❌ WebSocket error
```
**解决:**
1. 检查 Mock Gateway 是否运行: `npm run mock:gateway`
2. 检查端口 18789 是否被占用

### 问题 2: 收不到响应
**排查步骤:**
1. 查看 Mock Gateway 控制台是否有 `[Mock] DM request` 日志
2. 查看浏览器控制台 `[useChatStream]` 日志
3. 检查 `test-task-push.html` 的事件日志

### 问题 3: 流式响应中断
**可能原因:**
- `handlerActiveRef` 互斥问题
- Session key 匹配失败
- WebSocket 连接断开

**调试:**
1. 打开浏览器开发者工具 → Console
2. 过滤 `[ChatPanel]`、`[useChatStream]`、`[DataProvider]` 日志
3. 查看 Network → WS 标签页

## Mock 响应内容

Mock Gateway 默认返回：
```
我来帮您分析这个任务...

任务分析完成：需要创建 3 个子任务。
```

修改 `scripts/mock-gateway.ts` 中的 `mockResponses` 数组可自定义响应。

## CI/CD 集成

```yaml
# .github/workflows/test.yml
- name: Start Mock Gateway
  run: npm run mock:gateway &

- name: Start Dev Server
  run: npm run dev &

- name: Wait for services
  run: npx wait-on http://localhost:3000 http://localhost:18790

- name: Run Chat Tests
  run: npm run test:chat
```

## 测试覆盖率

运行以下命令查看覆盖率：
```bash
npm run test:coverage
```

关键文件：
- `hooks/useChatStream.ts` - 流式响应处理
- `components/chat/ChatPanel.tsx` - 聊天面板
- `components/DataProvider.tsx` - 事件分发
