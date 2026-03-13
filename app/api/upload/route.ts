/**
 * 文件上传 API 示例
 * 
 * POST /api/upload
 * 支持上传图片、文档等文件类型
 * 
 * 安全特性：
 * - MIME 类型白名单验证
 * - 文件扩展名验证
 * - 文件大小限制
 * - 文件名消毒
 */

import { NextRequest, NextResponse } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import {
  validateFile,
  sanitizeFilename,
  generateSafeFilename,
  formatFileSize,
  ALLOWED_FILE_TYPES,
  DEFAULT_MAX_FILE_SIZE,
} from '@/lib/file-validator';
import { withAuth } from '@/lib/with-auth';

// 上传配置
const UPLOAD_CONFIG = {
  allowedTypes: ALLOWED_FILE_TYPES,
  maxSize: DEFAULT_MAX_FILE_SIZE, // 10MB
};

/**
 * POST /api/upload
 * 上传文件
 */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    // 解析 form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 验证文件
    const validation = validateFile(file, UPLOAD_CONFIG);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'File validation failed',
          details: validation.error,
          allowedTypes: ALLOWED_FILE_TYPES,
          maxSize: formatFileSize(DEFAULT_MAX_FILE_SIZE),
        },
        { status: 400 }
      );
    }

    // 文件名消毒
    const originalName = file.name;
    const safeName = sanitizeFilename(originalName);
    const storageName = generateSafeFilename(originalName, 'upload');

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const size = bytes.byteLength;

    // TODO: 保存文件到存储（本地/云存储）
    // 这里仅返回验证成功的信息
    
    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        originalName,
        safeName,
        storageName,
        mimeType: file.type,
        size: formatFileSize(size),
        sizeBytes: size,
      },
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/upload
 * 获取上传配置信息
 */
export async function GET() {
  return NextResponse.json({
    config: {
      allowedTypes: ALLOWED_FILE_TYPES,
      maxSize: DEFAULT_MAX_FILE_SIZE,
      maxSizeFormatted: formatFileSize(DEFAULT_MAX_FILE_SIZE),
    },
  });
}
