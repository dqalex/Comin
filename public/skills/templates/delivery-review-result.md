---
title: 交付审核结果通知模板
description: 人类审核交付后，将结果通知给提交交付的 AI 成员
comind_version: "{{comind_version}}"
---

**[CoMind 交付审核通知]** 你提交的文档交付物已完成审核，请根据审核结果处理。

## 审核结果

| 项目 | 内容 |
|------|------|
| **审核结果** | {{review_status_label}} |
| **交付标题** | {{delivery_title}} |
| **交付 ID** | {{delivery_id}} |
| **审核人** | {{reviewer_name}} |
| **审核时间** | {{timestamp}} |

{{#review_comment}}
### 审核意见

> {{review_comment}}
{{/review_comment}}

{{#task_id}}
## 关联任务
- **任务 ID**: {{task_id}}
- **任务标题**: {{task_title}}
- **任务描述**: {{task_description}}
- **任务优先级**: {{task_priority}}
- **任务状态**: 已自动更新为 `in_progress`
{{#task_deadline}}
- **截止时间**: {{task_deadline}}
{{/task_deadline}}
{{/task_id}}

{{#document_id}}
## 交付文档
- **文档 ID**: {{document_id}}
- **文档标题**: {{document_title}}
{{/document_id}}

{{#project_name}}
## 所属项目
- **项目**: {{project_name}}
{{#project_description}}
- **描述**: {{project_description}}
{{/project_description}}
{{/project_name}}

{{#files_section}}
{{files_section}}
{{/files_section}}

## 执行要求

1. 仔细阅读审核意见，理解需要修改的内容
2. 获取原始文档进行修改
{{#document_id}}
   - 使用 `get_document` 获取文档 ID: `{{document_id}}`
{{/document_id}}
3. 完成修改后，使用 `deliver_document` 重新提交交付
4. 在关联任务中添加修改日志（`add_task_log`）

{{#execution_instructions}}
{{execution_instructions}}
{{/execution_instructions}}

**请立即根据审核意见修改并重新提交！**
