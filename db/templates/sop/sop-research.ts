/**
 * SOP 模板：竞品调研报告
 */
import type { BuiltinSopTemplate } from '../types';

export const sopResearch: BuiltinSopTemplate = {
  id: 'sop-builtin-research',
  name: '竞品调研报告',
  description: '系统化的竞品调研流程：收集信息 → 分析对比 → 整理亮点 → 撰写报告 → 人工审核',
  category: 'research',
  icon: 'search',
  systemPrompt: '你是一名专业的行业分析师，擅长竞品调研和市场分析。请严格按照 SOP 阶段指令执行，确保数据准确、分析有深度、结论有依据。',
  qualityChecklist: [
    '至少覆盖 3 个竞品',
    '每个竞品有功能对比表',
    '数据标注来源',
    '结论有数据支撑',
    '包含差异化建议',
  ],
  stages: [
    {
      id: 'research-input',
      label: '调研需求确认',
      type: 'input',
      requiredInputs: [
        { id: 'topic', label: '调研主题', type: 'text', required: true, placeholder: '例：AI 编程助手市场调研' },
        { id: 'competitors', label: '目标竞品', type: 'text', required: false, placeholder: '例：GitHub Copilot, Cursor, Windsurf' },
        { id: 'focus', label: '关注维度', type: 'text', required: false, placeholder: '例：功能、定价、用户体验' },
      ],
    },
    {
      id: 'research-collect',
      label: '信息收集',
      type: 'ai_auto',
      promptTemplate: '基于调研主题「{{inputs.topic}}」，收集以下竞品的关键信息：{{inputs.competitors}}。\n\n请从以下维度收集：\n1. 产品定位和目标用户\n2. 核心功能清单\n3. 定价策略\n4. 技术栈/架构特点\n5. 用户评价和口碑\n\n输出结构化的信息摘要。',
      outputType: 'markdown',
      knowledgeLayers: ['L1'],
      estimatedMinutes: 10,
    },
    {
      id: 'research-analyze',
      label: '深度分析',
      type: 'ai_with_confirm',
      promptTemplate: '基于收集到的信息，进行深度对比分析：\n1. 功能矩阵对比表\n2. 优劣势 SWOT 分析\n3. 关键差异化要素\n4. 市场趋势判断\n\n请特别关注：{{inputs.focus}}',
      confirmMessage: '请确认分析结果是否准确，是否需要补充数据',
      outputType: 'markdown',
      knowledgeLayers: ['L1', 'L2'],
      estimatedMinutes: 15,
    },
    {
      id: 'research-write',
      label: '撰写报告',
      type: 'ai_auto',
      promptTemplate: '综合所有调研数据和分析结果，撰写完整的调研报告：\n\n## 报告结构\n1. 执行摘要\n2. 调研背景和方法\n3. 竞品概览\n4. 功能对比矩阵\n5. 深度分析\n6. 关键发现\n7. 建议和行动项\n\n报告语言要专业、数据要准确、结论要有洞察。',
      outputType: 'markdown',
      knowledgeLayers: ['L1', 'L3'],
      estimatedMinutes: 20,
    },
    {
      id: 'research-review',
      label: '人工审核',
      type: 'review',
      estimatedMinutes: 10,
    },
  ],
};
