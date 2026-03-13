import { create } from 'zustand';
import type { Document, NewDocument } from '@/db/schema';
import { documentsApi } from '@/lib/data-service';

interface DocumentState {
  documents: Document[];
  loading: boolean;
  error: string | null;
  setDocuments: (documents: Document[]) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, data: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
  getDocumentsByProject: (projectId: string, projectName?: string) => Document[];
  getDocumentsByProjectTag: (projectName: string) => Document[];
  getUntaggedDocuments: () => Document[];
  fetchDocuments: (filters?: { projectId?: string; source?: string }) => Promise<void>;
  createDocument: (data: Omit<NewDocument, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Document | null>;
  updateDocumentAsync: (id: string, data: Partial<Omit<Document, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteDocumentAsync: (id: string) => Promise<boolean>;
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  documents: [],
  loading: false,
  error: null,
  setDocuments: (documents) => set({ documents }),
  addDocument: (document) => set((state) => ({ documents: [...state.documents, document] })),
  updateDocument: (id, data) => set((state) => ({
    documents: state.documents.map((d) => (d.id === id ? { ...d, ...data } : d)),
  })),
  deleteDocument: (id) => set((state) => ({
    documents: state.documents.filter((d) => d.id !== id),
  })),
  getDocumentsByProject: (projectId, projectName?) => get().documents.filter((d) => 
    d.projectId === projectId || 
    (Array.isArray(d.projectTags) && (d.projectTags.includes(projectId) || (projectName && d.projectTags.includes(projectName))))
  ),
  getDocumentsByProjectTag: (projectName) => get().documents.filter((d) => 
    Array.isArray(d.projectTags) && d.projectTags.includes(projectName)
  ),
  getUntaggedDocuments: () => get().documents.filter((d) => 
    !d.projectId && (!d.projectTags || d.projectTags.length === 0)
  ),
  fetchDocuments: async (filters) => {
    set({ loading: true, error: null });
    const { data, error } = await documentsApi.getAll(filters);
    if (error) {
      set({ loading: false, error });
    } else {
      // 防御性处理：API 可能返回裸数组或 { data: [], total } 分页格式
      const docs = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as Document[] || []);
      set({ documents: docs, loading: false, error: null });
    }
  },
  createDocument: async (data) => {
    const { data: doc, error } = await documentsApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (doc) {
      get().addDocument(doc);
      set({ error: null });
      return doc;
    }
    return null;
  },
  updateDocumentAsync: async (id, data) => {
    const { data: updated, error } = await documentsApi.update(id, data);
    if (error) {
      set({ error });
      return false;
    }
    if (updated) {
      get().updateDocument(id, updated);
    } else {
      await get().fetchDocuments();
    }
    set({ error: null });
    return true;
  },
  deleteDocumentAsync: async (id) => {
    const { error } = await documentsApi.delete(id);
    if (error) {
      set({ error });
      return false;
    }
    get().deleteDocument(id);
    set({ error: null });
    return true;
  },
}));

// ============================================================
// Factory 兼容层
// 提供与 createCrudStore 一致的接口，便于未来迁移
// ============================================================

export const documentStoreApi = {
  /** 获取所有文档 */
  get items() { return useDocumentStore.getState().documents; },
  /** 获取加载状态 */
  get loading() { return useDocumentStore.getState().loading; },
  /** 获取错误信息 */
  get error() { return useDocumentStore.getState().error; },
  /** 获取所有文档（异步） */
  fetchItems: (filters?: { projectId?: string; source?: string }) => 
    useDocumentStore.getState().fetchDocuments(filters),
  /** 创建文档 */
  createItem: (data: Omit<NewDocument, 'id' | 'createdAt' | 'updatedAt'>) => 
    useDocumentStore.getState().createDocument(data),
  /** 更新文档 */
  updateItemAsync: (id: string, data: Partial<Omit<Document, 'id' | 'createdAt'>>) => 
    useDocumentStore.getState().updateDocumentAsync(id, data),
  /** 删除文档 */
  deleteItemAsync: (id: string) => 
    useDocumentStore.getState().deleteDocumentAsync(id),
  /** 设置文档列表 */
  setItems: (items: Document[]) => 
    useDocumentStore.getState().setDocuments(items),
  /** 添加单个文档 */
  addItem: (item: Document) => 
    useDocumentStore.getState().addDocument(item),
  /** 更新单个文档（本地） */
  updateItem: (id: string, data: Partial<Document>) => 
    useDocumentStore.getState().updateDocument(id, data),
  /** 删除单个文档（本地） */
  removeItem: (id: string) => 
    useDocumentStore.getState().deleteDocument(id),
};
