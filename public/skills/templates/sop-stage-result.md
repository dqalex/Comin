---
title: SOP 阶段完成通知模板
description: 阶段完成时向相关方发送的结果通知（v3.0）
teamclaw_version: "{{teamclaw_version}}"
---

**[TeamClaw SOP 阶段完成]** SOP 流程中的一个阶段已完成，以下是执行结果。

## 完成信息

| 项目 | 内容 |
|------|------|
| **任务 ID** | {{task_id}} |
| **任务标题** | {{task_title}} |
| **完成时间** | {{timestamp}} |
| **执行者** | {{executor_name}} |

## 阶段信息

### 已完成阶段
- **阶段**: {{completed_stage_label}} ({{completed_stage_index}}/{{total_stages}})
- **阶段类型**: {{completed_stage_type}}
- **执行状态**: ✅ 已完成

### SOP 进度
- **整体进度**: {{progress}}%
- **剩余阶段**: {{remaining_stages}} 个

```
[进度条]
{{progress_bar}}
```

## 阶段产出

{{#stage_output}}
### 产出内容

{{stage_output}}

{{#output_type}}
**格式**: {{output_type}}
{{/output_type}}
{{/stage_output}}

{{^stage_output}}
_此阶段无结构化产出_
{{/stage_output}}

{{#was_confirmed}}
### 确认记录
- **确认方式**: 人工确认
- **确认人**: {{confirmer_name}}
- **确认时间**: {{confirm_time}}
{{#confirm_comment}}
- **确认意见**: {{confirm_comment}}
{{/confirm_comment}}
{{/was_confirmed}}

---

## 流程状态

{{#is_final_stage}}
### 🎉 SOP 流程已完成！

所有阶段均已执行完毕。

| 统计项 | 数值 |
|-------|------|
| **总阶段数** | {{total_stages}} |
| **AI 执行阶段** | {{ai_stages_count}} |
| **人工确认次数** | {{confirm_count}} |
| **总耗时** | {{total_duration}} |

{{#final_output}}
### 最终产出

{{final_output}}
{{/final_output}}

**下一步**: 请在任务中确认最终交付物，或将结果同步到相关文档。
{{/is_final_stage}}

{{^is_final_stage}}
### ⏳ 流程继续中

| 下一阶段 | 信息 |
|---------|------|
| **阶段名称** | {{next_stage_label}} |
| **阶段类型** | {{next_stage_type}} |
{{#next_stage_assignee}}
| **执行者** | {{next_stage_assignee}} |
{{/next_stage_assignee}}

{{#next_stage_is_input}}
**注意**: 下一阶段为「输入阶段」，需要用户提供数据后才能继续。
{{/next_stage_is_input}}

{{#next_stage_is_ai}}
**注意**: 下一阶段为「AI 执行阶段」，系统将自动推送任务给 AI 成员。
{{/next_stage_is_ai}}

{{#next_stage_is_manual}}
**注意**: 下一阶段为「人工操作阶段」，请相关人员完成后手动推进。
{{/next_stage_is_manual}}

{{#next_stage_is_review}}
**注意**: 下一阶段为「审核阶段」，请相关审核人员进行审核。
{{/next_stage_is_review}}
{{/is_final_stage}}

---

## 历史产出汇总

{{#stage_history}}
### {{index}}. {{label}}
- **类型**: {{type}}
- **状态**: {{status}}
{{#output}}
- **产出**: {{output}}
{{/output}}
{{/stage_history}}

---

## 相关操作

{{#task_id}}
- 查看任务详情: `get_task(task_id="{{task_id}}")`
{{/task_id}}
- 获取 SOP 上下文: `get_sop_context(task_id="{{task_id}}")`
{{#document_id}}
- 查看关联文档: `get_document(document_id="{{document_id}}")`
{{/document_id}}

{{#is_final_stage}}
**SOP 流程已完成，感谢参与！**
{{/is_final_stage}}

{{^is_final_stage}}
**流程继续中，请关注下一阶段任务通知。**
{{/is_final_stage}}
