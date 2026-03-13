import { create } from 'zustand';
import type { Comment } from '@/db/schema';
import { commentsApi } from '@/lib/data-service';

interface CommentState {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  setComments: (comments: Comment[]) => void;
  getByTask: (taskId: string) => Comment[];
  fetchCommentsByTask: (taskId: string) => Promise<void>;
  createComment: (data: { taskId: string; memberId: string; content: string }) => Promise<Comment | null>;
  deleteCommentAsync: (id: string) => Promise<boolean>;
}

export const useCommentStore = create<CommentState>()((set, get) => ({
  comments: [],
  loading: false,
  error: null,
  setComments: (comments) => set({ comments }),
  getByTask: (taskId) => get().comments.filter((c) => c.taskId === taskId),
  fetchCommentsByTask: async (taskId) => {
    set({ loading: true, error: null });
    const { data, error } = await commentsApi.getByTask(taskId);
    if (error) {
      set({ loading: false, error });
    } else {
      const safedData = Array.isArray(data) ? data : [];
      const otherComments = get().comments.filter((c) => c.taskId !== taskId);
      set({ comments: [...otherComments, ...safedData], loading: false, error: null });
    }
  },
  createComment: async (data) => {
    const { data: comment, error } = await commentsApi.create(data);
    if (error) {
      set({ error });
      return null;
    }
    if (comment) {
      set((state) => ({ comments: [...state.comments, comment], error: null }));
      return comment;
    }
    return null;
  },
  deleteCommentAsync: async (id) => {
    const { error } = await commentsApi.delete(id);
    if (error) {
      set({ error });
      return false;
    }
    set((state) => ({ comments: state.comments.filter((c) => c.id !== id), error: null }));
    return true;
  },
}));
