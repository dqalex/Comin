# REQ-020: Chat Channel 高并发架构优化

## 测试范围

### 功能测试 (feature.test.ts)
- 连接池获取和复用
- 批量 action 执行
- 增量 Store 刷新
- 消息队列入队和处理
- 容灾自动切换

### 上游接口测试 (upstream.test.ts)
- `/api/chat-actions` API 接口稳定性
- `parseChatActions` 解析器接口
- `executeActions` 执行器接口

### 下游接口测试 (downstream.test.ts)
- MCP handlers 可用性
- Store 刷新方法可用性
- SSE 事件广播可用性

## 运行方式

```bash
# 本地测试
npx vitest run tests/req/REQ-020/

# 远程测试
TEST_TARGET=remote npx vitest run tests/req/REQ-020/
```

## 测试项清单

| 测试项 | 文件 | 预期基线(R1) | 预期验证(R2) |
|--------|------|-------------|-------------|
| 连接池获取 | feature.test.ts | FAIL | PASS |
| 连接复用 | feature.test.ts | FAIL | PASS |
| 批量执行 | feature.test.ts | FAIL | PASS |
| 增量刷新 | feature.test.ts | FAIL | PASS |
| 消息队列 | feature.test.ts | FAIL | PASS |
| 容灾切换 | feature.test.ts | FAIL | PASS |
| chat-actions API | upstream.test.ts | PASS | PASS |
| parseChatActions | upstream.test.ts | PASS | PASS |
| MCP handlers | downstream.test.ts | PASS | PASS |
| Store 方法 | downstream.test.ts | PASS | PASS |

## 诊断报告

- R1（基线）：`tests/reports/REQ-020-R1.json`
- R2（验证）：`tests/reports/REQ-020-R2.json`
