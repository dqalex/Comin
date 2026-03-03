/**
 * OpenClaw Workspace Store
 * 
 * 管理 OpenClaw workspace 的状态
 */

import { create } from 'zustand';
import type { OpenClawWorkspace, OpenClawFile } from '@/db/schema';
import { useDocumentStore } from '@/store/document.store';

interface WorkspaceState {
  workspaces: OpenClawWorkspace[];
  files: OpenClawFile[];
  loading: boolean;
  syncing: boolean;
  scanning: boolean;
  error: string | null;
  currentWorkspace: OpenClawWorkspace | null;

  // Actions
  fetchWorkspaces: () => Promise<void>;
  fetchFiles: (workspaceId?: string) => Promise<void>;
  createWorkspace: (data: {
    name: string;
    path: string;
    memberId?: string;
    isDefault?: boolean;
    syncEnabled?: boolean;
    watchEnabled?: boolean;
    syncInterval?: number;
    excludePatterns?: string[];
  }) => Promise<OpenClawWorkspace | null>;
  updateWorkspace: (id: string, data: Partial<OpenClawWorkspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (workspace: OpenClawWorkspace | null) => void;
  syncWorkspace: (id: string, mode?: 'full' | 'incremental') => Promise<{
    synced: number;
    created: number;
    updated: number;
    conflicts: number;
    errors: Array<{ file: string; error: string }>;
  } | null>;
  scanWorkspace: (id: string) => Promise<{
    total: number;
    byType: Record<string, number>;
    files: Array<{
      path: string;
      type: string;
      size: number;
      modifiedAt: Date;
      status: 'new' | 'modified' | 'synced' | 'conflict';
    }>;
  } | null>;
  getWorkspaceStatus: (id: string) => Promise<{
    status: string;
    lastSyncAt: Date | null;
    totalFiles: number;
    syncedFiles: number;
    pendingFiles: number;
    conflictFiles: number;
  } | null>;
}

export const useOpenClawWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  files: [],
  loading: false,
  syncing: false,
  scanning: false,
  error: null,
  currentWorkspace: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/openclaw-workspaces');
      if (!res.ok) {
        set({ error: `Failed to fetch workspaces (${res.status})`, loading: false });
        return;
      }
      const data = await res.json();
      if (data.data) {
        set({ workspaces: data.data, loading: false, error: null });
      } else {
        set({ error: data.error || 'Failed to fetch workspaces', loading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', loading: false });
    }
  },

  fetchFiles: async (workspaceId?: string) => {
    set({ loading: true, error: null });
    try {
      const url = workspaceId 
        ? `/api/openclaw-files?workspace_id=${workspaceId}`
        : '/api/openclaw-files';
      const res = await fetch(url);
      if (!res.ok) {
        set({ error: `Failed to fetch files (${res.status})`, loading: false });
        return;
      }
      const data = await res.json();
      if (data.data) {
        set({ files: data.data, loading: false, error: null });
      } else {
        set({ error: data.error || 'Failed to fetch files', loading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', loading: false });
    }
  },

  createWorkspace: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/openclaw-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        set({ error: errBody.error || `Failed to create workspace (${res.status})`, loading: false });
        return null;
      }
      const result = await res.json();
      if (result.data) {
        set((state) => ({
          workspaces: [...state.workspaces, result.data],
          loading: false,
          error: null,
        }));
        return result.data;
      } else {
        set({ error: result.error || 'Failed to create workspace', loading: false });
        return null;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', loading: false });
      return null;
    }
  },

  updateWorkspace: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/openclaw-workspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        set({ error: errBody.error || `Failed to update workspace (${res.status})`, loading: false });
        return;
      }
      const result = await res.json();
      if (result.data) {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? result.data : w
          ),
          currentWorkspace: state.currentWorkspace?.id === id 
            ? result.data 
            : state.currentWorkspace,
          loading: false,
          error: null,
        }));
      } else {
        set({ error: result.error || 'Failed to update workspace', loading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', loading: false });
    }
  },

  deleteWorkspace: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/openclaw-workspaces/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        set({ error: errBody.error || `Failed to delete workspace (${res.status})`, loading: false });
        return;
      }
      set((state) => ({
        workspaces: state.workspaces.filter((w) => w.id !== id),
        currentWorkspace: state.currentWorkspace?.id === id 
          ? null 
          : state.currentWorkspace,
        loading: false,
        error: null,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', loading: false });
    }
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
  },

  syncWorkspace: async (id, mode = 'incremental') => {
    set({ syncing: true, error: null });
    try {
      const res = await fetch(`/api/openclaw-workspaces/${id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        set({ error: errBody.error || 'Sync failed', syncing: false });
        return null;
      }
      const result = await res.json();
      
      // 重新获取 workspace 以更新 lastSyncAt
      const wsRes = await fetch('/api/openclaw-workspaces');
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        if (wsData.data) {
          set({ workspaces: wsData.data, syncing: false, error: null });
        }
      } else {
        set({ syncing: false, error: null });
      }
      
      // 同步完成后刷新文档 Store，确保 wiki 页面能看到新同步的文档
      useDocumentStore.getState().fetchDocuments();
      
      return result.data ?? result;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', syncing: false });
      return null;
    }
  },

  scanWorkspace: async (id) => {
    set({ scanning: true, error: null });
    try {
      const res = await fetch(`/api/openclaw-workspaces/${id}/scan`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        set({ error: errBody.error || 'Scan failed', scanning: false });
        return null;
      }
      const result = await res.json();
      set({ scanning: false, error: null });
      return result.data ?? result;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', scanning: false });
      return null;
    }
  },

  getWorkspaceStatus: async (id) => {
    try {
      const res = await fetch(`/api/openclaw-workspaces/${id}/status`);
      if (!res.ok) return null;
      const result = await res.json();
      return result.data ?? null;
    } catch {
      return null;
    }
  },
}));
