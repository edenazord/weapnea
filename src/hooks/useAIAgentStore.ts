import { create } from 'zustand';

interface AIAgentState {
  visible: boolean;
  toggle: () => void;
  show: () => void;
  hide: () => void;
}

export const useAIAgentStore = create<AIAgentState>((set) => ({
  visible: false,
  toggle: () => set((s) => ({ visible: !s.visible })),
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
