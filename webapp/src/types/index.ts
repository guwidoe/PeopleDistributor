// Core data structures matching the Rust backend
export interface Person {
  id: string;
  name: string;
  gender?: "male" | "female";
  sessions?: number[]; // Optional: specific sessions this person participates in
}

export interface Session {
  id: number;
  name: string;
  max_people: number;
  min_people: number;
}

export interface Constraint {
  type:
    | "cannot_be_together"
    | "must_stay_together"
    | "immovable_person"
    | "clique";
  people: string[]; // Person IDs
  sessions?: number[]; // Optional: specific sessions this constraint applies to
  penalty?: number; // Optional: custom penalty weight
}

export interface Problem {
  people: Person[];
  sessions: Session[];
  constraints: Constraint[];
  settings: SolverSettings;
}

export interface SolverSettings {
  max_iterations: number;
  time_limit_seconds: number;
  temperature: number;
  cooling_rate: number;
  repetition_penalty: number;
}

export interface Solution {
  assignments: Assignment[];
  score: number;
  constraint_violations: number;
  iteration_count: number;
  elapsed_time_ms: number;
}

export interface Assignment {
  person_id: string;
  session_id: number;
}

export interface SolverState {
  isRunning: boolean;
  isComplete: boolean;
  currentIteration: number;
  bestScore: number;
  elapsedTime: number;
  error?: string;
}

// UI State types
export interface AppState {
  problem: Problem | null;
  solution: Solution | null;
  solverState: SolverState;
  ui: {
    activeTab: "problem" | "solver" | "results";
    isLoading: boolean;
    notifications: Notification[];
  };
}

export interface Notification {
  id: string;
  type: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
  duration?: number; // Auto-dismiss after X ms
}

// Form types
export interface PersonFormData {
  name: string;
  gender: "male" | "female" | "";
  sessions: number[];
}

export interface SessionFormData {
  name: string;
  max_people: number;
  min_people: number;
}

export interface ConstraintFormData {
  type:
    | "cannot_be_together"
    | "must_stay_together"
    | "immovable_person"
    | "clique";
  people: string[];
  sessions: number[];
  penalty: number;
}

// WASM Module types
export interface WasmModule {
  solve: (problem_json: string) => string;
  validate_problem: (problem_json: string) => string;
  get_default_settings: () => string;
}
