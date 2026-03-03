/**
 * 数据库初始化脚本
 * 用于创建包含内置文档的初始化数据库
 * 
 * 使用方法：
 *   npx tsx scripts/init-db.ts
 * 
 * 输出：
 *   data/init/comind-init.db - 包含内置文档的初始化数据库
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import Database from 'better-sqlite3';

// 内置文档定义
const BUILTIN_DOCS = [
  {
    id: 'VrihWxkCoM9Q',
    title: '用户使用手册',
    type: 'guide',
    source: 'local' as const,
    description: 'CoMind 用户使用指南',
  },
  {
    id: 'JzbpWix9BUnf', 
    title: '开发者手册',
    type: 'guide',
    source: 'local' as const,
    description: 'CoMind 开发者指南',
  },
  {
    id: 'FtmyZ2zMsm1c',
    title: 'API 文档',
    type: 'reference',
    source: 'local' as const,
    description: 'CoMind API 参考文档',
  },
];

// 数据库 Schema SQL
const SCHEMA_SQL = `
-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'local',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 成员表
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
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

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT REFERENCES projects(id),
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 任务日志
CREATE TABLE IF NOT EXISTS task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  action TEXT NOT NULL,
  content TEXT,
  member_id TEXT,
  created_at INTEGER NOT NULL
);

-- 任务评论
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  member_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 文档表
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT NOT NULL DEFAULT 'note',
  source TEXT NOT NULL DEFAULT 'local',
  project_id TEXT REFERENCES projects(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 项目成员关联
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, member_id)
);

-- 定时任务表
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cron TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  enabled INTEGER DEFAULT 1,
  last_run INTEGER,
  next_run INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 状态队列表
CREATE TABLE IF NOT EXISTS status_queues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  items TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 交付物表
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL,
  document_id TEXT,
  task_id TEXT REFERENCES tasks(id),
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_schedules_member ON schedules(member_id);
`;

function readDocContent(filename: string): string {
  const docPath = join(process.cwd(), filename);
  if (existsSync(docPath)) {
    return readFileSync(docPath, 'utf-8');
  }
  console.warn(`警告: 文档文件不存在: ${filename}`);
  return `# ${filename}\n\n文档内容未找到。请访问 /wiki 页面查看最新版本。`;
}

function main() {
  const outputDir = join(process.cwd(), 'data/init');
  const outputPath = join(outputDir, 'comind-init.db');

  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 删除旧的初始化数据库
  if (existsSync(outputPath)) {
    rmSync(outputPath);
    console.log('已删除旧的初始化数据库');
  }

  // 创建新数据库
  const db = new Database(outputPath);
  
  // 启用 WAL 模式和外键约束
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 创建表结构
  db.exec(SCHEMA_SQL);
  console.log('已创建数据库表结构');

  // 插入默认人类用户（AI 成员通过连接 OpenClaw Gateway 自动注册）
  const now = Date.now();
  db.prepare(`INSERT INTO members (id, name, type, email, online, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('member-default', '默认用户', 'human', '', 1, now, now);
  console.log('已插入默认用户');

  // 插入内置文档
  const insertDoc = db.prepare(`
    INSERT INTO documents (id, title, content, type, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const docFiles: Record<string, string> = {
    '用户使用手册': 'docs/product/USER_GUIDE.md',
    '开发者手册': 'docs/technical/DEVELOPMENT.md',
    'API 文档': 'docs/technical/API.md',
  };

  for (const doc of BUILTIN_DOCS) {
    const content = readDocContent(docFiles[doc.title] || '');
    insertDoc.run(doc.id, doc.title, content, doc.type, doc.source, now, now);
    console.log(`已插入文档: ${doc.title} (${doc.id})`);
  }

  // 关闭数据库
  db.close();

  console.log(`\n初始化数据库已创建: ${outputPath}`);
  console.log('\n包含的内置文档:');
  BUILTIN_DOCS.forEach(doc => {
    console.log(`  - ${doc.title}: /wiki?doc=${doc.id}`);
  });

  console.log('\n使用方法:');
  console.log('  1. GitHub 发布时包含 data/init/comind-init.db');
  console.log('  2. 部署时复制到 data/comind.db: cp data/init/comind-init.db data/comind.db');
  console.log('  3. 或首次启动时自动检测并使用');
}

main();
