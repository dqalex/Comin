# 枚举值参考

> 本文档列出 TeamClaw 系统中所有枚举类型的有效值。

## 任务状态

| 值 | 说明 | Markdown 语法 |
|---|------|--------------|
| `todo` | 待办 | `- [ ]`, `- [!]` (高优), `- [-]` (低优) |
| `in_progress` | 进行中 | `- [~]` |
| `reviewing` | 审核中 | `- [?]` |
| `completed` | 已完成 | `- [x]` |

## 优先级

| 值 | 说明 |
|---|------|
| `high` | 高优先级 |
| `medium` | 中优先级（默认） |
| `low` | 低优先级 |

## 里程碑状态

| 值 | 说明 |
|---|------|
| `open` | 开放中 |
| `in_progress` | 进行中 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

## AI 状态

| 值 | 说明 | 触发场景 |
|---|------|---------|
| `idle` | 空闲 | 可接新任务 |
| `working` | 执行中 | 正在执行任务 |
| `waiting` | 等待中 | 等待用户回复/外部资源 |
| `offline` | 离线 | 服务不可用 |

## 文档类型

| 值 | 说明 |
|---|------|
| `guide` | 指南文档 |
| `reference` | 参考资料 |
| `note` | 笔记 |
| `report` | 报告 |
| `decision` | 决策文档 |
| `scheduled_task` | 定时任务文档 |
| `task_list` | 任务列表 |
| `other` | 其他 |

## 同步文档类型（Front Matter type）

| 值 | 同步目标 | 说明 |
|---|---------|------|
| `teamclaw:tasks` | tasks 表 | 批量创建/更新任务 |
| `teamclaw:schedules` | schedules 表 | 创建定时任务 |
| `teamclaw:deliveries` | deliveries 表 | 批量交付列表 |
| `teamclaw:milestones` | milestones 表 | 批量创建/更新里程碑 |
| `task_list` | tasks 表 | 任务列表（等同于 teamclaw:tasks） |

## 交付平台

| 值 | 说明 |
|---|------|
| `tencent-doc` | 腾讯文档 |
| `feishu` | 飞书文档 |
| `notion` | Notion |
| `local` | 本地（默认） |
| `other` | 其他平台 |

## 交付状态

| 值 | 说明 | 说明 |
|---|------|------|
| `pending` | 待审核 | 进入交付中心待审核队列 |
| `approved` | 已通过 | 已通过审核 |
| `rejected` | 已拒绝 | 已驳回 |
| `revision_needed` | 需修改 | 需要修改后重新提交 |

## 定时周期

| 值 | 说明 |
|---|------|
| `once` | 单次执行 |
| `daily` | 每日执行 |
| `weekly` | 每周执行 |
| `monthly` | 每月执行 |

## 定时任务类型

| 值 | 说明 |
|---|------|
| `report` | 报告生成 |
| `summary` | 摘要汇总 |
| `backup` | 数据备份 |
| `notification` | 通知提醒 |
| `custom` | 自定义任务 |

## SOP 阶段类型

| 值 | 说明 | AI 行为 |
|---|------|---------|
| `input` | 等待人工输入 | 暂停，等待用户提供文件/信息 |
| `ai_auto` | AI 自动执行 | 执行完成后自动推进 |
| `ai_with_confirm` | AI 执行后确认 | 执行完成，等待人工确认 |
| `manual` | 纯人工操作 | 等待人工完成 |
| `render` | 可视化编辑 | 进入 Content Studio 编辑 |
| `export` | 导出阶段 | 导出最终产物 |
| `review` | 提交审核 | 进入交付中心 |

## 知识库层级

| 值 | 说明 | 内容类型 |
|---|------|---------|
| `L1` | 核心概览 | 索引信息 |
| `L2` | 详细说明 | 完整文档 |
| `L3` | 参考案例 | 实际案例 |
| `L4` | 经验记录 | 可追加的经验 |
| `L5` | 原始素材 | 原始数据 |
