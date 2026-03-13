/**
 * Gateway Provider 接口定义
 * 
 * 抽象不同 Gateway 平台的统一接口，支持 OpenClaw、Knot 等多平台扩展。
 * 
 * 设计原则：
 * - 接口方法返回统一类型，屏蔽平台差异
 * - 事件驱动：状态变化通过事件通知
 * - 连接管理：统一的连接/断开/重连逻辑
 */

import type {
  CronJob, HealthSummary, GatewayAgentRow,
  Session, Skill, Snapshot,
} from '@/types';

// ===== 通用类型 =====

/** 连接状态 */
export type ConnectionStatus = 
  | 'disconnected'   // 未连接
  | 'connecting'     // 连接中
  | 'connected'      // 已连接
  | 'reconnecting';  // 重连中

/** Gateway 事件类型 */
export type GatewayEventType =
  | 'status_change'      // 连接状态变化
  | 'agent_update'       // Agent 列表更新
  | 'session_update'     // Session 更新
  | 'cron_update'        // Cron 任务更新
  | 'skill_update'       // Skill 更新
  | 'health_update'      // 健康状态更新
  | 'chat_event'         // 聊天事件
  | 'config_update'      // 配置更新
  | 'error';             // 错误

/** Gateway 事件载荷 */
export interface GatewayEventPayloads {
  status_change: { status: ConnectionStatus; error?: string };
  agent_update: { agents: GatewayAgentRow[] };
  session_update: { sessions: Session[] };
  cron_update: { cronJobs: CronJob[] };
  skill_update: { skills: Skill[] };
  health_update: { health: HealthSummary };
  chat_event: { agentId: string; sessionId: string; payload: unknown };
  config_update: { config: Record<string, unknown> };
  error: { code: string; message: string };
}

/** 事件处理器 */
export type GatewayEventHandler<K extends GatewayEventType = GatewayEventType> = (
  type: K,
  payload: GatewayEventPayloads[K]
) => void;

// ===== Provider 接口 =====

/**
 * Gateway Provider 接口
 * 
 * 所有 Gateway 客户端必须实现此接口。
 */
export interface GatewayProvider {
  /** Provider 标识（如 'openclaw', 'knot'） */
  readonly providerType: string;

  // ===== 连接管理 =====
  
  /** 当前连接状态 */
  readonly status: ConnectionStatus;
  
  /** 连接到 Gateway */
  connect(): Promise<void>;
  
  /** 断开连接 */
  disconnect(): void;
  
  /** 注册事件处理器 */
  onEvent(handler: GatewayEventHandler): () => void;

  // ===== 数据获取 =====
  
  /** 获取快照（全量数据） */
  getSnapshot(): Promise<Snapshot>;
  
  /** 获取 Agent 列表 */
  getAgents(): Promise<GatewayAgentRow[]>;
  
  /** 获取 Session 列表 */
  getSessions(): Promise<Session[]>;
  
  /** 获取 Cron 任务列表 */
  getCronJobs(): Promise<CronJob[]>;
  
  /** 获取 Skill 列表 */
  getSkills(): Promise<Skill[]>;
  
  /** 获取健康状态 */
  getHealth(): Promise<HealthSummary>;

  // ===== Agent 操作 =====
  
  /** 创建 Agent */
  createAgent(config: Record<string, unknown>): Promise<string>;
  
  /** 删除 Agent */
  deleteAgent(agentId: string): Promise<void>;

  // ===== Session 操作 =====
  
  /** 更新 Session */
  patchSession(sessionKey: string, updates: Record<string, unknown>): Promise<void>;
  
  /** 删除 Session */
  deleteSession(sessionKey: string): Promise<void>;

  // ===== Cron 操作 =====
  
  /** 创建 Cron 任务 */
  createCronJob(config: Omit<CronJob, 'id'>): Promise<string>;
  
  /** 更新 Cron 任务 */
  updateCronJob(jobId: string, config: Partial<CronJob>): Promise<void>;
  
  /** 删除 Cron 任务 */
  deleteCronJob(jobId: string): Promise<void>;
  
  /** 启用/禁用 Cron 任务 */
  toggleCronJob(jobId: string, enabled: boolean): Promise<void>;
  
  /** 手动触发 Cron 任务 */
  runCronJob(jobId: string): Promise<void>;

  // ===== Skill 操作 =====
  
  /** 启用/禁用 Skill */
  toggleSkill(skillId: string, enabled: boolean): Promise<void>;
  
  /** 安装 Skill */
  installSkill(skillId: string): Promise<void>;

  // ===== 配置 =====
  
  /** 获取配置 */
  getConfig(): Promise<Record<string, unknown>>;
  
  /** 保存配置 */
  saveConfig(config: Record<string, unknown>): Promise<void>;
  
  /** 重载配置 */
  reloadConfig(): Promise<void>;

  // ===== 文件操作 =====
  
  /** 获取 Agent 文件列表 */
  listAgentFiles(agentId: string): Promise<{ name: string; path: string; size?: number }[]>;
  
  /** 读取 Agent 文件 */
  readAgentFile(agentId: string, path: string): Promise<string>;
  
  /** 写入 Agent 文件 */
  writeAgentFile(agentId: string, path: string, content: string): Promise<void>;
}

// ===== Provider 工厂 =====

/** Provider 配置 */
export interface ProviderConfig {
  type: 'openclaw' | 'knot' | string;
  url: string;
  token: string;
  options?: Record<string, unknown>;
}

/**
 * 创建 Gateway Provider
 * 
 * 根据配置类型创建对应的 Provider 实例。
 */
export function createGatewayProvider(config: ProviderConfig): GatewayProvider {
  switch (config.type) {
    case 'openclaw':
      // 动态导入避免循环依赖
       
      const { OpenClawProvider } = require('./providers/openclaw-provider');
      return new OpenClawProvider(config.url, config.token, config.options);
    // case 'knot':
    //   return new KnotProvider(config.url, config.token, config.options);
    default:
      throw new Error(`Unknown gateway provider type: ${config.type}`);
  }
}
