/**
 * Skill Store - 状态管理
 * 
 * 遵循 CODING_STANDARDS.md 规范：
 * - updateAsync/createAsync 必须用 API 返回的 data 更新本地状态
 * - deleteAsync 必须等待 API 成功后才移除本地数据
 * - 成功后 set({ error: null })
 */

import { create } from 'zustand';
import type { Skill, NewSkill } from '@/db/schema';
import { skillsApi } from '@/lib/data-service';

// Skill 状态类型
export type SkillStatus = 'draft' | 'pending_approval' | 'active' | 'rejected';
export type SkillTrustStatus = 'trusted' | 'untrusted' | 'pending';
export type SkillCategory = 'content' | 'analysis' | 'research' | 'development' | 'operations' | 'media' | 'custom';

interface SkillState {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  
  // 同步更新方法
  setSkills: (skills: Skill[]) => void;
  addSkill: (skill: Skill) => void;
  updateSkill: (id: string, data: Partial<Skill>) => void;
  deleteSkill: (id: string) => void;
  
  // 查询方法
  getSkillById: (id: string) => Skill | undefined;
  getActiveSkills: () => Skill[];
  getMySkills: (userId: string) => Skill[];
  getSkillsByStatus: (status: SkillStatus) => Skill[];
  getSkillsByCategory: (category: SkillCategory) => Skill[];
  
  // 异步方法
  fetchSkills: (filters?: { status?: string; category?: string }) => Promise<void>;
  createSkill: (data: Omit<NewSkill, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Skill | null>;
  updateSkillAsync: (id: string, data: Partial<Omit<Skill, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteSkillAsync: (id: string) => Promise<boolean>;
  
  // 审批相关
  submitForApproval: (id: string) => Promise<boolean>;
  approveSkill: (id: string, note?: string) => Promise<boolean>;
  rejectSkill: (id: string, note?: string) => Promise<boolean>;
  
  // 信任管理
  trustSkill: (id: string, agentId?: string, note?: string) => Promise<boolean>;
  untrustSkill: (id: string, agentId?: string, note?: string, uninstall?: boolean) => Promise<boolean>;
}

export const useSkillStore = create<SkillState>()((set, get) => ({
  skills: [],
  loading: false,
  error: null,
  
  // 同步更新方法
  setSkills: (skills) => set({ skills }),
  addSkill: (skill) => set((state) => ({ skills: [...state.skills, skill] })),
  updateSkill: (id, data) => set((state) => ({
    skills: state.skills.map((s) => (s.id === id ? { ...s, ...data } : s)),
  })),
  deleteSkill: (id) => set((state) => ({
    skills: state.skills.filter((s) => s.id !== id),
  })),
  
  // 查询方法
  getSkillById: (id) => get().skills.find((s) => s.id === id),
  getActiveSkills: () => get().skills.filter((s) => s.status === 'active'),
  getMySkills: (userId) => get().skills.filter((s) => s.createdBy === userId),
  getSkillsByStatus: (status) => get().skills.filter((s) => s.status === status),
  getSkillsByCategory: (category) => get().skills.filter((s) => s.category === category),
  
  // 异步方法
  fetchSkills: async (filters) => {
    const currentSkills = get().skills;
    set({ loading: true, error: null });
    const { data, error } = await skillsApi.getAll(filters);
    if (error) {
      // 错误时不清空已有数据，只设置 error 状态
      set({ loading: false, error });
      console.warn('[SkillStore] fetchSkills failed, keeping existing data:', error);
    } else {
      // API 返回 { data: Skill[], total, limit, offset }，需要提取 data 数组
      const response = data as { data?: Skill[]; total?: number } | Skill[];
      const skills = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data)) ? response.data : [];
      set({ skills, loading: false, error: null });
    }
  },
  
  createSkill: async (data) => {
    const { data: skill, error } = await skillsApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (skill) {
      get().addSkill(skill);
      set({ error: null });
      return skill;
    }
    return null;
  },
  
  updateSkillAsync: async (id, data) => {
    const { data: updated, error } = await skillsApi.update(id, data);
    if (error) {
      set({ error });
      return false;
    }
    if (updated) {
      get().updateSkill(id, updated);
    } else {
      await get().fetchSkills();
    }
    set({ error: null });
    return true;
  },
  
  deleteSkillAsync: async (id) => {
    const { error } = await skillsApi.delete(id);
    if (error) {
      set({ error });
      return false;
    }
    get().deleteSkill(id);
    set({ error: null });
    return true;
  },
  
  // 审批相关
  submitForApproval: async (id) => {
    const { error } = await skillsApi.submitForApproval(id);
    if (error) {
      set({ error });
      return false;
    }
    // 更新本地状态
    get().updateSkill(id, { status: 'pending_approval' });
    set({ error: null });
    return true;
  },
  
  approveSkill: async (id, note) => {
    const { error } = await skillsApi.approve(id, note);
    if (error) {
      set({ error });
      return false;
    }
    get().updateSkill(id, { status: 'active' });
    set({ error: null });
    return true;
  },
  
  rejectSkill: async (id, note) => {
    const { error } = await skillsApi.reject(id, note);
    if (error) {
      set({ error });
      return false;
    }
    get().updateSkill(id, { status: 'rejected' });
    set({ error: null });
    return true;
  },
  
  // 信任管理
  trustSkill: async (id, agentId, note) => {
    const { error } = await skillsApi.trust(id, { agentId, note });
    if (error) {
      set({ error });
      return false;
    }
    get().updateSkill(id, { trustStatus: 'trusted' });
    set({ error: null });
    return true;
  },
  
  untrustSkill: async (id, agentId, note, uninstall) => {
    const { error } = await skillsApi.untrust(id, { agentId, note, uninstall });
    if (error) {
      set({ error });
      return false;
    }
    get().updateSkill(id, { trustStatus: 'untrusted' });
    set({ error: null });
    return true;
  },
}));

// Factory 兼容层
export const skillStoreApi = {
  get items() { return useSkillStore.getState().skills; },
  get loading() { return useSkillStore.getState().loading; },
  get error() { return useSkillStore.getState().error; },
  fetchItems: (filters?: { status?: string; category?: string }) => 
    useSkillStore.getState().fetchSkills(filters),
  createItem: (data: Omit<NewSkill, 'id' | 'createdAt' | 'updatedAt'>) => 
    useSkillStore.getState().createSkill(data),
  updateItemAsync: (id: string, data: Partial<Omit<Skill, 'id' | 'createdAt'>>) => 
    useSkillStore.getState().updateSkillAsync(id, data),
  deleteItemAsync: (id: string) => 
    useSkillStore.getState().deleteSkillAsync(id),
  setItems: (items: Skill[]) => 
    useSkillStore.getState().setSkills(items),
  addItem: (item: Skill) => 
    useSkillStore.getState().addSkill(item),
  updateItem: (id: string, data: Partial<Skill>) => 
    useSkillStore.getState().updateSkill(id, data),
  removeItem: (id: string) => 
    useSkillStore.getState().deleteSkill(id),
};
