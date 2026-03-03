# OpenClaw × CoMind 协作规范（完整版）

> **读者**：CoMind 开发者
> 本文档包含完整技术细节，供开发者实现和维护 OpenClaw 集成时参考。
> OpenClaw Agent 端使用同目录下的 [`CLAUDE.md`](./CLAUDE.md) 精简约束版。

---

## 1. 实体映射

| OpenClaw | CoMind 表 | 必填字段 |
|----------|----------|---------|
| 项目名 | projects | name |
| 任务 | tasks | title, projectId, assignees |
| 文档 | documents | title, content, type |
| 成员 | members | name, type |
| 交付物 | deliveries | documentId, memberId |

---

## 2. ID 与索引

### 2.1 ID 生成

**ID 由 CoMind 统一生成**（Base58，~11字符）。OpenClaw 无需填写。

| 实体 | ID 格式 | 示例 |
|------|--------|------|
| Document | Base58 | `2k3j4h5g6d7s` |
| Task | Base58 | `a8b9c0d1e2f3` |
| Member | 带前缀 | `user_001`, `agent_openclaw` |

### 2.2 索引文件 `.comind-index`

```yaml
version: 1.0.0
workspace_id: ws_abc123

heartbeat:
  status: active              # active | inactive | offline
  last_heartbeat: 2026-02-18T10:00:00Z
  interval: 120               # 秒

instances:
  inst_001:
    name: MacBook Pro
    is_primary: true          # 主实例可写
    last_heartbeat: 2026-02-18T10:00:00Z

sync:
  mode: auto_sync
  last_sync: 2026-02-18T10:00:00Z

files:
  documents/reports/报告.md:
    id: 2k3j4h5g6d7s
    hash: abc123
    version: 2
```

### 2.3 心跳机制

- 间隔：120 秒（低配 180 秒）
- 超时：连续缺失 2 次判定 inactive
- 多实例：`is_primary: true` 可写，其他只读
- 竞争：按启动时间，先启动优先

### 2.4 离线缓存

`.comind-pending` 文件：
```yaml
pending_changes:
  - type: create
    path: documents/新文档.md
    hash: abc123
```

---

## 3. 同步模式

| 模式 | 触发条件 | 说明 |
|------|---------|------|
| init | 索引不存在 | 首次同步 |
| auto_sync | 心跳 active | 目录自动监听 |
| api | 用户配置 | API 连接 |
| mcp | 用户配置 | MCP 连接 |
| offline | 心跳超时 | 本地缓存 |

**判断流程**：
```
索引存在？
├─ NO → init
└─ YES → 心跳 active？
         ├─ NO → offline
         └─ YES → 使用配置模式
```

---

## 4. Front Matter

### 4.1 必填

```yaml
title: 文档标题
type: report | note | decision | task_output
project: comind-v2
created: 2026-02-18T10:00:00Z
updated: 2026-02-18T10:00:00Z
version: 1.0.0
```

### 4.2 可选

```yaml
tags: [标签]
contains_tasks: true
task_assignees: [user_001]
related_tasks: [task_abc]
is_delivery: true
```

### 4.3 交付相关字段

当文档需要审核时，可添加以下字段：

```yaml
---
title: 技术方案
type: decision
project: comind-v2
created: 2026-02-22T10:00:00Z
updated: 2026-02-22T10:00:00Z

# 交付字段（有 delivery_status 即视为交付物）
delivery_status: pending              # pending | approved | rejected | revision_needed
delivery_assignee: AI成员名           # 交付者
delivery_platform: local              # local | tencent-doc | feishu | notion | other
delivery_version: 1                   # 版本号
related_tasks: [task_xxx]             # 关联任务 ID 列表

# 以下字段由审核人填写
delivery_reviewer: 人类成员名         # 审核人
delivery_comment: 审核意见            # 审核意见
---
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `delivery_status` | ✅ 有即交付 | 存在此字段即视为交付物 |
| `delivery_assignee` | ✅ | 交付者成员名 |
| `delivery_platform` | ❌ | 默认 `local` |
| `delivery_version` | ❌ | 默认 `1` |
| `related_tasks` | ❌ | 关联任务 ID 列表 |
| `delivery_reviewer` | ❌ | 审核人（用户批复时填写） |
| `delivery_comment` | ❌ | 审核意见（用户批复时填写） |

**状态流转**：
```
pending → approved（已通过）→ 任务可 completed
        → rejected（已驳回）
        → revision_needed（需修改）
```

---

## 5. 任务识别

### 5.1 状态

| 语法 | 状态 | 优先级 |
|------|------|--------|
| `- [ ]` | todo | medium |
| `- [~]` | in_progress | medium |
| `- [!]` | todo | high |
| `- [?]` | reviewing | medium |
| `- [x]` | completed | - |
| `- [-]` | todo | low |

### 5.2 分配

```markdown
- [ ] 任务 @张三        # 分配给张三
- [!] 紧急任务 @agent_001  # 分配给 AI
```

---

## 6. 文档链接

### 6.1 双向链接

```markdown
参见 [[需求文档]]        # 标题匹配
详见 [[技术方案-v2]]     # 支持模糊匹配
```

### 6.2 任务引用

```markdown
关联任务 #task_abc123
对应任务 #任务标题
```

### 6.3 Web 链接

```
https://comind.app/doc/{id}
https://comind.app/task/{id}
```

---

## 7. 目录结构

```
~/.openclaw/workspace/
├── CLAUDE.md              # 约束文件
├── .comind-index          # 索引（CoMind 维护）
├── .comind-pending        # 离线缓存
├── documents/
│   ├── reports/
│   ├── notes/
│   └── task-outputs/
└── projects/
    └── {project-name}/
```

---

## 8. 文档模板

### 8.1 报告

```markdown
---
title: 竞品分析报告
type: report
project: comind-v2
created: 2026-02-18T10:00:00Z
updated: 2026-02-18T10:00:00Z
version: 1.0.0
tags: [竞品分析]
---

# 竞品分析报告

## 概述
> 背景

## 任务清单
- [ ] 整理资料
- [!] 补充数据 @张三

## 相关文档
- [[产品定位]]
```

### 8.2 任务产出

```markdown
---
title: 需求文档
type: task_output
project: comind-v2
created: 2026-02-18T10:00:00Z
updated: 2026-02-18T10:00:00Z
version: 1.0.0
related_tasks: [task_abc123]
---

# 需求文档

## 背景
> 需求背景

## 验收标准
- [ ] 功能测试通过
- [ ] 文档更新完成
```

---

## 9. 性能配置

| 配置项 | 低配 | 正常 |
|-------|------|------|
| 心跳间隔 | 180s | 120s |
| 同步防抖 | 2s | 1s |
| 批量大小 | 10 | 20 |
| 大文件哈希 | 采样 64KB | 完整 |

---

## 10. Markdown 代码块规范

### 10.1 围栏代码块语法

使用三个或更多反引号 `` ` `` 包裹代码块：

````markdown
```bash
echo "hello"
```
````

- 开头的反引号后可跟语言标识符（如 `bash`、`typescript`），用于语法高亮
- 语言标识符是可选的

### 10.2 嵌套代码块处理

**Markdown 标准（CommonMark/GFM）不支持嵌套围栏代码块**。解析器遇到第二个 ` ``` ` 会认为第一个代码块结束。

#### 错误示例

````markdown
```markdown
## 快速开始

```bash        ← ❌ 被误认为外层代码块的结束！
git clone ...
```            ← ← 外层代码块真正的结束
...
```            ← ❌ 开始了一个新代码块
````

#### 正确方案：用更多反引号区分层级

外层使用 **4+ 个反引号**，内层使用 3 个：

`````markdown
````markdown
## 快速开始

```bash
git clone https://github.com/xxx.git
npm install
```

### 配置

1. 复制 `.env.example` 到 `.env`
````
`````

**规则**：解析器匹配**相同数量的反引号**作为开始和结束，内部的 ` ``` ` 不会被误解析。

### 10.3 推荐实践

| 场景 | 外层反引号数 | 内层反引号数 |
|------|------------|------------|
| 普通代码块 | 3 | - |
| 包含代码块的 Markdown 示例 | 4 | 3 |
| 包含 Markdown 示例的 Markdown 示例 | 5 | 4 |

---

## 11. 禁止事项

- ❌ 无 project 关联
- ❌ @ 不存在的成员
- ❌ 引用不存在的文档
- ❌ 省略必填 Front Matter
- ❌ 嵌套代码块使用相同数量的反引号
