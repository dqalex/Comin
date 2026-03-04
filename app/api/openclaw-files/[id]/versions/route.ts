import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawVersions, openclawFiles } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/openclaw-files/[id]/versions
 * 获取版本历史
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10') || 10, 100);

    // 校验文件存在性
    const [file] = await db.select()
      .from(openclawFiles)
      .where(eq(openclawFiles.id, id));

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 查询版本历史
    const versions = await db.select()
      .from(openclawVersions)
      .where(eq(openclawVersions.fileId, id))
      .orderBy(desc(openclawVersions.version))
      .limit(limit);

    return NextResponse.json({ data: versions });
  } catch (error) {
    console.error('[API] GET /openclaw-files/[id]/versions error:', error);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}
