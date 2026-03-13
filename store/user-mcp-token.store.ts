/**
 * 用户 MCP Token Store
 * - 管理当前用户的 MCP Token
 */

import { create } from 'zustand';
import type { UserMcpToken } from '@/db/schema';

// 不包含加密内容的 Token 类型
export type SafeUserMcpToken = Omit<UserMcpToken, 'tokenHash' | 'encryptedToken' | 'userId'>;

interface UserMcpTokenState {
  // 状态
  tokens: SafeUserMcpToken[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTokens: () => Promise<void>;
  createToken: (name?: string, permissions?: string[], expiresAt?: Date | null) => Promise<{
    token: string;
    data: SafeUserMcpToken;
  } | null>;
  updateToken: (id: string, updates: Partial<Pick<UserMcpToken, 'name' | 'permissions' | 'status'>>) => Promise<boolean>;
  deleteToken: (id: string) => Promise<boolean>;
  clearError: () => void;
}

export const useUserMcpTokenStore = create<UserMcpTokenState>((set, get) => ({
  // 初始状态
  tokens: [],
  isLoading: false,
  error: null,

  /**
   * 获取当前用户的所有 Token
   */
  fetchTokens: async (): Promise<void> => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/api/user-mcp-tokens');
      const data = await response.json();
      
      if (!response.ok) {
        set({ isLoading: false, error: data.error || '获取 Token 列表失败' });
        return;
      }
      
      const tokens = Array.isArray(data) ? data : [];
      set({ tokens, isLoading: false, error: null });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : '网络请求失败',
      });
    }
  },

  /**
   * 创建新 Token
   * @returns 创建成功返回明文 token 和 token 数据，失败返回 null
   */
  createToken: async (name = '', permissions: string[] = [], expiresAt: Date | null = null) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/api/user-mcp-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          permissions,
          expiresAt: expiresAt?.toISOString() || null,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        set({ isLoading: false, error: data.error || '创建 Token 失败' });
        return null;
      }
      
      // 更新本地列表（不包含明文 token）
      const { token, ...tokenData } = data;
      set((state) => ({
        tokens: [tokenData, ...state.tokens],
        isLoading: false,
        error: null,
      }));
      
      // 返回明文 token（只有这一次机会）
      return { token, data: tokenData };
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : '网络请求失败',
      });
      return null;
    }
  },

  /**
   * 更新 Token
   */
  updateToken: async (id, updates): Promise<boolean> => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/user-mcp-tokens/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        set({ isLoading: false, error: data.error || '更新 Token 失败' });
        return false;
      }
      
      // 更新本地状态
      set((state) => ({
        tokens: state.tokens.map((t) => (t.id === id ? data : t)),
        isLoading: false,
        error: null,
      }));
      
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : '网络请求失败',
      });
      return false;
    }
  },

  /**
   * 删除 Token
   */
  deleteToken: async (id): Promise<boolean> => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/user-mcp-tokens/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        set({ isLoading: false, error: data.error || '删除 Token 失败' });
        return false;
      }
      
      // 更新本地状态
      set((state) => ({
        tokens: state.tokens.filter((t) => t.id !== id),
        isLoading: false,
        error: null,
      }));
      
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : '网络请求失败',
      });
      return false;
    }
  },

  /**
   * 清除错误
   */
  clearError: (): void => {
    set({ error: null });
  },
}));
