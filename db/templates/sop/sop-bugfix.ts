/**
 * SOP 模板：Bug 分析报告
 */
import type { BuiltinSopTemplate } from '../types';

export const sopBugfix: BuiltinSopTemplate = {
  id: 'sop-builtin-bugfix',
  name: 'Bug 分析报告',
  description: '结构化 Bug 排查：复现 → 根因分析 → 影响评估 → 修复方案 → 复盘总结',
  category: 'development',
  icon: 'bug',
  systemPrompt: '你是一名资深软件工程师，擅长系统化的 Bug 排查和根因分析。请严谨分析，不要猜测，每个结论要有代码级证据。',
  qualityChecklist: [
    '复现步骤清晰',
    '根因定位到代码行',
    '影响范围已评估',
    '修复方案有单测覆盖',
    '类似问题已全局排查',
  ],
  stages: [
    {
      id: 'bug-input',
      label: 'Bug 描述',
      type: 'input',
      requiredInputs: [
        { id: 'title', label: 'Bug 标题', type: 'text', required: true, placeholder: '例：分页参数导致前端白屏' },
        { id: 'steps', label: '复现步骤', type: 'text', required: true, placeholder: '1. 打开任务列表\n2. 不传分页参数\n3. 页面白屏' },
        { id: 'expected', label: '期望行为', type: 'text', required: true, placeholder: '正常显示任务列表' },
        { id: 'actual', label: '实际行为', type: 'text', required: true, placeholder: '页面白屏，控制台报错 .map is not a function' },
      ],
    },
    {
      id: 'bug-analyze',
      label: '根因分析',
      type: 'ai_auto',
      promptTemplate: 'Bug: {{inputs.title}}\n\n复现步骤: {{inputs.steps}}\n期望: {{inputs.expected}}\n实际: {{inputs.actual}}\n\n请进行系统化根因分析：\n1. 从错误信息反推可能的代码路径\n2. 定位具体的出错文件和函数\n3. 分析数据流（API → Store → Component）\n4. 确定根本原因（不是表面症状）',
      outputType: 'markdown',
      knowledgeLayers: ['L1', 'L2'],
      estimatedMinutes: 10,
    },
    {
      id: 'bug-impact',
      label: '影响评估',
      type: 'ai_with_confirm',
      promptTemplate: '基于根因分析，评估影响范围：\n1. 受影响的 API 端点\n2. 受影响的 Store 和组件\n3. 是否有其他代码存在相同模式（全局排查）\n4. 严重等级评估（P0-P3）\n5. 修复方案和测试计划',
      confirmMessage: '请确认影响范围评估和修复方案',
      outputType: 'markdown',
      knowledgeLayers: ['L1', 'L4'],
      estimatedMinutes: 8,
    },
    {
      id: 'bug-review',
      label: '复盘确认',
      type: 'review',
      estimatedMinutes: 5,
    },
  ],
};
