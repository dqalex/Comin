'use client';

import { useTranslation } from 'react-i18next';
import type { AgentListEntry } from '@/lib/gateway-client';
import type { AgentHealthSummary } from '@/types';
import clsx from 'clsx';

interface OverviewPanelProps {
  agent: AgentListEntry;
  agentHealth: AgentHealthSummary | null;
}

export default function OverviewPanel({ agent, agentHealth }: OverviewPanelProps) {
  const { t } = useTranslation();
  const fields = [
    { label: 'Agent ID', value: agent.id },
    { label: 'Name', value: agent.name || '--' },
    { label: 'Identity', value: agent.identity?.name || '--' },
    { label: 'Emoji', value: agent.identity?.emoji || '--' },
    { label: 'Theme', value: agent.identity?.theme || '--' },
    { label: 'Default', value: agent.isDefault ? t('agents.enabled') : t('agents.disabled') },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="section-title text-[11px] mb-3">{t('agents.basicInfo')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(f => (
            <div key={f.label} className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
              <div className="text-[11px] mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{f.label}</div>
              <div className="text-sm font-medium font-mono" style={{ color: 'var(--text-primary)' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {agentHealth && (
        <>
          <div>
            <h3 className="section-title text-[11px] mb-3">{t('agents.heartbeatConfig')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('agents.status')}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={clsx('w-2 h-2 rounded-full', agentHealth.heartbeat.enabled ? 'bg-green-500' : 'bg-slate-300')} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {agentHealth.heartbeat.enabled ? t('agents.enabled') : t('agents.disabled')}
                  </span>
                </div>
              </div>
              <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('agents.interval')}</div>
                <div className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                  {agentHealth.heartbeat.every}
                </div>
              </div>
              <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('agents.target')}</div>
                <div className="text-sm font-medium font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                  {agentHealth.heartbeat.target}
                </div>
              </div>
              {agentHealth.heartbeat.model && (
                <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('agents.model')}</div>
                  <div className="text-sm font-medium font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                    {agentHealth.heartbeat.model}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="section-title text-[11px] mb-3">{t('agents.sessionInfo')}</h3>
            <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('agents.path')}: <span className="font-mono">{agentHealth.sessions.path}</span>
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {agentHealth.sessions.count} {t('agents.sessions')}
                </span>
              </div>
              {agentHealth.sessions.recent.length > 0 && (
                <div className="space-y-1 mt-2">
                  {agentHealth.sessions.recent.slice(0, 5).map(s => (
                    <div key={s.key} className="flex items-center justify-between text-xs py-1">
                      <span className="font-mono truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{s.key}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {s.updatedAt ? new Date(s.updatedAt).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
