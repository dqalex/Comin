---
name: "技术分享卡片"
description: "适合技术博客文章、技术分享的卡片模板"
category: card
formats: [jpg, png, html]
defaultWidth: 1200
defaultScale: 2
mode: 16:9
---

## Slots Definition
```yaml
title:
  label: "标题"
  type: content
  placeholder: "# 技术文章标题"
subtitle:
  label: "副标题"
  type: content
  placeholder: "作者 | 日期"
body:
  label: "正文内容"
  type: content
  placeholder: "## 核心内容\n\n- 要点一\n- 要点二\n- 要点三"
footer:
  label: "页脚"
  type: content
  placeholder: "TeamClaw Generated"
```

## Sections
```yaml
- id: header
  label: "标题区"
  slots: [title, subtitle]
- id: content
  label: "内容区"
  slots: [body]
- id: footer
  label: "页脚"
  slots: [footer]
```

## HTML Template
```html
<div class="tech-card">
  <header class="tech-header">
    <div class="tech-badge">Tech Share</div>
    <div data-slot="title" data-slot-type="content"></div>
    <div class="tech-meta" data-slot="subtitle" data-slot-type="content"></div>
  </header>
  
  <main class="tech-body">
    <div data-slot="body" data-slot-type="content"></div>
  </main>
  
  <footer class="tech-footer">
    <div data-slot="footer" data-slot-type="content"></div>
  </footer>
</div>
```

## Markdown Template
```markdown
<!-- @slot:title -->
# 从零开始构建 AI Agent

<!-- @slot:subtitle -->
张三 | 2026-03-08

<!-- @slot:body -->
## 核心概念

- **Agent 架构**：规划器、执行器、记忆系统
- **工具调用**：Function Calling、MCP 协议
- **状态管理**：上下文窗口、短期/长期记忆

## 实现步骤

1. 定义 Agent 角色和目标
2. 设计工具集和接口
3. 实现推理循环
4. 添加记忆和反思机制

<!-- @slot:footer -->
TeamClaw · AI Agent 平台
```

## CSS
```css
.tech-card {
  max-width: 1200px;
  min-height: 675px;
  margin: 0 auto;
  padding: 60px 80px;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #f8fafc;
  position: relative;
  overflow: hidden;
}

.tech-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.tech-header {
  margin-bottom: 48px;
  position: relative;
  z-index: 1;
}

.tech-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #818cf8;
  letter-spacing: 0.05em;
  margin-bottom: 20px;
}

[data-slot="title"] h1 {
  font-size: 48px;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 16px;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tech-meta {
  font-size: 16px;
  color: #64748b;
}

[data-slot="subtitle"] p {
  margin: 0;
}

.tech-body {
  position: relative;
  z-index: 1;
}

[data-slot="body"] h2 {
  font-size: 24px;
  font-weight: 700;
  color: #818cf8;
  margin: 32px 0 16px;
}

[data-slot="body"] ul {
  padding-left: 24px;
}

[data-slot="body"] li {
  font-size: 18px;
  line-height: 1.8;
  color: #e2e8f0;
  margin-bottom: 8px;
}

[data-slot="body"] ol {
  padding-left: 24px;
}

.tech-footer {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  text-align: center;
  position: relative;
  z-index: 1;
}

[data-slot="footer"] p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}
```
