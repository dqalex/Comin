---
title: 文档交付模板
description: 用于 Markdown 双向同步的文档交付模板
type: comind:deliveries
comind_version: "{{comind_version}}"
---

# 文档交付中心

> 更新时间: {{current_date}} {{current_time}}

## 团队信息

**审核人（人类成员）**: {{human_member_names}}
**交付者（AI 成员）**: {{ai_member_names}}

---

## 待审核

- 标题 | 交付者 | 平台 | 链接 | 关联任务 | 版本 | 描述

## 已通过

- 标题 | 交付者 | 审核人 | 审核意见 | 版本

## 已驳回 / 需修改

- 标题 | 交付者 | 审核人 | 审核意见 | 版本

---

**待审核格式**: `- 标题 | 交付者 | 平台 | 链接 | 关联任务 | 版本 | 描述`
**已审核格式**: `- 标题 | 交付者 | 审核人 | 审核意见 | 版本`

| 平台 | 值 |
|------|---|
| 本地文档 | 本地 (链接用 doc:文档ID) |
| 腾讯文档 | 腾讯文档 |
| 飞书 | 飞书 |
| Notion | Notion |
| 其他 | 其他 |
