/**
 * .teamclaw-index 索引文件管理器
 * 
 * 在 workspace 目录下生成并维护 .teamclaw-index 文件，包含：
 * - 心跳状态（供 OpenClaw 判断 TeamClaw 是否在线）
 * - 文件索引（文件 → ID/hash/version 映射）
 */

import { db } from '@/db';
import { openclawWorkspaces, openclawFiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { OPENCLAW_CONFIG } from './config';
import { refreshClaudeMd } from './claude-md-generator';
import { refreshTaskList } from './task-list-generator';
import * as os from 'os';

// ============================================================
// 类型定义
// ============================================================

interface ComindIndex {
  version: string;
  workspace_id: string;
  heartbeat: {
    status: 'active' | 'inactive' | 'offline';
    last_heartbeat: string;
    interval: number;
  };
  instances: Record<string, {
    name: string;
    is_primary: boolean;
    last_heartbeat: string;
  }>;
  sync: {
    mode: string;
    last_sync: string;
  };
  files: Record<string, {
    id: string;
    hash: string;
    version: number;
  }>;
}

// ============================================================
// 索引文件管理
// ============================================================

const INDEX_FILE_NAME = '.teamclaw-index';
const INDEX_VERSION = '1.0.0';

/**
 * 生成实例 ID（基于 hostname 的稳定 ID）
 */
function getInstanceId(): string {
  const hostname = os.hostname().replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  return `inst_${hostname}`;
}

/**
 * 生成索引文件内容（YAML 格式）
 */
function serializeIndex(index: ComindIndex): string {
  const lines: string[] = [];

  lines.push(`version: ${index.version}`);
  lines.push(`workspace_id: ${index.workspace_id}`);
  lines.push('');

  // 心跳
  lines.push('heartbeat:');
  lines.push(`  status: ${index.heartbeat.status}`);
  lines.push(`  last_heartbeat: ${index.heartbeat.last_heartbeat}`);
  lines.push(`  interval: ${index.heartbeat.interval}`);
  lines.push('');

  // 实例
  lines.push('instances:');
  for (const [instId, inst] of Object.entries(index.instances)) {
    lines.push(`  ${instId}:`);
    lines.push(`    name: ${inst.name}`);
    lines.push(`    is_primary: ${inst.is_primary}`);
    lines.push(`    last_heartbeat: ${inst.last_heartbeat}`);
  }
  lines.push('');

  // 同步
  lines.push('sync:');
  lines.push(`  mode: ${index.sync.mode}`);
  lines.push(`  last_sync: ${index.sync.last_sync}`);
  lines.push('');

  // 文件索引
  lines.push('files:');
  for (const [path, file] of Object.entries(index.files)) {
    lines.push(`  ${path}:`);
    lines.push(`    id: ${file.id}`);
    lines.push(`    hash: ${file.hash}`);
    lines.push(`    version: ${file.version}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * 构建完整索引数据
 */
async function buildIndex(workspaceId: string): Promise<ComindIndex | null> {
  // 获取 workspace
  const [workspace] = await db.select().from(openclawWorkspaces)
    .where(eq(openclawWorkspaces.id, workspaceId));
  if (!workspace) return null;

  // 获取该 workspace 的所有文件
  const files = await db.select().from(openclawFiles)
    .where(eq(openclawFiles.workspaceId, workspaceId));

  const now = new Date().toISOString();
  const instanceId = getInstanceId();

  // 构建文件索引
  const fileIndex: ComindIndex['files'] = {};
  for (const f of files) {
    fileIndex[f.relativePath] = {
      id: f.id,
      hash: f.hash,
      version: f.version || 1,
    };
  }

  return {
    version: INDEX_VERSION,
    workspace_id: workspaceId,
    heartbeat: {
      status: 'active',
      last_heartbeat: now,
      interval: OPENCLAW_CONFIG.heartbeat.interval,
    },
    instances: {
      [instanceId]: {
        name: os.hostname(),
        is_primary: true,
        last_heartbeat: now,
      },
    },
    sync: {
      mode: workspace.syncEnabled ? 'auto_sync' : 'offline',
      last_sync: workspace.lastSyncAt ? new Date(workspace.lastSyncAt).toISOString() : now,
    },
    files: fileIndex,
  };
}

/**
 * 写入索引文件到 workspace 目录
 */
async function writeIndexFile(workspaceId: string): Promise<boolean> {
  try {
    const index = await buildIndex(workspaceId);
    if (!index) return false;

    // 获取 workspace 路径
    const [workspace] = await db.select().from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, workspaceId));
    if (!workspace || !existsSync(workspace.path)) return false;

    const indexPath = join(workspace.path, INDEX_FILE_NAME);
    const content = serializeIndex(index);
    writeFileSync(indexPath, content, 'utf-8');

    console.log(`[teamclaw-index] 索引文件已更新: ${indexPath}`);
    return true;
  } catch (error) {
    console.error('[teamclaw-index] 写入索引文件失败:', error);
    return false;
  }
}

/**
 * 仅更新心跳时间戳（轻量操作，不重建完整索引）
 */
async function updateHeartbeat(workspaceId: string): Promise<boolean> {
  try {
    const [workspace] = await db.select().from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, workspaceId));
    if (!workspace || !existsSync(workspace.path)) return false;

    const indexPath = join(workspace.path, INDEX_FILE_NAME);

    // 如果索引文件不存在，生成完整索引
    if (!existsSync(indexPath)) {
      return writeIndexFile(workspaceId);
    }

    // 读取现有内容并更新心跳
    let content = readFileSync(indexPath, 'utf-8');
    const now = new Date().toISOString();
    const instanceId = getInstanceId();

    // 更新 heartbeat.last_heartbeat
    content = content.replace(
      /^(heartbeat:\n\s+status:\s+)\S+/m,
      '$1active'
    );
    content = content.replace(
      /^(\s+last_heartbeat:\s+)\S+/m,
      `$1${now}`
    );

    // 更新实例心跳
    const instRegex = new RegExp(`(${instanceId}:[\\s\\S]*?last_heartbeat:\\s+)\\S+`);
    content = content.replace(instRegex, `$1${now}`);

    writeFileSync(indexPath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('[teamclaw-index] 心跳更新失败:', error);
    return false;
  }
}

// ============================================================
// 心跳定时器
// ============================================================

// 使用 globalThis 防止 HMR 多次创建
const HEARTBEAT_KEY = '__teamclaw_heartbeat_timers__';

function getHeartbeatTimers(): Map<string, ReturnType<typeof setInterval>> {
  const g = globalThis as Record<string, unknown>;
  if (!g[HEARTBEAT_KEY]) {
    g[HEARTBEAT_KEY] = new Map();
  }
  return g[HEARTBEAT_KEY] as Map<string, ReturnType<typeof setInterval>>;
}

/**
 * 为指定 workspace 启动心跳定时器
 */
export function startHeartbeat(workspaceId: string): void {
  const timers = getHeartbeatTimers();

  // 避免重复启动
  if (timers.has(workspaceId)) return;

  const intervalMs = OPENCLAW_CONFIG.heartbeat.interval * 1000;

  // 立即写一次完整索引 + CLAUDE.md + 任务列表
  writeIndexFile(workspaceId).catch(err => {
    console.error(`[teamclaw-index] 初始索引写入失败 (${workspaceId}):`, err);
  });
  refreshClaudeMd(workspaceId).catch(err => {
    console.error(`[teamclaw-index] 初始 CLAUDE.md 生成失败 (${workspaceId}):`, err);
  });
  refreshTaskList(workspaceId).catch(err => {
    console.error(`[teamclaw-index] 初始任务列表生成失败 (${workspaceId}):`, err);
  });

  // 定时更新心跳 + 任务列表
  const timer = setInterval(() => {
    updateHeartbeat(workspaceId).catch(err => {
      console.error(`[teamclaw-index] 心跳更新失败 (${workspaceId}):`, err);
    });
    // 任务列表内部有 hash 对比，无变更不会写磁盘
    refreshTaskList(workspaceId).catch(err => {
      console.error(`[teamclaw-index] 任务列表刷新失败 (${workspaceId}):`, err);
    });
  }, intervalMs);

  timers.set(workspaceId, timer);
  console.log(`[teamclaw-index] 心跳已启动 (${workspaceId})，间隔 ${OPENCLAW_CONFIG.heartbeat.interval}s`);
}

/**
 * 停止指定 workspace 的心跳定时器
 */
export function stopHeartbeat(workspaceId: string): void {
  const timers = getHeartbeatTimers();
  const timer = timers.get(workspaceId);
  if (timer) {
    clearInterval(timer);
    timers.delete(workspaceId);
    console.log(`[teamclaw-index] 心跳已停止 (${workspaceId})`);
  }
}

/**
 * 停止所有心跳
 */
export function stopAllHeartbeats(): void {
  const timers = getHeartbeatTimers();
  for (const [id, timer] of timers) {
    clearInterval(timer);
    console.log(`[teamclaw-index] 心跳已停止 (${id})`);
  }
  timers.clear();
}

// ============================================================
// 导出
// ============================================================

/**
 * 同步完成后刷新索引文件（完整重建）
 */
export async function refreshIndex(workspaceId: string): Promise<boolean> {
  return writeIndexFile(workspaceId);
}

/**
 * 启动所有已启用同步的 workspace 心跳
 */
export async function startAllHeartbeats(): Promise<number> {
  try {
    const workspaces = await db.select().from(openclawWorkspaces);
    let started = 0;

    for (const ws of workspaces) {
      if (ws.syncEnabled && existsSync(ws.path)) {
        startHeartbeat(ws.id);
        started++;
      }
    }

    return started;
  } catch (error) {
    console.error('[teamclaw-index] 启动心跳失败:', error);
    return 0;
  }
}
