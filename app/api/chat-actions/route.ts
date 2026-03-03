/**
 * Chat Actions 执行 API（内部使用）
 * 
 * POST /api/chat-actions
 * 执行 AI 回复中的 actions 指令
 * 由客户端 useChatStream hook 调用，支持上下文注入的批量 action 执行
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeActions, type Action } from '@/lib/chat-channel';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat-actions
 * 执行 AI 回复中的 actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actions, memberId } = body as { actions: Action[]; memberId?: string };

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json(
        { error: '无效的 actions 数据' },
        { status: 400 }
      );
    }

    // 使用新模块执行 actions
    const result = await executeActions(actions, {
      memberId,
    });

    return NextResponse.json({
      success: result.summary.failed === 0,
      message: `执行完成: ${result.summary.success} 成功, ${result.summary.failed} 失败`,
      results: result.results,
      summary: result.summary,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : '未知错误';
    console.error('[chat-actions] Error:', error);
    return NextResponse.json(
      { error: `执行失败: ${error}` },
      { status: 500 }
    );
  }
}
