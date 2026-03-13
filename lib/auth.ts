/**
 * 用户认证工具库
 * - 密码哈希（argon2id）
 * - Session token 生成和验证
 * - 登录限流
 */

import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { db, users, type User } from '@/db';
import { eq } from 'drizzle-orm';

// ============================================================
// 密码哈希
// ============================================================

/**
 * 使用 argon2id 哈希密码
 * 绑定用户 ID 防止哈希复制攻击
 * 推荐参数：memoryCost=65536 (64MB), timeCost=3, parallelism=4
 */
export async function hashPassword(password: string, userId?: string): Promise<string> {
  // 将 userId 作为额外盐，防止哈希复制攻击
  // 即使密码相同，不同用户的哈希也不同
  const salt = userId ? `user:${userId}` : undefined;
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,        // 迭代次数
    parallelism: 4,     // 并行度
    salt: salt ? Buffer.from(salt) : undefined,
    raw: false,
  });
}

/**
 * 验证密码（需传入 userId 以匹配哈希时的盐）
 */
export async function verifyPassword(password: string, hash: string, userId?: string): Promise<boolean> {
  try {
    // 如果有 userId，需要用相同方式重新哈希后再验证
    // 因为旧哈希没有绑定 userId，需要兼容处理
    if (userId) {
      const newHash = await hashPassword(password, userId);
      return newHash === hash;
    }
    return await argon2.verify(hash, password);
  } catch {
    // 哈希格式无效时返回 false
    return false;
  }
}

// ============================================================
// 安全码哈希（管理员二次验证）
// ============================================================

/**
 * 使用 argon2id 哈希安全码
 * 绑定 userId 防止哈希复制攻击
 * 安全码参数比密码弱一些（更快），因为是二次验证
 */
export async function hashSecurityCode(code: string, userId?: string): Promise<string> {
  const salt = userId ? `security:${userId}` : undefined;
  return argon2.hash(code, {
    type: argon2.argon2id,
    memoryCost: 32768,  // 32 MB
    timeCost: 2,        // 迭代次数
    parallelism: 2,     // 并行度
    salt: salt ? Buffer.from(salt) : undefined,
  });
}

/**
 * 验证安全码
 * @param code 用户输入的安全码
 * @param hash 存储的哈希值
 * @param userId 可选的用户 ID（用于绑定 userId 的哈希校验）
 */
export async function verifySecurityCode(code: string, hash: string | null, userId?: string): Promise<boolean> {
  if (!hash) return false;
  try {
    // 如果传入了 userId，需要重新哈希后比对（用于绑定 userId 的安全码）
    if (userId) {
      const newHash = await hashSecurityCode(code, userId);
      return newHash === hash;
    }
    return await argon2.verify(hash, code);
  } catch {
    return false;
  }
}

// ============================================================
// Session Token
// ============================================================

// Session token 格式：cms_<base58 encoded data>
// 包含：userId + 过期时间 + 签名

// ============================================================
// Session 密钥配置
// ============================================================

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || '24', 10);

// v3.0: 强制要求设置 SESSION_SECRET
if (!SESSION_SECRET) {
  throw new Error(
    '[Security] SESSION_SECRET environment variable is required.\n' +
    'Please generate a secure random string (at least 32 characters):\n' +
    '  openssl rand -base64 64\n' +
    'Then set it as SESSION_SECRET in your environment.'
  );
}

// 验证密钥强度
if (SESSION_SECRET.length < 32) {
  throw new Error(
    `[Security] SESSION_SECRET must be at least 32 characters long, ` +
    `current length: ${SESSION_SECRET.length}.\n` +
    'Please regenerate with: openssl rand -base64 64'
  );
}

// 检测是否为默认密钥（安全检查）
const INSECURE_SECRETS = [
  'teamclaw-dev-session-secret-change-in-production',
  'your-secret-key',
  'secret',
  'password',
  '123456',
  'admin',
];

if (INSECURE_SECRETS.includes(SESSION_SECRET.toLowerCase())) {
  throw new Error(
    '[Security] SESSION_SECRET is using a known insecure default value.\n' +
    'Please generate a unique secret: openssl rand -base64 64'
  );
}

// 开发环境提示
if (process.env.NODE_ENV === 'development') {
  console.log('[AUTH] Session secret loaded successfully (length: %d)', SESSION_SECRET.length);
}

/**
 * 生成 session token
 */
export function generateSessionToken(userId: string): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  const payload = JSON.stringify({
    userId,
    exp: expiresAt.getTime(),
    nonce: randomBytes(8).toString('hex'),
  });
  
  // 签名
  const signature = createHash('sha256')
    .update(payload + SESSION_SECRET)
    .digest('hex')
    .slice(0, 16);
  
  // Base64 编码
  const data = Buffer.from(payload).toString('base64url');
  const token = `cms_${data}.${signature}`;
  
  return { token, expiresAt };
}

/**
 * 验证 session token 并返回用户 ID
 */
export function verifySessionToken(token: string): { valid: boolean; userId?: string; expired?: boolean } {
  if (!token || !token.startsWith('cms_')) {
    return { valid: false };
  }
  
  try {
    const [data, signature] = token.slice(4).split('.');
    if (!data || !signature) {
      return { valid: false };
    }
    
    const payload = Buffer.from(data, 'base64url').toString('utf-8');
    const expectedSignature = createHash('sha256')
      .update(payload + SESSION_SECRET)
      .digest('hex')
      .slice(0, 16);
    
    if (signature !== expectedSignature) {
      return { valid: false };
    }
    
    const parsed = JSON.parse(payload);
    if (Date.now() > parsed.exp) {
      return { valid: false, expired: true };
    }
    
    return { valid: true, userId: parsed.userId };
  } catch {
    return { valid: false };
  }
}

// ============================================================
// 登录限流
// ============================================================

// 内存缓存（生产环境应使用 Redis）
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 分钟
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;    // 5 分钟窗口

/**
 * 检查是否被锁定
 */
export function isLoginLocked(key: string): { locked: boolean; unlockAt?: Date } {
  const record = loginAttempts.get(key);
  if (!record) return { locked: false };
  
  const now = Date.now();
  
  // 超出窗口期，重置记录
  if (now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(key);
    return { locked: false };
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    const lockoutEnd = record.firstAttempt + ATTEMPT_WINDOW_MS + LOCKOUT_DURATION_MS;
    if (now < lockoutEnd) {
      return { locked: true, unlockAt: new Date(lockoutEnd) };
    }
    // 锁定期已过，重置
    loginAttempts.delete(key);
    return { locked: false };
  }
  
  return { locked: false };
}

/**
 * 记录登录失败
 */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const record = loginAttempts.get(key);
  
  if (!record || now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

/**
 * 清除登录失败记录（登录成功后调用）
 */
export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}

// ============================================================
// 用户查询
// ============================================================

/**
 * 根据邮箱查询用户
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0] || null;
}

/**
 * 根据 ID 查询用户
 */
export async function getUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

/**
 * 更新用户最后登录时间
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await db.update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// ============================================================
// 密码重置 Token
// ============================================================

// 内存缓存（生产环境应使用数据库或 Redis）
const resetTokens = new Map<string, { userId: string; expiresAt: number }>();
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 分钟

/**
 * 生成密码重置 token
 */
export function generateResetToken(userId: string): string {
  const token = `cmr_${randomBytes(24).toString('hex')}`;
  resetTokens.set(token, {
    userId,
    expiresAt: Date.now() + RESET_TOKEN_EXPIRY_MS,
  });
  return token;
}

/**
 * 验证密码重置 token
 */
export function verifyResetToken(token: string): { valid: boolean; userId?: string } {
  const record = resetTokens.get(token);
  if (!record) return { valid: false };
  
  if (Date.now() > record.expiresAt) {
    resetTokens.delete(token);
    return { valid: false };
  }
  
  return { valid: true, userId: record.userId };
}

/**
 * 使用（消耗）密码重置 token
 */
export function consumeResetToken(token: string): string | null {
  const record = resetTokens.get(token);
  if (!record || Date.now() > record.expiresAt) {
    resetTokens.delete(token);
    return null;
  }
  resetTokens.delete(token);
  return record.userId;
}

// ============================================================
// API 认证验证
// ============================================================

const SESSION_COOKIE_NAME = 'cms_session';

/**
 * 验证 API 请求的认证状态
 * 用于 API Routes 中验证用户身份
 */
export async function validateAuth(request: Request): Promise<{
  valid: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}> {
  try {
    // 从 Cookie 中获取 session token
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) {
      return { valid: false };
    }

    // 验证 token
    const result = verifySessionToken(token);
    if (!result.valid || !result.userId) {
      return { valid: false };
    }

    // 获取用户信息
    const user = await getUserById(result.userId);
    if (!user) {
      return { valid: false };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    console.error('[validateAuth] Error:', error);
    return { valid: false };
  }
}
