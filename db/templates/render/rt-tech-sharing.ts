/**
 * 渲染模板：技术分享
 * 支持同名 slot 重复使用，如写4次 <!-- @slot:section --> 渲染4个章节
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtTechSharing: BuiltinRenderTemplate = {
  id: 'rt-builtin-tech-sharing',
  name: '技术分享',
  description: '适用于技术分享、内部培训、方案宣讲等场景，支持流程图、对比表格和代码块展示',
  category: 'presentation',
  htmlTemplate: `<div class="tech-sharing">
  <header class="ts-header">
    <div data-slot="title" data-slot-type="content"></div>
    <div class="ts-meta">
      <div data-slot="speaker" data-slot-type="content" class="ts-speaker"></div>
      <div data-slot="date" data-slot-type="content" class="ts-date"></div>
    </div>
  </header>
  <nav class="ts-outline">
    <div data-slot="outline" data-slot-type="content"></div>
  </nav>
  <!-- 章节区域（循环渲染） -->
  <div class="ts-sections" data-slot-loop="chapter" data-slot-loop-items="sectionNum,section">
    <section class="ts-section ts-section-alt">
      <div class="ts-section-num" data-slot="sectionNum" data-slot-type="content"></div>
      <div data-slot="section" data-slot-type="content"></div>
    </section>
  </div>
  <footer class="ts-footer">
    <div data-slot="summary" data-slot-type="content"></div>
    <div class="ts-footer-bar">
      <div data-slot="footer" data-slot-type="content"></div>
    </div>
  </footer>
</div>`,
  cssTemplate: `.tech-sharing {
  max-width: 960px; margin: 0 auto; padding: 0;
  font-family: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
  color: #1e293b; background: #f8fafc;
}
.ts-header {
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #2563eb 100%);
  color: #fff; padding: 64px 56px 48px; position: relative; overflow: hidden;
}
.ts-header::after {
  content: ''; position: absolute; top: -40%; right: -10%; width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%);
  border-radius: 50%;
}
[data-slot="title"] h1 {
  font-size: 36px; font-weight: 800; margin: 0 0 24px; line-height: 1.3;
  color: #fff; position: relative; z-index: 1;
}
.ts-meta { display: flex; gap: 24px; align-items: center; position: relative; z-index: 1; }
.ts-speaker { font-size: 15px; color: rgba(255,255,255,0.8); }
.ts-date { font-size: 14px; color: rgba(255,255,255,0.5); }
.ts-outline {
  background: #fff; border-bottom: 1px solid #e2e8f0; padding: 28px 56px;
}
[data-slot="outline"] h2 {
  font-size: 16px; font-weight: 700; color: #2563eb; margin: 0 0 12px;
  text-transform: uppercase; letter-spacing: 1px;
}
[data-slot="outline"] ol { padding-left: 1.4em; margin: 0; }
[data-slot="outline"] li {
  font-size: 15px; color: #475569; line-height: 2; font-weight: 500;
}
.ts-section { padding: 48px 56px; background: #fff; }
.ts-section-alt { background: #f1f5f9; }
.ts-section-num {
  font-size: 48px; font-weight: 900; color: rgba(37,99,235,0.08);
  line-height: 1; margin-bottom: -8px; font-family: 'Helvetica Neue', sans-serif;
}
.ts-section h2 {
  font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 20px;
  padding-bottom: 12px; border-bottom: 2px solid #2563eb;
}
.ts-section h3 {
  font-size: 17px; font-weight: 600; color: #1e40af; margin: 24px 0 10px;
}
.ts-section p { font-size: 15px; line-height: 1.85; color: #334155; }
.ts-section ul, .ts-section ol { margin: 8px 0; padding-left: 1.6em; }
.ts-section li { font-size: 15px; line-height: 1.85; color: #334155; margin: 4px 0; }
.ts-section strong { color: #0f172a; }
.ts-section blockquote {
  margin: 16px 0; padding: 12px 20px; border-left: 4px solid #2563eb;
  background: rgba(37,99,235,0.04); border-radius: 0 8px 8px 0;
  font-size: 15px; color: #475569;
}
.ts-section table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  margin: 16px 0; border-radius: 8px; overflow: hidden;
  border: 1px solid #e2e8f0; font-size: 14px;
}
.ts-section th {
  background: #1e293b; color: #fff; font-weight: 600;
  padding: 10px 16px; text-align: left;
}
.ts-section td {
  padding: 10px 16px; border-bottom: 1px solid #f1f5f9; color: #334155;
}
.ts-section tr:last-child td { border-bottom: none; }
.ts-section tr:nth-child(even) td { background: #f8fafc; }
.ts-section pre {
  margin: 16px 0; padding: 20px 24px; border-radius: 10px;
  background: #0f172a; overflow-x: auto; position: relative;
}
.ts-section pre code {
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Menlo', monospace;
  font-size: 13.5px; line-height: 1.7; color: #e2e8f0;
  background: none; padding: 0; white-space: pre;
}
.ts-section code {
  background: rgba(37,99,235,0.08); color: #1e40af;
  padding: 2px 6px; border-radius: 4px; font-size: 0.9em;
}
.ts-footer { padding: 48px 56px 24px; background: #0f172a; color: #e2e8f0; }
[data-slot="summary"] h2 {
  font-size: 20px; font-weight: 700; color: #60a5fa; margin: 0 0 16px;
}
[data-slot="summary"] { font-size: 15px; line-height: 1.85; color: #cbd5e1; }
[data-slot="summary"] strong { color: #f1f5f9; }
[data-slot="summary"] blockquote {
  border-left: 3px solid #60a5fa; padding: 8px 16px; margin: 16px 0;
  color: #93c5fd; font-size: 17px; font-weight: 500;
}
.ts-footer-bar {
  margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);
  text-align: center;
}
[data-slot="footer"] { font-size: 12px; color: #475569; }`,
  mdTemplate: `<!-- @slot:title -->
# 如何用自动化提升团队效率

<!-- @slot:speaker -->
分享人：张三

<!-- @slot:date -->
2026 年 3 月

<!-- @slot:outline -->
## 目录

1. 背景：为什么要做自动化
2. 方案设计：选型与架构
3. 实战：从 0 到 1 搭建
4. 推广：团队落地经验

<!-- @slot:sectionNum -->
01

<!-- @slot:section -->
## 背景与问题

### 效率瓶颈在哪里？

团队日常工作中存在大量重复操作：

| 场景 | 手动耗时 | 频率 | 月总耗时 |
| --- | --- | --- | --- |
| 日报汇总 | 30 分钟 | 每天 | 10 小时 |
| 数据导出 | 20 分钟 | 每天 | 7 小时 |
| 格式整理 | 15 分钟 | 每天 | 5 小时 |

> 仅重复性工作每月就消耗 22+ 小时/人，占总工时 **15%**。

### 目标

\`\`\`
手动流程（现状）                        自动化流程（目标）
┌─────────────────┐                ┌──────────────────┐
│ ❌ 手动收集数据  │                │ ✅ 脚本自动拉取  │
│ ❌ 手动整理格式  │                │ ✅ 模板自动填充  │
│ ❌ 手动发送邮件  │                │ ✅ 定时自动推送  │
└─────────────────┘                └──────────────────┘
\`\`\`

<!-- @slot:sectionNum -->
02

<!-- @slot:section -->
## 方案设计

### 技术选型

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 低代码平台 | 快速搭建 | 灵活度低 | 备选 |
| Python 脚本 | 灵活强大 | 需要开发能力 | 核心方案 |
| 第三方 SaaS | 开箱即用 | 数据合规风险 | 不采用 |

### 整体架构

\`\`\`
数据源          处理层              输出层
┌─────┐     ┌──────────┐      ┌──────────┐
│ API │────▶│ 数据清洗  │─────▶│ 报告生成 │
│ DB  │────▶│ 指标计算  │─────▶│ 邮件推送 │
│ 文件 │────▶│ 格式转换  │─────▶│ 文件归档 │
└─────┘     └──────────┘      └──────────┘
\`\`\`

### 关键设计决策

1. **配置化**：所有参数外置到配置文件，不硬编码
2. **幂等性**：重复执行不会产生重复数据
3. **可观测**：每步有日志，异常自动告警

<!-- @slot:sectionNum -->
03

<!-- @slot:section -->
## 实战过程

### 阶段一：跑通最小闭环

先挑一个最简单的场景——日报自动生成：

- **输入**：数据库查询结果
- **处理**：按模板填充、计算同比环比
- **输出**：Markdown 日报 + 邮件发送

\`\`\`
第一周：写脚本，跑通数据拉取 → 报告生成
第二周：加邮件推送，测试定时任务
第三周：补充异常处理和重试机制
\`\`\`

> 关键经验：**先跑通再优化，不要追求一次完美。**

### 阶段二：标准化和复用

把日报的经验提炼为通用框架：

- 数据源适配器（支持 API / DB / 文件）
- 模板渲染引擎（Markdown + HTML）
- 推送通道（邮件 / 企微 / 飞书）

### 阶段三：团队推广

| 步骤 | 做法 | 效果 |
| --- | --- | --- |
| 示范 | 先给一个小组用 | 月省 15 小时 |
| 培训 | 30 分钟上手课 | 3 人独立使用 |
| 推广 | 全团队覆盖 | 月省 60+ 小时 |

<!-- @slot:sectionNum -->
04

<!-- @slot:section -->
## 效果与复盘

### 量化收益

| 指标 | 优化前 | 优化后 | 提升 |
| --- | --- | --- | --- |
| 日报耗时 | 30 分钟/天 | 0（自动） | 100% |
| 数据导出 | 20 分钟/次 | 2 分钟/次 | 90% |
| 出错率 | 约 5% | < 0.5% | 10x |

### 踩坑总结

- **别一上来就做大而全**：先解决一个具体痛点
- **配置化很重要**：需求一定会变，硬编码 = 返工
- **监控不能少**：自动化出错比手动出错更难发现

> 自动化不是"一次做完就不管了"，而是需要持续维护和迭代。

<!-- @slot:summary -->
## 总结

\`\`\`
① 发现重复 → ② 选方案 → ③ 跑通闭环 → ④ 标准化 → ⑤ 团队推广
\`\`\`

- **核心思路**：先想清楚输入和输出，中间过程交给自动化
- **落地关键**：从最小场景切入，跑通再扩展
- **持续运营**：定期复盘，持续优化

> **把重复的交给机器，把创造的留给自己。**

<!-- @slot:footer -->
技术分享 · 由 TeamClaw 渲染`,
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
    { id: 'content', label: '内容区', slots: ['sectionNum', 'section'] },
    { id: 'footer', label: '总结与页脚', slots: ['summary', 'footer'] },
  ],
  exportConfig: { formats: ['jpg', 'html', 'pdf'], defaultWidth: 960, defaultScale: 2, mode: 'long' },
};
