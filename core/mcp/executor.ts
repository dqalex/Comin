/**
 * MCP 指令执行引擎
 * 
 * 负责：解析后的 ActionInstruction → 调用 MCP API 持久化 → 刷新前端 Store
 * 
 * v3.0 Phase F Store 解耦：
 * - 使用 refreshData 替代直接调用 Store.fetchXxx（部分已迁移）
 */

import type { ActionInstruction, ExecutionResult, PendingQuestion } from './types';
import { generateId } from '@/lib/id';
import { useTaskStore } from '@/store/task.store';
import { useMemberStore } from '@/store/member.store';
import { useProjectStore } from '@/store/project.store';
import { useDocumentStore } from '@/store/document.store';
import { useOpenClawStatusStore } from '@/store/openclaw.store';
import { useScheduledTaskStore } from '@/store/schedule.store';
import { useDeliveryStore } from '@/store/delivery.store';
import { useMilestoneStore } from '@/store/milestone.store';
import { useSOPTemplateStore } from '@/store/sop-template.store';
import { useRenderTemplateStore } from '@/store/render-template.store';
import { refreshData } from '@/lib/data-refresh';

async function callMcpTool(tool: string, parameters: Record<string, unknown>, context?: { agentId?: string; sessionKey?: string }): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // 传递调用者上下文，供审计日志使用
    if (context?.agentId) headers['X-Agent-Id'] = context.agentId;
    if (context?.sessionKey) headers['X-Session-Key'] = context.sessionKey;
    
    const res = await fetch('/api/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool, parameters }),
    });
    if (!res.ok) {
      // 优先尝试解析 JSON 错误响应
      try {
        const json = await res.json();
        return { success: false, error: `MCP API 返回 ${res.status}: ${json.error || JSON.stringify(json)}` };
      } catch {
        const text = await res.text();
        return { success: false, error: `MCP API 返回 ${res.status}: ${text.slice(0, 200)}` };
      }
    }
    return await res.json();
  } catch (err) {
    return { success: false, error: `MCP API 调用失败: ${err instanceof Error ? err.message : '网络错误'}` };
  }
}

export async function executeActionInstruction(
  action: ActionInstruction,
  options?: {
    conversationId?: string;
    onAskUser?: (question: PendingQuestion) => void;
  }
): Promise<ExecutionResult> {
  const taskStore = useTaskStore.getState();
  const documentStore = useDocumentStore.getState();
  const projectStore = useProjectStore.getState();
  const memberStore = useMemberStore.getState();
  const timestamp = new Date();

  try {
    switch (action.type) {
      case 'update_task': {
        if (!action.task_id) {
          return { actionType: action.type, success: false, message: '缺少 task_id', timestamp };
        }
        const result = await callMcpTool('update_task_status', {
          task_id: action.task_id,
          status: action.status || 'in_progress',
          progress: action.progress,
          message: action.message,
        });
        if (result.success) {
          const updateData: Record<string, unknown> = {};
          if (action.status) updateData.status = action.status;
          if (action.progress !== undefined) updateData.progress = action.progress;
          taskStore.updateTask(action.task_id, updateData);
        }
        return { actionType: action.type, success: result.success, message: result.success ? `任务状态更新为 ${action.status}` : (result.error || '更新失败'), timestamp };
      }

      case 'add_comment': {
        if (!action.task_id || !action.content) {
          return { actionType: action.type, success: false, message: '缺少 task_id 或 content', timestamp };
        }
        const result = await callMcpTool('add_task_comment', {
          task_id: action.task_id,
          content: action.content,
        });
        return { actionType: action.type, success: result.success, message: result.success ? '评论已添加' : (result.error || '评论创建失败'), timestamp };
      }

      case 'create_check_item': {
        if (!action.task_id || !action.text) {
          return { actionType: action.type, success: false, message: '缺少 task_id 或 text', timestamp };
        }
        const result = await callMcpTool('create_check_item', {
          task_id: action.task_id,
          text: action.text,
        });
        if (result.success) {
          await taskStore.fetchTasks();
        }
        return { actionType: action.type, success: result.success, message: result.success ? '检查项已创建' : (result.error || '创建失败'), timestamp };
      }

      case 'complete_check_item': {
        if (!action.task_id || !action.item_id) {
          return { actionType: action.type, success: false, message: '缺少 task_id 或 item_id', timestamp };
        }
        const result = await callMcpTool('complete_check_item', {
          task_id: action.task_id,
          item_id: action.item_id,
        });
        if (result.success) {
          await taskStore.fetchTasks();
        }
        return { actionType: action.type, success: result.success, message: result.success ? '检查项已完成' : (result.error || '完成失败'), timestamp };
      }

      case 'create_document': {
        if (!action.title || !action.content) {
          return { actionType: action.type, success: false, message: '缺少 title 或 content', timestamp };
        }
        const result = await callMcpTool('create_document', {
          title: action.title,
          content: action.content,
          doc_type: action.doc_type,
          project_id: action.project_id,
          render_mode: action.render_mode,
          render_template_id: action.render_template_id,
        });
        if (result.success) {
          await documentStore.fetchDocuments();
        }
        return { actionType: action.type, success: result.success, message: result.success ? `文档「${action.title}」已创建` : (result.error || '创建失败'), timestamp };
      }

      case 'update_document': {
        if (!action.document_id || !action.content) {
          return { actionType: action.type, success: false, message: '缺少 document_id 或 content', timestamp };
        }
        const result = await callMcpTool('update_document', {
          document_id: action.document_id,
          content: action.content,
          doc_type: action.doc_type,
        });
        if (result.success) {
          await documentStore.fetchDocuments();
        }
        return { actionType: action.type, success: result.success, message: result.success ? '文档已更新' : (result.error || '更新失败'), timestamp };
      }

      case 'request_info': {
        let data: Record<string, unknown> = {};
        
        switch (action.info_type) {
          case 'document': {
            if (action.info_id) {
              const doc = documentStore.documents.find(d => d.id === action.info_id);
              if (doc) data = { document: doc };
            } else if (action.query) {
              const docs = documentStore.documents.filter(d => 
                d.title.toLowerCase().includes(action.query!.toLowerCase()) ||
                (d.content && d.content.toLowerCase().includes(action.query!.toLowerCase()))
              ).slice(0, 5);
              data = { documents: docs.map(d => ({ id: d.id, title: d.title, snippet: (d.content || '').slice(0, 200) })) };
            }
            break;
          }
          case 'project': {
            if (action.info_id) {
              const project = projectStore.projects.find(p => p.id === action.info_id);
              if (project) {
                const projectTasks = taskStore.tasks.filter(t => t.projectId === action.info_id);
                const projectAssignees = new Set(projectTasks.flatMap(t => t.assignees));
                const projectMembers = memberStore.members.filter(m => projectAssignees.has(m.id));
                data = { 
                  project, 
                  tasks: projectTasks.slice(0, 10).map(t => ({ id: t.id, title: t.title, status: t.status })),
                  members: projectMembers.map(m => ({ id: m.id, name: m.name, type: m.type }))
                };
              }
            }
            break;
          }
          case 'task': {
            if (action.info_id) {
              const task = taskStore.tasks.find(t => t.id === action.info_id);
              if (task) data = { task };
            }
            break;
          }
          case 'member': {
            if (action.info_id) {
              const member = memberStore.members.find(m => m.id === action.info_id);
              if (member) data = { member: { id: member.id, name: member.name, type: member.type } };
            }
            break;
          }
        }
        
        return { 
          actionType: action.type, 
          success: Object.keys(data).length > 0, 
          message: Object.keys(data).length > 0 ? '信息已获取' : '未找到相关信息',
          data,
          timestamp 
        };
      }

      case 'ask_user': {
        if (!action.question) {
          return { actionType: action.type, success: false, message: '缺少 question', timestamp };
        }
        const pendingQuestion: PendingQuestion = {
          id: generateId(),
          question: action.question,
          options: action.options,
          urgent: action.urgent || false,
          askedAt: new Date(),
        };
        options?.onAskUser?.(pendingQuestion);
        return { 
          actionType: action.type, 
          success: true, 
          message: '问题已提交，等待用户回复',
          data: { questionId: pendingQuestion.id },
          timestamp 
        };
      }

      case 'update_status': {
        const result = await callMcpTool('update_status', {
          member_id: action.member_id,
          status: action.status || 'working',
          current_action: action.current_action,
          task_id: action.task_id,
          progress: action.progress,
        });
        if (result.success) {
          await useOpenClawStatusStore.getState().fetchStatus();
        }
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? `状态已更新为 ${action.status}` : (result.error || '状态更新失败'),
          timestamp 
        };
      }

      case 'set_queue': {
        if (!action.queued_tasks || action.queued_tasks.length === 0) {
          return { actionType: action.type, success: false, message: '缺少 queued_tasks', timestamp };
        }
        const result = await callMcpTool('set_queue', {
          member_id: action.member_id,
          queued_tasks: action.queued_tasks,
        });
        if (result.success) {
          await useOpenClawStatusStore.getState().fetchStatus();
        }
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? `任务队列已设置（${action.queued_tasks.length} 个任务）` : (result.error || '队列设置失败'),
          timestamp 
        };
      }

      case 'set_do_not_disturb': {
        const result = await callMcpTool('set_do_not_disturb', {
          member_id: action.member_id,
          interruptible: action.interruptible,
          reason: action.do_not_disturb_reason,
        });
        if (result.success) {
          await useOpenClawStatusStore.getState().fetchStatus();
        }
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success 
            ? (action.interruptible ? '已关闭免打扰模式' : `已开启免打扰模式：${action.do_not_disturb_reason || '进行关键操作'}`)
            : (result.error || '设置失败'),
          timestamp 
        };
      }

      case 'create_schedule': {
        if (!action.title || !action.task_type || !action.schedule_type) {
          return { actionType: action.type, success: false, message: '缺少必要参数：title, task_type, schedule_type', timestamp };
        }
        const result = await callMcpTool('create_schedule', {
          title: action.title,
          task_type: action.task_type,
          schedule_type: action.schedule_type,
          schedule_time: action.schedule_time,
          schedule_days: action.schedule_days,
          description: action.description,
          config: action.schedule_config,
          member_id: action.member_id,
        });
        if (result.success) {
          await useScheduledTaskStore.getState().fetchTasks();
        }
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? `定时任务「${action.title}」已创建` : (result.error || '创建定时任务失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp 
        };
      }

      case 'list_schedules': {
        const result = await callMcpTool('list_schedules', {
          member_id: action.member_id,
          enabled_only: action.enabled,
        });
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? '已获取定时任务列表' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp 
        };
      }

      case 'delete_schedule': {
        if (!action.schedule_id) {
          return { actionType: action.type, success: false, message: '缺少 schedule_id', timestamp };
        }
        const result = await callMcpTool('delete_schedule', {
          schedule_id: action.schedule_id,
        });
        if (result.success) {
          await useScheduledTaskStore.getState().fetchTasks();
        }
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? '定时任务已删除' : (result.error || '删除失败'),
          timestamp 
        };
      }

      case 'update_schedule': {
        if (!action.schedule_id) {
          return { actionType: action.type, success: false, message: '缺少 schedule_id', timestamp };
        }
        const params: Record<string, unknown> = { schedule_id: action.schedule_id };
        if (action.title) params.title = action.title;
        if (action.schedule_time) params.schedule_time = action.schedule_time;
        if (action.schedule_days) params.schedule_days = action.schedule_days;
        if (action.enabled !== undefined) params.enabled = action.enabled;
        if (action.description) params.description = action.description;
        const result = await callMcpTool('update_schedule', params);
        if (result.success) {
          await useScheduledTaskStore.getState().fetchTasks();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '定时任务已更新' : (result.error || '更新失败'),
          timestamp
        };
      }

      case 'deliver_document': {
        if (!action.title || !action.platform) {
          return { actionType: action.type, success: false, message: '缺少必要参数：title, platform', timestamp };
        }
        const result = await callMcpTool('deliver_document', {
          title: action.title,
          description: action.description,
          platform: action.platform,
          external_url: action.external_url,
          document_id: action.document_id,
          task_id: action.task_id,
          member_id: action.member_id,
        });
        if (result.success) {
          await useDeliveryStore.getState().fetchDeliveries();
        }
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? `文档「${action.title}」已提交交付，等待审核` : (result.error || '提交交付失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp 
        };
      }

      case 'review_delivery': {
        if (!action.delivery_id || !action.review_status) {
          return { actionType: action.type, success: false, message: '缺少必要参数：delivery_id, status', timestamp };
        }
        const result = await callMcpTool('review_delivery', {
          delivery_id: action.delivery_id,
          status: action.review_status,
          comment: action.review_comment,
          member_id: action.member_id,
        });
        if (result.success) {
          await useDeliveryStore.getState().fetchDeliveries();
        }
        const statusLabel = action.review_status === 'approved' ? '通过' : action.review_status === 'rejected' ? '拒绝' : '需修改';
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? `文档交付已${statusLabel}` : (result.error || '审核失败'),
          timestamp 
        };
      }

      case 'list_my_deliveries': {
        const result = await callMcpTool('list_my_deliveries', {
          status: action.delivery_status || 'all',
          limit: action.limit || 20,
          member_id: action.member_id,
        });
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? `查询到 ${(result.data as { total?: number })?.total || 0} 个交付物` : (result.error || '查询失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp 
        };
      }

      case 'get_delivery': {
        if (!action.delivery_id) {
          return { actionType: action.type, success: false, message: '缺少必要参数：delivery_id', timestamp };
        }
        const result = await callMcpTool('get_delivery', {
          delivery_id: action.delivery_id,
        });
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? `获取交付物详情成功` : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp 
        };
      }

      case 'register_member': {
        if (!action.name || !action.endpoint) {
          return { actionType: action.type, success: false, message: '缺少必要参数：name, endpoint', timestamp };
        }
        const result = await callMcpTool('register_member', {
          name: action.name,
          endpoint: action.endpoint,
          deploy_mode: action.deploy_mode,
          execution_mode: action.execution_mode,
          tools: action.tools,
          task_types: action.task_types,
          api_token: action.api_token,
        });
        if (result.success) {
          await memberStore.fetchMembers();
        }
        return { 
          actionType: action.type, 
          success: result.success, 
          message: result.success ? (result.data as Record<string, unknown>)?.message as string || 'AI 成员已注册' : (result.error || '注册失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp 
        };
      }

      case 'create_milestone': {
        if (!action.title || !action.project_id) {
          return { actionType: action.type, success: false, message: '缺少必要参数：title, project_id', timestamp };
        }
        const result = await callMcpTool('create_milestone', {
          title: action.title,
          project_id: action.project_id,
          description: action.description,
          status: action.status,
          due_date: action.due_date,
          sort_order: action.sort_order,
        });
        if (result.success) {
          await useMilestoneStore.getState().fetchMilestones();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? `里程碑「${action.title}」已创建` : (result.error || '创建里程碑失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'list_milestones': {
        const result = await callMcpTool('list_milestones', {
          project_id: action.project_id,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取里程碑列表' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'update_milestone': {
        if (!action.milestone_id) {
          return { actionType: action.type, success: false, message: '缺少 milestone_id', timestamp };
        }
        const params: Record<string, unknown> = { milestone_id: action.milestone_id };
        if (action.title) params.title = action.title;
        if (action.description !== undefined) params.description = action.description;
        if (action.status) params.status = action.status;
        if (action.due_date !== undefined) params.due_date = action.due_date;
        if (action.sort_order !== undefined) params.sort_order = action.sort_order;
        const result = await callMcpTool('update_milestone', params);
        if (result.success) {
          await useMilestoneStore.getState().fetchMilestones();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '里程碑已更新' : (result.error || '更新失败'),
          timestamp
        };
      }

      case 'delete_milestone': {
        if (!action.milestone_id) {
          return { actionType: action.type, success: false, message: '缺少 milestone_id', timestamp };
        }
        const result = await callMcpTool('delete_milestone', {
          milestone_id: action.milestone_id,
        });
        if (result.success) {
          await useMilestoneStore.getState().fetchMilestones();
          await taskStore.fetchTasks();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '里程碑已删除' : (result.error || '删除失败'),
          timestamp
        };
      }

      // ========== SOP 引擎工具（v3.0 新增）==========

      case 'advance_sop_stage': {
        if (!action.task_id) {
          return { actionType: action.type, success: false, message: '缺少 task_id', timestamp };
        }
        const result = await callMcpTool('advance_sop_stage', {
          task_id: action.task_id,
          stage_output: action.stage_output,
        });
        if (result.success) {
          await taskStore.fetchTasks();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success 
            ? `SOP 阶段已推进${(result.data as Record<string, unknown>)?.is_sop_completed ? '（SOP 已完成）' : ''}`
            : (result.error || '推进失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'request_sop_confirm': {
        if (!action.task_id || !action.confirm_message || !action.stage_output) {
          return { actionType: action.type, success: false, message: '缺少必要参数：task_id, confirm_message, stage_output', timestamp };
        }
        const result = await callMcpTool('request_sop_confirm', {
          task_id: action.task_id,
          confirm_message: action.confirm_message,
          stage_output: action.stage_output,
        });
        if (result.success) {
          await taskStore.fetchTasks();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已请求人工确认，等待用户回复' : (result.error || '请求失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'get_sop_context': {
        if (!action.task_id) {
          return { actionType: action.type, success: false, message: '缺少 task_id', timestamp };
        }
        const result = await callMcpTool('get_sop_context', {
          task_id: action.task_id,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取 SOP 上下文' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'save_stage_output': {
        if (!action.task_id || !action.output) {
          return { actionType: action.type, success: false, message: '缺少必要参数：task_id, output', timestamp };
        }
        const result = await callMcpTool('save_stage_output', {
          task_id: action.task_id,
          output: action.output,
          output_type: action.output_type || 'text',
        });
        if (result.success) {
          await taskStore.fetchTasks();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '阶段产出已保存' : (result.error || '保存失败'),
          timestamp
        };
      }

      case 'update_knowledge': {
        if (!action.document_id || !action.content) {
          return { actionType: action.type, success: false, message: '缺少必要参数：document_id, content', timestamp };
        }
        const result = await callMcpTool('update_knowledge', {
          document_id: action.document_id,
          content: action.content,
          layer: action.layer,
        });
        if (result.success) {
          await documentStore.fetchDocuments();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '知识库已更新' : (result.error || '更新失败'),
          timestamp
        };
      }

      // ========== AI 自主创作工具（v3.0 新增）==========

      case 'create_sop_template': {
        if (!action.name || !action.stages || action.stages.length === 0) {
          return { actionType: action.type, success: false, message: '缺少必要参数：name, stages', timestamp };
        }
        const result = await callMcpTool('create_sop_template', {
          name: action.name,
          description: action.description,
          category: action.category || 'custom',
          stages: action.stages,
          system_prompt: action.system_prompt,
          required_tools: action.required_tools,
          quality_checklist: action.quality_checklist,
          project_id: action.project_id,
        });
        if (result.success) {
          await useSOPTemplateStore.getState().fetchTemplates();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? `SOP 模板「${action.name}」已创建（draft 状态）` : (result.error || '创建失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'update_sop_template': {
        if (!action.template_id) {
          return { actionType: action.type, success: false, message: '缺少 template_id', timestamp };
        }
        const params: Record<string, unknown> = { template_id: action.template_id };
        if (action.name) params.name = action.name;
        if (action.description !== undefined) params.description = action.description;
        if (action.stages) params.stages = action.stages;
        if (action.system_prompt !== undefined) params.system_prompt = action.system_prompt;
        if (action.required_tools) params.required_tools = action.required_tools;
        if (action.quality_checklist) params.quality_checklist = action.quality_checklist;
        if (action.template_status) params.status = action.template_status;
        
        const result = await callMcpTool('update_sop_template', params);
        if (result.success) {
          await useSOPTemplateStore.getState().fetchTemplates();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? 'SOP 模板已更新' : (result.error || '更新失败'),
          timestamp
        };
      }

      case 'list_render_templates': {
        const result = await callMcpTool('list_render_templates', {
          category: action.category,
          status: action.status || 'active',
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? `获取到 ${(result.data as { templates: unknown[] })?.templates?.length || 0} 个渲染模板` : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'get_render_template': {
        if (!action.template_id) {
          return { actionType: action.type, success: false, message: '缺少 template_id', timestamp };
        }
        const result = await callMcpTool('get_render_template', {
          template_id: action.template_id,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? `获取模板详情成功` : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'create_render_template': {
        if (!action.name || !action.html_template || !action.md_template || !action.slots) {
          return { actionType: action.type, success: false, message: '缺少必要参数：name, html_template, md_template, slots', timestamp };
        }
        const result = await callMcpTool('create_render_template', {
          name: action.name,
          description: action.description,
          category: action.category || 'custom',
          html_template: action.html_template,
          css_template: action.css_template,
          md_template: action.md_template,
          slots: action.slots,
          sections: action.sections,
          export_config: action.export_config,
        });
        if (result.success) {
          await useRenderTemplateStore.getState().fetchTemplates();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? `渲染模板「${action.name}」已创建（draft 状态）` : (result.error || '创建失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'update_render_template': {
        if (!action.template_id) {
          return { actionType: action.type, success: false, message: '缺少 template_id', timestamp };
        }
        const params: Record<string, unknown> = { template_id: action.template_id };
        if (action.name) params.name = action.name;
        if (action.description !== undefined) params.description = action.description;
        if (action.html_template) params.html_template = action.html_template;
        if (action.css_template !== undefined) params.css_template = action.css_template;
        if (action.md_template) params.md_template = action.md_template;
        if (action.slots) params.slots = action.slots;
        if (action.sections) params.sections = action.sections;
        if (action.export_config) params.export_config = action.export_config;
        if (action.template_status) params.status = action.template_status;
        
        const result = await callMcpTool('update_render_template', params);
        if (result.success) {
          await useRenderTemplateStore.getState().fetchTemplates();
        }
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '渲染模板已更新' : (result.error || '更新失败'),
          timestamp
        };
      }

      // ========== Agent MCP Token 工具（v3.0 Phase F 新增）==========

      case 'get_agent_mcp_token': {
        const result = await callMcpTool('get_agent_mcp_token', {
          member_id: action.member_id,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取 Agent MCP Token' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'list_agent_mcp_tokens': {
        const result = await callMcpTool('list_agent_mcp_tokens', {
          member_id: action.member_id,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已列出 Tokens' : (result.error || '查询失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'revoke_agent_mcp_token': {
        if (!action.token_id) {
          return { actionType: action.type, success: false, message: '缺少 token_id', timestamp };
        }
        const result = await callMcpTool('revoke_agent_mcp_token', {
          token_id: action.token_id,
          member_id: action.member_id,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? 'Token 已撤销' : (result.error || '撤销失败'),
          timestamp
        };
      }

      // ========== 上下文获取工具（v3.0 Phase F 渐进式）==========

      case 'get_task_detail': {
        if (!action.task_id) {
          return { actionType: action.type, success: false, message: '缺少 task_id', timestamp };
        }
        const result = await callMcpTool('get_task_detail', {
          task_id: action.task_id,
          include: action.include,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取任务详情' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'get_project_detail': {
        if (!action.project_id) {
          return { actionType: action.type, success: false, message: '缺少 project_id', timestamp };
        }
        const result = await callMcpTool('get_project_detail', {
          project_id: action.project_id,
          include: action.include,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取项目详情' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'get_document_detail': {
        const result = await callMcpTool('get_document_detail', {
          document_id: action.document_id,
          title: action.title,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取文档详情' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'get_sop_previous_output': {
        if (!action.task_id) {
          return { actionType: action.type, success: false, message: '缺少 task_id', timestamp };
        }
        const result = await callMcpTool('get_sop_previous_output', {
          task_id: action.task_id,
          stage_id: action.stage_id,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取前序产出' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'get_sop_knowledge_layer': {
        if (!action.task_id) {
          return { actionType: action.type, success: false, message: '缺少 task_id', timestamp };
        }
        const result = await callMcpTool('get_sop_knowledge_layer', {
          task_id: action.task_id,
          layer: action.layer || 'L1',
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取知识库层级' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      // ========== Skill 工具（v3.0 SkillHub 集成）==========

      case 'invoke_skill': {
        if (!action.skill_key) {
          return { actionType: action.type, success: false, message: '缺少 skill_key', timestamp };
        }
        const result = await callMcpTool('invoke_skill', {
          skill_key: action.skill_key,
          task_id: action.task_id,
          parameters: action.parameters,
          context: action.context,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? `Skill "${action.skill_key}" 已加载` : (result.error || '调用失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      case 'list_skills': {
        const result = await callMcpTool('list_skills', {
          category: action.category,
          search: action.search,
          limit: action.limit,
        });
        return {
          actionType: action.type,
          success: result.success,
          message: result.success ? '已获取 Skill 列表' : (result.error || '获取失败'),
          data: result.data as Record<string, unknown> | undefined,
          timestamp
        };
      }

      default:
        return { actionType: action.type as string, success: false, message: '未知指令类型', timestamp };
    }
  } catch (error) {
    return { 
      actionType: action.type as string, 
      success: false, 
      message: error instanceof Error ? error.message : '执行失败',
      timestamp 
    };
  }
}

export async function executeActionInstructions(
  actions: ActionInstruction[],
  options?: {
    conversationId?: string;
    onAskUser?: (question: PendingQuestion) => void;
  }
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  for (const action of actions) {
    const result = await executeActionInstruction(action, options);
    results.push(result);
  }
  return results;
}
