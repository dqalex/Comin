---
title: 任务看板模板
description: 用于 Markdown 双向同步的任务看板模板
type: teamclaw:tasks
teamclaw_version: "{{teamclaw_version}}"
---

# {{project_name}} - 任务看板

> 项目ID: {{project_id}} | 更新时间: {{current_date}}

## 可用成员

**人类**: {{human_member_names}}
**AI**: {{ai_member_names}}

---

## 待办事项

- [ ] 普通任务 @负责人 [[关联文档]]
  > 任务描述
  > 截止日期: YYYY-MM-DD
  - [ ] 子检查项

- [!] 高优先任务 @负责人 [[文档A]] [[文档B]]

- [-] 低优先任务 @负责人

## 进行中

- [~] 正在执行的任务 @负责人 [30%]
  > 当前进度描述

## 审核中

- [?] 待审核任务 @负责人 [90%]

## 已完成

- [x] 已完成任务 @负责人

---

## 语法说明

| 标记 | 状态 | 优先级 |
|------|------|--------|
| `[ ]` | todo | medium |
| `[!]` | todo | high |
| `[-]` | todo | low |
| `[~]` | in_progress | - |
| `[?]` | reviewing | - |
| `[x]` | completed | - |

**其他语法**：
- `@成员名` — 分配任务
- `[[文档名]]` — 关联文档（可多个）
- `#task_xxx` — 引用已有任务
- `[进度%]` — 进度百分比
