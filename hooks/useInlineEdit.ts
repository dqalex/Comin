/**
 * 内联编辑 Hook
 * 解决 Enter/Blur 双重提交问题
 * 
 * 使用场景：
 * - 文档标题编辑
 * - 任务名称编辑
 * - 成员名称编辑
 * - 任何内联输入框
 */

import { useRef, useCallback } from 'react';

export interface UseInlineEditOptions<T> {
  /** 保存回调 */
  onSave: (value: T) => Promise<void> | void;
  /** 保存前的值转换 */
  transform?: (value: string) => T;
  /** 保存成功回调 */
  onSuccess?: () => void;
  /** 保存失败回调 */
  onError?: (error: Error) => void;
}

export interface UseInlineEditReturn {
  /** 键盘事件处理器 */
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, value: string) => void;
  /** 失焦事件处理器 */
  handleBlur: (value: string) => void;
  /** 是否正在保存 */
  isSaving: React.MutableRefObject<boolean>;
}

/**
 * 内联编辑 Hook
 * 
 * @example
 * ```tsx
 * function EditableTitle({ title, onSave }) {
 *   const { handleKeyDown, handleBlur, isSaving } = useInlineEdit({
 *     onSave: (value) => onSave(value),
 *   });
 *   
 *   return (
 *     <input
 *       defaultValue={title}
 *       onKeyDown={(e) => handleKeyDown(e, e.currentTarget.value)}
 *       onBlur={(e) => handleBlur(e.target.value)}
 *       disabled={isSaving.current}
 *     />
 *   );
 * }
 * ```
 */
export function useInlineEdit<T = string>(
  options: UseInlineEditOptions<T>
): UseInlineEditReturn {
  const { onSave, transform, onSuccess, onError } = options;
  
  // 标记是否通过 Enter 键提交，防止 Blur 再次提交
  const submittedByEnterRef = useRef(false);
  // 标记是否正在保存，防止重复提交
  const isSavingRef = useRef(false);

  const doSave = useCallback(async (rawValue: string) => {
    // 防止重复保存
    if (isSavingRef.current) {
      return;
    }

    const value = transform ? transform(rawValue) : (rawValue as unknown as T);
    
    isSavingRef.current = true;
    try {
      await onSave(value);
      onSuccess?.();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, transform, onSuccess, onError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, value: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submittedByEnterRef.current = true;
        doSave(value);
      }
    },
    [doSave]
  );

  const handleBlur = useCallback(
    (value: string) => {
      // 如果是通过 Enter 提交的，跳过 Blur 保存
      if (submittedByEnterRef.current) {
        submittedByEnterRef.current = false;
        return;
      }
      doSave(value);
    },
    [doSave]
  );

  return {
    handleKeyDown,
    handleBlur,
    isSaving: isSavingRef,
  };
}

/**
 * 简化版内联编辑 Hook
 * 适用于简单的字符串编辑场景
 */
export function useInlineTextEdit(
  onSave: (value: string) => Promise<void> | void
): UseInlineEditReturn {
  return useInlineEdit({ onSave });
}
