import { create } from 'zustand';
import type { TaskLog } from '@/db/schema';
import { taskLogsApi } from '@/lib/data-service';

interface TaskLogState {
  logs: TaskLog[];
  loading: boolean;
  error: string | null;
  setLogs: (logs: TaskLog[]) => void;
  getByTask: (taskId: string) => TaskLog[];
  fetchLogsByTask: (taskId: string) => Promise<void>;
  createLog: (data: { taskId: string; action: string; message: string }) => Promise<TaskLog | null>;
}

export const useTaskLogStore = create<TaskLogState>()((set, get) => ({
  logs: [],
  loading: false,
  error: null,
  setLogs: (logs) => set({ logs }),
  getByTask: (taskId) => get().logs.filter((l) => l.taskId === taskId),
  fetchLogsByTask: async (taskId) => {
    set({ loading: true, error: null });
    const { data, error } = await taskLogsApi.getByTask(taskId);
    if (error) {
      set({ loading: false, error });
    } else {
      const otherLogs = get().logs.filter((l) => l.taskId !== taskId);
      set({ logs: [...otherLogs, ...(data || [])], loading: false, error: null });
    }
  },
  createLog: async (data) => {
    const { data: log, error } = await taskLogsApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (log) {
      set((state) => ({ logs: [...state.logs, log], error: null }));
      return log;
    }
    return null;
  },
}));
