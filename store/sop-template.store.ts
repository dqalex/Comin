/**
 * SOP 模板 Store
 * v3.0 新增
 */
import { create } from 'zustand';
import type { SOPTemplate, NewSOPTemplate } from '@/db/schema';
import { sopTemplatesApi } from '@/lib/data-service';

interface SOPTemplateFilters {
  category?: string;
  status?: string;
  projectId?: string;
  includeGlobal?: boolean;
}

interface SOPTemplateState {
  templates: SOPTemplate[];
  loading: boolean;
  error: string | null;
  
  // 基础操作
  setTemplates: (templates: SOPTemplate[]) => void;
  addTemplate: (template: SOPTemplate) => void;
  updateTemplate: (id: string, data: Partial<SOPTemplate>) => void;
  deleteTemplate: (id: string) => void;
  
  // 获取器
  getTemplateById: (id: string) => SOPTemplate | undefined;
  getTemplatesByCategory: (category: string) => SOPTemplate[];
  getActiveTemplates: () => SOPTemplate[];
  getBuiltinTemplates: () => SOPTemplate[];
  getProjectTemplates: (projectId: string) => SOPTemplate[];
  
  // 异步操作
  fetchTemplates: (filters?: SOPTemplateFilters) => Promise<void>;
  createTemplate: (data: Omit<NewSOPTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SOPTemplate | null>;
  updateTemplateAsync: (id: string, data: Partial<Omit<SOPTemplate, 'id' | 'createdAt' | 'isBuiltin'>>) => Promise<boolean>;
  deleteTemplateAsync: (id: string) => Promise<boolean>;
}

export const useSOPTemplateStore = create<SOPTemplateState>()((set, get) => ({
  templates: [],
  loading: false,
  error: null,
  
  // 基础操作
  setTemplates: (templates) => set({ templates }),
  addTemplate: (template) => set((state) => ({ templates: [...state.templates, template] })),
  updateTemplate: (id, data) => set((state) => ({
    templates: state.templates.map((t) => (t.id === id ? { ...t, ...data } : t)),
  })),
  deleteTemplate: (id) => set((state) => ({
    templates: state.templates.filter((t) => t.id !== id),
  })),
  
  // 获取器
  getTemplateById: (id) => get().templates.find((t) => t.id === id),
  getTemplatesByCategory: (category) => get().templates.filter((t) => t.category === category),
  getActiveTemplates: () => get().templates.filter((t) => t.status === 'active'),
  getBuiltinTemplates: () => get().templates.filter((t) => t.isBuiltin),
  getProjectTemplates: (projectId) => get().templates.filter((t) => 
    t.projectId === projectId || t.projectId === null
  ),
  
  // 异步操作
  fetchTemplates: async (filters) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await sopTemplatesApi.getAll(filters as Record<string, string | undefined>);
      if (error) {
        set({ loading: false, error });
      } else {
        // 防御性处理：API 可能返回裸数组或 { data: [], total } 分页格式
        const templates = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as SOPTemplate[] || []);
        set({ templates, loading: false, error: null });
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '获取 SOP 模板失败' });
    }
  },
  
  createTemplate: async (data) => {
    try {
      const { data: template, error } = await sopTemplatesApi.create(data);
      if (error) {
        set({ error });
        return null;
      }
      if (template) {
        get().addTemplate(template);
        set({ error: null });
        return template;
      }
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '创建 SOP 模板失败' });
      return null;
    }
  },
  
  updateTemplateAsync: async (id, data) => {
    try {
      const { data: updated, error } = await sopTemplatesApi.update(id, data);
      if (error) {
        set({ error });
        return false;
      }
      if (updated) {
        get().updateTemplate(id, updated);
      } else {
        await get().fetchTemplates();
      }
      set({ error: null });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '更新 SOP 模板失败' });
      return false;
    }
  },
  
  deleteTemplateAsync: async (id) => {
    try {
      const { error } = await sopTemplatesApi.delete(id);
      if (error) {
        set({ error });
        return false;
      }
      get().deleteTemplate(id);
      set({ error: null });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '删除 SOP 模板失败' });
      return false;
    }
  },
}));
