/**
 * SOP 阶段状态配置
 * 
 * 集中管理所有 SOP 阶段状态的样式和 i18n 配置
 * 消除 SOPProgressBar 等组件中的重复定义
 */

/** 阶段状态类型 */
export type SOPStageStatus = 
  | 'pending' 
  | 'active' 
  | 'waiting_input' 
  | 'waiting_confirm' 
  | 'completed' 
  | 'skipped' 
  | 'failed';

/** 阶段状态样式配置 */
export interface StageStatusConfig {
  bg: string;
  text: string;
  dot: string;
  i18nKey: string;
}

/** 阶段状态完整配置映射 */
export const SOP_STAGE_CONFIG: Record<SOPStageStatus, StageStatusConfig> = {
  pending: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
    i18nKey: 'sop.stagePending',
  },
  active: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
    i18nKey: 'sop.stageActive',
  },
  waiting_input: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    i18nKey: 'sop.stageWaitingInput',
  },
  waiting_confirm: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    text: 'text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
    i18nKey: 'sop.stageWaitingConfirm',
  },
  completed: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    i18nKey: 'sop.stageCompleted',
  },
  skipped: {
    bg: 'bg-slate-50 dark:bg-slate-900',
    text: 'text-slate-400',
    dot: 'bg-slate-300',
    i18nKey: 'sop.stageSkipped',
  },
  failed: {
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    i18nKey: 'sop.stageFailed',
  },
};

/** 获取阶段状态配置 */
export function getStageConfig(status: string): StageStatusConfig {
  return SOP_STAGE_CONFIG[status as SOPStageStatus] || SOP_STAGE_CONFIG.pending;
}

/** 阶段状态颜色映射（向后兼容） */
export const STAGE_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pending: SOP_STAGE_CONFIG.pending,
  active: SOP_STAGE_CONFIG.active,
  waiting_input: SOP_STAGE_CONFIG.waiting_input,
  waiting_confirm: SOP_STAGE_CONFIG.waiting_confirm,
  completed: SOP_STAGE_CONFIG.completed,
  skipped: SOP_STAGE_CONFIG.skipped,
  failed: SOP_STAGE_CONFIG.failed,
};

/** 阶段状态 i18n key（向后兼容） */
export const STAGE_STATUS_KEYS: Record<string, string> = {
  pending: SOP_STAGE_CONFIG.pending.i18nKey,
  active: SOP_STAGE_CONFIG.active.i18nKey,
  waiting_input: SOP_STAGE_CONFIG.waiting_input.i18nKey,
  waiting_confirm: SOP_STAGE_CONFIG.waiting_confirm.i18nKey,
  completed: SOP_STAGE_CONFIG.completed.i18nKey,
  skipped: SOP_STAGE_CONFIG.skipped.i18nKey,
  failed: SOP_STAGE_CONFIG.failed.i18nKey,
};
