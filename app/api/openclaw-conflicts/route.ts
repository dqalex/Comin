import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawConflicts, openclawFiles } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

/**
 * GET /api/openclaw-conflicts
 * 获取冲突列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const fileId = searchParams.get('file_id');

    // 构建查询条件
    const conditions = [];
    if (status) {
      conditions.push(eq(openclawConflicts.status, status));
    }
    if (fileId) {
      conditions.push(eq(openclawConflicts.fileId, fileId));
    }

    // 查询数据
    const result = await db.select({
      conflict: openclawConflicts,
      file: openclawFiles,
    })
      .from(openclawConflicts)
      .leftJoin(openclawFiles, eq(openclawConflicts.fileId, openclawFiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(openclawConflicts.detectedAt));

    return NextResponse.json({
      data: result.map(r => ({
        ...r.conflict,
        filePath: r.file?.relativePath,
        fileTitle: r.file?.title,
      })),
    });
  } catch (error) {
    console.error('[API] GET /openclaw-conflicts error:', error);
    return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 });
  }
}
