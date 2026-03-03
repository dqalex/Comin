import { create } from 'zustand';
import type { Delivery, NewDelivery } from '@/db/schema';
import { deliveriesApi } from '@/lib/data-service';

interface DeliveryState {
  deliveries: Delivery[];
  loading: boolean;
  error: string | null;
  setDeliveries: (deliveries: Delivery[]) => void;
  addDelivery: (delivery: Delivery) => void;
  updateDelivery: (id: string, data: Partial<Delivery>) => void;
  deleteDelivery: (id: string) => void;
  getPending: () => Delivery[];
  getByMemberId: (memberId: string) => Delivery[];
  fetchDeliveries: () => Promise<void>;
  createDelivery: (data: Omit<NewDelivery, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Delivery | null>;
  updateDeliveryAsync: (id: string, data: Partial<Omit<Delivery, 'id' | 'createdAt'>>, extraBody?: Record<string, unknown>) => Promise<{ success: boolean; notifyData?: { sessionKey: string; message: string } }>;
  deleteDeliveryAsync: (id: string) => Promise<boolean>;
}

export const useDeliveryStore = create<DeliveryState>()((set, get) => ({
  deliveries: [],
  loading: false,
  error: null,
  setDeliveries: (deliveries) => set({ deliveries }),
  addDelivery: (delivery) => set((state) => ({ 
    deliveries: [delivery, ...state.deliveries] 
  })),
  updateDelivery: (id, data) => set((state) => ({
    deliveries: state.deliveries.map((d) => (d.id === id ? { ...d, ...data } : d)),
  })),
  deleteDelivery: (id) => set((state) => ({
    deliveries: state.deliveries.filter((d) => d.id !== id),
  })),
  getPending: () => get().deliveries.filter((d) => d.status === 'pending'),
  getByMemberId: (memberId) => get().deliveries.filter((d) => d.memberId === memberId),
  fetchDeliveries: async () => {
    set({ loading: true, error: null });
    const { data, error } = await deliveriesApi.getAll();
    if (error) {
      set({ loading: false, error });
    } else {
      // 防御性处理：API 返回可能是裸数组或分页对象
      const deliveries = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.data as Delivery[] || []);
      set({ deliveries, loading: false, error: null });
    }
  },
  createDelivery: async (data) => {
    const { data: delivery, error } = await deliveriesApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (delivery) {
      get().addDelivery(delivery);
      set({ error: null });
      return delivery;
    }
    return null;
  },
  updateDeliveryAsync: async (id, data, extraBody) => {
    const { data: updated, error } = await deliveriesApi.update(id, data, extraBody);
    if (error) {
      set({ error });
      return { success: false };
    }
    if (updated) {
      // 提取 _notifyData 并从 delivery 对象中剥离
      const { _notifyData, ...deliveryData } = updated as Delivery & { _notifyData?: { sessionKey: string; message: string } };
      get().updateDelivery(id, deliveryData);
      set({ error: null });
      return { success: true, notifyData: _notifyData || undefined };
    } else {
      await get().fetchDeliveries();
    }
    set({ error: null });
    return { success: true };
  },
  deleteDeliveryAsync: async (id) => {
    const { error } = await deliveriesApi.delete(id);
    if (error) {
      set({ error });
      return false;
    }
    get().deleteDelivery(id);
    set({ error: null });
    return true;
  },
}));
