'use client';

import React, { useState } from 'react';
import { Plus, GripVertical, Milestone as MilestoneIcon } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

interface MilestoneDividerProps {
  milestoneId: string | null;
  title: string;
  status?: string;
  count: number;
  onAddMilestone?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export const MilestoneDivider: React.FC<MilestoneDividerProps> = ({
  milestoneId,
  title,
  status,
  count,
  onAddMilestone,
  onDragStart,
  isDragging
}) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={clsx(
        "relative flex items-center group/divider py-6 transition-all duration-300",
        isDragging && "opacity-50 scale-[0.98]"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 拖拽手柄 - 仅在 Hover 且有里程碑时显示 */}
      {milestoneId && (
        <div 
          className={clsx(
            "absolute left-0 p-1 cursor-grab active:cursor-grabbing transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          draggable
          onDragStart={onDragStart}
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
      )}

      {/* 左侧线 */}
      <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-border to-border" />

      {/* 中间核心区域 */}
      <div className="relative px-6 flex items-center gap-3">
        {/* 状态呼吸灯 */}
        {milestoneId && (
          <div className="relative flex items-center justify-center">
            <div className={clsx(
              "w-2 h-2 rounded-full z-10",
              status === 'completed' ? 'bg-emerald-500' : 
              status === 'in_progress' ? 'bg-indigo-500 animate-pulse' : 
              'bg-slate-400'
            )} />
            {status === 'in_progress' && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-indigo-500 animate-ping opacity-40" />
            )}
          </div>
        )}

        <div className="flex flex-col items-center">
          <span className="text-[11px] font-black tracking-[0.3em] uppercase text-slate-400 dark:text-slate-500 flex items-center gap-2">
            {milestoneId && <MilestoneIcon className="w-3 h-3 opacity-50" />}
            {title}
          </span>
          <span className="text-[9px] font-bold opacity-30 mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {count} {t('tasks.taskCount')}
          </span>
        </div>
      </div>

      {/* 右侧线 */}
      <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-border to-border relative">
        {/* 新增按钮提示 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddMilestone?.();
          }}
          className={clsx(
            "absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface border border-border shadow-xl transition-all duration-500 hover:scale-110 hover:border-brand",
            isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
          )}
          title={t('milestones.createMilestone')}
        >
          <Plus className="w-4 h-4 text-brand" />
        </button>
      </div>
    </div>
  );
};
