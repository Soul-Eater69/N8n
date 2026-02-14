import { create } from 'zustand';
import { IWorkflow, IUser, INodeTypeDescription } from '@flowforge/shared';

interface AuthState {
  user: IUser | null;
  isAuthenticated: boolean;
  tenant: { id: string; name: string; slug: string } | null;
  setUser: (user: IUser, tenant: { id: string; name: string; slug: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  tenant: null,
  setUser: (user, tenant) => set({ user, isAuthenticated: true, tenant }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ff_access_token');
      localStorage.removeItem('ff_refresh_token');
    }
    set({ user: null, isAuthenticated: false, tenant: null });
  },
}));

interface WorkflowEditorState {
  workflow: IWorkflow | null;
  isDirty: boolean;
  selectedNodeId: string | null;
  isExecuting: boolean;
  setWorkflow: (workflow: IWorkflow) => void;
  updateWorkflow: (updates: Partial<IWorkflow>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setIsDirty: (dirty: boolean) => void;
  setIsExecuting: (executing: boolean) => void;
  reset: () => void;
}

export const useWorkflowEditorStore = create<WorkflowEditorState>((set) => ({
  workflow: null,
  isDirty: false,
  selectedNodeId: null,
  isExecuting: false,
  setWorkflow: (workflow) => set({ workflow, isDirty: false }),
  updateWorkflow: (updates) =>
    set((state) => ({
      workflow: state.workflow ? { ...state.workflow, ...updates } : null,
      isDirty: true,
    })),
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setIsDirty: (isDirty) => set({ isDirty }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  reset: () => set({ workflow: null, isDirty: false, selectedNodeId: null, isExecuting: false }),
}));

interface NodePaletteState {
  nodeTypes: INodeTypeDescription[];
  searchQuery: string;
  selectedCategory: string | null;
  setNodeTypes: (types: INodeTypeDescription[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
}

export const useNodePaletteStore = create<NodePaletteState>((set) => ({
  nodeTypes: [],
  searchQuery: '',
  selectedCategory: null,
  setNodeTypes: (nodeTypes) => set({ nodeTypes }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
}));

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  nodePaletteOpen: boolean;
  nodeConfigOpen: boolean;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setNodePaletteOpen: (open: boolean) => void;
  setNodeConfigOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  nodePaletteOpen: false,
  nodeConfigOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleTheme: () =>
    set((s) => {
      const newTheme = s.theme === 'light' ? 'dark' : 'light';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      }
      return { theme: newTheme };
    }),
  setNodePaletteOpen: (open) => set({ nodePaletteOpen: open }),
  setNodeConfigOpen: (open) => set({ nodeConfigOpen: open }),
}));
