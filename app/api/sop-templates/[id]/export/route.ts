/**
 * SOP 模板导出 API
 * 
 * GET /api/sop-templates/[id]/export
 * 
 * 返回 JSON 格式的模板数据，可用于分享和导入
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sopTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const template = await db.query.sopTemplates.findFirst({
    where: eq(sopTemplates.id, id),
  });

  if (!template) {
    return NextResponse.json({ error: 'SOP 模板不存在' }, { status: 404 });
  }

  // 导出格式：剥离数据库特定字段，保留模板定义
  const exportData = {
    _format: 'comind-sop-template',
    _version: '1.0',
    _exportedAt: new Date().toISOString(),
    name: template.name,
    description: template.description,
    category: template.category,
    icon: template.icon,
    stages: template.stages,
    requiredTools: template.requiredTools,
    systemPrompt: template.systemPrompt,
    knowledgeConfig: template.knowledgeConfig,
    outputConfig: template.outputConfig,
    qualityChecklist: template.qualityChecklist,
  };

  return NextResponse.json(exportData, {
    headers: {
      'Content-Disposition': `attachment; filename="sop-${template.name}.json"`,
    },
  });
}
