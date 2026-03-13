/**
 * 渲染模板：报纸风格 - 横版高信息密度
 * HTML仅保留骨架，所有内容通过MD填充
 */
import type { BuiltinRenderTemplate } from '../types';

export const rtNewspaper: BuiltinRenderTemplate = {
  id: 'rt-builtin-newspaper',
  name: '报纸风格-横版高密',
  description: 'A4横版高信息密度报纸骨架模板，所有内容通过MD填充',
  category: 'report',
  htmlTemplate: `<div class="np">
  <div class="np-hd" data-slot="header" data-slot-type="content"></div>
  <div class="np-main" data-slot="main" data-slot-type="content"></div>
  <div class="np-side" data-slot="sidebar" data-slot-type="content"></div>
  <div class="np-bottom" data-slot="bottom" data-slot-type="content"></div>
  <div class="np-ft" data-slot="footer" data-slot-type="content"></div>
</div>`,
  cssTemplate: `.np {
  width: 1123px;
  height: 794px;
  margin: 0 auto;
  background: #f5f3f0;
  color: #1a1a1a;
  font-family: 'Noto Serif SC', Georgia, serif;
  position: relative;
  overflow: hidden;
  padding: 24px 32px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: auto 1fr auto auto;
  gap: 16px;
}
.np-hd {
  grid-column: 1 / -1;
  text-align: center;
  border-bottom: 3px double #1a1a1a;
  padding-bottom: 12px;
}
.np-main {
  column-count: 2;
  column-gap: 16px;
  column-rule: 1px solid #ccc;
  font-size: 11px;
  line-height: 1.6;
  text-align: justify;
}
.np-side {
  border-left: 1px solid #ccc;
  padding-left: 16px;
  font-size: 10px;
  line-height: 1.5;
}
.np-bottom {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 2px solid #1a1a1a;
  font-size: 9px;
}
.np-ft {
  grid-column: 1 / -1;
  text-align: center;
  font-size: 9px;
  color: #888;
  border-top: 1px solid #ccc;
  padding-top: 8px;
}`,
  mdTemplate: `<!-- @slot:header -->
NO.001 | 2026.03.09 | ¥5.00

# THE DAILY TECH

记录科技脉搏 · 洞察未来趋势 | www.techdaily.com

<!-- @slot:main -->
## TeamClaw v3.0 正式发布 AI Agent 管理进入新纪元

*全新版本带来更智能的任务分配和实时协作体验*

**本报记者 摸鱼小李 | 发自杭州**

---

3月9日，TeamClaw团队正式发布v3.0版本。这是自项目启动以来最重要的里程碑，新版本引入了AI Agent自动调度、智能任务分解、实时协作等核心功能。

据项目负责人介绍，v3.0版本历时6个月开发，集成了来自20+企业的反馈建议。核心亮点包括：基于大模型的任务自动规划、多代理协作工作流、可视化SOP编辑器。

后端全面重构为微服务架构，支持水平扩展。新增的Gateway模块提供统一的Agent通信协议，延迟降低60%。首屏加载时间从2.8s降至0.9s，支持千人同时在线协作。

全新设计的工作台界面，操作路径减少40%。新增的模板中心，预置30+常用SOP模板。Q2将推出移动端App，Q3实现多语言支持，Q4开放插件市场。

<!-- @slot:sidebar -->
### 数据亮点
**85%** 效率提升  
**4x** 速度增长  
**60%** 成本降低

### 专家观点
> "TeamClaw v3.0重新定义了AI辅助工作的范式。"

### 快讯
• QClaw客户端上线  
• 三家企业达成战略合作  
• Gateway协议将开源

<!-- @slot:bottom -->
**技术架构升级**  
后端全面重构为微服务架构，支持水平扩展。新增的Gateway模块提供统一的Agent通信协议。

**性能优化成果**  
首屏加载时间从2.8s降至0.9s，支持千人同时在线协作，错误率降低86%。

**用户体验改进**  
全新设计的工作台界面，操作路径减少40%，预置30+常用SOP模板。

<!-- @slot:footer -->
第A01版·科技 | © 2026 THE DAILY TECH`,
  slots: {
    header: { label: '报头', type: 'content', placeholder: '期号 | 日期 | 价格\n\n# 报名\n\n标语 | 网址' },
    main: { label: '主内容', type: 'content', placeholder: '## 标题\n*副标题*\n\n**作者**\n\n正文...' },
    sidebar: { label: '侧边栏', type: 'content', placeholder: '### 数据\n内容\n\n### 引用\n> 内容' },
    bottom: { label: '底部栏', type: 'content', placeholder: '**标题**\n内容\n\n**标题**\n内容\n\n**标题**\n内容' },
    footer: { label: '页脚', type: 'content', placeholder: '版次 | 版权' },
  },
  sections: [
    { id: 'header', label: '报头', slots: ['header'] },
    { id: 'main', label: '主内容', slots: ['main'] },
    { id: 'sidebar', label: '侧边栏', slots: ['sidebar'] },
    { id: 'bottom', label: '底部栏', slots: ['bottom'] },
    { id: 'footer', label: '页脚', slots: ['footer'] },
  ],
  exportConfig: { formats: ['jpg', 'html', 'pdf'], defaultWidth: 1123, defaultScale: 2, mode: 'custom' },
};
