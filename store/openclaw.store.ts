import { create } from 'zustand';
import type { OpenClawStatus } from '@/db/schema';
import { openclawStatusApi } from '@/lib/data-service';

interface OpenClawStatusState {
  statusList: OpenClawStatus[];
  loading: boolean;
  error: string | null;
  setStatusList: (list: OpenClawStatus[]) => void;
  updateStatus: (memberId: string, data: Partial<OpenClawStatus>) => void;
  getByMemberId: (memberId: string) => OpenClawStatus | undefined;
  fetchStatus: () => Promise<void>;
  upsertStatus: (data: Partial<OpenClawStatus> & { memberId: string }) => Promise<boolean>;
  checkStaleStatus: () => Promise<void>;
}

export const useOpenClawStatusStore = create<OpenClawStatusState>()((set, get) => ({
  statusList: [],
  loading: false,
  error: null,
  setStatusList: (list) => set({ statusList: list }),
  updateStatus: (memberId, data) => set((state) => ({
    statusList: state.statusList.map((s) => 
      s.memberId === memberId ? { ...s, ...data } : s
    ),
  })),
  getByMemberId: (memberId) => get().statusList.find((s) => s.memberId === memberId),
  fetchStatus: async () => {
    set({ loading: true, error: null });
    const { data, error } = await openclawStatusApi.getAll();
    if (error) {
      set({ loading: false, error });
    } else {
      // 防御性处理：API 返回可能是裸数组或包装对象
      const statusList = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as OpenClawStatus[] || []);
      set({ statusList, loading: false, error: null });
    }
  },
  upsertStatus: async (data) => {
    const { error } = await openclawStatusApi.upsert(data);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetchStatus();
    set({ error: null });
    return true;
  },
  checkStaleStatus: async () => {
    try {
      const res = await fetch('/api/openclaw-status/check-stale', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        if (result.reset > 0) {
          // 有状态被重置，重新拉取最新数据
          await get().fetchStatus();
        }
      }
    } catch {
      // 静默失败，不影响其他功能
    }
  },
}));
