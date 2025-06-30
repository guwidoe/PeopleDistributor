import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  AppState,
  Problem,
  Solution,
  SolverState,
  Notification,
  Person,
  Group,
  AttributeDefinition,
} from "../types";

// Re-export types for easier access
export type {
  AppState,
  Problem,
  Solution,
  SolverState,
  Notification,
  Person,
  Group,
  AttributeDefinition,
} from "../types";

interface AppStore extends AppState {
  // Problem management
  setProblem: (problem: Problem) => void;
  updateProblem: (updates: Partial<Problem>) => void;

  // Solution management
  setSolution: (solution: Solution | null) => void;
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

  // New actions for attribute management
  attributeDefinitions: AttributeDefinition[];
  setAttributeDefinitions: (definitions: AttributeDefinition[]) => void;
  addAttributeDefinition: (definition: AttributeDefinition) => void;
  removeAttributeDefinition: (key: string) => void;
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
    noImprovementCount: 0,
  },
  ui: {
    activeTab: "problem",
    isLoading: false,
    notifications: [],
  },
  attributeDefinitions: [
    { key: "gender", values: ["male", "female"] },
    {
      key: "department",
      values: ["engineering", "marketing", "sales", "hr", "finance"],
    },
    { key: "seniority", values: ["junior", "mid", "senior", "lead"] },
    { key: "location", values: ["office", "remote", "hybrid"] },
  ],
};

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
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
            noImprovementCount: 0,
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
            noImprovementCount: 0,
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

      // New actions for attribute management
      setAttributeDefinitions: (definitions) =>
        set({ attributeDefinitions: definitions }),

      addAttributeDefinition: (definition) =>
        set((prev) => ({
          attributeDefinitions: [...prev.attributeDefinitions, definition],
        })),

      removeAttributeDefinition: (key) =>
        set((prev) => ({
          attributeDefinitions: prev.attributeDefinitions.filter(
            (def) => def.key !== key
          ),
        })),

      generateDemoData: () => {
        const demoGroups: Group[] = [
          { id: "team-alpha", size: 4 },
          { id: "team-beta", size: 4 },
          { id: "team-gamma", size: 4 },
        ];

        const demoPeople: Person[] = [
          {
            id: "alice",
            attributes: {
              name: "Alice Johnson",
              gender: "female",
              department: "engineering",
              seniority: "senior",
            },
          },
          {
            id: "bob",
            attributes: {
              name: "Bob Smith",
              gender: "male",
              department: "marketing",
              seniority: "mid",
            },
          },
          {
            id: "charlie",
            attributes: {
              name: "Charlie Brown",
              gender: "male",
              department: "engineering",
              seniority: "junior",
            },
          },
          {
            id: "diana",
            attributes: {
              name: "Diana Prince",
              gender: "female",
              department: "sales",
              seniority: "lead",
            },
          },
          {
            id: "eve",
            attributes: {
              name: "Eve Davis",
              gender: "female",
              department: "hr",
              seniority: "mid",
            },
          },
          {
            id: "frank",
            attributes: {
              name: "Frank Miller",
              gender: "male",
              department: "finance",
              seniority: "senior",
            },
          },
          {
            id: "grace",
            attributes: {
              name: "Grace Lee",
              gender: "female",
              department: "engineering",
              seniority: "junior",
            },
          },
          {
            id: "henry",
            attributes: {
              name: "Henry Wilson",
              gender: "male",
              department: "marketing",
              seniority: "senior",
            },
          },
          {
            id: "iris",
            attributes: {
              name: "Iris Chen",
              gender: "female",
              department: "sales",
              seniority: "mid",
            },
          },
          {
            id: "jack",
            attributes: {
              name: "Jack Taylor",
              gender: "male",
              department: "hr",
              seniority: "junior",
            },
          },
          {
            id: "kate",
            attributes: {
              name: "Kate Anderson",
              gender: "female",
              department: "finance",
              seniority: "lead",
            },
          },
          {
            id: "leo",
            attributes: {
              name: "Leo Rodriguez",
              gender: "male",
              department: "engineering",
              seniority: "mid",
              location: "remote",
            },
            sessions: [1, 2], // Late arrival - misses first session
          },
        ];

        const demoProblem: Problem = {
          people: demoPeople,
          groups: demoGroups,
          num_sessions: 3,
          constraints: [
            // Limit repeat encounters
            {
              type: "RepeatEncounter",
              max_allowed_encounters: 1,
              penalty_function: "squared",
              penalty_weight: 100.0,
            },
            // Keep Alice and Bob together (they're project partners)
            {
              type: "MustStayTogether",
              people: ["alice", "bob"],
              penalty_weight: 1000.0,
              sessions: [0, 1], // Only for first two sessions
            },
            // Charlie and Diana can't be together (personality conflict)
            {
              type: "CannotBeTogether",
              people: ["charlie", "diana"],
              penalty_weight: 500.0,
            },
            // Maintain gender balance in team-alpha
            {
              type: "AttributeBalance",
              group_id: "team-alpha",
              attribute_key: "gender",
              desired_values: { male: 2, female: 2 },
              penalty_weight: 50.0,
            },
          ],
          settings: {
            solver_type: "SimulatedAnnealing",
            stop_conditions: {
              max_iterations: 10000,
              time_limit_seconds: 30,
              no_improvement_iterations: 1000,
            },
            solver_params: {
              SimulatedAnnealing: {
                initial_temperature: 1.0,
                final_temperature: 0.01,
                cooling_schedule: "geometric",
              },
            },
            logging: {
              log_frequency: 1000,
              log_initial_state: true,
              log_duration_and_score: true,
              display_final_schedule: true,
              log_initial_score_breakdown: true,
              log_final_score_breakdown: true,
              log_stop_condition: true,
            },
          },
        };

        set({ problem: demoProblem });

        get().addNotification({
          type: "success",
          title: "Demo Data Loaded",
          message:
            "Generated sample problem with 12 people, 3 groups, and various constraints",
        });
      },
    }),
    {
      name: "people-distributor-store",
    }
  )
);
