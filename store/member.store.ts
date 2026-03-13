import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Member, NewMember, MemberWithRole } from '@/db/schema';
import { membersApi } from '@/lib/data-service';

interface MemberState {
  members: MemberWithRole[];
  currentMemberId: string | null;
  loading: boolean;
  error: string | null;
  setMembers: (members: MemberWithRole[]) => void;
  addMember: (member: MemberWithRole) => void;
  updateMember: (id: string, data: Partial<MemberWithRole>) => void;
  deleteMember: (id: string) => void;
  setCurrentMember: (id: string | null) => void;
  getHumanMembers: () => MemberWithRole[];
  getAIMembers: () => MemberWithRole[];
  fetchMembers: () => Promise<void>;
  createMember: (data: Omit<NewMember, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MemberWithRole | null>;
  updateMemberAsync: (id: string, data: Partial<Omit<Member, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteMemberAsync: (id: string) => Promise<boolean>;
}

export const useMemberStore = create<MemberState>()(
  persist(
    (set, get) => ({
      members: [],
      currentMemberId: null,
      loading: false,
      error: null,
      setMembers: (members) => set({ members }),
      addMember: (member) => set((state) => ({ members: [...state.members, member] })),
      updateMember: (id, data) => set((state) => ({
        members: state.members.map((m) => (m.id === id ? { ...m, ...data } : m)),
      })),
      deleteMember: (id) => set((state) => ({
        members: state.members.filter((m) => m.id !== id),
      })),
      setCurrentMember: (id) => set({ currentMemberId: id }),
      getHumanMembers: () => get().members.filter((m) => m.type === 'human'),
      getAIMembers: () => get().members.filter((m) => m.type === 'ai'),
      fetchMembers: async () => {
        set({ loading: true, error: null });
        const { data, error } = await membersApi.getAll();
        if (error) {
          set({ loading: false, error });
        } else {
          const current = get().members;
          // 防御性处理：API 返回可能是裸数组或包装对象
          // v3.0: API 返回 MemberWithRole[]，包含 userRole 字段
          const memberList = Array.isArray(data) ? data as MemberWithRole[] : ((data as unknown as Record<string, unknown>)?.data as MemberWithRole[] || []);
          const merged = memberList.map(m => {
            if (typeof m.openclawApiToken === 'string' && m.openclawApiToken.startsWith('***')) {
              const existing = current.find(c => c.id === m.id);
              if (existing?.openclawApiToken && !existing.openclawApiToken.startsWith('***')) {
                return { ...m, openclawApiToken: existing.openclawApiToken };
              }
            }
            return m;
          });
          set({ members: merged, loading: false, error: null });
        }
      },
      createMember: async (data) => {
        const { data: member, error } = await membersApi.create(data);
        if (error) {
          set({ error });
          return null;
        }
        if (member) {
          get().addMember(member);
          set({ error: null });
          return member;
        }
        return null;
      },
      updateMemberAsync: async (id, data) => {
        const { data: updated, error } = await membersApi.update(id, data);
        if (error) {
          set({ error });
          return false;
        }
        if (updated) {
          const mergeData = { ...updated };
          if (typeof updated.openclawApiToken === 'string' && updated.openclawApiToken.startsWith('***')) {
            const current = get().members.find(m => m.id === id);
            if (current?.openclawApiToken) {
              (mergeData as Record<string, unknown>).openclawApiToken = current.openclawApiToken;
            }
          }
          get().updateMember(id, mergeData);
        } else {
          await get().fetchMembers();
        }
        set({ error: null });
        return true;
      },
      deleteMemberAsync: async (id) => {
        const { error } = await membersApi.delete(id);
        if (error) {
          set({ error });
          return false;
        }
        get().deleteMember(id);
        set({ error: null });
        return true;
      },
    }),
    {
      name: 'teamclaw-member-selection',
      partialize: (state: MemberState) => ({ currentMemberId: state.currentMemberId }),
    }
  )
);

// ============================================================
// Factory 兼容层
// 提供与 createCrudStore 一致的接口，便于未来迁移
// ============================================================

export const memberStoreApi = {
  /** 获取所有成员 */
  get items() { return useMemberStore.getState().members; },
  /** 获取加载状态 */
  get loading() { return useMemberStore.getState().loading; },
  /** 获取错误信息 */
  get error() { return useMemberStore.getState().error; },
  /** 获取所有成员（异步） */
  fetchItems: () => useMemberStore.getState().fetchMembers(),
  /** 创建成员 */
  createItem: (data: Omit<NewMember, 'id' | 'createdAt' | 'updatedAt'>) => 
    useMemberStore.getState().createMember(data),
  /** 更新成员 */
  updateItemAsync: (id: string, data: Partial<Omit<Member, 'id' | 'createdAt'>>) => 
    useMemberStore.getState().updateMemberAsync(id, data),
  /** 删除成员 */
  deleteItemAsync: (id: string) => 
    useMemberStore.getState().deleteMemberAsync(id),
  /** 设置成员列表 */
  setItems: (items: MemberWithRole[]) => 
    useMemberStore.getState().setMembers(items),
  /** 添加单个成员 */
  addItem: (item: MemberWithRole) => 
    useMemberStore.getState().addMember(item),
  /** 更新单个成员（本地） */
  updateItem: (id: string, data: Partial<MemberWithRole>) => 
    useMemberStore.getState().updateMember(id, data),
  /** 删除单个成员（本地） */
  removeItem: (id: string) => 
    useMemberStore.getState().deleteMember(id),
};
