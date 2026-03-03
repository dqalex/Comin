'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CronJob } from '@/types';
import { Clock, Play, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface CronPanelProps {
  jobs: CronJob[];
  allJobs: CronJob[];
  agentId: string;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onRun: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function CronPanel({ jobs, allJobs, onToggle, onRun, onDelete }: CronPanelProps) {
  const { t } = useTranslation();
  const displayJobs = jobs.length > 0 ? jobs : allJobs;
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatSchedule = (schedule: CronJob['schedule']): string => {
    switch (schedule.kind) {
      case 'every': return t('agents.every', { sec: ((schedule.everyMs || 60000) / 1000).toFixed(0) });
      case 'at': return t('agents.scheduledAt', { at: schedule.at || '-' });
      case 'cron': return `${schedule.expr || '-'}${schedule.tz ? ` (${schedule.tz})` : ''}`;
      default: return '-';
    }
  };

  return (
    <div className="max-w-3xl">
      <h3 className="section-title text-[11px] mb-3">
        {jobs.length > 0 ? t('agents.agentCron', { count: jobs.length }) : t('agents.allCron', { count: allJobs.length })}
      </h3>
      {displayJobs.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>{t('agents.noCronJobs')}</div>
      ) : (
        <div className="space-y-2">
          {displayJobs.map(job => (
            <div key={job.id} className="rounded-lg p-4 border" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{job.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {formatSchedule(job.schedule)} · {job.sessionKey || job.sessionTarget}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onRun(job.id)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={t('agents.runNow')}
                  >
                    <Play className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                  <button
                    onClick={() => onToggle(job.id, !job.enabled)}
                    className="p-1"
                  >
                    {job.enabled ? (
                      <ToggleRight className="w-5 h-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </button>
                  {deletingId === job.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { onDelete(job.id); setDeletingId(null); }} className="text-[11px] text-red-500 hover:underline">{t('common.confirm')}</button>
                      <button onClick={() => setDeletingId(null)} className="text-[11px] hover:underline" style={{ color: 'var(--text-tertiary)' }}>{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(job.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  )}
                </div>
              </div>
              {job.state && (
                <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  {job.state.lastStatus && <span>{t('agents.lastRun')}: {job.state.lastStatus}</span>}
                  {job.state.nextRunAtMs != null && job.state.nextRunAtMs > 0 && (
                    <span>{t('agents.nextRun')}: {new Date(job.state.nextRunAtMs).toLocaleTimeString(undefined)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
