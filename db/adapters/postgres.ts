/**
 * PostgreSQL 数据库适配器
 * 
 * 用于生产环境和需要高可用性的场景。
 * 使用 postgres.js 作为驱动，支持连接池和事务。
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

/**
 * PostgreSQL 连接配置
 */
export interface PostgresConfig {
  url: string;
  maxConnections?: number;
  idleTimeout?: number;
  connectTimeout?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
  debug?: boolean;
}

/**
 * 从环境变量解析 PostgreSQL 连接 URL
 */
export function parsePostgresUrl(url: string): PostgresConfig {
  // postgres://user:password@host:port/database?sslmode=require
  return {
    url,
    maxConnections: parseInt(process.env.PG_MAX_CONNECTIONS || '10', 10),
    idleTimeout: parseInt(process.env.PG_IDLE_TIMEOUT || '30', 10),
    connectTimeout: parseInt(process.env.PG_CONNECT_TIMEOUT || '30', 10),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    debug: process.env.PG_DEBUG === 'true',
  };
}

/**
 * 创建 PostgreSQL 数据库连接
 */
export function createPostgresConnection(config?: PostgresConfig): {
  db: ReturnType<typeof drizzle>;
  sql: ReturnType<typeof postgres>;
} {
  const pgUrl = config?.url || process.env.DATABASE_URL;
  
  if (!pgUrl || !pgUrl.startsWith('postgres')) {
    throw new Error('[TeamClaw PostgreSQL] DATABASE_URL must be a valid PostgreSQL connection string');
  }

  const pgConfig = config || parsePostgresUrl(pgUrl);

  // 单例保护
  const globalSqlKey = '__teamclaw_postgres__' as const;
  const globalSql = globalThis as unknown as Record<string, ReturnType<typeof postgres>>;

  let sql: ReturnType<typeof postgres>;
  if (globalSql[globalSqlKey]) {
    sql = globalSql[globalSqlKey];
  } else {
    console.log(`[TeamClaw PostgreSQL] Connecting to database...`);
    
    sql = postgres(pgUrl, {
      max: pgConfig.maxConnections,
      idle_timeout: pgConfig.idleTimeout,
      connect_timeout: pgConfig.connectTimeout,
      ssl: pgConfig.ssl,
      debug: pgConfig.debug,
      // 连接生命周期钩子
      onnotice: (notice) => {
        console.log(`[TeamClaw PostgreSQL] NOTICE: ${notice.message}`);
      },
    });

    globalSql[globalSqlKey] = sql;
  }

  const db = drizzle(sql, { schema });

  return { db, sql };
}

/**
 * 检查 PostgreSQL 连接健康状态
 */
export async function checkPostgresHealth(sql: ReturnType<typeof postgres>): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await sql`SELECT 1`;
    const latency = Date.now() - start;
    return { healthy: true, latency };
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * 关闭 PostgreSQL 连接
 */
export async function closePostgresConnection(sql: ReturnType<typeof postgres>): Promise<void> {
  try {
    await sql.end();
    console.log('[TeamClaw PostgreSQL] Connection closed');
  } catch (error) {
    console.error('[TeamClaw PostgreSQL] Error closing connection:', error);
  }
}

/**
 * 检查是否应该使用 PostgreSQL
 */
export function shouldUsePostgres(): boolean {
  const url = process.env.DATABASE_URL;
  return !!url && (url.startsWith('postgres://') || url.startsWith('postgresql://'));
}
