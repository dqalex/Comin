'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { useTaskStore, useMemberStore, useCommentStore, useTaskLogStore, useDocumentStore, useChatStore, useProjectStore, useOpenClawWorkspaceStore, useMilestoneStore, useSOPTemplateStore } from '@/store';
import { useGatewayStore } from '@/store/gateway.store';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Input, Select, Textarea, Button } from '@/components/ui';
import type { Task } from '@/db/schema';
import DocumentPicker from '@/components/DocumentPicker';
import { SOPProgressBar } from '@/components/sop';
import {
  X, Save, Trash2, Bot, User, MessageSquare, Clock,
  CheckSquare, Square, Plus, Calendar, ChevronDown,
  AlertCircle, History, FileText, Link2, Send,
  Milestone as MilestoneIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { formatRelativeTime } from '@/hooks/useRelativeTime';

const PRIORITY_MAP: Record<string, { label: string; class: string }> = {
  high: { label: '高', class: 'priority-high' },
  medium: { label: '中', class: 'priority-medium' },
  low: { label: '低', class: 'priority-low' },
};

const STATUS_OPTIONS = [
  { key: 'todo', label: '待处理', color: 'bg-slate-400' },
  { key: 'in_progress', label: '进行中', color: 'bg-blue-500' },
  { key: 'reviewing', label: '审核中', color: 'bg-amber-500' },
  { key: 'completed', label: '已完成', color: 'bg-emerald-500' },
];

interface Props {
  task: Task;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export default function TaskDrawer({ task, onClose, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { updateTaskAsync, deleteTaskAsync } = useTaskStore();
  const { members } = useMemberStore();
  const { comments, fetchCommentsByTask } = useCommentStore();
  const { logs, fetchLogsByTask } = useTaskLogStore();
  const { documents } = useDocumentStore();
  const { openChatWithMessage } = useChatStore();
  const { projects } = useProjectStore();
  const { workspaces, files: openclawFiles } = useOpenClawWorkspaceStore();
  const { milestones } = useMilestoneStore();
  const { templates: sopTemplates } = useSOPTemplateStore();
  const { fetchTasks } = useTaskStore();

  const [activeTab, setActiveTab] = useState<'detail' | 'comments' | 'logs'>('detail');
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [newComment, setNewComment] = useState('');
  const deleteConfirm = useConfirmAction<boolean>();
  const [newCheckItem, setNewCheckItem] = useState('');
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const { connected, connectionMode, serverProxyConnected, pushTaskToAI, agentsMainKey } = useGatewayStore();
  const gwConnected = connectionMode === 'server_proxy' ? serverProxyConnected : connected;

  const titleDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const descDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const submitByEnterRef = useRef(false);

  const taskComments = useMemo(() =>
    comments.filter(c => c.taskId === task.id).sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ), [comments, task.id]);

  const taskLogs = useMemo(() =>
    logs.filter(l => l.taskId === task.id).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ), [logs, task.id]);

  const checkItems: Array<{ id: string; text: string; completed: boolean }> = useMemo(() => {
    if (!task.checkItems) return [];
    if (Array.isArray(task.checkItems)) return task.checkItems as Array<{ id: string; text: string; completed: boolean }>;
    try { return JSON.parse(task.checkItems as string); } catch { return []; }
  }, [task.checkItems]);

  useEffect(() => {
    fetchCommentsByTask(task.id);
    fetchLogsByTask(task.id);
  }, [task.id, fetchCommentsByTask, fetchLogsByTask]);

  // 标题防抖保存
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      if (value.trim() && value !== task.title) {
        updateTaskAsync(task.id, { title: value.trim() });
      }
    }, 500);
  };

  // 描述防抖保存
  const handleDescChange = (value: string) => {
    setDescription(value);
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    descDebounceRef.current = setTimeout(() => {
      updateTaskAsync(task.id, { description: value });
    }, 500);
  };

  const { createLog } = useTaskLogStore();

  const handleStatusChange = async (status: string) => {
    const oldLabel = STATUS_OPTIONS.find(s => s.key === task.status)?.label || task.status;
    const newLabel = STATUS_OPTIONS.find(s => s.key === status)?.label || status;
    await updateTaskAsync(task.id, { status: status as Task['status'] });
    createLog({ taskId: task.id, action: '状态变更', message: `${oldLabel} → ${newLabel}` });
  };

  const handlePriorityChange = async (priority: string) => {
    const oldLabel = PRIORITY_MAP[task.priority]?.label || task.priority;
    const newLabel = PRIORITY_MAP[priority]?.label || priority;
    await updateTaskAsync(task.id, { priority: priority as Task['priority'] });
    createLog({ taskId: task.id, action: '优先级变更', message: `${oldLabel} → ${newLabel}` });
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    const assignees = assigneeId ? [assigneeId] : [];
    const oldName = (task.assignees as string[])?.[0] ? members.find(m => m.id === (task.assignees as string[])[0])?.name || '未指定' : '未指定';
    const newName = assigneeId ? members.find(m => m.id === assigneeId)?.name || assigneeId : '未指定';
    await updateTaskAsync(task.id, { assignees });
    createLog({ taskId: task.id, action: '负责人变更', message: `${oldName} → ${newName}` });
  };

  const handleDeadlineChange = async (deadline: string) => {
    await updateTaskAsync(task.id, { deadline: deadline ? new Date(deadline) : null });
    createLog({ taskId: task.id, action: '截止日期变更', message: deadline || '已清除' });
  };

  // 里程碑相关
  const projectMilestones = useMemo(() =>
    milestones.filter(m => m.projectId === task.projectId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [milestones, task.projectId]
  );

  const handleMilestoneChange = async (milestoneId: string) => {
    const oldMs = milestones.find(m => m.id === task.milestoneId);
    const newMs = milestoneId ? milestones.find(m => m.id === milestoneId) : null;
    await updateTaskAsync(task.id, { milestoneId: milestoneId || null });
    createLog({ taskId: task.id, action: '里程碑变更', message: `${oldMs?.title || '未分配'} → ${newMs?.title || '未分配'}` });
  };

  const handleToggleCheckItem = async (index: number) => {
    const updated = [...checkItems];
    updated[index] = { ...updated[index], completed: !updated[index].completed };
    await updateTaskAsync(task.id, { checkItems: updated as any });
  };

  const handleAddCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    const updated = [...checkItems, { id: crypto.randomUUID(), text: newCheckItem.trim(), completed: false }];
    await updateTaskAsync(task.id, { checkItems: updated as any });
    setNewCheckItem('');
  };

  const handleRemoveCheckItem = async (index: number) => {
    const updated = checkItems.filter((_, i) => i !== index);
    await updateTaskAsync(task.id, { checkItems: updated as any });
  };

  const currentUser = useMemo(() => members.find(m => m.type === 'human'), [members]);

  // SOP 阶段操作回调
  const handleSopAction = useCallback(async (action: 'confirm' | 'reject' | 'skip' | 'start', sopInputs?: Record<string, string>) => {
    const res = await fetch(`/api/tasks/${task.id}/sop-advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, confirmedBy: currentUser?.id || 'human', sopInputs }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '操作失败' }));
      console.error('SOP action failed:', err.error);
    }
    await fetchTasks();
  }, [task.id, fetchTasks, currentUser?.id]);

  // render 阶段：跳转到 Wiki Content Studio 编辑
  const handleOpenStudio = useCallback((documentId: string) => {
    router.push(`/wiki?doc=${documentId}`);
    onClose();
  }, [router, onClose]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    submitByEnterRef.current = true;
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, authorId: currentUser?.id || 'system', content: newComment.trim() }),
      });
      fetchCommentsByTask(task.id);
      setNewComment('');
    } catch {
      // ignore
    }
    submitByEnterRef.current = false;
  };

  const handleChatAboutTask = () => {
    // 获取项目信息
    const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;

    // 检查是否有本地映射目录（通过关联文档）
    const mappedWorkspaces: Set<string> = new Set();
    const mappedFiles: Array<{ docId: string; docTitle: string; workspacePath: string; relativePath: string }> = [];
    
    if (attachments.length > 0) {
      attachments.forEach(docId => {
        const mappedFile = openclawFiles.find(f => f.documentId === docId);
        if (mappedFile) {
          const ws = workspaces.find(w => w.id === mappedFile.workspaceId);
          if (ws) {
            mappedWorkspaces.add(ws.path);
            const doc = documents.find(d => d.id === docId);
            mappedFiles.push({
              docId,
              docTitle: doc?.title || '未知文档',
              workspacePath: ws.path,
              relativePath: mappedFile.relativePath,
            });
          }
        }
      });
    }

    // 构造消息：包含完整来源信息，明确告知 AI 这是引用讨论，先不要执行
    const lines = [
      '**这是一条引用讨论消息，请先不要执行任何操作，我们只需要讨论方案。**',
      '',
      '---',
      '',
      '## 来源信息',
      '- **数据来源**: CoMind 协作平台',
      '- **服务类型**: 本地 SQLite 数据库（通过 CoMind MCP 工具访问）',
      '',
      '## 引用的任务',
      `- **任务 ID**: ${task.id}`,
      `- **任务标题**: ${task.title}`,
      `- **状态**: ${STATUS_OPTIONS.find(s => s.key === task.status)?.label || task.status}`,
      `- **优先级**: ${PRIORITY_MAP[task.priority]?.label || task.priority}`,
      `- **创建时间**: ${task.createdAt ? new Date(task.createdAt).toLocaleString('zh-CN') : '未知'}`,
      '',
    ];

    if (task.description) {
      lines.push('### 任务描述', task.description, '');
    }

    if (task.deadline) {
      lines.push(`### 截止日期: ${new Date(task.deadline).toLocaleDateString('zh-CN')}`, '');
    }

    if (project) {
      lines.push(
        '## 所属项目',
        `- **项目 ID**: ${project.id}`,
        `- **项目名称**: ${project.name}`,
        `- **项目来源**: ${project.source === 'openclaw' ? 'OpenClaw 同步' : '本地创建'}`,
        ''
      );
      if (project.description) {
        lines.push(`项目描述: ${project.description}`, '');
      }
    }

    // 本地映射目录信息
    if (mappedWorkspaces.size > 0) {
      lines.push('## 本地映射目录');
      lines.push('> 以下文档已映射到本地目录，你可以直接读取本地文件：', '');
      mappedWorkspaces.forEach(path => {
        lines.push(`- **目录路径**: ${path}`);
      });
      lines.push('', '### 映射的文档', '');
      mappedFiles.forEach(f => {
        lines.push(`- **${f.docTitle}** (${f.docId})`);
        lines.push(`  - 本地路径: ${f.workspacePath}/${f.relativePath}`);
      });
      lines.push('');
    }

    // 关联文档（非映射的）
    const nonMappedAttachments = attachments.filter(docId => !openclawFiles.find(f => f.documentId === docId));
    if (nonMappedAttachments.length > 0) {
      const attachedDocs = documents.filter(d => nonMappedAttachments.includes(d.id));
      if (attachedDocs.length > 0) {
        lines.push('## 关联文档（CoMind 存储）');
        attachedDocs.forEach(doc => {
          lines.push(`- **文档 ID**: ${doc.id} - ${doc.title}`);
        });
        lines.push('');
      }
    }

    lines.push(
      '---',
      '',
      '## 访问方式',
      ''
    );

    if (mappedWorkspaces.size > 0) {
      lines.push('### 优先读取本地目录');
      mappedWorkspaces.forEach(path => {
        lines.push(`- 使用 \`read\` 工具读取: ${path}/xxx.md`);
      });
      lines.push('', '### 然后通过 MCP 了解 CoMind 信息');
    }

    lines.push(
      '- 任务: `get_task` 或 `list_tasks`',
      '- 项目: `get_project` 或 `list_projects`',
      '- 文档: `get_document` 或 `list_documents`',
      '',
      '**请分析这个任务，给出你的建议和执行方案，但暂时不要执行任何修改操作。**'
    );

    openChatWithMessage(lines.join('\n'));
  };

  const handlePushToAI = async () => {
    if (!gwConnected || !agentsMainKey) {
      setPushResult({ ok: false, msg: 'Gateway 未连接' });
      setTimeout(() => setPushResult(null), 3000);
      return;
    }
    
    // 1. 先调用后端 API 获取渲染后的推送消息
    setPushing(true);
    setPushResult(null);
    const result = await pushTaskToAI(task.id, agentsMainKey);
    setPushing(false);
    
    if (!result.success || !result.message) {
      setPushResult({ ok: false, msg: result.error || '推送失败' });
      setTimeout(() => setPushResult(null), 3000);
      return;
    }
    
    // 2. 通过 openChatWithMessage 打开 ChatPanel 并发送消息
    // 这样消息会在 ChatPanel 中显示，并通过 Gateway chat.send 发送给 AI
    openChatWithMessage(result.message);
    setPushResult({ ok: true, msg: '已推送给 AI，请查看对话' });
    setTimeout(() => setPushResult(null), 3000);
  };

  const checkedCount = checkItems.filter(c => c.completed).length;
  const totalChecks = checkItems.length;

  const attachments: string[] = useMemo(() => {
    if (!task.attachments) return [];
    if (Array.isArray(task.attachments)) return task.attachments as string[];
    try { return JSON.parse(task.attachments as string); } catch { return []; }
  }, [task.attachments]);

  const handleToggleDoc = async (docId: string) => {
    const current = [...attachments];
    const idx = current.indexOf(docId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(docId);
    }
    await updateTaskAsync(task.id, { attachments: current as any });
  };

  const handleRemoveDoc = async (docId: string) => {
    const updated = attachments.filter(id => id !== docId);
    await updateTaskAsync(task.id, { attachments: updated as any });
  };

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={onClose} />

      {/* 抽屉 */}
      <div
        className="fixed right-0 top-0 h-full z-50 shadow-float overflow-hidden flex flex-col"
        style={{ width: '520px', maxWidth: '100vw', background: 'var(--surface)' }}
      >
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-5 h-14 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary-500" />
            <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              任务详情
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleChatAboutTask}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
              title="与 AI 讨论"
            >
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--ai)' }} />
            </button>
            {gwConnected && (
              <button
                onClick={handlePushToAI}
                disabled={pushing}
                className={clsx('p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors', pushing && 'opacity-50')}
                title="推送任务给 AI"
              >
                <Send className={clsx('w-4 h-4', pushing ? 'text-slate-400 animate-pulse' : 'text-blue-500')} />
              </button>
            )}
            {pushResult && (
              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', pushResult.ok ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400')}>
                {pushResult.msg}
              </span>
            )}
            <button
              onClick={() => deleteConfirm.requestConfirm(true)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
              <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        </div>

        {/* 标题 */}
        <div className="px-5 pt-4 pb-2">
          <Input
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            className="w-full text-lg font-semibold font-display bg-transparent outline-none"
          />
        </div>

        {/* 属性行 */}
        <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
          {/* 状态 */}
          <Select
            value={task.status}
            onChange={e => handleStatusChange(e.target.value)}
            className="text-xs py-1 w-auto"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </Select>

          {/* 优先级 */}
          <Select
            value={task.priority}
            onChange={e => handlePriorityChange(e.target.value)}
            className="text-xs py-1 w-auto"
          >
            <option value="high">🔴 高</option>
            <option value="medium">🟡 中</option>
            <option value="low">🟢 低</option>
          </Select>

          {/* 负责人 */}
          <Select
            value={(task.assignees as string[])?.[0] || ''}
            onChange={e => handleAssigneeChange(e.target.value)}
            className="text-xs py-1 w-auto"
          >
            <option value="">未指定</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>

          {/* 截止日期 */}
          <Input
            type="date"
            value={task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''}
            onChange={e => handleDeadlineChange(e.target.value)}
            className="text-xs py-1 w-auto"
          />

          {/* 里程碑 */}
          {projectMilestones.length > 0 && (
            <Select
              value={task.milestoneId || ''}
              onChange={e => handleMilestoneChange(e.target.value)}
              className="text-xs py-1 w-auto"
            >
              <option value="">无里程碑</option>
              {projectMilestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </Select>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="px-5 flex items-center gap-4 border-b" style={{ borderColor: 'var(--border)' }}>
          {[
            { key: 'detail' as const, label: '详情', icon: FileText },
            { key: 'comments' as const, label: `评论 (${taskComments.length})`, icon: MessageSquare },
            { key: 'logs' as const, label: `日志 (${taskLogs.length})`, icon: History },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-1.5 pb-2.5 pt-1 text-xs font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent'
              )}
              style={activeTab !== tab.key ? { color: 'var(--text-tertiary)' } : undefined}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'detail' && (
            <div className="space-y-5">
              {/* 描述 */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>描述</label>
                <Textarea
                  value={description}
                  onChange={e => handleDescChange(e.target.value)}
                  placeholder="添加任务描述..."
                  rows={5}
                  className="text-sm resize-none"
                />
              </div>

              {/* SOP 进度面板（SOP 任务时展示） */}
              {task.sopTemplateId && (() => {
                const tpl = sopTemplates.find(t => t.id === task.sopTemplateId);
                if (!tpl || !Array.isArray(tpl.stages) || tpl.stages.length === 0) return null;
                const history = Array.isArray(task.stageHistory) ? task.stageHistory : [];
                return (
                  <SOPProgressBar
                    expanded
                    stages={tpl.stages}
                    stageHistory={history}
                    currentStageId={task.currentStageId}
                    templateName={tpl.name}
                    onStageAction={handleSopAction}
                    onOpenStudio={handleOpenStudio}
                  />
                );
              })()}

              {/* 检查项 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    检查项 {totalChecks > 0 && `(${checkedCount}/${totalChecks})`}
                  </label>
                </div>

                {totalChecks > 0 && (
                  <div className="w-full h-1 rounded-full mb-3" style={{ background: 'var(--surface-hover)' }}>
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${totalChecks > 0 ? (checkedCount / totalChecks) * 100 : 0}%` }}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  {checkItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 group">
                      <button onClick={() => handleToggleCheckItem(index)}>
                        {item.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Square className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        )}
                      </button>
                      <span
                        className={clsx('text-sm flex-1', item.completed && 'line-through')}
                        style={{ color: item.completed ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
                      >
                        {item.text}
                      </span>
                      <button
                        onClick={() => handleRemoveCheckItem(index)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950 transition-opacity"
                      >
                        <X className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={newCheckItem}
                    onChange={e => setNewCheckItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCheckItem()}
                    placeholder="添加检查项..."
                    className="text-xs flex-1"
                  />
                  <button
                    onClick={handleAddCheckItem}
                    disabled={!newCheckItem.trim()}
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              </div>

              {/* 关联文档 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    关联文档 {attachments.length > 0 && `(${attachments.length})`}
                  </label>
                  <button
                    onClick={() => setShowDocPicker(true)}
                    className="flex items-center gap-1 text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    添加
                  </button>
                </div>
                {attachments.length > 0 ? (
                  <div className="space-y-1.5">
                    {attachments.map((docId) => {
                      const doc = documents.find(d => d.id === docId);
                      if (!doc) return null;
                      return (
                        <div
                          key={docId}
                          className="flex items-center gap-2 p-2 rounded-lg group transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                          style={{ background: 'var(--surface-hover)' }}
                        >
                          <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                          <span className="text-sm truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                            {doc.title}
                          </span>
                          <Link2 className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                          <button
                            onClick={() => handleRemoveDoc(docId)}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950 transition-opacity"
                          >
                            <X className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>暂无关联文档，点击"添加"选择</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-3">
              {taskComments.length === 0 && (
                <div className="text-center py-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>暂无评论</div>
              )}
              {taskComments.map(comment => {
                const member = members.find(m => m.id === comment.authorId);
                return (
                  <div key={comment.id} className="flex gap-2.5">
                    <div className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
                      member?.type === 'ai' ? 'member-ai' : 'bg-primary-100 text-primary-600 dark:bg-primary-900'
                    )}>
                      {member?.type === 'ai' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          {member?.name || '未知'}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {formatRelativeTime(comment.createdAt, i18n.language)}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                        {comment.content}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* 新增评论 */}
              <div className="flex items-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <Textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  placeholder="写评论..."
                  rows={2}
                  className="text-sm flex-1 resize-none"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="p-2 rounded-lg transition-colors disabled:opacity-30"
                  style={{ background: 'var(--ai)' }}
                >
                  <MessageSquare className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-2">
              {taskLogs.length === 0 && (
                <div className="text-center py-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>暂无日志</div>
              )}
              {taskLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2.5 text-xs">
                  <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  <div className="flex-1">
                    <span style={{ color: 'var(--text-secondary)' }}>{log.action}</span>
                    {log.message && (
                      <span className="ml-1" style={{ color: 'var(--text-tertiary)' }}>— {log.message}</span>
                    )}
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {formatRelativeTime(log.timestamp, i18n.language)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 删除确认 */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={deleteConfirm.cancel}
          onConfirm={() => deleteConfirm.confirm(async () => {
            await deleteTaskAsync(task.id);
            onDelete?.(task.id);
            onClose();
          })}
          title={t('tasks.deleteTask')}
          message={t('tasks.deleteConfirm')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          isLoading={deleteConfirm.isLoading}
        />

        <DocumentPicker
          open={showDocPicker}
          onClose={() => setShowDocPicker(false)}
          selectedIds={attachments}
          onToggle={handleToggleDoc}
          projectId={task.projectId}
        />
      </div>
    </>
  );
}
