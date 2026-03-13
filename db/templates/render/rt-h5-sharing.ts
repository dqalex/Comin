/**
 * 渲染模板：H5 技术分享
 * 支持同名 slot 重复使用，如写4次 <!-- @slot:section --> 渲染4个章节
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtH5Sharing: BuiltinRenderTemplate = {
  id: 'rt-builtin-h5-sharing',
  name: 'H5 技术分享',
  description: '适用于技术分享、方案宣讲的 H5 长页，支持流程图、对比图、步骤图可视化渲染',
  category: 'presentation',
  htmlTemplate: `<div class="h5-sharing">
  <header class="h5-header">
    <div class="h5-header-bg"></div>
    <div class="h5-header-content">
      <div data-slot="title" data-slot-type="content"></div>
      <div class="h5-meta-row">
        <div data-slot="speaker" data-slot-type="content" class="h5-speaker"></div>
        <div data-slot="date" data-slot-type="content" class="h5-date"></div>
      </div>
    </div>
  </header>
  <nav class="h5-toc">
    <div data-slot="outline" data-slot-type="content"></div>
  </nav>
  <!-- 章节区域（循环渲染） -->
  <div class="h5-sections" data-slot-loop="chapter" data-slot-loop-items="section">
    <section class="h5-section">
      <div data-slot="section" data-slot-type="content"></div>
    </section>
    <div class="h5-divider"><span></span></div>
  </div>
  <footer class="h5-footer">
    <div data-slot="summary" data-slot-type="content"></div>
    <div class="h5-footer-bottom">
      <div data-slot="footer" data-slot-type="content"></div>
    </div>
  </footer>
</div>`,
  cssTemplate: `.h5-sharing {
  max-width: 800px; margin: 0 auto; padding: 0;
  font-family: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
  color: #1e293b; background: #fff;
}
/* 头部 */
.h5-header {
  position: relative; padding: 56px 40px 40px; overflow: hidden;
  background: linear-gradient(160deg, #0a0e27 0%, #1a2654 50%, #1e40af 100%);
}
.h5-header-bg {
  position: absolute; top: -60px; right: -60px; width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(96,165,250,0.18) 0%, transparent 65%);
  border-radius: 50%;
}
.h5-header-content { position: relative; z-index: 1; }
[data-slot="title"] h1 {
  font-size: 32px; font-weight: 800; color: #fff; margin: 0 0 20px;
  line-height: 1.35; letter-spacing: -0.5px;
}
.h5-meta-row { display: flex; gap: 20px; align-items: center; }
.h5-speaker { font-size: 14px; color: rgba(255,255,255,0.75); }
.h5-date { font-size: 13px; color: rgba(255,255,255,0.45); }
/* 目录 */
.h5-toc {
  padding: 24px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
}
[data-slot="outline"] h2 {
  font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 10px;
  text-transform: uppercase; letter-spacing: 1.5px;
}
[data-slot="outline"] ol { margin: 0; padding-left: 1.3em; }
[data-slot="outline"] li { font-size: 14px; color: #475569; line-height: 1.9; font-weight: 500; }
/* 内容区 */
.h5-section { padding: 40px 40px; }
.h5-section h2 {
  font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 20px;
  padding-left: 14px; border-left: 4px solid #2563eb;
}
.h5-section h3 {
  font-size: 16px; font-weight: 600; color: #1e40af; margin: 28px 0 10px;
}
.h5-section p { font-size: 15px; line-height: 1.85; color: #334155; }
.h5-section ul, .h5-section ol { margin: 8px 0; padding-left: 1.5em; }
.h5-section li { font-size: 15px; line-height: 1.85; color: #334155; margin: 4px 0; }
.h5-section strong { color: #0f172a; }
.h5-section blockquote {
  margin: 16px 0; padding: 14px 20px; border-left: 4px solid #2563eb;
  background: #eff6ff; border-radius: 0 8px 8px 0; font-size: 15px; color: #1e40af;
}
/* 表格 */
.h5-section table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  margin: 16px 0; border-radius: 8px; overflow: hidden;
  border: 1px solid #e2e8f0; font-size: 14px;
}
.h5-section th {
  background: #1e293b; color: #fff; font-weight: 600;
  padding: 10px 14px; text-align: left;
}
.h5-section td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.h5-section tr:last-child td { border-bottom: none; }
.h5-section tr:nth-child(even) td { background: #f8fafc; }
/* 普通代码块 */
.h5-section pre {
  margin: 16px 0; padding: 20px 24px; border-radius: 10px;
  background: #0f172a; overflow-x: auto;
}
.h5-section pre code {
  font-family: 'SF Mono', 'Fira Code', 'Menlo', monospace;
  font-size: 13px; line-height: 1.7; color: #e2e8f0; background: none; padding: 0;
}
.h5-section code {
  background: rgba(37,99,235,0.08); color: #1e40af;
  padding: 2px 6px; border-radius: 4px; font-size: 0.88em;
}
/* 语义图表覆盖样式 */
.h5-section .sd-flow { padding: 1.5em 1em; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
.h5-section .sd-flow-node {
  background: #fff; border-color: #2563eb; box-shadow: 0 1px 4px rgba(37,99,235,0.1);
  padding: 10px 28px; font-weight: 500; min-width: 120px;
}
.h5-section .sd-flow-box { background: #fff; border-color: #2563eb; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.h5-section .sd-flow-label {
  background: #2563eb; color: #fff; border-radius: 6px;
  padding: 5px 16px; font-size: 0.8em; font-weight: 700;
  letter-spacing: 1px;
}
.h5-section .sd-flow-arrow { color: #2563eb; font-weight: 700; }
.h5-section .sd-flow-group { background: rgba(37,99,235,0.03); border-radius: 10px; padding: 12px 8px; }
.h5-section .sd-flow-row .sd-flow-node { font-size: 0.88em; }
.h5-section .sd-status-success { border-color: #16a34a; background: #f0fdf4; color: #15803d; font-weight: 600; }
.h5-section .sd-status-error { border-color: #dc2626; background: #fef2f2; color: #b91c1c; font-weight: 600; }
.h5-section .sd-status-warn { border-color: #d97706; background: #fffbeb; color: #b45309; font-weight: 600; }
.h5-section .sd-compare { gap: 20px; }
.h5-section .sd-compare-col { background: #fff; border-color: #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-radius: 12px; }
.h5-section .sd-compare-title { background: #f1f5f9; font-size: 0.95em; padding: 12px 16px; }
.h5-section .sd-steps { gap: 4px; padding: 1em 0; }
.h5-section .sd-step-num { background: #2563eb; color: #fff; width: 36px; height: 36px; font-size: 0.9em; }
/* 分隔线 */
.h5-divider {
  display: flex; align-items: center; justify-content: center; padding: 0 40px;
}
.h5-divider span {
  display: block; width: 100%; height: 1px;
  background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
}
/* 底部 */
.h5-footer { padding: 40px 40px 24px; background: #0f172a; color: #e2e8f0; }
[data-slot="summary"] h2 {
  font-size: 20px; font-weight: 700; color: #60a5fa; margin: 0 0 16px;
  padding-left: 14px; border-left: 4px solid #60a5fa;
}
[data-slot="summary"] { font-size: 15px; line-height: 1.85; color: #cbd5e1; }
[data-slot="summary"] strong { color: #f1f5f9; }
[data-slot="summary"] blockquote {
  border-left: 3px solid #60a5fa; padding: 10px 16px; margin: 16px 0;
  color: #93c5fd; font-size: 17px; font-weight: 500; background: rgba(96,165,250,0.08);
  border-radius: 0 8px 8px 0;
}
[data-slot="summary"] .sd-flow { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
[data-slot="summary"] .sd-flow-node { background: rgba(255,255,255,0.08); border-color: rgba(96,165,250,0.3); color: #e2e8f0; }
[data-slot="summary"] .sd-flow-arrow { color: rgba(96,165,250,0.5); }
[data-slot="summary"] .sd-flow-label { background: rgba(96,165,250,0.2); color: #93c5fd; }
[data-slot="summary"] .sd-flow-group { background: rgba(255,255,255,0.03); }
[data-slot="summary"] .sd-steps { }
[data-slot="summary"] .sd-step-num { background: #60a5fa; color: #0f172a; }
[data-slot="summary"] .sd-step-label { color: #e2e8f0; }
[data-slot="summary"] .sd-step-arrow { color: rgba(96,165,250,0.5); }
.h5-footer-bottom {
  margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);
  text-align: center;
}
[data-slot="footer"] { font-size: 12px; color: #475569; }`,
  mdTemplate: `<!-- @slot:title -->
# API 性能优化实战指南

<!-- @slot:speaker -->
分享人：张三

<!-- @slot:date -->
2026 年 3 月

<!-- @slot:outline -->
## 目录

1. 问题背景：为什么接口变慢了
2. 分析方法：定位瓶颈
3. 优化实践：三步提速
4. 效果验证与经验总结

<!-- @slot:section -->
## 问题背景

### 现状与目标

接口响应时间持续上升，用户体验明显下降：

| 指标 | 现状 | 目标 |
| --- | --- | --- |
| P50 响应时间 | 800ms | < 200ms |
| P99 响应时间 | 3.2s | < 1s |
| 错误率 | 2.1% | < 0.5% |

### 问题本质

\`\`\`flow
用户请求到达
  ▼
API 网关转发
  ▼
业务逻辑处理（快，10ms）
  ▼
数据库查询（慢！600ms）
  ▼
数据序列化返回
\`\`\`

> 80% 的耗时集中在数据库查询层，这是我们的优化重点。

<!-- @slot:section -->
## 分析方法

### 用什么工具定位

| 工具 | 用途 | 关键指标 |
| --- | --- | --- |
| APM 监控 | 全链路追踪 | 各环节耗时占比 |
| 慢查询日志 | 定位慢 SQL | 执行时间 > 100ms |
| EXPLAIN 分析 | 查看执行计划 | 是否走索引 |

### 优化前 vs 优化后的架构

\`\`\`compare
┌──────────────────────┐
│  优化前               │
│  ❌ 每次全表扫描      │
│  ❌ 无缓存层          │
│  ❌ 单数据库连接      │
│  ❌ 同步阻塞调用      │
└──────────────────────┘
┌──────────────────────┐
│  优化后               │
│  ✅ 索引覆盖查询      │
│  ✅ Redis 缓存热数据  │
│  ✅ 连接池管理        │
│  ✅ 异步非阻塞        │
└──────────────────────┘
\`\`\`

<!-- @slot:section -->
## 优化实践

### 三步提速路线

\`\`\`steps
① 索引优化
  ▼
② 缓存策略
  ▼
③ 查询重构
\`\`\`

### 第一步：索引优化

- **复合索引**：为高频查询添加覆盖索引
- **索引清理**：删除 3 个无效冗余索引
- **效果**：P50 从 800ms 降至 350ms

### 第二步：缓存策略

\`\`\`flow
请求到达
  ▼
查 Redis 缓存
  ▼
┌──────────────────────┐
│  缓存命中？           │
│  ✅ 命中 → 直接返回   │
│  ❌ 未命中 → 查数据库  │
└──────────────────────┘
  ▼
写回缓存（TTL 5分钟）
  ▼
返回结果
\`\`\`

### 第三步：查询重构

- 将 N+1 查询合并为 JOIN 查询
- 分页查询改用游标分页
- 大字段延迟加载

<!-- @slot:section -->
## 效果与总结

### 优化效果

| 指标 | 优化前 | 优化后 | 提升 |
| --- | --- | --- | --- |
| P50 响应时间 | 800ms | 120ms | 85% |
| P99 响应时间 | 3.2s | 480ms | 85% |
| 错误率 | 2.1% | 0.3% | 86% |
| QPS 承载 | 500 | 2000 | 4x |

### 关键经验

\`\`\`compare
┌──────────────────────┐
│  ✅ 做对的            │
│  ✅ 先测量再优化      │
│  ✅ 一次改一个变量    │
│  ✅ 有回滚方案        │
└──────────────────────┘
┌──────────────────────┐
│  ❌ 踩过的坑          │
│  ❌ 盲目加索引        │
│  ❌ 缓存雪崩没预案    │
│  ❌ 没做压测就上线    │
└──────────────────────┘
\`\`\`

> 性能优化的核心不是"猜"，而是**测量 → 定位 → 修复 → 验证**的闭环。

<!-- @slot:summary -->
## 总结

\`\`\`steps
① 发现问题
  ▼
② 测量定位
  ▼
③ 索引优化
  ▼
④ 缓存策略
  ▼
⑤ 查询重构
  ▼
⑥ 效果验证
\`\`\`

- **核心方法**：用数据说话，先量化再行动
- **优化顺序**：索引 → 缓存 → 查询重构（成本递增）
- **持续运营**：建立监控告警，防止性能回退

> **80% 的性能问题来自 20% 的代码路径，找到它、修好它。**

<!-- @slot:footer -->
H5 技术分享 · 由 TeamClaw 渲染`,
  slots: {
    title: { label: '分享标题', type: 'content', placeholder: '# 输入分享主题' },
    speaker: { label: '分享人', type: 'content', placeholder: '分享人：姓名' },
    date: { label: '日期', type: 'content', placeholder: '2026 年 3 月' },
    outline: { label: '目录大纲', type: 'content', placeholder: '## 目录\n\n1. 章节一\n2. 章节二' },
    section: { label: '章节内容', type: 'content', placeholder: '## 章节标题\n\n章节内容，支持多次使用' },
    summary: { label: '总结', type: 'content', placeholder: '## 总结\n\n关键要点...' },
    footer: { label: '页脚', type: 'content', placeholder: '页脚文字' },
  },
  sections: [
    { id: 'header', label: '标题区', slots: ['title', 'speaker', 'date'] },
    { id: 'outline', label: '目录', slots: ['outline'] },
    { id: 'content', label: '内容区', slots: ['section'] },
    { id: 'footer', label: '总结与页脚', slots: ['summary', 'footer'] },
  ],
  exportConfig: { formats: ['jpg', 'html', 'pdf'], defaultWidth: 800, defaultScale: 2, mode: 'long' },
};
