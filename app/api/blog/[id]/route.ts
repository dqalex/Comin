import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * GET /api/blog/[id]
 * 获取单个博客文章详情（公开访问，无需登录）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 查询博客类型的文档
    const doc = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, id),
        eq(documents.type, 'blog')
      ),
    });

    if (!doc) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    // 返回文档内容（公开信息）
    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      type: doc.type,
      projectTags: doc.projectTags,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
    });
  } catch (error) {
    console.error('Failed to fetch blog post:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog post' },
      { status: 500 }
    );
  }
}
