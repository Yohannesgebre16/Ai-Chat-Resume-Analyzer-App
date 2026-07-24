/**
 * Ephemeral UI state: active session, per-session active-leaf selections
 * (which branch is visible), sidebar open/closed, and active top-level tab.
 */
import { create } from 'zustand'

type Tab = 'chat' | 'resume'

interface UIState {
  activeSessionId: string | null
  /** map sessionId -> activeLeafId (controls which branch is shown) */
  activeLeaves: Record<string, string>
  /** desktop sidebar visibility */
  sidebarOpen: boolean
  /** mobile sheet visibility */
  mobileNavOpen: boolean
  tab: Tab
  setActiveSession: (id: string | null) => void
  setActiveLeaf: (sessionId: string, leafId: string) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setMobileNavOpen: (open: boolean) => void
  setTab: (tab: Tab) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeSessionId: null,
  activeLeaves: {},
  sidebarOpen: true,
  mobileNavOpen: false,
  tab: 'chat',
  setActiveSession: (id) =>
    set((s) => ({ activeSessionId: id, mobileNavOpen: false })),
  setActiveLeaf: (sessionId, leafId) =>
    set((s) => ({ activeLeaves: { ...s.activeLeaves, [sessionId]: leafId } })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setTab: (tab) => set({ tab }),
}))
