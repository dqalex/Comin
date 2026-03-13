/**
 * SOP 模板：数据分析报告
 */
import type { BuiltinSopTemplate } from '../types';

export const sopAnalysis: BuiltinSopTemplate = {
  id: 'sop-builtin-analysis',
  name: '数据分析报告',
  description: '从数据到洞察：明确目标 → 收集数据 → 分析建模 → 可视化报告 → 审核',
  category: 'analysis',
  icon: 'bar-chart-2',
  systemPrompt: '你是一名数据分析师，擅长从数据中发现趋势和洞察。注意：所有结论必须有数据支撑，图表要清晰易读，建议要可操作。',
  qualityChecklist: [
    '分析目标明确',
    '数据来源标注',
    '有趋势分析和同比/环比',
    '洞察有商业价值',
    '建议可操作',
  ],
  stages: [
    {
      id: 'analysis-input',
      label: '分析目标',
      type: 'input',
      requiredInputs: [
        { id: 'objective', label: '分析目标', type: 'text', required: true, placeholder: '例：分析 Q1 用户增长趋势' },
        { id: 'dataSource', label: '数据来源', type: 'text', required: false, placeholder: '例：用户注册数据、活跃数据' },
        { id: 'dimensions', label: '分析维度', type: 'text', required: false, placeholder: '例：时间趋势、地区分布、用户画像' },
      ],
    },
    {
      id: 'analysis-collect',
      label: '数据收集',
      type: 'ai_auto',
      promptTemplate: '分析目标：{{inputs.objective}}\n数据来源：{{inputs.dataSource}}\n\n请收集和整理相关数据，构建数据表格，标注数据时间范围和来源。',
      outputType: 'markdown',
      knowledgeLayers: ['L1'],
      estimatedMinutes: 8,
    },
    {
      id: 'analysis-model',
      label: '分析建模',
      type: 'ai_with_confirm',
      promptTemplate: '基于收集的数据，按以下维度分析：{{inputs.dimensions}}\n\n请输出：\n1. 关键指标汇总表\n2. 趋势分析（同比/环比）\n3. 异常值标注和解释\n4. 核心洞察（3-5 条）\n5. 行动建议',
      confirmMessage: '请确认分析结果和洞察是否准确',
      outputType: 'markdown',
      knowledgeLayers: ['L1', 'L2'],
      estimatedMinutes: 15,
    },
    {
      id: 'analysis-render',
      label: '报告排版',
      type: 'render',
      estimatedMinutes: 10,
    },
    {
      id: 'analysis-review',
      label: '审核',
      type: 'review',
      estimatedMinutes: 5,
    },
  ],
};
