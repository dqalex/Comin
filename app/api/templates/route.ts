import { NextRequest, NextResponse } from 'next/server';
import { listTemplates, getSystemInfoMarkdown } from '@/lib/template-engine';

// GET /api/templates - 列出所有模板 或 获取系统信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSystemInfo = searchParams.get('system_info') === 'true';

    const templates = listTemplates();

    if (includeSystemInfo) {
      const systemInfo = await getSystemInfoMarkdown();
      return NextResponse.json({ templates, systemInfo });
    }

    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}
