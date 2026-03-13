import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { openclawWorkspaces, openclawFiles, openclawVersions, openclawConflicts, documents, projects, tasks, deliveries } from '@/db/schema';
import { eq, and, like, sql } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import { syncMarkdownToDatabase, type SyncType } from '@/lib/markdown-sync';
import { refreshIndex } from '@/lib/openclaw/index-manager';
import { refreshClaudeMd } from '@/lib/openclaw/claude-md-generator';
import { eventBus } from '@/lib/event-bus';
import { SYNC_DIRS, SYNC_ROOT_FILES } from '@/lib/openclaw/config';

/**
 * POST /api/openclaw-workspaces/[id]/sync
 * 触发同步
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { mode = 'incremental', direction = 'bidirectional', forceReparse = false } = body;

    // 校验资源存在性
    const [workspace] = await db.select()
      .from(openclawWorkspaces)
      .where(eq(openclawWorkspaces.id, id));

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // 检查路径是否存在
    if (!existsSync(workspace.path)) {
      return NextResponse.json({ error: 'Workspace path does not exist' }, { status: 400 });
    }

    // 更新同步状态
    await db.update(openclawWorkspaces)
      .set({ syncStatus: 'syncing', updatedAt: new Date() })
      .where(eq(openclawWorkspaces.id, id));

    try {
      // 执行同步
      const results = await performSync(workspace, mode, direction, forceReparse);

      // 更新完成状态
      await db.update(openclawWorkspaces)
        .set({
          syncStatus: 'idle',
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(openclawWorkspaces.id, id));

      // 同步完成后刷新 .teamclaw-index 索引文件
      await refreshIndex(id).catch(err => {
        console.error('[sync] 刷新索引文件失败:', err);
      });

      // 同步完成后刷新 CLAUDE.md（注入项目/成员等动态数据）
      await refreshClaudeMd(id).catch(err => {
        console.error('[sync] 刷新 CLAUDE.md 失败:', err);
      });

      // 有文档变更时通知前端刷新
      if (results.created > 0 || results.updated > 0 || results.deleted > 0) {
        eventBus.emit({ type: 'document_update' });
      }
      if (results.tasksCreated > 0) {
        eventBus.emit({ type: 'task_update' });
      }

      // 直接返回对象，与其他 API 保持一致（apiRequest 会自动包装）
      return NextResponse.json(results);
    } catch (syncError) {
      // 记录错误
      await db.update(openclawWorkspaces)
        .set({
          syncStatus: 'error',
          lastError: syncError instanceof Error ? syncError.message : 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(openclawWorkspaces.id, id));

      throw syncError;
    }
  } catch (error) {
    console.error('[API] POST /openclaw-workspaces/[id]/sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Sync failed: ${errorMessage}` }, { status: 500 });
  }
}

/**
 * 执行同步
 */
async function performSync(
  workspace: typeof openclawWorkspaces.$inferSelect,
  _mode: string,
  _direction: string,
  forceReparse: boolean = false,
) {
  const results = {
    synced: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    conflicts: 0,
    errors: [] as Array<{ file: string; error: string }>,
    projectsCreated: 0,
    tasksCreated: 0,
  };

  // 扫描文件
  const files = await scanMarkdownFiles(workspace.path, workspace.excludePatterns || []);

  // 获取现有文件记录
  const existingFiles = await db.select()
    .from(openclawFiles)
    .where(eq(openclawFiles.workspaceId, workspace.id));
  const existingMap = new Map(existingFiles.map(f => [f.relativePath, f]));

  // 缓存已创建的项目
  const projectCache = new Map<string, string>();

  for (const file of files) {
    try {
      const relativePath = relative(workspace.path, file.path);
      const existing = existingMap.get(relativePath);

      // 计算哈希
      const hash = calculateHash(file.content);

      // 检测 teamclaw:* frontmatter 类型
      const teamclawType = detectComindType(file.frontMatter?.type);

      // 从文件名或 frontMatter 获取标题
      const title = typeof file.frontMatter?.title === 'string'
        ? file.frontMatter.title
        : relativePath.replace(/\.md$/, '').split('/').pop() || relativePath;

      // 检测文档类型
      const fileType = teamclawType || detectFileType(relativePath);
      const docType = mapFileTypeToDocType(fileType);

      // 提取项目信息
      // projects/ 目录下的文件允许自动创建项目，frontMatter.project 只做关联
      let projectId: string | undefined;
      const projectMatch = relativePath.match(/^projects\/([^/]+)/);
      if (projectMatch) {
        const projectName = projectMatch[1];
        const alreadyCached = projectCache.has(projectName);
        projectId = await getOrCreateProject(projectName, projectCache, true);
        if (projectId && !alreadyCached) {
          results.projectsCreated++;
        }
      }
      // frontMatter.project 只关联已有项目，不自动创建（防止已删除项目"复活"）
      if (!projectId && typeof file.frontMatter?.project === 'string') {
        projectId = await getOrCreateProject(file.frontMatter.project as string, projectCache);
      }

      // 处理 teamclaw:* 类型文件 - 调用 markdown-sync 引擎
      if (teamclawType) {
        // 创建或更新 document 记录
        if (existing) {
          const hashUnchanged = existing.hash === hash;
          
          // hash 相同时，检查是否需要强制重新解析（任务可能之前没解析成功）
          if (hashUnchanged && !forceReparse) {
            // 额外检查：如果 document 存在但没有关联任务，说明之前解析失败，需要重新解析
            let needReparse = false;
            if (existing.documentId && teamclawType === 'teamclaw:tasks') {
              const relatedTasks = await db.select({ id: tasks.id })
                .from(tasks)
                .where(eq(tasks.attachments, [`sync:${existing.documentId}`] as unknown as string[]));
              // attachments 是 JSON 数组，用 LIKE 查询更准确
              const relatedTasksLike = await db.select({ id: tasks.id })
                .from(tasks)
                .where(and(
                  eq(tasks.source, 'openclaw'),
                  eq(tasks.projectId, projectId || '')
                ));
              if (relatedTasks.length === 0 && relatedTasksLike.length === 0) {
                needReparse = true;
                console.log(`[sync] teamclaw:* 文件 hash 未变但无关联任务，强制重新解析: ${relativePath}`);
              }
            }
            
            if (!needReparse) {
              results.synced++;
              continue;
            }
          }

          // 更新文件记录（同时更新 fileType，因为 frontmatter 可能变化）
          await db.update(openclawFiles)
            .set({
              fileType,
              hash,
              version: (existing.version || 0) + 1,
              title,
              tags: Array.isArray(file.frontMatter?.tags) ? file.frontMatter.tags : null,
              syncStatus: 'synced',
              syncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(openclawFiles.id, existing.id));

          // 更新关联的 document
          if (existing.documentId) {
            await db.update(documents)
              .set({
                title,
                content: file.content,
                type: docType,
                projectId: projectId || null,
                lastSync: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(documents.id, existing.documentId));

            // 触发 markdown → database 同步
            const syncResult = await syncMarkdownToDatabase(existing.documentId, file.content);
            // 统计任务创建数量
            if (syncResult.counts?.created) {
              results.tasksCreated += syncResult.counts.created;
            }
          }

          results.updated++;
        } else {
          // 创建 document 记录
          const docId = generateId();
          await db.insert(documents).values({
            id: docId,
            title,
            content: file.content,
            source: 'openclaw',
            type: docType,
            projectId: projectId || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // 创建文件记录
          await db.insert(openclawFiles).values({
            id: generateId(),
            workspaceId: workspace.id,
            documentId: docId,
            relativePath,
            fileType,
            hash,
            version: 1,
            title,
            tags: Array.isArray(file.frontMatter?.tags) ? file.frontMatter.tags : null,
            syncStatus: 'synced',
            syncedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // 触发 markdown → database 同步
          const syncResult = await syncMarkdownToDatabase(docId, file.content);
          // 统计任务创建数量
          if (syncResult.counts?.created) {
            results.tasksCreated += syncResult.counts.created;
          }

          results.created++;
        }

        results.synced++;
        continue;
      }

      // 非特殊类型文件：原有逻辑
      if (fileType === 'task_output') {
        // 创建或更新 document 和 openclawFiles 记录，同时创建关联的 task
        // 传入 workspace.memberId 以自动分配任务给绑定的成员
        const { id: _taskId, created: taskCreated } = await getOrCreateTask(title, file.content, projectId, workspace.memberId);

        if (existing) {
          if (existing.hash === hash) {
            results.synced++;
            continue;
          }

          // 更新文件记录
          await db.update(openclawFiles)
            .set({
              hash,
              version: (existing.version || 0) + 1,
              title,
              tags: Array.isArray(file.frontMatter?.tags) ? file.frontMatter.tags : null,
              syncStatus: 'synced',
              syncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(openclawFiles.id, existing.id));

          if (existing.documentId) {
            await db.update(documents)
              .set({
                title,
                content: file.content,
                type: docType,
                projectId: projectId || null,
                lastSync: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(documents.id, existing.documentId));
          }

          results.updated++;
        } else {
          const docId = generateId();
          await db.insert(documents).values({
            id: docId,
            title,
            content: file.content,
            source: 'openclaw',
            type: docType,
            projectId: projectId || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await db.insert(openclawFiles).values({
            id: generateId(),
            workspaceId: workspace.id,
            documentId: docId,
            relativePath,
            fileType,
            hash,
            version: 1,
            title,
            tags: Array.isArray(file.frontMatter?.tags) ? file.frontMatter.tags : null,
            syncStatus: 'synced',
            syncedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          results.created++;
        }

        if (taskCreated) {
          results.tasksCreated++;
        }
        results.synced++;
        continue;
      }

      if (existing) {
        // 检查是否有变化
        if (existing.hash === hash) {
          results.synced++;
          continue;
        }

        // 更新文件记录
        await db.update(openclawFiles)
          .set({
            hash,
            version: (existing.version || 0) + 1,
            title,
            tags: Array.isArray(file.frontMatter?.tags) ? file.frontMatter.tags : null,
            syncStatus: 'synced',
            syncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(openclawFiles.id, existing.id));

        // 更新关联的 document
        if (existing.documentId) {
          await db.update(documents)
            .set({
              title,
              content: file.content,
              type: docType,
              projectId: projectId || null,
              lastSync: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(documents.id, existing.documentId));

          // 处理 delivery_status 等 frontmatter 字段（非 teamclaw 文件也可能有交付字段）
          const syncResult = await syncMarkdownToDatabase(existing.documentId, file.content);
          if (syncResult.synced) {
            if (syncResult.counts?.created) results.tasksCreated += syncResult.counts.created;
          }
        }

        results.updated++;
      } else {
        // 创建 document 记录
        const docId = generateId();
        await db.insert(documents).values({
          id: docId,
          title,
          content: file.content,
          source: 'openclaw',
          type: docType,
          projectId: projectId || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 创建文件记录
        await db.insert(openclawFiles).values({
          id: generateId(),
          workspaceId: workspace.id,
          documentId: docId,
          relativePath,
          fileType,
          hash,
          version: 1,
          title,
          tags: Array.isArray(file.frontMatter?.tags) ? file.frontMatter.tags : null,
          syncStatus: 'synced',
          syncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 处理 delivery_status 等 frontmatter 字段
        const syncResult = await syncMarkdownToDatabase(docId, file.content);
        if (syncResult.synced) {
          if (syncResult.counts?.created) results.tasksCreated += syncResult.counts.created;
        }

        results.created++;
      }

      results.synced++;
    } catch (err) {
      results.errors.push({
        file: relative(workspace.path, file.path),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // 清理已删除文件的数据库记录（批量化处理）
  const currentPaths = new Set(files.map(f => relative(workspace.path, f.path)));
  const deletedFiles = [...existingMap.entries()].filter(([path]) => !currentPaths.has(path));
  
  if (deletedFiles.length > 0) {
    const deletedFileIds = deletedFiles.map(([, f]) => f.id);
    const deletedDocIds = deletedFiles
      .map(([, f]) => f.documentId)
      .filter((id): id is string => !!id);
    
    try {
      // 批量删除子表记录
      for (const fileId of deletedFileIds) {
        await db.delete(openclawConflicts).where(eq(openclawConflicts.fileId, fileId));
        await db.delete(openclawVersions).where(eq(openclawVersions.fileId, fileId));
      }
      
      // 批量清理关联数据
      for (const docId of deletedDocIds) {
        await db.delete(deliveries).where(eq(deliveries.documentId, docId));
        await db.run(sql`DELETE FROM tasks WHERE attachments LIKE ${'%sync:' + docId + '%'}`);
      }
      
      // 批量删除 openclawFiles 和 documents
      for (const fileId of deletedFileIds) {
        await db.delete(openclawFiles).where(eq(openclawFiles.id, fileId));
      }
      for (const docId of deletedDocIds) {
        await db.delete(documents).where(eq(documents.id, docId));
      }
      
      results.deleted += deletedFiles.length;
    } catch (err) {
      results.errors.push({
        file: 'batch-cleanup',
        error: `Delete cleanup failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  }

  return results;
}

/**
 * 获取或创建项目
 * @param autoCreate 是否允许自动创建（仅 projects/ 目录下允许，front matter 只做关联）
 */
async function getOrCreateProject(projectName: string, cache: Map<string, string>, autoCreate: boolean = false): Promise<string | undefined> {
  // 检查缓存
  if (cache.has(projectName)) {
    return cache.get(projectName)!;
  }

  // 检查数据库
  const [existing] = await db.select()
    .from(projects)
    .where(eq(projects.name, projectName));

  if (existing) {
    cache.set(projectName, existing.id);
    return existing.id;
  }

  // 只有 projects/ 目录下的文件才允许自动创建项目
  // front matter 中的 project 字段只做关联，不自动创建（防止已删除项目被同步"复活"）
  if (!autoCreate) {
    console.log(`[sync] 项目不存在，跳过关联: ${projectName}`);
    return undefined;
  }

  // 创建新项目
  const projectId = generateId();
  await db.insert(projects).values({
    id: projectId,
    name: projectName,
    description: `Synced from OpenClaw workspace`,
    source: 'openclaw',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  cache.set(projectName, projectId);
  return projectId;
}

/**
 * 获取或创建任务
 * 使用 title + source(openclaw) + projectId 联合去重，避免不同文件同名 title 冲突
 * 返回 { id, created } 以区分新建和复用
 * @param title 任务标题
 * @param content 任务内容（用于提取描述）
 * @param projectId 项目 ID
 * @param memberId workspace 绑定的成员 ID，用于自动分配任务
 */
async function getOrCreateTask(title: string, content: string, projectId?: string, memberId?: string | null): Promise<{ id: string; created: boolean }> {
  const conditions = [
    eq(tasks.title, title),
    eq(tasks.source, 'openclaw'),
  ];
  if (projectId) {
    conditions.push(eq(tasks.projectId, projectId));
  }

  const [existing] = await db.select()
    .from(tasks)
    .where(and(...conditions));

  if (existing) {
    // 如果任务已存在但没有 assignees，且 workspace 有绑定成员，则补充分配
    if (memberId && (!existing.assignees || existing.assignees.length === 0)) {
      await db.update(tasks)
        .set({ assignees: [memberId], updatedAt: new Date() })
        .where(eq(tasks.id, existing.id));
    }
    return { id: existing.id, created: false };
  }

  // 创建新任务，自动分配给 workspace 绑定的成员
  const taskId = generateId();
  await db.insert(tasks).values({
    id: taskId,
    title,
    description: content.slice(0, 500), // 截取前500字符作为描述
    projectId: projectId || undefined,
    assignees: memberId ? [memberId] : [], // 自动分配给 workspace 绑定的成员
    source: 'openclaw',
    creatorId: 'system', // 系统创建
    status: 'todo',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { id: taskId, created: true };
}

/**
 * 扫描目录中的 Markdown 文件（仅限白名单目录）
 */
async function scanMarkdownFiles(
  dir: string,
  excludePatterns: string[]
): Promise<Array<{ path: string; content: string; frontMatter?: Record<string, unknown> }>> {
  const results: Array<{ path: string; content: string; frontMatter?: Record<string, unknown> }> = [];

  // 递归扫描子目录
  function scanRecursive(currentDir: string) {
    if (!existsSync(currentDir)) return;
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      // 检查排除规则
      if (shouldExclude(fullPath, excludePatterns)) continue;

      if (entry.isDirectory()) {
        // 跳过隐藏目录和常见排除目录
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        scanRecursive(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8');
        const frontMatter = parseFrontMatter(content);
        results.push({ path: fullPath, content, frontMatter });
      }
    }
  }

  // 1. 扫描根目录白名单文件
  for (const fileName of SYNC_ROOT_FILES) {
    const fullPath = join(dir, fileName);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const frontMatter = parseFrontMatter(content);
        results.push({ path: fullPath, content, frontMatter });
      } catch {
        // 跳过读取失败的文件
      }
    }
  }

  // 2. 只扫描白名单子目录
  for (const subDir of SYNC_DIRS) {
    scanRecursive(join(dir, subDir));
  }

  return results;
}

/**
 * 检查路径是否应该被排除
 */
function shouldExclude(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes('**')) {
      const basePattern = pattern.replace('/**', '').replace('**/', '');
      if (path.includes(basePattern)) return true;
    } else if (path.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * 计算内容哈希
 */
function calculateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * 解析 Front Matter
 */
function parseFrontMatter(content: string): Record<string, unknown> | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;

  const fm: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    
    // 解析数组
    if (val.startsWith('[') && val.endsWith(']')) {
      try {
        fm[key] = JSON.parse(val);
      } catch {
        fm[key] = val;
      }
    } else {
      fm[key] = val;
    }
  }

  return fm;
}

/**
 * 检测文件类型
 */
function detectFileType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes('report')) return 'report';
  if (lower.includes('opportunity')) return 'opportunity';
  if (lower.includes('daily')) return 'daily';
  if (lower.includes('analysis')) return 'analysis';
  if (lower.includes('task')) return 'task_output';
  return 'note';
}

/**
 * 检测 teamclaw:* frontmatter 类型
 * task_list 作为 teamclaw:tasks 的别名，同样触发任务同步
 */
function detectComindType(type: unknown): SyncType | null {
  if (typeof type !== 'string') return null;
  // task_list 是 teamclaw:tasks 的别名，返回标准类型
  if (type === 'task_list') return 'teamclaw:tasks';
  if (type === 'teamclaw:tasks' || type === 'teamclaw:schedules' || type === 'teamclaw:deliveries') {
    return type as SyncType;
  }
  return null;
}

/**
 * 映射文件类型到文档类型
 */
function mapFileTypeToDocType(fileType: string): 'guide' | 'reference' | 'report' | 'note' | 'decision' | 'scheduled_task' | 'task_list' | 'other' {
  const mapping: Record<string, 'guide' | 'reference' | 'report' | 'note' | 'decision' | 'scheduled_task' | 'task_list' | 'other'> = {
    report: 'report',
    opportunity: 'note',
    daily: 'scheduled_task',
    analysis: 'note',
    task_output: 'task_list',
    note: 'note',
    guide: 'guide',
    reference: 'reference',
    'teamclaw:tasks': 'task_list',
    'teamclaw:schedules': 'scheduled_task',
    'teamclaw:deliveries': 'other',
  };
  return mapping[fileType] || 'note';
}
