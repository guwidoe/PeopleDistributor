// Core data structures matching the Rust solver-core backend exactly
export interface Person {
  id: string;
  attributes: Record<string, string>; // Key-value attributes (e.g., {"gender": "female", "department": "engineering"})
  sessions?: number[]; // Optional: specific sessions this person participates in (0-based indices)
}

export interface Group {
  id: string;
  size: number; // Fixed capacity - maximum number of people in this group per session
}

// Constraint types matching solver-core exactly
export type ConstraintType =
  | "RepeatEncounter"
  | "AttributeBalance"
  | "ImmovablePerson"
  | "MustStayTogether"
  | "CannotBeTogether";

export interface RepeatEncounterParams {
  max_allowed_encounters: number;
  penalty_function: "linear" | "squared";
  penalty_weight: number;
}

export interface AttributeBalanceParams {
  group_id: string;
  attribute_key: string;
  desired_values: Record<string, number>; // e.g., {"male": 2, "female": 2}
  penalty_weight: number;
}

export interface ImmovablePersonParams {
  person_id: string;
  group_id: string;
  sessions: number[]; // Sessions where this person must be in this group
}

export interface Constraint {
  type: ConstraintType;
  // Union of all possible constraint parameters
  max_allowed_encounters?: number;
  penalty_function?: "linear" | "squared";
  penalty_weight?: number;
  group_id?: string;
  attribute_key?: string;
  desired_values?: Record<string, number>;
  person_id?: string;
  people?: string[];
  sessions?: number[];
}

export interface Problem {
  people: Person[];
  groups: Group[];
  num_sessions: number; // Renamed from sessions_count to match solver-core
  constraints: Constraint[];
  settings: SolverSettings;
}

export interface SolverSettings {
  solver_type: string;
  stop_conditions: StopConditions;
  solver_params: SolverParams;
  logging?: LoggingOptions;
}

export interface StopConditions {
  max_iterations?: number;
  time_limit_seconds?: number;
  no_improvement_iterations?: number;
}

export interface SolverParams {
  SimulatedAnnealing?: SimulatedAnnealingParams;
}

export interface SimulatedAnnealingParams {
  initial_temperature: number;
  final_temperature: number;
  cooling_schedule: "geometric" | "linear";
}

export interface LoggingOptions {
  log_frequency?: number;
  log_initial_state?: boolean;
  log_duration_and_score?: boolean;
  display_final_schedule?: boolean;
  log_initial_score_breakdown?: boolean;
  log_final_score_breakdown?: boolean;
  log_stop_condition?: boolean;
}

export interface Solution {
  assignments: Assignment[];
  final_score: number;
  unique_contacts: number;
  repetition_penalty: number;
  attribute_balance_penalty: number;
  constraint_penalty: number;
  iteration_count: number;
  elapsed_time_ms: number;
}

export interface Assignment {
  person_id: string;
  group_id: string;
  session_id: number;
}

export interface SolverState {
  isRunning: boolean;
  isComplete: boolean;
  currentIteration: number;
  bestScore: number;
  elapsedTime: number;
  noImprovementCount: number;
  error?: string;
}

// UI State types
export interface AppState {
  problem: Problem | null;
  solution: Solution | null;
  solverState: SolverState;
  attributeDefinitions: AttributeDefinition[];
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

// Form types for UI
export interface PersonFormData {
  id?: string;
  attributes: Record<string, string>;
  sessions: number[]; // Empty array means all sessions
}

export interface GroupFormData {
  id?: string;
  size: number;
}

export interface AttributeDefinition {
  key: string;
  values: string[]; // Possible values for this attribute
}

// WASM Module types
export interface WasmModule {
  solve: (problem_json: string) => string;
  solve_with_progress: (
    problem_json: string,
    progress_callback?: (progress_json: string) => boolean
  ) => string;
  validate_problem: (problem_json: string) => string;
  get_default_settings: () => string;
}
