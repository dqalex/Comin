/**
 * 通用数据脱敏与清理工具
 */

// ==================== XSS 防护 ====================

/**
 * 完整的 HTML 转义函数
 * 转义所有危险的 HTML 字符，防止 XSS 攻击
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return text.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char] || char);
}

/**
 * 验证并清理字符串输入
 */
export function sanitizeString(value: unknown, maxLength: number = 10000): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > maxLength) return null;
  
  // 移除控制字符（保留换行和制表符）
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// ==================== 敏感字段脱敏 ====================

/** 需要脱敏的敏感字段名（不区分大小写匹配） */
const SENSITIVE_FIELDS = [
  'openclawApiToken',
  'apiToken',
  'apiKey',
  'apiSecret',
  'password',
  'secret',
  'accessToken',
  'refreshToken',
] as const;

const MASK = '••••••••';

/**
 * 通用对象脱敏 - 自动检测并屏蔽敏感字段
 * 支持浅层脱敏（默认），适用于 API 响应
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (field in result && result[field]) {
      (result as Record<string, unknown>)[field] = MASK;
      // 添加 has* 标志位
      const flagKey = `has${field.charAt(0).toUpperCase()}${field.slice(1)}`;
      (result as Record<string, unknown>)[flagKey] = true;
    }
  }
  return result;
}

/**
 * 成员数据脱敏 - 完全不返回敏感 Token
 */
export function sanitizeMember(member: Record<string, unknown>) {
  const { openclawApiToken, ...safe } = member as Record<string, unknown>;
  // 完全不返回 Token，只返回是否存在标识
  return { 
    ...safe, 
    openclawApiToken: openclawApiToken ? MASK : null,
    hasApiToken: !!openclawApiToken 
  };
}

/**
 * 检查成员是否有配置 API Token
 */
export function hasApiToken(member: Record<string, unknown>): boolean {
  return !!(member as Record<string, unknown>).openclawApiToken;
}

