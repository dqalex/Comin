/**
 * SOP 引擎相关 MCP Handler
 * 
 * 包含 SOP 执行和 AI 自主创作工具
 */

import { db } from '@/db';
import { tasks, documents, sopTemplates, renderTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/event-bus';
import { parseKnowHow, extractLayers, appendToL4 } from '@/lib/knowhow-parser';
import { renderTemplateWithContext } from '@/lib/template-engine';
import type { SOPStage, StageRecord, SOPCategory, StageOutputType, KnowledgeConfig } from '@/db/schema';

type HandlerResult = { success: boolean; data?: unknown; error?: string };

// ========== SOP 执行工具 ==========

/**
 * advance_sop_stage - AI 完成当前阶段，推进到下一阶段
 */
export async function handleAdvanceSopStage(params: Record<string, unknown>): Promise<HandlerResult> {
  const { task_id, stage_output } = params as { task_id?: string; stage_output?: string };
  
  if (!task_id) {
    return { success: false, error: '缺少 task_id' };
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, task_id),
  });

  if (!task) {
    return { success: false, error: '任务不存在' };
  }

  if (!task.sopTemplateId || !task.currentStageId) {
    return { success: false, error: '该任务未绑定 SOP 模板或未开始执行' };
  }

  // 获取 SOP 模板
  const template = await db.query.sopTemplates.findFirst({
    where: eq(sopTemplates.id, task.sopTemplateId),
  });

  if (!template) {
    return { success: false, error: 'SOP 模板不存在' };
  }

  const stages = template.stages as SOPStage[];
  const currentIndex = stages.findIndex(s => s.id === task.currentStageId);
  
  if (currentIndex === -1) {
    return { success: false, error: '当前阶段不存在' };
  }

  // 检查当前阶段状态
  const stageHistory = (task.stageHistory || []) as StageRecord[];
  const existingRecord = stageHistory.find(h => h.stageId === task.currentStageId);
  // 如果已经在等待确认，不允许 AI 直接推进
  if (existingRecord?.status === 'waiting_confirm') {
    return { success: false, error: '当前阶段正在等待人工确认，请使用 request_sop_confirm 或等待人工操作' };
  }
  // ai_with_confirm 类型阶段必须先通过 request_sop_confirm 请求确认，不允许 AI 直接 advance
  const currentStage = stages[currentIndex];
  if (currentStage.type === 'ai_with_confirm' && existingRecord?.status === 'active') {
    return { success: false, error: '此阶段类型为 ai_with_confirm，请先调用 request_sop_confirm 请求人工确认，再由人工 confirm 后自动推进' };
  }

  // 更新阶段历史
  const now = new Date();
  const nowStr = now.toISOString();
  
  // 完成当前阶段
  const currentStageRecord: StageRecord = {
    stageId: task.currentStageId,
    status: 'completed',
    output: stage_output,
    outputType: 'text',
    startedAt: existingRecord?.startedAt || nowStr,
    completedAt: nowStr,
  };
  
  // 更新历史（替换或添加）
  const existingIndex = stageHistory.findIndex(h => h.stageId === task.currentStageId);
  if (existingIndex >= 0) {
    stageHistory[existingIndex] = currentStageRecord;
  } else {
    stageHistory.push(currentStageRecord);
  }

  // 确定下一阶段
  const nextIndex = currentIndex + 1;
  const isCompleted = nextIndex >= stages.length;
  const nextStageId = isCompleted ? null : stages[nextIndex].id;

  // 使用事务确保文档创建 + 任务更新的原子性
  let nextRenderDocId: string | null = null;

  await db.transaction(async (tx) => {
    // 如果有下一阶段，初始化其记录（支持 render 阶段自动创建文档）
    if (!isCompleted && nextStageId) {
      const nextStage = stages[nextIndex];
      const initialStatus = nextStage.type === 'input' ? 'waiting_input' : 'active';
      const nextRecord: StageRecord = {
        stageId: nextStageId,
        status: initialStatus,
        startedAt: nowStr,
      };

      // render 阶段：自动创建 visual 文档
      if (nextStage.type === 'render') {
        const lastOutput = [...stageHistory]
          .reverse()
          .find(r => r.status === 'completed' && r.output);
        const docId = generateId();
        const initialContent = lastOutput?.output || `# ${nextStage.label}\n\n`;

        await tx.insert(documents).values({
          id: docId,
          title: `[SOP] ${task.title} - ${nextStage.label}`,
          content: initialContent,
          type: 'report',
          source: 'local',
          renderMode: 'visual',
          renderTemplateId: nextStage.renderTemplateId || null,
          projectId: task.projectId || null,
          createdAt: now,
          updatedAt: now,
        });

        nextRecord.renderDocumentId = docId;
        nextRenderDocId = docId;
      }

      stageHistory.push(nextRecord);
    }

    // 更新任务
    await tx.update(tasks)
      .set({
        currentStageId: nextStageId,
        stageHistory: stageHistory,
        status: isCompleted ? 'reviewing' : task.status,
        progress: Math.round(((currentIndex + 1) / stages.length) * 100),
        updatedAt: now,
      })
      .where(eq(tasks.id, task_id));
  });

  // 事务成功后发送事件通知
  if (nextRenderDocId) {
    eventBus.emit({ type: 'document_update', resourceId: nextRenderDocId });
  }

  eventBus.emit({ type: 'task_update', resourceId: task_id });

  // 渲染阶段完成通知（使用 sop-stage-result 模板）
  let stageResultNotification: string | null = null;
  try {
    const completedStage = stages[currentIndex];
    const nextStage = !isCompleted && nextStageId ? stages[nextIndex] : null;
    stageResultNotification = await renderTemplateWithContext('sop-stage-result', {
      timestamp: new Date().toLocaleString('zh-CN'),
      task_id,
      task_title: task.title,
      sop_name: template.name,
      completed_stage_label: completedStage.label,
      completed_stage_index: currentIndex + 1,
      total_stages: stages.length,
      stage_output: stage_output || '',
      is_sop_completed: isCompleted,
      has_next_stage: !isCompleted && !!nextStage,
      next_stage_label: nextStage?.label || '',
      next_stage_type: nextStage?.type || '',
      progress: Math.round(((currentIndex + 1) / stages.length) * 100),
    });
  } catch {
    // 模板渲染失败不影响核心流程
  }

  return {
    success: true,
    data: {
      task_id,
      completed_stage: task.currentStageId,
      next_stage: nextStageId,
      is_sop_completed: isCompleted,
      progress: Math.round(((currentIndex + 1) / stages.length) * 100),
      render_document_id: nextRenderDocId,
      stage_result_notification: stageResultNotification,
    },
  };
}

/**
 * request_sop_confirm - AI 请求人工确认当前阶段产出
 */
export async function handleRequestSopConfirm(params: Record<string, unknown>): Promise<HandlerResult> {
  const { task_id, confirm_message, stage_output } = params as {
    task_id?: string;
    confirm_message?: string;
    stage_output?: string;
  };

  if (!task_id || !confirm_message || !stage_output) {
    return { success: false, error: '缺少必要参数：task_id, confirm_message, stage_output' };
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, task_id),
  });

  if (!task || !task.currentStageId) {
    return { success: false, error: '任务不存在或未开始 SOP 执行' };
  }

  // 更新阶段历史，标记为等待确认
  const stageHistory = (task.stageHistory || []) as StageRecord[];
  const currentIndex = stageHistory.findIndex(h => h.stageId === task.currentStageId);
  const nowStr = new Date().toISOString();
  
  if (currentIndex >= 0) {
    stageHistory[currentIndex] = {
      ...stageHistory[currentIndex],
      status: 'waiting_confirm',
      output: stage_output,
      outputType: 'text',
    };
  } else {
    stageHistory.push({
      stageId: task.currentStageId,
      status: 'waiting_confirm',
      output: stage_output,
      outputType: 'text',
      startedAt: nowStr,
    });
  }

  await db.update(tasks)
    .set({
      stageHistory: stageHistory,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task_id));

  eventBus.emit({ type: 'task_update', resourceId: task_id });

  // 渲染确认请求通知（使用 sop-confirm-request 模板）
  let confirmNotification: string | null = null;
  try {
    // 获取 SOP 模板信息用于渲染
    const sopTemplate = task.sopTemplateId
      ? await db.query.sopTemplates.findFirst({ where: eq(sopTemplates.id, task.sopTemplateId) })
      : null;
    const sopStages = (sopTemplate?.stages || []) as SOPStage[];
    const stageIndex = sopStages.findIndex(s => s.id === task.currentStageId);
    const currentSopStage = stageIndex >= 0 ? sopStages[stageIndex] : null;

    confirmNotification = await renderTemplateWithContext('sop-confirm-request', {
      timestamp: new Date().toLocaleString('zh-CN'),
      task_id,
      task_title: task.title,
      sop_name: sopTemplate?.name || '',
      stage_label: currentSopStage?.label || '',
      stage_index: stageIndex + 1,
      total_stages: sopStages.length,
      confirm_message,
      stage_output,
    });
  } catch {
    // 模板渲染失败不影响核心流程
  }

  // 发送确认请求事件（携带渲染后的通知内容）
  eventBus.emit({
    type: 'sop_confirm_request',
    resourceId: task_id,
    data: { message: confirm_message, notification: confirmNotification },
  });

  return {
    success: true,
    data: {
      task_id,
      stage_id: task.currentStageId,
      confirm_message,
      awaiting_confirmation: true,
      confirm_notification: confirmNotification,
    },
  };
}

/**
 * get_sop_context - 获取当前 SOP 执行上下文
 */
export async function handleGetSopContext(params: Record<string, unknown>): Promise<HandlerResult> {
  const { task_id } = params as { task_id?: string };

  if (!task_id) {
    return { success: false, error: '缺少 task_id' };
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, task_id),
  });

  if (!task) {
    return { success: false, error: '任务不存在' };
  }

  if (!task.sopTemplateId) {
    return { success: false, error: '该任务未绑定 SOP 模板' };
  }

  // 获取 SOP 模板
  const template = await db.query.sopTemplates.findFirst({
    where: eq(sopTemplates.id, task.sopTemplateId),
  });

  if (!template) {
    return { success: false, error: 'SOP 模板不存在' };
  }

  const stages = template.stages as SOPStage[];
  const stageHistory = (task.stageHistory || []) as StageRecord[];
  const currentStage = stages.find(s => s.id === task.currentStageId);
  const currentIndex = stages.findIndex(s => s.id === task.currentStageId);

  // 获取前序阶段产出
  const previousOutputs = stageHistory
    .filter(h => h.status === 'completed' && h.output)
    .map(h => ({
      stage_id: h.stageId,
      stage_label: stages.find(s => s.id === h.stageId)?.label || h.stageId,
      output: h.output,
      output_type: h.outputType,
    }));

  // 知识库内容（分层读取）
  let knowledgeContent: string | null = null;
  if (template.knowledgeConfig) {
    const config = template.knowledgeConfig as KnowledgeConfig;
    if (config.documentId) {
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, config.documentId),
      });
      if (doc?.content && typeof doc.content === 'string') {
        const parsed = parseKnowHow(doc.content);
        // 使用当前阶段配置的层级，默认 L1
        const requestedLayers = (currentStage?.knowledgeLayers as Array<'L1'|'L2'|'L3'|'L4'|'L5'>) || ['L1'];
        knowledgeContent = extractLayers(parsed, requestedLayers);
      }
    }
  }

  return {
    success: true,
    data: {
      task_id,
      task_title: task.title,
      task_description: task.description,
      sop_template: {
        id: template.id,
        name: template.name,
        system_prompt: template.systemPrompt,
      },
      current_stage: currentStage ? {
        id: currentStage.id,
        label: currentStage.label,
        type: currentStage.type,
        prompt_template: currentStage.promptTemplate,
        output_type: currentStage.outputType,
        require_confirm: currentStage.type === 'ai_with_confirm',
      } : null,
      progress: {
        current_index: currentIndex,
        total_stages: stages.length,
        percentage: currentIndex >= 0 ? Math.round((currentIndex / stages.length) * 100) : 0,
      },
      previous_outputs: previousOutputs,
      sop_inputs: task.sopInputs,
      knowledge_content: knowledgeContent,
    },
  };
}

/**
 * save_stage_output - 保存当前阶段产出（不推进）
 */
export async function handleSaveStageOutput(params: Record<string, unknown>): Promise<HandlerResult> {
  const { task_id, output, output_type = 'text' } = params as {
    task_id?: string;
    output?: string;
    output_type?: string;
  };

  if (!task_id || !output) {
    return { success: false, error: '缺少必要参数：task_id, output' };
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, task_id),
  });

  if (!task || !task.currentStageId) {
    return { success: false, error: '任务不存在或未开始 SOP 执行' };
  }

  // 更新阶段历史
  const stageHistory = (task.stageHistory || []) as StageRecord[];
  const currentIndex = stageHistory.findIndex(h => h.stageId === task.currentStageId);
  const nowStr = new Date().toISOString();
  
  // 校验 output_type 是否为合法的 StageOutputType
  const validOutputTypes: StageOutputType[] = ['text', 'markdown', 'html', 'data', 'file'];
  const validOutputType: StageOutputType = validOutputTypes.includes(output_type as StageOutputType)
    ? (output_type as StageOutputType)
    : 'text';
  
  // 保留已有的 status（避免覆盖 waiting_confirm 等状态）
  const existingStatus = currentIndex >= 0 ? stageHistory[currentIndex].status : 'active';
  const updatedRecord: StageRecord = {
    stageId: task.currentStageId,
    status: existingStatus,
    output: output,
    outputType: validOutputType,
    startedAt: currentIndex >= 0 ? stageHistory[currentIndex].startedAt : nowStr,
  };

  if (currentIndex >= 0) {
    stageHistory[currentIndex] = updatedRecord;
  } else {
    stageHistory.push(updatedRecord);
  }

  await db.update(tasks)
    .set({
      stageHistory: stageHistory,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task_id));

  eventBus.emit({ type: 'task_update', resourceId: task_id });

  return {
    success: true,
    data: {
      task_id,
      stage_id: task.currentStageId,
      output_saved: true,
    },
  };
}

/**
 * update_knowledge - 向知识库追加内容
 * 
 * 支持两种模式：
 * 1. Know-how 文档（含 L1-L5 分层）：智能追加到 L4 经验记录
 * 2. 普通文档：以分隔线追加到末尾
 */
export async function handleUpdateKnowledge(params: Record<string, unknown>): Promise<HandlerResult> {
  const { document_id, content, layer } = params as { 
    document_id?: string; 
    content?: string; 
    layer?: string;
  };

  if (!document_id || !content) {
    return { success: false, error: '缺少必要参数：document_id, content' };
  }

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, document_id),
  });

  if (!doc) {
    return { success: false, error: '文档不存在' };
  }

  const existingContent = (typeof doc.content === 'string' ? doc.content : '') || '';
  let newContent: string;
  let appendMode: string;

  // 检查是否为 Know-how 文档（包含 L1/L2 等分层标记）
  const isKnowHow = /^##\s+L[1-5]\b/m.test(existingContent);

  if (isKnowHow && (layer === 'L4' || !layer)) {
    // Know-how 文档：智能追加到 L4
    newContent = appendToL4(existingContent, content);
    appendMode = 'knowhow_l4';
  } else {
    // 普通文档：以分隔线追加到末尾
    const timestamp = new Date().toISOString().split('T')[0];
    newContent = `${existingContent}\n\n---\n\n### ${timestamp} 更新\n\n${content}`;
    appendMode = 'append';
  }

  await db.update(documents)
    .set({
      content: newContent,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, document_id));

  eventBus.emit({ type: 'document_update', resourceId: document_id });

  return {
    success: true,
    data: {
      document_id,
      appended: true,
      mode: appendMode,
    },
  };
}

// ========== AI 自主创作工具 ==========

/**
 * create_sop_template - AI 创建 SOP 模板
 */
export async function handleCreateSopTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
  const {
    name,
    description = '',
    category = 'custom',
    stages,
    system_prompt,
    required_tools,
    quality_checklist,
    project_id,
  } = params as {
    name?: string;
    description?: string;
    category?: string;
    stages?: SOPStage[];
    system_prompt?: string;
    required_tools?: string[];
    quality_checklist?: string[];
    project_id?: string;
  };

  if (!name || !stages || stages.length === 0) {
    return { success: false, error: '缺少必要参数：name, stages（至少 1 个阶段）' };
  }

  // 校验阶段
  const validTypes = ['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'];
  for (const stage of stages) {
    if (!stage.id || !stage.label || !stage.type) {
      return { success: false, error: '每个阶段必须包含 id, label, type' };
    }
    if (!validTypes.includes(stage.type)) {
      return { success: false, error: `无效的阶段类型: ${stage.type}` };
    }
  }

  // 校验 category
  const validCategories: SOPCategory[] = ['content', 'analysis', 'research', 'development', 'operations', 'media', 'custom'];
  const finalCategory: SOPCategory = validCategories.includes(category as SOPCategory) 
    ? (category as SOPCategory) 
    : 'custom';

  const id = generateId();
  const now = new Date();

  await db.insert(sopTemplates).values({
    id,
    name,
    description,
    category: finalCategory,
    icon: 'clipboard-list',
    status: 'draft', // AI 创建的模板默认为 draft
    stages: stages,
    requiredTools: required_tools || [],
    systemPrompt: system_prompt || '',
    qualityChecklist: quality_checklist || [],
    projectId: project_id || null,
    createdBy: 'ai', // 标记为 AI 创建
    createdAt: now,
    updatedAt: now,
  });

  eventBus.emit({ type: 'sop_template_update', resourceId: id });

  return {
    success: true,
    data: {
      id,
      name,
      status: 'draft',
      message: 'SOP 模板已创建（draft 状态），请在管理页面确认后激活',
    },
  };
}

/**
 * update_sop_template - AI 更新 SOP 模板
 */
export async function handleUpdateSopTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
  const { template_id, ...updates } = params as {
    template_id?: string;
    name?: string;
    description?: string;
    stages?: SOPStage[];
    system_prompt?: string;
    required_tools?: string[];
    quality_checklist?: string[];
    status?: string;
  };

  if (!template_id) {
    return { success: false, error: '缺少 template_id' };
  }

  const template = await db.query.sopTemplates.findFirst({
    where: eq(sopTemplates.id, template_id),
  });

  if (!template) {
    return { success: false, error: 'SOP 模板不存在' };
  }

  // 校验阶段（如果提供了）
  if (updates.stages) {
    const validTypes = ['input', 'ai_auto', 'ai_with_confirm', 'manual', 'render', 'export', 'review'];
    for (const stage of updates.stages) {
      if (!stage.id || !stage.label || !stage.type) {
        return { success: false, error: '每个阶段必须包含 id, label, type' };
      }
      if (!validTypes.includes(stage.type)) {
        return { success: false, error: `无效的阶段类型: ${stage.type}` };
      }
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.stages !== undefined) updateData.stages = updates.stages;
  if (updates.system_prompt !== undefined) updateData.systemPrompt = updates.system_prompt;
  if (updates.required_tools !== undefined) updateData.requiredTools = updates.required_tools;
  if (updates.quality_checklist !== undefined) updateData.qualityChecklist = updates.quality_checklist;
  if (updates.status !== undefined) updateData.status = updates.status;

  await db.update(sopTemplates)
    .set(updateData)
    .where(eq(sopTemplates.id, template_id));

  eventBus.emit({ type: 'sop_template_update', resourceId: template_id });

  return {
    success: true,
    data: {
      id: template_id,
      updated: true,
    },
  };
}

/**
 * create_render_template - AI 创建渲染模板
 */
export async function handleCreateRenderTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
  const {
    name,
    description = '',
    category = 'custom',
    html_template,
    css_template = '',
    md_template,
    slots,
    sections = [],
    export_config = {},
  } = params as {
    name?: string;
    description?: string;
    category?: string;
    html_template?: string;
    css_template?: string;
    md_template?: string;
    slots?: Record<string, unknown>;
    sections?: Array<{ id: string; label: string; slotIds?: string[] }>;
    export_config?: Record<string, unknown>;
  };

  if (!name || !html_template || !md_template || !slots) {
    return { success: false, error: '缺少必要参数：name, html_template, md_template, slots' };
  }

  // HTML 安全校验：禁止危险标签和事件属性
  const dangerousPatterns = [
    /<script[\s>]/i,
    /on\w+\s*=/i,
    /javascript\s*:/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(html_template)) {
      return { success: false, error: `HTML 模板包含不安全内容: ${pattern.source}` };
    }
  }

  // 检查是否有 data-slot
  if (!html_template.includes('data-slot')) {
    return { success: false, error: 'HTML 模板必须包含至少一个 data-slot 属性标记可编辑区域' };
  }

  // 校验 category
  type RenderCategory = 'report' | 'card' | 'poster' | 'presentation' | 'custom';
  const validCategories: RenderCategory[] = ['report', 'card', 'poster', 'presentation', 'custom'];
  const finalCategory: RenderCategory = validCategories.includes(category as RenderCategory)
    ? (category as RenderCategory)
    : 'custom';

  const id = generateId();
  const now = new Date();

  await db.insert(renderTemplates).values({
    id,
    name,
    description,
    category: finalCategory,
    status: 'draft', // AI 创建的模板默认为 draft
    htmlTemplate: html_template,
    cssTemplate: css_template,
    mdTemplate: md_template,
    slots: slots as Record<string, { label: string; type: 'text' | 'richtext' | 'image' | 'data'; description?: string; placeholder?: string; }>,
    sections: sections.map(s => ({ id: s.id, label: s.label, slots: s.slotIds || [] })),
    exportConfig: { formats: ['jpg', 'html'], ...export_config } as { formats: ('jpg' | 'png' | 'html' | 'pdf')[]; defaultWidth?: number; defaultScale?: number; mode?: '16:9' | 'long' | 'a4' | 'custom'; },
    createdBy: 'ai',
    createdAt: now,
    updatedAt: now,
  });

  eventBus.emit({ type: 'render_template_update', resourceId: id });

  return {
    success: true,
    data: {
      id,
      name,
      status: 'draft',
      message: '渲染模板已创建（draft 状态），请在管理页面确认后激活',
    },
  };
}

/**
 * update_render_template - AI 更新渲染模板
 */
export async function handleUpdateRenderTemplate(params: Record<string, unknown>): Promise<HandlerResult> {
  const { template_id, ...updates } = params as {
    template_id?: string;
    name?: string;
    description?: string;
    html_template?: string;
    css_template?: string;
    md_template?: string;
    slots?: Record<string, unknown>;
    sections?: Array<{ id: string; label: string; slotIds?: string[] }>;
    export_config?: Record<string, unknown>;
    status?: string;
  };

  if (!template_id) {
    return { success: false, error: '缺少 template_id' };
  }

  const template = await db.query.renderTemplates.findFirst({
    where: eq(renderTemplates.id, template_id),
  });

  if (!template) {
    return { success: false, error: '渲染模板不存在' };
  }

  // HTML 安全校验（如果提供了）
  if (updates.html_template) {
    const dangerousPatterns = [
      /<script[\s>]/i,
      /on\w+\s*=/i,
      /javascript\s*:/i,
      /<iframe[\s>]/i,
      /<object[\s>]/i,
      /<embed[\s>]/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(updates.html_template)) {
        return { success: false, error: `HTML 模板包含不安全内容: ${pattern.source}` };
      }
    }
    if (!updates.html_template.includes('data-slot')) {
      return { success: false, error: 'HTML 模板必须包含至少一个 data-slot 属性' };
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.html_template !== undefined) updateData.htmlTemplate = updates.html_template;
  if (updates.css_template !== undefined) updateData.cssTemplate = updates.css_template;
  if (updates.md_template !== undefined) updateData.mdTemplate = updates.md_template;
  if (updates.slots !== undefined) updateData.slots = updates.slots;
  if (updates.sections !== undefined) {
    // 将 API 格式的 slotIds 转换为 schema 格式的 slots
    updateData.sections = Array.isArray(updates.sections)
      ? updates.sections.map(s => ({ id: s.id, label: s.label, slots: s.slotIds || [] }))
      : updates.sections;
  }
  if (updates.export_config !== undefined) updateData.exportConfig = updates.export_config;
  if (updates.status !== undefined) updateData.status = updates.status;

  await db.update(renderTemplates)
    .set(updateData)
    .where(eq(renderTemplates.id, template_id));

  eventBus.emit({ type: 'render_template_update', resourceId: template_id });

  return {
    success: true,
    data: {
      id: template_id,
      updated: true,
    },
  };
}
