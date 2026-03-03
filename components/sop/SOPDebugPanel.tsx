'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskStore, useSOPTemplateStore } from '@/store';
import { Card } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import type { SOPStage, StageRecord, Task, SOPTemplate } from '@/db/schema';
import clsx from 'clsx';
import {
  RefreshCw, ChevronDown, ChevronRight, ClipboardList,
  CheckCircle, XCircle, Clock, AlertCircle, Pause,
  SkipForward, Play,
} from 'lucide-react';

// 阶段状态图标
const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  pending: Clock,
  active: Play,
  waiting_input: Pause,
  waiting_confirm: AlertCircle,
  completed: CheckCircle,
  skipped: SkipForward,
  failed: XCircle,
};

// 阶段状态颜色
const STATUS_COLORS: Record<string, string> = {
  pending: 'text-slate-400',
  active: 'text-blue-500',
  waiting_input: 'text-amber-500',
  waiting_confirm: 'text-purple-500',
  completed: 'text-emerald-500',
  skipped: 'text-slate-400',
  failed: 'text-red-500',
};

/**
 * SOP 执行调试面板
 * 用于查看所有 SOP 任务的执行状态、阶段历史、sopInputs 等信息
 */
export default function SOPDebugPanel() {
  const { t } = useTranslation();
  const { tasks, fetchTasks } = useTaskStore();
  const { templates, fetchTemplates } = useSOPTemplateStore();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 获取所有 SOP 任务
  const sopTasks = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter(task => task.sopTemplateId);
  }, [tasks]);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchTasks(), fetchTemplates()]);
    } finally {
      setLoading(false);
    }
  }, [fetchTasks, fetchTemplates]);

  // 初始加载
  useEffect(() => {
    if (templates.length === 0) fetchTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 根据 ID 获取模板
  const getTemplate = useCallback((templateId: string): SOPTemplate | undefined => {
    return templates.find(t => t.id === templateId);
  }, [templates]);

  // 计算 SOP 统计
  const stats = useMemo(() => {
    const total = sopTasks.length;
    const running = sopTasks.filter(t => {
      const history = Array.isArray(t.stageHistory) ? t.stageHistory as StageRecord[] : [];
      return history.some(r => r.status === 'active' || r.status === 'waiting_input' || r.status === 'waiting_confirm');
    }).length;
    const completed = sopTasks.filter(t => t.status === 'completed' || t.status === 'reviewing').length;
    const notStarted = sopTasks.filter(t => {
      const history = Array.isArray(t.stageHistory) ? t.stageHistory as StageRecord[] : [];
      return history.length === 0;
    }).length;
    return { total, running, completed, notStarted };
  }, [sopTasks]);

  return (
    <div className="space-y-3">
      {/* 统计概览 */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="SOP 任务" value={stats.total} color="blue" />
        <StatCard label="执行中" value={stats.running} color="amber" />
        <StatCard label="已完成" value={stats.completed} color="emerald" />
        <StatCard label="未开始" value={stats.notStarted} color="slate" />
      </div>

      {/* 模板统计 */}
      <div className="p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
          SOP 模板 ({templates.length})
        </div>
        <div className="flex flex-wrap gap-1">
          {templates.map(tpl => {
            const count = sopTasks.filter(t => t.sopTemplateId === tpl.id).length;
            return (
              <Badge key={tpl.id} variant="default" className="text-[10px]">
                {tpl.name} ({count})
              </Badge>
            );
          })}
          {templates.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('sop.noTemplates')}
            </span>
          )}
        </div>
      </div>

      {/* 刷新按钮 */}
      <button
        onClick={handleRefresh}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
      >
        <RefreshCw className={clsx('w-3 h-3', loading && 'animate-spin')} />
        {t('sop.debugRefresh')}
      </button>

      {/* SOP 任务列表 */}
      {sopTasks.length === 0 ? (
        <div className="p-4 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {t('sop.debugNoSopTasks')}
        </div>
      ) : (
        <div className="space-y-2">
          {sopTasks.map(task => {
            const template = getTemplate(task.sopTemplateId!);
            const stages = (template?.stages || []) as SOPStage[];
            const history = (Array.isArray(task.stageHistory) ? task.stageHistory : []) as StageRecord[];
            const isExpanded = expandedTaskId === task.id;
            const currentStage = stages.find(s => s.id === task.currentStageId);
            const currentRecord = history.find(r => r.stageId === task.currentStageId);

            return (
              <Card key={task.id} className="overflow-hidden">
                {/* 任务头 */}
                <button
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className="w-full p-3 flex items-center gap-2 text-left hover:opacity-80"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {task.title}
                      </span>
                      <Badge variant="default" className="text-[9px] flex-shrink-0">
                        {task.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        {task.id}
                      </span>
                      {template && (
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          | {template.name}
                        </span>
                      )}
                      {currentStage && currentRecord && (
                        <span className={clsx('text-[10px]', STATUS_COLORS[currentRecord.status])}>
                          | {currentStage.label} ({currentRecord.status})
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 进度指示 */}
                  <div className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    {history.filter(r => r.status === 'completed' || r.status === 'skipped').length}/{stages.length}
                  </div>
                </button>

                {/* 展开详情 */}
                {isExpanded && (
                  <div className="border-t p-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
                    {/* 基本信息 */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>taskId:</span>{' '}
                        <span className="font-mono text-blue-500">{task.id}</span>
                      </div>
                      <div>
                        <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>templateId:</span>{' '}
                        <span className="font-mono text-blue-500">{task.sopTemplateId}</span>
                      </div>
                      <div>
                        <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>currentStageId:</span>{' '}
                        <span className="font-mono text-purple-500">{task.currentStageId || 'null'}</span>
                      </div>
                      <div>
                        <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>progress:</span>{' '}
                        <span className="font-mono text-emerald-500">{task.progress || 0}%</span>
                      </div>
                    </div>

                    {/* 阶段历史（时间线） */}
                    <div>
                      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                        {t('sop.debugStageHistory')} ({history.length}/{stages.length})
                      </div>
                      <div className="space-y-1">
                        {stages.map((stage, idx) => {
                          const record = history.find(r => r.stageId === stage.id);
                          const status = record?.status || 'pending';
                          const StatusIcon = STATUS_ICONS[status] || Clock;
                          const isCurrent = stage.id === task.currentStageId;

                          return (
                            <div
                              key={stage.id}
                              className={clsx(
                                'flex items-start gap-2 p-1.5 rounded text-xs',
                                isCurrent && 'bg-blue-50 dark:bg-blue-950/50'
                              )}
                            >
                              <StatusIcon className={clsx('w-3.5 h-3.5 flex-shrink-0 mt-0.5', STATUS_COLORS[status])} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                    [{idx + 1}]
                                  </span>
                                  <span className="font-medium" style={{ color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                    {stage.label}
                                  </span>
                                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
                                    {stage.type}
                                  </span>
                                  <span className={clsx('text-[9px] font-medium', STATUS_COLORS[status])}>
                                    {status}
                                  </span>
                                </div>
                                {/* 时间信息 */}
                                {record && (
                                  <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                    {record.startedAt && <span>start: {formatTime(record.startedAt)}</span>}
                                    {record.completedAt && <span> | end: {formatTime(record.completedAt)}</span>}
                                    {record.confirmedBy && <span> | by: {record.confirmedBy}</span>}
                                    {record.retryCount ? <span className="text-red-400"> | retry: {record.retryCount}</span> : null}
                                    {record.renderDocumentId && <span className="text-violet-500"> | doc: {record.renderDocumentId}</span>}
                                  </div>
                                )}
                                {/* 产出预览 */}
                                {record?.output && (
                                  <pre className="mt-1 text-[10px] p-1.5 rounded max-h-20 overflow-auto whitespace-pre-wrap"
                                    style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                                  >
                                    {record.output.length > 300 ? record.output.slice(0, 300) + '...' : record.output}
                                  </pre>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* sopInputs */}
                    {task.sopInputs && Object.keys(task.sopInputs as Record<string, unknown>).length > 0 && (
                      <div>
                        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                          {t('sop.debugSopInputs')}
                        </div>
                        <pre className="text-[10px] p-2 rounded font-mono max-h-32 overflow-auto whitespace-pre-wrap"
                          style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                        >
                          {JSON.stringify(task.sopInputs, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Raw stageHistory JSON */}
                    <details className="text-xs">
                      <summary className="cursor-pointer font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        Raw stageHistory JSON
                      </summary>
                      <pre className="mt-1 text-[10px] p-2 rounded font-mono max-h-40 overflow-auto whitespace-pre-wrap"
                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                      >
                        {JSON.stringify(history, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 统计卡片
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-500',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    slate: 'text-slate-500',
  };
  return (
    <div className="p-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
      <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className={clsx('text-lg font-bold mt-0.5', colorClasses[color] || 'text-slate-500')}>{value}</div>
    </div>
  );
}

// 格式化时间
function formatTime(isoStr: string): string {
  try {
    return isoStr.substring(11, 19);
  } catch {
    return isoStr;
  }
}
