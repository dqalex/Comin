/**
 * SOP Template Import/Export API Tests
 * 
 * 测试 SOP 模板的导入导出功能（JSON 和 MD/SKILL 格式）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/sop-templates/[id]/export/route';
import { POST } from '@/app/api/sop-templates/import/route';
import { db } from '@/db';
import { sopTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import type { SOPStage } from '@/db/schema';

describe('SOP Template Import/Export API', () => {
  let testTemplateId: string;

  beforeAll(async () => {
    // 创建测试模板
    testTemplateId = 'sop-test-' + generateId();
    const stages: SOPStage[] = [
      {
        id: 'stage-1',
        label: '信息输入',
        type: 'input',
        requiredInputs: [
          { id: 'input-1', label: '主题', type: 'text', required: true },
        ],
        outputType: 'text',
        outputLabel: '',
      },
      {
        id: 'stage-2',
        label: 'AI 分析',
        type: 'ai_auto',
        promptTemplate: '分析 {{inputs.主题}}',
        outputType: 'markdown',
        outputLabel: '',
      },
      {
        id: 'stage-3',
        label: '人工确认',
        type: 'ai_with_confirm',
        promptTemplate: '确认分析结果',
        confirmMessage: '是否确认？',
        outputType: 'markdown',
        outputLabel: '',
      },
    ];

    await db.insert(sopTemplates).values({
      id: testTemplateId,
      name: 'Test SOP Template',
      description: 'A test SOP template for import/export',
      category: 'analysis',
      icon: 'bar-chart-2',
      status: 'active',
      stages,
      requiredTools: [],
      systemPrompt: 'You are a helpful assistant.',
      knowledgeConfig: null,
      outputConfig: null,
      qualityChecklist: ['检查项1', '检查项2'],
      isBuiltin: false,
      createdBy: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await db.delete(sopTemplates).where(eq(sopTemplates.id, testTemplateId));
  });

  describe('Export API', () => {
    it('should export template as JSON format (default)', async () => {
      const request = new NextRequest(`http://localhost/api/sop-templates/${testTemplateId}/export`);
      const params = Promise.resolve({ id: testTemplateId });
      const response = await GET(request, { params });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      
      const data = await response.json();
      expect(data._format).toBe('teamclaw-sop-template');
      expect(data.name).toBe('Test SOP Template');
      expect(data.stages).toHaveLength(3);
      expect(data.qualityChecklist).toEqual(['检查项1', '检查项2']);
    });

    it('should export template as Markdown (SKILL) format', async () => {
      const request = new NextRequest(`http://localhost/api/sop-templates/${testTemplateId}/export?format=md`);
      const params = Promise.resolve({ id: testTemplateId });
      const response = await GET(request, { params });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      
      const content = await response.text();
      
      // 验证 frontmatter
      expect(content).toContain('---');
      expect(content).toContain('name: Test SOP Template');
      expect(content).toContain('category: analysis');
      
      // 验证 system prompt
      expect(content).toContain('You are a helpful assistant.');
      
      // 验证 stages
      expect(content).toContain('## 信息输入');
      expect(content).toContain('- type: input');
      expect(content).toContain('## AI 分析');
      expect(content).toContain('- type: ai_auto');
      expect(content).toContain('- prompt: 分析');
      
      // 验证 quality checklist
      expect(content).toContain('## Quality Checklist');
      expect(content).toContain('检查项1');
    });

    it('should return 404 for non-existent template', async () => {
      const request = new NextRequest('http://localhost/api/sop-templates/non-existent-id/export');
      const params = Promise.resolve({ id: 'non-existent-id' });
      const response = await GET(request, { params });
      
      expect(response.status).toBe(404);
    });
  });

  describe('Import API', () => {
    it('should import template from JSON format', async () => {
      const jsonData = {
        _format: 'teamclaw-sop-template',
        name: 'JSON Import Test',
        description: 'Imported from JSON',
        category: 'research',
        icon: 'search',
        stages: [
          { id: 's1', label: 'Stage 1', type: 'input', outputType: 'text' },
          { id: 's2', label: 'Stage 2', type: 'ai_auto', promptTemplate: 'Test prompt', outputType: 'markdown' },
        ],
        systemPrompt: 'System prompt here',
        qualityChecklist: ['Item 1'],
      };

      const request = new NextRequest('http://localhost/api/sop-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.name).toContain('JSON Import Test');
      expect(data.format).toBe('json');
      expect(data.stages_count).toBe(2);

      // 清理
      await db.delete(sopTemplates).where(eq(sopTemplates.id, data.id));
    });

    it('should import template from Markdown (SKILL) format', async () => {
      const mdContent = `---
name: "Markdown Import Test"
description: "Imported from Markdown"
category: content
icon: file-text
---

This is the system prompt for the template.

## 收集信息
- type: input
- inputs: 主题, 关键词

## 生成内容
- type: ai_auto
- prompt: 根据主题 {{inputs.主题}} 和关键词 {{inputs.关键词}} 生成内容
- outputType: markdown
- estimatedMinutes: 10

## 人工审核
- type: review

## Quality Checklist
- [ ] 内容准确
- [ ] 格式规范
`;

      const request = new NextRequest('http://localhost/api/sop-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: mdContent,
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.name).toContain('Markdown Import Test');
      expect(data.format).toBe('md');
      expect(data.stages_count).toBe(3); // 收集信息, 生成内容, 人工审核

      // 清理
      await db.delete(sopTemplates).where(eq(sopTemplates.id, data.id));
    });

    it('should return 400 for invalid format', async () => {
      const request = new NextRequest('http://localhost/api/sop-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Round-trip: Export then Import', () => {
    it('should maintain template structure through export-import cycle (MD format)', async () => {
      // 1. 导出为 MD
      const request = new NextRequest('http://localhost/api/sop-templates/' + testTemplateId + '/export?format=md');
      const params = Promise.resolve({ id: testTemplateId });
      const exportResponse = await GET(request, { params });
      const exportedMd = await exportResponse.text();

      // 2. 导入 MD
      const importRequest = new NextRequest('http://localhost/api/sop-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: exportedMd,
      });
      const importResponse = await POST(importRequest);
      expect(importResponse.status).toBe(201);

      const importedData = await importResponse.json();

      // 3. 验证数据
      const importedTemplate = await db.query.sopTemplates.findFirst({
        where: eq(sopTemplates.id, importedData.id),
      });

      expect(importedTemplate).not.toBeNull();
      expect(importedTemplate!.name).toContain('Test SOP Template');
      expect(importedTemplate!.category).toBe('analysis');
      expect(importedTemplate!.systemPrompt).toContain('helpful assistant');
      
      const stages = importedTemplate!.stages as SOPStage[];
      expect(stages.length).toBeGreaterThanOrEqual(2);
      expect(stages.some(s => s.type === 'input')).toBe(true);
      expect(stages.some(s => s.type === 'ai_auto')).toBe(true);

      // 清理
      await db.delete(sopTemplates).where(eq(sopTemplates.id, importedData.id));
    });
  });
});
