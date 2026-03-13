'use client';

import { useTranslation } from 'react-i18next';
import {
  FileText, Users, Link2, Briefcase, CheckSquare,
} from 'lucide-react';
import clsx from 'clsx';

interface DocRelations {
  linkedDocs: any[];
  backlinkDocs: any[];
  relatedProjects: any[];
  relatedMembers: any[];
  relatedTasks: any[];
}

interface WikiKnowledgeGraphProps {
  docRelations: DocRelations;
  onSelectDoc: (id: string) => void;
}

export default function WikiKnowledgeGraph({ docRelations, onSelectDoc }: WikiKnowledgeGraphProps) {
  const { t } = useTranslation();

  return (
    <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 关联项目 */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <Briefcase className="w-3 h-3" /> {t('wiki.projectCount')} ({docRelations.relatedProjects.length})
          </div>
          {docRelations.relatedProjects.length > 0 ? (
            <div className="space-y-1">
              {docRelations.relatedProjects.map((p: any) => (
                <div key={p.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)' }}>
                  {p.name}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>-</div>
          )}
        </div>

        {/* 关联人员 */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <Users className="w-3 h-3" /> {t('wiki.memberCount')} ({docRelations.relatedMembers.length})
          </div>
          {docRelations.relatedMembers.length > 0 ? (
            <div className="space-y-1">
              {docRelations.relatedMembers.map((m: any) => (
                <div key={m.id} className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)' }}>
                  <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[8px]', m.type === 'ai' ? 'member-ai' : 'bg-primary-100 text-primary-600')}>
                    {m.name[0]}
                  </span>
                  {m.name}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.noMembers')}</div>
          )}
        </div>

        {/* 引用文档 */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <FileText className="w-3 h-3" /> {t('wiki.refs')} ({docRelations.linkedDocs.length})
          </div>
          {docRelations.linkedDocs.length > 0 ? (
            <div className="space-y-1">
              {docRelations.linkedDocs.map((d: any) => (
                <button key={d.id} onClick={() => onSelectDoc(d.id)}
                  className="w-full text-left text-xs px-2 py-1 rounded text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors truncate"
                  style={{ background: 'var(--surface-hover)' }}>
                  {d.title}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>{t('wiki.noRefs')}</div>
          )}
        </div>

        {/* 被引用 + 关联任务 */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <Link2 className="w-3 h-3" /> {t('wiki.backrefs')} ({docRelations.backlinkDocs.length + docRelations.relatedTasks.length})
          </div>
          {docRelations.backlinkDocs.length > 0 && docRelations.backlinkDocs.map((d: any) => (
            <button key={d.id} onClick={() => onSelectDoc(d.id)}
              className="w-full text-left text-xs px-2 py-1 rounded text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors truncate mb-1"
              style={{ background: 'var(--surface-hover)' }}>
              📄 {d.title}
            </button>
          ))}
          {docRelations.relatedTasks.length > 0 && docRelations.relatedTasks.map((task: any) => (
            <div key={task.id} className="text-xs px-2 py-1 rounded mb-1 flex items-center gap-1 truncate"
              style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)' }}>
              <CheckSquare className="w-3 h-3 text-primary-500 flex-shrink-0" /> {task.title}
            </div>
          ))}
          {docRelations.backlinkDocs.length === 0 && docRelations.relatedTasks.length === 0 && (
            <div className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>-</div>
          )}
        </div>
      </div>
    </div>
  );
}
