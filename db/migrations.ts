import Database from 'better-sqlite3';
import { isUuidFormat, uuidToBase58 } from '@/lib/id';

/**
 * UUID → Base58 ID 迁移
 * 自动检测并转换数据库中所有 UUID 格式的 ID
 * 
 * 从 db/index.ts 拆分出来以控制文件大小
 */
export function migrateUuidToBase58(sqlite: Database.Database) {
  // 检查是否已有迁移记录
  const metaTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_meta'").get();
  if (metaTable) {
    const migrated = sqlite.prepare("SELECT value FROM migration_meta WHERE key = 'uuid_to_base58'").get() as { value: string } | undefined;
    if (migrated?.value === 'done') {
      return; // 已完成迁移
    }
  }
  
  // 检查是否有需要迁移的 UUID
  const hasUuid = sqlite.prepare("SELECT id FROM documents WHERE id LIKE '%-%-%-%-%' LIMIT 1").get();
  if (!hasUuid) {
    return; // 没有需要迁移的数据
  }
  
  console.log('[TeamClaw] Migrating: UUID → Base58 ID conversion...');
  
  // ID 映射表（UUID → Base58）
  const idMap = new Map<string, string>();
  
  // 辅助函数：转换 ID
  const convertId = (id: string | null): string | null => {
    if (!id) return null;
    if (isUuidFormat(id)) {
      let newId = idMap.get(id);
      if (!newId) {
        newId = uuidToBase58(id);
        idMap.set(id, newId);
      }
      return newId;
    }
    return id;
  };
  
  // 辅助函数：转换 JSON 数组中的 ID
  const convertJsonIds = (jsonStr: string | null): string | null => {
    if (!jsonStr) return null;
    try {
      const arr = JSON.parse(jsonStr);
      if (!Array.isArray(arr)) return jsonStr;
      
      let changed = false;
      const newArr = arr.map(item => {
        if (typeof item === 'string') {
          if (isUuidFormat(item)) {
            changed = true;
            return convertId(item);
          }
          if (item.startsWith('doc:') || item.startsWith('sync:')) {
            const prefix = item.slice(0, 4);
            const id = item.slice(4);
            if (isUuidFormat(id)) {
              changed = true;
              return `${prefix}${convertId(id)}`;
            }
          }
          return item;
        } else if (typeof item === 'object' && item !== null) {
          const newObj = { ...item };
          if (newObj.id && typeof newObj.id === 'string' && isUuidFormat(newObj.id)) {
            newObj.id = convertId(newObj.id);
            changed = true;
          }
          return newObj;
        }
        return item;
      });
      
      return changed ? JSON.stringify(newArr) : jsonStr;
    } catch {
      return jsonStr;
    }
  };
  
  try {
    sqlite.exec('BEGIN TRANSACTION');
    
    // === 迁移顺序：先迁移被引用的表，再迁移引用它的表 ===
    
    // 1. 迁移 members 表（被多个表引用）
    const membersData = sqlite.prepare('SELECT id FROM members').all() as { id: string }[];
    for (const member of membersData) {
      const newId = convertId(member.id);
      if (newId !== member.id) {
        sqlite.prepare('UPDATE tasks SET creator_id = ? WHERE creator_id = ?').run(newId, member.id);
        sqlite.prepare('UPDATE comments SET author_id = ? WHERE author_id = ?').run(newId, member.id);
        sqlite.prepare('UPDATE scheduled_tasks SET member_id = ? WHERE member_id = ?').run(newId, member.id);
        sqlite.prepare('UPDATE deliveries SET member_id = ? WHERE member_id = ?').run(newId, member.id);
        sqlite.prepare('UPDATE deliveries SET reviewer_id = ? WHERE reviewer_id = ?').run(newId, member.id);
        sqlite.prepare('UPDATE openclaw_status SET member_id = ? WHERE member_id = ?').run(newId, member.id);
        sqlite.prepare('UPDATE chat_sessions SET member_id = ? WHERE member_id = ?').run(newId, member.id);
        sqlite.prepare('UPDATE openclaw_workspaces SET member_id = ? WHERE member_id = ?').run(newId, member.id);
        sqlite.prepare('UPDATE members SET id = ? WHERE id = ?').run(newId, member.id);
      }
    }
    
    // 2. 迁移 projects 表（被 tasks, documents 引用）
    const projectsData = sqlite.prepare('SELECT id FROM projects').all() as { id: string }[];
    for (const proj of projectsData) {
      const newId = convertId(proj.id);
      if (newId !== proj.id) {
        sqlite.prepare('UPDATE tasks SET project_id = ? WHERE project_id = ?').run(newId, proj.id);
        sqlite.prepare('UPDATE documents SET project_id = ? WHERE project_id = ?').run(newId, proj.id);
        sqlite.prepare('UPDATE projects SET id = ? WHERE id = ?').run(newId, proj.id);
      }
    }
    
    // 3. 迁移 tasks 表（被多个表引用）
    const allTasks = sqlite.prepare('SELECT id, assignees, check_items, attachments, parent_task_id FROM tasks').all() as { id: string; assignees: string; check_items: string; attachments: string; parent_task_id: string | null }[];
    for (const task of allTasks) {
      const newId = convertId(task.id);
      if (newId !== task.id) {
        sqlite.prepare('UPDATE task_logs SET task_id = ? WHERE task_id = ?').run(newId, task.id);
        sqlite.prepare('UPDATE comments SET task_id = ? WHERE task_id = ?').run(newId, task.id);
        sqlite.prepare('UPDATE deliveries SET task_id = ? WHERE task_id = ?').run(newId, task.id);
        sqlite.prepare('UPDATE openclaw_status SET current_task_id = ? WHERE current_task_id = ?').run(newId, task.id);
        sqlite.prepare('UPDATE openclaw_status SET next_task_id = ? WHERE next_task_id = ?').run(newId, task.id);
        sqlite.prepare('UPDATE tasks SET id = ?, assignees = ?, check_items = ?, attachments = ?, parent_task_id = ? WHERE id = ?')
          .run(newId, convertJsonIds(task.assignees), convertJsonIds(task.check_items), convertJsonIds(task.attachments), convertId(task.parent_task_id), task.id);
      }
    }
    
    // 4. 迁移 documents 表（被 deliveries, openclaw_files 引用）
    const docs = sqlite.prepare('SELECT id FROM documents').all() as { id: string }[];
    for (const doc of docs) {
      const newId = convertId(doc.id);
      if (newId !== doc.id) {
        sqlite.prepare('UPDATE deliveries SET document_id = ? WHERE document_id = ?').run(newId, doc.id);
        sqlite.prepare('UPDATE openclaw_files SET document_id = ? WHERE document_id = ?').run(newId, doc.id);
        sqlite.prepare('UPDATE documents SET id = ? WHERE id = ?').run(newId, doc.id);
      }
    }
    
    // 5. 迁移其他表的主键
    const tablesWithUuid = [
      { table: 'task_logs', fkTables: [] as string[] },
      { table: 'comments', fkTables: [] as string[] },
      { table: 'scheduled_tasks', fkTables: ['scheduled_task_history'] },
      { table: 'scheduled_task_history', fkTables: [] as string[] },
      { table: 'deliveries', fkTables: [] as string[] },
      { table: 'openclaw_status', fkTables: [] as string[] },
      { table: 'chat_sessions', fkTables: ['chat_messages'] },
      { table: 'chat_messages', fkTables: [] as string[] },
    ];
    
    for (const { table, fkTables } of tablesWithUuid) {
      const rows = sqlite.prepare(`SELECT id FROM ${table}`).all() as { id: string }[];
      for (const row of rows) {
        const newId = convertId(row.id);
        if (newId !== row.id) {
          for (const fkTable of fkTables) {
            const fkCol = table === 'scheduled_tasks' ? 'scheduled_task_id' : 
                          table === 'chat_sessions' ? 'session_id' : `${table.slice(0, -1)}_id`;
            sqlite.prepare(`UPDATE ${fkTable} SET ${fkCol} = ? WHERE ${fkCol} = ?`).run(newId, row.id);
          }
          sqlite.prepare(`UPDATE ${table} SET id = ? WHERE id = ?`).run(newId, row.id);
        }
      }
    }
    
    // 6. 更新 chat_sessions 中的 entity_id
    const sessions = sqlite.prepare('SELECT id, entity_id FROM chat_sessions WHERE entity_id IS NOT NULL').all() as { id: string; entity_id: string }[];
    for (const session of sessions) {
      const newEntityId = convertId(session.entity_id);
      if (newEntityId !== session.entity_id) {
        sqlite.prepare('UPDATE chat_sessions SET entity_id = ? WHERE id = ?').run(newEntityId, session.id);
      }
    }
    
    // 标记迁移完成
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS migration_meta (key TEXT PRIMARY KEY, value TEXT)
    `);
    sqlite.prepare("INSERT OR REPLACE INTO migration_meta (key, value) VALUES ('uuid_to_base58', 'done')").run();
    
    sqlite.exec('COMMIT');
    console.log(`[TeamClaw] Migration complete. Converted ${idMap.size} UUIDs to Base58.`);
  } catch (err) {
    sqlite.exec('ROLLBACK');
    console.error('[TeamClaw] Migration failed, rolled back:', err);
  }
}
