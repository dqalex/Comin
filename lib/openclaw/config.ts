/**
 * OpenClaw 同步服务配置
 */

export const OPENCLAW_CONFIG = {
  // 同步配置
  sync: {
    mode: 'realtime' as const,
    debounce: 1000,        // 防抖时间（毫秒）
    batchSize: 50,         // 批量同步时每次处理文件数
  },

  // 监听配置
  watch: {
    stabilityThreshold: 500,  // 文件稳定阈值
    pollInterval: 100,        // 轮询间隔
    usePolling: true,         // 服务器环境启用轮询模式
  },

  // 版本历史
  version: {
    maxVersions: 10,          // 每个文件最大版本数
    fullCopyVersions: 3,      // 全量存储的版本数
    cleanupInterval: 24 * 60 * 60 * 1000,  // 清理间隔（24小时）
  },

  // 冲突处理
  conflict: {
    autoMergeThreshold: 10,   // 差异小于 10 行自动合并
    retentionDays: 30,        // 冲突记录保留天数
  },

  // 心跳配置
  heartbeat: {
    interval: 120,            // 心跳间隔（秒）
    timeout: 180,             // 超时时间（秒）
    missedThreshold: 2,       // 缺失次数阈值
  },
} as const;

/**
 * 允许同步的子目录白名单
 * 只扫描这些目录下的 Markdown 文件，避免将 workspace 根目录下所有文件都同步进来
 */
export const SYNC_DIRS = ['documents', 'projects'] as const;

/**
 * 允许同步的根目录文件白名单
 */
export const SYNC_ROOT_FILES = ['CLAUDE.md', 'PROJECT_INDEX.md'] as const;
