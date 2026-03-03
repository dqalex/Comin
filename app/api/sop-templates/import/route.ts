/**
 * SOP 模板导入 API
 * 
 * POST /api/sop-templates/import
 * 
 * 接收 JSON 格式的模板数据，创建新模板（draft 状态）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sopTemplates } from '@/db/schema';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import type { SOPStage, SOPCategory, KnowledgeConfig } from '@/db/schema';

// 合法阶段类型
const VALID_STAGE_TYPES = ['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'];
const VALID_CATEGORIES: SOPCategory[] = ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'];

export async function POST(request: NextRequest) {
  try {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为合法 JSON' }, { status: 400 });
  }

  // 校验格式标识
  if (body._format !== 'comind-sop-template') {
    return NextResponse.json({ error: '无效的导入格式，需要 comind-sop-template 格式的 JSON' }, { status: 400 });
  }

  const name = body.name as string | undefined;
  const description = (body.description as string) || '';
  const category = body.category as string | undefined;
  const icon = (body.icon as string) || 'clipboard-list';
  const stages = body.stages;
  const requiredTools = body.requiredTools;
  const systemPrompt = (body.systemPrompt as string) || '';
  const knowledgeConfig = body.knowledgeConfig as KnowledgeConfig | null;
  const outputConfig = body.outputConfig as Record<string, unknown> | null;
  const qualityChecklist = body.qualityChecklist;

  // 校验必填字段
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: '缺少模板名称 (name)' }, { status: 400 });
  }

  if (!Array.isArray(stages) || stages.length === 0) {
    return NextResponse.json({ error: '缺少阶段定义 (stages)，至少需要 1 个阶段' }, { status: 400 });
  }

  // 校验阶段
  for (const stage of stages as SOPStage[]) {
    if (!stage.id || !stage.label || !stage.type) {
      return NextResponse.json({ error: '每个阶段必须包含 id, label, type' }, { status: 400 });
    }
    if (!VALID_STAGE_TYPES.includes(stage.type)) {
      return NextResponse.json({ error: `无效的阶段类型: ${stage.type}` }, { status: 400 });
    }
  }

  // 校验分类
  const finalCategory: SOPCategory = VALID_CATEGORIES.includes(category as SOPCategory)
    ? (category as SOPCategory)
    : 'custom';

  // 为每个阶段生成新的 ID（避免 ID 冲突）
  const idMap = new Map<string, string>();
  const newStages = (stages as SOPStage[]).map(stage => {
    const newId = `stage-${generateId()}`;
    idMap.set(stage.id, newId);
    return { ...stage, id: newId };
  });

  // 更新 rollbackStageId 引用（旧 ID → 新 ID，无法映射则清除）
  for (const stage of newStages) {
    if (stage.rollbackStageId) {
      if (idMap.has(stage.rollbackStageId)) {
        stage.rollbackStageId = idMap.get(stage.rollbackStageId);
      } else {
        // 映射不存在说明引用了无效的旧 ID，清除以避免运行时错误
        stage.rollbackStageId = undefined;
      }
    }
  }

  const id = generateId();
  const now = new Date();

  await db.insert(sopTemplates).values({
    id,
    name: `${name}（导入）`,
    description,
    category: finalCategory,
    icon,
    status: 'draft' as const,
    stages: newStages,
    requiredTools: Array.isArray(requiredTools) ? requiredTools as string[] : [],
    systemPrompt,
    knowledgeConfig: knowledgeConfig || null,
    outputConfig: outputConfig as import('@/db/schema').OutputConfig | null,
    qualityChecklist: Array.isArray(qualityChecklist) ? qualityChecklist as string[] : [],
    isBuiltin: false,
    createdBy: 'import',
    createdAt: now,
    updatedAt: now,
  });

  eventBus.emit({ type: 'sop_template_update', resourceId: id });

  return NextResponse.json({
    id,
    name: `${name}（导入）`,
    status: 'draft',
    stages_count: newStages.length,
    message: 'SOP 模板已导入（draft 状态），请在管理页面确认后激活',
  }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/sop-templates/import] Error:', error);
    return NextResponse.json({ error: '导入 SOP 模板失败' }, { status: 500 });
  }
}
