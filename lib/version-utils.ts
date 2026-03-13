/**
 * 版本号比较工具
 * 用于比较 Skill 版本号
 */

/**
 * 解析版本号为数字数组
 * 支持 semver 格式: "1.0.0", "v2.1.3", "3.0.0-beta" 等
 */
export function parseVersion(version: string): number[] {
  // 移除前缀 'v' 和后缀标识
  const cleaned = version.replace(/^v/i, '').split('-')[0].split('+')[0];
  
  const parts = cleaned.split('.').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  // 确保至少有 3 部分 [major, minor, patch]
  while (parts.length < 3) {
    parts.push(0);
  }
  
  return parts.slice(0, 3);
}

/**
 * 比较两个版本号
 * @returns 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  
  for (let i = 0; i < 3; i++) {
    if (aParts[i] > bParts[i]) return 1;
    if (aParts[i] < bParts[i]) return -1;
  }
  
  return 0;
}

/**
 * 检查版本 a 是否高于版本 b
 */
export function isVersionHigher(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}

/**
 * 检查版本 a 是否等于版本 b
 */
export function isVersionEqual(a: string, b: string): boolean {
  return compareVersions(a, b) === 0;
}

/**
 * 获取较高的版本号
 */
export function getHigherVersion(a: string, b: string): string {
  return isVersionHigher(a, b) ? a : b;
}

/**
 * 规范化版本号（确保格式一致）
 * 输出格式: "x.y.z"
 */
export function normalizeVersion(version: string): string {
  const parts = parseVersion(version);
  return parts.join('.');
}
