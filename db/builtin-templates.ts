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
    htmlTemplate: `<div class="report-card">
  <header class="report-header">
    <div data-slot="title" data-slot-type="content"></div>
    <div data-slot="subtitle" data-slot-type="content"></div>
  </header>
  <section class="report-section">
    <div data-slot="summary" data-slot-type="content"></div>
  </section>
  <section class="report-section">
    <div data-slot="body" data-slot-type="content"></div>
  </section>
  <section class="report-section">
    <div data-slot="conclusion" data-slot-type="content"></div>
  </section>
  <footer class="report-footer">
    <div data-slot="footer" data-slot-type="content"></div>
  </footer>
</div>`,
    cssTemplate: `.report-card {
  max-width: 800px; margin: 0 auto; padding: 48px;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
  color: #1a1a2e; background: #fff;
}
.report-header {
  margin-bottom: 40px; border-bottom: 3px solid #4f46e5; padding-bottom: 24px;
}
[data-slot="title"] h1 {
  font-size: 28px; font-weight: 700; margin: 0 0 8px; color: #1a1a2e;
}
[data-slot="subtitle"] p {
  font-size: 16px; color: #64748b; margin: 0;
}
.report-section {
  margin-bottom: 32px;
}
[data-slot="summary"] h2, [data-slot="body"] h2, [data-slot="conclusion"] h2 {
  font-size: 20px; font-weight: 600; color: #4f46e5;
  margin: 0 0 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;
}
[data-slot="summary"], [data-slot="body"], [data-slot="conclusion"] {
  font-size: 15px; line-height: 1.8; color: #334155;
}
.report-footer {
  margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0;
  font-size: 12px; color: #94a3b8; text-align: center;
}`,
    mdTemplate: `<!-- @slot:title -->
# 报告标题

<!-- @slot:subtitle -->
报告日期

<!-- @slot:summary -->
## 核心发现

- **核心发现一**：关键数据或趋势描述
- **核心发现二**：重要变化或异常分析
- **核心发现三**：业务影响和量化结论

<!-- @slot:body -->
## 详细分析

### 背景与方法

简要说明分析的背景、数据来源和方法论。

### 数据分析

| 指标 | 本期 | 上期 | 变化 |
| --- | --- | --- | --- |
| 指标A | 100 | 80 | +25% |
| 指标B | 50 | 60 | -17% |

> 注：以上数据来源于系统统计，时间范围为本报告周期。

### 深度解读

1. **趋势一**：对数据变化的深层解读
2. **趋势二**：关联因素分析
3. **趋势三**：与行业基准的对比

<!-- @slot:conclusion -->
## 建议与行动

### 建议

- **短期行动**：立即可执行的改进措施
- **中期规划**：需要资源投入的优化方案
- **长期策略**：战略层面的方向建议

---

*下一步*：明确责任人和时间节点，跟踪执行进展。

<!-- @slot:footer -->
由 CoMind 生成`,
    slots: {
      title: { label: '报告标题', type: 'content', placeholder: '# 输入报告标题' },
      subtitle: { label: '副标题/日期', type: 'content', placeholder: '输入副标题或报告日期' },
      summary: { label: '核心发现', type: 'content', placeholder: '## 核心发现\n\n输入核心发现内容' },
      body: { label: '详细分析', type: 'content', placeholder: '## 详细分析\n\n输入详细分析内容' },
      conclusion: { label: '建议与行动', type: 'content', placeholder: '## 建议与行动\n\n输入结论和建议' },
      footer: { label: '页脚', type: 'content', placeholder: '页脚文字' },
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
    htmlTemplate: `<div class="weekly-report">
  <header class="weekly-header">
    <div data-slot="title" data-slot-type="content"></div>
    <div data-slot="period" data-slot-type="content"></div>
  </header>
  <div class="weekly-stats">
    <div class="stat-card stat-green">
      <div data-slot="completed" data-slot-type="data" class="stat-value"></div>
      <div class="stat-label">已完成</div>
    </div>
    <div class="stat-card stat-amber">
      <div data-slot="inProgress" data-slot-type="data" class="stat-value"></div>
      <div class="stat-label">进行中</div>
    </div>
    <div class="stat-card stat-red">
      <div data-slot="issues" data-slot-type="data" class="stat-value"></div>
      <div class="stat-label">问题/风险</div>
    </div>
  </div>
  <section class="weekly-section">
    <div data-slot="achievements" data-slot-type="content"></div>
  </section>
  <section class="weekly-section">
    <div data-slot="risks" data-slot-type="content"></div>
  </section>
  <section class="weekly-section">
    <div data-slot="nextPlan" data-slot-type="content"></div>
  </section>
</div>`,
    cssTemplate: `.weekly-report {
  max-width: 800px; margin: 0 auto; padding: 40px;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
  color: #1a1a2e; background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
}
.weekly-header {
  text-align: center; margin-bottom: 36px;
}
[data-slot="title"] h1 {
  font-size: 24px; font-weight: 700; margin: 0 0 4px; color: #1e293b;
}
[data-slot="period"] p {
  font-size: 14px; color: #64748b; margin: 0;
}
.weekly-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;
}
.stat-card {
  background: #fff; border-radius: 12px; padding: 20px;
  text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.stat-value { font-size: 28px; font-weight: 700; }
.stat-green .stat-value { color: #22c55e; }
.stat-amber .stat-value { color: #f59e0b; }
.stat-red .stat-value { color: #ef4444; }
.stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }
.weekly-section {
  background: #fff; border-radius: 12px; padding: 24px;
  margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
[data-slot="achievements"] h2 {
  font-size: 16px; font-weight: 600; color: #4f46e5; margin: 0 0 12px;
}
[data-slot="achievements"] { font-size: 14px; line-height: 1.8; color: #334155; }
[data-slot="risks"] h2 {
  font-size: 16px; font-weight: 600; color: #f59e0b; margin: 0 0 12px;
}
[data-slot="risks"] { font-size: 14px; line-height: 1.8; color: #334155; }
[data-slot="nextPlan"] h2 {
  font-size: 16px; font-weight: 600; color: #22c55e; margin: 0 0 12px;
}
[data-slot="nextPlan"] { font-size: 14px; line-height: 1.8; color: #334155; }`,
    mdTemplate: `<!-- @slot:title -->
# 项目周报

<!-- @slot:period -->
2026-W01

<!-- @slot:completed -->
5

<!-- @slot:inProgress -->
3

<!-- @slot:issues -->
1

<!-- @slot:achievements -->
## 本周成果

- **功能开发**：完成用户认证模块重构，支持 OAuth 2.0
- **性能优化**：首屏加载时间从 2.8s 降至 1.2s
- **Bug 修复**：修复 3 个 P1 级别问题

> 本周完成率 **83%**，超出预期目标。

<!-- @slot:risks -->
## 问题与风险

- **性能瓶颈**：数据库查询在高并发下响应时间 > 2s，需优化索引
- ~~资源不足~~：已协调到额外支持，风险已解除

<!-- @slot:nextPlan -->
## 下周计划

1. **高优先**：完成 API 接口联调和集成测试
2. **中优先**：优化数据库索引，目标 P99 < 500ms
3. **低优先**：补充单元测试覆盖率至 80%+`,
    slots: {
      title: { label: '报告标题', type: 'content', placeholder: '# 项目周报' },
      period: { label: '周期', type: 'content', placeholder: '2026-W01' },
      completed: { label: '已完成数', type: 'data', placeholder: '0' },
      inProgress: { label: '进行中数', type: 'data', placeholder: '0' },
      issues: { label: '问题数', type: 'data', placeholder: '0' },
      achievements: { label: '本周成果', type: 'content', placeholder: '## 本周成果\n\n列出主要成果' },
      risks: { label: '问题与风险', type: 'content', placeholder: '## 问题与风险\n\n列出问题和风险' },
      nextPlan: { label: '下周计划', type: 'content', placeholder: '## 下周计划\n\n列出下周计划' },
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
    htmlTemplate: `<div class="social-card">
  <div class="social-hero">
    <div class="social-hero-inner">
      <div data-slot="headline" data-slot-type="content"></div>
      <div data-slot="tagline" data-slot-type="content"></div>
    </div>
  </div>
  <div class="social-body">
    <div data-slot="content" data-slot-type="content"></div>
    <div class="social-meta">
      <div data-slot="author" data-slot-type="content" class="social-author"></div>
      <div data-slot="date" data-slot-type="content" class="social-date"></div>
    </div>
  </div>
</div>`,
    cssTemplate: `.social-card {
  width: 640px; margin: 0 auto; border-radius: 16px; overflow: hidden;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
  background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}
.social-hero {
  height: 200px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  display: flex; align-items: center; justify-content: center; padding: 32px;
}
.social-hero-inner { text-align: center; }
[data-slot="headline"] h1 {
  font-size: 28px; font-weight: 700; color: #fff; margin: 0 0 8px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
[data-slot="tagline"] p {
  font-size: 16px; color: rgba(255,255,255,0.85); margin: 0;
}
.social-body {
  padding: 24px 32px;
}
[data-slot="content"] {
  font-size: 15px; line-height: 1.8; color: #334155; margin-bottom: 20px;
}
.social-meta {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 16px; border-top: 1px solid #f1f5f9;
}
.social-author { font-size: 13px; color: #64748b; }
.social-date { font-size: 13px; color: #94a3b8; }`,
    mdTemplate: `<!-- @slot:headline -->
# 标题文字

<!-- @slot:tagline -->
副标题

<!-- @slot:content -->
**核心观点**：用一句话概括你想传达的信息。

要点速览：

- 关键信息一：具体数据或案例
- 关键信息二：独特洞察或趋势
- 关键信息三：行动建议或结论

> *一句引人深思的总结或金句。*

<!-- @slot:author -->
作者

<!-- @slot:date -->
2026-03-03`,
    slots: {
      headline: { label: '标题', type: 'content', placeholder: '# 输入醒目标题' },
      tagline: { label: '副标题', type: 'content', placeholder: '一句话描述' },
      content: { label: '正文', type: 'content', placeholder: '卡片正文内容' },
      author: { label: '作者', type: 'content', placeholder: '作者名' },
      date: { label: '日期', type: 'content', placeholder: '2026-03-03' },
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
    htmlTemplate: `<div class="insight-poster">
  <header class="poster-header">
    <div data-slot="category" data-slot-type="content" class="poster-category"></div>
    <div data-slot="title" data-slot-type="content"></div>
  </header>
  <div class="poster-metrics">
    <div class="metric-card">
      <div data-slot="metric1Value" data-slot-type="data" class="metric-value metric-cyan"></div>
      <div data-slot="metric1Label" data-slot-type="content" class="metric-label"></div>
    </div>
    <div class="metric-card">
      <div data-slot="metric2Value" data-slot-type="data" class="metric-value metric-purple"></div>
      <div data-slot="metric2Label" data-slot-type="content" class="metric-label"></div>
    </div>
  </div>
  <section class="poster-section">
    <div data-slot="insights" data-slot-type="content"></div>
  </section>
  <section class="poster-section">
    <div data-slot="actions" data-slot-type="content"></div>
  </section>
  <footer class="poster-footer">
    <div data-slot="source" data-slot-type="content"></div>
  </footer>
</div>`,
    cssTemplate: `.insight-poster {
  width: 720px; margin: 0 auto; padding: 48px;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  color: #f8fafc; border-radius: 16px;
}
.poster-header {
  text-align: center; margin-bottom: 40px;
}
.poster-category {
  font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #818cf8;
  margin-bottom: 8px;
}
[data-slot="title"] h1 {
  font-size: 32px; font-weight: 700; margin: 0; line-height: 1.3; color: #f8fafc;
}
.poster-metrics {
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 36px;
}
.metric-card {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px; padding: 24px; text-align: center;
}
.metric-value { font-size: 36px; font-weight: 700; }
.metric-cyan { color: #22d3ee; }
.metric-purple { color: #a78bfa; }
.metric-label { font-size: 13px; color: #94a3b8; margin-top: 4px; }
.poster-section { margin-bottom: 32px; }
[data-slot="insights"] h2, [data-slot="actions"] h2 {
  font-size: 16px; font-weight: 600; color: #818cf8; margin: 0 0 12px;
}
[data-slot="insights"], [data-slot="actions"] {
  font-size: 14px; line-height: 1.9; color: #cbd5e1;
}
[data-slot="insights"] strong, [data-slot="actions"] strong { color: #f1f5f9; }
[data-slot="insights"] blockquote {
  border-left-color: #818cf8; color: #94a3b8;
}
.poster-footer {
  margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);
  text-align: center;
}
[data-slot="source"] { font-size: 11px; color: #475569; }`,
    mdTemplate: `<!-- @slot:category -->
数据洞察

<!-- @slot:title -->
# 核心数据标题

<!-- @slot:metric1Value -->
42%

<!-- @slot:metric1Label -->
增长率

<!-- @slot:metric2Value -->
128

<!-- @slot:metric2Label -->
新增用户

<!-- @slot:insights -->
## 关键洞察

- **用户增长加速**：月活环比增长 42%，主要来自自然流量
- **留存率提升**：7 日留存从 35% 提升至 48%，归因于引导流程优化
- **转化瓶颈**：注册→首次使用转化率仅 23%，低于行业均值

> 关键拐点出现在第 3 周，与产品功能迭代节奏高度吻合。

<!-- @slot:actions -->
## 行动建议

1. **优先级 P0**：优化新用户引导流程，目标首次使用转化率 ≥ 40%
2. **优先级 P1**：加大内容营销投入，巩固自然流量增长趋势
3. **优先级 P2**：建立用户分层运营体系，针对性提升留存

<!-- @slot:source -->
数据来源：CoMind · 2026-03`,
    slots: {
      category: { label: '分类标签', type: 'content', placeholder: '数据洞察' },
      title: { label: '海报标题', type: 'content', placeholder: '# 核心数据标题' },
      metric1Value: { label: '指标1数值', type: 'data', placeholder: '42%' },
      metric1Label: { label: '指标1说明', type: 'content', placeholder: '增长率' },
      metric2Value: { label: '指标2数值', type: 'data', placeholder: '128' },
      metric2Label: { label: '指标2说明', type: 'content', placeholder: '新增用户' },
      insights: { label: '关键洞察', type: 'content', placeholder: '## 关键洞察\n\n输入洞察内容' },
      actions: { label: '行动建议', type: 'content', placeholder: '## 行动建议\n\n输入建议内容' },
      source: { label: '数据来源', type: 'content', placeholder: '数据来源和日期' },
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
