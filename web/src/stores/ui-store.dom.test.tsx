import { beforeEach, describe, expect, it } from 'vitest';
import { UI_STORAGE_KEY } from '@/lib/appearance';
import { useUiStore } from './ui-store';

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({
      theme: 'system',
      palette: 'stone',
      density: 'comfortable',
      sidebarOpen: false,
      sidebarCollapsed: false,
    });
  });

  it('persists appearance in the shape theme-init.js reads', () => {
    useUiStore.getState().setTheme('dark');
    useUiStore.getState().setDensity('compact');
    const saved = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) ?? '{}');
    expect(saved.state).toEqual({ theme: 'dark', palette: 'stone', density: 'compact', sidebarCollapsed: false });
  });

  it('does not persist the mobile drawer state', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    const saved = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) ?? '{}');
    expect(saved.state).not.toHaveProperty('sidebarOpen');
  });
});
