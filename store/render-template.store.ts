/**
 * 渲染模板 Store
 * v3.0 新增
 */
import { create } from 'zustand';
import type { RenderTemplate, NewRenderTemplate } from '@/db/schema';
import { renderTemplatesApi } from '@/lib/data-service';

interface RenderTemplateFilters {
  category?: string;
  status?: string;
}

interface RenderTemplateState {
  templates: RenderTemplate[];
  loading: boolean;
  error: string | null;
  
  // 基础操作
  setTemplates: (templates: RenderTemplate[]) => void;
  addTemplate: (template: RenderTemplate) => void;
  updateTemplate: (id: string, data: Partial<RenderTemplate>) => void;
  deleteTemplate: (id: string) => void;
  
  // 获取器
  getTemplateById: (id: string) => RenderTemplate | undefined;
  getTemplatesByCategory: (category: string) => RenderTemplate[];
  getActiveTemplates: () => RenderTemplate[];
  getBuiltinTemplates: () => RenderTemplate[];
  
  // 异步操作
  fetchTemplates: (filters?: RenderTemplateFilters) => Promise<void>;
  createTemplate: (data: Omit<NewRenderTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<RenderTemplate | null>;
  updateTemplateAsync: (id: string, data: Partial<Omit<RenderTemplate, 'id' | 'createdAt' | 'isBuiltin'>>) => Promise<boolean>;
  deleteTemplateAsync: (id: string) => Promise<boolean>;
}

export const useRenderTemplateStore = create<RenderTemplateState>()((set, get) => ({
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
  
  // 异步操作
  fetchTemplates: async (filters) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await renderTemplatesApi.getAll(filters as Record<string, string | undefined>);
      if (error) {
        set({ loading: false, error });
      } else {
        // 防御性处理：API 可能返回裸数组或 { data: [], total } 分页格式
        const templates = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as RenderTemplate[] || []);
        set({ templates, loading: false, error: null });
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '获取渲染模板失败' });
    }
  },
  
  createTemplate: async (data) => {
    try {
      const { data: template, error } = await renderTemplatesApi.create(data);
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
      set({ error: err instanceof Error ? err.message : '创建渲染模板失败' });
      return null;
    }
  },
  
  updateTemplateAsync: async (id, data) => {
    try {
      const { data: updated, error } = await renderTemplatesApi.update(id, data);
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
      set({ error: err instanceof Error ? err.message : '更新渲染模板失败' });
      return false;
    }
  },
  
  deleteTemplateAsync: async (id) => {
    try {
      const { error } = await renderTemplatesApi.delete(id);
      if (error) {
        set({ error });
        return false;
      }
      get().deleteTemplate(id);
      set({ error: null });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '删除渲染模板失败' });
      return false;
    }
  },
}));
