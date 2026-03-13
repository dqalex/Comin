'use client';

import { useRef, useState, useCallback, memo } from 'react';
import type { ChatAttachment } from '@/types';
import { THINKING_LEVELS, type ThinkingLevel } from './chat-utils';
import {
  X, Send, Loader2, Square, Sparkles,
} from 'lucide-react';

interface ChatInputAreaProps {
  /** 发送消息回调 */
  onSend: (content: string, attachments: ChatAttachment[], thinkingLevel: ThinkingLevel) => void;
  /** 是否正在发送 */
  sending: boolean;
  /** 当前运行信息（有值时显示中止按钮） */
  currentRun?: { sessionKey: string; runId: string } | null;
  /** 中止回调 */
  onAbort?: () => void;
  /** 输入框 placeholder */
  placeholder?: string;
  /** 是否显示 thinking 选择器 */
  showThinking?: boolean;
  /** 是否支持附件 */
  showAttachments?: boolean;
  /** 消息队列 */
  queue?: { id: string; text: string; attachments: ChatAttachment[] }[];
  /** 移除队列项 */
  onRemoveQueueItem?: (id: string) => void;
  /** 错误消息 */
  errorMessage?: string | null;
  /** 清除错误消息 */
  onClearError?: () => void;
}

function ChatInputArea({
  onSend,
  sending,
  currentRun,
  onAbort,
  placeholder,
  showThinking = false,
  showAttachments = true,
  queue,
  onRemoveQueueItem,
  errorMessage,
  onClearError,
}: ChatInputAreaProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('medium');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  // 生成附件 ID
  const generateAttachmentId = useCallback(() => {
    return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  // 粘贴图片处理
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        imageItems.push(item);
      }
    }
    if (imageItems.length === 0) return;

    e.preventDefault();
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const dataUrl = reader.result as string;
        const newAttachment: ChatAttachment = {
          id: generateAttachmentId(),
          dataUrl,
          mimeType: file.type,
        };
        setAttachments(prev => [...prev, newAttachment]);
      });
      reader.readAsDataURL(file);
    }
  }, [generateAttachmentId]);

  // 移除附件
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // 发送
  const handleSend = useCallback(() => {
    const content = (inputRef.current?.value ?? '').trim();
    if (!content && attachments.length === 0) return;

    onSend(content, [...attachments], thinkingLevel);

    // 清空输入
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
    }
    setAttachments([]);
  }, [attachments, thinkingLevel, onSend]);

  // Enter 发送
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 自动调整高度
  const handleInput = useCallback((e: React.FormEvent) => {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const defaultPlaceholder = attachments.length > 0
    ? '添加消息或粘贴更多图片...'
    : '输入消息 (↩ 发送, Shift+↩ 换行, 可粘贴图片)';

  return (
    <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
      {/* 错误提示 */}
      {errorMessage && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 flex items-center justify-between">
          <span className="text-xs text-red-600 dark:text-red-400">{errorMessage}</span>
          <button onClick={onClearError} className="text-red-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Thinking Level */}
      {showThinking && (
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Thinking</span>
          <select
            value={thinkingLevel}
            onChange={e => setThinkingLevel(e.target.value as ThinkingLevel)}
            className="text-[10px] px-1.5 py-0.5 rounded border-none outline-none cursor-pointer"
            style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
          >
            {THINKING_LEVELS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      )}

      {/* 附件预览 */}
      {showAttachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map(att => (
            <div key={att.id} className="relative group">
              <img
                src={att.dataUrl}
                alt="附件预览"
                className="h-16 w-16 object-cover rounded-lg border"
                style={{ borderColor: 'var(--border)' }}
              />
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 队列显示 */}
      {queue && queue.length > 0 && (
        <div className="mb-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-1 mb-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>队列 ({queue.length})</span>
          </div>
          <div className="space-y-1">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center gap-2 justify-between">
                <span className="truncate flex-1">
                  {item.text || (item.attachments.length > 0 ? `图片 (${item.attachments.length})` : '')}
                </span>
                <button
                  onClick={() => onRemoveQueueItem?.(item.id)}
                  className="text-red-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 输入行 */}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          onKeyDown={handleKeyDown}
          onPaste={showAttachments ? handlePaste : undefined}
          onInput={handleInput}
          placeholder={placeholder || defaultPlaceholder}
          rows={1}
          className="flex-1 resize-none rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
          style={{
            background: 'var(--surface-hover)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            maxHeight: '120px',
          }}
        />
        {/* 中止 / 发送按钮 */}
        {sending && currentRun ? (
          <button
            onClick={onAbort}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors bg-red-500 hover:bg-red-600"
            title="中止"
          >
            <Square className="w-4 h-4 text-white" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ background: 'var(--ai)' }}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ChatInputArea);
