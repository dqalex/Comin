/**
 * OpenClaw Gateway Provider
 * 
 * @deprecated 已弃用浏览器直连模式。TeamClaw 3.0 使用服务端代理模式，
 * 请使用 ServerGatewayClient (服务端) 或 GatewayProxyClient (前端)。
 * 
 * 此文件仅保留用于历史参考，没有其他代码依赖它。
 * 
 * @see lib/server-gateway-client.ts - 服务端 Gateway 客户端（推荐）
 * @see lib/gateway-proxy.ts - 前端代理客户端
 * 
 * 将 OpenClawGatewayClient 适配为统一的 GatewayProvider 接口。
 * 
 * v3.0 Phase F: Provider 抽象层
 * - 统一接口，支持未来扩展 Knot 等平台
 * - 事件驱动架构
 */

import { OpenClawGatewayClient, type McpConfigResponse } from '../gateway-client';
import type {
  CronJob, HealthSummary, GatewayAgentRow,
  Session, Skill, Snapshot,
} from '@/types';
import type {
  GatewayProvider,
  ConnectionStatus,
  GatewayEventHandler,
  GatewayEventType,
  GatewayEventPayloads,
} from '../gateway-provider';

// OpenClaw 事件到通用事件的映射
function mapOpenClawEvent(
  event: string,
  data: unknown
): { type: GatewayEventType; payload: GatewayEventPayloads[GatewayEventType] } | null {
  switch (event) {
    case 'status':
      return { type: 'status_change', payload: { status: data as ConnectionStatus } };
    case 'agents':
      return { type: 'agent_update', payload: { agents: data as GatewayAgentRow[] } };
    case 'sessions':
      return { type: 'session_update', payload: { sessions: data as Session[] } };
    case 'cron_jobs':
      return { type: 'cron_update', payload: { cronJobs: data as CronJob[] } };
    case 'skills':
      return { type: 'skill_update', payload: { skills: data as Skill[] } };
    case 'health':
      return { type: 'health_update', payload: { health: data as HealthSummary } };
    case 'chat': {
      const chatData = data as { agentId?: string; sessionId?: string; payload?: unknown };
      return {
        type: 'chat_event',
        payload: {
          agentId: chatData.agentId || '',
          sessionId: chatData.sessionId || '',
          payload: chatData.payload,
        },
      };
    }
    case 'config':
      return { type: 'config_update', payload: { config: data as Record<string, unknown> } };
    case 'error':
      return { type: 'error', payload: data as GatewayEventPayloads['error'] };
    default:
      return null;
  }
}

export class OpenClawProvider implements GatewayProvider {
  readonly providerType = 'openclaw';
  private client: OpenClawGatewayClient;
  private handlers: Set<GatewayEventHandler> = new Set();
  private _status: ConnectionStatus = 'disconnected';
  private unsubscribeClient: (() => void) | null = null;

  constructor(
    url: string,
    token: string,
    options?: { mcpConfigCallback?: () => Promise<McpConfigResponse | null> }
  ) {
    this.client = new OpenClawGatewayClient(url, token);
    
    // 设置 MCP 配置回调
    if (options?.mcpConfigCallback) {
      this.client.setMcpConfigCallback(options.mcpConfigCallback);
    }
    
    // 转发客户端事件
    this.unsubscribeClient = this.client.onEvent((event, data) => {
      const mapped = mapOpenClawEvent(event, data);
      if (mapped) {
        if (mapped.type === 'status_change') {
          this._status = (mapped.payload as { status: ConnectionStatus }).status;
        }
        this.handlers.forEach(h => h(mapped.type, mapped.payload));
      }
    });
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  // ===== 连接管理 =====

  async connect(): Promise<void> {
    this._status = 'connecting';
    this.handlers.forEach(h => h('status_change', { status: 'connecting' }));
    
    try {
      await this.client.connect();
      this._status = 'connected';
      this.handlers.forEach(h => h('status_change', { status: 'connected' }));
    } catch (error) {
      this._status = 'disconnected';
      this.handlers.forEach(h => h('status_change', { status: 'disconnected', error: String(error) }));
      throw error;
    }
  }

  disconnect(): void {
    this.client.disconnect();
    this._status = 'disconnected';
    this.handlers.forEach(h => h('status_change', { status: 'disconnected' }));
  }

  onEvent(handler: GatewayEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  // ===== 数据获取 =====

  async getSnapshot(): Promise<Snapshot> {
    return this.client.getSnapshot();
  }

  async getAgents(): Promise<GatewayAgentRow[]> {
    const result = await this.client.listAgents();
    return Array.isArray(result) ? result : result.agents || [];
  }

  async getSessions(): Promise<Session[]> {
    const result = await this.client.listSessions();
    return Array.isArray(result) ? result : result.sessions || [];
  }

  async getCronJobs(): Promise<CronJob[]> {
    const result = await this.client.listCronJobs();
    return Array.isArray(result) ? result : result.jobs || [];
  }

  async getSkills(): Promise<Skill[]> {
    const result = await this.client.listSkills();
    return Array.isArray(result) ? result : result.skills || [];
  }

  async getHealth(): Promise<HealthSummary> {
    return this.client.getHealth();
  }

  // ===== Agent 操作 =====

  async createAgent(config: Record<string, unknown>): Promise<string> {
    const result = await this.client.createAgent(config as { name: string; workspace: string });
    return typeof result === 'string' ? result : result.agentId;
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.client.deleteAgent(agentId);
  }

  // ===== Session 操作 =====

  async patchSession(sessionKey: string, updates: Record<string, unknown>): Promise<void> {
    await this.client.patchSession(sessionKey, updates);
  }

  async deleteSession(sessionKey: string): Promise<void> {
    await this.client.deleteSession(sessionKey);
  }

  // ===== Cron 操作 =====

  async createCronJob(config: Omit<CronJob, 'id'>): Promise<string> {
    const result = await this.client.createCronJob(config as unknown as Record<string, unknown>);
    return typeof result === 'string' ? result : result.id || '';
  }

  async updateCronJob(jobId: string, config: Partial<CronJob>): Promise<void> {
    await this.client.updateCronJob(jobId, config as unknown as Record<string, unknown>);
  }

  async deleteCronJob(jobId: string): Promise<void> {
    await this.client.deleteCronJob(jobId);
  }

  async toggleCronJob(jobId: string, enabled: boolean): Promise<void> {
    await this.client.toggleCronJob(jobId, enabled);
  }

  async runCronJob(jobId: string): Promise<void> {
    await this.client.runCronJob(jobId);
  }

  // ===== Skill 操作 =====

  async toggleSkill(skillId: string, enabled: boolean): Promise<void> {
    // OpenClaw 客户端没有 toggleSkill 方法，需要通过其他方式实现
    console.warn('[OpenClawProvider] toggleSkill not directly supported, use skill management');
  }

  async installSkill(skillId: string): Promise<void> {
    await this.client.installSkill(skillId, `install-${Date.now()}`);
  }

  // ===== 配置 =====

  async getConfig(): Promise<Record<string, unknown>> {
    const result = await this.client.getConfig();
    return result.config || {};
  }

  async saveConfig(config: Record<string, unknown>): Promise<void> {
    const raw = JSON.stringify(config);
    await this.client.setConfig(raw, '');
  }

  async reloadConfig(): Promise<void> {
    await this.client.reloadConfig();
  }

  // ===== 文件操作 =====

  async listAgentFiles(agentId: string): Promise<{ name: string; path: string; size?: number }[]> {
    const result = await this.client.listAgentFiles(agentId);
    return (result.files || []).map(f => ({ name: f.name, path: f.path, size: f.size }));
  }

  async readAgentFile(agentId: string, path: string): Promise<string> {
    const result = await this.client.getAgentFile(agentId, path);
    return result.file?.content || '';
  }

  async writeAgentFile(agentId: string, path: string, content: string): Promise<void> {
    // OpenClaw 客户端目前不支持直接写入文件
    console.warn('[OpenClawProvider] writeAgentFile not directly supported');
  }
}
