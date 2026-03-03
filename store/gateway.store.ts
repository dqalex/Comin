/**
 * Gateway 连接状态管理
 * 对齐 openclaw-reference 协议 v3
 *
 * 存储策略：URL 和 Token 都存储在 localStorage，支持刷新后自动重连
 * 注意：Token 持久化存在安全风险，仅适用于单用户私有部署场景
 *
 * 双模式支持：
 * - browser_direct: 浏览器直接连接 Gateway WebSocket
 * - server_proxy: 服务端连接 Gateway，浏览器通过 API 代理 + SSE 获取数据
 */
import { create } from 'zustand';
import { OpenClawGatewayClient, createGatewayClient, type AgentListEntry, type McpConfigResponse } from '../lib/gateway-client';
import { getGatewayProxyClient, GatewayProxyClient } from '../lib/gateway-proxy';
import type {
  Snapshot, HealthSummary, AgentHealthSummary, GatewayAgentRow,
  CronJob, CronRunLogEntry, Session, Skill, ChatEventPayload, HelloOkPayload,
} from '../types';
import { useMemberStore } from './member.store';

/** 客户端类型联合 */
type GatewayClient = OpenClawGatewayClient | GatewayProxyClient;

export type ChatEventHandler = (payload: ChatEventPayload) => void;

const GW_STORAGE_KEY = 'comind-gw-connection';

// 模块级 chat 事件处理器（避免存储在 Zustand state 中导致订阅时触发重渲染）
let chatEventHandlersModule: ChatEventHandler[] = [];

/**
 * 存储 URL 和 Token 到 localStorage
 * 注意：Token 持久化有安全风险，仅适用于单用户私有部署
 */
function saveGwConnection(url: string, token: string) {
  try {
    localStorage.setItem(GW_STORAGE_KEY, JSON.stringify({ url, token }));
  } catch (e) { console.warn('[GW] Failed to save connection:', e); }
}

function loadGwConnection(): { url: string; token: string } | null {
  try {
    const raw = localStorage.getItem(GW_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data ? { url: data.url || '', token: data.token || '' } : null;
  } catch { return null; }
}

function clearGwConnection() {
  try { localStorage.removeItem(GW_STORAGE_KEY); } catch (e) { console.warn('[GW] Failed to clear connection:', e); }
}

interface GatewayState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  client: OpenClawGatewayClient | null;
  gwUrl: string;
  gwToken: string;
  // 服务端代理模式状态
  connectionMode: 'server_proxy' | 'browser_direct' | null;
  serverProxyConnected: boolean;
  // Hello-ok (handshake payload)
  helloPayload: HelloOkPayload | null;
  // Snapshot
  snapshot: Snapshot | null;
  // Health (from health RPC — has agents, channels, sessions detail)
  health: HealthSummary | null;
  // Channels last refresh time
  lastChannelsRefresh: number | null;
  // Agents (from agents.list)
  agentsList: AgentListEntry[];
  agentsDefaultId: string | null;
  agentsMainKey: string | null;
  // Agent health (from health RPC)
  agentHealthList: AgentHealthSummary[];
  // Cron
  cronJobs: CronJob[];
  cronRuns: Record<string, CronRunLogEntry[]>;
  // Sessions (from sessions.list)
  sessions: Session[];
  sessionsCount: number;
  // Skills (from skills.status)
  skills: Skill[];
  // Nickname queries (agentId -> memberId)
  pendingNicknameQueries: Record<string, string>;
  // Config
  configForm: Record<string, unknown> | null;
  configFormOriginal: Record<string, unknown> | null;
  configHash: string | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;

  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  tryAutoConnect: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  refreshAgents: () => Promise<void>;
  queryAgentNickname: (agentId: string, memberId: string) => Promise<void>;
  refreshCronJobs: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshSkills: () => Promise<void>;
  // Chat event subscription
  onChatEvent: (handler: ChatEventHandler) => () => void;
  // server_proxy 模式下从 SSE 分发 chat 事件
  dispatchChatEvent: (payload: ChatEventPayload) => void;
  // Cron write operations
  toggleCronJob: (jobId: string, enabled: boolean) => Promise<void>;
  runCronJob: (jobId: string) => Promise<void>;
  deleteCronJob: (jobId: string) => Promise<void>;
  createCronJob: (job: Record<string, unknown>) => Promise<void>;
  updateCronJob: (jobId: string, patch: Record<string, unknown>) => Promise<void>;
  fetchCronRuns: (jobId: string) => Promise<void>;
  // Agent write operations
  createAgent: (params: { name: string; workspace: string; emoji?: string }) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  // Session write operations
  patchSession: (sessionKey: string, updates: Record<string, unknown>) => Promise<void>;
  deleteSession: (sessionKey: string) => Promise<void>;
  // Skill write operations
  toggleSkill: (skillKey: string, enabled: boolean) => Promise<void>;
  installSkill: (name: string, installId: string, timeoutMs?: number) => Promise<void>;
  // Task push
  pushTaskToAI: (taskId: string, sessionKey: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  // Config operations
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  reloadConfig: () => Promise<void>;
  updateConfigForm: (updater: (form: Record<string, unknown>) => Record<string, unknown>) => void;
  // 服务端代理模式状态同步
  syncServerProxyStatus: () => Promise<void>;
  // 直接设置连接信息（避免重复 fetch）
  setConnectionInfo: (mode: 'server_proxy' | 'browser_direct' | null, status: 'connected' | 'disconnected' | 'connecting' | null, url?: string) => void;
}

// Tool policy 已提取到 lib/tool-policy.ts，保持向后兼容的 re-export
export { TOOL_SECTIONS, PROFILE_OPTIONS, normalizeToolName, isAllowedByPolicy, resolveToolProfilePolicy } from '@/lib/tool-policy';

export const useGatewayStore = create<GatewayState>((set, get) => ({
  connected: false,
  connecting: false,
  error: null,
  client: null,
  gwUrl: '',
  connectionMode: null,
  serverProxyConnected: false,
  gwToken: '',
  helloPayload: null,
  snapshot: null,
  health: null,
  lastChannelsRefresh: null,
  agentsList: [],
  agentsDefaultId: null,
  agentsMainKey: null,
  agentHealthList: [],
  cronJobs: [],
  cronRuns: {},
  sessions: [],
  sessionsCount: 0,
  skills: [],
  pendingNicknameQueries: {},
  // Config
  configForm: null as Record<string, unknown> | null,
  configFormOriginal: null as Record<string, unknown> | null,
  configHash: null as string | null,
  configLoading: false,
  configSaving: false,
  configDirty: false,

  connect: async (url: string, token: string) => {
    const { client: existing } = get();
    if (existing) existing.disconnect();
    set({ connecting: true, error: null, gwUrl: url, gwToken: token });
    const client = createGatewayClient(url, token);
    try {
      // 事件处理防抖：合并短时间内的同类事件
      let refreshTimer: ReturnType<typeof setTimeout> | null = null;
      const pendingRefreshes = new Set<string>();
      const flushRefreshes = () => {
        const s = get();
        if (!s.connected) return;
        if (pendingRefreshes.has('agents') || pendingRefreshes.has('config')) {
          s.refreshAgents();
          s.refreshHealth();
        }
        if (pendingRefreshes.has('config')) s.loadConfig();
        if (pendingRefreshes.has('cron')) s.refreshCronJobs();
        if (pendingRefreshes.has('session')) s.refreshSessions();
        if (pendingRefreshes.has('skill')) s.refreshSkills();
        if (pendingRefreshes.has('snapshot') || pendingRefreshes.has('health')) {
          s.refreshSnapshot();
          s.refreshHealth();
        }
        pendingRefreshes.clear();
      };

      client.onEvent((event, payload) => {
        const s = get();
        if (!s.connected) return;
        if (event === 'chat') {
          const chatPayload = payload as ChatEventPayload;
          const pendingQueries = get().pendingNicknameQueries;

          // 从 sessionKey 提取 agentId (格式: "agent:main")
          const sessionKey = chatPayload?.sessionKey || '';
          const agentIdMatch = sessionKey.match(/^agent:(.+)$/);
          const agentId = agentIdMatch ? agentIdMatch[1] : null;

          // 获取消息文本
          const message = chatPayload?.message as { role?: string; text?: string } | undefined;
          const text = message?.text || '';
          const role = message?.role || '';

          if (agentId && role === 'assistant' && text && pendingQueries[agentId]) {
            // 尝试从响应中提取 JSON 昵称
            const jsonMatch = text.match(/\{[^{}]*"nickname"[^{}]*\}/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.nickname && typeof parsed.nickname === 'string') {
                  const memberId = pendingQueries[agentId];
                  // 更新成员名称
                  const memberStore = useMemberStore.getState();
                  memberStore.updateMemberAsync(memberId, { name: parsed.nickname });
                  // 清除等待状态
                  set((state) => {
                    const newQueries = { ...state.pendingNicknameQueries };
                    delete newQueries[agentId];
                    return { pendingNicknameQueries: newQueries };
                  });
                }
              } catch (e) {
                // JSON 解析失败，忽略
              }
            }
          }
          // 分发给外部处理器
          const handlers = chatEventHandlersModule;
          for (const h of handlers) {
            try { h(payload as ChatEventPayload); } catch (e) { console.error('chatEventHandler:', e); }
          }
          return;
        }
        // 非 chat 事件走防抖
        if (event.startsWith('agent') || event === 'config') pendingRefreshes.add(event === 'config' ? 'config' : 'agents');
        else if (event.startsWith('cron')) pendingRefreshes.add('cron');
        else if (event.startsWith('session')) pendingRefreshes.add('session');
        else if (event.startsWith('skill')) pendingRefreshes.add('skill');
        else if (event === 'snapshot' || event === 'health') pendingRefreshes.add(event);
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(flushRefreshes, 300);
      });

      // 设置 MCP 配置回调（响应 Gateway 的 comind.config.request）
      client.setMcpConfigCallback(async (): Promise<McpConfigResponse | null> => {
        try {
          const members = useMemberStore.getState().members;
          // 找到第一个有 apiToken 的 AI 成员
          const aiMember = members.find(m => m.type === 'ai' && m.openclawApiToken);
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
          return {
            baseUrl,
            apiToken: aiMember?.openclawApiToken || null,
            memberId: aiMember?.id,
          };
        } catch (e) {
          console.error('[GW] MCP config callback error:', e);
          return null;
        }
      });

      await client.connect();
      // 从 hello-ok 握手中提取 snapshot 作为初始值（后续 refreshSnapshot 会覆盖）
      const hello = client.helloPayload;

      set({
        connected: true, connecting: false, client, error: null,
        helloPayload: hello,
        ...(hello?.snapshot ? { snapshot: hello.snapshot } : {}),
      });
      saveGwConnection(url, token);
      const refreshResults = await Promise.allSettled([
        get().refreshSnapshot(),
        get().refreshHealth(),
        get().refreshAgents(),
        get().refreshCronJobs(),
        get().refreshSessions(),
        get().refreshSkills(),
        get().loadConfig(),
      ]);
      const refreshNames = ['snapshot', 'health', 'agents', 'cronJobs', 'sessions', 'skills', 'config'];
      refreshResults.forEach((r, i) => {
        if (r.status === 'rejected') console.warn(`[Gateway] ${refreshNames[i]} refresh failed:`, r.reason);
      });
    } catch (error) {
      set({ connecting: false, error: error instanceof Error ? error.message : 'Connection failed', client: null });
    }
  },

  disconnect: () => {
    const { client } = get();
    if (client) client.disconnect();
    clearGwConnection();
    set({
      connected: false, client: null, gwUrl: '', gwToken: '', helloPayload: null,
      snapshot: null, health: null, lastChannelsRefresh: null,
      agentsList: [], agentsDefaultId: null, agentsMainKey: null, agentHealthList: [],
      cronJobs: [], cronRuns: {},
      sessions: [], sessionsCount: 0, skills: [], error: null,
      configForm: null, configFormOriginal: null, configHash: null,
      configLoading: false, configSaving: false, configDirty: false,
    });
    chatEventHandlersModule = [];
  },

  tryAutoConnect: async () => {
    const { connected, connecting } = get();
    if (connected || connecting) return;
    const saved = loadGwConnection();
    // 如果有保存的 URL 和 Token，尝试自动重连
    if (saved?.url && saved?.token) {
      await get().connect(saved.url, saved.token);
    } else if (saved?.url) {
      // 无 Token 的 Gateway 也可以尝试连接
      await get().connect(saved.url, '');
    }
  },

  refreshSnapshot: async () => {
    const { client, helloPayload, connectionMode, serverProxyConnected } = get();
    // snapshot.get 方法在某些 Gateway 版本中不可用，优先使用 hello-ok 返回的 snapshot
    if (helloPayload?.snapshot) {
      set({ snapshot: helloPayload.snapshot });
      return;
    }
    
    // 根据连接模式选择客户端
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    
    if (!activeClient?.isConnected) return;
    try {
      const snapshot = await activeClient.getSnapshot();
      set({ snapshot });
    } catch (e) {
      // snapshot.get 方法不存在时忽略错误，使用 hello-ok 中的 snapshot
      console.warn('[GW] snapshot.get 不可用，使用 hello-ok 中的 snapshot');
    }
  },

  refreshHealth: async () => {
    const { client, connectionMode, serverProxyConnected } = get();
    
    // 根据连接模式选择客户端
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    
    if (!activeClient?.isConnected) return;
    try {
      const health = await activeClient.getHealth();
      const hasChannels = health.channels && Object.keys(health.channels).length > 0;
      set({
        health,
        agentHealthList: health.agents || [],
        ...(hasChannels ? { lastChannelsRefresh: Date.now() } : {}),
      });
    } catch (e) {
      console.error('refreshHealth:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to refresh health' });
    }
  },

  refreshAgents: async () => {
    const { client, gwUrl, connectionMode, serverProxyConnected } = get();
    
    // 根据连接模式选择客户端
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    
    if (!activeClient?.isConnected) {
      return;
    }
    try {
      const result = await activeClient.listAgents();
      const agents: AgentListEntry[] = (result.agents || []).map(a => ({
        id: a.id,
        name: a.name,
        identity: a.identity,
        isDefault: a.id === result.defaultId,
      }));
      set({ agentsList: agents, agentsDefaultId: result.defaultId || null, agentsMainKey: result.mainKey || null });

      // 自动同步 Agent 与本地 AI 成员的关联
      // 使用复合键 (gwUrl, agentId) 确保跨 Gateway 唯一性
      // 如果有多个重复成员，保留最新的（后面的覆盖前面的）
      const memberStore = useMemberStore.getState();
      const aiMembers = memberStore.members.filter(m => m.type === 'ai');

      for (const agent of agents) {
        // 查找所有匹配的 AI 成员（按复合键：gwUrl + agentId）
        const allMatching = aiMembers.filter(m => m.openclawGatewayUrl === gwUrl && m.openclawAgentId === agent.id);
        
        // 如果有多个重复成员，按创建时间排序，保留最新的，删除旧的
        if (allMatching.length > 1) {
          const sorted = [...allMatching].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA; // 降序，最新的在前
          });
          // 删除旧的重复成员
          for (let i = 1; i < sorted.length; i++) {
            await memberStore.deleteMemberAsync(sorted[i].id);
          }
        }
        
        // 保留最新的（或唯一的）匹配成员
        const existing = allMatching.length > 0
          ? [...allMatching].sort((a, b) => {
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return timeB - timeA;
            })[0]
          : undefined;

        // 尝试获取智能体的自我认知名称（通过 agent.identity.get API）
        let selfIdentityName: string | null = null;
        try {
          const identity = await activeClient.getAgentIdentity(agent.id);
          selfIdentityName = identity.name;
        } catch (e) {
          console.warn('[GW] refreshAgents: failed to get identity for', agent.id, '- will query via channel');
        }

        // 优先使用自我认知名称，其次 identity.name，再次 agent.name，最后 agent.id
        let displayName = selfIdentityName || agent.identity?.name || agent.name || agent.id;

        if (existing) {
          // 如果名称是 agentId（默认值），尝试通过信道询问昵称
          // 注意：server_proxy 模式下暂不支持 queryAgentNickname（需要 chat 能力）
          if (existing.name === agent.id && !selfIdentityName && connectionMode === 'browser_direct') {
            get().queryAgentNickname(agent.id, existing.id);
          } else if (existing.name !== displayName && displayName !== agent.id) {
            // 更新名称（如果有变化且不是默认值）
            await memberStore.updateMemberAsync(existing.id, { name: displayName });
          }
          continue;
        }

        // 新 Agent，自动创建本地 AI 成员
        try {
          const newMember = await memberStore.createMember({
            name: displayName,
            type: 'ai',
            openclawGatewayUrl: gwUrl,
            openclawAgentId: agent.id,
          });
          if (newMember) {
            // 如果名称是默认值，异步询问昵称（仅 browser_direct 模式）
            if (displayName === agent.id && connectionMode === 'browser_direct') {
              get().queryAgentNickname(agent.id, newMember.id);
            }
          }
        } catch (e) {
          console.error(`[GW] 创建 AI 成员失败:`, e);
        }
      }
    } catch (e) { console.error('refreshAgents:', e); }
  },

  // 通过信道询问智能体昵称（通用能力）
  queryAgentNickname: async (agentId: string, memberId: string) => {
    const { client } = get();
    if (!client?.isConnected) {
      return;
    }

    try {
      // 创建临时会话与智能体通信
      const sessionKey = `agent:${agentId}`;

      // 发送询问消息
      const prompt = '请告诉我你的昵称，只回复JSON格式：{"nickname":"你的昵称"}';
      await client.sendChatMessage({
        sessionKey,
        message: prompt,
      });

      // 标记等待昵称响应
      set((state) => ({
        pendingNicknameQueries: {
          ...state.pendingNicknameQueries,
          [agentId]: memberId,
        },
      }));

    } catch (e) {
      console.error('[GW] queryAgentNickname failed:', e);
    }
  },

  refreshCronJobs: async () => {
    const { client, connectionMode, serverProxyConnected } = get();
    
    // 根据连接模式选择客户端
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    
    if (!activeClient?.isConnected) return;
    try {
      const result = await activeClient.listCronJobs();
      set({ cronJobs: result.jobs || [] });
    } catch (e) {
      console.error('refreshCronJobs:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to refresh cron jobs' });
    }
  },

  refreshSessions: async () => {
    const { client, connectionMode, serverProxyConnected } = get();
    
    // 根据连接模式选择客户端
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    
    if (!activeClient?.isConnected) return;
    try {
      const result = await activeClient.listSessions();
      set({ sessions: result.sessions || [], sessionsCount: result.count || 0 });
    } catch (e) {
      console.error('refreshSessions:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to refresh sessions' });
    }
  },

  refreshSkills: async () => {
    const { client, connectionMode, serverProxyConnected } = get();
    
    // 根据连接模式选择客户端
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    
    if (!activeClient?.isConnected) return;
    try {
      const result = await activeClient.listSkills();
      set({ skills: result.skills || [] });
    } catch (e) {
      console.error('refreshSkills:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to refresh skills' });
    }
  },

  // Cron write
  toggleCronJob: async (jobId, enabled) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      const updated = await activeClient.toggleCronJob(jobId, enabled);
      set((s) => ({ cronJobs: s.cronJobs.map(j => j.id === jobId ? updated : j), error: null }));
    } catch (e) {
      console.error('toggleCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to toggle cron job' });
    }
  },

  runCronJob: async (jobId) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.runCronJob(jobId);
    } catch (e) {
      console.error('runCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to run cron job' });
    }
  },

  deleteCronJob: async (jobId) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.deleteCronJob(jobId);
      set((s) => ({ cronJobs: s.cronJobs.filter(j => j.id !== jobId), error: null }));
    } catch (e) {
      console.error('deleteCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to delete cron job' });
    }
  },

  createCronJob: async (job) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.createCronJob(job);
      await get().refreshCronJobs();
    } catch (e) {
      console.error('createCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to create cron job' });
    }
  },

  updateCronJob: async (jobId, patch) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      const updated = await activeClient.updateCronJob(jobId, patch);
      set((s) => ({ cronJobs: s.cronJobs.map(j => j.id === jobId ? updated : j), error: null }));
    } catch (e) {
      console.error('updateCronJob:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to update cron job' });
    }
  },

  fetchCronRuns: async (jobId) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      const runs = await activeClient.getCronRuns(jobId);
      set((s) => ({ cronRuns: { ...s.cronRuns, [jobId]: runs } }));
    } catch (e) {
      console.error('fetchCronRuns:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to fetch cron runs' });
    }
  },

  // Agent write
  createAgent: async (params) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.createAgent(params);
      await get().refreshAgents();
      await get().refreshHealth();
    } catch (e) {
      console.error('createAgent:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to create agent' });
    }
  },

  deleteAgent: async (agentId) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.deleteAgent(agentId);
      await get().refreshAgents();
      await get().refreshHealth();
    } catch (e) {
      console.error('deleteAgent:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to delete agent' });
    }
  },

  // Session write
  patchSession: async (sessionKey, updates) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.patchSession(sessionKey, updates);
      await get().refreshSessions();
    } catch (e) {
      console.error('patchSession:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to patch session' });
    }
  },

  deleteSession: async (sessionKey) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.deleteSession(sessionKey);
      set((s) => ({ sessions: s.sessions.filter(ss => ss.key !== sessionKey), error: null }));
    } catch (e) {
      console.error('deleteSession:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to delete session' });
    }
  },

  // Chat
  onChatEvent: (handler) => {
    chatEventHandlersModule = [...chatEventHandlersModule, handler];
    return () => {
      chatEventHandlersModule = chatEventHandlersModule.filter(h => h !== handler);
    };
  },

  // server_proxy 模式下从 SSE 分发 chat 事件到 chatEventHandlers
  dispatchChatEvent: (payload: ChatEventPayload) => {
    const s = get();
    // 复用 browser_direct 的昵称解析逻辑
    const pendingQueries = s.pendingNicknameQueries;
    const sessionKey = payload?.sessionKey || '';
    const agentIdMatch = sessionKey.match(/^agent:(.+)$/);
    const agentId = agentIdMatch ? agentIdMatch[1] : null;
    const message = payload?.message as { role?: string; text?: string } | undefined;
    const text = message?.text || '';
    const role = message?.role || '';

    if (agentId && role === 'assistant' && text && pendingQueries[agentId]) {
      const jsonMatch = text.match(/\{[^{}]*"nickname"[^{}]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.nickname && typeof parsed.nickname === 'string') {
            const memberId = pendingQueries[agentId];
            useMemberStore.getState().updateMemberAsync(memberId, { name: parsed.nickname });
            set((state) => {
              const newQueries = { ...state.pendingNicknameQueries };
              delete newQueries[agentId];
              return { pendingNicknameQueries: newQueries };
            });
          }
        } catch {
          // JSON 解析失败，忽略
        }
      }
    }

    // 分发给 ChatPanel 等外部处理器
    const handlers = chatEventHandlersModule;
    for (const h of handlers) {
      try { h(payload); } catch (e) { console.error('chatEventHandler (server_proxy):', e); }
    }
  },

  // Skill write
  toggleSkill: async (skillKey, enabled) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.updateSkill(skillKey, { enabled });
      await get().refreshSkills();
    } catch (e) {
      console.error('toggleSkill:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to toggle skill' });
    }
  },

  installSkill: async (name, installId, timeoutMs) => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    try {
      await activeClient.installSkill(name, installId, timeoutMs);
      await get().refreshSkills();
    } catch (e) {
      console.error('installSkill:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to install skill' });
    }
  },

  // Task push - 调用后端 API 构建推送消息，返回渲染后的消息内容
  // 不再直接 chat.send，由调用方通过 openChatWithMessage 发送（确保消息在 ChatPanel 中可见）
  pushTaskToAI: async (taskId, sessionKey) => {
    try {
      const res = await fetch('/api/task-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, sessionKey }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || '构造推送消息失败' };
      }
      return { success: true, message: json.data.message };
    } catch (e) {
      console.error('pushTaskToAI:', e);
      return { success: false, error: e instanceof Error ? e.message : '推送失败' };
    }
  },

  // Config
  loadConfig: async () => {
    const { client, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected) return;
    set({ configLoading: true });
    try {
      const res = await activeClient.getConfig();
      const form = (res.config && typeof res.config === 'object') ? { ...res.config } : {};
      set({
        configForm: form,
        configFormOriginal: JSON.parse(JSON.stringify(form)),
        configHash: res.hash || null,
        configDirty: false,
        configLoading: false,
      });
    } catch (e) {
      console.error('loadConfig:', e);
      set({ configLoading: false, error: e instanceof Error ? e.message : 'Failed to load config' });
    }
  },

  saveConfig: async () => {
    const { client, configForm, configHash, connectionMode, serverProxyConnected } = get();
    const activeClient = connectionMode === 'server_proxy' 
      ? (serverProxyConnected ? getGatewayProxyClient() : null)
      : client;
    if (!activeClient?.isConnected || !configForm || !configHash) return;
    set({ configSaving: true });
    try {
      const raw = JSON.stringify(configForm, null, 2);
      await activeClient.setConfig(raw, configHash);
      set({ configSaving: false, configDirty: false });
      await get().loadConfig();
    } catch (e) {
      console.error('saveConfig:', e);
      set({ configSaving: false, error: e instanceof Error ? e.message : 'Failed to save config' });
    }
  },

  reloadConfig: async () => {
    await get().loadConfig();
  },

  updateConfigForm: (updater) => {
    const { configForm } = get();
    const base = configForm ? JSON.parse(JSON.stringify(configForm)) : {};
    const next = updater(base);
    set({ configForm: next, configDirty: true });
  },

  // 服务端代理模式状态同步
  syncServerProxyStatus: async () => {
    try {
      const res = await fetch('/api/gateway/config');
      const json = await res.json();
      if (json.data) {
        set({
          connectionMode: json.data.mode,
          serverProxyConnected: json.data.mode === 'server_proxy' && json.data.status === 'connected',
          ...(json.data.url ? { gwUrl: json.data.url } : {}),
        });
      } else {
        set({ connectionMode: null, serverProxyConnected: false });
      }
    } catch (e) {
      console.error('syncServerProxyStatus:', e);
      set({ connectionMode: null, serverProxyConnected: false });
    }
  },

  /**
   * 直接设置连接信息（避免重复 fetch）
   * 用于 DataProvider 初始化时直接使用已获取的配置数据
   */
  setConnectionInfo: (mode: 'server_proxy' | 'browser_direct' | null, status: 'connected' | 'disconnected' | 'connecting' | null, url?: string) => {
    set({
      connectionMode: mode,
      serverProxyConnected: mode === 'server_proxy' && status === 'connected',
      ...(url ? { gwUrl: url } : {}),
    });
  },
}));
