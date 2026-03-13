'use client';

import { useTranslation } from 'react-i18next';
import { Clock, Zap, Power, Timer } from 'lucide-react';
import type { CronJob } from '@/types';
import { formatTime } from '../hooks/useSchedulePage';

interface ScheduleStatsProps {
  totalJobs: number;
  enabledCount: number;
  disabledCount: number;
  nextWakeJob: CronJob | null;
}

export default function ScheduleStats({ totalJobs, enabledCount, disabledCount, nextWakeJob }: ScheduleStatsProps) {
  const { t } = useTranslation();

  const cards = [
    {
      icon: Clock,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50 dark:bg-blue-950',
      value: totalJobs,
      valueClass: '',
      label: t('scheduler.totalJobs'),
    },
    {
      icon: Zap,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-50 dark:bg-green-950',
      value: enabledCount,
      valueClass: 'text-green-600',
      label: t('scheduler.enabledJobs'),
    },
    {
      icon: Power,
      iconColor: 'text-slate-400',
      iconBg: 'bg-slate-100 dark:bg-slate-800',
      value: disabledCount,
      valueClass: '',
      valueStyle: { color: 'var(--text-tertiary)' } as React.CSSProperties,
      label: t('scheduler.disabledJobs'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div key={idx} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div>
                <div
                  className={`text-2xl font-bold font-display ${card.valueClass}`}
                  style={card.valueStyle || { color: 'var(--text-primary)' }}
                >
                  {card.value}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{card.label}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 下次执行时间卡片 */}
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
  );
}
