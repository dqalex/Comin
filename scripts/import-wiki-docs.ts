/**
 * 导入内置文档到 Wiki
 * 
 * 运行：npx tsx scripts/import-wiki-docs.ts
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// 文档配置
const DOCS_TO_IMPORT = [
  {
    title: '用户使用手册',
    file: 'docs/product/USER_GUIDE.md',
    type: 'note',
    description: 'CoMind 平台完整使用指南',
  },
  {
    title: '开发者手册',
    file: 'docs/technical/DEVELOPMENT.md',
    type: 'note',
    description: 'CoMind 开发文档',
  },
  {
    title: 'API 文档',
    file: 'docs/technical/API.md',
    type: 'note',
    description: 'CoMind REST API 文档',
  },
];

// 生成 Base58 ID
function generateBase58Id(length = 12): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function main() {
  const dbPath = path.resolve(__dirname, '../data/comind.db');
  const db = new Database(dbPath);
  
  console.log('导入文档到 Wiki...\n');
  
  // 启用外键
  db.pragma('foreign_keys = ON');
  
  const results: { title: string; id: string }[] = [];
  
  for (const doc of DOCS_TO_IMPORT) {
    const filePath = path.resolve(__dirname, '..', doc.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${doc.file}`);
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const now = Date.now();
    const id = generateBase58Id();
    
    // 检查是否已存在
    const existing = db.prepare('SELECT id FROM documents WHERE title = ?').get(doc.title) as { id: string } | undefined;
    
    if (existing) {
      console.log(`✓ 文档已存在: ${doc.title} (id: ${existing.id})`);
      results.push({ title: doc.title, id: existing.id });
      continue;
    }
    
    // 插入文档
    try {
      db.prepare(`
        INSERT INTO documents (id, title, content, type, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'local', ?, ?)
      `).run(id, doc.title, content, doc.type, now, now);
      
      console.log(`✓ 已导入: ${doc.title} (id: ${id})`);
      results.push({ title: doc.title, id });
    } catch (e) {
      console.error(`✗ 导入失败: ${doc.title}`, e);
    }
  }
  
  db.close();
  
  console.log('\n导入完成！Wiki 分享链接：');
  console.log('─'.repeat(50));
  for (const r of results) {
    console.log(`${r.title}: /wiki?doc=${r.id}`);
  }
}

main().catch(console.error);
