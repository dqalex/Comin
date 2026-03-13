/**
 * 渲染模板：数据洞察海报
 * 支持同名 slot 重复使用，如写多个 <!-- @slot:insight --> 或 <!-- @slot:action -->
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtInsightPoster: BuiltinRenderTemplate = {
  id: 'rt-builtin-insight-poster',
  name: '数据洞察海报',
  description: '适用于数据分析结论展示，突出核心数字和洞察',
  category: 'poster',
  htmlTemplate: `<div class="insight-poster">
  <header class="poster-header">
    <div data-slot="category" data-slot-type="content" class="poster-category"></div>
    <div data-slot="title" data-slot-type="content"></div>
  </header>
  <!-- 指标卡片（循环渲染） -->
  <div class="poster-metrics" data-slot-loop="metric" data-slot-loop-items="metricValue,metricLabel">
    <div class="metric-card">
      <div data-slot="metricValue" data-slot-type="data" class="metric-value metric-cyan"></div>
      <div data-slot="metricLabel" data-slot-type="content" class="metric-label"></div>
    </div>
  </div>
  <!-- 洞察区块（循环渲染） -->
  <div class="poster-insights" data-slot-loop="insight" data-slot-loop-items="insight">
    <section class="poster-section">
      <div data-slot="insight" data-slot-type="content"></div>
    </section>
  </div>
  <!-- 行动建议区块（循环渲染） -->
  <div class="poster-actions" data-slot-loop="action" data-slot-loop-items="action">
    <section class="poster-section">
      <div data-slot="action" data-slot-type="content"></div>
    </section>
  </div>
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
[data-slot="insight"] h2, [data-slot="action"] h2 {
  font-size: 16px; font-weight: 600; color: #818cf8; margin: 0 0 12px;
}
[data-slot="insight"], [data-slot="action"] {
  font-size: 14px; line-height: 1.9; color: #cbd5e1;
}
[data-slot="insight"] strong, [data-slot="action"] strong { color: #f1f5f9; }
[data-slot="insight"] blockquote {
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

<!-- @slot:metricValue -->
42%

<!-- @slot:metricLabel -->
增长率

<!-- @slot:metricValue -->
128

<!-- @slot:metricLabel -->
新增用户

<!-- @slot:insight -->
## 关键洞察

- **用户增长加速**：月活环比增长 42%，主要来自自然流量
- **留存率提升**：7 日留存从 35% 提升至 48%，归因于引导流程优化
- **转化瓶颈**：注册→首次使用转化率仅 23%，低于行业均值

> 关键拐点出现在第 3 周，与产品功能迭代节奏高度吻合。

<!-- @slot:action -->
## 行动建议

1. **优先级 P0**：优化新用户引导流程，目标首次使用转化率 ≥ 40%
2. **优先级 P1**：加大内容营销投入，巩固自然流量增长趋势
3. **优先级 P2**：建立用户分层运营体系，针对性提升留存

<!-- @slot:source -->
数据来源：TeamClaw · 2026-03`,
  slots: {
    category: { label: '分类标签', type: 'content', placeholder: '数据洞察' },
    title: { label: '海报标题', type: 'content', placeholder: '# 核心数据标题' },
    metricValue: { label: '指标数值', type: 'data', placeholder: '42%' },
    metricLabel: { label: '指标说明', type: 'content', placeholder: '增长率' },
    insight: { label: '洞察区块', type: 'content', placeholder: '## 关键洞察\n\n输入洞察内容，支持多次使用' },
    action: { label: '行动建议', type: 'content', placeholder: '## 行动建议\n\n输入建议内容，支持多次使用' },
    source: { label: '数据来源', type: 'content', placeholder: '数据来源和日期' },
  },
  sections: [
    { id: 'header', label: '标题区', slots: ['category', 'title'] },
    { id: 'metrics', label: '核心指标', slots: ['metricValue', 'metricLabel'] },
    { id: 'insights', label: '洞察区块', slots: ['insight'] },
    { id: 'actions', label: '行动建议', slots: ['action'] },
    { id: 'footer', label: '页脚', slots: ['source'] },
  ],
  exportConfig: { formats: ['jpg', 'png', 'html'], defaultWidth: 720, defaultScale: 2, mode: 'long' },
};
