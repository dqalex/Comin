/**
 * 安全工具函数集合
 * 
 * 核心职责：SSRF 防护 + Token 加密存储
 * XSS 防护 → lib/sanitize.ts
 * 输入验证 → lib/validators.ts
 */

// 向后兼容的 re-export（避免修改所有引用方）
export { escapeHtml, sanitizeString } from './sanitize';
export { isValidId, isValidUrl, REQUEST_LIMITS, validateRequestBodySize } from './validators';

// ==================== SSRF 安全配置 ====================

/** SSRF 安全配置 */
export interface SSRFConfig {
  /** 是否允许外网访问（默认 false，仅允许本地） */
  allowExternalAccess: boolean;
  /** 是否启用 DNS 重绑定防护（默认 true） */
  enableDnsRebindingProtection: boolean;
  /** 允许的私有 IP 段（用于自定义允许内网访问） */
  allowedPrivateRanges?: string[];
}

/** 默认 SSRF 配置：严格本地访问 */
export const DEFAULT_SSRF_CONFIG: SSRFConfig = {
  allowExternalAccess: false,
  enableDnsRebindingProtection: true,
};

/**
 * 检查 IP 是否为私有地址（用于 DNS 重绑定防护）
 */
export function isPrivateIp(ip: string): boolean {
  const privateIpPatterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^169\.254\.\d{1,3}\.\d{1,3}$/,
    /^0\.0\.0\.\d{1,3}$/,
  ];

  for (const pattern of privateIpPatterns) {
    if (pattern.test(ip)) return true;
  }

  const lower = ip.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd') ||
      lower.startsWith('fe80') || lower === '::' || lower === '::1') {
    return true;
  }

  return false;
}

/**
 * 检查 IP 是否为本地回环地址
 */
export function isLoopbackIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  if (lower === '::1' || lower === '[::1]') return true;
  return false;
}

/**
 * DNS 解析并验证 IP 地址（用于 DNS 重绑定防护）
 */
export async function resolveAndValidateDns(
  hostname: string,
  config: SSRFConfig = DEFAULT_SSRF_CONFIG
): Promise<{ ips: string[]; error?: string }> {
  if (!config.enableDnsRebindingProtection) {
    return { ips: [] };
  }

  try {
    const dns = await import('dns');
    const { promisify } = await import('util');
    const lookup = promisify(dns.lookup);
    const result = await lookup(hostname, { all: true });
    const ips = result.map(r => r.address);

    if (config.allowExternalAccess) {
      return { ips };
    }

    const privateIps = ips.filter(isPrivateIp);
    if (privateIps.length > 0 && privateIps.length === ips.length) {
      const loopbackIps = ips.filter(isLoopbackIp);
      if (loopbackIps.length > 0) {
        return { ips: loopbackIps };
      }
      return { ips: [], error: 'DNS 解析到私有 IP 地址，可能存在 DNS 重绑定攻击风险' };
    }

    return { ips };
  } catch (e) {
    return { ips: [], error: `DNS 解析失败: ${e instanceof Error ? e.message : '未知错误'}` };
  }
}

/**
 * URL 安全检查 - 防止 SSRF 攻击
 */
export function isAllowedLocalUrl(
  urlString: string,
  config: SSRFConfig = DEFAULT_SSRF_CONFIG
): { allowed: boolean; error?: string; hostname?: string; port?: number } {
  try {
    const url = new URL(urlString);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { allowed: false, error: '仅支持 http/https 协议' };
    }

    const hostname = url.hostname.toLowerCase();
    const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);

    const allowedLocalHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];

    if (allowedLocalHosts.includes(hostname)) {
      return { allowed: true, hostname, port };
    }

    if (hostname === '0.0.0.0' || hostname === '[::]' || hostname === '::') {
      return { allowed: false, error: '不允许使用 0.0.0.0 地址（存在安全风险，请使用 localhost 或 127.0.0.1）' };
    }

    if (config.allowExternalAccess) {
      return { allowed: true, hostname, port };
    }

    const privateIpPatterns = [
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
      /^192\.168\.\d{1,3}\.\d{1,3}$/,
      /^169\.254\.\d{1,3}\.\d{1,3}$/,
    ];

    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        return { allowed: false, error: '不允许访问私有网络地址（可在设置中开启外网访问）' };
      }
    }

    if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80')) {
      return { allowed: false, error: '不允许访问私有网络地址（可在设置中开启外网访问）' };
    }

    const ipOnlyPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipOnlyPattern.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      if (parts[0] === 127) {
        return { allowed: true, hostname, port };
      }
      return { allowed: false, error: '仅允许访问本地地址（127.0.0.1 或 localhost）' };
    }

    return { allowed: true, hostname, port };
  } catch {
    return { allowed: false, error: 'URL 格式无效' };
  }
}

/**
 * 完整的 SSRF 检查（包含 DNS 重绑定防护）
 */
export async function ssrfCheck(
  urlString: string,
  config: SSRFConfig = DEFAULT_SSRF_CONFIG
): Promise<{ allowed: boolean; error?: string; resolvedIps?: string[] }> {
  const urlCheck = isAllowedLocalUrl(urlString, config);
  if (!urlCheck.allowed) {
    return { allowed: false, error: urlCheck.error };
  }

  if (config.allowExternalAccess) {
    return { allowed: true };
  }

  const ipOnlyPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (urlCheck.hostname && ipOnlyPattern.test(urlCheck.hostname)) {
    return { allowed: true };
  }

  const localHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
  if (urlCheck.hostname && localHosts.includes(urlCheck.hostname)) {
    return { allowed: true };
  }

  if (config.enableDnsRebindingProtection && urlCheck.hostname) {
    const dnsResult = await resolveAndValidateDns(urlCheck.hostname, config);
    if (dnsResult.error) {
      return { allowed: false, error: dnsResult.error };
    }
    return { allowed: true, resolvedIps: dnsResult.ips };
  }

  return { allowed: true };
}

// ==================== Token 加密存储 ====================

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function requireEncryptionKey(): void {
  if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('[Security] TOKEN_ENCRYPTION_KEY is required in production. Set this environment variable to encrypt sensitive tokens.');
  }
}

function deriveKey(key: string): Buffer {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * AES-256-GCM 加密 Token
 */
export function encryptToken(plaintext: string): string {
  requireEncryptionKey();
  
  if (!ENCRYPTION_KEY) {
    return plaintext;
  }
  
  const crypto = require('crypto');
  const key = deriveKey(ENCRYPTION_KEY);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return `enc:${combined.toString('base64')}`;
}

/**
 * AES-256-GCM 解密 Token
 */
export function decryptToken(encrypted: string): string {
  requireEncryptionKey();
  if (!ENCRYPTION_KEY) {
    return encrypted;
  }
  
  try {
    if (encrypted.startsWith('enc:')) {
      const crypto = require('crypto');
      const key = deriveKey(ENCRYPTION_KEY);
      const combined = Buffer.from(encrypted.slice(4), 'base64');
      
      if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        return encrypted;
      }
      
      const iv = combined.subarray(0, IV_LENGTH);
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    }
    
    // Legacy: XOR-based decryption for backward compatibility
    const decoded = Buffer.from(encrypted, 'base64').toString();
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      result += String.fromCharCode(charCode);
    }
    if (/^[\x20-\x7E]+$/.test(result)) {
      return result;
    }
    return encrypted;
  } catch {
    return encrypted;
  }
}

/**
 * 检查字符串是否已加密
 */
export function isEncrypted(value: string): boolean {
  if (!ENCRYPTION_KEY) return false;
  return value.startsWith('enc:');
}
