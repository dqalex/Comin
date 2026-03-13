import { create } from 'zustand';
import type { Task, NewTask } from '@/db/schema';
import { tasksApi } from '@/lib/data-service';

interface TaskState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setError: (error: string | null) => void;
  getTasksByProject: (projectId: string) => Task[];
  getTasksByMember: (memberId: string) => Task[];
  getGlobalTasks: () => Task[];
  getCrossProjectTasks: (projectId: string) => Task[];
  fetchTasks: (filters?: { projectId?: string; memberId?: string }) => Promise<void>;
  createTask: (data: Omit<NewTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task | null>;
  updateTaskAsync: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteTaskAsync: (id: string) => Promise<boolean>;
}

export const useTaskStore = create<TaskState>()((set, get) => ({
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
  setError: (error) => set({ error }),
  getTasksByProject: (projectId) => get().tasks.filter((t) => 
    t.projectId === projectId || (Array.isArray(t.crossProjects) && t.crossProjects.includes(projectId))
  ),
  getTasksByMember: (memberId) => get().tasks.filter((t) => Array.isArray(t.assignees) && t.assignees.includes(memberId)),
  getGlobalTasks: () => get().tasks.filter((t) => !t.projectId),
  getCrossProjectTasks: (projectId) => get().tasks.filter((t) => 
    Array.isArray(t.crossProjects) && t.crossProjects.includes(projectId)
  ),
  fetchTasks: async (filters) => {
    set({ loading: true, error: null });
    const { data, error } = await tasksApi.getAll(filters);
    if (error) {
      set({ loading: false, error });
    } else {
      const currentTasks = get().tasks;
      const serverTasks = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as Task[] || []);
      
      // 避免无变化时触发重渲染：比较任务 ID 集合和更新时间
      const currentIds = currentTasks.map(t => `${t.id}:${t.updatedAt}`).sort().join(',');
      const serverIds = serverTasks.map((t: Task) => `${t.id}:${t.updatedAt}`).sort().join(',');
      
      if (currentIds === serverIds) {
        set({ loading: false, error: null });
        return;
      }
      
      // 直接使用服务端数据（问题 #7：不保留 localOnly 以避免幽灵数据）
      set({ tasks: serverTasks, loading: false, error: null });
    }
  },
  createTask: async (data) => {
    const { data: task, error } = await tasksApi.create(data);
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
    const { data: updated, error } = await tasksApi.update(id, data);
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
    const { error } = await tasksApi.delete(id);
    if (error) {
      set({ error });
      return false;
    }
    get().deleteTask(id);
    set({ error: null });
    return true;
  },
}));

// ============================================================
// Factory 兼容层
// 提供与 createCrudStore 一致的接口，便于未来迁移
// ============================================================

export const taskStoreApi = {
  /** 获取所有任务 */
  get items() { return useTaskStore.getState().tasks; },
  /** 获取加载状态 */
  get loading() { return useTaskStore.getState().loading; },
  /** 获取错误信息 */
  get error() { return useTaskStore.getState().error; },
  /** 获取所有任务（异步） */
  fetchItems: (filters?: { projectId?: string; memberId?: string }) => 
    useTaskStore.getState().fetchTasks(filters),
  /** 创建任务 */
  createItem: (data: Omit<NewTask, 'id' | 'createdAt' | 'updatedAt'>) => 
    useTaskStore.getState().createTask(data),
  /** 更新任务 */
  updateItemAsync: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>) => 
    useTaskStore.getState().updateTaskAsync(id, data),
  /** 删除任务 */
  deleteItemAsync: (id: string) => 
    useTaskStore.getState().deleteTaskAsync(id),
  /** 设置任务列表 */
  setItems: (items: Task[]) => 
    useTaskStore.getState().setTasks(items),
  /** 添加单个任务 */
  addItem: (item: Task) => 
    useTaskStore.getState().addTask(item),
  /** 更新单个任务（本地） */
  updateItem: (id: string, data: Partial<Task>) => 
    useTaskStore.getState().updateTask(id, data),
  /** 删除单个任务（本地） */
  removeItem: (id: string) => 
    useTaskStore.getState().deleteTask(id),
};
