/**
 * SOP 模板：内容营销文章
 */
import type { BuiltinSopTemplate } from '../types';

export const sopContent: BuiltinSopTemplate = {
  id: 'sop-builtin-content',
  name: '内容营销文章',
  description: '从选题到成稿的完整内容创作流程：确定选题 → 大纲编排 → AI 撰写 → 可视化排版 → 审核发布',
  category: 'content',
  icon: 'file-text',
  systemPrompt: '你是一名资深的内容营销专家，擅长撰写有洞察力、高传播性的行业文章。注意：标题要吸引人但不标题党，内容要有干货和独特观点。',
  qualityChecklist: [
    '标题有吸引力',
    '结构清晰有逻辑',
    '有数据和案例支撑',
    '有独特观点和洞察',
    '无语法错误',
  ],
  stages: [
    {
      id: 'content-input',
      label: '选题与需求',
      type: 'input',
      requiredInputs: [
        { id: 'topic', label: '文章主题', type: 'text', required: true, placeholder: '例：2026年 AI Agent 发展趋势' },
        { id: 'audience', label: '目标读者', type: 'text', required: true, placeholder: '例：技术决策者、CTO' },
        { id: 'style', label: '风格要求', type: 'text', required: false, placeholder: '例：专业但不学术，有深度有温度' },
        { id: 'wordCount', label: '字数要求', type: 'text', required: false, placeholder: '例：3000-5000字' },
      ],
    },
    {
      id: 'content-outline',
      label: '大纲编排',
      type: 'ai_with_confirm',
      promptTemplate: '为「{{inputs.topic}}」撰写文章大纲：\n\n目标读者：{{inputs.audience}}\n风格：{{inputs.style}}\n\n请包含：\n1. 标题（3-5个备选）\n2. 引言（hook point）\n3. 正文章节（3-5节，每节有核心论点）\n4. 结论和 CTA\n5. SEO 关键词建议',
      confirmMessage: '请审核大纲结构，选择标题，提出修改意见',
      outputType: 'markdown',
      knowledgeLayers: ['L1'],
      estimatedMinutes: 8,
    },
    {
      id: 'content-write',
      label: 'AI 撰写',
      type: 'ai_auto',
      promptTemplate: '按照确认的大纲撰写完整文章。\n\n要求：\n1. 字数 {{inputs.wordCount}}\n2. 每个论点配 1-2 个案例或数据\n3. 段落紧凑，每段不超过 4 句\n4. 适当使用小标题和列表\n5. 结尾有行动号召（CTA）',
      outputType: 'markdown',
      knowledgeLayers: ['L1', 'L2', 'L3'],
      estimatedMinutes: 15,
    },
    {
      id: 'content-render',
      label: '可视化排版',
      type: 'render',
      estimatedMinutes: 10,
    },
    {
      id: 'content-review',
      label: '终审',
      type: 'review',
      estimatedMinutes: 10,
    },
  ],
};
