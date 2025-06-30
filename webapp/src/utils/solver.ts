import type { Problem, Solution, Assignment } from "../types";

// WASM module interface
interface SolverWasm {
  solve_with_progress: (
    problemJson: string,
    progressCallback?: (progressJson: string) => boolean
  ) => string;
  solve: (problemJson: string) => string;
  validate_problem: (problemJson: string) => string;
  get_default_settings: () => string;
}

// Progress update interface matching the Rust ProgressUpdate struct
export interface ProgressUpdate {
  iteration: number;
  max_iterations: number;
  temperature: number;
  current_score: number;
  best_score: number;
  current_contacts: number;
  best_contacts: number;
  repetition_penalty: number;
  elapsed_seconds: number;
  no_improvement_count: number;
}

// Progress callback type
export type ProgressCallback = (progress: ProgressUpdate) => boolean;

// Global WASM module instance
let wasmModule: SolverWasm | null = null;

// Initialize WASM module
export async function initializeSolver(): Promise<void> {
  try {
    // Import the WASM module dynamically
    const wasmImport = await import("/solver_wasm.js" as any);
    await wasmImport.default();

    // Store the module reference
    wasmModule = wasmImport;

    console.log("WASM solver initialized successfully");
  } catch (error) {
    console.error("Failed to initialize WASM solver:", error);
    throw new Error("Failed to initialize solver");
  }
}

// Check if solver is initialized
export function isSolverInitialized(): boolean {
  return wasmModule !== null;
}

// Convert Problem to the format expected by the Rust solver
function convertProblemToRustFormat(problem: Problem): any {
  return {
    problem: {
      people: problem.people.map((person) => ({
        id: person.id,
        attributes: person.attributes,
        sessions: person.sessions || null,
      })),
      groups: problem.groups.map((group) => ({
        id: group.id,
        size: group.size,
      })),
      num_sessions: problem.num_sessions,
    },
    objectives: [
      {
        type: "maximize_unique_contacts",
        weight: 1.0,
      },
    ],
    constraints: problem.constraints.map((constraint) => {
      switch (constraint.type) {
        case "RepeatEncounter":
          return {
            RepeatEncounter: {
              max_allowed_encounters: constraint.max_allowed_encounters,
              penalty_function: constraint.penalty_function,
              penalty_weight: constraint.penalty_weight,
            },
          };
        case "MustStayTogether":
          return {
            MustStayTogether: {
              people: constraint.people,
              penalty_weight: constraint.penalty_weight,
              sessions: constraint.sessions || null,
            },
          };
        case "CannotBeTogether":
          return {
            CannotBeTogether: {
              people: constraint.people,
              penalty_weight: constraint.penalty_weight,
              sessions: constraint.sessions || null,
            },
          };
        case "AttributeBalance":
          return {
            AttributeBalance: {
              group_id: constraint.group_id,
              attribute_key: constraint.attribute_key,
              desired_values: constraint.desired_values,
              penalty_weight: constraint.penalty_weight,
            },
          };
        default:
          throw new Error(
            `Unknown constraint type: ${(constraint as any).type}`
          );
      }
    }),
    solver: {
      solver_type: problem.settings.solver_type,
      stop_conditions: {
        max_iterations: problem.settings.stop_conditions.max_iterations,
        time_limit_seconds: problem.settings.stop_conditions.time_limit_seconds,
        no_improvement_iterations:
          problem.settings.stop_conditions.no_improvement_iterations,
      },
      solver_params: {
        SimulatedAnnealing: problem.settings.solver_params.SimulatedAnnealing,
      },
      logging: problem.settings.logging,
    },
  };
}

// Convert Rust solver result to our Solution format
function convertRustResultToSolution(rustResult: any): Solution {
  // Convert the schedule format to assignments
  const assignments: Assignment[] = [];

  for (const [sessionName, groups] of Object.entries(rustResult.schedule)) {
    const sessionId = parseInt(sessionName.replace("Session ", ""));
    for (const [groupId, people] of Object.entries(
      groups as Record<string, string[]>
    )) {
      for (const personId of people) {
        assignments.push({
          person_id: personId,
          group_id: groupId,
          session_id: sessionId,
        });
      }
    }
  }

  return {
    assignments,
    final_score: rustResult.final_score,
    unique_contacts: rustResult.unique_contacts,
    repetition_penalty: rustResult.repetition_penalty,
    attribute_balance_penalty: rustResult.attribute_balance_penalty,
    constraint_penalty: rustResult.constraint_penalty,
    iteration_count: 0, // TODO: Get from progress updates
    elapsed_time_ms: 0, // TODO: Get from progress updates
  };
}

// Solve with progress callback
export async function solveWithProgress(
  problem: Problem,
  progressCallback?: ProgressCallback
): Promise<Solution> {
  if (!wasmModule) {
    throw new Error(
      "WASM solver not initialized. Call initializeSolver() first."
    );
  }

  const rustProblem = convertProblemToRustFormat(problem);
  const problemJson = JSON.stringify(rustProblem);

  // Create a wrapper callback that handles JSON parsing
  const wasmProgressCallback = progressCallback
    ? (progressJson: string): boolean => {
        try {
          const progress: ProgressUpdate = JSON.parse(progressJson);
          return progressCallback(progress);
        } catch (error) {
          console.error("Failed to parse progress update:", error);
          return true; // Continue on parse error
        }
      }
    : undefined;

  try {
    const resultJson = wasmModule.solve_with_progress(
      problemJson,
      wasmProgressCallback
    );
    const rustResult = JSON.parse(resultJson);
    return convertRustResultToSolution(rustResult);
  } catch (error) {
    console.error("Solver error:", error);
    throw new Error(`Solver failed: ${error}`);
  }
}

// Solve without progress (for simple cases)
export async function solve(problem: Problem): Promise<Solution> {
  if (!wasmModule) {
    throw new Error(
      "WASM solver not initialized. Call initializeSolver() first."
    );
  }

  const rustProblem = convertProblemToRustFormat(problem);
  const problemJson = JSON.stringify(rustProblem);

  try {
    const resultJson = wasmModule.solve(problemJson);
    const rustResult = JSON.parse(resultJson);
    return convertRustResultToSolution(rustResult);
  } catch (error) {
    console.error("Solver error:", error);
    throw new Error(`Solver failed: ${error}`);
  }
}

// Validate problem
export async function validateProblem(
  problem: Problem
): Promise<{ valid: boolean; errors: string[] }> {
  if (!wasmModule) {
    throw new Error(
      "WASM solver not initialized. Call initializeSolver() first."
    );
  }

  const rustProblem = convertProblemToRustFormat(problem);
  const problemJson = JSON.stringify(rustProblem);

  try {
    const resultJson = wasmModule.validate_problem(problemJson);
    return JSON.parse(resultJson);
  } catch (error) {
    console.error("Validation error:", error);
    return {
      valid: false,
      errors: [`Validation failed: ${error}`],
    };
  }
}

// Get default solver settings
export async function getDefaultSettings(): Promise<any> {
  if (!wasmModule) {
    throw new Error(
      "WASM solver not initialized. Call initializeSolver() first."
    );
  }

  try {
    const settingsJson = wasmModule.get_default_settings();
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error("Failed to get default settings:", error);
    throw new Error(`Failed to get default settings: ${error}`);
  }
}
