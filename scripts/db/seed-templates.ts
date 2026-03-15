#!/usr/bin/env tsx
/**
 * 种子脚本：插入内置 SOP 和渲染模板到数据库
 * 
 * 用法：
 *   npx tsx scripts/seed-templates.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { BUILTIN_SOP_TEMPLATES, BUILTIN_RENDER_TEMPLATES } from '../../db/templates';

const DB_PATH = path.join(process.cwd(), 'data/teamclaw.db');

async function main() {
  console.log('[Seed] Connecting to database...');
  const db = new Database(DB_PATH);
  
  const now = Date.now();
  let sopCount = 0;
  let rtCount = 0;

  // 插入 SOP 模板
  console.log('[Seed] Inserting SOP templates...');
  const insertSop = db.prepare(
    `INSERT OR IGNORE INTO sop_templates (id, name, description, category, icon, status, stages, system_prompt, quality_checklist, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  
  for (const t of BUILTIN_SOP_TEMPLATES) {
    try {
      insertSop.run(
        t.id,
        t.name,
        t.description,
        t.category,
        t.icon,
        'active',
        JSON.stringify(t.stages),
        t.systemPrompt,
        JSON.stringify(t.qualityChecklist),
        1,
        'system',
        now,
        now
      );
      sopCount++;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      console.error(`  ✗ ${t.name}:`, err);
    }
  }

  // 插入渲染模板
  console.log('[Seed] Inserting render templates...');
  const insertRt = db.prepare(
    `INSERT OR IGNORE INTO render_templates (id, name, description, category, status, html_template, css_template, md_template, slots, sections, export_config, is_builtin, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  
  for (const t of BUILTIN_RENDER_TEMPLATES) {
    try {
      insertRt.run(
        t.id,
        t.name,
        t.description,
        t.category,
        'active',
        t.htmlTemplate,
        t.cssTemplate,
        t.mdTemplate,
        JSON.stringify(t.slots),
        JSON.stringify(t.sections),
        JSON.stringify(t.exportConfig),
        1,
        'system',
        now,
        now
      );
      rtCount++;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      console.error(`  ✗ ${t.name}:`, err);
    }
  }

  db.close();
  
  console.log(`\n[Seed] Completed!`);
  console.log(`  SOP templates: ${sopCount}`);
  console.log(`  Render templates: ${rtCount}`);
}

main().catch(console.error);
