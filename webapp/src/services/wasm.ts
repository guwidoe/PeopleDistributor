/// <reference path="../types/wasm.d.ts" />

import type {
  Problem,
  Solution,
  SolverSettings,
  WasmModule,
  Assignment,
} from "../types";

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

class WasmService {
  private module: WasmModule | null = null;
  private loading = false;
  private initializationFailed = false;

  async initialize(): Promise<void> {
    if (this.module || this.loading || this.initializationFailed) {
      return;
    }

    this.loading = true;

    try {
      // Load the WASM module via the virtual alias
      const wasmModule = await import("virtual:wasm-solver").catch((error) => {
        console.warn(
          "WASM module not found. This might be a build issue:",
          error.message
        );
        throw new Error(
          "WASM module not available. Please check the build configuration."
        );
      });

      // Initialize the WASM module
      await wasmModule.default();

      this.module = wasmModule as unknown as WasmModule;
      console.log("WASM module loaded successfully");
    } catch (error) {
      console.error("Failed to load WASM module:", error);
      this.initializationFailed = true;
      throw new Error("Failed to initialize WASM solver");
    } finally {
      this.loading = false;
    }
  }

  async solve(problem: Problem): Promise<Solution> {
    if (!this.module && !this.initializationFailed) {
      await this.initialize();
    }

    if (!this.module) {
      throw new Error(
        "WASM module not available. Please check the build configuration."
      );
    }

    try {
      const problemJson = JSON.stringify(
        this.convertProblemToRustFormat(problem)
      );
      console.log("Solver input JSON:", problemJson);
      const resultJson = this.module.solve(problemJson);
      const rustResult = JSON.parse(resultJson);
      return this.convertRustResultToSolution(rustResult);
    } catch (error) {
      console.error("WASM solve error:", error);
      throw new Error(
        `Failed to solve problem: ${
          error instanceof Error ? error.stack || error.message : String(error)
        }`
      );
    }
  }

  async solveWithProgress(
    problem: Problem,
    progressCallback?: ProgressCallback
  ): Promise<Solution> {
    if (!this.module && !this.initializationFailed) {
      await this.initialize();
    }

    if (!this.module) {
      throw new Error("WASM module not initialized");
    }

    try {
      const problemJson = JSON.stringify(
        this.convertProblemToRustFormat(problem)
      );

      let lastProgress: ProgressUpdate | undefined;

      const wasmProgressCallback = progressCallback
        ? (progressJson: string) => {
            try {
              const progress: ProgressUpdate = JSON.parse(progressJson);
              lastProgress = progress; // Track the last progress update
              return progressCallback(progress);
            } catch (e) {
              console.error("Failed to parse progress update:", e);
              return true; // Continue on parse error
            }
          }
        : undefined;

      const resultJson = this.module.solve_with_progress(
        problemJson,
        wasmProgressCallback
      );

      const rustResult = JSON.parse(resultJson);
      return this.convertRustResultToSolution(rustResult, lastProgress);
    } catch (error) {
      console.error("WASM solveWithProgress error:", error);
      throw new Error(
        `Failed to solve problem: ${
          error instanceof Error ? error.stack || error.message : String(error)
        }`
      );
    }
  }

  async validateProblem(
    problem: Problem
  ): Promise<{ valid: boolean; errors: string[] }> {
    if (!this.module && !this.initializationFailed) {
      await this.initialize();
    }

    if (!this.module) {
      return {
        valid: false,
        errors: [
          "WASM module not available. Please check the build configuration.",
        ],
      };
    }

    try {
      const problemJson = JSON.stringify(problem);
      const resultJson = this.module.validate_problem(problemJson);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error("WASM validation error:", error);
      return { valid: false, errors: ["Validation failed"] };
    }
  }

  async getDefaultSettings(): Promise<SolverSettings> {
    if (!this.module && !this.initializationFailed) {
      await this.initialize();
    }

    if (!this.module) {
      // Return reasonable defaults when WASM is not available
      return {
        solver_type: "SimulatedAnnealing",
        stop_conditions: {
          max_iterations: 10000,
          time_limit_seconds: 30,
          no_improvement_iterations: 5000,
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
      };
    }

    try {
      const settingsJson = this.module.get_default_settings();
      return JSON.parse(settingsJson);
    } catch (error) {
      console.error("WASM get default settings error:", error);
      // Fallback to reasonable defaults
      return {
        solver_type: "SimulatedAnnealing",
        stop_conditions: {
          max_iterations: 10000,
          time_limit_seconds: 30,
          no_improvement_iterations: 5000,
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
      };
    }
  }

  isReady(): boolean {
    return this.module !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  hasInitializationFailed(): boolean {
    return this.initializationFailed;
  }

  // Convert Problem to the format expected by the Rust solver
  private convertProblemToRustFormat(problem: Problem): any {
    // Convert solver_params from UI format to Rust format
    const solverSettings = { ...problem.settings };

    // The UI sends solver_params as { "SimulatedAnnealing": { ... } }
    // But Rust expects { "solver_type": "SimulatedAnnealing", ... }
    if (
      solverSettings.solver_params &&
      typeof solverSettings.solver_params === "object"
    ) {
      const solverType = solverSettings.solver_type;
      if (
        solverType === "SimulatedAnnealing" &&
        "SimulatedAnnealing" in solverSettings.solver_params
      ) {
        (solverSettings.solver_params as any) = {
          solver_type: solverType,
          ...solverSettings.solver_params.SimulatedAnnealing,
        };
      }
    }

    return {
      problem: {
        people: problem.people,
        groups: problem.groups,
        num_sessions: problem.num_sessions,
      },
      objectives: [
        {
          type: "maximize_unique_contacts",
          weight: 1.0,
        },
      ],
      constraints: problem.constraints,
      solver: solverSettings,
    };
  }

  // Convert Rust solver result to our Solution format
  private convertRustResultToSolution(
    rustResult: any,
    lastProgress?: ProgressUpdate
  ): Solution {
    // Convert the schedule format to assignments
    const assignments: Assignment[] = [];

    for (const [sessionName, groups] of Object.entries(rustResult.schedule)) {
      const sessionId = parseInt(sessionName.replace("session_", ""));
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
      iteration_count: lastProgress?.iteration || 0,
      elapsed_time_ms: lastProgress ? lastProgress.elapsed_seconds * 1000 : 0,
      // Add the new weighted penalty fields
      weighted_repetition_penalty: rustResult.weighted_repetition_penalty,
      weighted_constraint_penalty: rustResult.weighted_constraint_penalty,
    };
  }
}

export const wasmService = new WasmService();
