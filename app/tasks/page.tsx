'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';

import { useTaskStore, useProjectStore, useMemberStore, useTaskLogStore, useMilestoneStore, useSOPTemplateStore } from '@/store';
import { useGatewayStore } from '@/store/gateway.store';
import { useChatStore } from '@/store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import type { Task, Milestone } from '@/db/schema';
import TaskDrawer from '@/components/TaskDrawer';
import MilestoneManager from '@/components/MilestoneManager';
import { MilestoneDivider } from '@/components/MilestoneDivider';
import {
  Plus,
  LayoutGrid,
  List,
  MoreVertical,
  Trash2,
  User,
  Bot,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Edit2,
  Home,
  FolderSync,
  Send,
  CheckSquare,
  Square,
  X,
  AlertCircle,
  Settings2,
  Milestone as MilestoneIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { Button, Input, Select, Card, Badge } from '@/components/ui';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/dropdown';
import { SOPProgressBar } from '@/components/sop';

type ViewMode = 'board' | 'list';
type StatusColumn = 'todo' | 'in_progress' | 'reviewing' | 'completed';

export default function TasksPage() {
  const { t } = useTranslation();
  const { tasks, createTask, updateTaskAsync, deleteTaskAsync, error, setError } = useTaskStore();
  const { projects, currentProjectId, setCurrentProject } = useProjectStore();
  const { members } = useMemberStore();
  const { milestones } = useMilestoneStore();
  const { templates: sopTemplates } = useSOPTemplateStore();
  const { connected, connectionMode, serverProxyConnected, agentsMainKey } = useGatewayStore();
  const gwConnected = connectionMode === 'server_proxy' ? serverProxyConnected : connected;
  const { openChatWithMessage } = useChatStore();

  // 动态生成状态列配置
  const STATUS_COLUMNS: { key: StatusColumn; label: string; color: string }[] = useMemo(() => [
    { key: 'todo', label: t('tasks.todo'), color: 'bg-slate-400' },
    { key: 'in_progress', label: t('tasks.inProgress'), color: 'bg-blue-500' },
    { key: 'reviewing', label: t('tasks.reviewing'), color: 'bg-amber-500' },
    { key: 'completed', label: t('tasks.completed'), color: 'bg-emerald-500' },
  ], [t]);

  const PRIORITY_MAP: Record<string, { label: string; class: string }> = useMemo(() => ({
    high: { label: t('tasks.high'), class: 'priority-high' },
    medium: { label: t('tasks.medium'), class: 'priority-medium' },
    low: { label: t('tasks.low'), class: 'priority-low' },
  }), [t]);

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'local' | 'openclaw'>('all');
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', projectId: '', priority: 'medium' as 'high' | 'medium' | 'low', assigneeId: '', milestoneId: '', sopTemplateId: '' });
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragMilestoneId, setDragMilestoneId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ col: StatusColumn; projectId: string | null; milestoneId: string | null } | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const deleteAction = useConfirmAction<string>();
  const menuRef = useRef<HTMLDivElement>(null);

  // 里程碑管理
  const [showMilestoneManager, setShowMilestoneManager] = useState<string | null>(null);

  // 多选状态
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const selectionMode = selectedTaskIds.size > 0;

  // Escape key support for dialogs
  useEscapeKey(showNewTaskDialog, useCallback(() => setShowNewTaskDialog(false), []));

  // 快速创建
  const [showQuickInput, setShowQuickInput] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const [quickTitle, setQuickTitle] = useState('');

  // Derive drawerTask from store to avoid stale data
  const drawerTask = useMemo(() => {
    if (!drawerTaskId) return null;
    return tasks.find(t => t.id === drawerTaskId) || null;
  }, [drawerTaskId, tasks]);

  // Outside-click handler for context menu
  useEffect(() => {
    if (!menuTaskId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuTaskId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuTaskId]);

  // ===================== 拖拽 =====================
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    setDragMilestoneId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleMilestoneDragStart = useCallback((e: React.DragEvent, milestoneId: string) => {
    setDragMilestoneId(milestoneId);
    setDragTaskId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('milestoneId', milestoneId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, col: StatusColumn, projectId: string | null, milestoneId: string | null = null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget({ col, projectId, milestoneId });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, col: StatusColumn, projectId: string | null, milestoneId: string | null = null) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || dragTaskId;
    const mId = e.dataTransfer.getData('milestoneId') || dragMilestoneId;

    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updates: Partial<Task> = {};
        if (task.status !== col) updates.status = col;
        // 跨项目拖拽
        const currentProjId = task.projectId || null;
        if (currentProjId !== projectId) updates.projectId = projectId || undefined;
        // 跨里程碑拖拽
        const currentMsId = task.milestoneId || null;
        if (currentMsId !== milestoneId) updates.milestoneId = milestoneId || undefined;
        if (col === 'completed' && task.progress !== 100) updates.progress = 100;
        if (Object.keys(updates).length > 0) {
          await updateTaskAsync(taskId, updates);
        }
      }
    }
    setDragTaskId(null);
    setDragMilestoneId(null);
    setDragOverTarget(null);
  }, [dragTaskId, dragMilestoneId, tasks, updateTaskAsync]);

  // ===================== 数据 =====================
  const filteredTasks = useMemo(() => {
    let result = tasks;
    // 在泳道全局视图中不按项目过滤（看所有项目）
    // 仅在选中了某个项目且不是"全部"时过滤
    if (currentProjectId) result = result.filter(t => t.projectId === currentProjectId);
    if (filterPriority !== 'all') result = result.filter(t => t.priority === filterPriority);
    // source 过滤
    if (filterSource !== 'all') result = result.filter(t => t.source === filterSource);
    return result;
  }, [tasks, currentProjectId, filterPriority, filterSource]);

  // 统计各 source 数量
  const sourceCounts = useMemo(() => ({
    all: tasks.length,
    local: tasks.filter(t => t.source === 'local').length,
    openclaw: tasks.filter(t => t.source === 'openclaw').length,
  }), [tasks]);

  // 里程碑分组数据
  type MilestoneGroup = {
    milestoneId: string | null;
    milestoneName: string;
    milestoneStatus?: string;
    tasks: Record<StatusColumn, Task[]>;
    count: number;
  };

  // 泳道数据：按项目分组 → 每个项目内按里程碑分组 → 再按状态列分
  const swimlaneData = useMemo(() => {
    const lanes: { projectId: string | null; projectName: string; milestoneGroups: MilestoneGroup[]; count: number }[] = [];

    // 收集所有项目
    const projectMap = new Map<string | null, Task[]>();
    for (const task of filteredTasks) {
      const pid = task.projectId || null;
      if (!projectMap.has(pid)) projectMap.set(pid, []);
      projectMap.get(pid)!.push(task);
    }

    // 按里程碑分组的辅助函数
    const groupByMilestone = (projectTasks: Task[], projectId: string | null): MilestoneGroup[] => {
      const groups: MilestoneGroup[] = [];
      const msMap = new Map<string | null, Task[]>();

      for (const task of projectTasks) {
        const mid = task.milestoneId || null;
        if (!msMap.has(mid)) msMap.set(mid, []);
        msMap.get(mid)!.push(task);
      }

      // 有里程碑的分组（按 sortOrder 排序）
      const projectMilestones = milestones
        .filter(m => m.projectId === projectId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      for (const ms of projectMilestones) {
        const msTasks = msMap.get(ms.id) || [];
        if (msTasks.length === 0 && !currentProjectId) continue; // 泳道视图跳过空里程碑
        const byStatus: Record<StatusColumn, Task[]> = { todo: [], in_progress: [], reviewing: [], completed: [] };
        for (const t of msTasks) {
          if (byStatus[t.status as StatusColumn]) byStatus[t.status as StatusColumn].push(t);
        }
        groups.push({
          milestoneId: ms.id,
          milestoneName: ms.title,
          milestoneStatus: ms.status ?? undefined,
          tasks: byStatus,
          count: msTasks.length,
        });
        msMap.delete(ms.id);
      }

      // 未分配里程碑的任务
      const unassigned = msMap.get(null) || [];
      // 泳道视图中也需要至少一个组作为 drop target，即使没有任务
      if (unassigned.length > 0 || currentProjectId || groups.length === 0) {
        const byStatus: Record<StatusColumn, Task[]> = { todo: [], in_progress: [], reviewing: [], completed: [] };
        for (const t of unassigned) {
          if (byStatus[t.status as StatusColumn]) byStatus[t.status as StatusColumn].push(t);
        }
        groups.push({
          milestoneId: null,
          milestoneName: t('milestones.unassigned'),
          tasks: byStatus,
          count: unassigned.length,
        });
      }

      return groups;
    };

    // 有项目的泳道（按项目顺序）
    for (const project of projects) {
      if (currentProjectId && project.id !== currentProjectId) continue;
      const projectTasks = projectMap.get(project.id) || [];
      const milestoneGroups = groupByMilestone(projectTasks, project.id);
      lanes.push({ projectId: project.id, projectName: project.name, milestoneGroups, count: projectTasks.length });
      projectMap.delete(project.id);
    }

    // 未分类泳道（没有 projectId 的任务）
    const uncategorized = projectMap.get(null) || [];
    if (uncategorized.length > 0 || !currentProjectId) {
      const milestoneGroups = groupByMilestone(uncategorized, null);
      lanes.push({ projectId: null, projectName: t('tasks.uncategorized'), milestoneGroups, count: uncategorized.length });
    }

    return lanes;
  }, [filteredTasks, projects, milestones, currentProjectId, t]);

  // 简单四列看板数据（当选中了具体项目时使用）
  const tasksByStatus = useMemo(() => {
    const map: Record<StatusColumn, Task[]> = { todo: [], in_progress: [], reviewing: [], completed: [] };
    for (const t of filteredTasks) {
      if (map[t.status as StatusColumn]) map[t.status as StatusColumn].push(t);
    }
    return map;
  }, [filteredTasks]);

  // ===================== 快速创建 =====================
  const handleQuickCreate = useCallback(async (title: string) => {
    if (!title.trim()) return;
    await createTask({
      title: title.trim(),
      projectId: currentProjectId || undefined, // 关联当前项目（如果在项目视图下）
      status: 'todo',
      priority: 'medium',
      assignees: [],
      creatorId: 'system',
    });
    setQuickTitle('');
  }, [createTask, currentProjectId]);

  // ===================== 详细新建 =====================
  const handleCreateTask = useCallback(async () => {
    if (!newTask.title.trim()) return;
    // 明确处理项目关联逻辑：
    // - 用户明确选择"未分类"（空字符串）→ 不关联项目
    // - 用户选择了项目 → 关联所选项目
    // - 用户没选择，但在项目视图 → 关联当前项目
    // - 用户没选择，不在项目视图 → 不关联项目
    let projectId: string | undefined;
    if (newTask.projectId !== undefined) {
      // 用户已做出选择（可能是空字符串表示未分类）
      projectId = newTask.projectId || undefined;
    } else {
      // 用户未选择，使用当前项目
      projectId = currentProjectId || undefined;
    }
    
    // 如果选择了 SOP 模板，获取第一阶段作为当前阶段
    const selectedSopTemplate = newTask.sopTemplateId 
      ? sopTemplates.find(t => t.id === newTask.sopTemplateId)
      : null;
    const firstStageId = selectedSopTemplate?.stages?.[0]?.id;
    
    await createTask({
      title: newTask.title.trim(),
      projectId,
      priority: newTask.priority || 'medium',
      assignees: newTask.assigneeId ? [newTask.assigneeId] : [],
      milestoneId: newTask.milestoneId || undefined,
      status: 'todo',
      creatorId: 'system',
      // v3.0 SOP 字段
      sopTemplateId: newTask.sopTemplateId || undefined,
      currentStageId: firstStageId,
    });
    setNewTask({ title: '', projectId: '', priority: 'medium' as 'high' | 'medium' | 'low', assigneeId: '', milestoneId: '', sopTemplateId: '' });
    setShowNewTaskDialog(false);
  }, [newTask, currentProjectId, createTask, sopTemplates]);

  const { createLog } = useTaskLogStore();
  const { updateMilestoneAsync } = useMilestoneStore();

  const handleMilestoneDrop = useCallback(async (e: React.DragEvent, projectId: string | null, targetMilestoneId: string | null) => {
    e.preventDefault();
    const draggedMilestoneId = e.dataTransfer.getData('milestoneId');
    if (!draggedMilestoneId || draggedMilestoneId === targetMilestoneId) return;

    // 重新排序逻辑
    const projectMs = milestones
      .filter(m => m.projectId === projectId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    
    const dragIndex = projectMs.findIndex(m => m.id === draggedMilestoneId);
    if (dragIndex === -1) return;

    const targetIndex = targetMilestoneId 
      ? projectMs.findIndex(m => m.id === targetMilestoneId)
      : projectMs.length;

    const newMs = [...projectMs];
    const [removed] = newMs.splice(dragIndex, 1);
    newMs.splice(targetIndex, 0, removed);

    // 更新所有受影响的里程碑排序
    await Promise.all(newMs.map((m, idx) => {
      if (m.sortOrder !== idx) {
        return updateMilestoneAsync(m.id, { sortOrder: idx });
      }
      return Promise.resolve();
    }));
    
    setDragMilestoneId(null);
  }, [milestones, updateMilestoneAsync]);

  const handleStatusChange = async (taskId: string, newStatus: StatusColumn) => {
    const task = tasks.find(t => t.id === taskId);
    const oldLabel = STATUS_COLUMNS.find(s => s.key === task?.status)?.label || task?.status || '';
    const newLabel = STATUS_COLUMNS.find(s => s.key === newStatus)?.label || newStatus;
    await updateTaskAsync(taskId, { status: newStatus });
    createLog({ taskId, action: '状态变更', message: `${oldLabel} → ${newLabel}` });
  };

  const getMemberName = (assignees?: string[] | null) => {
    if (!assignees || assignees.length === 0) return null;
    return members.find(m => m.id === assignees[0]);
  };

  const toggleLane = (laneId: string) => {
    setCollapsedLanes(prev => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  };

  const isSwimLaneView = !currentProjectId;

  // ===================== 多选操作 =====================
  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
  }, [filteredTasks]);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  // 批量推送给 AI（使用专用批量模板，避免重复系统指令）
  const handleBatchPush = useCallback(async () => {
    if (!gwConnected || !agentsMainKey || selectedTaskIds.size === 0) return;

    setPushing(true);
    const taskIds = Array.from(selectedTaskIds);

    try {
      const res = await fetch('/api/task-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, sessionKey: agentsMainKey }),
      });
      const json = await res.json();

      setPushing(false);
      clearSelection();

      if (res.ok && json.success) {
        openChatWithMessage(json.data.message);
      } else {
        setPushError(json.error || '批量推送失败');
        setTimeout(() => setPushError(null), 5000);
      }
    } catch (e) {
      setPushing(false);
      clearSelection();
      setPushError(e instanceof Error ? e.message : '批量推送失败');
      setTimeout(() => setPushError(null), 5000);
    }
  }, [gwConnected, agentsMainKey, selectedTaskIds, openChatWithMessage, clearSelection]);

  // 批量状态变更
  const handleBatchStatusChange = useCallback(async (newStatus: StatusColumn) => {
    if (selectedTaskIds.size === 0) return;
    const taskIds = Array.from(selectedTaskIds);
    const newLabel = STATUS_COLUMNS.find(s => s.key === newStatus)?.label || newStatus;
    await Promise.all(taskIds.map(async (id) => {
      const task = tasks.find(t => t.id === id);
      const oldLabel = STATUS_COLUMNS.find(s => s.key === task?.status)?.label || task?.status || '';
      await updateTaskAsync(id, { status: newStatus });
      createLog({ taskId: id, action: '状态变更', message: `${oldLabel} → ${newLabel}（批量）` });
    }));
    clearSelection();
  }, [selectedTaskIds, tasks, updateTaskAsync, createLog, clearSelection, STATUS_COLUMNS]);

  // 批量删除
  const batchDeleteConfirm = useConfirmAction<boolean>();
  const handleBatchDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;
    const taskIds = Array.from(selectedTaskIds);
    await Promise.all(taskIds.map(id => deleteTaskAsync(id)));
    clearSelection();
  }, [selectedTaskIds, deleteTaskAsync, clearSelection]);

  // 批量状态下拉显隐
  const [showBatchStatusMenu, setShowBatchStatusMenu] = useState(false);

  // ===================== 渲染：任务卡片 =====================
  const renderTaskCard = (task: Task) => {
    const assignee = getMemberName(task.assignees);
    const priorityInfo = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
    const isSelected = selectedTaskIds.has(task.id);
    return (
      <div
        key={task.id}
        className={clsx('card p-3 group relative cursor-pointer', dragTaskId === task.id && 'opacity-40', isSelected && 'ring-2 ring-primary-500')}
        onClick={() => selectionMode ? toggleTaskSelection(task.id) : setDrawerTaskId(task.id)}
        draggable={!selectionMode}
        onDragStart={(e) => !selectionMode && handleDragStart(e, task.id)}
        onDragEnd={() => { setDragTaskId(null); setDragOverTarget(null); }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1">
            {/* 选择框 */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleTaskSelection(task.id); }}
              className="mt-0.5 flex-shrink-0"
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-primary-500" />
              ) : (
                <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-tertiary)' }} />
              )}
            </button>
            <h4 className="text-sm font-medium flex-1 pr-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="truncate">{task.title}</span>
              {task.source === 'openclaw' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex-shrink-0">
                  {t('tasks.synced')}
                </span>
              )}
            </h4>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (menuTaskId === task.id) {
                setMenuTaskId(null);
                setMenuPosition(null);
              } else {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuTaskId(task.id);
                setMenuPosition({ top: rect.bottom + 4, left: rect.right - 128 });
              }
            }}
            className="p-0.5 opacity-0 group-hover:opacity-100 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity"
          >
            <MoreVertical className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2 ml-6">
          <span className={clsx('tag text-[10px]', priorityInfo.class)}>{priorityInfo.label}</span>
          {assignee && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {assignee.type === 'ai' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {assignee.name}
            </span>
          )}
        </div>

        {/* SOP 进度（SOP 任务优先展示阶段进度） */}
        {task.sopTemplateId && (() => {
          const tpl = sopTemplates.find(t => t.id === task.sopTemplateId);
          if (!tpl || !Array.isArray(tpl.stages) || tpl.stages.length === 0) return null;
          const history = Array.isArray(task.stageHistory) ? task.stageHistory : [];
          return (
            <SOPProgressBar
              compact
              stages={tpl.stages}
              stageHistory={history}
              currentStageId={task.currentStageId}
              templateName={tpl.name}
            />
          );
        })()}

        {/* 子任务进度（非 SOP 任务显示） */}
        {!task.sopTemplateId && Array.isArray(task.checkItems) && task.checkItems.length > 0 && (() => {
          const total = task.checkItems.length;
          const done = task.checkItems.filter((ci: { completed: boolean }) => ci.completed).length;
          return (
            <div className="mt-2 ml-6 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--surface-hover)' }}>
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                {done}/{total}
              </span>
            </div>
          );
        })()}

        {/* 快捷菜单已移至页面级 fixed 渲染 */}
      </div>
    );
  };

  // ===================== 渲染：状态列 =====================
  const renderStatusColumn = (col: typeof STATUS_COLUMNS[number], columnTasks: Task[], projectId: string | null, milestoneId: string | null = null) => {
    const isOver = dragOverTarget?.col === col.key && dragOverTarget?.projectId === projectId && dragOverTarget?.milestoneId === milestoneId;
    return (
      <div
        key={col.key}
        className={clsx('flex flex-col min-h-0 min-w-0', isOver && 'ring-2 ring-primary-400 rounded-lg')}
        onDragOver={(e) => handleDragOver(e, col.key, projectId, milestoneId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, col.key, projectId, milestoneId)}
      >
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className={clsx('w-2 h-2 rounded-full', col.color)} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {col.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {columnTasks.length}
          </span>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {columnTasks.map(renderTaskCard)}
          {columnTasks.length === 0 && (
            <div className="text-center py-6 text-[11px] rounded-lg border border-dashed" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)' }}>
              {t('tasks.dragHere')}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 创建任务后检查错误
  useEffect(() => {
    if (error) {
      console.error('[Tasks] 创建任务错误:', error);
      // 3秒后自动清除错误
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  return (
    <AppShell>
      <Header
        title={t('tasks.title')}
        showProjectSelector
        actions={
          <div className="flex items-center gap-2">
            {/* 错误提示 */}
            {error && (
              <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-lg">
                {error}
              </div>
            )}
            {/* source 过滤 */}
            <div className="flex items-center rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              {([
                { key: 'all' as const, label: t('common.all'), icon: null },
                { key: 'local' as const, label: t('tasks.localTasks'), icon: Home },
                { key: 'openclaw' as const, label: t('tasks.syncedTasks'), icon: FolderSync },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterSource(tab.key)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors',
                    tab.key === 'all' && 'rounded-l-lg',
                    tab.key === 'openclaw' && 'rounded-r-lg',
                    filterSource === tab.key
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400'
                      : ''
                  )}
                  style={filterSource !== tab.key ? { color: 'var(--text-tertiary)' } : undefined}
                >
                  {tab.icon && <tab.icon className="w-3 h-3" />}
                  {tab.label}
                  <span className="text-[10px] opacity-60">{sourceCounts[tab.key]}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setViewMode('board')}
                className={clsx('p-1.5 rounded-l-lg transition-colors', viewMode === 'board' ? 'bg-primary-50 text-primary-600 dark:bg-primary-950' : '')}
                style={{ color: viewMode === 'board' ? undefined : 'var(--text-tertiary)' }}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx('p-1.5 rounded-r-lg transition-colors', viewMode === 'list' ? 'bg-primary-50 text-primary-600 dark:bg-primary-950' : '')}
                style={{ color: viewMode === 'list' ? undefined : 'var(--text-tertiary)' }}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* 优先级过滤 */}
            <Select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="py-1.5 text-xs w-24"
            >
              <option value="all">{t('common.all')}</option>
              <option value="high">{t('tasks.high')}</option>
              <option value="medium">{t('tasks.medium')}</option>
              <option value="low">{t('tasks.low')}</option>
            </Select>

            <Button onClick={() => { setShowQuickInput(true); setTimeout(() => quickInputRef.current?.focus(), 50); }}>
              <Plus className="w-4 h-4" /> {t('tasks.newTask')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-6 overflow-auto">
        {/* 批量操作栏 */}
        {selectionMode && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800">
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              已选择 {selectedTaskIds.size} 个任务
            </span>
            <div className="flex items-center gap-2 ml-auto">
              {/* 批量状态变更 */}
              <div className="relative">
                <Button size="sm" variant="secondary" onClick={() => setShowBatchStatusMenu(!showBatchStatusMenu)}>
                  <CheckSquare className="w-3.5 h-3.5" />
                  批量改状态
                  <ChevronDown className="w-3 h-3" />
                </Button>
                {showBatchStatusMenu && (
                  <div className="absolute top-full left-0 mt-1 w-32 rounded-lg shadow-float border z-30 py-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    {STATUS_COLUMNS.map(s => (
                      <button
                        key={s.key}
                        onClick={() => { handleBatchStatusChange(s.key); setShowBatchStatusMenu(false); }}
                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className={clsx('w-1.5 h-1.5 rounded-full', s.color)} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* 批量删除 */}
              <Button size="sm" variant="danger" onClick={() => batchDeleteConfirm.requestConfirm(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                批量删除
              </Button>
              {gwConnected && agentsMainKey && (
                <Button
                  size="sm"
                  onClick={handleBatchPush}
                  disabled={pushing}
                >
                  <Send className="w-3.5 h-3.5" />
                  {pushing ? '推送中...' : '批量推送'}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={selectAllVisible}>
                全选
              </Button>
              <Button size="sm" variant="secondary" onClick={clearSelection}>
                <X className="w-3.5 h-3.5" />
                取消
              </Button>
            </div>
          </div>
        )}

        {/* 推送错误提示 */}
        {pushError && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{pushError}</span>
            <button onClick={() => setPushError(null)} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 快速创建输入框 */}
        {showQuickInput && (
          <div className="mb-4 flex items-center gap-2">
            <Input
              ref={quickInputRef}
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && quickTitle.trim()) {
                  handleQuickCreate(quickTitle);
                }
                if (e.key === 'Escape') {
                  setShowQuickInput(false);
                  setQuickTitle('');
                }
              }}
              onBlur={() => {
                // 延迟关闭，让旁边按钮的 click 事件有机会先触发
                setTimeout(() => {
                  if (!quickTitle.trim()) {
                    setShowQuickInput(false);
                    setQuickTitle('');
                  }
                }, 150);
              }}
              className="flex-1"
              placeholder={t('tasks.quickCreatePlaceholder')}
              autoFocus
            />
            <Button
              variant="secondary"
              onClick={() => {
                // 打开对话框时设置默认项目（当前项目视图）
                setNewTask(prev => ({ ...prev, projectId: currentProjectId || '' }));
                setShowNewTaskDialog(true);
              }}
              title={t('tasks.openDetailForm')}
            >
              <Edit2 className="w-3.5 h-3.5" /> {t('tasks.detail')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setShowQuickInput(false); setQuickTitle(''); }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        )}

        {viewMode === 'board' ? (
          isSwimLaneView ? (
            /* ===================== 泳道视图（全部任务，按项目分组）===================== */
            <div className="space-y-6">
              {swimlaneData.map(lane => {
                const laneId = lane.projectId || '__uncategorized__';
                const isCollapsed = collapsedLanes.has(laneId);
                // 计算整个项目的状态小计
                const laneStatusCounts: Record<StatusColumn, number> = { todo: 0, in_progress: 0, reviewing: 0, completed: 0 };
                for (const group of lane.milestoneGroups) {
                  for (const col of STATUS_COLUMNS) {
                    laneStatusCounts[col.key] += group.tasks[col.key].length;
                  }
                }
                return (
                  <div key={laneId} className="card overflow-hidden">
                    {/* 泳道标题行 */}
                    <div
                      className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      style={{ borderBottom: isCollapsed ? 'none' : '1px solid var(--border)' }}
                    >
                      <button onClick={() => toggleLane(laneId)} className="flex items-center gap-2.5 flex-1 min-w-0">
                        {isCollapsed
                          ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                          : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        }
                        <FolderKanban className="w-4 h-4" style={{ color: lane.projectId ? 'var(--primary-500)' : 'var(--text-tertiary)' }} />
                        <span className="text-sm font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
                          {lane.projectName}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {lane.count} {t('tasks.taskCount')}
                        </span>
                      </button>
                      {/* 里程碑管理按钮 */}
                      {lane.projectId && (
                        <button
                          onClick={() => setShowMilestoneManager(lane.projectId)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          title={t('milestones.title')}
                        >
                          <MilestoneIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                      )}
                      {/* 状态小计 */}
                      <div className="flex items-center gap-1.5">
                        {STATUS_COLUMNS.map(col => {
                          const count = laneStatusCounts[col.key];
                          if (count === 0) return null;
                          return (
                            <span key={col.key} className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                              <span className={clsx('w-1.5 h-1.5 rounded-full', col.color)} />
                              {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* 泳道内容：按里程碑分组显示 */}
                    {!isCollapsed && (
                      <div className="p-4 space-y-4">
                        {lane.milestoneGroups.map(group => {
                          const msLaneId = `${laneId}__ms__${group.milestoneId || '__none__'}`;
                          const msCollapsed = collapsedLanes.has(msLaneId);
                          const hasMilestones = lane.milestoneGroups.length > 1 || lane.milestoneGroups[0]?.milestoneId !== null;

                          return (
                            <div 
                              key={msLaneId}
                              onDragOver={(e) => {
                                if (dragMilestoneId) {
                                  e.preventDefault();
                                }
                              }}
                              onDrop={(e) => {
                                if (dragMilestoneId) {
                                  handleMilestoneDrop(e, lane.projectId, group.milestoneId);
                                }
                              }}
                            >
                              {/* 里程碑子标题（仅当项目有里程碑时显示） */}
                              {hasMilestones && (
                                <MilestoneDivider
                                  milestoneId={group.milestoneId}
                                  title={group.milestoneName}
                                  status={group.milestoneStatus}
                                  count={group.count}
                                  onAddMilestone={() => setShowMilestoneManager(lane.projectId)}
                                  onDragStart={(e) => group.milestoneId && handleMilestoneDragStart(e, group.milestoneId)}
                                  isDragging={dragMilestoneId === group.milestoneId}
                                />
                              )}
                              {/* 里程碑内容：4列状态看板 */}
                              {!msCollapsed && (
                                <div className="grid grid-cols-4 gap-4">
                                  {STATUS_COLUMNS.map(col => renderStatusColumn(col, group.tasks[col.key], lane.projectId, group.milestoneId))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {swimlaneData.length === 0 && (
                <div className="text-center py-16 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('tasks.noTasksHint')}
                </div>
              )}
            </div>
          ) : (
            /* ===================== 项目看板视图（选中了具体项目）===================== */
            (() => {
              // 当选中项目时，使用 swimlaneData 中对应项目的里程碑分组
              const currentLane = swimlaneData.find(l => l.projectId === currentProjectId);
              const groups = currentLane?.milestoneGroups || [];
              const hasMilestones = groups.length > 1 || groups[0]?.milestoneId !== null;

              if (!hasMilestones) {
                // 没有里程碑，直接展示 4 列看板 + 里程碑入口
                return (
                  <div className="space-y-4 h-full">
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setShowMilestoneManager(currentProjectId)}>
                        <MilestoneIcon className="w-3.5 h-3.5" /> {t('milestones.title')}
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-4 h-full">
                      {STATUS_COLUMNS.map(col => renderStatusColumn(col, tasksByStatus[col.key], currentProjectId))}
                    </div>
                  </div>
                );
              }

              // 有里程碑，按里程碑分组展示
              return (
                <div className="space-y-5">
                  {groups.map(group => {
                    const msLaneId = `__project__ms__${group.milestoneId || '__none__'}`;
                    const msCollapsed = collapsedLanes.has(msLaneId);
                    return (
                      <div 
                        key={msLaneId}
                        onDragOver={(e) => {
                          if (dragMilestoneId) {
                            e.preventDefault();
                          }
                        }}
                        onDrop={(e) => {
                          if (dragMilestoneId) {
                            handleMilestoneDrop(e, currentProjectId, group.milestoneId);
                          }
                        }}
                      >
                        <MilestoneDivider
                          milestoneId={group.milestoneId}
                          title={group.milestoneName}
                          status={group.milestoneStatus}
                          count={group.count}
                          onAddMilestone={() => setShowMilestoneManager(currentProjectId)}
                          onDragStart={(e) => group.milestoneId && handleMilestoneDragStart(e, group.milestoneId)}
                          isDragging={dragMilestoneId === group.milestoneId}
                        />
                        {!msCollapsed && (
                          <div className="grid grid-cols-4 gap-4 p-4">
                            {STATUS_COLUMNS.map(col => renderStatusColumn(col, group.tasks[col.key], currentProjectId, group.milestoneId))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )
        ) : (
          /* ===================== 列表视图 ===================== */
          <Card className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.title')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold w-24" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.status')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold w-20" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.priority')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold w-28" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.assignee')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold w-24" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.project')}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const assignee = getMemberName(task.assignees);
                  const project = projects.find(p => p.id === task.projectId);
                  const priorityInfo = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                  const statusCol = STATUS_COLUMNS.find(s => s.key === task.status);
                  return (
                    <tr key={task.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" style={{ borderColor: 'var(--border)' }} onClick={() => setDrawerTaskId(task.id)}>
                      <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>{task.title}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={clsx('text-[10px]', `status-${task.status}`)}>
                          {statusCol?.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={clsx('text-[10px]', priorityInfo.class)}>{priorityInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {assignee?.name || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {project?.name || t('tasks.uncategorized')}
                      </td>
                      <td className="px-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAction.requestConfirm(task.id); }}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('tasks.noTasks')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </main>

      {/* 详细新建任务对话框 */}
      {showNewTaskDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
          <Card className="p-6 w-96">
            <h3 id="create-task-title" className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('tasks.newTask')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.title')}</label>
                <Input
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                  placeholder={t('tasks.titlePlaceholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.project')}</label>
                <Select
                  value={newTask.projectId || currentProjectId || ''}
                  onChange={e => setNewTask({ ...newTask, projectId: e.target.value, milestoneId: '' })}
                >
                  <option value="">{t('tasks.uncategorized')}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              {/* 里程碑选择（当选中项目时显示） */}
              {(() => {
                const selectedProjectId = newTask.projectId || currentProjectId || '';
                if (!selectedProjectId) return null;
                const projectMs = milestones.filter(m => m.projectId === selectedProjectId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                return (
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('milestones.milestone')}</label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={newTask.milestoneId}
                        onChange={e => setNewTask({ ...newTask, milestoneId: e.target.value })}
                        className="flex-1"
                      >
                        <option value="">{t('milestones.unassigned')}</option>
                        {projectMs.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </Select>
                      <button
                        type="button"
                        onClick={() => setShowMilestoneManager(selectedProjectId)}
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                        title={t('milestones.createMilestone')}
                      >
                        <Plus className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                    </div>
                  </div>
                );
              })()}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.priority')}</label>
                  <Select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value as 'high' | 'medium' | 'low' })}
                  >
                    <option value="high">{t('tasks.high')}</option>
                    <option value="medium">{t('tasks.medium')}</option>
                    <option value="low">{t('tasks.low')}</option>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.assignee')}</label>
                  <Select
                    value={newTask.assigneeId}
                    onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })}
                  >
                    <option value="">{t('tasks.unassigned')}</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                </div>
              </div>
              {/* SOP 模板选择 */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{t('sop.title')}</label>
                <Select
                  value={newTask.sopTemplateId}
                  onChange={e => setNewTask({ ...newTask, sopTemplateId: e.target.value })}
                >
                  <option value="">{t('tasks.unassigned')}</option>
                  {sopTemplates.filter(tpl => tpl.status === 'active').map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowNewTaskDialog(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleCreateTask}>{t('common.create')}</Button>
            </div>
          </Card>
        </div>
      )}

      {/* 任务详情抽屉 */}
      {drawerTask && (
        <TaskDrawer
          task={drawerTask}
          onClose={() => setDrawerTaskId(null)}
          onDelete={() => setDrawerTaskId(null)}
        />
      )}

      {/* 里程碑管理 */}
      {showMilestoneManager && (
        <MilestoneManager
          projectId={showMilestoneManager}
          onClose={() => setShowMilestoneManager(null)}
        />
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={deleteAction.isOpen}
        onClose={deleteAction.cancel}
        onConfirm={() => deleteAction.confirm(async (id) => { await deleteTaskAsync(id); })}
        title={t('common.confirm')}
        message={t('tasks.deleteConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteAction.isLoading}
      />

      {/* 批量删除确认对话框 */}
      <ConfirmDialog
        isOpen={batchDeleteConfirm.isOpen}
        onClose={batchDeleteConfirm.cancel}
        onConfirm={() => batchDeleteConfirm.confirm(handleBatchDelete)}
        title={t('common.confirm')}
        message={`确定删除选中的 ${selectedTaskIds.size} 个任务？此操作不可撤销。`}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={batchDeleteConfirm.isLoading}
      />

      {/* 任务快捷菜单（fixed 定位，不受父容器 overflow 裁剪） */}
      {menuTaskId && menuPosition && (() => {
        const task = tasks.find(t => t.id === menuTaskId);
        if (!task) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setMenuTaskId(null); setMenuPosition(null); }} />
            <div
              ref={menuRef}
              className="fixed w-32 rounded-lg shadow-float border z-50 py-1"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                top: menuPosition.top,
                left: menuPosition.left,
              }}
            >
              {STATUS_COLUMNS.filter(s => s.key !== task.status).map(s => (
                <button
                  key={s.key}
                  onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, s.key); setMenuTaskId(null); setMenuPosition(null); }}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className={clsx('w-1.5 h-1.5 rounded-full', s.color)} />
                  {s.label}
                </button>
              ))}
              <div className="h-px my-1" style={{ background: 'var(--border)' }} />
              <button
                onClick={async (e) => { e.stopPropagation(); await deleteTaskAsync(task.id); setMenuTaskId(null); setMenuPosition(null); }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" /> {t('common.delete')}
              </button>
            </div>
          </>
        );
      })()}
    </AppShell>
  );
}
