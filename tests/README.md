# TeamClaw 测试框架

## 测试目录结构

```
tests/
├── e2e/                          # E2E 端到端测试
│   ├── pages/                    # Page Object 模型
│   │   └── AuthHelper.ts         # 认证辅助工具
│   ├── auth.spec.ts              # 认证测试
│   ├── tasks.spec.ts             # 任务基础测试
│   ├── projects.spec.ts          # 项目基础测试
│   ├── wiki.spec.ts              # Wiki 测试
│   ├── members.spec.ts           # 成员测试
│   ├── navigation.spec.ts        # 导航测试
│   ├── dashboard.spec.ts         # 仪表盘测试
│   ├── settings.spec.ts          # 设置测试
│   ├── agents.spec.ts            # Agent 测试
│   ├── sessions.spec.ts          # 会话测试
│   ├── skills.spec.ts            # 技能测试
│   ├── sop.spec.ts               # SOP 测试
│   ├── schedule.spec.ts          # 定时任务测试
│   ├── deliveries.spec.ts        # 投递测试
│   ├── task-lifecycle.spec.ts    # 任务生命周期测试
│   ├── document-workflow.spec.ts # 文档工作流测试
│   ├── delivery-workflow.spec.ts # 投递工作流测试
│   ├── project-collaboration.spec.ts # 项目协作测试
│   └── multi-user-permissions.spec.ts # 多用户权限测试
│
├── stress/                       # 压力测试
│   └── stress-test.spec.ts       # 压力测试套件
│
├── security/                     # 安全测试
│   └── security-test.spec.ts     # 安全测试套件
│
├── unit/                         # 单元测试
│   ├── validators.test.ts        # 验证器测试
│   ├── security.test.ts          # 安全工具测试
│   ├── utils.test.ts             # 工具函数测试
│   ├── event-bus.test.ts         # 事件总线测试
│   ├── data-service.test.ts      # 数据服务测试
│   ├── rate-limit.test.ts        # 限流测试
│   ├── template-engine.test.ts   # 模板引擎测试
│   ├── api-errors.test.ts        # API 错误测试
│   ├── id.test.ts                # ID 生成测试
│   └── doc-templates-and-mcp.test.ts # 文档模板测试
│
├── integration/                  # 集成测试
│   ├── auth-permission.test.ts   # 认证权限测试
│   ├── task-api.test.ts          # 任务 API 测试
│   ├── project-api.test.ts       # 项目 API 测试
│   ├── document-api.test.ts      # 文档 API 测试
│   ├── chat-channel.test.ts      # 聊天信道测试
│   └── sop-flow.test.ts          # SOP 流程测试
│
├── helpers/                      # 测试辅助工具
│   ├── report-generator.ts       # 报告生成器
│   ├── auth-helper.ts            # 认证辅助
│   └── test-fixture.ts           # 测试数据工厂
│
├── scripts/                      # 测试脚本
│   └── run-all-tests.sh          # 标准测试流程脚本
│
├── reports/                      # 测试报告
│   ├── e2e-report-*.md           # E2E 测试报告
│   ├── stress-test-report-*.md   # 压力测试报告
│   ├── security-test-report-*.md # 安全测试报告
│   └── playwright-report/        # Playwright HTML 报告
│
├── __mocks__/                    # Mock 文件
├── req/                          # 需求文档
├── e2e-report-generator.ts       # E2E 报告生成脚本
├── README.md                     # 本文件
└── TEST_REPORT.md                # 测试报告摘要
```

## 测试命令

### 运行测试

```bash
# 运行所有测试
npm run test:all

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 运行压力测试
npm run test:stress

# 运行安全测试
npm run test:security

# 生成测试覆盖率报告
npm run test:coverage

# 查看 E2E 测试报告
npm run test:e2e:report
```

### 测试流程

标准测试流程由 `tests/scripts/run-all-tests.sh` 脚本执行：

1. **关闭所有开发服务器** - 确保干净的测试环境
2. **清除缓存** - 删除 .next、node_modules/.cache 等
3. **代码构建** - 执行 `npm run build`
4. **启动开发服务器** - 后台启动 `npm run dev`
5. **开始测试** - 按顺序执行各类测试
6. **生成报告** - 将报告保存到 `tests/reports/`

### 手动执行测试

```bash
# 手动执行完整测试流程
bash tests/scripts/run-all-tests.sh all

# 只执行 E2E 测试
bash tests/scripts/run-all-tests.sh e2e

# 只执行压力测试
bash tests/scripts/run-all-tests.sh stress

# 只执行安全测试
bash tests/scripts/run-all-tests.sh security
```

## 测试配置文件

| 文件 | 用途 |
|------|------|
| `playwright.config.ts` | E2E 测试配置 |
| `playwright.stress.config.ts` | 压力测试配置 |
| `playwright.security.config.ts` | 安全测试配置 |
| `vitest.config.ts` | 单元/集成测试配置 |

## 测试报告说明

### E2E 测试报告

- **位置**: `tests/reports/e2e-report-*.md`
- **内容**: 测试通过率、失败详情、优化建议

### 压力测试报告

- **位置**: `tests/reports/stress-test-report-*.md`
- **内容**: 并发性能、响应时间、RPS、系统资源

### 安全测试报告

- **位置**: `tests/reports/security-test-report-*.md`
- **内容**: 漏洞详情、安全合规检查、修复建议

## 测试覆盖模块

| 模块 | 单元测试 | 集成测试 | E2E 测试 | 压力测试 | 安全测试 |
|------|---------|---------|---------|---------|---------|
| 认证系统 | - | ✅ | ✅ | - | ✅ |
| 任务管理 | - | ⚠️ | ✅ | ✅ | ✅ |
| 项目管理 | - | ⚠️ | ✅ | - | ✅ |
| 文档管理 | - | ⚠️ | ✅ | ✅ | - |
| 成员管理 | - | - | ✅ | - | ✅ |
| Wiki | - | - | ✅ | - | - |
| 聊天信道 | - | ✅ | - | ✅ | - |
| SOP 流程 | - | ✅ | ✅ | - | - |
| 投递管理 | - | - | ✅ | - | - |
| 权限控制 | - | - | ✅ | - | ✅ |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PLAYWRIGHT_TEST` | 标识测试环境，跳过限流 | `true` |
| `TEST_TARGET` | 测试目标 (`local`/`remote`) | `local` |
| `BASE_URL` | 测试基础 URL | `http://localhost:3000` |

## 注意事项

1. **Cookie 问题**: 使用 `page.evaluate` + `fetch` 代替 `page.request` 来确保 Cookie 携带
2. **location.origin**: 在 `page.evaluate` 前先 `page.goto('/')` 确保 `window.location.origin` 可用
3. **限流**: 测试环境自动跳过限流（`PLAYWRIGHT_TEST=true`）
4. **并发**: E2E 测试限制 2 并发，压力测试允许 4 并发
5. **超时**: E2E 测试默认 60s 超时，压力测试 120s 超时

## 持续集成

测试脚本支持 CI 环境：

```bash
# CI 环境运行
CI=true npm run test:all

# 生成覆盖率报告
npm run test:coverage
```

---

*TeamClaw 测试框架 v3.0*
