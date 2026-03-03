# CoMind 需求文档

> 所有需求记录在此文件，按 ID 索引。状态：pending → in_progress → completed / cancelled

---

## 需求索引

| ID | 标题 | 状态 | 优先级 | 提出时间 |
|----|------|------|--------|----------|
| REQ-001 | 标准化开发流程 | completed | P1 | 2026-02-20 |
| REQ-002 | 对话信道数据交互模块 | completed | P1 | 2026-02-20 |
| REQ-003 | Gateway 服务端代理模式 | completed | P1 | 2026-02-20 |
| REQ-004 | 文档交付审核增强 | completed | P1 | 2026-02-24 |
| REQ-005 | 任务自动推送 + AI 巡检兜底 | pending | P1 | 2026-02-26 |
| REQ-006 | Markdown 甘特图生成器 | pending | P2 | 2026-03-02 |
| REQ-007 | SOP 引擎核心 | completed | P0 | 2026-03-03 |
| REQ-008 | 渲染模板系统 | completed | P1 | 2026-03-03 |
| REQ-009 | Know-how 分层知识库 | completed | P1 | 2026-03-03 |
| REQ-010 | SOP 模板导入导出 | completed | P1 | 2026-03-03 |

---

## 详细需求

<!-- 新需求模板：

## REQ-001: 需求标题

**状态**：pending
**提出时间**：YYYY-MM-DD
**提出者**：用户名
**优先级**：P0 / P1 / P2 / P3

### 问题描述


### 功能目标


### 使用场景
1. 
2. 

### 验收标准
- [ ] 
- [ ] 

### 技术方案（实现后填写）
- 关键组件：
- 实现文件：
- API 变更：

### 关联需求
- 相关需求：
- 依赖需求：

-->

---

## REQ-001: 标准化开发流程

**状态**：completed
**提出时间**：2026-02-20
**提出者**：Alex
**优先级**：P1

### 问题描述

开发流程不规范，需求记录分散，组件复用困难，API 文档不完整，导致：
1. 需求理解偏差，返工频繁
2. 重复造轮子，效率低下
3. API 缺乏文档，协作困难
4. 缺少 Review，代码质量不稳定

### 功能目标

建立标准化开发流程：
1. 需求确认：生成需求文档，用户确认后实现
2. 组件复用：实现前查阅组件库，实现后记录新组件
3. API 文档：统一维护所有 API 文档
4. Review 流程：性能、安全、BUG、编译检查
5. 发布流程：确认后部署

### 使用场景
1. 用户提出新功能需求时，按流程执行
2. Bug 修复时，按流程记录和验证
3. 重构优化时，按流程评估和实施

### 验收标准
- [x] 创建 dev-workflow Skill
- [x] 创建 REQUIREMENTS.md 需求文档
- [x] 创建 COMPONENTS.md 组件文档
- [x] 创建 API.md API 文档
- [x] 创建 TECH_DEBT.md 技术债文档
- [x] 更新 Skill 加入技术债检查流程

### 技术方案
- 关键组件：`.codebuddy/skills/dev-workflow/SKILL.md`
- 实现文件：`docs/process/REQUIREMENTS.md`, `docs/technical/COMPONENTS.md`, `docs/technical/API.md`
- API 变更：无

### 关联需求
- 相关需求：无
- 依赖需求：无

---

## REQ-002: 对话信道数据交互模块

**状态**：completed
**提出时间**：2026-02-20
**更新时间**：2026-02-20
**提出者**：Alex
**优先级**：P1

### 问题描述

对话信道数据交互模块存在以下问题：

1. **架构分散**：Chat Actions 和 MCP Tools 是两套独立系统
   - `ChatActionType` 定义 9 种操作
   - `ActionInstruction` 定义 22 种操作
   - 两套类型定义不统一，维护成本高

2. **错误处理不完善**：
   - Actions 执行失败后反馈不清晰
   - 用户不知道哪个操作失败、为什么失败
   - 缺少重试机制

3. **日志/调试困难**：
   - 没有统一的日志格式
   - 难以追踪 Actions 执行链路
   - 生产环境排查问题困难

4. **没有单元测试**：
   - 核心解析和执行逻辑未覆盖测试
   - 修改代码后无法验证正确性

### 功能目标

建立**统一的对话信道数据交互模块**：

1. **统一架构**：合并 Chat Actions 和 MCP Tools 为一套系统
   - 统一类型定义
   - 统一执行入口
   - 清晰的操作分类

2. **完善错误处理**：
   - 每个操作有明确的成功/失败反馈
   - 失败原因清晰可读
   - 支持部分成功场景

3. **统一日志系统**：
   - 结构化日志（JSON 格式）
   - 请求 ID 追踪完整链路
   - 开发/生产环境不同日志级别

4. **单元测试覆盖**：
   - 解析器测试
   - 执行器测试
   - 边界条件测试

5. **支持扩展**：
   - 易于添加新 Action 类型
   - 插件化架构

### 使用场景

1. **场景A：智能体身份同步**
   - AI 通过对话回复身份信息
   - 系统解析并更新 IDENTITY.md

2. **场景B：任务状态更新**
   - AI 回复中嵌入任务状态变更
   - 系统自动更新任务状态

3. **场景C：文档创建**
   - AI 通过对话创建文档
   - 系统解析内容并保存

4. **场景D：Gateway 通信**
   - WebSocket 与 Gateway 双向通信
   - 事件驱动的数据同步

5. **场景E：获取 MCP Token**
   - OpenClaw 智能体通过对话获取自己的 MCP API Token
   - 系统返回 Token 及调用示例
   - 智能体可使用 Token 直接调用 `/api/mcp/external` 端点

### 上下游依赖分析

**上游调用者**（谁在使用对话信道功能）：

| 调用方 | 文件 | 场景 | 迁移状态 |
|--------|------|------|----------|
| 聊天面板 | `components/chat/ChatPanel.tsx` | 解析 AI 回复中的 actions | ⚠️ 使用旧模块 `chat-action-parser` |
| Chat Actions API | `app/api/chat-actions/route.ts` | 执行 actions | ⚠️ 需要迁移到新模块 |

**下游依赖**（对话信道依赖什么）：

| 依赖 | 文件 | 功能 | 状态 |
|------|------|------|------|
| Task Handlers | `app/api/mcp/handlers/task.handler.ts` | 任务操作 | ✅ 已复用 |
| Document Handlers | `app/api/mcp/handlers/document.handler.ts` | 文档操作 | ✅ 已复用 |
| Status Handlers | `app/api/mcp/handlers/status.handler.ts` | 状态操作 | ✅ 已复用 |
| Member Handlers | `app/api/mcp/handlers/member.handler.ts` | 成员操作（含 get_mcp_token） | ✅ 已实现 |
| Schedule Handlers | `app/api/mcp/handlers/schedule.handler.ts` | 定时任务操作 | ✅ 已复用 |
| Delivery Handlers | `app/api/mcp/handlers/delivery.handler.ts` | 交付操作 | ✅ 已复用 |
| Template Handlers | `app/api/mcp/handlers/template.handler.ts` | 模板操作 | ✅ 已复用 |

**数据流向**：

```
用户消息 → ChatPanel → AI 回复 → 解析 actions → 执行 actions → 更新 Store → 刷新 UI
                                              ↓
                                        /api/chat-actions (旧)
                                              ↓
                                        handlers 执行
                                              ↓
                                        数据库/API
```

### 迁移计划

| 步骤 | 任务 | 状态 |
|------|------|------|
| 1 | 创建新模块 `lib/chat-channel/` | ✅ 已完成 |
| 2 | 实现 `get_mcp_token` action | ✅ 已完成 |
| 3 | 创建客户端入口 `lib/chat-channel/client.ts` | ✅ 已完成 |
| 4 | 迁移 `ChatPanel.tsx` 使用新模块 | ✅ 已完成 |
| 5 | 迁移 `/api/chat-actions` 使用新模块 | ✅ 已完成 |
| 6 | 标记旧模块为废弃 | ✅ 已完成 |
| 7 | 删除旧模块 | ✅ 已完成 |

### 验收标准

**架构层面**：
- [x] 统一类型定义（合并 ChatActionType 和 ActionInstruction）
- [x] 统一执行入口（单一 API 处理所有操作）
- [x] 清晰的操作分类（查询/写入/状态/定时）

**质量层面**：
- [x] 完整的错误处理和用户反馈
- [x] 结构化日志 + 请求 ID 追踪
- [x] 单元测试覆盖（测试文件已创建，待安装 vitest 运行）

**扩展层面**：
- [x] 添加新 Action 类型的文档和模板
- [x] 支持 Action 执行前/后钩子（通过 registerCustomHandler）

**场景验证**：
- [x] 智能体身份同步场景可用（sync_identity action 已定义）
- [x] 获取 MCP Token 场景可用（get_mcp_token action 已实现）
- [x] 所有现有 Actions 稳定执行（复用现有 handlers）

### 技术方案

**关键组件**：
- `lib/chat-channel/types.ts` - 统一类型定义
- `lib/chat-channel/actions.ts` - Action 定义和验证
- `lib/chat-channel/parser.ts` - 解析器
- `lib/chat-channel/executor.ts` - 执行器
- `lib/chat-channel/logger.ts` - 日志系统
- `lib/chat-channel/errors.ts` - 错误处理
- `lib/chat-channel/index.ts` - 模块入口

**实现文件**：
- `lib/chat-channel/` - 新模块目录
- `tests/chat-channel.test.ts` - 单元测试

**API 变更**：
- 新增模块，不影响现有 API
- 可逐步替换 `lib/chat-action-parser.ts` 和 `core/mcp/executor.ts`

### 关联需求
- 相关需求：REQ-001（标准化开发流程）
- 依赖需求：无

### 技术债关联
- TD-001: Gateway 唯一标识问题（身份同步需要）
- TD-002: UUID → Base58 ID 迁移失败（可能影响）

---

## REQ-003: Gateway 服务端代理模式

**状态**：completed
**提出时间**：2026-02-20
**更新时间**：2026-02-22
**提出者**：Alex
**优先级**：P1

### 问题描述

当前 OpenClaw Gateway WebSocket 连接在用户浏览器端建立，存在以下问题：

1. **连接中断风险**：
   - OpenClaw 智能体执行任务时间较长
   - 用户关闭浏览器或网络中断会导致流程中断
   - 长时间任务无法"脱手不管"

2. **多用户协作限制**：
   - 每个用户需要单独配置 Gateway 连接
   - 无法实现管理员统一配置、其他用户无感知

3. **定时任务兼容性**：
   - 当前使用 OpenClaw 原生定时任务能力
   - 未来可能需要服务端自主的定时任务调度

### 功能目标

实现 **Gateway 服务端代理模式**：

1. **双模式支持**：
   - 服务端代理模式（默认）：服务端维护 Gateway 连接，浏览器通过 SSE/API 交互
   - 浏览器直连模式（可选）：保持现有方式

2. **连接持久化**：
   - 服务端 WebSocket 连接独立于用户浏览器
   - 浏览器关闭不影响正在执行的任务

3. **安全存储**：
   - Gateway Token 存储在数据库（加密）
   - 仅管理员可配置

4. **消息转发**：
   - 浏览器 → 服务端：通过 API 代理
   - 服务端 → 浏览器：通过 SSE 推送

### 使用场景

1. **场景A：长时间任务执行**
   - 用户启动任务后关闭浏览器
   - 任务继续执行，下次打开浏览器可看到结果

2. **场景B：多用户协作**
   - 管理员配置 Gateway 连接
   - 其他用户无需配置，直接使用

3. **场景C：定时任务（未来）**
   - 服务端自主调度任务
   - 不依赖浏览器在线

### 上下游依赖分析

**上游调用者**：

| 调用方 | 文件 | 场景 | 变更 |
|--------|------|------|------|
| 设置页面 | `app/settings/openclaw/page.tsx` | 配置连接模式开关 | 新增开关组件 |
| Agent 管理 | `app/agents/page.tsx` | Agent 列表/详情 | 适配服务端代理模式 |
| 会话管理 | `app/sessions/page.tsx` | 会话列表/加载聊天 | 适配服务端代理模式 |
| 定时任务 | `app/schedules/page.tsx` | Cron 任务管理 | 适配服务端代理模式 |
| 聊天面板 | `components/chat/ChatPanel.tsx` | 发送消息 | 适配服务端代理模式 |
| DataProvider | `components/DataProvider.tsx` | 初始化连接 | 根据模式选择连接方式 |

**下游依赖**：

| 依赖 | 现有文件 | 需新增/修改 |
|------|----------|-------------|
| Gateway 客户端 | `lib/gateway-client.ts` | 新增服务端版本 |
| SSE 事件 | `lib/event-bus.ts` | 新增 Gateway 事件类型 |
| Token 存储 | localStorage | 数据库加密存储 |
| API 代理 | - | 新增 `/api/gateway/*` |

**数据流向**：

```
服务端代理模式：
┌─────────────┐      API 请求      ┌─────────────┐     WebSocket     ┌─────────────┐
│   浏览器    │ ─────────────────→ │  CoMind     │ ─────────────────→ │  Gateway    │
│             │                     │   服务端    │                    │             │
│             │ ←────── SSE ─────── │             │ ←───── Events ──── │             │
└─────────────┘                     └─────────────┘                    └─────────────┘

浏览器直连模式（现有）：
┌─────────────┐                                      ┌─────────────┐
│   浏览器    │ ←─────────── WebSocket ────────────→ │  Gateway    │
└─────────────┘                                      └─────────────┘
```

### 验收标准

**功能层面**：
- [x] 服务端 Gateway 客户端实现（支持协议 v3）
- [x] Token 数据库加密存储
- [x] 设置页面连接模式开关
- [x] API 代理端点 (`/api/gateway/*`)
- [x] SSE 推送 Gateway 事件

**安全层面**：
- [x] Token 加密存储（使用 `lib/security.ts`）
- [x] 加解密过程安全：Token 仅在内存中解密，不入日志
- [ ] 仅管理员可配置服务端连接（待多用户支持）
- [x] API 代理需要 Gateway 已连接

**性能层面**：
- [x] 服务端代理模式延迟 < 100ms（可接受）
- [x] API 代理响应时间 < 50ms

**日志与调试**：
- [x] 结构化日志记录（JSON 格式）
- [x] 日志包含请求ID、方法、耗时
- [x] Token 相关操作不入日志明文
- [x] 日志轮转（按日期，保留 7 天）

**兼容性层面**：
- [x] 浏览器直连模式正常工作
- [x] 模式切换无数据丢失
- [x] 前端 store 数据获取适配 server_proxy 模式
- [x] GatewayRequired 组件支持双模式判断
- [x] DataProvider SSE 事件处理器实现

**部署验证**（2026-02-21 修复）：
- [x] WebSocket Origin header 支持（Gateway 需要 origin 验证）
- [x] 前端 store 同步服务端代理状态（connectionMode, serverProxyConnected）
- [x] GatewayRequired 组件支持双模式判断
- [x] DataProvider 初始化时同步服务端状态

**server_proxy 模式完整实现**（2026-02-21）：
- [x] `lib/gateway-proxy.ts` - GatewayProxyClient 类，通过 `/api/gateway/request` 代理请求
- [x] `store/gateway.store.ts` - 所有 refresh 方法支持双模式判断
- [x] `components/DataProvider.tsx` - Gateway SSE 事件处理器实现

### 技术方案

**关键组件**：
- `lib/server-gateway-client.ts` - 服务端 Gateway 客户端（含 Origin header）
- `lib/gateway-proxy.ts` - 前端代理客户端，通过 `/api/gateway/request` 发送请求
- `app/api/gateway/config/route.ts` - 配置 API 端点
- `app/api/gateway/request/route.ts` - 代理请求 API 端点
- `app/api/gateway/reconnect/route.ts` - 手动重连端点
- `lib/event-bus.ts` - 扩展 SSE 事件类型
- `db/schema.ts` - gateway_configs 表
- `store/gateway.store.ts` - 前端状态（含 connectionMode, serverProxyConnected），所有 refresh 方法支持双模式
- `components/GatewayRequired.tsx` - 双模式连接判断组件
- `components/DataProvider.tsx` - 初始化时同步服务端状态，Gateway SSE 事件处理

**实现文件**：
- `lib/server-gateway-client.ts` - 核心客户端
- `app/api/gateway/` - API 端点
- `components/settings/GatewayConfigPanel.tsx` - UI 组件

**API 变更**：
- 新增 `GET/POST/DELETE /api/gateway/config` - Gateway 配置管理
- 新增 `POST /api/gateway/request` - 代理请求端点
- 扩展 SSE 事件类型：gateway_* 系列

### 关联需求
- 相关需求：REQ-002（对话信道，SSE 推送）
- 依赖需求：无

### 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 服务端 WebSocket 重连复杂 | 中 | 复用现有 `gateway-client.ts` 重连逻辑 |
| Token 安全性 | 高 | 见下方安全方案 |
| 多用户并发 | 中 | 服务端客户端支持多租户（未来） |
| 调试困难 | 中 | 结构化日志 + 请求ID追踪 |

### Token 安全存储方案

**存储流程**：
```
用户输入 Token → 服务端 API → AES 加密 → 数据库存储
```

**使用流程**：
```
数据库 → 内存解密 → 服务端 Gateway 客户端连接
                    ↓
              连接成功后立即清除内存中的明文 Token
```

**安全措施**：
1. **加密存储**：使用 `lib/security.ts` 的 AES 加密
2. **内存保护**：Token 解密后仅在闭包内使用，不暴露到全局
3. **日志隔离**：Token 绝不写入日志，错误信息脱敏
4. **传输安全**：HTTPS + 内网通信

### 低延迟架构方案

**纯代理模式**（采用）：
```
┌─────────────┐      API 请求      ┌─────────────┐     WebSocket     ┌─────────────┐
│   浏览器    │ ─────────────────→ │  CoMind     │ ─────────────────→ │  Gateway    │
│             │                     │   服务端    │                    │             │
│             │ ←────── SSE ─────── │             │ ←───── Events ──── │             │
└─────────────┘                     └─────────────┘                    └─────────────┘
```

**延迟说明**：纯代理模式延迟可接受（~50ms），架构更简单。

### 日志与调试

**日志记录要求**：

| 日志类型 | 内容 | 级别 |
|----------|------|------|
| 连接状态 | 连接/断开/重连 | INFO |
| 消息流转 | 请求ID、方法、耗时 | INFO |
| 错误详情 | 完整错误堆栈、上下文 | ERROR |
| Token 操作 | 仅记录"加密/解密"，不记录值 | INFO |

**日志格式**：
```json
{
  "timestamp": "2026-02-20T22:00:00Z",
  "level": "INFO",
  "requestId": "req-xxx",
  "module": "server-gateway",
  "action": "connect",
  "duration": 150,
  "metadata": {}
}
```

**调试支持**：
- 日志文件：`logs/gateway-{date}.log`
- 日志轮转：按日期，保留 7 天
- 结构化 JSON 格式，便于 grep 和分析

---

## REQ-004: 文档交付审核增强

**状态**：completed
**提出时间**：2026-02-24
**更新时间**：2026-02-25
**提出者**：Alex
**优先级**：P1

### 问题描述

当前文档交付流程存在以下问题：

1. **文档与交付记录关联不直观**：
   - 交付记录通过 `documentId` 关联文档
   - 但文档 Front Matter 中没有自动同步关联状态
   - 用户在文档编辑器中看不到"这是一个交付物"

2. **心跳巡检不包含交付审核状态**：
   - AI 成员的心跳任务只检查任务进展
   - 不知道自己的交付物处于什么审核状态
   - "需要修改"、"退回"的交付物没有主动提醒

3. **审核入口分散**：
   - 用户需要进入交付中心才能审核
   - 在文档编辑器中看到交付物时，没有快速审核入口
   - 审核流程不够流畅

### 功能目标

建立**文档交付审核增强系统**：

1. **Front Matter 交付字段支持**：
   - 文档可声明自己为交付物（`delivery_status`）
   - 系统自动创建/更新交付记录
   - 审核状态双向同步（交付记录 ↔ 文档 Front Matter）

2. **心跳巡检包含交付审核**：
   - AI 成员心跳时检查自己的交付物状态
   - "需要修改"和"退回"状态触发 TODO 更新
   - 主动提醒需要处理

3. **文档编辑器快速审核**：
   - 编辑器识别交付物文档
   - 显示审核状态和快速审核按钮
   - 用户可在文档页面直接审核

### 使用场景

#### 场景A：AI 成员创建交付物
1. AI 创建报告/决策文档
2. 在 Front Matter 中声明 `delivery_status: pending`
3. 系统自动创建交付记录
4. 交付中心显示该文档

#### 场景B：用户审核交付物
1. 用户在交付中心点击审核
2. 选择通过/退回/需修改
3. 系统同步更新文档 Front Matter
4. AI 成员心跳时发现状态变化

#### 场景C：AI 成员收到审核反馈
1. 心跳巡检发现 `delivery_status: revision_needed`
2. TODO.md 中添加"修改交付物"任务
3. AI 主动处理并重新提交

#### 场景D：用户在编辑器快速审核
1. 用户打开有 `delivery_status` 的文档
2. 编辑器显示"待审核"状态徽章
3. 用户点击快速审核按钮
4. 弹窗选择审核结果

### 上下游依赖分析

#### 第一步：触发条件分析

| 触发场景 | 触发者 | 触发时机 | 失败处理 |
|---------|-------|---------|---------|
| 创建交付记录 | 文档保存时检测 Front Matter | 文档 content 更新后 | 记录警告日志 |
| 审核状态同步 | 用户审核操作 | 审核成功后 | 回滚审核状态 |
| 心跳巡检 | OpenClaw Cron | 定时触发 | 跳过本次巡检 |
| 编辑器识别 | 页面加载/内容变化 | 编辑器渲染时 | 隐藏审核入口 |

#### 第二步：现有实现检查

| 现有功能 | 文件 | 复用决策 |
|---------|------|---------|
| 交付记录表 | `db/schema.ts` → deliveries | ✅ 复用，扩展字段 |
| 交付中心页面 | `app/deliveries/page.tsx` | ✅ 复用审核逻辑 |
| 文档编辑器 | `app/wiki/page.tsx` | ✅ 扩展审核入口 |
| 心跳巡检 | `skills/.../heartbeat-check-progress.md` | ✅ 扩展检查交付状态 |
| Front Matter 解析 | `lib/markdown-sync.ts` | ✅ 已有解析逻辑 |

#### 第三步：双模式兼容性分析

| 功能 | browser_direct | server_proxy |
|------|---------------|--------------|
| 创建交付记录 | ✅ 服务端处理 | ✅ 服务端处理 |
| 审核状态同步 | ✅ 服务端处理 | ✅ 服务端处理 |
| 心跳巡检 | ✅ Gateway 直连 | ✅ Gateway 直连 |
| 编辑器识别 | ✅ 前端渲染 | ✅ 前端渲染 |

#### 第四步：状态同步分析

| 状态变化 | 同步机制 | 需要新增事件 |
|---------|---------|-------------|
| 文档 → 交付记录 | `syncMarkdownToDatabase` | ❌ 已有 |
| 审核结果 → 文档 | `updateDocumentDeliveryFrontmatter` | ❌ 已有 |
| 审核结果 → 心跳 TODO | 心跳读取 delivery 状态 | ✅ 需要新增查询 |

#### 第五步：全量影响面扫描

| 共享元素 | 使用方 | 兼容性 |
|---------|-------|--------|
| `delivery_status` 字段 | `lib/markdown-sync.ts` | ✅ 已支持 |
| `deliveries` 表 | `app/deliveries/page.tsx`, `store/delivery.store.ts` | ✅ 兼容 |
| 心跳模板 | `heartbeat-check-progress.md` | ✅ 已扩展 |

### 验收标准

#### Front Matter 交付字段
- [x] 文档 Front Matter 支持 `delivery_status` 字段
- [x] `delivery_status: pending` 自动创建交付记录
- [x] 审核后自动更新文档 Front Matter
- [x] `related_tasks` 字段关联任务

#### 心跳巡检交付状态
- [x] 心跳模板包含交付状态检查
- [x] `revision_needed` 状态触发 TODO 更新
- [x] `rejected` 状态触发 TODO 更新
- [x] 巡检报告包含交付物状态

#### 编辑器快速审核
- [x] 编辑器识别 `delivery_status` 字段
- [x] 显示审核状态徽章
- [x] 显示快速审核按钮
- [x] 弹窗审核功能

#### 关联文档自动同步
- [x] 交付记录 `documentId` 字段自动填充
- [x] 文档列表显示关联状态

### 技术方案

#### 已实现部分

| 组件 | 文件 | 状态 |
|------|------|------|
| Front Matter 字段定义 | `docs/openclaw/CLAUDE.md`, `WORKSPACE_STANDARD.md`, `skills/comind/SKILL.md` | ✅ 已完成 |
| 解析逻辑 | `lib/markdown-sync.ts` → `syncDeliveryFromDocumentFrontmatter` | ✅ 已完成 |
| 审核同步 | `app/api/mcp/handlers/delivery.handler.ts` → `updateDocumentDeliveryFrontmatter` | ✅ 已完成 |
| 类型定义 | `lib/sync/shared.ts` → `Frontmatter` 接口 | ✅ 已完成 |

#### 待实现部分

| 组件 | 文件 | 说明 |
|------|------|------|
| ~~心跳检查交付~~ | `skills/comind/references/heartbeat-check-progress.md` | ✅ 已扩展巡检逻辑 |
| ~~编辑器审核入口~~ | `app/wiki/page.tsx` | ✅ 已集成 DeliveryStatusCard |
| ~~交付状态卡片~~ | `components/wiki/DeliveryStatusCard.tsx` | ✅ 已创建新组件 |
| ~~MCP 工具扩展~~ | `core/mcp/definitions.ts`, `delivery.handler.ts` | ✅ 已添加 list_my_deliveries, get_delivery |

### 关联需求
- 相关需求：REQ-002（对话信道，审核通知）
- 依赖需求：无

### 技术债关联
- 无

---

## REQ-005: 任务自动推送 + AI 巡检兜底

**状态**：pending
**提出时间**：2026-02-26
**提出者**：Alex
**优先级**：P1

### 问题描述

当前心跳→任务推送机制不可靠：

1. **Cron Job 触发但 Agent 直接回复 OK**：
   - OpenClaw Cron Job 定时触发，发送消息给 Agent
   - Agent 收到消息后仅回复"OK"，没有实际检查和执行任务
   - 根因：Cron 的 `payload.message` 内容太简单，缺少结构化指令

2. **间接链路不可靠**：
   - 当前流程：心跳更新文件 → Cron 触发 → Agent 读文件 → 执行任务
   - 链路太长，任何一环失败都无法保证任务被执行
   - Agent 不一定会主动读取 TODO.md

3. **新建任务后无即时推送**：
   - 用户创建任务并分配给 AI 成员后，需要手动推送
   - 缺少"分配即推送"的自动化能力

### 功能目标

实现 **方案 A + 方案 C** 组合：

**方案 A：新建任务时自动推送（即时性）**
- 用户创建任务并分配给 AI 成员时，自动调用 `task-push` 模板生成完整指令
- 通过 Gateway `chat.send` 直接推送给对应 Agent
- 相当于自动化的"手动推送"，包含任务详情、执行流程、MCP 工具列表

**方案 C：AI 巡检 Cron 兜底（可靠性）**
- 利用 Projects 页面已有的"AI 巡检"功能
- `buildPatrolMessage` 生成结构化巡检指令：
  1. 调用 `list_tasks` 查看所有未完成任务
  2. 逐一检查进展
  3. 执行具体操作
  4. 生成巡检报告
- 定时巡检作为兜底，确保无遗漏

### 使用场景

#### 场景A：用户分配任务给 AI
1. 用户在任务面板创建任务，指派给 AI 成员
2. 系统自动检测指派对象是 AI 成员
3. 使用 task-push 模板生成完整指令（含任务详情、上下文、MCP 工具列表）
4. 通过 Gateway chat.send 推送给对应 Agent session
5. Agent 收到结构化指令，开始执行

#### 场景B：定时巡检兜底
1. Cron 定时触发 AI 巡检（如每 30 分钟）
2. buildPatrolMessage 生成结构化巡检指令
3. Agent 调用 list_tasks 获取未完成任务列表
4. 逐一检查进展，处理滞后任务
5. 生成巡检报告

#### 场景C：任务状态变更通知
1. 用户修改任务状态/优先级/截止时间
2. 如果任务已分配给 AI 成员，推送变更通知
3. Agent 根据变更调整执行策略

### 验收标准

**方案 A：自动推送**
- [ ] 创建任务时指派给 AI 成员，自动推送
- [ ] 推送内容使用 task-push 模板，包含完整上下文
- [ ] 支持通过 Gateway chat.send 推送到正确的 Agent session
- [ ] 推送失败有重试机制和错误提示
- [ ] 仅 AI 类型成员触发自动推送，人类成员不触发

**方案 C：巡检兜底**
- [ ] 利用已有的 buildPatrolMessage 生成巡检指令
- [ ] 巡检 Cron 可配置间隔
- [ ] 巡检报告记录到文档系统
- [ ] 巡检覆盖：未完成任务、逾期任务、交付审核状态

**集成层面**
- [ ] 与 server_proxy / browser_direct 双模式兼容
- [ ] 推送/巡检操作记录到日志

### 技术方案（待实现时填写）
- 关键组件：
- 实现文件：
- API 变更：

### 关联需求
- 相关需求：REQ-003（Gateway 服务端代理模式）、REQ-004（交付审核增强，巡检需覆盖交付状态）
- 依赖需求：REQ-003（自动推送依赖 Gateway 连接）

### 已有基础设施
- `skills/comind/references/task-push.md` — 任务推送模板
- `buildPatrolMessage` — 已有的巡检消息构建函数
- `lib/gateway-client.ts` / `lib/server-gateway-client.ts` — Gateway 通信
- `lib/openclaw/auto-sync-scheduler.ts` — 自动同步调度器

---

## REQ-006: Markdown 甘特图生成器

**状态**：pending
**提出时间**：2026-03-02
**提出者**：Alex
**优先级**：P2

### 问题描述

现有的甘特图导出功能（PNG/PDF）无法正常使用，且不符合项目需求。需要一个轻量级的解决方案，能够：
1. 一键生成可渲染的 Markdown 格式甘特图
2. 包含任务说明和统计表格
3. 生成的文档可以保存到 Wiki 或导出为 MD 文件

### 功能目标

实现 Markdown 甘特图生成器：
1. **一键生成**：在任务页面增加"生成甘特图"按钮
2. **Markdown 格式**：使用 Mermaid 语法生成甘特图
3. **完整报告**：包含甘特图、任务统计表、里程碑说明
4. **多用途输出**：
   - 直接保存为 Wiki 文档
   - 复制到剪贴板
   - 下载为 .md 文件

### 使用场景

1. **项目汇报**：快速生成项目进度报告，包含可视化甘特图和任务统计
2. **里程碑评审**：展示里程碑规划和完成情况
3. **团队协作**：将甘特图分享给团队成员或客户
4. **文档归档**：将项目进度快照保存到 Wiki

### 功能设计

#### 1. 生成的 Markdown 文档结构

```markdown
# 项目名称 - 甘特图报告

**生成时间**：2026-03-02 15:30
**项目周期**：2026-02-01 ~ 2026-03-31

## 📊 甘特图

\`\`\`mermaid
gantt
    title 项目进度甘特图
    dateFormat YYYY-MM-DD
    
    section 里程碑1：需求分析
    任务1-1 :done, 2026-02-01, 7d
    任务1-2 :active, 2026-02-08, 5d
    
    section 里程碑2：开发阶段
    任务2-1 : 2026-02-15, 10d
    任务2-2 : 2026-02-20, 8d
\`\`\`

## 📈 任务统计

| 状态 | 数量 | 占比 |
|------|------|------|
| 待办 | 5 | 25% |
| 进行中 | 8 | 40% |
| 审核中 | 3 | 15% |
| 已完成 | 4 | 20% |
| **总计** | **20** | **100%** |

## 🎯 里程碑概览

### 里程碑1：需求分析
- **状态**：已完成
- **截止时间**：2026-02-15
- **任务数量**：3 / 3 已完成
- **描述**：完成用户需求调研和产品原型设计

### 里程碑2：开发阶段
- **状态**：进行中
- **截止时间**：2026-03-10
- **任务数量**：2 / 8 已完成
- **描述**：核心功能开发和单元测试

---

*本报告由 CoMind 自动生成*
```

#### 2. 操作流程

1. 用户点击"生成甘特图"按钮
2. 弹出对话框，选择：
   - **输出方式**：保存到 Wiki / 复制到剪贴板 / 下载 .md 文件
   - **包含范围**：全部任务 / 当前筛选的任务
   - **时间范围**：全部 / 最近 30 天 / 自定义
3. 生成预览，用户确认后执行
4. 成功提示并提供快速访问链接

#### 3. 数据映射规则

**Mermaid 甘特图语法**：
- `section`：里程碑名称
- 任务条：任务名称 + 状态标记
  - `:done` — 已完成任务（绿色）
  - `:active` — 进行中任务（蓝色）
  - 无标记 — 待办任务（灰色）
- 时间：使用任务的 `startDate` 和 `dueDate`，若缺失则推算

**任务统计表**：
- 按 4 种状态分组统计
- 计算完成率和占比

**里程碑概览**：
- 显示里程碑名称、状态、截止时间
- 任务完成数量 / 总数量
- 里程碑描述

### 验收标准

- [ ] 在任务页面增加"生成甘特图"按钮（在视图切换按钮附近）
- [ ] 生成符合 Mermaid 语法的甘特图代码
- [ ] 包含任务统计表格（按状态分组）
- [ ] 包含里程碑概览列表
- [ ] 支持保存到 Wiki（调用文档 API）
- [ ] 支持复制到剪贴板（带成功提示）
- [ ] 支持下载为 .md 文件
- [ ] 生成预览功能（对话框中预览 Markdown 渲染效果）
- [ ] 处理边界情况：
  - 无任务时的提示
  - 无里程碑时的简化输出
  - 缺少时间字段的任务处理

### 技术方案（待实现时填写）

**关键组件**：
- `components/GanttMarkdownGenerator.tsx` — 生成器 UI 组件
- `lib/gantt-markdown.ts` — Markdown 生成逻辑
- `app/api/gantt/route.ts` — 生成 API（可选，如需服务端处理）

**实现文件**：
- 新增：`components/GanttMarkdownGenerator.tsx`
- 新增：`lib/gantt-markdown.ts`
- 修改：`app/tasks/page.tsx`（添加按钮）

**依赖库**：
- 无需新增第三方库，使用原生 JavaScript 字符串拼接
- Mermaid 渲染由 Wiki 页面或 Markdown 查看器处理

**API 变更**：
- 可选：`POST /api/gantt` — 服务端生成并返回 Markdown 内容
- 或直接在前端生成（推荐，减少 API 调用）

### 关联需求
- 相关需求：REQ-001（标准化开发流程，输出到文档系统）
- 依赖需求：无

---

## REQ-007: SOP 引擎核心

**状态**：completed
**提出时间**：2026-03-03
**提出者**：Alex
**优先级**：P0

### 问题描述

AI Agent 执行复杂任务时缺乏标准化流程控制，需要 SOP（标准化操作流程）引擎实现多阶段工作流的自动推进、人工确认、状态追踪。

### 功能目标

1. 7 种阶段类型：input/ai_auto/ai_with_confirm/manual/render/export/review
2. 7 种阶段状态：pending/active/waiting_input/waiting_confirm/completed/skipped/rejected
3. SOP 模板 CRUD + 5 个内置模板
4. 任务绑定 SOP 模板后自动推进
5. MCP 工具支持 AI 操作 SOP 流程
6. 前端 SOP 进度条 + 操作按钮

### 验收标准
- [x] SOP 模板 CRUD API（sop-templates）
- [x] SOP 阶段推进 API（sop-advance）
- [x] 9 个 SOP MCP 工具定义 + handler + executor
- [x] SOPProgressBar 组件（compact/expanded）
- [x] SOPTemplateEditor 组件（含拖拽排序）
- [x] TaskDrawer SOP 面板集成
- [x] 任务创建时 SOP 模板选择
- [x] SOP 推送模板（sop-task-push.md）
- [x] SSE sop_confirm_request 事件
- [x] Input Stage 表单 UI

### 技术方案
- DB Schema：sop_templates 表 + tasks 表 SOP 字段扩展
- API：`/api/sop-templates`、`/api/tasks/[id]/sop-advance`
- MCP：9 个工具（advance/confirm/context/save/knowledge/create_sop/update_sop/create_render/update_render）
- Store：sop-template.store.ts
- 组件：SOPProgressBar、SOPTemplateEditor、SOPDebugPanel

---

## REQ-008: 渲染模板系统

**状态**：completed
**提出时间**：2026-03-03
**提出者**：Alex
**优先级**：P1

### 问题描述

SOP render 阶段需要创建可视化文档，需要渲染模板系统管理 HTML 模板、Slots、Sections。

### 功能目标

1. 渲染模板 CRUD + 4 个内置模板
2. SOP render 阶段自动创建 visual 文档
3. Content Studio 集成
4. SOP 页面渲染模板标签页

### 验收标准
- [x] 渲染模板 CRUD API（render-templates）
- [x] render-template.store.ts
- [x] SOP 页面渲染模板标签页（列表/详情/Slots/Sections/HTML 预览）
- [x] SOP render 阶段自动创建 visual 文档
- [x] SOPTemplateEditor render 阶段渲染模板选择器

### 技术方案
- DB Schema：render_templates 表
- API：`/api/render-templates`
- Store：render-template.store.ts

---

## REQ-009: Know-how 分层知识库

**状态**：completed
**提出时间**：2026-03-03
**提出者**：Alex
**优先级**：P1

### 问题描述

SOP 执行需要知识库支撑，需要 L1-L5 分层知识结构和智能追加机制。

### 功能目标

1. L1-L5 五层知识解析（概述/核心知识/工具方法/经验教训/统计）
2. 智能 L4 追加（自动定位经验层追加新条目）
3. SOP 推送时按阶段 knowledgeLayers 提取分层知识
4. get_sop_context 返回分层知识（节省 40-60% context）

### 验收标准
- [x] knowhow-parser.ts（parseKnowHow/extractLayers/appendToL4/estimateTokens）
- [x] SOP 推送集成知识库
- [x] get_sop_context MCP 返回分层知识
- [x] update_knowledge MCP 智能 L4 追加

### 技术方案
- 核心文件：lib/knowhow-parser.ts
- 集成：task-push/route.ts、sop.handler.ts

---

## REQ-010: SOP 模板导入导出

**状态**：completed
**提出时间**：2026-03-03
**提出者**：Alex
**优先级**：P1

### 问题描述

SOP 模板需要在不同环境间共享和迁移。

### 功能目标

1. 导出：脱 DB 字段 + 元数据
2. 导入：格式校验 + ID 重生成 + rollbackStageId 映射 + draft 状态
3. SOP 页面导入/导出按钮

### 验收标准
- [x] 导出 API（/api/sop-templates/[id]/export）
- [x] 导入 API（/api/sop-templates/import）
- [x] SOP 页面导入/导出 UI

### 技术方案
- API：`/api/sop-templates/[id]/export`、`/api/sop-templates/import`
