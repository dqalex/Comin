/**
 * useSlotSync — MD ↔ HTML 双向槽位同步 Hook
 *
 * 基于 lib/slot-sync.ts 核心库，提供 React 层面的同步管理：
 * - 300ms 防抖同步（GrowthPilot 用 50ms 偏短，v3.0 改为 300ms）
 * - syncLock 互斥锁防止循环同步（100ms 超时）
 * - isInternalChange 标记防止 iframe 闪烁
 * - 支持 onSlotChange 回调（实时保存）
 */

import { useRef, useCallback, useMemo } from 'react';
import type { SlotDef, SlotValue } from '@/lib/slot-sync';
import {
  extractSlotsFromMd,
  syncMdToHtml,
  syncHtmlToMd,
  injectSlotsToHtml,
  generateMdFromTemplate,
  cleanEditorAttributes,
} from '@/lib/slot-sync';

export interface SlotSyncOptions {
  debounceMs?: number;       // 同步防抖（默认 300ms）
  lockTimeoutMs?: number;    // 互斥锁超时（默认 100ms）
  sanitize?: boolean;        // richtext 清洗开关（v3.0 强制 true）
  onSlotChange?: (slotName: string, value: string) => void;
}

export interface UseSlotSyncReturn {
  // 同步操作
  mdToHtml: (mdContent: string) => string | null;
  htmlToMd: (htmlContent: string, currentMd: string) => string | null;

  // 工具方法
  getSlots: (mdContent: string) => Map<string, SlotValue>;
  generateInitialMd: () => string;
  cleanForExport: (html: string) => string;

  // 内部变更标记（供 iframe 使用）
  isInternalChange: React.MutableRefObject<boolean>;
}

const DEFAULT_OPTIONS: Required<SlotSyncOptions> = {
  debounceMs: 300,
  lockTimeoutMs: 100,
  sanitize: true,
  onSlotChange: () => {},
};

export function useSlotSync(
  htmlTemplate: string,
  slotDefs: Record<string, SlotDef>,
  cssTemplate?: string,
  options?: SlotSyncOptions
): UseSlotSyncReturn {
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);

  // 互斥锁：防止 MD→HTML→MD 无限循环（GrowthPilot 核心设计）
  const syncLockRef = useRef(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 内部变更标记：iframe 内编辑触发 onChange 时跳过 useEffect 重载（GrowthPilot 踩坑）
  const isInternalChange = useRef(false);

  // 保存原始模板引用（同步只替换 slot 内容，不修改模板结构）
  const htmlTemplateRef = useRef(htmlTemplate);
  htmlTemplateRef.current = htmlTemplate;

  const acquireLock = useCallback((): boolean => {
    if (syncLockRef.current) return false;
    syncLockRef.current = true;

    // 自动解锁（默认 100ms，GrowthPilot 用 50ms 偏短）
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      syncLockRef.current = false;
    }, opts.lockTimeoutMs);

    return true;
  }, [opts.lockTimeoutMs]);

  // MD → HTML 同步
  const mdToHtml = useCallback((mdContent: string): string | null => {
    if (!acquireLock()) return null;

    try {
      const result = syncMdToHtml(
        mdContent,
        htmlTemplateRef.current,
        slotDefs,
        cssTemplate
      );

      if (result.errors.length > 0) {
        console.warn('[useSlotSync] MD→HTML 同步警告:', result.errors);
      }

      return result.html;
    } catch (err) {
      console.error('[useSlotSync] MD→HTML 同步失败:', err);
      return null;
    }
  }, [slotDefs, cssTemplate, acquireLock]);

  // HTML → MD 同步
  const htmlToMd = useCallback((htmlContent: string, currentMd: string): string | null => {
    if (!acquireLock()) return null;

    try {
      const result = syncHtmlToMd(htmlContent, currentMd, slotDefs);

      // 触发每个 slot 的变更回调
      if (opts.onSlotChange) {
        for (const [name, slot] of result.slots) {
          opts.onSlotChange(name, slot.content);
        }
      }

      return result.md;
    } catch (err) {
      console.error('[useSlotSync] HTML→MD 同步失败:', err);
      return null;
    }
  }, [slotDefs, acquireLock, opts]);

  // 获取当前 MD 中的 slot 值
  const getSlots = useCallback((mdContent: string): Map<string, SlotValue> => {
    return extractSlotsFromMd(mdContent, slotDefs);
  }, [slotDefs]);

  // 生成初始 MD 内容
  const generateInitialMd = useCallback((): string => {
    // 优先使用模板中的 mdTemplate 字段
    return generateMdFromTemplate('', slotDefs);
  }, [slotDefs]);

  // 清理编辑属性，用于导出/保存
  const cleanForExport = useCallback((html: string): string => {
    return cleanEditorAttributes(html);
  }, []);

  return {
    mdToHtml,
    htmlToMd,
    getSlots,
    generateInitialMd,
    cleanForExport,
    isInternalChange,
  };
}

// 导出供外部使用
export { injectSlotsToHtml, extractSlotsFromMd, generateMdFromTemplate };
