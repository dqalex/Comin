import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Member, NewMember } from '@/db/schema';
import { membersApi } from '@/lib/data-service';

interface MemberState {
  members: Member[];
  currentMemberId: string | null;
  loading: boolean;
  error: string | null;
  setMembers: (members: Member[]) => void;
  addMember: (member: Member) => void;
  updateMember: (id: string, data: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  setCurrentMember: (id: string | null) => void;
  getHumanMembers: () => Member[];
  getAIMembers: () => Member[];
  fetchMembers: () => Promise<void>;
  createMember: (data: Omit<NewMember, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Member | null>;
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
          const memberList = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as Member[] || []);
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
      name: 'comind-member-selection',
      partialize: (state: MemberState) => ({ currentMemberId: state.currentMemberId }),
    }
  )
);
