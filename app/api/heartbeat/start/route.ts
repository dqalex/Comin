/**
 * POST /api/heartbeat/start
 * 
 * 启动所有 workspace 的 .teamclaw-index 心跳定时器 + 文件监听器 + 定时全量同步。
 * 前端在 DataProvider 初始化时调用一次即可。
 * 幂等操作：重复调用不会创建多个定时器。
 */

import { NextResponse } from 'next/server';
import { startAllHeartbeats } from '@/lib/openclaw/index-manager';
import { getWatcher } from '@/lib/openclaw/watcher';
import { SyncManager } from '@/lib/openclaw/sync-manager';
import { startAllAutoSync } from '@/lib/openclaw/auto-sync-scheduler';
import { db } from '@/db';
import { openclawWorkspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// 使用 globalThis 标记避免 HMR 重复启动
const INIT_KEY = '__teamclaw_heartbeat_initialized__';
const WATCHER_KEY = '__teamclaw_watcher_initialized__';
const AUTO_SYNC_KEY = '__teamclaw_auto_sync_initialized__';

let initPromise: Promise<number> | null = null;

export async function POST() {
  try {
    const g = globalThis as Record<string, unknown>;

    // 幂等：只启动一次
    if (g[INIT_KEY]) {
      return NextResponse.json({ started: 0, message: 'Already initialized' });
    }

    // 防止并发多次调用
    if (!initPromise) {
      initPromise = initializeAll();
    }

    const started = await initPromise;
    g[INIT_KEY] = true;

    return NextResponse.json({ started, message: `Heartbeat, watcher and auto-sync started for ${started} workspace(s)` });
  } catch (error) {
    console.error('[heartbeat] 启动失败:', error);
    return NextResponse.json(
      { error: 'Failed to start heartbeat' },
      { status: 500 }
    );
  }
}

/**
 * 初始化心跳 + 文件监听 + 定时全量同步
 */
async function initializeAll(): Promise<number> {
  // 1. 启动心跳
  const heartbeatCount = await startAllHeartbeats();

  // 2. 启动文件监听
  const watcherCount = await startFileWatchers();

  // 3. 启动定时全量同步
  const autoSyncCount = await startAutoSyncSchedulers();

  console.log(`[heartbeat] 初始化完成: ${heartbeatCount} 个心跳, ${watcherCount} 个文件监听, ${autoSyncCount} 个定时同步`);

  return heartbeatCount;
}

/**
 * 启动所有 watchEnabled 的 workspace 文件监听
 */
async function startFileWatchers(): Promise<number> {
  const g = globalThis as Record<string, unknown>;

  // 防止重复初始化
  if (g[WATCHER_KEY]) {
    return 0;
  }

  // 查询所有启用监听的 workspace
  const workspaces = await db.select()
    .from(openclawWorkspaces)
    .where(eq(openclawWorkspaces.watchEnabled, true));

  if (workspaces.length === 0) {
    return 0;
  }

  // 创建 SyncManager 实例
  const syncManager = new SyncManager();

  // 创建 Watcher 实例
  const watcher = getWatcher(async (workspaceId, filePath, eventType) => {
    try {
      console.log(`[Watcher] 文件变更: ${filePath} (${eventType})`);
      await syncManager.syncSingleFile(workspaceId, filePath, eventType);
    } catch (error) {
      console.error(`[Watcher] 同步失败: ${filePath}`, error);
    }
  });

  if (!watcher) {
    console.warn('[heartbeat] Watcher 初始化失败（可能是浏览器环境）');
    return 0;
  }

  // 启动所有 workspace 的监听
  let count = 0;
  for (const workspace of workspaces) {
    const started = watcher.start(workspace);
    if (started) {
      count++;
      console.log(`[Watcher] 已启动监听: ${workspace.name} (${workspace.path})`);
    }
  }

  g[WATCHER_KEY] = true;

  return count;
}

/**
 * 启动所有 syncEnabled 的 workspace 定时全量同步
 */
async function startAutoSyncSchedulers(): Promise<number> {
  const g = globalThis as Record<string, unknown>;

  if (g[AUTO_SYNC_KEY]) {
    return 0;
  }

  const count = await startAllAutoSync();
  g[AUTO_SYNC_KEY] = true;

  return count;
}
