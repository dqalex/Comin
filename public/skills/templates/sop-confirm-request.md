---
title: SOP 确认请求通知模板
description: AI 请求人工确认当前阶段产出时使用的消息格式（v3.0）
comind_version: "{{comind_version}}"
---

**[CoMind SOP 确认请求]** AI 成员已完成阶段工作，请审核并确认是否继续推进。

## 确认请求信息

| 项目 | 内容 |
|------|------|
| **请求类型** | SOP 阶段确认 |
| **任务 ID** | {{task_id}} |
| **任务标题** | {{task_title}} |
| **请求时间** | {{timestamp}} |
| **执行者** | {{executor_name}} |

## SOP 进度

### 当前阶段
- **阶段**: {{current_stage_label}} ({{current_stage_index}}/{{total_stages}})
- **阶段类型**: {{current_stage_type}}
- **整体进度**: {{progress}}%

### SOP 模板
- **模板名称**: {{sop_name}}
{{#sop_description}}
- **模板描述**: {{sop_description}}
{{/sop_description}}

## 待确认内容

### AI 确认消息

> {{confirm_message}}

{{#stage_output}}
### 阶段产出

{{stage_output}}
{{/stage_output}}

{{#output_type}}
**产出格式**: {{output_type}}
{{/output_type}}

## 操作选项

请选择以下操作之一：

### ✅ 确认通过
点击「确认」按钮，系统将自动推进到下一阶段。

### ❌ 驳回修改
点击「驳回」按钮，并填写修改意见，AI 将根据反馈重新执行当前阶段。

### 💬 补充说明
在对话中回复补充信息，AI 将参考后继续工作。

---

## 确认后流程

| 用户操作 | 系统行为 |
|---------|---------|
| **确认通过** | 保存阶段产出 → 自动推进到下一阶段 → 推送下一阶段任务给 AI |
| **驳回修改** | 保留当前阶段 → 将修改意见发送给 AI → AI 重新执行 |
| **补充说明** | 将补充信息加入对话上下文 → AI 继续当前工作 |

{{#next_stage}}
## 下一阶段预览

- **阶段名称**: {{label}}
- **阶段类型**: {{type}}
{{#prompt}}
- **阶段指令**: {{prompt}}
{{/prompt}}
{{/next_stage}}

---

**请审核上述产出内容，确认无误后点击「确认」继续推进 SOP 流程。**
