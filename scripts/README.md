# TeamClaw 脚本工具集

本目录包含 TeamClaw 项目的各种自动化脚本工具，按用途分类存放。

---

## 📁 目录结构

```
scripts/
├── README.md              # 本文件
├── db/                    # 数据库脚本
├── deploy/                # 部署脚本
├── dev/                   # 开发工具
├── diagnostics/           # 诊断/审计
├── generate/              # 数据/文档生成
├── import/                # 数据导入/同步
├── mock-gateway/          # Mock Gateway
└── testing/               # 测试脚本
```

---

## 🗄️ Database (`db/`)

| 脚本 | 说明 |
|------|------|
| `init-db.ts` | 创建初始化数据库（含内置文档+模板） |
| `add-indexes.ts` | 高频查询字段添加索引 |
| `seed-templates.ts` | 插入内置 SOP/渲染模板 |
| `update-init-db.ts` | 更新初始化 DB 中的模板 |
| `reset-admin-password.ts` | 重置用户密码 |

```bash
npx tsx scripts/db/init-db.ts
```

---

## 🚀 Deploy (`deploy/`)

| 脚本 | 说明 |
|------|------|
| `deploy.sh` | 生产环境 6 步部署（**唯一合法部署方式**） |

```bash
export DEPLOY_SERVER="root@your-server"
./scripts/deploy/deploy.sh
```

---

## 🔄 Development (`dev/`)

| 脚本 | 说明 |
|------|------|
| `restart-dev.sh` | 开发服务器重启（kill+清缓存+启动） |
| `fix-imports.js` | 修复 API route 的 schema 导入路径 |

```bash
./scripts/dev/restart-dev.sh
```

---

## 🔍 Diagnostics (`diagnostics/`)

| 脚本 | 说明 |
|------|------|
| `diagnose.ts` | 项目健康诊断（P0-P3 级检查） |
| `check-i18n.ts` | i18n 翻译完整性检查 |
| `audit-test-coverage.ts` | 测试覆盖率审计矩阵 |

```bash
npx tsx scripts/diagnostics/diagnose.ts
npx tsx scripts/diagnostics/check-i18n.ts --fix
```

---

## 📝 Generate (`generate/`)

| 脚本 | 说明 |
|------|------|
| `generate-architecture-docs-v2.ts` | 生成架构文档 HTML |
| `generate-demo-data.ts` | 生成演示数据 |
| `generate-screenshots.ts` | 截图生成入口 |
| `run-screenshots.ts` | Playwright 执行截图 |

```bash
npx tsx scripts/generate/generate-demo-data.ts
```

---

## 📥 Import (`import/`)

| 脚本 | 说明 |
|------|------|
| `import-wiki-docs.ts` | 导入项目文档为 Wiki |
| `sync-landing.ts` | 同步 Landing Page 内容 |
| `update-landing-screenshots.ts` | 更新 Landing 截图引用 |

```bash
npx tsx scripts/import/sync-landing.ts
```

---

## 🌐 Mock Gateway (`mock-gateway/`)

| 脚本 | 说明 |
|------|------|
| `mock-gateway.ts` | Mock OpenClaw Gateway 服务器 |
| `init-mock-gateway-config.ts` | 初始化数据库配置 |
| `clear-gateway-config.ts` | 清除 Gateway 配置 |

```bash
npm run mock:gateway  # 或: npx tsx scripts/mock-gateway/mock-gateway.ts
```

---

## 🧪 Testing (`testing/`)

| 脚本 | 说明 |
|------|------|
| `test-task-push.ts` | 任务推送测试 |
| `test-chat-integration.ts` | 聊天集成测试 |
| `test-e2e-flow.ts` | 端到端流程测试 |
| `test-full-automation.ts` | 全自动化测试 |
| `test-sse-receive.ts` | SSE 接收测试 |
| `test-sse.sh` | SSE 测试脚本 |
| `test-skillhub-api.ts` | SkillHub API 测试（遗留） |
| `test-teamclaw-service.ts` | TeamClaw 服务测试 |
| `test-teamclaw-e2e.ts` | E2E 测试 |

```bash
npx tsx scripts/testing/test-e2e-flow.ts
```

---

## 常用工作流

### 首次部署
```bash
npx tsx scripts/db/init-db.ts
export DEPLOY_SERVER="root@your-server"
./scripts/deploy/deploy.sh
```

### 日常开发
```bash
./scripts/dev/restart-dev.sh
npm run mock:gateway  # 另一个终端
npx tsx scripts/diagnostics/diagnose.ts
```

### 本地测试（Mock Gateway）
```bash
# 终端 1: 启动 Mock Gateway
npm run mock:gateway

# 终端 2: 启动 TeamClaw
npm run dev

# 测试任务推送
npx tsx scripts/testing/test-task-push.ts
```

---

## 环境要求

- **TypeScript 脚本**: Node.js 18+, `tsx`
- **Shell 脚本**: Bash, `rsync`, SSH 免密登录
- **截图脚本**: Playwright (`npx playwright install`)

---

*更新日期: 2026-03-15*
