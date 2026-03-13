/**
 * 渲染模板：简约报告卡片
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtReportCard: BuiltinRenderTemplate = {
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
由 TeamClaw 生成`,
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
};
