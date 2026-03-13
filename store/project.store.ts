import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/db/schema';
import { projectsApi } from '@/lib/data-service';

// ============================================================
// Project Store 类型定义
// ============================================================
interface ProjectState {
  // 数据
  projects: Project[];
  currentProjectId: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  // 本地操作
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;
  
  // 异步操作
  fetchProjects: () => Promise<void>;
  createProject: (data: { name: string; description?: string; visibility?: 'private' | 'team' | 'public' }) => Promise<Project | null>;
  updateProjectAsync: (id: string, data: Partial<Project>) => Promise<boolean>;
  deleteProjectAsync: (id: string) => Promise<boolean>;
}

// ============================================================
// 创建 Project Store
// ============================================================
export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // ==================== 初始状态 ====================
      projects: [],
      currentProjectId: null,
      loading: false,
      error: null,
      initialized: false,

      // ==================== 本地操作 ====================
      setProjects: (projects) => set({ projects, initialized: true }),
      
      addProject: (project) => set((state) => ({ 
        projects: [...state.projects, project] 
      })),
      
      updateProject: (id, data) => set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
      })),
      
      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      })),
      
      setCurrentProject: (id) => set({ currentProjectId: id }),

      // ==================== 异步操作 ====================
      fetchProjects: async () => {
        set({ loading: true, error: null });
        const { data, error } = await projectsApi.getAll();
        if (error) {
          set({ loading: false, error });
        } else {
          // 防御性处理：API 返回可能是裸数组或分页对象
          const projects = Array.isArray(data) 
            ? data 
            : ((data as unknown as Record<string, unknown>)?.data as Project[] || []);
          set({ projects, loading: false, error: null, initialized: true });
        }
      },

      createProject: async (data) => {
        set({ loading: true, error: null });
        const { data: project, error } = await projectsApi.create(data);
        if (error) {
          set({ loading: false, error });
          return null;
        }
        if (project) {
          set((state) => ({
            projects: [...state.projects, project],
            loading: false,
            error: null,
          }));
          return project;
        }
        return null;
      },

      updateProjectAsync: async (id, data) => {
        set({ loading: true, error: null });
        const { data: updated, error } = await projectsApi.update(id, data);
        if (error) {
          set({ loading: false, error });
          return false;
        }
        if (updated) {
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)),
            loading: false,
            error: null,
          }));
        } else {
          await get().fetchProjects();
          set({ loading: false, error: null });
        }
        return true;
      },

      deleteProjectAsync: async (id) => {
        set({ loading: true, error: null });
        const { error } = await projectsApi.delete(id);
        if (error) {
          set({ loading: false, error });
          return false;
        }
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          loading: false,
          error: null,
        }));
        return true;
      },
    }),
    {
      name: 'teamclaw-project-selection',
      partialize: (state: ProjectState) => ({ currentProjectId: state.currentProjectId }),
    }
  )
);

// ============================================================
// CRUD Factory 兼容层
// 提供与 createCrudStore 一致的接口
// ============================================================

export const projectStoreApi = {
  // 状态访问
  get items() { return useProjectStore.getState().projects; },
  get loading() { return useProjectStore.getState().loading; },
  get error() { return useProjectStore.getState().error; },
  get initialized() { return useProjectStore.getState().initialized; },
  
  // 本地操作（与 createCrudStore 兼容）
  setItems: (items: Project[]) => useProjectStore.getState().setProjects(items),
  addItem: (item: Project) => useProjectStore.getState().addProject(item),
  updateItem: (id: string, updates: Partial<Project>) => useProjectStore.getState().updateProject(id, updates),
  removeItem: (id: string) => useProjectStore.getState().deleteProject(id),
  
  // 异步操作（与 createCrudStore 兼容）
  fetchItems: () => useProjectStore.getState().fetchProjects(),
  createItem: (data: Partial<Project>) => useProjectStore.getState().createProject(data as any),
  updateItemAsync: (id: string, data: Partial<Project>) => useProjectStore.getState().updateProjectAsync(id, data),
  deleteItemAsync: (id: string) => useProjectStore.getState().deleteProjectAsync(id),
  
  // 状态管理
  setLoading: (loading: boolean) => useProjectStore.setState({ loading }),
  setError: (error: string | null) => useProjectStore.setState({ error }),
  clearError: () => useProjectStore.setState({ error: null }),
  reset: () => useProjectStore.setState({ 
    projects: [], 
    loading: false, 
    error: null, 
    initialized: false 
  }),
};
