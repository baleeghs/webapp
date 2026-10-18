import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string | undefined;
}

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

const DURATION_MS = { info: 4000, success: 4000, error: 8000 } satisfies Record<ToastTone, number>;
let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function show(tone: ToastTone, title: string, description?: string): number {
  const id = nextId++;
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-4), { id, tone, title, description }] }));
  setTimeout(() => useToastStore.getState().dismiss(id), DURATION_MS[tone]);
  return id;
}

/** Fire-and-forget notifications, callable from anywhere (mutation callbacks included). */
export const toast = {
  info: (title: string, description?: string) => show('info', title, description),
  success: (title: string, description?: string) => show('success', title, description),
  error: (title: string, description?: string) => show('error', title, description),
};
