#!/usr/bin/env tsx
/**
 * 更新初始化数据库，添加内置模板
 */

import Database from 'better-sqlite3';
import path from 'path';
import { BUILTIN_SOP_TEMPLATES, BUILTIN_RENDER_TEMPLATES } from '../../db/templates';

const INIT_DB_PATH = path.join(process.cwd(), 'data/init/teamclaw-init.db');

async function main() {
  console.log('[UpdateInitDb] Connecting to init database...');
  const db = new Database(INIT_DB_PATH);
  const now = Date.now();

  // 清空并插入 SOP 模板
  console.log('[UpdateInitDb] Updating SOP templates...');
  db.exec('DELETE FROM sop_templates WHERE is_builtin = 1');
  const insertSop = db.prepare(
    `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of BUILTIN_SOP_TEMPLATES) {
    insertSop.run(
      t.id, t.name, t.description, t.category, t.icon, 'active',
      JSON.stringify(t.stages), t.systemPrompt, JSON.stringify(t.qualityChecklist),
      1, 'system', now, now
    );
  }
  console.log(`  ✓ ${BUILTIN_SOP_TEMPLATES.length} SOP templates`);

  // 清空并插入渲染模板
  console.log('[UpdateInitDb] Updating render templates...');
  db.exec('DELETE FROM render_templates WHERE is_builtin = 1');
  const insertRt = db.prepare(
    `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of BUILTIN_RENDER_TEMPLATES) {
    insertRt.run(
      t.id, t.name, t.description, t.category, 'active',
      t.htmlTemplate, t.cssTemplate, t.mdTemplate,
      JSON.stringify(t.slots), JSON.stringify(t.sections), JSON.stringify(t.exportConfig),
      1, 'system', now, now
    );
  }
  console.log(`  ✓ ${BUILTIN_RENDER_TEMPLATES.length} render templates`);

  db.close();
  console.log('[UpdateInitDb] Done!');
}

main().catch(console.error);
