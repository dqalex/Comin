# OpenClaw × CoMind 协作约束

## 1. 实体映射

| OpenClaw | CoMind 表 | 必填 |
|----------|----------|------|
| 项目名 | projects | name |
| 任务 | tasks | title, projectId |
| 文档 | documents | title, type |
| 成员 | members | name |
| 交付物 | deliveries | documentId |

## 2. ID 与索引

**ID 由 CoMind 统一生成**（Base58，~11字符）。OpenClaw 无需填写。

索引文件 `.comind-index`（CoMind 维护）：
```yaml
heartbeat: { status: active, last: 2026-02-18T10:00:00Z, interval: 120 }
instances: { inst_001: { is_primary: true } }
files:
  documents/报告.md: { id: abc123, hash: xyz, version: 2 }
```

**心跳状态**：`active`(正常) / `inactive`(失活) / `offline`(离线)
**多实例**：`is_primary: true` 可写，其他只读

## 3. 同步模式

| 模式 | 触发条件 |
|------|---------|
| init | 索引文件不存在 |
| auto_sync | 心跳 active + 开启自动同步 |
| api/mcp | 用户配置，未开启自动同步 |
| offline | 心跳超时/无网络 |

## 4. Front Matter 必填

```yaml
title: 文档标题
type: report | note | decision | task_output
project: comind-v2
created: 2026-02-18T10:00:00Z
updated: 2026-02-18T10:00:00Z
version: 1.0.0
```

### 4.1 交付相关字段（可选）

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
delivery_assignee: AI成员名           # 交付者（通常是创建文档的 AI）
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
| `delivery_status` | ✅ 有即交付 | 存在此字段即视为交付物，值为 `pending` 时进入交付中心待审核 |
| `delivery_assignee` | ✅ | 交付者成员名 |
| `delivery_platform` | ❌ | 默认 `local` |
| `delivery_version` | ❌ | 默认 `1` |
| `related_tasks` | ❌ | 关联任务 ID 列表 |
| `delivery_reviewer` | ❌ | 审核人（用户批复时填写） |
| `delivery_comment` | ❌ | 审核意见（用户批复时填写） |

**状态流转**：
```
pending（待审核）→ approved（已通过）→ 任务可 completed
                  → rejected（已驳回）
                  → revision_needed（需修改）
```

## 5. 任务识别

| 语法 | 状态 | 优先级 |
|------|------|--------|
| `- [ ]` | todo | medium |
| `- [!]` | todo | high |
| `- [-]` | todo | low |
| `- [~]` | in_progress | - |
| `- [?]` | reviewing | - |
| `- [x]` | completed | - |

`@用户名` 提及成员，自动分配任务
`[[文档名]]` 关联文档
`#task_xxx` 引用已有任务

## 6. 文档链接

- `[[文档名]]` 双向链接
- `[[doc:xxx]]` 按文档 ID 链接
- `#任务标题` 任务引用
- Web 链接：`https://comind.app/doc/{id}`

## 7. 任务描述语法

```markdown
- [ ] 任务标题 @成员 [[相关文档]] [进度%]
  > 任务描述
  > 截止日期: YYYY-MM-DD
  - [ ] 子任务1
  - [x] 子任务2
```

| 语法 | 说明 |
|------|------|
| `@成员名` | 分配任务 |
| `[[文档名]]` | 关联文档（可多个） |
| `[[doc:xxx]]` | 按文档 ID 关联 |
| `#task_xxx` | 引用已有任务 |
| `[进度%]` | 进度百分比 |
| `> 描述` | 任务描述 |
| `> 截止日期: YYYY-MM-DD` | 截止日期 |
| 缩进子任务 | 子任务清单 |

## 8. 文档模板

> **识别规则**：
> - `project: 项目名` → 关联到 CoMind 项目
> - `- [ ] 任务内容` → 自动创建 Task 并关联到项目
> - `@成员名` → 自动分配任务给成员
> - `[[文档名]]` 在任务中 → 任务关联该文档
> - `#task_xxx` 在任务中 → 任务关联已有任务

### 报告类
```markdown
---
title: 竞品分析报告           # 文档标题
type: report                  # 类型：report | note | decision | task_output
project: comind-v2            # 🔴 项目名（必须与 CoMind 项目名一致）
created: 2026-02-18T10:00:00Z
updated: 2026-02-18T10:00:00Z
version: 1.0.0
tags: [竞品分析]              # 可选：标签
---

# 竞品分析报告

## 概述
> 背景说明

## 分析对象
| 竞品 | 定位 | 核心功能 |
|------|------|---------|
| A | ... | ... |

## 🔴 任务清单（自动识别为 Task）
- [ ] 整理竞品资料 [[竞品数据]]        # 任务关联文档
- [!] 补充价格数据 @张三 [[报价单]]     # 任务 + 负责人 + 关联文档
- [?] 确认用户画像 #task_abc123       # 任务关联已有任务
- [~] 编写测试用例 [[API文档]] [[测试规范]]  # 多文档关联

## 相关文档
- [[产品定位]]               # 文档级链接
```

### 任务产出类
```markdown
---
title: 需求文档
type: task_output
project: comind-v2            # 🔴 关联项目
created: 2026-02-18T10:00:00Z
updated: 2026-02-18T10:00:00Z
version: 1.0.0
related_tasks: [task_abc123]  # 🔴 关联已有任务 ID（可选）
---

# 需求文档

## 背景
> 需求背景

## 功能需求
| 模块 | 功能 | 优先级 |
|------|------|--------|
| 用户 | 登录 | P0 |

## 🔴 验收标准（自动识别为 Task）
- [ ] 功能测试通过
- [ ] 文档更新完成 @agent_001
```

### 决策记录类
```markdown
---
title: 技术选型决策
type: decision
project: comind-v2
created: 2026-02-18T10:00:00Z
updated: 2026-02-18T10:00:00Z
version: 1.0.0
---

# 技术选型决策

## 背景
> 决策背景

## 方案对比
| 维度 | 方案A | 方案B |
|------|-------|-------|
| 性能 | 高 | 中 |

## 决策
**选择**: 方案A
**理由**: ...

## 🔴 后续任务
- [ ] 更新架构文档 @张三
- [!] 通知团队 @all
```

### 日常记录类
```markdown
---
title: 2026-02-18 工作记录
type: note
project: comind-v2
created: 2026-02-18T10:00:00Z
updated: 2026-02-18T10:00:00Z
version: 1.0.0
---

# 2026-02-18 工作记录

## 今日完成
- 完成需求文档初稿
- 用户访谈 3 人

## 🔴 待办
- [ ] 完成竞品分析
- [!] 修复登录 bug @张三

## 相关
- [[需求文档]]
- #task_abc123              # 引用已有任务
```

## 9. 离线缓存

`.comind-pending` 缓存变更，重连后批量同步。

## 10. 禁止

- ❌ 无 project 关联
- ❌ @ 不存在的成员
- ❌ 引用不存在的文档
- ❌ 省略必填 Front Matter
