'use client';

import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import type { Task, Project, Member } from '@/db/schema';
import type { StatusColumn } from '../hooks/useTasksPage';

interface StatusColumnConfig {
  key: StatusColumn;
  label: string;
  color: string;
}

interface TaskListViewProps {
  filteredTasks: Task[];
  projects: Project[];
  STATUS_COLUMNS: StatusColumnConfig[];
  PRIORITY_MAP: Record<string, { label: string; class: string }>;
  getMemberName: (assignees?: string[] | null) => Member | null | undefined;
  onOpenDrawer: (taskId: string) => void;
  onRequestDelete: (taskId: string) => void;
  t: (key: string) => string;
}

export default function TaskListView({
  filteredTasks, projects, STATUS_COLUMNS, PRIORITY_MAP,
  getMemberName, onOpenDrawer, onRequestDelete, t,
}: TaskListViewProps) {
  return (
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
              <tr
                key={task.id}
                className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => onOpenDrawer(task.id)}
              >
                <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>{task.title}</td>
                <td className="px-4 py-2.5">
                  <Badge className={clsx('text-[10px]', `status-${task.status}`)}>{statusCol?.label}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge className={clsx('text-[10px]', priorityInfo.class)}>{priorityInfo.label}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{assignee?.name || '-'}</td>
                <td className="px-4 py-2.5 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{project?.name || t('tasks.uncategorized')}</td>
                <td className="px-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(task.id); }}
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
              <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tasks.noTasks')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
