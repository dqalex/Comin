'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useConfirmAction } from '@/hooks/useConfirmAction';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useGatewayStore } from '@/store/gateway.store';
import { useDocumentStore } from '@/store';
import AppShell from '@/components/AppShell';
import Header from '@/components/Header';
import GatewayRequired from '@/components/GatewayRequired';
import { Button, Input, Select, Textarea, Badge } from '@/components/ui';
import type { CronJob, CronRunLogEntry, CronSchedule, CronPayload, CronDelivery } from '@/types';
import {
  Plus, Clock, Trash2, Play, Power, ChevronDown,
  ChevronRight, Timer, AlertCircle,
  History, CheckCircle, XCircle, Loader2, RefreshCw,
  ToggleLeft, ToggleRight, Bot, Zap, Pencil, FileText,
} from 'lucide-react';
import clsx from 'clsx';

function formatSchedule(schedule: CronSchedule, t: (key: string, options?: Record<string, unknown>) => string): string {
  switch (schedule.kind) {
    case 'every': return t('agents.every', { sec: ((schedule.everyMs || 60000) / 1000).toFixed(0) });
    case 'at': return t('agents.scheduledAt', { at: schedule.at || '-' });
    case 'cron': return `${schedule.expr || '-'}${schedule.tz ? ` (${schedule.tz})` : ''}`;
    default: return '-';
  }
}

function formatPayload(payload: CronPayload): string {
  switch (payload.kind) {
    case 'agentTurn': return `Agent: ${payload.message?.slice(0, 40) || '-'}`;
    case 'systemEvent': return `Event: ${payload.text?.slice(0, 40) || '-'}`;
    default: return '-';
  }
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

type ScheduleKind = 'every' | 'cron';
type PayloadKind = 'agentTurn' | 'systemEvent';
type DeliveryMode = 'announce' | 'webhook' | 'none';

const defaultForm = {
  name: '',
  agentId: '' as string,
  scheduleKind: 'cron' as ScheduleKind,
  everySeconds: '60',
  expr: '0 8 * * *',
  tz: '',
  sessionTarget: 'main' as 'main' | 'isolated',
  wakeMode: 'now' as 'now' | 'next-heartbeat',
  payloadKind: 'agentTurn' as PayloadKind,
  payloadMessage: '',
  payloadText: '',
  payloadThinking: 'low',
  payloadTimeoutSeconds: '120',
  deliveryMode: 'announce' as DeliveryMode,
  deliveryChannel: '',
  deliveryWebhook: '',
};

export default function SchedulePage() {
  const { t } = useTranslation();
  const RUN_STATUS_MAP: Record<string, { icon: React.ElementType; color: string; label: string; bg: string }> = {
    ok: { icon: CheckCircle, color: 'text-green-500', label: t('scheduler.success'), bg: 'bg-green-50 dark:bg-green-950' },
    error: { icon: XCircle, color: 'text-red-500', label: t('scheduler.failed'), bg: 'bg-red-50 dark:bg-red-950' },
    skipped: { icon: Clock, color: 'text-slate-400', label: t('scheduler.skipped'), bg: 'bg-slate-50 dark:bg-slate-900' },
  };
  const {
    cronJobs, cronRuns, agentsList,
    createCronJob, updateCronJob, toggleCronJob, runCronJob, deleteCronJob, fetchCronRuns,
    refreshCronJobs,
  } = useGatewayStore();
  const { documents } = useDocumentStore();

  const [showCreate, setShowCreate] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [showRunsJobId, setShowRunsJobId] = useState<string | null>(null);
  const deleteAction = useConfirmAction<string>();
  const [form, setForm] = useState(defaultForm);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [editForm, setEditForm] = useState(defaultForm);

  // Escape key support for dialogs
  useEscapeKey(showCreate, useCallback(() => setShowCreate(false), []));
  useEscapeKey(!!editingJob, useCallback(() => setEditingJob(null), []));

  const enabledJobs = useMemo(() => cronJobs.filter(j => j.enabled), [cronJobs]);
  const disabledJobs = useMemo(() => cronJobs.filter(j => !j.enabled), [cronJobs]);

  const nextWakeJob = useMemo(() => {
    const withNext = cronJobs.filter(j => j.enabled && j.state?.nextRunAtMs && j.state.nextRunAtMs > 0);
    if (withNext.length === 0) return null;
    return withNext.reduce((a, b) => (a.state?.nextRunAtMs || Infinity) < (b.state?.nextRunAtMs || Infinity) ? a : b);
  }, [cronJobs]);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) return;
    const schedule: CronSchedule =
      form.scheduleKind === 'every'
        ? { kind: 'every', everyMs: parseInt(form.everySeconds) * 1000 }
        : { kind: 'cron', expr: form.expr, tz: form.tz || undefined };

    const payload: CronPayload =
      form.payloadKind === 'agentTurn'
        ? { kind: 'agentTurn', message: form.payloadMessage, thinking: form.payloadThinking, timeoutSeconds: parseInt(form.payloadTimeoutSeconds) || 120 }
        : { kind: 'systemEvent', text: form.payloadText };

    const delivery: CronDelivery = {
      mode: form.deliveryMode,
      ...(form.deliveryMode === 'announce' && form.deliveryChannel ? { channel: form.deliveryChannel } : {}),
    };

    await createCronJob({
      name: form.name.trim(),
      agentId: form.agentId || undefined,
      schedule,
      sessionTarget: form.sessionTarget,
      wakeMode: form.wakeMode,
      payload,
      delivery,
    });
    setForm(defaultForm);
    setShowCreate(false);
  }, [form, createCronJob]);

  const handleToggleRuns = async (jobId: string) => {
    if (showRunsJobId === jobId) {
      setShowRunsJobId(null);
      return;
    }
    setShowRunsJobId(jobId);
    await fetchCronRuns(jobId);
  };

  const handleDelete = async (id: string) => {
    await deleteCronJob(id);
  };

  const handleEditOpen = useCallback((job: CronJob) => {
    setEditingJob(job);
    setEditForm({
      name: job.name,
      agentId: job.agentId || '',
      scheduleKind: job.schedule.kind === 'every' ? 'every' : 'cron',
      everySeconds: job.schedule.kind === 'every' ? String((job.schedule.everyMs || 60000) / 1000) : '60',
      expr: job.schedule.kind === 'cron' ? (job.schedule.expr || '0 8 * * *') : '0 8 * * *',
      tz: job.schedule.tz || '',
      sessionTarget: (job.sessionTarget as 'main' | 'isolated') || 'main',
      wakeMode: (job.wakeMode as 'now' | 'next-heartbeat') || 'now',
      payloadKind: job.payload.kind as PayloadKind,
      payloadMessage: job.payload.message || '',
      payloadText: job.payload.text || '',
      payloadThinking: job.payload.thinking || 'low',
      payloadTimeoutSeconds: String(job.payload.timeoutSeconds || 120),
      deliveryMode: (job.delivery?.mode as DeliveryMode) || 'announce',
      deliveryChannel: job.delivery?.channel || '',
      deliveryWebhook: '',
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingJob || !editForm.name.trim()) return;
    const schedule: CronSchedule =
      editForm.scheduleKind === 'every'
        ? { kind: 'every', everyMs: parseInt(editForm.everySeconds) * 1000 }
        : { kind: 'cron', expr: editForm.expr, tz: editForm.tz || undefined };

    const payload: CronPayload =
      editForm.payloadKind === 'agentTurn'
        ? { kind: 'agentTurn', message: editForm.payloadMessage, thinking: editForm.payloadThinking, timeoutSeconds: parseInt(editForm.payloadTimeoutSeconds) || 120 }
        : { kind: 'systemEvent', text: editForm.payloadText };

    const delivery: CronDelivery = {
      mode: editForm.deliveryMode,
      ...(editForm.deliveryMode === 'announce' && editForm.deliveryChannel ? { channel: editForm.deliveryChannel } : {}),
    };

    await updateCronJob(editingJob.id, {
      name: editForm.name.trim(),
      agentId: editForm.agentId || undefined,
      schedule,
      sessionTarget: editForm.sessionTarget,
      wakeMode: editForm.wakeMode,
      payload,
      delivery,
    });
    setEditingJob(null);
    await refreshCronJobs();
  }, [editingJob, editForm, updateCronJob, refreshCronJobs]);

  return (
    <AppShell>
      <GatewayRequired feature={t('scheduler.title')}>
      <Header
        title={t('scheduler.title')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex items-center gap-1 text-xs"
              onClick={() => refreshCronJobs()}
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('agents.refresh')}
            </Button>
            <Button size="sm" className="flex items-center gap-1 text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5" /> {t('scheduler.newJob')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-6 overflow-auto max-w-4xl mx-auto space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>{cronJobs.length}</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.totalJobs')}</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950 flex items-center justify-center">
                <Zap className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold font-display text-green-600">{enabledJobs.length}</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.enabledJobs')}</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Power className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-display" style={{ color: 'var(--text-tertiary)' }}>{disabledJobs.length}</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.disabledJobs')}</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
                <Timer className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <div className="text-sm font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
                  {nextWakeJob?.state?.nextRunAtMs
                    ? formatTime(nextWakeJob.state.nextRunAtMs)
                    : '--'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.nextExecution')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 24 小时时间线 */}
        {enabledJobs.length > 0 && (
          <div>
            <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.todayTimeline')}</h3>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="grid grid-cols-12 gap-px" style={{ background: 'var(--border)' }}>
                {Array.from({ length: 12 }, (_, i) => i * 2).map(hour => {
                  const jobsAtHour = enabledJobs.filter(j => {
                    if (j.schedule.kind === 'cron' && j.schedule.expr) {
                      const parts = j.schedule.expr.split(' ');
                      if (parts.length >= 2) {
                        const cronHour = parseInt(parts[1]);
                        return cronHour === hour || cronHour === hour + 1;
                      }
                    }
                    return false;
                  });
                  return (
                    <div key={hour} className="min-h-[48px] p-1.5" style={{ background: 'var(--surface)' }}>
                      <div className="text-[10px] mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {String(hour).padStart(2, '0')}:00
                      </div>
                      {jobsAtHour.map(job => (
                        <div
                          key={job.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 truncate mb-0.5"
                        >
                          {job.name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 任务列表 */}
        {cronJobs.length === 0 ? (
          <div className="card p-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.noJobs')}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.noJobsHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cronJobs.map(job => {
              const isExpanded = expandedJobId === job.id;
              const runs = cronRuns[job.id] || [];
              const isShowingRuns = showRunsJobId === job.id;
              return (
                <div key={job.id} className={clsx('card overflow-hidden border-l-4', job.enabled ? 'border-l-blue-500' : 'border-l-slate-300 opacity-80')}>
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                  >
                    <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', job.enabled ? 'bg-green-500' : 'bg-slate-300')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{job.name}</span>
                        {!job.enabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">{t('scheduler.disabledLabel')}</span>
                        )}
                        {job.agentId && (
                          <Badge className="text-[10px] bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center gap-0.5">
                            <Bot className="w-2.5 h-2.5" />
                            {agentsList.find(a => a.id === job.agentId)?.identity?.name || agentsList.find(a => a.id === job.agentId)?.name || job.agentId}
                          </Badge>
                        )}
                        <Badge className="text-[10px] bg-slate-100 dark:bg-slate-800" style={{ color: 'var(--text-tertiary)' }}>
                          <Timer className="w-2.5 h-2.5" />
                          {formatSchedule(job.schedule, t)}
                        </Badge>
                        <Badge className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          {job.sessionKey || job.sessionTarget}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <span>{formatPayload(job.payload)}</span>
                        {job.state?.lastStatus && (
                          <span className={clsx(
                            job.state.lastStatus === 'ok' ? 'text-green-500' : 'text-red-400'
                          )}>
                            {t('scheduler.lastRun')}: {job.state.lastStatus}
                          </span>
                        )}
                        {job.state?.nextRunAtMs != null && job.state.nextRunAtMs > 0 && (
                          <span>{t('scheduler.nextRun')}: {formatTime(job.state.nextRunAtMs)}</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={clsx('w-4 h-4 transition-transform flex-shrink-0', isExpanded && 'rotate-180')} style={{ color: 'var(--text-tertiary)' }} />
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
                      {/* 详细信息 */}
                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.wakeMode')}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{job.wakeMode || 'now'}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.deliveryMode')}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{job.delivery?.mode || 'none'}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.payload')} Type</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{job.payload.kind}</div>
                        </div>
                        {job.payload.timeoutSeconds && (
                          <div>
                            <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.timeout')}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{job.payload.timeoutSeconds}s</div>
                          </div>
                        )}
                        {job.payload.thinking && (
                          <div>
                            <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.thinking')}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{job.payload.thinking}</div>
                          </div>
                        )}
                        {job.createdAtMs && (
                          <div>
                            <div style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.createdAt')}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{formatDate(job.createdAtMs)}</div>
                          </div>
                        )}
                      </div>

                      {/* 关联文档引用 */}
                      {(() => {
                        const msg = job.payload.message || job.payload.text || '';
                        const refs = [...msg.matchAll(/\[\[(.+?)\]\]/g)].map(m => m[1]);
                        if (refs.length === 0) return null;
                        return (
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.linkedDocs')}:</span>
                            {refs.map((title, i) => {
                              const doc = documents.find(d => d.title === title);
                              return doc ? (
                                <a key={i} href={`/wiki?doc=${doc.id}`}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                                  style={{ background: 'var(--surface-hover)' }}>
                                  <FileText className="w-3 h-3" /> {title}
                                </a>
                              ) : (
                                <span key={i} className="px-2 py-0.5 rounded" style={{ background: 'var(--surface-hover)', color: 'var(--text-tertiary)' }}>
                                  {title}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* 状态信息 */}
                      {job.state && (
                        <div className="flex items-center gap-4 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                          {job.state.lastStatus && (
                            <span className="flex items-center gap-1">
                              {job.state.lastStatus === 'ok' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                              {t('scheduler.lastRun')}: {job.state.lastStatus}
                            </span>
                          )}
                          {job.state.lastDurationMs != null && (
                            <span style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.duration')} {(job.state.lastDurationMs / 1000).toFixed(1)}s</span>
                          )}
                          {job.state.consecutiveErrors != null && job.state.consecutiveErrors > 0 && (
                            <span className="text-red-400">{t('scheduler.consecutiveErrors', { count: job.state.consecutiveErrors })}</span>
                          )}
                          {job.state.lastError && (
                            <span className="text-red-400 truncate flex-1">{job.state.lastError}</span>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={job.enabled ? 'secondary' : 'primary'}
                          className="flex items-center gap-1"
                          onClick={() => toggleCronJob(job.id, !job.enabled)}
                        >
                          <Power className="w-3.5 h-3.5" /> {job.enabled ? t('scheduler.disabled') : t('scheduler.enabled')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex items-center gap-1"
                          onClick={() => handleEditOpen(job)}
                        >
                          <Pencil className="w-3.5 h-3.5" /> {t('common.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex items-center gap-1"
                          onClick={() => runCronJob(job.id)}
                        >
                          <Play className="w-3.5 h-3.5" /> {t('scheduler.runNow')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex items-center gap-1"
                          onClick={() => handleToggleRuns(job.id)}
                        >
                          <History className="w-3.5 h-3.5" /> {t('scheduler.runHistory')}
                        </Button>
                        <div className="flex-1" />
                        <Button
                          size="sm"
                          variant="danger"
                          className="flex items-center gap-1"
                          onClick={() => deleteAction.requestConfirm(job.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                        </Button>
                      </div>

                      {/* 执行历史 */}
                      {isShowingRuns && (
                        <div className="mt-2">
                          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.runHistory')}</div>
                          {runs.length === 0 ? (
                            <div className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.noRunHistory')}</div>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {runs.map((run, idx) => {
                                const info = RUN_STATUS_MAP[run.status || 'error'] || RUN_STATUS_MAP.error;
                                const StatusIcon = info.icon;
                                return (
                                  <div key={`${run.ts}-${idx}`} className={clsx('flex items-center gap-2 text-xs p-2 rounded-lg', info.bg)}>
                                    <StatusIcon className={clsx('w-3.5 h-3.5', info.color)} />
                                    <span className={info.color}>{info.label}</span>
                                    {run.summary && <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{run.summary}</span>}
                                    {run.durationMs != null && <span style={{ color: 'var(--text-tertiary)' }}>{(run.durationMs / 1000).toFixed(1)}s</span>}
                                    <span style={{ color: 'var(--text-tertiary)' }}>
                                      {formatDate(run.ts)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 新建定时任务对话框 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="create-cron-title">
          <div className="rounded-2xl p-6 w-full max-w-lg shadow-float max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <h3 id="create-cron-title" className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('scheduler.newJob')}</h3>
            <div className="space-y-4">
              {/* 名称 */}
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.taskName')} *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('scheduler.taskNamePlaceholder')} autoFocus />
              </div>

              {/* Agent 选择 */}
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.execAgent')}</label>
                <Select value={form.agentId} onChange={e => setForm({ ...form, agentId: e.target.value })}>
                  <option value="">{t('scheduler.defaultAgent')}</option>
                  {agentsList.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.identity?.emoji ? `${a.identity.emoji} ` : ''}{a.identity?.name || a.name || a.id}
                    </option>
                  ))}
                </Select>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.execAgentHint')}</p>
              </div>

              {/* 调度配置 */}
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.scheduleMode')}</label>
                <div className="flex gap-2 mb-2">
                  {(['every', 'cron'] as const).map(kind => (
                    <Button key={kind} size="sm" variant={form.scheduleKind === kind ? 'primary' : 'secondary'} className="flex-1" onClick={() => setForm({ ...form, scheduleKind: kind })}>
                      {kind === 'every' ? t('scheduler.intervalMode') : t('scheduler.cronMode')}
                    </Button>
                  ))}
                </div>
                {form.scheduleKind === 'every' && (
                  <div className="flex items-center gap-2">
                    <Input type="number" value={form.everySeconds} onChange={e => setForm({ ...form, everySeconds: e.target.value })} className="flex-1" placeholder="60" />
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.seconds')}</span>
                  </div>
                )}
                {form.scheduleKind === 'cron' && (
                  <div className="space-y-2">
                    <Input value={form.expr} onChange={e => setForm({ ...form, expr: e.target.value })} placeholder="0 8 * * *" />
                    <Input value={form.tz} onChange={e => setForm({ ...form, tz: e.target.value })} className="text-xs" placeholder={t('scheduler.timezonePlaceholder')} />
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.cronHelp')}</p>
                  </div>
                )}
              </div>

              {/* Session 目标 & Wake 模式 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.sessionTarget')}</label>
                  <Select value={form.sessionTarget} onChange={e => setForm({ ...form, sessionTarget: e.target.value as 'main' | 'isolated' })}>
                    <option value="main">{t('scheduler.mainSession')}</option>
                    <option value="isolated">{t('scheduler.isolatedSession')}</option>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.wakeMode')}</label>
                  <Select value={form.wakeMode} onChange={e => setForm({ ...form, wakeMode: e.target.value as 'now' | 'next-heartbeat' })}>
                    <option value="now">{t('scheduler.wakeModeNow')}</option>
                    <option value="next-heartbeat">{t('scheduler.wakeModeHeartbeat')}</option>
                  </Select>
                </div>
              </div>

              {/* Payload */}
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.payload')} {t('scheduler.status')}</label>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant={form.payloadKind === 'agentTurn' ? 'primary' : 'secondary'} className="flex-1" onClick={() => setForm({ ...form, payloadKind: 'agentTurn' })}>
                    {t('scheduler.agentTurn')}
                  </Button>
                  <Button size="sm" variant={form.payloadKind === 'systemEvent' ? 'primary' : 'secondary'} className="flex-1" onClick={() => setForm({ ...form, payloadKind: 'systemEvent' })}>
                    {t('scheduler.systemEvent')}
                  </Button>
                </div>
                {form.payloadKind === 'agentTurn' ? (
                  <div className="space-y-2">
                    <Textarea value={form.payloadMessage} onChange={e => setForm({ ...form, payloadMessage: e.target.value })}
                      className="text-sm resize-none" rows={3} placeholder={t('scheduler.agentInstructions')} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.insertDocRef')}</span>
                      {documents.slice(0, 8).map(doc => (
                        <button key={doc.id} type="button"
                          onClick={() => setForm({ ...form, payloadMessage: form.payloadMessage + ` [[${doc.title}]]` })}
                          className="text-[10px] px-1.5 py-0.5 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 transition-colors truncate max-w-[120px]"
                          style={{ background: 'var(--surface-hover)' }}
                        >
                          <FileText className="w-2.5 h-2.5 inline mr-0.5" />{doc.title}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.thinking')}:</span>
                        <Select
                          value={form.payloadThinking}
                          onChange={e => setForm({ ...form, payloadThinking: e.target.value })}
                          className="w-24 text-xs py-0.5"
                        >
                          <option value="off">off</option>
                          <option value="minimal">minimal</option>
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                          <option value="xhigh">xhigh</option>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.timeout')}:</span>
                        <Input type="number" value={form.payloadTimeoutSeconds} onChange={e => setForm({ ...form, payloadTimeoutSeconds: e.target.value })}
                          className="w-16 text-xs py-0.5" /> <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>s</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Textarea value={form.payloadText} onChange={e => setForm({ ...form, payloadText: e.target.value })}
                    className="text-sm resize-none" rows={3} placeholder={t('scheduler.systemContent')} />
                )}
              </div>

              {/* 投递模式 */}
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.deliveryMode')}</label>
                <Select value={form.deliveryMode} onChange={e => setForm({ ...form, deliveryMode: e.target.value as DeliveryMode })}>
                  <option value="announce">announce</option>
                  <option value="webhook">webhook</option>
                  <option value="none">none</option>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="secondary" onClick={() => { setShowCreate(false); setForm(defaultForm); }}>{t('scheduler.cancel')}</Button>
              <Button size="sm" disabled={!form.name.trim()} className="disabled:opacity-50" onClick={handleCreate}>{t('scheduler.create')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteAction.isOpen}
        onClose={deleteAction.cancel}
        onConfirm={() => deleteAction.confirm(handleDelete)}
        title={t('scheduler.deleteTask')}
        message={t('scheduler.irreversible')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isLoading={deleteAction.isLoading}
      />

      {/* 编辑定时任务对话框 */}
      {editingJob && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="edit-cron-title">
          <div className="rounded-2xl p-6 w-full max-w-lg shadow-float max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <h3 id="edit-cron-title" className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('scheduler.editTask')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.taskName')} *</label>
                <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.execAgent')}</label>
                <Select value={editForm.agentId} onChange={e => setEditForm({ ...editForm, agentId: e.target.value })}>
                  <option value="">{t('scheduler.defaultAgent')}</option>
                  {agentsList.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.identity?.emoji ? `${a.identity.emoji} ` : ''}{a.identity?.name || a.name || a.id}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.scheduleMode')}</label>
                <div className="flex gap-2 mb-2">
                  {(['every', 'cron'] as const).map(kind => (
                    <Button key={kind} size="sm" variant={editForm.scheduleKind === kind ? 'primary' : 'secondary'} className="flex-1" onClick={() => setEditForm({ ...editForm, scheduleKind: kind })}>
                      {kind === 'every' ? t('scheduler.intervalMode') : t('scheduler.cronMode')}
                    </Button>
                  ))}
                </div>
                {editForm.scheduleKind === 'every' && (
                  <div className="flex items-center gap-2">
                    <Input type="number" value={editForm.everySeconds} onChange={e => setEditForm({ ...editForm, everySeconds: e.target.value })} className="flex-1" />
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.seconds')}</span>
                  </div>
                )}
                {editForm.scheduleKind === 'cron' && (
                  <div className="space-y-2">
                    <Input value={editForm.expr} onChange={e => setEditForm({ ...editForm, expr: e.target.value })} />
                    <Input value={editForm.tz} onChange={e => setEditForm({ ...editForm, tz: e.target.value })} className="text-xs" placeholder={t('scheduler.timezone')} />
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.sessionTarget')}</label>
                  <Select value={editForm.sessionTarget} onChange={e => setEditForm({ ...editForm, sessionTarget: e.target.value as 'main' | 'isolated' })}>
                    <option value="main">main</option>
                    <option value="isolated">isolated</option>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.wakeMode')}</label>
                  <Select value={editForm.wakeMode} onChange={e => setEditForm({ ...editForm, wakeMode: e.target.value as 'now' | 'next-heartbeat' })}>
                    <option value="now">{t('scheduler.wakeModeNow')}</option>
                    <option value="next-heartbeat">{t('scheduler.wakeModeHeartbeat')}</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.payload')} {t('scheduler.status')}</label>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant={editForm.payloadKind === 'agentTurn' ? 'primary' : 'secondary'} className="flex-1" onClick={() => setEditForm({ ...editForm, payloadKind: 'agentTurn' })}>
                    {t('scheduler.agentTurn')}
                  </Button>
                  <Button size="sm" variant={editForm.payloadKind === 'systemEvent' ? 'primary' : 'secondary'} className="flex-1" onClick={() => setEditForm({ ...editForm, payloadKind: 'systemEvent' })}>
                    {t('scheduler.systemEvent')}
                  </Button>
                </div>
                {editForm.payloadKind === 'agentTurn' ? (
                  <div className="space-y-2">
                    <Textarea value={editForm.payloadMessage} onChange={e => setEditForm({ ...editForm, payloadMessage: e.target.value })}
                      className="text-sm resize-none" rows={3} placeholder={t('scheduler.agentInstructions')} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.insertDocRef')}</span>
                      {documents.slice(0, 8).map(doc => (
                        <button key={doc.id} type="button"
                          onClick={() => setEditForm({ ...editForm, payloadMessage: editForm.payloadMessage + ` [[${doc.title}]]` })}
                          className="text-[10px] px-1.5 py-0.5 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 transition-colors truncate max-w-[120px]"
                          style={{ background: 'var(--surface-hover)' }}
                        >
                          <FileText className="w-2.5 h-2.5 inline mr-0.5" />{doc.title}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.thinking')}:</span>
                        <Select value={editForm.payloadThinking} onChange={e => setEditForm({ ...editForm, payloadThinking: e.target.value })} className="w-24 text-xs py-0.5">
                          <option value="off">off</option>
                          <option value="minimal">minimal</option>
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                          <option value="xhigh">xhigh</option>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('scheduler.timeout')}:</span>
                        <Input type="number" value={editForm.payloadTimeoutSeconds} onChange={e => setEditForm({ ...editForm, payloadTimeoutSeconds: e.target.value })}
                          className="w-16 text-xs py-0.5" /> <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>s</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Textarea value={editForm.payloadText} onChange={e => setEditForm({ ...editForm, payloadText: e.target.value })}
                    className="text-sm resize-none" rows={3} placeholder={t('scheduler.systemContent')} />
                )}
              </div>
              <div>
                <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>{t('scheduler.deliveryMode')}</label>
                <Select value={editForm.deliveryMode} onChange={e => setEditForm({ ...editForm, deliveryMode: e.target.value as DeliveryMode })}>
                  <option value="announce">announce</option>
                  <option value="webhook">webhook</option>
                  <option value="none">none</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="secondary" onClick={() => setEditingJob(null)}>{t('scheduler.cancel')}</Button>
              <Button size="sm" disabled={!editForm.name.trim()} className="disabled:opacity-50" onClick={handleEditSave}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      )}
      </GatewayRequired>
    </AppShell>
  );
}
