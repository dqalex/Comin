/**
 * Render Template Import/Export API Tests
 * 
 * 测试使用类似 landingpage-template.md 格式的导入导出功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/render-templates/[id]/export/route';
import { POST } from '@/app/api/render-templates/import/route';
import { db } from '@/db';
import { renderTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';

describe('Render Template Import/Export API', () => {
  let testTemplateId: string;

  beforeAll(async () => {
    // 创建测试模板
    testTemplateId = 'rt-test-' + generateId();
    await db.insert(renderTemplates).values({
      id: testTemplateId,
      name: 'Test Template',
      description: 'A test template for import/export',
      category: 'report',
      status: 'active',
      htmlTemplate: `<div class="test-template">
  <header data-slot="title" data-slot-type="content"></header>
  <section data-slot="body" data-slot-type="content"></section>
</div>`,
      cssTemplate: '.test-template { padding: 20px; }',
      mdTemplate: `<!-- @slot:title -->
# Test Title

<!-- @slot:body -->
Test body content.`,
      slots: {
        title: { label: '标题', type: 'content', placeholder: '输入标题' },
        body: { label: '正文', type: 'content', placeholder: '输入正文' },
      },
      sections: [
        { id: 'main', label: '主体', slots: ['title', 'body'] },
      ],
      exportConfig: { formats: ['jpg', 'html'], defaultWidth: 800, defaultScale: 2, mode: 'custom' },
      isBuiltin: false,
      createdBy: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await db.delete(renderTemplates).where(eq(renderTemplates.id, testTemplateId));
  });

  describe('Export API', () => {
    it('should export template as Markdown format', async () => {
      const params = Promise.resolve({ id: testTemplateId });
      const response = await GET({} as NextRequest, { params });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      
      const content = await response.text();
      
      // 验证 YAML frontmatter
      expect(content).toContain('---');
      expect(content).toContain('name: "Test Template"');
      expect(content).toContain('category: report');
      
      // 验证 HTML Template 部分
      expect(content).toContain('## HTML Template');
      expect(content).toContain('```html');
      expect(content).toContain('data-slot="title"');
      
      // 验证 Markdown Template 部分
      expect(content).toContain('## Markdown Template');
      expect(content).toContain('```markdown');
      expect(content).toContain('<!-- @slot:title -->');
      
      // 验证 CSS 部分
      expect(content).toContain('## CSS');
      expect(content).toContain('```css');
      expect(content).toContain('.test-template');
    });

    it('should return 404 for non-existent template', async () => {
      const params = Promise.resolve({ id: 'non-existent-id' });
      const response = await GET({} as NextRequest, { params });
      
      expect(response.status).toBe(404);
    });
  });

  describe('Import API', () => {
    it('should import template from Markdown format', async () => {
      const mdContent = `---
name: "Imported Test Template"
description: "A template imported from markdown"
category: card
formats: [jpg, png]
defaultWidth: 600
defaultScale: 2
mode: custom
---

## Slots Definition
\`\`\`yaml
heading:
  label: "标题"
  type: content
  placeholder: "输入标题"
content:
  label: "内容"
  type: content
\`\`\`

## Sections
\`\`\`yaml
- id: main
  label: "主体"
  slots: [heading, content]
\`\`\`

## HTML Template
\`\`\`html
<div class="card">
  <h1 data-slot="heading" data-slot-type="content"></h1>
  <div data-slot="content" data-slot-type="content"></div>
</div>
\`\`\`

## Markdown Template
\`\`\`markdown
<!-- @slot:heading -->
# 标题

<!-- @slot:content -->
内容占位
\`\`\`

## CSS
\`\`\`css
.card { padding: 24px; border-radius: 12px; }
\`\`\`
`;

      const request = new NextRequest('http://localhost/api/render-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: mdContent,
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.name).toContain('Imported Test Template');
      expect(data.slots_count).toBe(2);
      expect(data.sections_count).toBe(1);
      expect(data.status).toBe('draft');

      // 清理导入的模板
      await db.delete(renderTemplates).where(eq(renderTemplates.id, data.id));
    });

    it('should return 400 for missing content', async () => {
      const request = new NextRequest('http://localhost/api/render-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: '',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should import minimal template (only HTML)', async () => {
      const mdContent = `---
name: "Minimal Template"
---

## HTML Template
\`\`\`html
<div class="minimal" data-slot="content" data-slot-type="content"></div>
\`\`\`
`;

      const request = new NextRequest('http://localhost/api/render-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: mdContent,
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.name).toContain('Minimal Template');
      expect(data.slots_count).toBe(1); // 自动从 HTML 提取 data-slot

      // 清理导入的模板
      await db.delete(renderTemplates).where(eq(renderTemplates.id, data.id));
    });
  });

  describe('Round-trip: Export then Import', () => {
    it('should maintain template structure through export-import cycle', async () => {
      // 1. 导出原始模板
      const params = Promise.resolve({ id: testTemplateId });
      const exportResponse = await GET({} as NextRequest, { params });
      const exportedMd = await exportResponse.text();

      // 2. 导入导出的内容
      const importRequest = new NextRequest('http://localhost/api/render-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: exportedMd,
      });
      const importResponse = await POST(importRequest);
      expect(importResponse.status).toBe(201);

      const importedData = await importResponse.json();

      // 3. 验证导入的数据与原始数据一致
      const importedTemplate = await db.query.renderTemplates.findFirst({
        where: eq(renderTemplates.id, importedData.id),
      });

      expect(importedTemplate).not.toBeNull();
      expect(importedTemplate!.htmlTemplate).toContain('data-slot="title"');
      expect(importedTemplate!.mdTemplate).toContain('<!-- @slot:title -->');
      expect(importedTemplate!.cssTemplate).toContain('.test-template');
      expect(Object.keys(importedTemplate!.slots as Record<string, unknown>)).toContain('title');
      expect(Object.keys(importedTemplate!.slots as Record<string, unknown>)).toContain('body');

      // 清理
      await db.delete(renderTemplates).where(eq(renderTemplates.id, importedData.id));
    });
  });
});
