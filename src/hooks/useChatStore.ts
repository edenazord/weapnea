import { create } from 'zustand';

interface ChatStore {
  isOpen: boolean;
  targetUserId: string | null;
  targetEventId: string | null;
  openChat: (userId: string, eventId?: string) => void;
  /** Open the conversation list (no specific target user) */
  openList: () => void;
  closeChat: () => void;
  resetTarget: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  targetUserId: null,
  targetEventId: null,
  openChat: (userId, eventId) => {
    console.log('[useChatStore] openChat called with userId:', userId, 'eventId:', eventId);
    set({ isOpen: true, targetUserId: userId, targetEventId: eventId || null });
  },
  openList: () => {
    console.log('[useChatStore] openList called');
    set({ isOpen: true, targetUserId: null, targetEventId: null });
  },
  closeChat: () => set({ isOpen: false }),
  resetTarget: () => {
    console.log('[useChatStore] resetTarget called');
    set({ targetUserId: null, targetEventId: null });
  },
}));
