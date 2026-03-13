const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DOCS = [
  { title: '用户使用手册', file: 'docs/product/USER_GUIDE.md', type: 'note' },
  { title: '开发者手册', file: 'docs/technical/DEVELOPMENT.md', type: 'note' },
  { title: 'API 文档', file: 'docs/technical/API.md', type: 'note' },
];

function genId(len = 12) {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let r = '';
  for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

const db = new Database('/root/teamclaw/data/teamclaw.db');
db.pragma('foreign_keys = ON');

const results = [];
for (const doc of DOCS) {
  const fp = path.join('/root/teamclaw', doc.file);
  if (!fs.existsSync(fp)) { console.log('跳过:', doc.file); continue; }
  const content = fs.readFileSync(fp, 'utf-8');
  const now = Date.now();
  
  const existing = db.prepare('SELECT id FROM documents WHERE title = ?').get(doc.title);
  if (existing) {
    results.push({ title: doc.title, id: existing.id });
    console.log('已存在:', doc.title, existing.id);
    continue;
  }
  
  const id = genId();
  const stmt = db.prepare("INSERT INTO documents (id, title, content, type, source, created_at, updated_at) VALUES (?, ?, ?, ?, 'local', ?, ?)");
  stmt.run(id, doc.title, content, doc.type, now, now);
  results.push({ title: doc.title, id });
  console.log('已导入:', doc.title, id);
}
db.close();

console.log('\nWiki 分享链接:');
results.forEach(r => console.log(r.title + ': /wiki?doc=' + r.id));
