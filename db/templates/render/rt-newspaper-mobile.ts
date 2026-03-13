/**
 * 渲染模板：报纸风格 - 竖版手机骨架版
 * HTML仅保留骨架，所有内容通过MD填充
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtNewspaperMobile: BuiltinRenderTemplate = {
  id: 'rt-builtin-newspaper-mobile',
  name: '报纸风格-竖版高密',
  description: '竖版手机报纸骨架模板，所有内容通过MD填充',
  category: 'report',
  htmlTemplate: `<div class="npm">
  <div class="npm-hd" data-slot="header" data-slot-type="content"></div>
  <div class="npm-title" data-slot="title" data-slot-type="content"></div>
  <div class="npm-body" data-slot="body" data-slot-type="content"></div>
  <div class="npm-ft" data-slot="footer" data-slot-type="content"></div>
</div>`,
  cssTemplate: `.npm {
  max-width: 480px;
  margin: 0 auto;
  background: #f5f3f0;
  color: #1a1a1a;
  font-family: 'Noto Serif SC', Georgia, serif;
  line-height: 1.7;
  padding: 16px;
}
.npm-hd {
  text-align: center;
  border-bottom: 3px double #1a1a1a;
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.npm-title {
  margin-bottom: 16px;
}
.npm-title h1 {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
}
.npm-title h2 {
  font-size: 13px;
  color: #555;
  font-style: italic;
  margin: 8px 0 0;
}
.npm-body {
  font-size: 13px;
  text-align: justify;
}
.npm-body p {
  margin: 0 0 12px;
  text-indent: 2em;
}
.npm-ft {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 2px solid #1a1a1a;
  text-align: center;
  font-size: 11px;
  color: #666;
}`,
  mdTemplate: `<!-- @slot:header -->
NO. 001 | 2026.03.09 | ☀️ 晴

每日科技报

记录科技脉搏 · 洞察未来趋势

<!-- @slot:title -->
## TeamClaw v3.0 正式发布：AI Agent 管理进入新纪元

全新版本带来更智能的任务分配和实时协作体验

<!-- @slot:body -->
3月9日，TeamClaw团队正式发布v3.0版本。这是自项目启动以来最重要的里程碑，新版本引入了AI Agent自动调度、智能任务分解、实时协作等核心功能。

据项目负责人介绍，v3.0版本历时6个月开发，集成了来自20+企业的反馈建议。

## 核心数据

| 指标 | 数据 |
|------|------|
| 效率提升 | **85%** |
| 速度增长 | **4x** |
| 成本降低 | **60%** |

## 技术架构升级

后端全面重构为微服务架构，支持水平扩展。新增的Gateway模块提供统一的Agent通信协议，延迟降低60%。

> "TeamClaw v3.0重新定义了AI辅助工作的范式。"

## 性能优化成果

首屏加载时间从2.8s降至0.9s，支持千人同时在线协作。

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| P50响应 | 800ms | 120ms |
| P99响应 | 3.2s | 480ms |
| 错误率 | 2.1% | 0.3% |

## 快讯

- **[产品]** QClaw客户端上线
- **[合作]** 三家头部企业达成战略合作
- **[开源]** Gateway协议Q2开源

<!-- @slot:footer -->
第A01版·科技 | © 2026 每日科技报`,
  slots: {
    header: { label: '报头', type: 'content', placeholder: '期号 | 日期 | 天气\n\n报名\n\n标语' },
    title: { label: '标题区', type: 'content', placeholder: '## 主标题\n副标题' },
    body: { label: '正文', type: 'content', placeholder: '正文内容...' },
    footer: { label: '底部', type: 'content', placeholder: '版次 | 版权' },
  },
  sections: [
    { id: 'header', label: '报头', slots: ['header'] },
    { id: 'title', label: '标题', slots: ['title'] },
    { id: 'body', label: '正文', slots: ['body'] },
    { id: 'footer', label: '底部', slots: ['footer'] },
  ],
  exportConfig: { formats: ['jpg', 'html'], defaultWidth: 480, defaultScale: 2, mode: 'long' },
};
