'use client';

import { useTranslation } from 'react-i18next';
import type { HealthSummary } from '@/types';
import { Radio, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface ChannelsPanelProps {
  health: HealthSummary | null;
}

export default function ChannelsPanel({ health }: ChannelsPanelProps) {
  const { t } = useTranslation();
  if (!health) {
    return (
      <div className="max-w-2xl">
        <h3 className="section-title text-[11px] mb-3">{t('agents.channelStatus', { count: 0 })}</h3>
        <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>{t('agents.noChannelData')}</div>
      </div>
    );
  }

  const channelNames = health.channelOrder || Object.keys(health.channels);

  return (
    <div className="max-w-2xl">
      <h3 className="section-title text-[11px] mb-3">{t('agents.channelStatus', { count: channelNames.length })}</h3>
      {channelNames.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>{t('agents.noChannelData')}</div>
      ) : (
        <div className="space-y-2">
          {channelNames.map(name => {
            const ch = health.channels[name];
            if (!ch) return null;
            const label = health.channelLabels?.[name] || name;
            const isOk = ch.configured && ch.linked;
            return (
              <div key={name} className="rounded-lg p-4 border" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isOk ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : ch.configured ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300" />
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {ch.configured ? (ch.linked ? t('agents.connected') : t('agents.notLinked')) : t('agents.notConfigured')}
                    </span>
                  </div>
                </div>
                {ch.accounts && Object.keys(ch.accounts).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(ch.accounts).map(([accId, acc]) => (
                      <div key={accId} className="flex items-center justify-between text-xs px-2 py-1.5 rounded" style={{ background: 'var(--surface-hover)' }}>
                        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{accId}</span>
                        <span style={{ color: acc.linked ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {acc.linked ? t('agents.linked') : t('agents.notLinked')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
