import { create } from 'zustand';
import type { Milestone, NewMilestone } from '@/db/schema';
import { milestonesApi } from '@/lib/data-service';

interface MilestoneState {
  milestones: Milestone[];
  loading: boolean;
  error: string | null;
  setMilestones: (milestones: Milestone[]) => void;
  addMilestone: (milestone: Milestone) => void;
  updateMilestone: (id: string, data: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  setError: (error: string | null) => void;
  getMilestonesByProject: (projectId: string) => Milestone[];
  fetchMilestones: (filters?: { projectId?: string }) => Promise<void>;
  createMilestone: (data: Omit<NewMilestone, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Milestone | null>;
  updateMilestoneAsync: (id: string, data: Partial<Omit<Milestone, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteMilestoneAsync: (id: string) => Promise<boolean>;
}

export const useMilestoneStore = create<MilestoneState>()((set, get) => ({
  milestones: [],
  loading: false,
  error: null,
  setMilestones: (milestones) => set({ milestones }),
  addMilestone: (milestone) => set((state) => ({ milestones: [...state.milestones, milestone] })),
  updateMilestone: (id, data) => set((state) => ({
    milestones: state.milestones.map((m) => (m.id === id ? { ...m, ...data } : m)),
  })),
  deleteMilestone: (id) => set((state) => ({
    milestones: state.milestones.filter((m) => m.id !== id),
  })),
  setError: (error) => set({ error }),
  getMilestonesByProject: (projectId) => get().milestones.filter((m) => m.projectId === projectId),
  fetchMilestones: async (filters) => {
    set({ loading: true, error: null });
    const { data, error } = await milestonesApi.getAll(filters);
    if (error) {
      set({ loading: false, error });
    } else {
      const currentMilestones = get().milestones;
      const serverMilestones = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as Milestone[] || []);
      
      const currentIds = currentMilestones.map(m => `${m.id}:${m.updatedAt}`).sort().join(',');
      const serverIds = serverMilestones.map((m: Milestone) => `${m.id}:${m.updatedAt}`).sort().join(',');
      
      if (currentIds === serverIds) {
        set({ loading: false, error: null });
        return;
      }
      
      set({ milestones: serverMilestones, loading: false, error: null });
    }
  },
  createMilestone: async (data) => {
    const { data: milestone, error } = await milestonesApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (milestone) {
      get().addMilestone(milestone);
      set({ error: null });
      return milestone;
    }
    return null;
  },
  updateMilestoneAsync: async (id, data) => {
    const { data: updated, error } = await milestonesApi.update(id, data);
    if (error) {
      set({ error });
      return false;
    }
    if (updated) {
      get().updateMilestone(id, updated);
    } else {
      await get().fetchMilestones();
    }
    set({ error: null });
    return true;
  },
  deleteMilestoneAsync: async (id) => {
    const { error } = await milestonesApi.delete(id);
    if (error) {
      set({ error });
      return false;
    }
    get().deleteMilestone(id);
    set({ error: null });
    return true;
  },
}));
