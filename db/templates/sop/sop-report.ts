/**
 * SOP 模板：周报/月报
 */
import type { BuiltinSopTemplate } from '../types';

export const sopReport: BuiltinSopTemplate = {
  id: 'sop-builtin-report',
  name: '周报/月报',
  description: '自动化周期性报告：汇总数据 → AI 分析 → 生成报告 → 审核',
  category: 'operations',
  icon: 'calendar',
  systemPrompt: '你是一名项目管理专家，擅长从数据中提炼关键信息，生成结构清晰、重点突出的周期性报告。报告要简洁有力，突出成果和待办。',
  qualityChecklist: [
    '数据完整准确',
    '关键指标有同比/环比',
    '风险项标注明显',
    '下周计划清晰可执行',
  ],
  stages: [
    {
      id: 'report-input',
      label: '报告范围',
      type: 'input',
      requiredInputs: [
        { id: 'period', label: '报告周期', type: 'text', required: true, placeholder: '例：2026-W09 (2.24-2.28)' },
        { id: 'highlights', label: '本周亮点', type: 'text', required: false, placeholder: '例：完成 v3.0 Phase A' },
        { id: 'issues', label: '问题和风险', type: 'text', required: false, placeholder: '例：性能瓶颈待优化' },
      ],
    },
    {
      id: 'report-collect',
      label: '数据汇总',
      type: 'ai_auto',
      promptTemplate: '汇总 {{inputs.period}} 的项目数据：\n1. 从 TeamClaw 任务系统获取本周完成/进行中/新建的任务统计\n2. 从交付记录获取本周交付物\n3. 从里程碑进度获取整体进展\n\n亮点补充：{{inputs.highlights}}\n问题补充：{{inputs.issues}}',
      outputType: 'markdown',
      knowledgeLayers: ['L1'],
      estimatedMinutes: 5,
    },
    {
      id: 'report-write',
      label: '生成报告',
      type: 'ai_auto',
      promptTemplate: '基于汇总数据生成周报：\n\n## 结构\n1. 本周总结（3 句话）\n2. 关键成果（列表）\n3. 任务统计（完成/进行中/新建）\n4. 重要交付\n5. 风险和问题\n6. 下周计划（优先级排序）\n7. 需要的支持\n\n简洁有力，避免冗余。',
      outputType: 'markdown',
      knowledgeLayers: ['L1', 'L4'],
      estimatedMinutes: 8,
    },
    {
      id: 'report-review',
      label: '审核确认',
      type: 'review',
      estimatedMinutes: 5,
    },
  ],
};
