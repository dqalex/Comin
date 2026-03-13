import { NextRequest } from 'next/server';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

import { generateId } from '@/lib/id';
import {
  successResponse,
  errorResponse,
  ApiErrors,
} from '@/lib/api-route-factory';
import { listTemplates, getSystemInfoMarkdown } from '@/lib/template-engine';

// GET /api/templates - 列出所有模板 或 获取系统信息
export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || generateId();
  
  try {
    const { searchParams } = new URL(request.url);
    const includeSystemInfo = searchParams.get('system_info') === 'true';

    const templates = listTemplates();

    if (includeSystemInfo) {
      const systemInfo = await getSystemInfoMarkdown();
      return successResponse({ templates, systemInfo });
    }

    return successResponse({ templates });
  } catch (error) {
    console.error(`[GET /api/templates] ${requestId}:`, error);
    return errorResponse(ApiErrors.internal('Failed to list templates'), requestId);
  }
}
