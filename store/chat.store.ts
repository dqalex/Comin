/**
 * Chat Store
 * 管理与 OpenClaw AI 的聊天对话（数据库持久化）
 * 
 * v3.0 Phase E 内存优化：
 * - LRU 消息缓存：每个会话最多保留 MAX_MESSAGES_PER_SESSION 条消息
 * - 会话卸载：非活跃会话的消息会被清理
 * 
 * v3.0 Phase F Store 解耦：
 * - 使用 storeEvents 替代直接调用 UIStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storeEvents } from '@/lib/store-events';

// 内存管理配置
const MAX_MESSAGES_PER_SESSION = 200;  // 每个会话最多保留的消息数
const MAX_LOADED_SESSIONS = 5;         // 最多同时加载消息的会话数

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

export type ChatEntityType = 'task' | 'scheduled_task' | 'project';

export interface ChatEntity {
  type: ChatEntityType;
  id: string;
  title: string;
}

export interface ChatSession {
  id: string;
  memberId: string;
  memberName: string;
  title: string;
  messages: ChatMessage[];
  conversationId?: string;
  entity?: ChatEntity;
  createdAt: string;
  updatedAt: string;
  // v3.0 Phase E: 消息加载状态
  messagesLoaded?: boolean;
  hasMoreMessages?: boolean;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  selectedMemberId: string | null;
  sending: boolean;
  initialized: boolean;
  error: string | null;

  // Chat 导航状态（从 ui.store 迁移）
  pendingChatMessage: string | null;
  pendingChatMemberId: string | null;
  pendingGatewaySessionKey: string | null;
  activeGwSessionKey: string | null;

  fetchSessions: () => Promise<void>;
  createSession: (memberId: string, memberName: string) => Promise<string>;
  createEntitySession: (memberId: string, memberName: string, entity: ChatEntity) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  setActiveSession: (sessionId: string | null) => void;
  setSelectedMember: (memberId: string | null) => void;
  getSessionsByMember: (memberId: string) => ChatSession[];
  getEntitySession: (entityType: ChatEntityType, entityId: string, memberId?: string) => ChatSession | undefined;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<string>;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => Promise<void>;
  setSending: (sending: boolean) => void;
  updateSessionConversationId: (sessionId: string, conversationId: string) => Promise<void>;
  loadSessionMessages: (sessionId: string) => Promise<void>;
  
  // v3.0 Phase E: 内存管理方法
  unloadInactiveSessions: () => void;
  trimMessages: (sessionId: string) => void;

  // Chat 导航方法（从 ui.store 迁移）
  openChatWithMessage: (message: string, options?: { memberId?: string; sessionKey?: string }) => void;
  openChatWithSession: (sessionKey: string) => void;
  setActiveGwSessionKey: (key: string | null) => void;
  clearPendingChat: () => void;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface DBSession {
  id: string;
  memberId: string;
  memberName: string;
  title: string;
  conversationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  entityTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: DBMessage[];
}

interface DBMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status?: string | null;
  createdAt: string;
}

function dbSessionToLocal(s: DBSession): ChatSession {
  return {
    id: s.id,
    memberId: s.memberId,
    memberName: s.memberName,
    title: s.title,
    conversationId: s.conversationId || undefined,
    entity: s.entityType ? { type: s.entityType as ChatEntityType, id: s.entityId || '', title: s.entityTitle || '' } : undefined,
    messages: (s.messages || []).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
      status: (m.status as ChatMessage['status']) || 'sent',
    })),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      selectedMemberId: null,
      sending: false,
      initialized: false,
      error: null,

      // Chat 导航状态
      pendingChatMessage: null,
      pendingChatMemberId: null,
      pendingGatewaySessionKey: null,
      activeGwSessionKey: null,

    fetchSessions: async () => {
      const data = await apiRequest<DBSession[]>('/api/chat-sessions');
      if (data) {
        // 防御性处理：API 返回可能是裸数组或分页对象
        const sessionList = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as DBSession[] || []);
        set({
          sessions: sessionList.map(s => dbSessionToLocal({ ...s, messages: [] })),
          initialized: true,
          error: null,
        });
      } else {
        // 问题 #23：失败时设置 initialized 和 error
        set({ initialized: true, error: 'Failed to fetch chat sessions' });
      }
    },

    loadSessionMessages: async (sessionId: string) => {
      const data = await apiRequest<DBSession>(`/api/chat-sessions/${sessionId}`);
      if (data) {
        const localSession = dbSessionToLocal(data);
        localSession.messagesLoaded = true;
        localSession.hasMoreMessages = false; // API 返回所有消息，暂无分页
        
        set((state) => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? localSession : s
          ),
          error: null,
        }));
        
        // 加载后检查是否需要裁剪
        get().trimMessages(sessionId);
      } else {
        set({ error: 'Failed to load session messages' });
      }
    },

    createSession: async (memberId, memberName) => {
      const data = await apiRequest<DBSession>('/api/chat-sessions', {
        method: 'POST',
        body: JSON.stringify({ memberId, memberName }),
      });
      if (data) {
        const session = dbSessionToLocal({ ...data, messages: [] });
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
          selectedMemberId: memberId,
          error: null,
        }));
        return session.id;
      }
      // API 失败不创建本地幽灵 session
      set({ error: 'Failed to create chat session' });
      throw new Error('Failed to create chat session');
    },

    createEntitySession: async (memberId, memberName, entity) => {
      const existing = get().sessions.find(
        (s) => s.entity?.type === entity.type && s.entity?.id === entity.id && s.memberId === memberId
      );
      if (existing) {
        set({ activeSessionId: existing.id, selectedMemberId: memberId });
        return existing.id;
      }

      const ENTITY_LABELS: Record<ChatEntityType, string> = { task: 'Task', scheduled_task: 'Scheduled Task', project: 'Project' };
      const entityLabel = ENTITY_LABELS[entity.type] || entity.type;
      const data = await apiRequest<DBSession>('/api/chat-sessions', {
        method: 'POST',
        body: JSON.stringify({
          memberId,
          memberName,
          title: `${entityLabel}: ${entity.title}`,
          entity,
        }),
      });
      if (data) {
        const session = dbSessionToLocal({ ...data, messages: [] });
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
          selectedMemberId: memberId,
          error: null,
        }));
        return session.id;
      }
      // API 失败不创建本地幽灵 session
      set({ error: 'Failed to create entity chat session' });
      throw new Error('Failed to create entity chat session');
    },

    deleteSession: async (sessionId) => {
      try {
        const res = await fetch(`/api/chat-sessions/${sessionId}`, { method: 'DELETE' });
        if (!res.ok) {
          set({ error: 'Failed to delete chat session' });
          return;
        }
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
          error: null,
        }));
      } catch {
        set({ error: 'Failed to delete chat session' });
      }
    },

    setActiveSession: (sessionId) => {
      set({ activeSessionId: sessionId });
      if (sessionId) {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (session) {
          set({ selectedMemberId: session.memberId });
          // 消息未加载或为空时从数据库加载
          if (!session.messagesLoaded || session.messages.length === 0) {
            get().loadSessionMessages(sessionId);
          }
          // 切换会话后检查是否需要卸载其他会话
          get().unloadInactiveSessions();
        }
      }
    },

    setSelectedMember: (memberId) => set({ selectedMemberId: memberId }),

    getSessionsByMember: (memberId) => {
      return get().sessions.filter((s) => s.memberId === memberId);
    },

    getEntitySession: (entityType, entityId, memberId) => {
      return get().sessions.find(
        (s) => s.entity?.type === entityType && s.entity?.id === entityId && (!memberId || s.memberId === memberId)
      );
    },

    addMessage: async (sessionId, message) => {
      const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const msg: ChatMessage = { ...message, id: msgId, timestamp: now };

      set((state) => ({
        sessions: state.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          const updatedMessages = [...s.messages, msg];
          const title = s.messages.length === 0 && message.role === 'user'
            ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
            : s.title;
          return { 
            ...s, 
            messages: updatedMessages, 
            title, 
            updatedAt: now,
            messagesLoaded: true, // 添加消息时标记为已加载
          };
        }),
      }));

      // 添加消息后检查是否需要裁剪
      get().trimMessages(sessionId);

      const data = await apiRequest<DBMessage>('/api/chat-messages', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          role: message.role,
          content: message.content,
          status: message.status || 'sent',
        }),
      });

      if (!data) {
        // API failed — mark the optimistic message as error
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              messages: s.messages.map((m) => m.id === msgId ? { ...m, status: 'error' as const } : m),
            };
          }),
          error: 'Failed to send message',
        }));
        return msgId;
      }

      if (data.id !== msgId) {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              messages: s.messages.map((m) => m.id === msgId ? { ...m, id: data.id } : m),
            };
          }),
        }));
        return data.id;
      }
      return msgId;
    },

    updateMessage: async (sessionId, messageId, updates) => {
      // 保存旧状态用于回滚
      const prevSessions = get().sessions;
      set((state) => ({
        sessions: state.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            messages: s.messages.map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          };
        }),
      }));
      if (updates.status || updates.content) {
        try {
          const res = await fetch(`/api/chat-messages/${messageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: updates.status, content: updates.content }),
          });
          if (!res.ok) {
            // API 失败，回滚本地状态
            set({ sessions: prevSessions });
          }
        } catch {
          // 网络异常，回滚本地状态
          set({ sessions: prevSessions });
        }
      }
    },

    setSending: (sending) => set({ sending }),

    updateSessionConversationId: async (sessionId, conversationId) => {
      // 保存旧状态用于回滚
      const prevSessions = get().sessions;
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, conversationId } : s
        ),
      }));
      try {
        const res = await fetch(`/api/chat-sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        });
        if (!res.ok) {
          set({ sessions: prevSessions });
        }
      } catch {
        set({ sessions: prevSessions });
      }
    },

    // Chat 导航方法（使用事件总线解耦）
    // v3.0 多用户：支持指定 sessionKey 实现用户专用会话
    openChatWithMessage: (message, options) => {
      const { memberId, sessionKey } = options || {};
      storeEvents.emit('ui:chatOpen', { open: true });
      storeEvents.emit('ui:chatNavigate', { message, memberId, sessionKey });
      set({
        pendingChatMessage: message,
        pendingChatMemberId: memberId || null,
        // v3.0 多用户：如果提供了 sessionKey，优先使用
        pendingGatewaySessionKey: sessionKey || null,
        activeGwSessionKey: sessionKey || null,
      });
    },

    openChatWithSession: (sessionKey) => {
      storeEvents.emit('ui:chatOpen', { open: true });
      storeEvents.emit('ui:chatNavigate', { sessionKey });
      set({
        pendingGatewaySessionKey: sessionKey,
        activeGwSessionKey: sessionKey,
        pendingChatMessage: null,
        pendingChatMemberId: null,
      });
    },

    setActiveGwSessionKey: (key) => set({ activeGwSessionKey: key }),

    clearPendingChat: () => set({
      pendingChatMessage: null,
      pendingChatMemberId: null,
      pendingGatewaySessionKey: null,
    }),

    // v3.0 Phase E: 内存管理 - 卸载非活跃会话的消息
    unloadInactiveSessions: () => {
      const { sessions, activeSessionId } = get();
      const loadedSessions = sessions.filter(s => s.messagesLoaded && s.messages.length > 0);
      
      // 如果加载的会话数超过限制，卸载最早访问的
      if (loadedSessions.length > MAX_LOADED_SESSIONS) {
        const toUnload = loadedSessions
          .filter(s => s.id !== activeSessionId) // 不卸载当前活跃会话
          .slice(0, loadedSessions.length - MAX_LOADED_SESSIONS);
        
        if (toUnload.length > 0) {
          set((state) => ({
            sessions: state.sessions.map(s => 
              toUnload.some(u => u.id === s.id)
                ? { ...s, messages: [], messagesLoaded: false }
                : s
            ),
          }));
        }
      }
    },

    // v3.0 Phase E: 内存管理 - 裁剪消息数量
    trimMessages: (sessionId: string) => {
      set((state) => ({
        sessions: state.sessions.map(s => {
          if (s.id !== sessionId) return s;
          if (s.messages.length <= MAX_MESSAGES_PER_SESSION) return s;
          // 保留最新的 N 条消息
          return {
            ...s,
            messages: s.messages.slice(-MAX_MESSAGES_PER_SESSION),
            hasMoreMessages: true,
          };
        }),
      }));
    },
  }),
  {
    name: 'teamclaw-chat',
    // 仅持久化 activeGwSessionKey（从 ui.store 的 partialize 迁移过来）
    partialize: (state) => ({
      activeGwSessionKey: state.activeGwSessionKey,
    }),
  }
  )
);
