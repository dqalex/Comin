import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';
import { BUILTIN_SOP_TEMPLATES, BUILTIN_RENDER_TEMPLATES } from './builtin-templates';
import { migrateUuidToBase58 } from './migrations';

/**
 * 数据库路径计算（解决 Next.js standalone 模式下的路径问题）
 * 
 * 优先级：
 * 1. 环境变量 COMIND_DB_PATH（生产环境推荐）
 * 2. process.cwd()/data/comind.db（开发模式）
 * 3. 向上查找 data 目录（standalone 模式）
 */
function getDatabasePath(): string {
  // 1. 环境变量优先
  if (process.env.COMIND_DB_PATH) {
    return process.env.COMIND_DB_PATH;
  }
  
  // 2. 检查 process.cwd()/data 是否存在（开发模式或正确配置的 standalone）
  const cwdDataPath = join(process.cwd(), 'data', 'comind.db');
  if (existsSync(dirname(cwdDataPath))) {
    return cwdDataPath;
  }
  
  // 3. standalone 模式：从 __dirname 向上查找项目根目录
  // __dirname 可能是 .next/standalone/.next/server/chunks/ 或类似路径
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    const dataPath = join(currentDir, 'data', 'comind.db');
    if (existsSync(dirname(dataPath))) {
      return dataPath;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break; // 已到达根目录
    currentDir = parentDir;
  }
  
  // 4. 最后回退：尝试创建 data 目录
  return join(process.cwd(), 'data', 'comind.db');
}

/**
 * 获取初始化数据库路径
 */
function getInitDatabasePath(): string | null {
  // 检查多个可能的位置
  const possiblePaths = [
    join(process.cwd(), 'data', 'init', 'comind-init.db'),
    join(dirname(DB_PATH), 'init', 'comind-init.db'),
  ];
  
  // standalone 模式：向上查找
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    possiblePaths.push(join(currentDir, 'data', 'init', 'comind-init.db'));
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }
  return null;
}

const DB_PATH = getDatabasePath();
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// 如果数据库不存在，尝试从初始化数据库复制
if (!existsSync(DB_PATH)) {
  const initDbPath = getInitDatabasePath();
  if (initDbPath) {
    console.log(`[CoMind] No database found, copying init database from: ${initDbPath}`);
    copyFileSync(initDbPath, DB_PATH);
    console.log(`[CoMind] Init database copied to: ${DB_PATH}`);
  }
}

// 单例保护：防止 HMR 重复创建数据库连接
const globalDbKey = '__comind_sqlite__' as const;
const globalDb = globalThis as unknown as Record<string, Database.Database>;

let sqlite: Database.Database;
if (globalDb[globalDbKey]) {
  sqlite = globalDb[globalDbKey];
} else {
  console.log(`[CoMind] Database path: ${DB_PATH}`);
  sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = -64000');
  sqlite.pragma('busy_timeout = 5000');
  globalDb[globalDbKey] = sqlite;
}

// 自动建表（仅在首次连接时执行）
const globalInitKey = '__comind_db_initialized__' as const;
const globalInit = globalThis as unknown as Record<string, boolean>;

if (!globalInit[globalInitKey]) {
  globalInit[globalInitKey] = true;

const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
const tableNames = tables.map(t => t.name);

if (tables.length === 0) {
  console.log('[CoMind] Empty database detected, initializing schema...');
  
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'human',
      email TEXT,
      avatar TEXT,
      online INTEGER DEFAULT 0,
      openclaw_name TEXT,
      openclaw_deploy_mode TEXT,
      openclaw_endpoint TEXT,
      openclaw_connection_status TEXT,
      openclaw_last_heartbeat INTEGER,
      openclaw_gateway_url TEXT,
      openclaw_agent_id TEXT,
      openclaw_api_token TEXT,
      openclaw_model TEXT,
      openclaw_enable_web_search INTEGER DEFAULT 0,
      openclaw_temperature REAL,
      config_source TEXT DEFAULT 'manual',
      execution_mode TEXT DEFAULT 'chat_only',
      experience_task_count INTEGER DEFAULT 0,
      experience_task_types TEXT,
      experience_tools TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      project_id TEXT REFERENCES projects(id),
      milestone_id TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      assignees TEXT NOT NULL DEFAULT '[]',
      creator_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      progress INTEGER DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      deadline INTEGER,
      check_items TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      parent_task_id TEXT,
      cross_projects TEXT DEFAULT '[]',
      sop_template_id TEXT,
      current_stage_id TEXT,
      stage_history TEXT DEFAULT '[]',
      sop_inputs TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      status TEXT NOT NULL DEFAULT 'open',
      due_date INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      action TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      member_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      project_id TEXT REFERENCES projects(id),
      project_tags TEXT DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'local',
      external_platform TEXT,
      external_id TEXT,
      external_url TEXT,
      mcp_server TEXT,
      last_sync INTEGER,
      sync_mode TEXT,
      links TEXT DEFAULT '[]',
      backlinks TEXT DEFAULT '[]',
      type TEXT NOT NULL DEFAULT 'note',
      render_mode TEXT DEFAULT 'markdown',
      render_template_id TEXT,
      html_content TEXT,
      slot_data TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS openclaw_status (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'offline',
      current_task_id TEXT REFERENCES tasks(id),
      current_task_title TEXT,
      current_action TEXT,
      progress INTEGER DEFAULT 0,
      started_at INTEGER,
      estimated_end_at INTEGER,
      next_task_id TEXT REFERENCES tasks(id),
      next_task_title TEXT,
      queued_tasks TEXT DEFAULT '[]',
      interruptible INTEGER DEFAULT 1,
      do_not_disturb_reason TEXT,
      last_heartbeat INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id),
      title TEXT NOT NULL,
      description TEXT,
      task_type TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_time TEXT,
      schedule_days TEXT,
      next_run_at INTEGER,
      config TEXT,
      enabled INTEGER DEFAULT 1,
      last_run_at INTEGER,
      last_run_status TEXT,
      last_run_result TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scheduled_task_history (
      id TEXT PRIMARY KEY NOT NULL,
      scheduled_task_id TEXT NOT NULL REFERENCES scheduled_tasks(id),
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      deliverable_type TEXT,
      deliverable_url TEXT,
      deliverable_title TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id),
      task_id TEXT REFERENCES tasks(id),
      document_id TEXT REFERENCES documents(id),
      title TEXT NOT NULL,
      description TEXT,
      platform TEXT NOT NULL,
      external_url TEXT,
      external_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id TEXT REFERENCES members(id),
      reviewed_at INTEGER,
      review_comment TEXT,
      version INTEGER DEFAULT 1,
      previous_delivery_id TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      conversation_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      entity_title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS openclaw_workspaces (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT REFERENCES members(id),
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      sync_enabled INTEGER DEFAULT 1,
      watch_enabled INTEGER DEFAULT 1,
      sync_interval INTEGER DEFAULT 120,
      exclude_patterns TEXT DEFAULT '["node_modules/**", ".git/**", "temp/**"]',
      last_sync_at INTEGER,
      sync_status TEXT DEFAULT 'idle',
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS openclaw_files (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES openclaw_workspaces(id),
      document_id TEXT REFERENCES documents(id),
      relative_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      hash TEXT NOT NULL,
      content_hash TEXT,
      version INTEGER DEFAULT 1,
      base_hash TEXT,
      title TEXT,
      category TEXT,
      tags TEXT,
      related_task_id TEXT,
      related_project TEXT,
      opportunity_score INTEGER,
      confidence TEXT,
      doc_status TEXT,
      sync_status TEXT DEFAULT 'synced',
      sync_direction TEXT,
      file_modified_at INTEGER,
      synced_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS openclaw_versions (
      id TEXT PRIMARY KEY NOT NULL,
      file_id TEXT NOT NULL REFERENCES openclaw_files(id),
      version INTEGER NOT NULL,
      hash TEXT NOT NULL,
      storage_type TEXT DEFAULT 'full',
      content TEXT,
      diff_patch TEXT,
      change_summary TEXT,
      changed_by TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS openclaw_conflicts (
      id TEXT PRIMARY KEY NOT NULL,
      file_id TEXT NOT NULL REFERENCES openclaw_files(id),
      local_version INTEGER NOT NULL,
      remote_version INTEGER NOT NULL,
      local_hash TEXT NOT NULL,
      remote_hash TEXT NOT NULL,
      local_content TEXT NOT NULL,
      remote_content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      resolution TEXT,
      merged_content TEXT,
      detected_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      member_id TEXT,
      agent_id TEXT,
      gateway_url TEXT,
      api_token_hash TEXT,
      action TEXT NOT NULL,
      params TEXT,
      success INTEGER NOT NULL,
      result TEXT,
      error TEXT,
      session_key TEXT,
      request_id TEXT,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
    CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
    CREATE INDEX IF NOT EXISTS idx_openclaw_status_member_id ON openclaw_status(member_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_member_id ON scheduled_tasks(member_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_task_history_task_id ON scheduled_task_history(scheduled_task_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_member_id ON deliveries(member_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_task_id ON deliveries(task_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_member_id ON chat_sessions(member_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_entity ON chat_sessions(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_workspaces_member_id ON openclaw_workspaces(member_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_workspace_id ON openclaw_files(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_document_id ON openclaw_files(document_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_files_sync_status ON openclaw_files(sync_status);
    CREATE INDEX IF NOT EXISTS idx_openclaw_versions_file_id ON openclaw_versions(file_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_conflicts_file_id ON openclaw_conflicts(file_id);
    CREATE INDEX IF NOT EXISTS idx_openclaw_conflicts_status ON openclaw_conflicts(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_source ON audit_logs(source);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_member_id ON audit_logs(member_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_id ON audit_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_api_token_hash ON audit_logs(api_token_hash);
    
    -- 新增索引：优化成员名查询和文档标题查询
    CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
    CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
    CREATE INDEX IF NOT EXISTS idx_documents_project_tags ON documents(project_tags);
    
    -- 新增索引：优化高频查询
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_document_id ON deliveries(document_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_reviewer_id ON deliveries(reviewer_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
    CREATE INDEX IF NOT EXISTS idx_members_type ON members(type);
    CREATE INDEX IF NOT EXISTS idx_members_openclaw_endpoint ON members(openclaw_endpoint);

    -- v3.0: SOP 相关索引
    CREATE INDEX IF NOT EXISTS idx_tasks_sop_template_id ON tasks(sop_template_id);
    CREATE INDEX IF NOT EXISTS idx_documents_render_mode ON documents(render_mode);
    CREATE INDEX IF NOT EXISTS idx_documents_render_template_id ON documents(render_template_id);

    -- v3.0: SOP 模板表（与 schema.ts sopTemplates 一致）
    CREATE TABLE IF NOT EXISTS sop_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'custom',
      icon TEXT DEFAULT 'clipboard-list',
      status TEXT NOT NULL DEFAULT 'active',
      stages TEXT NOT NULL DEFAULT '[]',
      required_tools TEXT DEFAULT '[]',
      system_prompt TEXT DEFAULT '',
      knowledge_config TEXT,
      output_config TEXT,
      quality_checklist TEXT DEFAULT '[]',
      is_builtin INTEGER NOT NULL DEFAULT 0,
      project_id TEXT REFERENCES projects(id),
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
    CREATE INDEX IF NOT EXISTS idx_sop_templates_status ON sop_templates(status);

    -- v3.0: 渲染模板表（与 schema.ts renderTemplates 一致）
    CREATE TABLE IF NOT EXISTS render_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'custom',
      status TEXT NOT NULL DEFAULT 'active',
      html_template TEXT NOT NULL DEFAULT '',
      md_template TEXT NOT NULL DEFAULT '',
      css_template TEXT,
      slots TEXT NOT NULL DEFAULT '{}',
      sections TEXT NOT NULL DEFAULT '[]',
      export_config TEXT NOT NULL DEFAULT '{"formats":["jpg","html"]}',
      thumbnail TEXT,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_render_templates_category ON render_templates(category);
    CREATE INDEX IF NOT EXISTS idx_render_templates_status ON render_templates(status);
  `);

  console.log('[CoMind] Schema initialized. Seeding default data...');
  
  const now = Date.now();
  // 仅创建默认人类用户，AI 成员通过连接 OpenClaw Gateway 自动注册（MCP register_member）
  sqlite.prepare(`INSERT OR IGNORE INTO members (id, name, type, email, online, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('member-default', '默认用户', 'human', '', 1, now, now);

  // 初始化文档：与 scripts/init-db.ts 保持一致的 3 篇内置文档
  // 使用数据库路径的父目录推断项目根目录（兼容 standalone 模式）
  const projectRoot = dirname(dataDir);
  const BUILTIN_DOCS = [
    { id: 'VrihWxkCoM9Q', title: '用户使用手册', type: 'guide', file: 'docs/product/USER_GUIDE.md' },
    { id: 'JzbpWix9BUnf', title: '开发者手册', type: 'guide', file: 'docs/technical/DEVELOPMENT.md' },
    { id: 'FtmyZ2zMsm1c', title: 'API 文档', type: 'reference', file: 'docs/technical/API.md' },
  ];
  const insertDoc = sqlite.prepare(
    `INSERT OR IGNORE INTO documents (id, title, content, type, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  let docCount = 0;
  for (const doc of BUILTIN_DOCS) {
    const docPath = join(projectRoot, doc.file);
    let content = `# ${doc.title}\n\n文档内容未找到。请访问 /wiki 页面查看最新版本。`;
    if (existsSync(docPath)) {
      content = readFileSync(docPath, 'utf-8');
    } else {
      console.warn(`[CoMind] 文档文件不存在: ${doc.file}`);
    }
    insertDoc.run(doc.id, doc.title, content, doc.type, 'local', now, now);
    docCount++;
  }
  console.log(`[CoMind] Seeded ${docCount} builtin documents.`);

  // 内置 SOP 模板和渲染模板
  const insertSop = sqlite.prepare(
    `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of BUILTIN_SOP_TEMPLATES) {
    insertSop.run(t.id, t.name, t.description, t.category, t.icon, 'active', JSON.stringify(t.stages), t.systemPrompt, JSON.stringify(t.qualityChecklist), 1, 'system', now, now);
  }
  console.log(`[CoMind] Seeded ${BUILTIN_SOP_TEMPLATES.length} builtin SOP templates.`);

  const insertRt = sqlite.prepare(
    `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of BUILTIN_RENDER_TEMPLATES) {
    insertRt.run(t.id, t.name, t.description, t.category, 'active', t.htmlTemplate, t.cssTemplate, t.mdTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), 1, 'system', now, now);
  }
  console.log(`[CoMind] Seeded ${BUILTIN_RENDER_TEMPLATES.length} builtin render templates.`);

  console.log('[CoMind] Database initialization complete.');
} else {
  // ===== V1 数据库兼容迁移 =====
  console.log('[CoMind] Existing database detected, running v1 compatibility migration...');

  // 1. 忽略 v1 独有的表（coworks, openclaw_connections）— 不删除，仅跳过
  if (tableNames.includes('coworks')) {
    console.log('[CoMind] Found v1 "coworks" table — ignored (v2 does not use it)');
  }
  if (tableNames.includes('openclaw_connections')) {
    console.log('[CoMind] Found v1 "openclaw_connections" table — ignored (v2 does not use it)');
  }

  // 2. 处理 tasks 表可能存在的 cowork_mode 列 — 无需删除，Drizzle 会忽略未知列
  const taskCols = sqlite.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  const taskColNames = taskCols.map(c => c.name);
  if (taskColNames.includes('cowork_mode')) {
    console.log('[CoMind] Found v1 "cowork_mode" column in tasks — ignored (Drizzle skips unknown columns)');
  }

  // 2.5 处理 comments → task_comments 表名迁移
  if (tableNames.includes('comments') && !tableNames.includes('task_comments')) {
    console.log('[CoMind] Renaming "comments" → "task_comments"...');
    try {
      sqlite.exec('ALTER TABLE comments RENAME TO task_comments');
      // 补齐 member_id 列（旧表可能用 author_id）
      const tcCols = sqlite.prepare("PRAGMA table_info(task_comments)").all() as { name: string }[];
      const tcColNames = tcCols.map(c => c.name);
      if (!tcColNames.includes('member_id') && tcColNames.includes('author_id')) {
        sqlite.exec('ALTER TABLE task_comments RENAME COLUMN author_id TO member_id');
      }
      if (!tcColNames.includes('updated_at')) {
        sqlite.exec('ALTER TABLE task_comments ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
      }
    } catch (err) {
      console.error('[CoMind] comments → task_comments migration failed:', err);
    }
  }

  // 3. 确保所有必需表存在（V1 中可能没有 openclaw_status / scheduled_tasks / scheduled_task_history）
  // 每个表的创建都独立 try-catch，避免一个失败导致后续全部跳过
  const tablesToCreate = [
    {
      name: 'openclaw_status',
      sql: `
        CREATE TABLE IF NOT EXISTS openclaw_status (
          id TEXT PRIMARY KEY NOT NULL,
          member_id TEXT NOT NULL REFERENCES members(id),
          status TEXT NOT NULL DEFAULT 'offline',
          current_task_id TEXT REFERENCES tasks(id),
          current_task_title TEXT,
          current_action TEXT,
          progress INTEGER DEFAULT 0,
          started_at INTEGER,
          estimated_end_at INTEGER,
          next_task_id TEXT REFERENCES tasks(id),
          next_task_title TEXT,
          queued_tasks TEXT DEFAULT '[]',
          interruptible INTEGER DEFAULT 1,
          do_not_disturb_reason TEXT,
          last_heartbeat INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_openclaw_status_member_id ON openclaw_status(member_id);
      `
    },
    {
      name: 'scheduled_tasks',
      sql: `
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
          id TEXT PRIMARY KEY NOT NULL,
          member_id TEXT NOT NULL REFERENCES members(id),
          title TEXT NOT NULL,
          description TEXT,
          task_type TEXT NOT NULL,
          schedule_type TEXT NOT NULL,
          schedule_time TEXT,
          schedule_days TEXT,
          next_run_at INTEGER,
          config TEXT,
          enabled INTEGER DEFAULT 1,
          last_run_at INTEGER,
          last_run_status TEXT,
          last_run_result TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_member_id ON scheduled_tasks(member_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
      `
    },
    {
      name: 'scheduled_task_history',
      sql: `
        CREATE TABLE IF NOT EXISTS scheduled_task_history (
          id TEXT PRIMARY KEY NOT NULL,
          scheduled_task_id TEXT NOT NULL REFERENCES scheduled_tasks(id),
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          status TEXT NOT NULL,
          result TEXT,
          error TEXT,
          deliverable_type TEXT,
          deliverable_url TEXT,
          deliverable_title TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_scheduled_task_history_task_id ON scheduled_task_history(scheduled_task_id);
      `
    },
    {
      name: 'chat_sessions',
      sql: `
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          member_id TEXT NOT NULL,
          member_name TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '新对话',
          conversation_id TEXT,
          entity_type TEXT,
          entity_id TEXT,
          entity_title TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_member_id ON chat_sessions(member_id);
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_entity ON chat_sessions(entity_type, entity_id);
      `
    },
    {
      name: 'chat_messages',
      sql: `
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL REFERENCES chat_sessions(id),
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
      `
    },
    {
      name: 'openclaw_workspaces',
      sql: `
        CREATE TABLE IF NOT EXISTS openclaw_workspaces (
          id TEXT PRIMARY KEY NOT NULL,
          member_id TEXT REFERENCES members(id),
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          sync_enabled INTEGER DEFAULT 1,
          watch_enabled INTEGER DEFAULT 1,
          sync_interval INTEGER DEFAULT 120,
          exclude_patterns TEXT DEFAULT '["node_modules/**", ".git/**", "temp/**"]',
          last_sync_at INTEGER,
          sync_status TEXT DEFAULT 'idle',
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_openclaw_workspaces_member_id ON openclaw_workspaces(member_id);
      `
    },
    {
      name: 'openclaw_files',
      sql: `
        CREATE TABLE IF NOT EXISTS openclaw_files (
          id TEXT PRIMARY KEY NOT NULL,
          workspace_id TEXT NOT NULL REFERENCES openclaw_workspaces(id),
          document_id TEXT REFERENCES documents(id),
          relative_path TEXT NOT NULL,
          file_type TEXT NOT NULL,
          hash TEXT NOT NULL,
          content_hash TEXT,
          version INTEGER DEFAULT 1,
          base_hash TEXT,
          title TEXT,
          category TEXT,
          tags TEXT,
          related_task_id TEXT,
          related_project TEXT,
          opportunity_score INTEGER,
          confidence TEXT,
          doc_status TEXT,
          sync_status TEXT DEFAULT 'synced',
          sync_direction TEXT,
          file_modified_at INTEGER,
          synced_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_openclaw_files_workspace_id ON openclaw_files(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_openclaw_files_document_id ON openclaw_files(document_id);
        CREATE INDEX IF NOT EXISTS idx_openclaw_files_sync_status ON openclaw_files(sync_status);
      `
    },
    {
      name: 'openclaw_versions',
      sql: `
        CREATE TABLE IF NOT EXISTS openclaw_versions (
          id TEXT PRIMARY KEY NOT NULL,
          file_id TEXT NOT NULL REFERENCES openclaw_files(id),
          version INTEGER NOT NULL,
          hash TEXT NOT NULL,
          storage_type TEXT DEFAULT 'full',
          content TEXT,
          diff_patch TEXT,
          change_summary TEXT,
          changed_by TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_openclaw_versions_file_id ON openclaw_versions(file_id);
      `
    },
    {
      name: 'openclaw_conflicts',
      sql: `
        CREATE TABLE IF NOT EXISTS openclaw_conflicts (
          id TEXT PRIMARY KEY NOT NULL,
          file_id TEXT NOT NULL REFERENCES openclaw_files(id),
          local_version INTEGER NOT NULL,
          remote_version INTEGER NOT NULL,
          local_hash TEXT NOT NULL,
          remote_hash TEXT NOT NULL,
          local_content TEXT NOT NULL,
          remote_content TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          resolution TEXT,
          merged_content TEXT,
          detected_at INTEGER NOT NULL,
          resolved_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_openclaw_conflicts_file_id ON openclaw_conflicts(file_id);
        CREATE INDEX IF NOT EXISTS idx_openclaw_conflicts_status ON openclaw_conflicts(status);
      `
    },
    {
      name: 'deliveries',
      sql: `
        CREATE TABLE IF NOT EXISTS deliveries (
          id TEXT PRIMARY KEY NOT NULL,
          member_id TEXT NOT NULL REFERENCES members(id),
          task_id TEXT REFERENCES tasks(id),
          document_id TEXT REFERENCES documents(id),
          title TEXT NOT NULL,
          description TEXT,
          platform TEXT NOT NULL,
          external_url TEXT,
          external_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          reviewer_id TEXT REFERENCES members(id),
          reviewed_at INTEGER,
          review_comment TEXT,
          version INTEGER DEFAULT 1,
          previous_delivery_id TEXT,
          source TEXT NOT NULL DEFAULT 'local',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_deliveries_member_id ON deliveries(member_id);
        CREATE INDEX IF NOT EXISTS idx_deliveries_task_id ON deliveries(task_id);
      `
    },
    // v3.0: SOP 模板表（与 schema.ts sopTemplates 一致）
    {
      name: 'sop_templates',
      sql: `
        CREATE TABLE IF NOT EXISTS sop_templates (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT NOT NULL DEFAULT 'custom',
          icon TEXT DEFAULT 'clipboard-list',
          status TEXT NOT NULL DEFAULT 'active',
          stages TEXT NOT NULL DEFAULT '[]',
          required_tools TEXT DEFAULT '[]',
          system_prompt TEXT DEFAULT '',
          knowledge_config TEXT,
          output_config TEXT,
          quality_checklist TEXT DEFAULT '[]',
          is_builtin INTEGER NOT NULL DEFAULT 0,
          project_id TEXT REFERENCES projects(id),
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
        CREATE INDEX IF NOT EXISTS idx_sop_templates_status ON sop_templates(status);
      `
    },
    // v3.0: 渲染模板表（与 schema.ts renderTemplates 一致）
    {
      name: 'render_templates',
      sql: `
        CREATE TABLE IF NOT EXISTS render_templates (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT NOT NULL DEFAULT 'custom',
          status TEXT NOT NULL DEFAULT 'active',
          html_template TEXT NOT NULL DEFAULT '',
          md_template TEXT NOT NULL DEFAULT '',
          css_template TEXT,
          slots TEXT NOT NULL DEFAULT '{}',
          sections TEXT NOT NULL DEFAULT '[]',
          export_config TEXT NOT NULL DEFAULT '{"formats":["jpg","html"]}',
          thumbnail TEXT,
          is_builtin INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_render_templates_category ON render_templates(category);
        CREATE INDEX IF NOT EXISTS idx_render_templates_status ON render_templates(status);
      `
    },
  ];

  for (const table of tablesToCreate) {
    if (!tableNames.includes(table.name)) {
      try {
        console.log(`[CoMind] Creating missing "${table.name}" table...`);
        sqlite.exec(table.sql);

        // openclaw_workspaces 表创建后，从环境变量自动创建默认工作区
        if (table.name === 'openclaw_workspaces' && process.env.OPENCLAW_WORKSPACE_PATH) {
          const workspacePath = process.env.OPENCLAW_WORKSPACE_PATH;
          const workspaceName = process.env.OPENCLAW_WORKSPACE_NAME || 'Default Workspace';
          const workspaceMemberId = process.env.OPENCLAW_WORKSPACE_MEMBER_ID || null;
          const syncInterval = parseInt(process.env.OPENCLAW_WORKSPACE_SYNC_INTERVAL || '120', 10);
          const now = Date.now();
          const workspaceId = `ws-${now.toString(36)}`;

          try {
            sqlite.prepare(`
              INSERT INTO openclaw_workspaces 
              (id, member_id, name, path, is_default, sync_enabled, watch_enabled, sync_interval, sync_status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(workspaceId, workspaceMemberId, workspaceName, workspacePath, 1, 1, 1, syncInterval, 'idle', now, now);

            console.log(`[CoMind] Default workspace created from environment: ${workspacePath}`);
          } catch (wsErr) {
            console.error('[CoMind] Failed to create default workspace:', wsErr);
          }
        }
        // sop_templates 表创建后，seed 内置模板
        if (table.name === 'sop_templates') {
          try {
            const now = Date.now();
            const insertSop = sqlite.prepare(
              `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            for (const t of BUILTIN_SOP_TEMPLATES) {
              insertSop.run(t.id, t.name, t.description, t.category, t.icon, 'active', JSON.stringify(t.stages), t.systemPrompt, JSON.stringify(t.qualityChecklist), 1, 'system', now, now);
            }
            console.log(`[CoMind] Seeded ${BUILTIN_SOP_TEMPLATES.length} builtin SOP templates (migration).`);
          } catch (seedErr) {
            console.error('[CoMind] Failed to seed SOP templates:', seedErr);
          }
        }

        // render_templates 表创建后，seed 内置模板
        if (table.name === 'render_templates') {
          try {
            const now = Date.now();
            const insertRt = sqlite.prepare(
              `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            for (const t of BUILTIN_RENDER_TEMPLATES) {
              insertRt.run(t.id, t.name, t.description, t.category, 'active', t.htmlTemplate, t.cssTemplate, t.mdTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), 1, 'system', now, now);
            }
            console.log(`[CoMind] Seeded ${BUILTIN_RENDER_TEMPLATES.length} builtin render templates (migration).`);
          } catch (seedErr) {
            console.error('[CoMind] Failed to seed render templates:', seedErr);
          }
        }
      } catch (err) {
        console.error(`[CoMind] Failed to create "${table.name}" table:`, err);
        // 继续执行后续表的创建
      }
    }
  }

  // 4. 确保 members 表有 v2 新增列
  const memberCols = sqlite.prepare("PRAGMA table_info(members)").all() as { name: string }[];
  const memberColNames = memberCols.map(c => c.name);
  const v2MemberCols: [string, string][] = [
    ['config_source', "TEXT DEFAULT 'manual'"],
    ['execution_mode', "TEXT DEFAULT 'chat_only'"],
    ['experience_task_count', 'INTEGER DEFAULT 0'],
    ['experience_task_types', 'TEXT'],
    ['experience_tools', 'TEXT'],
    ['openclaw_gateway_url', 'TEXT'],
    ['openclaw_agent_id', 'TEXT'],
    ['openclaw_model', 'TEXT'],
    ['openclaw_enable_web_search', 'INTEGER DEFAULT 0'],
    ['openclaw_temperature', 'REAL'],
  ];
  for (const [col, def] of v2MemberCols) {
    if (!memberColNames.includes(col)) {
      console.log(`[CoMind] Adding missing column "members.${col}"...`);
      sqlite.exec(`ALTER TABLE members ADD COLUMN ${col} ${def}`);
    }
  }

  // 5. 确保 tasks 表有 v2 新增列
  const v2TaskCols: [string, string][] = [
    ['check_items', "TEXT DEFAULT '[]'"],
    ['attachments', "TEXT DEFAULT '[]'"],
    ['parent_task_id', 'TEXT'],
    ['cross_projects', "TEXT DEFAULT '[]'"],
    ['milestone_id', 'TEXT'],
  ];
  for (const [col, def] of v2TaskCols) {
    if (!taskColNames.includes(col)) {
      console.log(`[CoMind] Adding missing column "tasks.${col}"...`);
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`);
    }
  }

  // 5.2 确保 tasks 表有 v3.0 SOP 相关列
  const v3TaskCols: [string, string][] = [
    ['sop_template_id', 'TEXT'],
    ['current_stage_id', 'TEXT'],
    ['stage_history', "TEXT DEFAULT '[]'"],
    ['sop_inputs', 'TEXT'],
  ];
  // 重新获取 task 列（可能在 v2 迁移中已更新）
  const taskColsV3 = sqlite.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  const taskColNamesV3 = taskColsV3.map(c => c.name);
  for (const [col, def] of v3TaskCols) {
    if (!taskColNamesV3.includes(col)) {
      console.log(`[CoMind] Adding v3.0 column "tasks.${col}"...`);
      try {
        sqlite.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`);
      } catch (err) {
        console.error(`[CoMind] Failed to add tasks.${col}:`, err);
      }
    }
  }

  // 5.1 确保 milestones 表存在（v2.4.0 新增）
  if (!tableNames.includes('milestones')) {
    console.log('[CoMind] Creating missing "milestones" table...');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS milestones (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        project_id TEXT NOT NULL REFERENCES projects(id),
        status TEXT NOT NULL DEFAULT 'open',
        due_date INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
      CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
    `);
  }

  // 6. 确保 documents 表有 v2 新增列
  if (tableNames.includes('documents')) {
    const docCols = sqlite.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
    const docColNames = docCols.map(c => c.name);
    const v2DocCols: [string, string][] = [
      ['project_tags', "TEXT DEFAULT '[]'"],
      ['links', "TEXT DEFAULT '[]'"],
      ['backlinks', "TEXT DEFAULT '[]'"],
      ['type', "TEXT NOT NULL DEFAULT 'note'"],
      ['external_platform', 'TEXT'],
      ['external_id', 'TEXT'],
      ['external_url', 'TEXT'],
      ['mcp_server', 'TEXT'],
      ['last_sync', 'INTEGER'],
      ['sync_mode', 'TEXT'],
    ];
    for (const [col, def] of v2DocCols) {
      if (!docColNames.includes(col)) {
        console.log(`[CoMind] Adding missing column "documents.${col}"...`);
        try {
          sqlite.exec(`ALTER TABLE documents ADD COLUMN ${col} ${def}`);
        } catch (err) {
          console.error(`[CoMind] Failed to add documents.${col}:`, err);
        }
      }
    }
    
    // 6.1 确保 documents 表有 v3.0 Content Studio 相关列
    const v3DocCols: [string, string][] = [
      ['render_mode', "TEXT DEFAULT 'markdown'"],
      ['render_template_id', 'TEXT'],
      ['html_content', 'TEXT'],
      ['slot_data', 'TEXT'],
    ];
    // 重新获取文档列（可能在 v2 迁移中已更新）
    const docColsV3 = sqlite.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
    const docColNamesV3 = docColsV3.map(c => c.name);
    for (const [col, def] of v3DocCols) {
      if (!docColNamesV3.includes(col)) {
        console.log(`[CoMind] Adding v3.0 column "documents.${col}"...`);
        try {
          sqlite.exec(`ALTER TABLE documents ADD COLUMN ${col} ${def}`);
        } catch (err) {
          console.error(`[CoMind] Failed to add documents.${col}:`, err);
        }
      }
    }
  }

  console.log('[CoMind] V1/V2 compatibility migration complete.');

  // v3.0: 检查 sop_templates/render_templates 表 schema 是否为旧版
  // 旧版（v2）的 sop_templates 有 'version'/'is_system' 列，缺少 'icon'/'status'
  if (tableNames.includes('sop_templates')) {
    const sopCols = sqlite.prepare("PRAGMA table_info(sop_templates)").all() as { name: string }[];
    const sopColNames = sopCols.map(c => c.name);
    if (!sopColNames.includes('icon') || !sopColNames.includes('status')) {
      console.log('[CoMind] Detected old sop_templates schema, rebuilding...');
      try {
        sqlite.exec('DROP TABLE IF EXISTS sop_templates');
        sqlite.exec(`
          CREATE TABLE sop_templates (
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
            category TEXT NOT NULL DEFAULT 'custom', icon TEXT DEFAULT 'clipboard-list',
            status TEXT NOT NULL DEFAULT 'active', stages TEXT NOT NULL DEFAULT '[]',
            required_tools TEXT DEFAULT '[]', system_prompt TEXT DEFAULT '',
            knowledge_config TEXT, output_config TEXT, quality_checklist TEXT DEFAULT '[]',
            is_builtin INTEGER NOT NULL DEFAULT 0, project_id TEXT REFERENCES projects(id),
            created_by TEXT NOT NULL DEFAULT 'system', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
          CREATE INDEX IF NOT EXISTS idx_sop_templates_status ON sop_templates(status);
        `);
        const now = Date.now();
        const insertSop = sqlite.prepare(
          `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const t of BUILTIN_SOP_TEMPLATES) {
          insertSop.run(t.id, t.name, t.description, t.category, t.icon, 'active', JSON.stringify(t.stages), t.systemPrompt, JSON.stringify(t.qualityChecklist), 1, 'system', now, now);
        }
        console.log(`[CoMind] Rebuilt sop_templates and seeded ${BUILTIN_SOP_TEMPLATES.length} builtin templates.`);
      } catch (err) {
        console.error('[CoMind] Failed to rebuild sop_templates:', err);
      }
    }
  }
  if (tableNames.includes('render_templates')) {
    const rtCols = sqlite.prepare("PRAGMA table_info(render_templates)").all() as { name: string }[];
    const rtColNames = rtCols.map(c => c.name);
    if (!rtColNames.includes('md_template') || !rtColNames.includes('slots')) {
      console.log('[CoMind] Detected old render_templates schema, rebuilding...');
      try {
        sqlite.exec('DROP TABLE IF EXISTS render_templates');
        sqlite.exec(`
          CREATE TABLE render_templates (
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
            category TEXT NOT NULL DEFAULT 'custom', status TEXT NOT NULL DEFAULT 'active',
            html_template TEXT NOT NULL DEFAULT '', md_template TEXT NOT NULL DEFAULT '',
            css_template TEXT, slots TEXT NOT NULL DEFAULT '{}', sections TEXT NOT NULL DEFAULT '[]',
            export_config TEXT NOT NULL DEFAULT '{"formats":["jpg","html"]}', thumbnail TEXT,
            is_builtin INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL DEFAULT 'system',
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_render_templates_category ON render_templates(category);
          CREATE INDEX IF NOT EXISTS idx_render_templates_status ON render_templates(status);
        `);
        const now = Date.now();
        const insertRt = sqlite.prepare(
          `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const t of BUILTIN_RENDER_TEMPLATES) {
          insertRt.run(t.id, t.name, t.description, t.category, 'active', t.htmlTemplate, t.cssTemplate, t.mdTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), 1, 'system', now, now);
        }
        console.log(`[CoMind] Rebuilt render_templates and seeded ${BUILTIN_RENDER_TEMPLATES.length} builtin templates.`);
      } catch (err) {
        console.error('[CoMind] Failed to rebuild render_templates:', err);
      }
    }
  }

  // 确保 deliveries 表有所有必需列
  if (tableNames.includes('deliveries')) {
    const deliveryCols = sqlite.prepare("PRAGMA table_info(deliveries)").all() as { name: string }[];
    const deliveryColNames = deliveryCols.map(c => c.name);
    const v2DeliveryCols: [string, string][] = [
      ['member_id', 'TEXT REFERENCES members(id)'],
      ['source', "TEXT NOT NULL DEFAULT 'local'"],
      ['document_id', 'TEXT REFERENCES documents(id)'],
      ['reviewer_id', 'TEXT REFERENCES members(id)'],
      ['reviewed_at', 'INTEGER'],
      ['review_comment', 'TEXT'],
      ['version', 'INTEGER DEFAULT 1'],
      ['previous_delivery_id', 'TEXT'],
      ['external_id', 'TEXT'],
      ['external_url', 'TEXT'],
    ];
    for (const [col, def] of v2DeliveryCols) {
      if (!deliveryColNames.includes(col)) {
        try {
          console.log(`[CoMind] Adding missing column "deliveries.${col}"...`);
          sqlite.exec(`ALTER TABLE deliveries ADD COLUMN ${col} ${def}`);
        } catch (err) {
          console.error(`[CoMind] Failed to add deliveries.${col}:`, err);
        }
      }
    }
  }

  // 确保 projects 表有 source 列
  if (tableNames.includes('projects')) {
    const projectCols = sqlite.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
    const projectColNames = projectCols.map(c => c.name);
    if (!projectColNames.includes('source')) {
      console.log('[CoMind] Adding missing column "projects.source"...');
      sqlite.exec(`ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT 'local'`);
    }
  }

  // 确保 tasks 表有 source 列
  if (tableNames.includes('tasks')) {
    const taskCols = sqlite.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    const taskColNames = taskCols.map(c => c.name);
    if (!taskColNames.includes('source')) {
      console.log('[CoMind] Adding missing column "tasks.source"...');
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'local'`);
    }
  }
}

  // 确保新索引存在（V1 迁移后添加）
  const existingIndexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
  const indexNames = existingIndexes.map(i => i.name);
  
  const newIndexes = [
    { name: 'idx_members_name', sql: 'CREATE INDEX IF NOT EXISTS idx_members_name ON members(name)' },
    { name: 'idx_documents_title', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)' },
    { name: 'idx_documents_project_tags', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_project_tags ON documents(project_tags)' },
    { name: 'idx_tasks_parent_task_id', sql: 'CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)' },
    { name: 'idx_deliveries_status', sql: 'CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)' },
    { name: 'idx_chat_messages_session_created', sql: 'CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at)' },
    { name: 'idx_documents_source', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source)' },
    // 问题 #32：deliveries 的 document_id 和 reviewer_id 索引
    { name: 'idx_deliveries_document_id', sql: 'CREATE INDEX IF NOT EXISTS idx_deliveries_document_id ON deliveries(document_id)' },
    { name: 'idx_deliveries_reviewer_id', sql: 'CREATE INDEX IF NOT EXISTS idx_deliveries_reviewer_id ON deliveries(reviewer_id)' },
    // 问题 #33：members 的 type 和 openclaw_endpoint 索引
    { name: 'idx_members_type', sql: 'CREATE INDEX IF NOT EXISTS idx_members_type ON members(type)' },
    { name: 'idx_members_openclaw_endpoint', sql: 'CREATE INDEX IF NOT EXISTS idx_members_openclaw_endpoint ON members(openclaw_endpoint)' },
    // v3.0: SOP 相关索引
    { name: 'idx_tasks_sop_template_id', sql: 'CREATE INDEX IF NOT EXISTS idx_tasks_sop_template_id ON tasks(sop_template_id)' },
    { name: 'idx_documents_render_mode', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_render_mode ON documents(render_mode)' },
    { name: 'idx_documents_render_template_id', sql: 'CREATE INDEX IF NOT EXISTS idx_documents_render_template_id ON documents(render_template_id)' },
    // 缺失索引补充
    { name: 'idx_scheduled_tasks_enabled', sql: 'CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled)' },
    { name: 'idx_openclaw_files_relative_path', sql: 'CREATE INDEX IF NOT EXISTS idx_openclaw_files_relative_path ON openclaw_files(relative_path)' },
    { name: 'idx_chat_sessions_updated_at', sql: 'CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at)' },
  ];
  
  for (const idx of newIndexes) {
    if (!indexNames.includes(idx.name)) {
      console.log(`[CoMind] Creating missing index "${idx.name}"...`);
      sqlite.exec(idx.sql);
    }
  }

  // ===== Gateway 配置表迁移（REQ-003） =====
  if (!tableNames.includes('gateway_configs')) {
    try {
      console.log('[CoMind] Creating "gateway_configs" table for server proxy mode...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS gateway_configs (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL DEFAULT 'default',
          url TEXT NOT NULL,
          encrypted_token TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'server_proxy',
          status TEXT NOT NULL DEFAULT 'disconnected',
          last_connected_at INTEGER,
          last_error TEXT,
          reconnect_attempts INTEGER DEFAULT 0,
          last_heartbeat INTEGER,
          is_default INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_gateway_configs_name ON gateway_configs(name);
        CREATE INDEX IF NOT EXISTS idx_gateway_configs_status ON gateway_configs(status);
      `);

      // 从环境变量自动创建默认 Gateway 配置
      if (process.env.OPENCLAW_DEFAULT_ENDPOINT && process.env.OPENCLAW_TOKEN) {
        let defaultUrl = process.env.OPENCLAW_DEFAULT_ENDPOINT;
        const defaultToken = process.env.OPENCLAW_TOKEN;
        const mode = process.env.GATEWAY_MODE || 'server_proxy';
        const now = Date.now();
        
        // 自动修正 URL 协议：http:// -> ws://, https:// -> wss://
        if (defaultUrl.startsWith('http://')) {
          defaultUrl = defaultUrl.replace('http://', 'ws://');
          console.log('[CoMind] Auto-corrected Gateway URL: http:// -> ws://');
        } else if (defaultUrl.startsWith('https://')) {
          defaultUrl = defaultUrl.replace('https://', 'wss://');
          console.log('[CoMind] Auto-corrected Gateway URL: https:// -> wss://');
        }
        
        // 验证 URL 协议
        if (!defaultUrl.startsWith('ws://') && !defaultUrl.startsWith('wss://')) {
          console.error('[CoMind] Invalid Gateway URL protocol, must be ws:// or wss://:', defaultUrl);
        } else {
          try {
            const { encryptToken } = require('@/lib/security');
            const encryptedToken = encryptToken(defaultToken);
            
            sqlite.prepare(`
              INSERT INTO gateway_configs (id, name, url, encrypted_token, mode, status, is_default, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run('gw-default', 'default', defaultUrl, encryptedToken, mode, 'disconnected', 1, now, now);
            
            console.log('[CoMind] Default Gateway config created from environment variables');
          } catch (err) {
            console.error('[CoMind] Failed to create default Gateway config:', err);
          }
        }
      }
    } catch (err) {
      console.error('[CoMind] Failed to create gateway_configs table:', err);
    }
  }

  // ===== 审计日志表迁移 =====
  if (!tableNames.includes('audit_logs')) {
    try {
      console.log('[CoMind] Creating "audit_logs" table...');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY NOT NULL,
          source TEXT NOT NULL,
          member_id TEXT,
          agent_id TEXT,
          gateway_url TEXT,
          api_token_hash TEXT,
          action TEXT NOT NULL,
          params TEXT,
          success INTEGER NOT NULL,
          result TEXT,
          error TEXT,
          session_key TEXT,
          request_id TEXT,
          duration_ms INTEGER,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_source ON audit_logs(source);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_member_id ON audit_logs(member_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_id ON audit_logs(agent_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_api_token_hash ON audit_logs(api_token_hash);
      `);
    } catch (err) {
      console.error('[CoMind] Failed to create audit_logs table:', err);
    }
  }

  // ===== 内置模板升级（幂等，每次启动检查） =====
  // 内置模板使用 INSERT OR IGNORE 创建，但 mdTemplate/htmlTemplate 等可能在版本升级中更新
  // 用 UPDATE ... WHERE is_builtin = 1 确保只更新内置模板，不影响用户自定义模板
  if (tableNames.includes('render_templates')) {
    try {
      const updateRt = sqlite.prepare(
        `UPDATE render_templates SET md_template = ?, html_template = ?, css_template = ?, slots = ?, sections = ?, export_config = ?, updated_at = ? WHERE id = ? AND is_builtin = 1`
      );
      const now = Date.now();
      let updated = 0;
      for (const t of BUILTIN_RENDER_TEMPLATES) {
        const result = updateRt.run(t.mdTemplate, t.htmlTemplate, t.cssTemplate, JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig), now, t.id);
        if (result.changes > 0) updated++;
      }
      if (updated > 0) {
        console.log(`[CoMind] Upgraded ${updated} builtin render templates.`);
      }
    } catch (err) {
      console.error('[CoMind] Failed to upgrade builtin render templates:', err);
    }
  }

  // ===== UUID → Base58 ID 迁移 =====
  migrateUuidToBase58(sqlite);

} // end of initialization guard

// 创建 Drizzle 实例
export const db = drizzle(sqlite, { schema });

// 导出底层 better-sqlite3 实例（供 debug 路由等原生 SQL 查询使用）
export { sqlite };

// 导出 schema
export * from './schema';
