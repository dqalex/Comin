/**
 * 文档创建模板
 * 模板内容与 skills/teamclaw/references/doc-template-*.md 保持同步
 */

const REPORT_TEMPLATE = `## 背景

> 简要描述报告的背景和目标

## 关键发现

1. 

## 数据分析

| 指标 | 当前值 | 目标值 | 差距 |
|------|--------|--------|------|
|      |        |        |      |

## 结论与建议

- 

## 下一步行动

- [ ] 
`;

const DECISION_TEMPLATE = `## 决策主题



## 背景与问题

> 需要做出决策的背景是什么？

## 可选方案

### 方案 A：
- **优势**：
- **劣势**：
- **成本**：

### 方案 B：
- **优势**：
- **劣势**：
- **成本**：

## 决策结果

**选择方案**：

**决策理由**：

## 影响范围

- 

## 执行计划

- [ ] 
`;

const SCHEDULED_TASK_TEMPLATE = `## 任务说明

> 定时任务的目标和期望输出

## 调度配置

- **执行频率**：
- **Agent**：
- **Thinking Level**：

## 执行步骤

1. 

## 预期产出

- 

## 异常处理

- 
`;

const TASK_LIST_TEMPLATE = `---
type: teamclaw:tasks
project: 
---

## 待办事项

### 高优先级
- [ ] 任务标题 @负责人
  > 任务描述
  > 截止日期: YYYY-MM-DD
  > 文档: [[相关文档标题]]

### 中优先级
- [ ] 任务标题 @负责人

### 低优先级
- [ ] 任务标题 @负责人

## 进行中
- [-] 任务标题 @负责人 [进度%]
  > 进展描述

## 审核中
- [?] 任务标题 @负责人 [进度%]

## 已完成
- [x] 任务标题 @负责人
`;

export const DOC_TEMPLATES: Record<string, string> = {
  note: '',
  report: REPORT_TEMPLATE,
  decision: DECISION_TEMPLATE,
  scheduled_task: SCHEDULED_TASK_TEMPLATE,
  task_list: TASK_LIST_TEMPLATE,
  other: '',
};
