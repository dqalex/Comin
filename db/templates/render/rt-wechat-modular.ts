/**
 * 渲染模板：公众号文章 - 模块化完整版
 * 1:1 复刻现代公众号文章风格，支持一对多 slot 映射
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtWechatModular: BuiltinRenderTemplate = {
  id: 'rt-builtin-wechat-modular',
  name: '公众号文章-模块化',
  description: '高信息密度公众号风格，1:1复刻模块化布局，支持一对多slot映射',
  category: 'report',
  htmlTemplate: `<div class="wmod">
  <!-- 标题区 -->
  <div class="wmod-title">
    <div class="wmod-title-tag" data-slot="titleTag" data-slot-type="content"></div>
    <h1 class="wmod-title-main" data-slot="titleMain" data-slot-type="content"></h1>
    <div class="wmod-title-sub" data-slot="titleSub" data-slot-type="content"></div>
  </div>

  <!-- 封面图 -->
  <div class="wmod-cover" data-slot="cover" data-slot-type="image"></div>

  <!-- 导语 -->
  <div class="wmod-lead" data-slot="lead" data-slot-type="content"></div>

  <!-- Feature 卡片区 -->
  <div class="wmod-features">
    <div class="wmod-features-header" data-slot="featuresHeader" data-slot-type="content"></div>
    <div class="wmod-features-grid" data-slot="featuresGrid" data-slot-type="content"></div>
    <div class="wmod-features-summary" data-slot="featuresSummary" data-slot-type="content"></div>
  </div>

  <!-- Part 分区（循环区域） -->
  <div class="wmod-parts" data-slot-loop="part" data-slot-loop-items="partNum,partTitle,partImg,partContent">
    <div class="wmod-part">
      <div class="wmod-part-header">
        <span class="wmod-part-num" data-slot="partNum" data-slot-type="content"></span>
        <span class="wmod-part-divider"></span>
        <span class="wmod-part-title" data-slot="partTitle" data-slot-type="content"></span>
      </div>
      <div class="wmod-part-img" data-slot="partImg" data-slot-type="image"></div>
      <div class="wmod-part-content" data-slot="partContent" data-slot-type="content"></div>
    </div>
  </div>

  <!-- Case 案例区（循环区域） -->
  <div class="wmod-cases" data-slot-loop="case" data-slot-loop-items="caseNum,caseTitle,caseContent">
    <div class="wmod-case">
      <div class="wmod-case-header">
        <span class="wmod-case-num" data-slot="caseNum" data-slot-type="content"></span>
        <span class="wmod-case-title" data-slot="caseTitle" data-slot-type="content"></span>
      </div>
      <div class="wmod-case-content" data-slot="caseContent" data-slot-type="content"></div>
    </div>
  </div>

  <!-- 总结区 -->
  <div class="wmod-summary">
    <div class="wmod-summary-header">
      <span class="wmod-summary-num">LAST</span>
      <span class="wmod-summary-divider"></span>
      <span class="wmod-summary-title" data-slot="summaryTitle" data-slot-type="content"></span>
    </div>
    <div class="wmod-summary-content" data-slot="summaryContent" data-slot-type="content"></div>
    <div class="wmod-summary-quote" data-slot="summaryQuote" data-slot-type="content"></div>
  </div>

  <!-- 版权区 -->
  <div class="wmod-copyright" data-slot="copyright" data-slot-type="content"></div>

</div>`,
  cssTemplate: `/* ===== 基础 ===== */
.wmod {
  max-width: 480px;
  margin: 0 auto;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  color: #1a1a1a;
  line-height: 1.75;
}

/* ===== 标题区 ===== */
.wmod-title {
  padding: 0 16px 16px;
}
.wmod-title-tag {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  margin-bottom: 12px;
  letter-spacing: 1px;
}
.wmod-title-tag p { margin: 0; }
.wmod-title-main {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0 0 8px;
  color: #1a1a1a;
}
.wmod-title-main p { margin: 0; font-size: 24px; font-weight: 700; line-height: 1.4; }
.wmod-title-sub {
  font-size: 15px;
  color: #666;
  line-height: 1.6;
}
.wmod-title-sub p { margin: 0; }

/* ===== 封面图 ===== */
.wmod-cover {
  margin: 0 0 16px;
}
.wmod-cover img {
  width: 100%;
  height: auto;
  display: block;
}

/* ===== 导语 ===== */
.wmod-lead {
  padding: 0 16px;
  font-size: 15px;
  color: #333;
  line-height: 1.8;
  margin-bottom: 24px;
}
.wmod-lead p { margin: 0; }

/* ===== Feature 卡片区 ===== */
.wmod-features {
  margin: 0 16px 24px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: #fff;
}
.wmod-features-header {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}
.wmod-features-header p { margin: 0; }
.wmod-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.wmod-features-grid ul, .wmod-features-grid ol {
  display: contents;
  list-style: none;
  padding: 0;
  margin: 0;
}
.wmod-features-grid li {
  background: rgba(255,255,255,0.15);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  list-style: none;
}
.wmod-features-grid li strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}
.wmod-features-grid li p { margin: 0; font-size: 12px; opacity: 0.9; }
.wmod-features-summary {
  font-size: 13px;
  opacity: 0.9;
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.2);
}
.wmod-features-summary p { margin: 0; }

/* ===== Part 分区 ===== */
.wmod-parts {
  margin: 0 16px 24px;
}
.wmod-part {
  margin-bottom: 24px;
}
.wmod-part:last-child {
  margin-bottom: 0;
}
.wmod-part-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.wmod-part-num {
  font-size: 12px;
  font-weight: 700;
  color: #667eea;
  letter-spacing: 2px;
}
.wmod-part-divider {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, #667eea, transparent);
  margin: 0 12px;
}
.wmod-part-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}
.wmod-part-title p { margin: 0; font-size: 18px; font-weight: 700; }
.wmod-part-img {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
}
.wmod-part-img img {
  width: 100%;
  height: auto;
  display: block;
}
.wmod-part-content {
  font-size: 15px;
  color: #333;
  line-height: 1.8;
}
.wmod-part-content p { margin: 0 0 1em; }
.wmod-part-content ol, .wmod-part-content ul {
  margin: 0 0 1em;
  padding-left: 1.5em;
}
.wmod-part-content li { margin: 6px 0; }

/* ===== Case 案例区 ===== */
.wmod-cases {
  margin: 0 16px 24px;
}
.wmod-case {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.wmod-case:last-child {
  margin-bottom: 0;
}
.wmod-case-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.wmod-case-num {
  display: inline-block;
  padding: 4px 8px;
  background: #667eea;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  margin-right: 10px;
  letter-spacing: 1px;
}
.wmod-case-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}
.wmod-case-title p { margin: 0; font-size: 16px; font-weight: 600; }
.wmod-case-content {
  font-size: 14px;
  color: #666;
  line-height: 1.7;
}
.wmod-case-content p { margin: 0; }

/* ===== 总结区 ===== */
.wmod-summary {
  margin: 0 16px 24px;
  padding: 20px;
  background: #fafafa;
  border-radius: 12px;
}
.wmod-summary-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.wmod-summary-num {
  font-size: 12px;
  font-weight: 700;
  color: #667eea;
  letter-spacing: 2px;
}
.wmod-summary-divider {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, #667eea, transparent);
  margin: 0 12px;
}
.wmod-summary-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}
.wmod-summary-title p { margin: 0; font-size: 18px; font-weight: 700; }
.wmod-summary-content {
  font-size: 15px;
  color: #333;
  line-height: 1.8;
  margin-bottom: 16px;
}
.wmod-summary-content p { margin: 0 0 1em; }
.wmod-summary-quote {
  padding: 16px;
  background: #fff;
  border-left: 4px solid #667eea;
  font-size: 14px;
  color: #666;
  font-style: italic;
  border-radius: 0 8px 8px 0;
}
.wmod-summary-quote p { margin: 0; }

/* ===== 版权区 ===== */
.wmod-copyright {
  margin: 0 16px 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 12px;
  color: #999;
  text-align: center;
}
.wmod-copyright p { margin: 0; }
`,
  mdTemplate: `<!-- @slot:titleTag -->
BREAKING 2026.03

<!-- @slot:titleMain -->
微信直接操作OpenClaw，实测腾讯亲儿子QClaw，一键本地部署启动

<!-- @slot:titleSub -->
全新AI操控方案带来更智能的自动化体验

<!-- @slot:cover -->

<!-- @slot:lead -->
今天，我们要介绍一个重磅更新——QClaw。这是腾讯推出的OpenClaw官方客户端，让你可以直接在微信里操控AI助手，实现一键本地部署。

<!-- @slot:featuresHeader -->
核心功能一览

<!-- @slot:featuresGrid -->
- **本地部署** 无需服务器
- **模型选择** 多模型支持
- **微信操控** 随时随地

<!-- @slot:featuresSummary -->
3分钟完成部署，小白也能轻松上手

<!-- @slot:partNum -->
PART 01

<!-- @slot:partTitle -->
一键部署篇

<!-- @slot:partImg -->

<!-- @slot:partContent -->
QClaw的部署过程非常简单，只需要三步：

1. 下载安装包
2. 配置API密钥
3. 点击启动

整个过程不超过5分钟，即使是技术小白也能轻松上手。

<!-- @slot:partNum -->
PART 02

<!-- @slot:partTitle -->
模型选择篇

<!-- @slot:partImg -->

<!-- @slot:partContent -->
QClaw支持多种大模型，包括：

- **混元大模型**：腾讯自研，中文理解能力强
- **GPT-4**：OpenAI旗舰模型
- **Claude**：Anthropic安全优先模型

可以根据任务需求灵活切换。

<!-- @slot:partNum -->
PART 03

<!-- @slot:partTitle -->
微信操控篇

<!-- @slot:partImg -->

<!-- @slot:partContent -->
绑定微信后，你可以：

- 发送消息直接操控AI
- 接收任务完成通知
- 查看实时执行状态
- 一键复用历史会话

<!-- @slot:caseNum -->
CASE 01

<!-- @slot:caseTitle -->
操作Obsidian进行灵感记录

<!-- @slot:caseContent -->
通过QClaw，我可以让AI自动整理Obsidian笔记，提取关键灵感并分类归档。

<!-- @slot:caseNum -->
CASE 02

<!-- @slot:caseTitle -->
自动回复工作消息

<!-- @slot:caseContent -->
设置好规则后，AI可以帮我筛选重要消息，并生成合适的回复草稿。

<!-- @slot:caseNum -->
CASE 03

<!-- @slot:caseTitle -->
定时生成日报周报

<!-- @slot:caseContent -->
每晚自动汇总当天工作内容，生成结构化的日报，直接发送到邮箱。

<!-- @slot:summaryTitle -->
写在最后

<!-- @slot:summaryContent -->
QClaw的出现，标志着AI助手从"工具"向"伙伴"的转变。建议感兴趣的朋友去「观猹」蹲一个邀请码，早日体验。

<!-- @slot:summaryQuote -->
未来已来，只是分布不均。
`,
  slots: {
    titleTag: { label: '标题标签', type: 'content', placeholder: 'BREAKING 2026.03' },
    titleMain: { label: '主标题', type: 'content', placeholder: '# 主标题' },
    titleSub: { label: '副标题', type: 'content', placeholder: '副标题描述' },
    cover: { label: '封面图', type: 'image', placeholder: '' },
    lead: { label: '导语', type: 'content', placeholder: '导语段落...' },
    featuresHeader: { label: 'Features 标题', type: 'content', placeholder: '核心功能一览' },
    featuresGrid: { label: 'Features 卡片', type: 'content', placeholder: '- **功能1** 描述\n- **功能2** 描述\n- **功能3** 描述' },
    featuresSummary: { label: 'Features 总结', type: 'content', placeholder: '总结文字' },
    partNum: { label: 'Part 编号（可重复）', type: 'content', placeholder: 'PART 01（重复使用填充多个Part编号）' },
    partTitle: { label: 'Part 标题（可重复）', type: 'content', placeholder: '章节标题（重复使用填充多个Part）' },
    partImg: { label: 'Part 配图（可重复）', type: 'image', placeholder: '配图URL（重复使用）' },
    partContent: { label: 'Part 内容（可重复）', type: 'content', placeholder: '章节内容（重复使用填充多个Part）' },
    caseNum: { label: 'Case 编号（可重复）', type: 'content', placeholder: 'CASE 01（重复使用填充多个Case编号）' },
    caseTitle: { label: 'Case 标题（可重复）', type: 'content', placeholder: '案例标题（重复使用填充多个Case）' },
    caseContent: { label: 'Case 内容（可重复）', type: 'content', placeholder: '案例描述（重复使用）' },
    summaryTitle: { label: '总结标题', type: 'content', placeholder: '写在最后' },
    summaryContent: { label: '总结内容', type: 'content', placeholder: '总结段落...' },
    summaryQuote: { label: '总结引用', type: 'content', placeholder: '引用文字' },
    copyright: { label: '版权信息', type: 'content', placeholder: '© 本文由...创作' },
  },
  sections: [
    { id: 'title', label: '标题区', slots: ['titleTag', 'titleMain', 'titleSub', 'cover'] },
    { id: 'lead', label: '导语', slots: ['lead'] },
    { id: 'features', label: 'Feature 卡片', slots: ['featuresHeader', 'featuresGrid', 'featuresSummary'] },
    { id: 'parts', label: 'Part 分区（3个）', slots: ['partNum', 'partTitle', 'partImg', 'partContent'] },
    { id: 'cases', label: '案例区（3个）', slots: ['caseNum', 'caseTitle', 'caseContent'] },
    { id: 'summary', label: '总结', slots: ['summaryTitle', 'summaryContent', 'summaryQuote'] },
  ],
  exportConfig: { formats: ['jpg', 'html'], defaultWidth: 480, defaultScale: 2, mode: 'long' },
};
