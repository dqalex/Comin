import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/db/schema';
import { projectsApi } from '@/lib/data-service';

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  loading: boolean;
  error: string | null;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;
  fetchProjects: () => Promise<void>;
  createProject: (data: { name: string; description?: string }) => Promise<Project | null>;
  updateProjectAsync: (id: string, data: Partial<Project>) => Promise<boolean>;
  deleteProjectAsync: (id: string) => Promise<boolean>;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      loading: false,
      error: null,
      setProjects: (projects) => set({ projects }),
      addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
      updateProject: (id, data) => set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
      })),
      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      })),
      setCurrentProject: (id) => set({ currentProjectId: id }),
      fetchProjects: async () => {
        set({ loading: true, error: null });
        const { data, error } = await projectsApi.getAll();
        if (error) {
          set({ loading: false, error });
        } else {
          // 防御性处理：API 返回可能是裸数组或分页对象
          const projects = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as Project[] || []);
          set({ projects, loading: false, error: null });
        }
      },
      createProject: async (data) => {
        const { data: project, error } = await projectsApi.create(data);
        if (error) {
          set({ error });
          return null;
        }
        if (project) {
          get().addProject(project);
          set({ error: null });
          return project;
        }
        return null;
      },
      updateProjectAsync: async (id, data) => {
        const { data: updated, error } = await projectsApi.update(id, data);
        if (error) {
          set({ error });
          return false;
        }
        if (updated) {
          get().updateProject(id, updated);
        } else {
          await get().fetchProjects();
        }
        set({ error: null });
        return true;
      },
      deleteProjectAsync: async (id) => {
        const { error } = await projectsApi.delete(id);
        if (error) {
          set({ error });
          return false;
        }
        get().deleteProject(id);
        set({ error: null });
        return true;
      },
    }),
    {
      name: 'comind-project-selection',
      partialize: (state: ProjectState) => ({ currentProjectId: state.currentProjectId }),
    }
  )
);
