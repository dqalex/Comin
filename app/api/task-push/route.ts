/**
 * 任务推送 API（统一版）
 * 支持单条推送（taskId）和批量推送（taskIds）
 *
 * 使用模板引擎渲染 task-push / batch-task-push / sop-task-push 模板
 * SOP 任务自动使用 sop-task-push 模板，注入阶段信息和前序产出
 */
import { NextRequest, NextResponse } from 'next/server';
import { db, tasks, members, projects, documents, openclawFiles, openclawWorkspaces } from '@/db';
import { sopTemplates } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { renderTemplateWithContext } from '@/lib/template-engine';
import { parseKnowHow, extractLayers } from '@/lib/knowhow-parser';
import type { SOPStage, StageRecord, KnowledgeConfig } from '@/db/schema';

/** 获取所有成员（缓存在函数作用域内，单请求复用） */
async function getAllMembers() {
  return db.select().from(members);
}

/** 解析负责人名称 */
function resolveAssigneeNames(assignees: unknown, allMembers: Array<{ id: string; name: string }>) {
  return (Array.isArray(assignees) ? assignees : [])
    .map(id => allMembers.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}

/** 构建单条任务的文件附件信息 */
async function buildFilesSection(attachmentIds: string[]) {
  if (attachmentIds.length === 0) return { filesSection: null, mappedWorkspacesData: null, mappedFilesData: null };

  const attachedDocs = await db.select()
    .from(documents)
    .where(inArray(documents.id, attachmentIds));

  if (attachedDocs.length === 0) return { filesSection: null, mappedWorkspacesData: null, mappedFilesData: null };

  // 获取 OpenClaw 映射文件信息
  const docIds = attachedDocs.map(d => d.id);
  const mappedFiles = await db.select()
    .from(openclawFiles)
    .where(inArray(openclawFiles.documentId, docIds));

  const workspaceIds = [...new Set(mappedFiles.map(f => f.workspaceId).filter(Boolean))] as string[];
  const workspaces = workspaceIds.length > 0
    ? await db.select().from(openclawWorkspaces).where(inArray(openclawWorkspaces.id, workspaceIds))
    : [];

  const workspaceMap = new Map(workspaces.map(w => [w.id, w]));
  const workspacePaths = new Set<string>();
  const mappedFilesData: Array<{ doc_id: string; doc_title: string; workspace_path: string; relative_path: string }> = [];

  mappedFiles.forEach(mf => {
    const ws = workspaceMap.get(mf.workspaceId);
    const doc = attachedDocs.find(d => d.id === mf.documentId);
    if (ws && doc) {
      workspacePaths.add(ws.path);
      mappedFilesData.push({
        doc_id: doc.id,
        doc_title: doc.title,
        workspace_path: ws.path,
        relative_path: mf.relativePath,
      });
    }
  });

  const mappedWorkspacesData = [...workspacePaths].map(path => ({ path }));
  const nonMappedDocs = attachedDocs.filter(d => !mappedFiles.find(mf => mf.documentId === d.id));
  
  const fileList = [
    ...mappedFilesData.map(f => `- **${f.doc_title}** [映射目录: ${f.workspace_path}] - ${f.relative_path}`),
    ...nonMappedDocs.map(doc => `- **${doc.title}** [CoMind 存储] - doc:${doc.id}`),
  ].join('\n');

  return {
    filesSection: fileList ? `## 关联文件\n${fileList}` : null,
    mappedWorkspacesData: mappedWorkspacesData.length > 0 ? mappedWorkspacesData : null,
    mappedFilesData: mappedFilesData.length > 0 ? mappedFilesData : null,
  };
}

/** 单条推送 */
async function handleSinglePush(taskId: string, sessionKey: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }

  // SOP 任务使用专用模板
  if (task.sopTemplateId) {
    return handleSopPush(task, sessionKey);
  }

  // 普通任务使用通用模板
  return handleNormalPush(task, sessionKey);
}

/** 普通任务推送（使用 task-push 模板） */
async function handleNormalPush(task: typeof tasks.$inferSelect, sessionKey: string) {
  // 获取项目信息
  let projectInfo = {
    project_id: '',
    project_name: '未分类',
    project_description: null as string | null,
    project_source: 'local',
  };

  if (task.projectId) {
    const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId));
    if (project) {
      projectInfo = {
        project_id: project.id,
        project_name: project.name,
        project_description: project.description,
        project_source: project.source,
      };
    }
  }

  const allMembers = await getAllMembers();
  const assigneeNames = resolveAssigneeNames(task.assignees, allMembers);
  const { filesSection, mappedWorkspacesData, mappedFilesData } = await buildFilesSection(task.attachments || []);

  const message = await renderTemplateWithContext('task-push', {
    timestamp: new Date().toLocaleString('zh-CN'),
    task_id: task.id,
    task_title: task.title,
    task_description: task.description || '无',
    task_priority: task.priority,
    task_status: task.status,
    task_deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('zh-CN') : null,
    task_assignees: assigneeNames || '未指定',
    project_id: projectInfo.project_id,
    project_name: projectInfo.project_name,
    project_description: projectInfo.project_description,
    project_source: projectInfo.project_source,
    conversation_id: sessionKey,
    mapped_workspaces: mappedWorkspacesData,
    mapped_files: mappedFilesData,
    files_section: filesSection,
    context_section: null,
  });

  if (!message) {
    return NextResponse.json({
      success: false,
      error: 'task-push 模板不存在，请检查 public/skills/templates/task-push.md',
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: { taskId: task.id, message, sessionKey },
  });
}

/** SOP 任务推送（使用 sop-task-push 模板） */
async function handleSopPush(task: typeof tasks.$inferSelect, sessionKey: string) {
  // 获取 SOP 模板
  const template = task.sopTemplateId
    ? await db.query.sopTemplates.findFirst({ where: eq(sopTemplates.id, task.sopTemplateId) })
    : null;

  if (!template) {
    // 模板丢失，降级为普通推送
    return handleNormalPush(task, sessionKey);
  }

  const stages = (template.stages || []) as SOPStage[];
  const stageHistory = (Array.isArray(task.stageHistory) ? task.stageHistory : []) as StageRecord[];
  const currentStageId = task.currentStageId;
  const currentIndex = stages.findIndex(s => s.id === currentStageId);
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : stages[0];

  // 构建前序阶段产出
  const previousOutputs: Array<{ stage_label: string; output: string }> = [];
  for (const stage of stages) {
    if (stage.id === currentStageId) break;
    const record = stageHistory.find(r => r.stageId === stage.id);
    if (record?.output) {
      previousOutputs.push({ stage_label: stage.label, output: record.output });
    }
  }

  // 构建阶段类型布尔标志
  const stageType = currentStage?.type || 'ai_auto';
  const isAiAuto = stageType === 'ai_auto';
  const isAiWithConfirm = stageType === 'ai_with_confirm';
  const isInput = stageType === 'input';
  const isRender = stageType === 'render';

  // 计算进度
  const completedCount = stageHistory.filter(r => r.status === 'completed' || r.status === 'skipped').length;
  const progress = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  // 收集用户输入数据
  const sopInputs = task.sopInputs ? JSON.stringify(task.sopInputs, null, 2) : null;

  // 加载知识库内容（按当前阶段的 knowledgeLayers 分层读取）
  let knowledgeContent: string | null = null;
  if (template.knowledgeConfig) {
    const config = template.knowledgeConfig as KnowledgeConfig;
    if (config.documentId) {
      const [knowDoc] = await db.select().from(documents).where(eq(documents.id, config.documentId));
      if (knowDoc?.content && typeof knowDoc.content === 'string') {
        const parsed = parseKnowHow(knowDoc.content);
        // 使用当前阶段配置的层级，默认 L1
        const requestedLayers = (currentStage?.knowledgeLayers as Array<'L1'|'L2'|'L3'|'L4'|'L5'>) || ['L1'];
        knowledgeContent = extractLayers(parsed, requestedLayers);
      }
    }
  }

  const message = await renderTemplateWithContext('sop-task-push', {
    timestamp: new Date().toLocaleString('zh-CN'),
    task_id: task.id,
    task_title: task.title,
    task_description: task.description || '无',
    sop_name: template.name,
    sop_description: template.description || '无',
    sop_system_prompt: template.systemPrompt || null,
    current_stage_id: currentStage?.id || '',
    current_stage_label: currentStage?.label || '未知',
    current_stage_type: stageType,
    current_stage_index: currentIndex >= 0 ? currentIndex + 1 : 1,
    total_stages: stages.length,
    current_stage_prompt: currentStage?.promptTemplate || null,
    current_stage_output_type: currentStage?.outputType || null,
    require_confirm: isAiWithConfirm,
    progress,
    has_previous_outputs: previousOutputs.length > 0,
    previous_outputs: previousOutputs.length > 0 ? previousOutputs : null,
    sop_inputs: sopInputs,
    knowledge_content: knowledgeContent,
    is_ai_auto: isAiAuto,
    is_ai_with_confirm: isAiWithConfirm,
    is_input: isInput,
    is_render: isRender,
    conversation_id: sessionKey,
  });

  if (!message) {
    // SOP 模板不存在，降级为普通推送
    return handleNormalPush(task, sessionKey);
  }

  return NextResponse.json({
    success: true,
    data: { taskId: task.id, message, sessionKey, isSop: true },
  });
}

/** 批量推送 */
async function handleBatchPush(taskIds: string[], sessionKey: string) {
  const taskList = await db.select().from(tasks).where(inArray(tasks.id, taskIds));
  if (taskList.length === 0) {
    return NextResponse.json({ error: '未找到任何任务' }, { status: 404 });
  }

  const projectIds = [...new Set(taskList.map(t => t.projectId).filter(Boolean))] as string[];
  const projectList = projectIds.length > 0
    ? await db.select().from(projects).where(inArray(projects.id, projectIds))
    : [];
  const projectMap = new Map(projectList.map(p => [p.id, p]));

  const allMembers = await getAllMembers();

  const orderedTasks = taskIds
    .map((id, idx) => {
      const task = taskList.find(t => t.id === id);
      if (!task) return null;
      const project = task.projectId ? projectMap.get(task.projectId) : null;
      const assigneeNames = resolveAssigneeNames(task.assignees, allMembers);

      return {
        index: idx + 1,
        id: task.id,
        title: task.title,
        description: task.description || null,
        priority: task.priority,
        status: task.status,
        deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('zh-CN') : null,
        assignees: assigneeNames || null,
        project_name: project?.name || null,
        project_id: project?.id || null,
        last: idx === taskIds.length - 1,
      };
    })
    .filter(Boolean);

  const message = await renderTemplateWithContext('batch-task-push', {
    timestamp: new Date().toLocaleString('zh-CN'),
    task_count: orderedTasks.length,
    tasks: orderedTasks,
    conversation_id: sessionKey,
  });

  if (!message) {
    return NextResponse.json({
      success: false,
      error: 'batch-task-push 模板不存在，请检查 public/skills/templates/batch-task-push.md',
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      taskIds: orderedTasks.map(t => t!.id),
      taskCount: orderedTasks.length,
      message,
      sessionKey,
    },
  });
}

// POST /api/task-push - 推送任务给 AI（支持单条和批量）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, taskIds, sessionKey } = body as {
      taskId?: string;
      taskIds?: string[];
      sessionKey: string;
    };

    if (!sessionKey) {
      return NextResponse.json({ error: '缺少必填参数: sessionKey' }, { status: 400 });
    }

    // 批量模式
    if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
      return handleBatchPush(taskIds, sessionKey);
    }

    // 单条模式
    if (taskId) {
      return handleSinglePush(taskId, sessionKey);
    }

    return NextResponse.json({ error: '缺少必填参数: taskId 或 taskIds' }, { status: 400 });
  } catch (error) {
    console.error('[task-push]', error);
    return NextResponse.json({ error: '推送失败' }, { status: 500 });
  }
}
