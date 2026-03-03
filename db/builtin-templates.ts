/**
 * 内置 SOP 模板和渲染模板 seed 数据
 * 
 * 5 个 SOP 模板 + 4 个渲染模板
 * 固定 ID，isBuiltin=true，便于升级时幂等写入
 */

import type { SOPStage, SlotDef, SectionDef } from '@/db/schema';

// ============================================================
// 内置 SOP 模板 (5 个)
// ============================================================

interface BuiltinSopTemplate {
  id: string;
  name: string;
  description: string;
  category: 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media' | 'custom';
  icon: string;
  stages: SOPStage[];
  systemPrompt: string;
  qualityChecklist: string[];
}

export const BUILTIN_SOP_TEMPLATES: BuiltinSopTemplate[] = [
  // ---- 1. 竞品调研报告 ----
  {
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
  },

  // ---- 2. 内容营销文章 ----
  {
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
  },

  // ---- 3. 周报/月报 ----
  {
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
        promptTemplate: '汇总 {{inputs.period}} 的项目数据：\n1. 从 CoMind 任务系统获取本周完成/进行中/新建的任务统计\n2. 从交付记录获取本周交付物\n3. 从里程碑进度获取整体进展\n\n亮点补充：{{inputs.highlights}}\n问题补充：{{inputs.issues}}',
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
  },

  // ---- 4. Bug 分析报告 ----
  {
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
  },

  // ---- 5. 数据分析报告 ----
  {
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
  },
];

// ============================================================
// 内置渲染模板 (4 个)
// ============================================================

interface BuiltinRenderTemplate {
  id: string;
  name: string;
  description: string;
  category: 'report' | 'card' | 'poster' | 'presentation' | 'custom';
  htmlTemplate: string;
  cssTemplate: string;
  mdTemplate: string;
  slots: Record<string, SlotDef>;
  sections: SectionDef[];
  exportConfig: { formats: ('jpg' | 'png' | 'html' | 'pdf')[]; defaultWidth?: number; defaultScale?: number; mode?: '16:9' | 'long' | 'a4' | 'custom' };
}

export const BUILTIN_RENDER_TEMPLATES: BuiltinRenderTemplate[] = [
  // ---- 1. 简约报告卡片 ----
  {
    id: 'rt-builtin-report-card',
    name: '简约报告卡片',
    description: '适用于调研报告、分析报告的简洁排版模板',
    category: 'report',
    htmlTemplate: `<div class="report-card" style="max-width:800px;margin:0 auto;padding:48px;font-family:'PingFang SC','Helvetica Neue',sans-serif;color:#1a1a2e;background:#fff;">
  <header style="margin-bottom:40px;border-bottom:3px solid #4f46e5;padding-bottom:24px;">
    <h1 data-slot="title" style="font-size:28px;font-weight:700;margin:0 0 8px;color:#1a1a2e;">报告标题</h1>
    <p data-slot="subtitle" style="font-size:16px;color:#64748b;margin:0;">副标题或日期</p>
  </header>
  <section style="margin-bottom:32px;">
    <h2 style="font-size:20px;font-weight:600;color:#4f46e5;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">核心发现</h2>
    <div data-slot="summary" style="font-size:15px;line-height:1.8;color:#334155;">在这里填写核心发现内容...</div>
  </section>
  <section style="margin-bottom:32px;">
    <h2 style="font-size:20px;font-weight:600;color:#4f46e5;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">详细分析</h2>
    <div data-slot="body" style="font-size:15px;line-height:1.8;color:#334155;">报告正文内容...</div>
  </section>
  <section>
    <h2 style="font-size:20px;font-weight:600;color:#4f46e5;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">建议与行动</h2>
    <div data-slot="conclusion" style="font-size:15px;line-height:1.8;color:#334155;">结论和建议...</div>
  </section>
  <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
    <span data-slot="footer">由 CoMind 生成</span>
  </footer>
</div>`,
    cssTemplate: '',
    mdTemplate: `<!-- @slot:title -->\n# 报告标题\n\n<!-- @slot:subtitle -->\n报告日期\n\n<!-- @slot:summary -->\n核心发现内容\n\n<!-- @slot:body -->\n详细分析内容\n\n<!-- @slot:conclusion -->\n建议与行动\n\n<!-- @slot:footer -->\n由 CoMind 生成`,
    slots: {
      title: { label: '报告标题', type: 'text', placeholder: '输入报告标题' },
      subtitle: { label: '副标题/日期', type: 'text', placeholder: '输入副标题或报告日期' },
      summary: { label: '核心发现', type: 'richtext', placeholder: '输入核心发现内容' },
      body: { label: '详细分析', type: 'richtext', placeholder: '输入详细分析内容' },
      conclusion: { label: '建议与行动', type: 'richtext', placeholder: '输入结论和建议' },
      footer: { label: '页脚', type: 'text', placeholder: '页脚文字' },
    },
    sections: [
      { id: 'header', label: '标题区', slots: ['title', 'subtitle'] },
      { id: 'content', label: '内容区', slots: ['summary', 'body', 'conclusion'] },
      { id: 'footer', label: '页脚', slots: ['footer'] },
    ],
    exportConfig: { formats: ['jpg', 'html'], defaultWidth: 800, defaultScale: 2, mode: 'long' },
  },

  // ---- 2. 周报模板 ----
  {
    id: 'rt-builtin-weekly',
    name: '项目周报',
    description: '适用于周报/月报的结构化模板，包含数据统计和进度展示',
    category: 'report',
    htmlTemplate: `<div class="weekly-report" style="max-width:800px;margin:0 auto;padding:40px;font-family:'PingFang SC','Helvetica Neue',sans-serif;color:#1a1a2e;background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%);">
  <header style="text-align:center;margin-bottom:36px;">
    <h1 data-slot="title" style="font-size:24px;font-weight:700;margin:0 0 4px;color:#1e293b;">项目周报</h1>
    <p data-slot="period" style="font-size:14px;color:#64748b;margin:0;">2026-W01</p>
  </header>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px;">
    <div style="background:#fff;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="font-size:28px;font-weight:700;color:#22c55e;" data-slot="completed">0</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px;">已完成</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="font-size:28px;font-weight:700;color:#f59e0b;" data-slot="inProgress">0</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px;">进行中</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="font-size:28px;font-weight:700;color:#ef4444;" data-slot="issues">0</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px;">问题/风险</div>
    </div>
  </div>
  <section style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h2 style="font-size:16px;font-weight:600;color:#4f46e5;margin:0 0 12px;">本周成果</h2>
    <div data-slot="achievements" style="font-size:14px;line-height:1.8;color:#334155;">成果列表...</div>
  </section>
  <section style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h2 style="font-size:16px;font-weight:600;color:#f59e0b;margin:0 0 12px;">问题与风险</h2>
    <div data-slot="risks" style="font-size:14px;line-height:1.8;color:#334155;">问题列表...</div>
  </section>
  <section style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h2 style="font-size:16px;font-weight:600;color:#22c55e;margin:0 0 12px;">下周计划</h2>
    <div data-slot="nextPlan" style="font-size:14px;line-height:1.8;color:#334155;">计划列表...</div>
  </section>
</div>`,
    cssTemplate: '',
    mdTemplate: `<!-- @slot:title -->\n# 项目周报\n\n<!-- @slot:period -->\n2026-W01\n\n<!-- @slot:completed -->\n5\n\n<!-- @slot:inProgress -->\n3\n\n<!-- @slot:issues -->\n1\n\n<!-- @slot:achievements -->\n- 成果 1\n- 成果 2\n\n<!-- @slot:risks -->\n- 风险 1\n\n<!-- @slot:nextPlan -->\n- 计划 1\n- 计划 2`,
    slots: {
      title: { label: '报告标题', type: 'text', placeholder: '项目周报' },
      period: { label: '周期', type: 'text', placeholder: '2026-W01' },
      completed: { label: '已完成数', type: 'data', placeholder: '0' },
      inProgress: { label: '进行中数', type: 'data', placeholder: '0' },
      issues: { label: '问题数', type: 'data', placeholder: '0' },
      achievements: { label: '本周成果', type: 'richtext', placeholder: '列出主要成果' },
      risks: { label: '问题与风险', type: 'richtext', placeholder: '列出问题和风险' },
      nextPlan: { label: '下周计划', type: 'richtext', placeholder: '列出下周计划' },
    },
    sections: [
      { id: 'header', label: '标题', slots: ['title', 'period'] },
      { id: 'stats', label: '统计', slots: ['completed', 'inProgress', 'issues'] },
      { id: 'content', label: '内容', slots: ['achievements', 'risks', 'nextPlan'] },
    ],
    exportConfig: { formats: ['jpg', 'html'], defaultWidth: 800, defaultScale: 2, mode: 'long' },
  },

  // ---- 3. 社交媒体卡片 ----
  {
    id: 'rt-builtin-social-card',
    name: '社交媒体卡片',
    description: '适用于微博/公众号/小红书等平台的内容分享卡片',
    category: 'card',
    htmlTemplate: `<div class="social-card" style="width:640px;margin:0 auto;border-radius:16px;overflow:hidden;font-family:'PingFang SC','Helvetica Neue',sans-serif;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="height:200px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);display:flex;align-items:center;justify-content:center;padding:32px;">
    <div style="text-align:center;">
      <h1 data-slot="headline" style="font-size:28px;font-weight:700;color:#fff;margin:0 0 8px;text-shadow:0 2px 4px rgba(0,0,0,0.15);">标题文字</h1>
      <p data-slot="tagline" style="font-size:16px;color:rgba(255,255,255,0.85);margin:0;">副标题</p>
    </div>
  </div>
  <div style="padding:24px 32px;">
    <div data-slot="content" style="font-size:15px;line-height:1.8;color:#334155;margin-bottom:20px;">正文内容，支持富文本...</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid #f1f5f9;">
      <span data-slot="author" style="font-size:13px;color:#64748b;">作者名</span>
      <span data-slot="date" style="font-size:13px;color:#94a3b8;">日期</span>
    </div>
  </div>
</div>`,
    cssTemplate: '',
    mdTemplate: `<!-- @slot:headline -->\n# 标题文字\n\n<!-- @slot:tagline -->\n副标题\n\n<!-- @slot:content -->\n正文内容\n\n<!-- @slot:author -->\n作者\n\n<!-- @slot:date -->\n2026-03-03`,
    slots: {
      headline: { label: '标题', type: 'text', placeholder: '输入醒目标题' },
      tagline: { label: '副标题', type: 'text', placeholder: '一句话描述' },
      content: { label: '正文', type: 'richtext', placeholder: '卡片正文内容' },
      author: { label: '作者', type: 'text', placeholder: '作者名' },
      date: { label: '日期', type: 'text', placeholder: '2026-03-03' },
    },
    sections: [
      { id: 'hero', label: '头图区', slots: ['headline', 'tagline'] },
      { id: 'content', label: '内容区', slots: ['content'] },
      { id: 'meta', label: '元信息', slots: ['author', 'date'] },
    ],
    exportConfig: { formats: ['jpg', 'png'], defaultWidth: 640, defaultScale: 2, mode: 'custom' },
  },

  // ---- 4. 数据洞察海报 ----
  {
    id: 'rt-builtin-insight-poster',
    name: '数据洞察海报',
    description: '适用于数据分析结论展示，突出核心数字和洞察',
    category: 'poster',
    htmlTemplate: `<div class="insight-poster" style="width:720px;margin:0 auto;padding:48px;font-family:'PingFang SC','Helvetica Neue',sans-serif;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);color:#f8fafc;border-radius:16px;">
  <header style="text-align:center;margin-bottom:40px;">
    <p data-slot="category" style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#818cf8;margin:0 0 8px;">数据洞察</p>
    <h1 data-slot="title" style="font-size:32px;font-weight:700;margin:0;line-height:1.3;">核心数据标题</h1>
  </header>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:36px;">
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;text-align:center;">
      <div data-slot="metric1Value" style="font-size:36px;font-weight:700;color:#22d3ee;">42%</div>
      <div data-slot="metric1Label" style="font-size:13px;color:#94a3b8;margin-top:4px;">指标说明</div>
    </div>
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;text-align:center;">
      <div data-slot="metric2Value" style="font-size:36px;font-weight:700;color:#a78bfa;">128</div>
      <div data-slot="metric2Label" style="font-size:13px;color:#94a3b8;margin-top:4px;">指标说明</div>
    </div>
  </div>
  <section style="margin-bottom:32px;">
    <h2 style="font-size:16px;font-weight:600;color:#818cf8;margin:0 0 12px;">关键洞察</h2>
    <div data-slot="insights" style="font-size:14px;line-height:1.9;color:#cbd5e1;">洞察内容...</div>
  </section>
  <section>
    <h2 style="font-size:16px;font-weight:600;color:#818cf8;margin:0 0 12px;">行动建议</h2>
    <div data-slot="actions" style="font-size:14px;line-height:1.9;color:#cbd5e1;">建议内容...</div>
  </section>
  <footer style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
    <span data-slot="source" style="font-size:11px;color:#475569;">数据来源和日期</span>
  </footer>
</div>`,
    cssTemplate: '',
    mdTemplate: `<!-- @slot:category -->\n数据洞察\n\n<!-- @slot:title -->\n# 核心数据标题\n\n<!-- @slot:metric1Value -->\n42%\n\n<!-- @slot:metric1Label -->\n增长率\n\n<!-- @slot:metric2Value -->\n128\n\n<!-- @slot:metric2Label -->\n新增用户\n\n<!-- @slot:insights -->\n- 洞察 1\n- 洞察 2\n\n<!-- @slot:actions -->\n- 建议 1\n- 建议 2\n\n<!-- @slot:source -->\n数据来源：CoMind · 2026-03`,
    slots: {
      category: { label: '分类标签', type: 'text', placeholder: '数据洞察' },
      title: { label: '海报标题', type: 'text', placeholder: '核心数据标题' },
      metric1Value: { label: '指标1数值', type: 'data', placeholder: '42%' },
      metric1Label: { label: '指标1说明', type: 'text', placeholder: '增长率' },
      metric2Value: { label: '指标2数值', type: 'data', placeholder: '128' },
      metric2Label: { label: '指标2说明', type: 'text', placeholder: '新增用户' },
      insights: { label: '关键洞察', type: 'richtext', placeholder: '输入洞察内容' },
      actions: { label: '行动建议', type: 'richtext', placeholder: '输入建议内容' },
      source: { label: '数据来源', type: 'text', placeholder: '数据来源和日期' },
    },
    sections: [
      { id: 'header', label: '标题区', slots: ['category', 'title'] },
      { id: 'metrics', label: '核心指标', slots: ['metric1Value', 'metric1Label', 'metric2Value', 'metric2Label'] },
      { id: 'content', label: '内容区', slots: ['insights', 'actions'] },
      { id: 'footer', label: '页脚', slots: ['source'] },
    ],
    exportConfig: { formats: ['jpg', 'png', 'html'], defaultWidth: 720, defaultScale: 2, mode: 'long' },
  },
];
