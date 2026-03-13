/**
 * 定时全量同步调度器
 * 
 * 根据每个 workspace 的 syncInterval（分钟）配置，定时触发全量同步。
 * 与 chokidar 实时文件监听独立运行，确保即使文件监听遗漏也能通过定时全量同步补全。
 */

import { db } from '@/db';
import { openclawWorkspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 使用 globalThis 存储定时器，防止 HMR 重复创建
const SCHEDULER_KEY = '__teamclaw_auto_sync_timers__';

interface SchedulerTimer {
  timer: ReturnType<typeof setInterval>;
  intervalMinutes: number;
}

function getTimers(): Map<string, SchedulerTimer> {
  const g = globalThis as Record<string, unknown>;
  if (!g[SCHEDULER_KEY]) {
    g[SCHEDULER_KEY] = new Map();
  }
  return g[SCHEDULER_KEY] as Map<string, SchedulerTimer>;
}

/**
 * 为指定 workspace 启动定时全量同步
 */
export function startAutoSync(workspaceId: string, intervalMinutes: number): void {
  const timers = getTimers();

  // 如果已存在且间隔相同，跳过
  const existing = timers.get(workspaceId);
  if (existing && existing.intervalMinutes === intervalMinutes) {
    return;
  }

  // 如果已存在但间隔不同，先停止旧的
  if (existing) {
    clearInterval(existing.timer);
    timers.delete(workspaceId);
  }

  // 校验间隔范围：1-1440 分钟
  const safeInterval = Math.max(1, Math.min(1440, intervalMinutes));
  const intervalMs = safeInterval * 60 * 1000;

  const timer = setInterval(async () => {
    await executeFullSync(workspaceId);
  }, intervalMs);

  timers.set(workspaceId, { timer, intervalMinutes: safeInterval });
  console.log(`[AutoSync] 定时全量同步已启动: workspace=${workspaceId}, 间隔=${safeInterval}分钟`);
}

/**
 * 停止指定 workspace 的定时全量同步
 */
export function stopAutoSync(workspaceId: string): void {
  const timers = getTimers();
  const existing = timers.get(workspaceId);
  if (existing) {
    clearInterval(existing.timer);
    timers.delete(workspaceId);
    console.log(`[AutoSync] 定时全量同步已停止: workspace=${workspaceId}`);
  }
}

/**
 * 停止所有定时全量同步
 */
export function stopAllAutoSync(): void {
  const timers = getTimers();
  for (const [id, { timer }] of timers) {
    clearInterval(timer);
    console.log(`[AutoSync] 定时全量同步已停止: workspace=${id}`);
  }
  timers.clear();
}

/**
 * 更新指定 workspace 的同步间隔
 * 当用户在 UI 修改 syncInterval 时调用
 */
export function updateAutoSyncInterval(workspaceId: string, newIntervalMinutes: number): void {
  const timers = getTimers();
  const existing = timers.get(workspaceId);

  if (existing && existing.intervalMinutes === newIntervalMinutes) {
    return;
  }

  startAutoSync(workspaceId, newIntervalMinutes);
}

/**
 * 获取当前所有活跃的定时同步信息
 */
export function getAutoSyncStatus(): Array<{ workspaceId: string; intervalMinutes: number }> {
  const timers = getTimers();
  const result: Array<{ workspaceId: string; intervalMinutes: number }> = [];
  for (const [id, { intervalMinutes }] of timers) {
    result.push({ workspaceId: id, intervalMinutes });
  }
  return result;
}

/**
 * 启动所有已启用同步的 workspace 的定时全量同步
 */
export async function startAllAutoSync(): Promise<number> {
  try {
    const workspaces = await db.select().from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.syncEnabled, true));

    let started = 0;
    for (const ws of workspaces) {
      const interval = ws.syncInterval || 30;
      startAutoSync(ws.id, interval);
      started++;
    }

    return started;
  } catch (error) {
    console.error('[AutoSync] 启动全部定时同步失败:', error);
    return 0;
  }
}

/**
 * 执行单个 workspace 的全量同步
 * 通过内部 HTTP 调用 sync API，复用完整的同步逻辑
 */
async function executeFullSync(workspaceId: string): Promise<void> {
  try {
    // 检查 workspace 是否仍然启用同步
    const [workspace] = await db.select().from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, workspaceId));

    if (!workspace || !workspace.syncEnabled) {
      console.log(`[AutoSync] workspace ${workspaceId} 已禁用同步，跳过并停止定时器`);
      stopAutoSync(workspaceId);
      return;
    }

    console.log(`[AutoSync] 开始定时全量同步: ${workspace.name} (${workspaceId})`);

    // 通过内部 API 触发全量同步（定时同步启用 forceReparse 确保任务不遗漏）
    const port = process.env.PORT || 3000;
    const baseUrl = `http://localhost:${port}`;
    const res = await fetch(`${baseUrl}/api/openclaw-workspaces/${workspaceId}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': baseUrl,
      },
      body: JSON.stringify({ mode: 'full', forceReparse: true }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error(`[AutoSync] 定时全量同步失败: ${workspace.name}`, errBody);
      return;
    }

    const result = await res.json();
    const data = result.data || result;
    console.log(`[AutoSync] 定时全量同步完成: ${workspace.name}`, {
      synced: data.synced,
      created: data.created,
      updated: data.updated,
    });
  } catch (error) {
    console.error(`[AutoSync] 定时全量同步异常: workspace=${workspaceId}`, error);

    // 记录错误到数据库
    try {
      await db.update(openclawWorkspaces)
        .set({ lastError: `Auto-sync failed: ${error instanceof Error ? error.message : 'Unknown error'}` })
        .where(eq(openclawWorkspaces.id, workspaceId));
    } catch {
      // 忽略记录失败
    }
  }
}
