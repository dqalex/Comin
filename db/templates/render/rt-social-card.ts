/**
 * 渲染模板：社交媒体卡片
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtSocialCard: BuiltinRenderTemplate = {
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
};
