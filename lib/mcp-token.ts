/**
 * MCP Token 加密工具
 * - Token 格式：cmu_<random 24 bytes hex>
 * - 存储：AES-256-GCM 加密 + SHA-256 哈希（快速查找）
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// 加密密钥（生产环境应使用环境变量）
const TOKEN_ENCRYPTION_KEY = process.env.MCP_TOKEN_KEY || 
  createHash('sha256').update('teamclaw-dev-mcp-token-key-change-in-production').digest();

// Token 前缀：cmu = TeamClaw User
const TOKEN_PREFIX = 'cmu_';

/**
 * 生成新的 MCP Token
 */
export function generateMcpToken(): string {
  const randomPart = randomBytes(24).toString('hex');
  return `${TOKEN_PREFIX}${randomPart}`;
}

/**
 * 计算 Token 的 SHA-256 哈希（用于数据库快速查找）
 */
export function hashMcpToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * AES-256-GCM 加密 Token
 */
export function encryptMcpToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', TOKEN_ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // 格式：iv(24 hex) + authTag(32 hex) + encrypted
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

/**
 * AES-256-GCM 解密 Token
 */
export function decryptMcpToken(encryptedData: string): string | null {
  try {
    const iv = Buffer.from(encryptedData.slice(0, 24), 'hex');
    const authTag = Buffer.from(encryptedData.slice(24, 56), 'hex');
    const encrypted = encryptedData.slice(56);
    
    const decipher = createDecipheriv('aes-256-gcm', TOKEN_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * 验证 Token 格式
 */
export function isValidMcpTokenFormat(token: string): boolean {
  // cmu_ + 48 hex chars = 52 chars total
  return token.startsWith(TOKEN_PREFIX) && 
         token.length === 52 && 
         /^cmu_[0-9a-f]{48}$/.test(token);
}

/**
 * Token 脱敏显示（只显示前后各 4 个字符）
 */
export function maskMcpToken(token: string): string {
  if (token.length <= 12) return '****';
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}
