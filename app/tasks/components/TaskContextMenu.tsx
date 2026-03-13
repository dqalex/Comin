'use client';

import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import type { Task } from '@/db/schema';
import type { StatusColumn } from '../hooks/useTasksPage';

interface StatusColumnConfig {
  key: StatusColumn;
  label: string;
  color: string;
}

interface TaskContextMenuProps {
  task: Task;
  menuPosition: { top: number; left: number };
  menuRef: React.RefObject<HTMLDivElement>;
  STATUS_COLUMNS: StatusColumnConfig[];
  onStatusChange: (taskId: string, status: StatusColumn) => void;
  onDelete: (taskId: string) => Promise<void> | Promise<boolean>;
  onClose: () => void;
  deleteLabel: string;
}

export default function TaskContextMenu({
  task, menuPosition, menuRef, STATUS_COLUMNS,
  onStatusChange, onDelete, onClose, deleteLabel,
}: TaskContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed w-32 rounded-lg shadow-float border z-50 py-1"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          top: menuPosition.top,
          left: menuPosition.left,
        }}
      >
        {STATUS_COLUMNS.filter(s => s.key !== task.status).map(s => (
          <button
            key={s.key}
            onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, s.key); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', s.color)} />
            {s.label}
          </button>
        ))}
        <div className="h-px my-1" style={{ background: 'var(--border)' }} />
        <button
          onClick={async (e) => { e.stopPropagation(); await onDelete(task.id); onClose(); }}
          className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500 flex items-center gap-2"
        >
          <Trash2 className="w-3 h-3" /> {deleteLabel}
        </button>
      </div>
    </>
  );
}
