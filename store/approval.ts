/**
 * 审批请求 Store
 */
import { create } from 'zustand';
import type { ApprovalRequest } from '@/db/schema';

interface ApprovalState {
  requests: ApprovalRequest[];
  isLoading: boolean;
  error: string | null;
  
  fetchRequests: (params?: { type?: string; status?: string }) => Promise<void>;
  approveRequest: (id: string, note?: string) => Promise<void>;
  rejectRequest: (id: string, note?: string) => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  requests: [],
  isLoading: false,
  error: null,
  
  fetchRequests: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const searchParams = new URLSearchParams();
      if (params?.type) searchParams.set('type', params.type);
      if (params?.status) searchParams.set('status', params.status);
      
      const response = await fetch(`/api/approval-requests?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch approval requests');
      }
      const data = await response.json();
      set({ requests: data.requests || [], isLoading: false });
    } catch (error) {
      console.error('[ApprovalStore] fetchRequests error:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },
  
  approveRequest: async (id, note) => {
    try {
      const response = await fetch(`/api/approval-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve request');
      }
      // 刷新列表
      await get().fetchRequests();
    } catch (error) {
      console.error('[ApprovalStore] approveRequest error:', error);
      throw error;
    }
  },
  
  rejectRequest: async (id, note) => {
    try {
      const response = await fetch(`/api/approval-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject request');
      }
      // 刷新列表
      await get().fetchRequests();
    } catch (error) {
      console.error('[ApprovalStore] rejectRequest error:', error);
      throw error;
    }
  },
  
  cancelRequest: async (id) => {
    try {
      const response = await fetch(`/api/approval-requests/${id}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel request');
      }
      // 刷新列表
      await get().fetchRequests();
    } catch (error) {
      console.error('[ApprovalStore] cancelRequest error:', error);
      throw error;
    }
  },
}));
