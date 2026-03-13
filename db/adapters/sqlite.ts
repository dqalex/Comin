/**
 * SQLite 数据库适配器
 * 
 * 用于本地开发和单机部署场景。
 * 使用 better-sqlite3 作为驱动，支持 WAL 模式和完整的事务支持。
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../schema';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';

/**
 * 数据库路径计算（解决 Next.js standalone 模式下的路径问题）
 * 
 * 优先级：
 * 1. 环境变量 TEAMCLAW_DB_PATH（生产环境推荐）
 * 2. process.cwd()/data/teamclaw.db（开发模式）
 * 3. 向上查找 data 目录（standalone 模式）
 */
export function getDatabasePath(): string {
  // 1. 环境变量优先
  if (process.env.TEAMCLAW_DB_PATH) {
    return process.env.TEAMCLAW_DB_PATH;
  }
  
  // 2. 检查 process.cwd()/data 是否存在（开发模式或正确配置的 standalone）
  const cwdDataPath = join(process.cwd(), 'data', 'teamclaw.db');
  if (existsSync(dirname(cwdDataPath))) {
    return cwdDataPath;
  }
  
  // 3. standalone 模式：从 __dirname 向上查找项目根目录
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    const dataPath = join(currentDir, 'data', 'teamclaw.db');
    if (existsSync(dirname(dataPath))) {
      return dataPath;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  
  // 4. 最后回退：尝试创建 data 目录
  return join(process.cwd(), 'data', 'teamclaw.db');
}

/**
 * 获取初始化数据库路径
 */
export function getInitDatabasePath(dbPath: string): string | null {
  const possiblePaths = [
    join(process.cwd(), 'data', 'init', 'teamclaw-init.db'),
    join(dirname(dbPath), 'init', 'teamclaw-init.db'),
  ];
  
  // standalone 模式：向上查找
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    possiblePaths.push(join(currentDir, 'data', 'init', 'teamclaw-init.db'));
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

/**
 * 创建 SQLite 数据库连接
 */
export function createSqliteConnection(): {
  db: ReturnType<typeof drizzle>;
  sqlite: Database.Database;
  dbPath: string;
} {
  const DB_PATH = getDatabasePath();
  const dataDir = dirname(DB_PATH);
  
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // 如果数据库不存在，尝试从初始化数据库复制
  if (!existsSync(DB_PATH)) {
    const initDbPath = getInitDatabasePath(DB_PATH);
    if (initDbPath) {
      console.log(`[TeamClaw SQLite] No database found, copying init database from: ${initDbPath}`);
      copyFileSync(initDbPath, DB_PATH);
      console.log(`[TeamClaw SQLite] Init database copied to: ${DB_PATH}`);
    }
  }

  // 单例保护：防止 HMR 重复创建数据库连接
  const globalDbKey = '__teamclaw_sqlite__' as const;
  const globalDb = globalThis as unknown as Record<string, Database.Database>;

  let sqlite: Database.Database;
  if (globalDb[globalDbKey]) {
    sqlite = globalDb[globalDbKey];
  } else {
    console.log(`[TeamClaw SQLite] Database path: ${DB_PATH}`);
    sqlite = new Database(DB_PATH);
    
    // 性能优化配置
    sqlite.pragma('journal_mode = WAL');        // WAL 模式，提升并发性能
    sqlite.pragma('foreign_keys = ON');         // 启用外键约束
    sqlite.pragma('synchronous = NORMAL');      // 平衡性能和安全
    sqlite.pragma('cache_size = -64000');       // 64MB 缓存
    sqlite.pragma('busy_timeout = 5000');       // 5秒忙超时
    
    globalDb[globalDbKey] = sqlite;
  }

  const db = drizzle(sqlite, { schema });

  return { db, sqlite, dbPath: DB_PATH };
}

/**
 * 导出 SQLite 特定的工具函数
 */
export function isSqlite(): boolean {
  return !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('sqlite:');
}
