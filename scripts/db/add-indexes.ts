#!/usr/bin/env tsx
/**
 * 数据库索引优化脚本
 * 
 * 为高频查询字段添加索引，提升查询性能
 * 
 * 用法: npx tsx scripts/add-indexes.ts
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

// 获取数据库路径
function getDatabasePath(): string {
  if (process.env.TEAMCLAW_DB_PATH) {
    return process.env.TEAMCLAW_DB_PATH;
  }
  return join(process.cwd(), 'data', 'teamclaw.db');
}

const DB_PATH = getDatabasePath();

// 确保数据目录存在
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// 连接数据库
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 索引定义
const INDEXES = [
  // 任务表索引
  { name: 'idx_tasks_status', table: 'tasks', column: 'status' },
  { name: 'idx_tasks_project_id', table: 'tasks', column: 'project_id' },
  { name: 'idx_tasks_assignee_id', table: 'tasks', column: 'assignee_id' },
  { name: 'idx_tasks_priority', table: 'tasks', column: 'priority' },
  { name: 'idx_tasks_created_at', table: 'tasks', column: 'created_at' },
  
  // 文档表索引
  { name: 'idx_documents_project_id', table: 'documents', column: 'project_id' },
  { name: 'idx_documents_type', table: 'documents', column: 'type' },
  { name: 'idx_documents_created_at', table: 'documents', column: 'created_at' },
  
  // 成员表索引
  { name: 'idx_members_type', table: 'members', column: 'type' },
  { name: 'idx_members_name', table: 'members', column: 'name' },
  
  // 聊天会话索引
  { name: 'idx_chat_sessions_created_at', table: 'chat_sessions', column: 'created_at' },
  
  // 聊天消息索引
  { name: 'idx_chat_messages_session_id', table: 'chat_messages', column: 'session_id' },
  { name: 'idx_chat_messages_created_at', table: 'chat_messages', column: 'created_at' },
  
  // 交付表索引
  { name: 'idx_deliveries_status', table: 'deliveries', column: 'status' },
  { name: 'idx_deliveries_document_id', table: 'deliveries', column: 'document_id' },
  
  // 定时任务索引
  { name: 'idx_scheduled_tasks_status', table: 'scheduled_tasks', column: 'status' },
  { name: 'idx_scheduled_tasks_type', table: 'scheduled_tasks', column: 'type' },
  
  // 里程碑索引
  { name: 'idx_milestones_project_id', table: 'milestones', column: 'project_id' },
  
  // 任务日志索引
  { name: 'idx_task_logs_task_id', table: 'task_logs', column: 'task_id' },
  { name: 'idx_task_logs_created_at', table: 'task_logs', column: 'created_at' },
  
  // 评论索引
  { name: 'idx_comments_task_id', table: 'comments', column: 'task_id' },
  { name: 'idx_comments_created_at', table: 'comments', column: 'created_at' },
  
  // OpenClaw 文件索引
  { name: 'idx_openclaw_files_workspace_id', table: 'openclaw_files', column: 'workspace_id' },
  { name: 'idx_openclaw_files_status', table: 'openclaw_files', column: 'status' },
  
  // OpenClaw 版本索引
  { name: 'idx_openclaw_versions_file_id', table: 'openclaw_versions', column: 'file_id' },
  
  // 审计日志索引
  { name: 'idx_audit_logs_source', table: 'audit_logs', column: 'source' },
  { name: 'idx_audit_logs_action', table: 'audit_logs', column: 'action' },
  { name: 'idx_audit_logs_created_at', table: 'audit_logs', column: 'created_at' },
  
  // SOP 模板索引
  { name: 'idx_sop_templates_category', table: 'sop_templates', column: 'category' },
  
  // 项目成员关联表索引
  { name: 'idx_project_members_project_id', table: 'project_members', column: 'project_id' },
  { name: 'idx_project_members_member_id', table: 'project_members', column: 'member_id' },
];

async function addIndexes() {
  console.log('========================================');
  console.log('🚀 开始添加数据库索引');
  console.log(`📂 数据库路径: ${DB_PATH}`);
  console.log('========================================\n');
  
  let added = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const index of INDEXES) {
    try {
      // 检查索引是否已存在
      const existing = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = ?
      `).get(index.name) as { name: string } | undefined;
      
      if (existing) {
        console.log(`⏭️  跳过 ${index.name} (已存在)`);
        skipped++;
        continue;
      }
      
      // 创建索引
      db.exec(`
        CREATE INDEX IF NOT EXISTS ${index.name} 
        ON ${index.table} (${index.column})
      `);
      
      console.log(`✅ 添加 ${index.name}`);
      added++;
    } catch (error) {
      console.error(`❌ 失败 ${index.name}:`, error);
      failed++;
    }
  }
  
  console.log('\n========================================');
  console.log(`索引添加完成！`);
  console.log(`  - 成功: ${added}`);
  console.log(`  - 跳过: ${skipped}`);
  console.log(`  - 失败: ${failed}`);
  console.log('========================================\n');
  
  // 分析数据库以更新统计信息
  console.log('📊 正在分析数据库...');
  db.exec('ANALYZE');
  console.log('✅ 数据库分析完成\n');
  
  // 显示索引统计
  const indexes = db.prepare(`
    SELECT name, tbl_name 
    FROM sqlite_master 
    WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    ORDER BY tbl_name, name
  `).all() as { name: string; tbl_name: string }[];
  
  console.log(`📋 当前索引列表 (共 ${indexes.length} 个):`);
  console.log('----------------------------------------');
  
  let currentTable = '';
  for (const idx of indexes) {
    if (idx.tbl_name !== currentTable) {
      currentTable = idx.tbl_name;
      console.log(`\n[${currentTable}]`);
    }
    console.log(`  - ${idx.name}`);
  }
  
  db.close();
}

addIndexes().catch(console.error);
