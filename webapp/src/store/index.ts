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
  generateDemoData: () => void;
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

  generateDemoData: () => {
    const demoProblem: Problem = {
      people: [
        { id: "person_1", name: "Alice Johnson", gender: "female" },
        { id: "person_2", name: "Bob Smith", gender: "male" },
        { id: "person_3", name: "Carol Davis", gender: "female" },
        { id: "person_4", name: "David Wilson", gender: "male" },
        { id: "person_5", name: "Eva Brown", gender: "female" },
        { id: "person_6", name: "Frank Miller", gender: "male" },
        { id: "person_7", name: "Grace Lee", gender: "female" },
        { id: "person_8", name: "Henry Taylor", gender: "male" },
        { id: "person_9", name: "Iris Garcia", gender: "female" },
        { id: "person_10", name: "Jack Martinez", gender: "male" },
        { id: "person_11", name: "Kate Anderson", gender: "female" },
        { id: "person_12", name: "Liam Thompson", gender: "male" },
      ],
      groups: [
        { id: 1, name: "Group A", max_people: 4, min_people: 2 },
        { id: 2, name: "Group B", max_people: 4, min_people: 2 },
        { id: 3, name: "Group C", max_people: 4, min_people: 2 },
      ],
      sessions_count: 3,
      constraints: [
        {
          type: "cannot_be_together",
          people: ["person_1", "person_2"],
          penalty: 100,
        },
        {
          type: "must_stay_together",
          people: ["person_3", "person_4"],
          penalty: 100,
        },
      ],
      settings: {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 100,
      },
    };

    const demoSolution: Solution = {
      assignments: [
        { person_id: "person_1", group_id: 1, session_id: 1 },
        { person_id: "person_3", group_id: 1, session_id: 1 },
        { person_id: "person_4", group_id: 1, session_id: 1 },
        { person_id: "person_5", group_id: 2, session_id: 1 },
        { person_id: "person_6", group_id: 2, session_id: 1 },
        { person_id: "person_7", group_id: 2, session_id: 1 },
        { person_id: "person_8", group_id: 3, session_id: 1 },
        { person_id: "person_9", group_id: 3, session_id: 1 },
        { person_id: "person_10", group_id: 3, session_id: 1 },
        { person_id: "person_11", group_id: 3, session_id: 1 },
        { person_id: "person_2", group_id: 1, session_id: 2 },
        { person_id: "person_12", group_id: 1, session_id: 2 },
      ],
      score: 85.5,
      constraint_violations: 1,
      iteration_count: 8473,
      elapsed_time_ms: 2847,
    };

    set({ problem: demoProblem, solution: demoSolution });

    get().addNotification({
      type: "success",
      title: "Demo Data Loaded",
      message: "Sample problem and solution have been loaded for testing",
    });
  },
}));
