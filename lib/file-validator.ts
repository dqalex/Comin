/**
 * 文件上传验证工具
 * 
 * 用于验证文件上传的类型、大小和安全性
 */

// 允许的 MIME 类型白名单
export const ALLOWED_FILE_TYPES = [
  // 图片
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  // 文档
  'application/pdf',
  'text/markdown',
  'text/plain',
  'text/html',
  'application/json',
  // 办公文档
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
] as const;

// 文件扩展名映射
export const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.json': 'application/json',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// MIME 类型到扩展名的反向映射
export const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'application/pdf': ['.pdf'],
  'text/markdown': ['.md'],
  'text/plain': ['.txt'],
  'text/html': ['.html'],
  'application/json': ['.json'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};

// 默认文件大小限制 (10MB)
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// 特定类型的文件大小限制
export const MAX_FILE_SIZE_BY_TYPE: Record<string, number> = {
  'image/jpeg': 5 * 1024 * 1024,      // 5MB
  'image/png': 5 * 1024 * 1024,       // 5MB
  'image/webp': 5 * 1024 * 1024,      // 5MB
  'image/gif': 10 * 1024 * 1024,      // 10MB
  'image/svg+xml': 2 * 1024 * 1024,   // 2MB
  'application/pdf': 20 * 1024 * 1024, // 20MB
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  extension?: string;
  size?: number;
}

export interface FileValidationOptions {
  allowedTypes?: readonly string[];
  maxSize?: number;
  allowedExtensions?: readonly string[];
}

/**
 * 从文件名中提取扩展名
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.slice(lastDotIndex).toLowerCase() : '';
}

/**
 * 从 MIME 类型获取推荐的扩展名
 */
export function getRecommendedExtension(mimeType: string): string | undefined {
  const extensions = MIME_TO_EXTENSIONS[mimeType];
  return extensions?.[0];
}

/**
 * 验证 MIME 类型是否在白名单中
 */
export function isValidMimeType(mimeType: string, allowedTypes?: readonly string[]): boolean {
  const types = allowedTypes || ALLOWED_FILE_TYPES;
  return types.includes(mimeType as any);
}

/**
 * 验证文件扩展名是否在白名单中
 */
export function isValidExtension(extension: string, allowedExtensions?: readonly string[]): boolean {
  const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  if (allowedExtensions) {
    return allowedExtensions.map(e => e.toLowerCase()).includes(ext);
  }
  return ext in EXTENSION_TO_MIME;
}

/**
 * 根据扩展名获取 MIME 类型
 */
export function getMimeTypeFromExtension(extension: string): string | undefined {
  const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  return EXTENSION_TO_MIME[ext];
}

/**
 * 验证文件大小
 */
export function isValidFileSize(size: number, mimeType?: string, maxSize?: number): boolean {
  const limit = maxSize || (mimeType && MAX_FILE_SIZE_BY_TYPE[mimeType]) || DEFAULT_MAX_FILE_SIZE;
  return size <= limit;
}

/**
 * 获取文件大小限制
 */
export function getMaxFileSize(mimeType?: string, customMaxSize?: number): number {
  if (customMaxSize) return customMaxSize;
  if (mimeType && MAX_FILE_SIZE_BY_TYPE[mimeType]) {
    return MAX_FILE_SIZE_BY_TYPE[mimeType];
  }
  return DEFAULT_MAX_FILE_SIZE;
}

/**
 * 格式化文件大小为人类可读格式
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 消毒文件名（移除危险字符）
 */
export function sanitizeFilename(filename: string): string {
  // 移除路径分隔符和危险字符
  return filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .trim();
}

/**
 * 生成安全的文件名
 */
export function generateSafeFilename(originalName: string, prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = getFileExtension(originalName);
  const safePrefix = prefix ? `${prefix}_` : '';
  return `${safePrefix}${timestamp}_${random}${extension}`;
}

/**
 * 验证文件（完整验证）
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  const { allowedTypes, maxSize, allowedExtensions } = options;

  // 获取文件信息
  const mimeType = file.type;
  const extension = getFileExtension(file.name);
  const size = file.size;

  // 验证 MIME 类型
  if (!isValidMimeType(mimeType, allowedTypes)) {
    // 尝试根据扩展名验证
    const inferredMimeType = getMimeTypeFromExtension(extension);
    if (!inferredMimeType || !isValidMimeType(inferredMimeType, allowedTypes)) {
      return {
        valid: false,
        error: `File type "${mimeType || extension}" is not allowed`,
        mimeType,
        extension,
        size,
      };
    }
  }

  // 验证扩展名
  if (allowedExtensions && !isValidExtension(extension, allowedExtensions)) {
    return {
      valid: false,
      error: `File extension "${extension}" is not allowed`,
      mimeType,
      extension,
      size,
    };
  }

  // 验证文件大小
  if (!isValidFileSize(size, mimeType, maxSize)) {
    const limit = getMaxFileSize(mimeType, maxSize);
    return {
      valid: false,
      error: `File size (${formatFileSize(size)}) exceeds limit (${formatFileSize(limit)})`,
      mimeType,
      extension,
      size,
    };
  }

  return {
    valid: true,
    mimeType,
    extension,
    size,
  };
}

/**
 * 验证多个文件
 */
export function validateFiles(
  files: File[],
  options: FileValidationOptions = {}
): { valid: FileValidationResult[]; invalid: FileValidationResult[] } {
  const valid: FileValidationResult[] = [];
  const invalid: FileValidationResult[] = [];

  for (const file of files) {
    const result = validateFile(file, options);
    if (result.valid) {
      valid.push(result);
    } else {
      invalid.push(result);
    }
  }

  return { valid, invalid };
}

/**
 * 创建文件验证中间件（用于 API 路由）
 */
export function createFileValidator(options: FileValidationOptions = {}) {
  return async (request: Request): Promise<{ valid: boolean; file?: File; error?: string }> => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return { valid: false, error: 'No file provided' };
      }

      const result = validateFile(file, options);
      
      if (!result.valid) {
        return { valid: false, error: result.error };
      }

      return { valid: true, file };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid form data' 
      };
    }
  };
}
