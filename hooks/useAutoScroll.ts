'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * 自动滚动 hook
 * 
 * 统一管理消息列表的自动滚动行为：
 * - 新消息时自动滚到底部
 * - 首次大批量加载用 instant，增量新消息用 smooth
 * - 用户向上滚动时显示"滚到底部"按钮
 */
export function useAutoScroll(msgCount: number, secondaryCount?: number) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const prevCountRef = useRef(0);
  const prevSecondaryRef = useRef(0);

  // 消息数量变化时自动滚动
  useEffect(() => {
    const secondary = secondaryCount ?? 0;
    // 首次加载大量消息用 instant（避免缓慢滚动），增量新消息用 smooth
    const isInitialLoad =
      (msgCount > 1 && prevCountRef.current === 0) ||
      (secondary > 1 && prevSecondaryRef.current === 0);
    const behavior: ScrollBehavior = isInitialLoad ? 'instant' : 'smooth';
    prevCountRef.current = msgCount;
    prevSecondaryRef.current = secondary;

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, [msgCount, secondaryCount]);

  // 滚动检测
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 100);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return {
    messagesEndRef,
    scrollContainerRef,
    showScrollBtn,
    handleScroll,
    scrollToBottom,
  };
}
