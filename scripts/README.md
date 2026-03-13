# TeamClaw 脚本工具集

本目录包含 TeamClaw 项目的各种自动化脚本工具，用于部署、数据库管理、诊断和导入导出等任务。

---

## 脚本列表

### 🔄 开发脚本

#### `restart-dev.sh`
**开发服务器重启脚本**

一键执行标准 4 步重启流程：
1. 关闭开发服务器
2. 清理构建缓存
3. 重新构建
4. 启动开发服务器

**用法:**
```bash
./scripts/restart-dev.sh
```

**适用场景:**
- 安装新依赖后
- 修改数据库 schema 后
- 添加/删除 API 路由后
- 遇到构建缓存问题

---

### 🚀 部署脚本

#### `deploy.sh`
**TeamClaw 生产部署脚本**

完整的 6 步部署流程：
1. 本地构建
2. 同步文件到服务器（排除敏感数据）
3. 服务器端构建
4. 复制静态文件到 standalone
5. 复制外部依赖（chokidar 等）
6. 重启 PM2 服务

**用法:**
```bash
# 设置环境变量
export DEPLOY_SERVER="user@your-server"
export DEPLOY_PATH="/opt/teamclaw"
export DEPLOY_NVM_DIR="/root/.nvm"  # 可选

# 完整部署
./scripts/deploy.sh

# 跳过本地构建（已构建过时）
./scripts/deploy.sh --skip-build
```

**环境变量:**
| 变量 | 必需 | 说明 |
|------|------|------|
| `DEPLOY_SERVER` | ✅ | 服务器地址（如 `root@43.167.204.230`） |
| `DEPLOY_PATH` | ❌ | 远程部署路径（默认 `/root/teamclaw`） |
| `DEPLOY_NVM_DIR` | ❌ | 服务器 nvm 目录（如 `/root/.nvm`） |

---

### 🗄️ 数据库脚本

#### `init-db.ts`
**初始化数据库创建脚本**

创建包含内置文档和模板的初始化数据库，用于首次部署或发布。

**用法:**
```bash
npx tsx scripts/init-db.ts
```

**输出:**
- `data/init/teamclaw-init.db` - 初始化数据库文件

**包含内容:**
- 3 个内置文档（用户使用手册、开发者手册、API 文档）
- 内置 SOP 模板
- 内置渲染模板
- 完整的数据库表结构

**注意:** v3.0 起不再预置默认用户，用户通过 `/login` 页面注册。

---

#### `add-indexes.ts`
**数据库索引优化脚本**

为高频查询字段添加索引，提升查询性能。

**用法:**
```bash
npx tsx scripts/add-indexes.ts
```

**功能:**
- 自动检测并跳过已存在的索引
- 为所有主要表添加常用字段索引
- 执行 `ANALYZE` 更新统计信息
- 显示当前所有索引列表

**覆盖表:** tasks、documents、members、chat_sessions、deliveries、scheduled_tasks、milestones、sop_templates 等

---

### 🔄 同步脚本

#### `sync-landing.ts`
**Landing Page 内容同步脚本**

将 `docs/landing/` 目录下的 MD 文件同步到数据库，用于首页内容管理。

**用法:**
```bash
npx tsx scripts/sync-landing.ts
```

**输入文件:**
- `docs/landing/landing-en.md` - 英文首页内容
- `docs/landing/landing-zh.md` - 中文首页内容

**数据库表:** `landing_pages`

---

#### `import-wiki-docs.ts`
**Wiki 文档导入脚本**

将项目文档导入为 Wiki 文档，方便在应用中查看。

**用法:**
```bash
npx tsx scripts/import-wiki-docs.ts
```

**导入文档:**
- 用户使用手册 (`docs/product/USER_GUIDE.md`)
- 开发者手册 (`docs/technical/DEVELOPMENT.md`)
- API 文档 (`docs/technical/API.md`)

---

### 🔍 诊断脚本

#### `diagnose.ts`
**项目诊断脚本**

自动检测项目问题并生成优化建议报告。

**用法:**
```bash
npx tsx scripts/diagnose.ts
```

**检查项:**
| 优先级 | 检查内容 |
|--------|----------|
| P0 | TypeScript 类型错误、ESLint 错误、安全漏洞 |
| P1 | 测试失败率、P1 级技术债 |
| P2 | 文件行数超标（>800行）、useMemo 缺失 |
| P3 | i18n 命名空间未指定 |

**输出:**
- `logs/diagnostic-report.md` - 诊断报告
- `logs/optimization-loop.log` - 优化循环日志

---

## 常用工作流

### 首次部署
```bash
# 1. 创建初始化数据库
npx tsx scripts/init-db.ts

# 2. 部署到服务器
export DEPLOY_SERVER="root@your-server"
./scripts/deploy.sh
```

### 日常开发
```bash
# 重启开发服务器（清理缓存并重新构建）
./scripts/restart-dev.sh

# 同步 landing page 内容修改
npx tsx scripts/sync-landing.ts

# 导入最新文档到 wiki
npx tsx scripts/import-wiki-docs.ts

# 运行诊断检查
npx tsx scripts/diagnose.ts
```

### 性能优化
```bash
# 添加数据库索引
npx tsx scripts/add-indexes.ts

# 检查项目健康状态
npx tsx scripts/diagnose.ts
```

---

## 环境要求

所有 TypeScript 脚本需要:
- Node.js 18+
- `tsx` 包 (`npm install -g tsx`)
- 项目依赖已安装 (`npm install`)

`restart-dev.sh` 需要:
- Bash 环境
- 项目已安装依赖 (`npm install`)

`deploy.sh` 需要:
- Bash 环境
- `rsync` 命令
- SSH 免密登录配置
- 服务器上已安装 PM2

---

## 注意事项

1. **生产部署**必须使用 `deploy.sh`，禁止手动执行构建命令
2. **数据库脚本**执行前请备份重要数据
3. **诊断脚本**可能会修改 `logs/` 目录下的文件
4. 所有脚本应在项目根目录下执行