import { create } from 'zustand';
import type { ScheduledTask, NewScheduledTask } from '@/db/schema';
import { scheduledTasksApi } from '@/lib/data-service';

interface ScheduledTaskState {
  tasks: ScheduledTask[];
  loading: boolean;
  error: string | null;
  setTasks: (tasks: ScheduledTask[]) => void;
  addTask: (task: ScheduledTask) => void;
  updateTask: (id: string, data: Partial<ScheduledTask>) => void;
  deleteTask: (id: string) => void;
  getByMemberId: (memberId: string) => ScheduledTask[];
  fetchTasks: () => Promise<void>;
  createTask: (data: Omit<NewScheduledTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ScheduledTask | null>;
  updateTaskAsync: (id: string, data: Partial<Omit<ScheduledTask, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteTaskAsync: (id: string) => Promise<boolean>;
}

export const useScheduledTaskStore = create<ScheduledTaskState>()((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, data) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
  })),
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
  })),
  getByMemberId: (memberId) => get().tasks.filter((t) => t.memberId === memberId),
  fetchTasks: async () => {
    set({ loading: true, error: null });
    const { data, error } = await scheduledTasksApi.getAll();
    if (error) {
      set({ loading: false, error });
    } else {
      // 防御性处理：API 返回可能是裸数组或分页对象
      const tasks = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as ScheduledTask[] || []);
      set({ tasks, loading: false, error: null });
    }
  },
  createTask: async (data) => {
    const { data: task, error } = await scheduledTasksApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (task) {
      get().addTask(task);
      set({ error: null });
      return task;
    }
    return null;
  },
  updateTaskAsync: async (id, data) => {
    const { data: updated, error } = await scheduledTasksApi.update(id, data);
    if (error) {
      set({ error });
      return false;
    }
    if (updated) {
      get().updateTask(id, updated);
    } else {
      await get().fetchTasks();
    }
    set({ error: null });
    return true;
  },
  deleteTaskAsync: async (id) => {
    const { error } = await scheduledTasksApi.delete(id);
    if (error) {
      set({ error });
      return false;
    }
    get().deleteTask(id);
    set({ error: null });
    return true;
  },
}));
