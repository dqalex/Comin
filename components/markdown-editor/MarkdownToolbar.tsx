'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Columns, Eye } from 'lucide-react';
import clsx from 'clsx';
import type { MarkdownToolbarProps } from './types';

function MarkdownToolbar({
  viewMode,
  value,
  readOnly,
  editOnly,
  renderHtml,
  onViewModeChange,
}: MarkdownToolbarProps) {
  const { t } = useTranslation();

  if (editOnly) return null;

  return (
    <div className="relative z-[1] flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <span className="font-medium">Markdown</span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span>{value.length} 字符</span>
      </div>
      <div className="flex items-center gap-1">
        {!readOnly && (
          <button
            onClick={() => onViewModeChange('edit')}
            className={clsx(
              'p-1.5 rounded text-xs flex items-center gap-1 transition-colors',
              viewMode === 'edit'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
            title={t('common.editMode')}
            type="button"
            aria-label={t('common.editMode')}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('common.edit')}</span>
          </button>
        )}
        {!readOnly && (
          <button
            onClick={() => onViewModeChange('split')}
            className={clsx(
              'p-1.5 rounded text-xs flex items-center gap-1 transition-colors',
              viewMode === 'split'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
            title="分屏模式"
            type="button"
            aria-label="分屏模式"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">分屏</span>
          </button>
        )}
        <button
          onClick={() => onViewModeChange(renderHtml ? 'html' : 'preview')}
          className={clsx(
            'p-1.5 rounded text-xs flex items-center gap-1 transition-colors',
            (viewMode === 'preview' || viewMode === 'html')
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
          )}
          title={t('common.preview')}
          type="button"
          aria-label={t('common.preview')}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('common.preview')}</span>
        </button>
      </div>
    </div>
  );
}

export default memo(MarkdownToolbar);
