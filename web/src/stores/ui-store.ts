import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_APPEARANCE,
  UI_STORAGE_KEY,
  type Appearance,
  type Density,
  type Palette,
  type Theme,
} from '@/lib/appearance';

/**
 * Client-only UI preferences, persisted to localStorage. Server data never goes here: it lives
 * in TanStack Query. Select narrowly (`useUiStore((s) => s.theme)`) so components re-render only
 * for the fields they read.
 */
interface UiState extends Appearance {
  /** Phone/tablet drawer: open or closed. Not persisted; always starts closed. */
  sidebarOpen: boolean;
  /** Desktop: icon-only rail instead of the full sidebar. Persisted. */
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  setPalette: (palette: Palette) => void;
  setDensity: (density: Density) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapsed: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ...DEFAULT_APPEARANCE,
      sidebarOpen: false,
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      setPalette: (palette) => set({ palette }),
      setDensity: (density) => set({ density }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: UI_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // The mobile drawer starts closed on every load; the desktop collapse is remembered.
      partialize: ({ theme, palette, density, sidebarCollapsed }) => ({ theme, palette, density, sidebarCollapsed }),
    },
  ),
);
