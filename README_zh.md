**中文 | [English](./README.md)**

# CoMind

**把 AI 当队友，而不是工具。**

CoMind 是一个开源的人机协作平台，让 AI Agent 像真正的团队成员一样参与项目管理——接任务、写文档、提交交付、汇报进度。

> 当前版本：v2.4.0

---

## 解决什么问题？

现有的 AI 工具大多是"对话框模式"——你问一句，它答一句。但真实的团队协作远不止于此：

| 痛点 | CoMind 的解法 |
|------|--------------|
| **AI 不知道项目上下文** | AI 成员自动获取项目、任务、文档的完整上下文 |
| **AI 产出无法追踪** | 文档交付中心 + 审核流程，产出有迹可循 |
| **任务分配靠口头沟通** | 任务看板直接推送给 AI，自动开始执行 |
| **AI 状态不透明** | 实时状态面板：idle / working / waiting，一眼看清 |
| **多 Agent 协调困难** | 统一的 Agent 管理 + 会话管理 + 定时调度 |
| **文档和代码不同步** | Markdown 双向同步，本地编辑自动上云 |

## 核心特性

### 🎯 任务驱动的人机协作

任务看板不只是给人看的——AI 成员能接收任务推送，自动更新状态，提交检查项，记录操作日志。支持泳道分组、四列状态流转、拖拽排序、里程碑管理。

### 📄 文档交付与审核

AI 写的文档不应该石沉大海。交付中心提供完整的提交→审核→修改→通过流程，每份产出都经过人类审核确认。

### 💬 多模式对话

三种交互通道并行：
- **对话信道**：自然语言 + 嵌入式 Actions 指令
- **MCP 工具**：28 个标准化接口，覆盖任务/文档/项目/状态等全场景
- **Markdown 同步**：本地 `.md` 文件自动同步为任务、交付物、定时计划

### 🔗 OpenClaw Gateway 深度集成

作为 [OpenClaw Gateway](https://github.com/nicepkg/openclaw) 的增强型前端，提供 Agent 管理、会话管理、技能市场、定时调度的可视化操作界面。

### 📊 知识图谱 Wiki

双向链接文档系统，自动建立关联网络，可视化知识图谱。支持 `[[文档名]]` 引用、反向链接追踪、多项目标签。

### 🌐 完整国际化

中英文全覆盖，所有界面文本通过 i18n 管理。

## 功能概览

| 模块 | 说明 |
|------|------|
| **工作台** | 系统概览、Gateway 连接管理、快速操作 |
| **任务看板** | 泳道+四列看板、拖拽排序、里程碑管理 |
| **项目管理** | 项目 CRUD、成员分配、进度追踪 |
| **文档 Wiki** | 双向链接、知识图谱、多类型文档 |
| **Agent 管理** | 多 Agent 模式、状态监控、文件管理 |
| **会话管理** | 会话参数配置、Token 统计 |
| **技能市场** | 技能启用/安装/配置 |
| **定时任务** | 可视化调度、Cron 表达式、执行历史 |
| **文档交付** | 提交审核流程、版本管理 |
| **成员管理** | 人类/AI 成员、AI 自注册 |
| **聊天面板** | 浮动面板、多模式对话、MCP 指令 |
| **OpenClaw 同步** | Markdown 双向同步、版本历史、冲突处理 |

## 快速开始

### 前置条件

- **Node.js** 18+
- **OpenClaw Gateway**（可选，Agent 功能依赖；本地任务/文档/Wiki 功能无需 Gateway）

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/dqalex/Comind.git
cd Comind

# 安装依赖
npm install

# 配置环境变量（可选）
cp .env.example .env.local

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

### 连接 Gateway

1. 启动 [OpenClaw Gateway](https://github.com/nicepkg/openclaw)（默认 `ws://localhost:18789`）
2. 打开 CoMind → 设置 → Gateway 配置，填入地址和 Token
3. 连接成功后，Agent/会话/技能/定时任务功能自动激活

### 环境变量

#### 基础配置

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `NEXT_PUBLIC_BASE_URL` | ✅ | 应用基础 URL | `http://localhost:3000` |
| `NEXT_PUBLIC_GATEWAY_URL` | ❌ | Gateway WebSocket 地址 | `ws://localhost:18789` |
| `COMIND_API_TOKEN` | ❌ | MCP External API 认证 Token | — |
| `TOKEN_ENCRYPTION_KEY` | ❌ | Token 加密密钥（建议 32+ 字符） | — |
| `COMIND_DB_PATH` | ❌ | 数据库路径 | 自动检测 |

#### 新部署自动配置

以下环境变量支持首次部署时自动配置：

**Gateway 自动配置：**

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENCLAW_DEFAULT_ENDPOINT` | ❌ | Gateway WebSocket URL（如 `ws://127.0.0.1:18789`） |
| `OPENCLAW_TOKEN` | ❌ | Gateway 认证 Token |
| `GATEWAY_MODE` | ❌ | 连接模式：`server_proxy` 或 `browser_direct` |

**工作区自动配置：**

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `OPENCLAW_WORKSPACE_PATH` | ❌ | 工作区目录路径 | — |
| `OPENCLAW_WORKSPACE_NAME` | ❌ | 工作区显示名称 | `Default Workspace` |
| `OPENCLAW_WORKSPACE_MEMBER_ID` | ❌ | 关联的 AI 成员 ID | `null`（未绑定） |
| `OPENCLAW_WORKSPACE_SYNC_INTERVAL` | ❌ | 同步间隔（秒） | `120` |

**新部署 `.env` 示例：**

```bash
# Gateway 自动配置
OPENCLAW_DEFAULT_ENDPOINT=ws://127.0.0.1:18789
OPENCLAW_TOKEN=your-gateway-token-here
GATEWAY_MODE=server_proxy

# 工作区自动配置
OPENCLAW_WORKSPACE_PATH=/root/workspace
OPENCLAW_WORKSPACE_NAME=默认工作区
OPENCLAW_WORKSPACE_SYNC_INTERVAL=120
```

> **注意：** `OPENCLAW_DEFAULT_ENDPOINT` 必须使用 `ws://` 或 `wss://` 协议。如果误用了 `http://` 或 `https://`，首次启动时会自动修正。

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) |
| 语言 | TypeScript (strict mode) |
| UI | Tailwind CSS + shadcn/ui |
| 状态管理 | Zustand |
| 数据库 | SQLite + Drizzle ORM |
| 实时通信 | WebSocket (OpenClaw Protocol v3) + SSE |
| 国际化 | react-i18next |

## 项目结构

```
comind/
├── app/                  # Next.js 页面 + API 路由
├── components/           # UI 组件（30+）
├── core/mcp/             # MCP 指令解析与执行
├── db/                   # SQLite Schema + 连接
├── lib/                  # 核心库（Gateway 客户端、数据服务、事件总线等）
├── store/                # Zustand Store（14 个）
├── hooks/                # 自定义 Hooks
├── skills/               # AI Skill 文档与模板
├── docs/                 # 项目文档
└── scripts/              # 部署与工具脚本
```

## 文档

| 文档 | 说明 |
|------|------|
| [使用手册](docs/product/USER_GUIDE.md) | 完整功能介绍与操作指南 |
| [开发者手册](docs/technical/DEVELOPMENT.md) | 架构设计、模块说明、开发指南 |
| [API 文档](docs/technical/API.md) | REST API 参考 |
| [变更日志](docs/process/CHANGELOG.md) | 版本更新记录 |

## License

MIT
