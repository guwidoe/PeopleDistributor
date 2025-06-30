import { create } from "zustand";
import type {
  AppState,
  Problem,
  Solution,
  SolverState,
  Notification,
} from "../types";

// Re-export types for easier access
export type {
  AppState,
  Problem,
  Solution,
  SolverState,
  Notification,
} from "../types";

interface AppStore extends AppState {
  // Problem management
  setProblem: (problem: Problem) => void;
  updateProblem: (updates: Partial<Problem>) => void;

  // Solution management
  setSolution: (solution: Solution) => void;
  clearSolution: () => void;

  // Solver state management
  setSolverState: (state: Partial<SolverState>) => void;
  startSolver: () => void;
  stopSolver: () => void;
  resetSolver: () => void;

  // UI management
  setActiveTab: (tab: "problem" | "solver" | "results") => void;
  setLoading: (loading: boolean) => void;
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Utility actions
  reset: () => void;
}

const initialState: AppState = {
  problem: null,
  solution: null,
  solverState: {
    isRunning: false,
    isComplete: false,
    currentIteration: 0,
    bestScore: 0,
    elapsedTime: 0,
  },
  ui: {
    activeTab: "problem",
    isLoading: false,
    notifications: [],
  },
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  // Problem management
  setProblem: (problem) => set({ problem }),

  updateProblem: (updates) => {
    const currentProblem = get().problem;
    if (currentProblem) {
      set({ problem: { ...currentProblem, ...updates } });
    }
  },

  // Solution management
  setSolution: (solution) => set({ solution }),

  clearSolution: () => set({ solution: null }),

  // Solver state management
  setSolverState: (state) => {
    const currentState = get().solverState;
    set({ solverState: { ...currentState, ...state } });
  },

  startSolver: () =>
    set((state) => ({
      solverState: {
        ...state.solverState,
        isRunning: true,
        isComplete: false,
        currentIteration: 0,
        elapsedTime: 0,
        error: undefined,
      },
    })),

  stopSolver: () =>
    set((state) => ({
      solverState: {
        ...state.solverState,
        isRunning: false,
      },
    })),

  resetSolver: () =>
    set((state) => ({
      solverState: {
        ...state.solverState,
        isRunning: false,
        isComplete: false,
        currentIteration: 0,
        bestScore: 0,
        elapsedTime: 0,
        error: undefined,
      },
    })),

  // UI management
  setActiveTab: (activeTab) =>
    set((state) => ({
      ui: { ...state.ui, activeTab },
    })),

  setLoading: (isLoading) =>
    set((state) => ({
      ui: { ...state.ui, isLoading },
    })),

  addNotification: (notification) => {
    const id = Date.now().toString();
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000, // Default 5 seconds
    };

    set((state) => ({
      ui: {
        ...state.ui,
        notifications: [...state.ui.notifications, newNotification],
      },
    }));

    // Auto-remove notification after duration
    const duration = newNotification.duration;
    if (duration && duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }
  },

  removeNotification: (id) =>
    set((state) => ({
      ui: {
        ...state.ui,
        notifications: state.ui.notifications.filter((n) => n.id !== id),
      },
    })),

  clearNotifications: () =>
    set((state) => ({
      ui: { ...state.ui, notifications: [] },
    })),

  // Utility actions
  reset: () => set(initialState),
}));
