/**
 * 认证 Store
 * - 管理当前登录用户状态
 * - 登录/登出操作
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserPreferences } from '@/db/schema';

// 不包含敏感字段的用户类型
export type SafeUser = Omit<User, 'passwordHash' | 'lockedUntil'>;

interface AuthState {
  // 状态
  user: SafeUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, 'name' | 'avatar' | 'preferences'>>) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      /**
       * 登录
       */
      login: async (email: string, password: string): Promise<boolean> => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            set({ isLoading: false, error: data.error || '登录失败' });
            return false;
          }
          
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          
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
       * 注册
       */
      register: async (email: string, password: string, name: string): Promise<boolean> => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            set({ isLoading: false, error: data.error || '注册失败' });
            return false;
          }
          
          // 注册成功后自动登录
          return get().login(email, password);
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : '网络请求失败',
          });
          return false;
        }
      },

      /**
       * 登出
       */
      logout: async (): Promise<void> => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          // 忽略网络错误，继续清除本地状态
        }
        
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      /**
       * 获取当前用户信息
       */
      fetchCurrentUser: async (): Promise<void> => {
        set({ isLoading: true });
        
        try {
          const response = await fetch('/api/auth/me');
          
          if (!response.ok) {
            // 未登录或 session 过期
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
            return;
          }
          
          const data = await response.json();
          
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      /**
       * 更新个人信息
       */
      updateProfile: async (updates): Promise<boolean> => {
        const { user } = get();
        if (!user) return false;
        
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`/api/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            set({ isLoading: false, error: data.error || '更新失败' });
            return false;
          }
          
          set({
            user: data,
            isLoading: false,
            error: null,
          });
          
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
       * 修改密码
       */
      changePassword: async (currentPassword: string, newPassword: string): Promise<boolean> => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch('/api/auth/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            set({ isLoading: false, error: data.error || '修改密码失败' });
            return false;
          }
          
          set({ isLoading: false, error: null });
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
    }),
    {
      name: 'auth-storage',
      // 只持久化基本状态，不持久化敏感信息
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ============================================================
// CRUD Factory 兼容层
// 提供与 createCrudStore 一致的接口（Auth Store 为特殊 Store，提供简化兼容层）
// ============================================================

export const authStoreApi = {
  // 状态访问
  get user() { return useAuthStore.getState().user; },
  get isLoading() { return useAuthStore.getState().isLoading; },
  get isAuthenticated() { return useAuthStore.getState().isAuthenticated; },
  get error() { return useAuthStore.getState().error; },
  
  // 认证操作
  login: (email: string, password: string) => useAuthStore.getState().login(email, password),
  register: (email: string, password: string, name: string) => useAuthStore.getState().register(email, password, name),
  logout: () => useAuthStore.getState().logout(),
  fetchCurrentUser: () => useAuthStore.getState().fetchCurrentUser(),
  updateProfile: (updates: Partial<Pick<User, 'name' | 'avatar' | 'preferences'>>) => useAuthStore.getState().updateProfile(updates),
  changePassword: (currentPassword: string, newPassword: string) => useAuthStore.getState().changePassword(currentPassword, newPassword),
  
  // 状态管理
  setError: (error: string | null) => useAuthStore.setState({ error }),
  clearError: () => useAuthStore.getState().clearError(),
  reset: () => useAuthStore.setState({ 
    user: null, 
    isLoading: false, 
    isAuthenticated: false, 
    error: null 
  }),
};
