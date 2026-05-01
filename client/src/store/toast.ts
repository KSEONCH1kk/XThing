import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";
export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastStore {
  items: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastStore>((set, get) => ({
  items: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set({ items: [...get().items, { id, ...t }] });
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}));
