# CoMind OpenClaw 同步功能设计

**版本**: 1.0.0 | **更新**: 2026-02-18

---

## 1. 数据库 Schema

### 1.1 OpenClaw Workspace 表

```typescript
// db/schema/openclaw-workspace.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { members } from './member';

export const openclawWorkspaces = sqliteTable('openclaw_workspaces', {
  id: text('id').primaryKey(),
  
  // 关联信息
  memberId: text('member_id').references(() => members.id),
  name: text('name').notNull(),
  
  // 路径配置
  path: text('path').notNull(),                    // workspace 绝对路径
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  
  // 同步配置
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).default(true),
  watchEnabled: integer('watch_enabled', { mode: 'boolean' }).default(true),
  syncInterval: integer('sync_interval').default(30),  // 分钟
  
  // 排除规则
  excludePatterns: text('exclude_patterns', { mode: 'json' })
    .$type<string[]>()
    .default(['node_modules/**', '.git/**', 'temp/**']),
  
  // 状态
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  syncStatus: text('sync_status').default('idle'),  // idle | syncing | error
  lastError: text('last_error'),
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type OpenClawWorkspace = typeof openclawWorkspaces.$inferSelect;
export type NewOpenClawWorkspace = typeof openclawWorkspaces.$inferInsert;
```

### 1.2 OpenClaw File 表

```typescript
// db/schema/openclaw-file.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { openclawWorkspaces } from './openclaw-workspace';
import { documents } from './document';

export const openclawFiles = sqliteTable('openclaw_files', {
  id: text('id').primaryKey(),
  
  // 关联
  workspaceId: text('workspace_id')
    .references(() => openclawWorkspaces.id)
    .notNull(),
  documentId: text('document_id').references(() => documents.id),
  
  // 文件信息
  relativePath: text('relative_path').notNull(),    // 相对于 workspace 的路径
  fileType: text('file_type').notNull(),            // report/opportunity/daily/analysis/task_output
  
  // 内容哈希
  hash: text('hash').notNull(),                     // SHA-256 哈希
  contentHash: text('content_hash'),                // 内容哈希（不含 Front Matter）
  
  // 版本控制
  version: integer('version').default(1),
  baseHash: text('base_hash'),                      // 基础版本哈希（冲突检测用）
  
  // 元数据（从 Front Matter 解析）
  title: text('title'),
  category: text('category'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  relatedTaskId: text('related_task_id'),
  relatedProject: text('related_project'),
  opportunityScore: integer('opportunity_score'),
  confidence: text('confidence'),
  docStatus: text('doc_status'),
  
  // 同步状态
  syncStatus: text('sync_status').default('synced'),  // synced | pending | conflict | error
  syncDirection: text('sync_direction'),              // to_openclaw | to_comind | bidirectional
  
  // 时间戳
  fileModifiedAt: integer('file_modified_at', { mode: 'timestamp' }),  // 文件最后修改时间
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type OpenClawFile = typeof openclawFiles.$inferSelect;
export type NewOpenClawFile = typeof openclawFiles.$inferInsert;
```

### 1.3 File Version 表（版本历史）

```typescript
// db/schema/openclaw-version.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { openclawFiles } from './openclaw-file';

export const openclawVersions = sqliteTable('openclaw_versions', {
  id: text('id').primaryKey(),
  
  // 关联
  fileId: text('file_id')
    .references(() => openclawFiles.id)
    .notNull(),
  
  // 版本信息
  version: integer('version').notNull(),
  hash: text('hash').notNull(),
  
  // 存储策略：full = 完整内容，diff = 差异内容
  storageType: text('storage_type').default('full'),
  
  // 内容
  content: text('content'),                         // 完整内容（storageType = full）
  diffPatch: text('diff_patch'),                    // diff 补丁（storageType = diff）
  
  // 元数据
  changeSummary: text('change_summary'),            // 变更摘要
  changedBy: text('changed_by'),                    // comind | openclaw | user
  
  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type OpenClawVersion = typeof openclawVersions.$inferSelect;
export type NewOpenClawVersion = typeof openclawVersions.$inferInsert;
```

### 1.4 Conflict 表（冲突记录）

```typescript
// db/schema/openclaw-conflict.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { openclawFiles } from './openclaw-file';

export const openclawConflicts = sqliteTable('openclaw_conflicts', {
  id: text('id').primaryKey(),
  
  // 关联
  fileId: text('file_id')
    .references(() => openclawFiles.id)
    .notNull(),
  
  // 冲突信息
  localVersion: integer('local_version').notNull(),
  remoteVersion: integer('remote_version').notNull(),
  localHash: text('local_hash').notNull(),
  remoteHash: text('remote_hash').notNull(),
  
  // 内容
  localContent: text('local_content').notNull(),
  remoteContent: text('remote_content').notNull(),
  
  // 解决状态
  status: text('status').default('pending'),        // pending | resolved | ignored
  resolution: text('resolution'),                   // local | remote | merged
  mergedContent: text('merged_content'),            // 合并后的内容
  
  // 时间戳
  detectedAt: integer('detected_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export type OpenClawConflict = typeof openclawConflicts.$inferSelect;
export type NewOpenClawConflict = typeof openclawConflicts.$inferInsert;
```

---

## 2. API 设计

### 2.1 Workspace 管理

#### GET /api/openclaw-workspaces
获取所有 workspace 列表

```typescript
// Response
{
  data: OpenClawWorkspace[];
}
```

#### POST /api/openclaw-workspaces
创建新的 workspace

```typescript
// Request
{
  name: string;
  path: string;
  memberId?: string;
  isDefault?: boolean;
  syncEnabled?: boolean;
  watchEnabled?: boolean;
  syncInterval?: number;
  excludePatterns?: string[];
}

// Response
{
  data: OpenClawWorkspace;
}
```

#### PUT /api/openclaw-workspaces/[id]
更新 workspace 配置

```typescript
// Request
{
  name?: string;
  syncEnabled?: boolean;
  watchEnabled?: boolean;
  syncInterval?: number;
  excludePatterns?: string[];
}

// Response
{
  data: OpenClawWorkspace;
}
```

#### DELETE /api/openclaw-workspaces/[id]
删除 workspace（不删除文件）

---

### 2.2 同步操作

#### POST /api/openclaw-workspaces/[id]/sync
触发同步

```typescript
// Request
{
  mode: 'full' | 'incremental';  // full: 全量同步, incremental: 增量
  direction?: 'to_comind' | 'to_openclaw' | 'bidirectional';
}

// Response
{
  data: {
    synced: number;
    created: number;
    updated: number;
    conflicts: number;
    errors: Array<{
      file: string;
      error: string;
    }>;
  };
}
```

#### GET /api/openclaw-workspaces/[id]/status
获取同步状态

```typescript
// Response
{
  data: {
    status: 'idle' | 'syncing' | 'error';
    lastSyncAt: Date | null;
    totalFiles: number;
    syncedFiles: number;
    pendingFiles: number;
    conflictFiles: number;
  };
}
```

#### POST /api/openclaw-workspaces/[id]/scan
扫描 workspace 文件

```typescript
// Response
{
  data: {
    total: number;
    byType: {
      report: number;
      opportunity: number;
      daily: number;
      analysis: number;
      task_output: number;
    };
    files: Array<{
      path: string;
      type: string;
      size: number;
      modifiedAt: Date;
      status: 'new' | 'modified' | 'synced' | 'conflict';
    }>;
  };
}
```

---

### 2.3 文件操作

#### GET /api/openclaw-files
获取文件列表

```typescript
// Query params
{
  workspaceId?: string;
  fileType?: string;
  syncStatus?: string;
  page?: number;
  limit?: number;
}

// Response
{
  data: OpenClawFile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}
```

#### GET /api/openclaw-files/[id]
获取文件详情

```typescript
// Response
{
  data: OpenClawFile & {
    content: string;
    document?: Document;
    versions: OpenClawVersion[];
  };
}
```

#### POST /api/openclaw-files/[id]/push
推送文件到 OpenClaw

```typescript
// Request
{
  content: string;
  expectedVersion: number;  // 乐观锁
}

// Response (成功)
{
  data: OpenClawFile;
}

// Response (冲突)
{
  error: 'CONFLICT';
  data: {
    localVersion: number;
    serverVersion: number;
    serverContent: string;
    localContent: string;
  };
}
```

#### POST /api/openclaw-files/[id]/pull
从 OpenClaw 拉取文件

```typescript
// Response
{
  data: OpenClawFile & {
    content: string;
  };
}
```

---

### 2.4 冲突处理

#### GET /api/openclaw-conflicts
获取冲突列表

```typescript
// Response
{
  data: OpenClawConflict[];
}
```

#### POST /api/openclaw-conflicts/[id]/resolve
解决冲突

```typescript
// Request
{
  resolution: 'local' | 'remote' | 'merged';
  mergedContent?: string;  // resolution = 'merged' 时必填
}

// Response
{
  data: OpenClawConflict;
}
```

---

### 2.5 版本历史

#### GET /api/openclaw-files/[id]/versions
获取版本历史

```typescript
// Query params
{
  limit?: number;  // 默认 10
}

// Response
{
  data: OpenClawVersion[];
}
```

#### POST /api/openclaw-files/[id]/rollback
回滚到指定版本

```typescript
// Request
{
  version: number;
}

// Response
{
  data: OpenClawFile;
}
```

---

## 3. 同步服务实现

### 3.1 文件监听器

```typescript
// lib/openclaw/watcher.ts

import chokidar from 'chokidar';
import type { OpenClawWorkspace } from '@/db/schema';

export class WorkspaceWatcher {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private syncQueue: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    private onFileChange: (workspaceId: string, filePath: string) => void
  ) {}
  
  start(workspace: OpenClawWorkspace) {
    if (!workspace.watchEnabled) return;
    
    const watcher = chokidar.watch(workspace.path, {
      ignored: this.buildIgnorePatterns(workspace.excludePatterns),
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });
    
    watcher.on('change', (filePath) => {
      this.scheduleSync(workspace.id, filePath);
    });
    
    watcher.on('add', (filePath) => {
      this.scheduleSync(workspace.id, filePath);
    });
    
    this.watchers.set(workspace.id, watcher);
  }
  
  stop(workspaceId: string) {
    const watcher = this.watchers.get(workspaceId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(workspaceId);
    }
  }
  
  private scheduleSync(workspaceId: string, filePath: string) {
    const key = `${workspaceId}:${filePath}`;
    
    // 清除之前的定时器
    const existing = this.syncQueue.get(key);
    if (existing) clearTimeout(existing);
    
    // 1 秒后触发同步（防抖）
    const timeout = setTimeout(() => {
      this.syncQueue.delete(key);
      this.onFileChange(workspaceId, filePath);
    }, 1000);
    
    this.syncQueue.set(key, timeout);
  }
  
  private buildIgnorePatterns(patterns: string[] = []): RegExp[] {
    const defaultPatterns = [
      /(^|[\/\\])\../,           // 隐藏文件
      /node_modules/,
      /\.git/,
      /temp/,
      /\.comind-sync/,
    ];
    
    return [...defaultPatterns, ...patterns.map(p => new RegExp(p))];
  }
}
```

### 3.2 同步管理器

```typescript
// lib/openclaw/sync-manager.ts

import { db } from '@/db';
import { openclawWorkspaces, openclawFiles, openclawVersions, openclawConflicts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { hash } from 'crypto';

export class SyncManager {
  
  // 全量同步
  async syncFull(workspaceId: string) {
    const workspace = await this.getWorkspace(workspaceId);
    
    // 扫描所有文件
    const files = await this.scanFiles(workspace.path);
    
    const results = {
      synced: 0,
      created: 0,
      updated: 0,
      conflicts: 0,
      errors: [] as Array<{ file: string; error: string }>,
    };
    
    for (const file of files) {
      try {
        const result = await this.syncFile(workspace, file);
        results.synced++;
        if (result.created) results.created++;
        if (result.updated) results.updated++;
        if (result.conflict) results.conflicts++;
      } catch (error) {
        results.errors.push({
          file: file.relativePath,
          error: error.message,
        });
      }
    }
    
    // 更新 workspace 同步时间
    await db.update(openclawWorkspaces)
      .set({ lastSyncAt: new Date(), syncStatus: 'idle' })
      .where(eq(openclawWorkspaces.id, workspaceId));
    
    return results;
  }
  
  // 单文件同步
  async syncFile(workspace: OpenClawWorkspace, fileInfo: FileInfo) {
    const { relativePath, content, hash } = fileInfo;
    
    // 解析 Front Matter
    const { frontMatter, body } = this.parseFrontMatter(content);
    
    // 查找现有文件记录
    const existing = await db.query.openclawFiles.findFirst({
      where: and(
        eq(openclawFiles.workspaceId, workspace.id),
        eq(openclawFiles.relativePath, relativePath)
      ),
    });
    
    if (existing) {
      // 检查是否有变化
      if (existing.hash === hash) {
        return { created: false, updated: false, conflict: false };
      }
      
      // 检查冲突
      if (existing.version > 1 && existing.baseHash !== this.calculateBaseHash(content)) {
        // 创建冲突记录
        await this.createConflict(existing, content);
        return { created: false, updated: false, conflict: true };
      }
      
      // 保存旧版本
      await this.saveVersion(existing);
      
      // 更新文件
      await db.update(openclawFiles)
        .set({
          hash,
          version: existing.version + 1,
          title: frontMatter.title,
          tags: frontMatter.tags,
          syncStatus: 'synced',
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(openclawFiles.id, existing.id));
      
      return { created: false, updated: true, conflict: false };
    } else {
      // 创建新文件记录
      await db.insert(openclawFiles).values({
        id: generateId(),
        workspaceId: workspace.id,
        relativePath,
        fileType: this.detectFileType(relativePath),
        hash,
        version: 1,
        title: frontMatter.title,
        tags: frontMatter.tags,
        syncStatus: 'synced',
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      return { created: true, updated: false, conflict: false };
    }
  }
  
  // 推送到 OpenClaw
  async pushToOpenClaw(fileId: string, content: string, expectedVersion: number) {
    const file = await db.query.openclawFiles.findFirst({
      where: eq(openclawFiles.id, fileId),
    });
    
    if (!file) {
      throw new Error('File not found');
    }
    
    // 乐观锁检查
    if (file.version !== expectedVersion) {
      // 返回冲突信息
      return {
        success: false,
        conflict: {
          localVersion: expectedVersion,
          serverVersion: file.version,
          serverContent: await this.readFileContent(file),
        },
      };
    }
    
    const workspace = await this.getWorkspace(file.workspaceId);
    const filePath = path.join(workspace.path, file.relativePath);
    
    // 写入文件
    await fs.writeFile(filePath, content, 'utf-8');
    
    // 更新记录
    const newVersion = expectedVersion + 1;
    await db.update(openclawFiles)
      .set({
        hash: this.calculateHash(content),
        version: newVersion,
        syncStatus: 'synced',
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(openclawFiles.id, fileId));
    
    return { success: true, version: newVersion };
  }
  
  // 其他辅助方法...
}
```

---

## 4. 前端配置界面

### 4.1 Workspace 列表页

```tsx
// app/settings/openclaw/page.tsx

'use client';

import { useOpenClawStore } from '@/store';

export default function OpenClawSettingsPage() {
  const { workspaces, loading, fetchWorkspaces, createWorkspace } = useOpenClawStore();
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">OpenClaw Workspace 管理</h1>
        <Button onClick={() => {/* 打开创建对话框 */}}>
          添加 Workspace
        </Button>
      </div>
      
      <div className="grid gap-4">
        {workspaces.map((ws) => (
          <WorkspaceCard key={ws.id} workspace={ws} />
        ))}
      </div>
    </div>
  );
}
```

### 4.2 Workspace 配置表单

```tsx
// components/openclaw/WorkspaceForm.tsx

export function WorkspaceForm({ workspace, onSubmit }: Props) {
  const [form, setForm] = useState({
    name: workspace?.name ?? '',
    path: workspace?.path ?? '',
    syncEnabled: workspace?.syncEnabled ?? true,
    watchEnabled: workspace?.watchEnabled ?? true,
    syncInterval: workspace?.syncInterval ?? 30,
  });
  
  return (
    <form onSubmit={handleSubmit}>
      <FormField label="名称">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="我的 Workspace"
        />
      </FormField>
      
      <FormField label="路径">
        <Input
          value={form.path}
          onChange={(e) => setForm({ ...form, path: e.target.value })}
          placeholder="~/.openclaw/workspace"
        />
      </FormField>
      
      <FormField label="实时监听">
        <Switch
          checked={form.watchEnabled}
          onCheckedChange={(v) => setForm({ ...form, watchEnabled: v })}
        />
      </FormField>
      
      <FormField label="同步间隔 (分钟)">
        <Input
          type="number"
          value={form.syncInterval}
          onChange={(e) => setForm({ ...form, syncInterval: Number(e.target.value) })}
          disabled={form.watchEnabled}
        />
      </FormField>
      
      <Button type="submit">保存</Button>
    </form>
  );
}
```

---

## 5. 配置项说明

### 5.1 环境变量

```bash
# .env
OPENCLAW_SYNC_ENABLED=true
OPENCLAW_WATCH_ENABLED=true
OPENCLAW_SYNC_INTERVAL=30           # 分钟
OPENCLAW_MAX_VERSIONS=10            # 每个文件最大版本数
OPENCLAW_FULL_COPY_VERSIONS=3       # 全量存储的版本数
OPENCLAW_DEBOUNCE_MS=1000           # 防抖时间
```

### 5.2 性能配置

```typescript
// config/openclaw.ts

export const OPENCLAW_CONFIG = {
  // 同步配置
  sync: {
    mode: 'realtime' as const,
    debounce: 1000,
    batchSize: 50,           // 批量同步时每次处理文件数
  },
  
  // 监听配置
  watch: {
    stabilityThreshold: 500,
    pollInterval: 100,
    usePolling: false,       // 大文件系统时启用
  },
  
  // 版本历史
  version: {
    maxVersions: 10,
    fullCopyVersions: 3,
    cleanupInterval: 24 * 60 * 60 * 1000,  // 24小时
  },
  
  // 冲突处理
  conflict: {
    autoMergeThreshold: 10,  // 差异小于 10 行自动合并
    retentionDays: 30,       // 冲突记录保留天数
  },
};
```

---

## 6. 性能指标

| 操作 | 预期性能 | 说明 |
|------|---------|------|
| 文件监听（空闲） | CPU ~0.2%, 内存 ~20MB | chokidar 开销 |
| 单文件同步 | 100-300ms | 含解析 + 写入 |
| 批量同步（100文件） | 2-5秒 | 全量扫描 |
| 版本历史存储 | ~100KB/文件 | 10 个版本 |
| 冲突检测 | < 50ms | 哈希比对 |

---

*本文档由 CoMind 团队维护*
