'use client';

import { useTranslation } from 'react-i18next';
import type { CronJob } from '@/types';

interface ScheduleTimelineProps {
  enabledJobs: CronJob[];
}

export default function ScheduleTimeline({ enabledJobs }: ScheduleTimelineProps) {
  const { t } = useTranslation();

  if (enabledJobs.length === 0) return null;

  return (
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
  );
}
