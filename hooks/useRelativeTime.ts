import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 原生实现的相对时间格式化（替代 date-fns formatDistanceToNow）
 */
function formatDistanceNative(date: Date, language: string): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const absDiff = Math.abs(diff);
  const isFuture = diff < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const isZh = language === 'zh';

  let distance: string;
  if (seconds < 60) {
    distance = isZh ? '不到 1 分钟' : 'less than a minute';
  } else if (minutes < 60) {
    distance = isZh ? `${minutes} 分钟` : `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else if (hours < 24) {
    distance = isZh ? `${hours} 小时` : `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (days < 30) {
    distance = isZh ? `${days} 天` : `${days} day${days > 1 ? 's' : ''}`;
  } else if (months < 12) {
    distance = isZh ? `${months} 个月` : `${months} month${months > 1 ? 's' : ''}`;
  } else {
    distance = isZh ? `${years} 年` : `${years} year${years > 1 ? 's' : ''}`;
  }

  if (isFuture) {
    return isZh ? `${distance}后` : `in ${distance}`;
  }
  return isZh ? `${distance}前` : `${distance} ago`;
}

/**
 * 获取相对时间文本（如 "3 分钟前"）
 * 自动根据当前语言环境选择 locale
 */
export function useRelativeTime(date: Date | number | null | undefined): string {
  const { i18n } = useTranslation();
  
  return useMemo(() => {
    if (!date) return '';
    try {
      return formatDistanceNative(new Date(date), i18n.language);
    } catch {
      return '';
    }
  }, [date, i18n.language]);
}

/**
 * 工具函数版本（非 hook，适用于回调/循环中）
 */
export function formatRelativeTime(date: Date | number | null | undefined, language: string = 'zh'): string {
  if (!date) return '';
  try {
    return formatDistanceNative(new Date(date), language);
  } catch {
    return '';
  }
}
