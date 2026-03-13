/**
 * Base58 ID 生成器
 * 
 * 相比 UUID (36字符)，Base58 编码的 ID 更短（约11字符）且更易读
 * Base58 去除了容易混淆的字符：0, O, I, l 以及 +, / 等特殊字符
 * 
 * 支持自动检测并转换旧的 UUID 格式 ID
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_LENGTH = BASE58_ALPHABET.length;

// UUID 格式正则：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const UUID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/**
 * 检测 ID 是否为旧格式 UUID
 */
export function isUuidFormat(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * 将 UUID 转换为 Base58 ID
 * 保持确定性：相同的 UUID 总是转换为相同的 Base58 ID
 */
export function uuidToBase58(uuid: string): string {
  // 移除连字符，得到 32 个十六进制字符
  const hex = uuid.replace(/-/g, '').toLowerCase();
  
  // 转换为字节数组 (16 字节)
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  
  return encodeBase58(bytes);
}

/**
 * 自动转换：如果是 UUID 格式则转换为 Base58，否则原样返回
 * 用于兼容旧数据
 */
export function normalizeId(id: string): string {
  if (isUuidFormat(id)) {
    return uuidToBase58(id);
  }
  return id;
}

/**
 * 批量规范化 ID（用于处理关联 ID）
 */
export function normalizeIds(ids: string[]): string[] {
  return ids.map(normalizeId);
}

/**
 * 将字节数组编码为 Base58 字符串
 */
function encodeBase58(bytes: Uint8Array): string {
  let result = '';
  
  // 将字节数组转换为大整数
  let num = BigInt(0);
  for (const byte of bytes) {
    num = (num << BigInt(8)) + BigInt(byte);
  }
  
  // 转换为 Base58
  while (num > 0) {
    const remainder = num % BigInt(BASE58_LENGTH);
    num = num / BigInt(BASE58_LENGTH);
    result = BASE58_ALPHABET[Number(remainder)] + result;
  }
  
  // 处理前导零
  for (const byte of bytes) {
    if (byte === 0) {
      result = BASE58_ALPHABET[0] + result;
    } else {
      break;
    }
  }
  
  return result;
}

/**
 * 生成基于时间的短 ID（8字节随机）
 * 返回约 11 个字符的 Base58 字符串
 */
export function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return encodeBase58(bytes);
}

/**
 * 生成带前缀的 ID
 * @param prefix 前缀，如 'doc', 'task', 'member' 等
 */
export function generateIdWithPrefix(prefix: string): string {
  return `${prefix}-${generateId()}`;
}

// 常用 ID 生成函数
export const generateDocId = () => generateId();
export const generateTaskId = () => generateId();
export const generateProjectId = () => generateId();
export const generateMemberId = () => generateId();
export const generateCommentId = () => generateId();
export const generateSessionId = () => generateIdWithPrefix('chat');
export const generateMessageId = () => generateIdWithPrefix('msg');
export const generateLogId = () => generateId();
export const generateCheckItemId = () => generateId();
export const generateDeliveryId = () => generateId();
export const generateScheduleId = () => generateId();
export const generateScheduleHistoryId = () => generateId();
export const generateStatusId = () => generateId();
export const generateMilestoneId = () => generateId();

export default generateId;
