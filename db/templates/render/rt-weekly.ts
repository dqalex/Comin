/**
 * 渲染模板：项目周报
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtWeekly: BuiltinRenderTemplate = {
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
};
