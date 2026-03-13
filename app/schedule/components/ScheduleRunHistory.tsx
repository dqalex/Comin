'use client';

import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { CronRunLogEntry } from '@/types';
import { formatDate } from '../hooks/useSchedulePage';

interface ScheduleRunHistoryProps {
  runs: CronRunLogEntry[];
}

export default function ScheduleRunHistory({ runs }: ScheduleRunHistoryProps) {
  const { t } = useTranslation();

  const RUN_STATUS_MAP: Record<string, { icon: React.ElementType; color: string; label: string; bg: string }> = {
    ok: { icon: CheckCircle, color: 'text-green-500', label: t('scheduler.success'), bg: 'bg-green-50 dark:bg-green-950' },
    error: { icon: XCircle, color: 'text-red-500', label: t('scheduler.failed'), bg: 'bg-red-50 dark:bg-red-950' },
    skipped: { icon: Clock, color: 'text-slate-400', label: t('scheduler.skipped'), bg: 'bg-slate-50 dark:bg-slate-900' },
  };

  return (
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
  );
}
