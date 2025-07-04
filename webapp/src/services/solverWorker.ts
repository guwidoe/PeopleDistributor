import type { Problem, Solution, SolverSettings } from "../types";
import type { ProgressUpdate, ProgressCallback } from "./wasm";

interface WorkerMessage {
  type: string;
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export class SolverWorkerService {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingMessages = new Map<
    string,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      progressCallback?: ProgressCallback;
    }
  >();
  private isInitialized = false;
  private lastProgressUpdate: ProgressUpdate | null = null;

  async initialize(): Promise<void> {
    if (this.worker || this.isInitialized) {
      return;
    }

    try {
      this.worker = new Worker("/solver-worker.js");
      this.setupMessageHandler();

      // Initialize the worker
      await this.sendMessage("INIT", {});
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize solver worker:", error);
      this.worker = null;
      this.isInitialized = false;
      throw new Error(
        `Failed to initialize solver worker: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private setupMessageHandler(): void {
    if (!this.worker) return;

    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const { type, id, data } = e.data;
      const pending = this.pendingMessages.get(id);

      switch (type) {
        case "INIT_SUCCESS":
          if (pending) {
            pending.resolve(true);
            this.pendingMessages.delete(id);
          }
          break;

        case "PROGRESS":
          if (pending?.progressCallback) {
            try {
              const progress: ProgressUpdate = JSON.parse(data.progressJson);
              pending.progressCallback(progress);
              this.lastProgressUpdate = progress;
            } catch (error) {
              console.error("Failed to parse progress update:", error);
            }
          }
          break;

        case "SOLVE_SUCCESS":
          if (pending) {
            // The worker now returns both the result and the last progress JSON
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { result, lastProgressJson } = data as any;

            let lastProgress: ProgressUpdate | null = null;
            if (lastProgressJson) {
              try {
                lastProgress = JSON.parse(lastProgressJson);
              } catch (e) {
                console.error("Failed to parse last progress update:", e);
              }
            }

            // Resolve with both the final result and the last progress update
            pending.resolve({ result, lastProgress });
            this.pendingMessages.delete(id);
          }
          break;

        case "CANCELLED":
          if (pending) {
            pending.reject(new Error("Solver cancelled"));
            this.pendingMessages.delete(id);
          }
          break;

        case "ERROR":
          if (pending) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pending.reject(new Error((data as any).error));
            this.pendingMessages.delete(id);
          } else {
            console.error("Worker error:", data);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((data as any).problemJson) {
            console.debug(
              "[Worker] Solver input JSON that caused the error:",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (data as any).problemJson
            );
          }
          break;

        case "LOG":
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { level, args } = data as any;
            if (Array.isArray(args)) {
              switch (level) {
                case "warn":
                  console.warn("[Worker]", ...args);
                  break;
                case "error":
                  console.error("[Worker]", ...args);
                  break;
                case "debug":
                  console.debug("[Worker]", ...args);
                  break;
                default:
                  console.log("[Worker]", ...args);
              }
            }
          }
          break;

        case "RPC_SUCCESS":
          if (pending) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pending.resolve((data as any).result);
            this.pendingMessages.delete(id);
          }
          break;

        case "RPC_ERROR":
          if (pending) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pending.reject(new Error((data as any).error));
            this.pendingMessages.delete(id);
          }
          break;

        case "PROBLEM_JSON":
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { problemJson } = data as any;
            try {
              // Store globally for quick copy/paste in devtools
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).lastSolverProblemJson = problemJson;
              // Emit a browser event so other parts of the UI / devtools can listen
              window.dispatchEvent(
                new CustomEvent("solver-problem-json", { detail: problemJson })
              );
            } catch {
              /* no-op */
            }
            console.debug("[Worker] Problem JSON received:", problemJson);
          }
          break;

        default:
          console.warn("Unknown worker message type:", type);
      }
    };

    this.worker.onerror = () => {
      console.error("Worker error occurred");
      // Reject all pending messages
      this.pendingMessages.forEach(({ reject }) => {
        reject(new Error("Worker error"));
      });
      this.pendingMessages.clear();
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendMessage(
    type: string,
    data: any,
    progressCallback?: ProgressCallback
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const id = (++this.messageId).toString();
      this.pendingMessages.set(id, { resolve, reject, progressCallback });

      this.worker.postMessage({ type, id, data });
    });
  }

  async solve(problem: Problem): Promise<Solution> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Build the JSON once so we can log it on errors
    const problemJson = JSON.stringify(
      this.convertProblemToRustFormat(problem)
    );

    // For debugging purposes, log the payload we are about to send to the worker
    console.debug(
      "[SolverWorkerService] Problem JSON sent to worker:",
      problemJson
    );

    const resultJson = await this.sendMessage("SOLVE", {
      problemJson,
      useProgress: false,
    });
    const rustResult = JSON.parse(resultJson);
    return this.convertRustResultToSolution(rustResult, null);
  }

  async solveWithProgress(
    problem: Problem,
    progressCallback?: ProgressCallback
  ): Promise<{ solution: Solution; lastProgress: ProgressUpdate | null }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const problemJson = JSON.stringify(
      this.convertProblemToRustFormat(problem)
    );

    console.debug(
      "[SolverWorkerService] Problem JSON sent to worker (with progress):",
      problemJson
    );

    // The promise now resolves with an object { result, lastProgress }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result, lastProgress } = await this.sendMessage(
      "SOLVE",
      {
        problemJson,
        useProgress: true,
      },
      progressCallback
    );

    const rustResult = JSON.parse(result);
    const solution = this.convertRustResultToSolution(rustResult, lastProgress);

    // Return both the solution and the last progress update
    return { solution, lastProgress };
  }

  async cancel(): Promise<void> {
    if (!this.worker) return;

    // Reject all pending messages with a specific cancellation error
    this.pendingMessages.forEach(({ reject }) => {
      reject(new Error("Solver cancelled by user"));
    });
    this.pendingMessages.clear();

    // Terminate the current worker
    this.worker.terminate();
    this.worker = null;
    this.isInitialized = false;

    // Reinitialize for future use
    try {
      await this.initialize();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.error("Failed to reinitialize worker after cancellation:", error);
      // Don't throw here - cancellation succeeded even if reinitialization failed
    }
  }

  // Convert Problem to the format expected by the Rust solver
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertProblemToRustFormat(problem: Problem): any {
    // Convert solver_params from UI format to Rust format
    const solverSettings = { ...problem.settings };

    // The UI sends solver_params as { "SimulatedAnnealing": { ... } }
    // But Rust expects { "solver_type": "SimulatedAnnealing", initial_temperature: ..., etc }
    // due to the #[serde(tag = "solver_type")] attribute on the SolverParams enum
    if (
      solverSettings.solver_params &&
      typeof solverSettings.solver_params === "object"
    ) {
      const solverType = solverSettings.solver_type;
      if (
        solverType === "SimulatedAnnealing" &&
        "SimulatedAnnealing" in solverSettings.solver_params
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params = solverSettings.solver_params.SimulatedAnnealing as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sanitizeNumber = (v: any, d: number) =>
          typeof v === "number" && !isNaN(v) ? v : d;
        params.initial_temperature = sanitizeNumber(
          params.initial_temperature,
          1.0
        );
        params.final_temperature = sanitizeNumber(
          params.final_temperature,
          0.01
        );
        params.reheat_after_no_improvement = sanitizeNumber(
          params.reheat_after_no_improvement,
          0
        );

        // Flatten for serde tagged enum
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (solverSettings as any).solver_params = {
          solver_type: solverType,
          ...solverSettings.solver_params.SimulatedAnnealing,
        };
      }
    }

    // Prepare objectives list – if none provided, fall back to a sensible default so that
    // existing problems created before objectives were introduced continue to work.
    const objectives =
      problem.objectives && problem.objectives.length > 0
        ? problem.objectives
        : [
            {
              type: "maximize_unique_contacts",
              weight: 1.0,
            },
          ];

    // Clean constraints: ensure penalty_weight is a number when required to satisfy Rust deserialization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanedConstraints = (problem.constraints || []).map((c: any) => {
      if (
        (c.type === "MustStayTogether" || c.type === "CannotBeTogether") &&
        (c.penalty_weight === undefined || c.penalty_weight === null)
      ) {
        return { ...c, penalty_weight: 1000 };
      }
      if (
        c.type === "AttributeBalance" &&
        (c.penalty_weight === undefined || c.penalty_weight === null)
      ) {
        return { ...c, penalty_weight: 50 };
      }
      if (
        c.type === "RepeatEncounter" &&
        (c.penalty_weight === undefined || c.penalty_weight === null)
      ) {
        return { ...c, penalty_weight: 1 };
      }
      return c;
    });

    return {
      problem: {
        people: problem.people,
        groups: problem.groups,
        num_sessions: problem.num_sessions,
      },
      objectives,
      constraints: cleanedConstraints,
      solver: solverSettings,
    };
  }

  // Convert Rust solver result to our Solution format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertRustResultToSolution(
    rustResult: any,
    lastProgress?: ProgressUpdate | null
  ): Solution {
    // Convert the schedule format to assignments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignments: any[] = [];

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

    // Use the provided lastProgress if available, otherwise fall back to the stored one
    const progressToUse = lastProgress || this.lastProgressUpdate;

    return {
      assignments,
      final_score: rustResult.final_score,
      unique_contacts: rustResult.unique_contacts,
      repetition_penalty: rustResult.repetition_penalty,
      attribute_balance_penalty: rustResult.attribute_balance_penalty,
      constraint_penalty: rustResult.constraint_penalty,
      iteration_count: progressToUse?.iteration || 0,
      elapsed_time_ms: (progressToUse?.elapsed_seconds || 0) * 1000,
      // Add the new weighted penalty fields
      weighted_repetition_penalty: rustResult.weighted_repetition_penalty,
      weighted_constraint_penalty: rustResult.weighted_constraint_penalty,
    };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
    this.pendingMessages.clear();
  }

  // Helper to invoke RPC-style methods exposed by the worker / WASM module
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async callSolver(method: string, ...args: any[]): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let data: any = {};

    switch (method) {
      case "get_default_settings":
        // No extra data needed
        data = {};
        break;
      case "get_recommended_settings":
        // Expect args: problemJson, desired_runtime_seconds
        data = {
          problemJson: args[0],
          desired_runtime_seconds: args[1],
        };
        break;
      default:
        // Generic mapping: send raw args array
        data = { args };
    }

    const result = await this.sendMessage(method, data);
    return result;
  }

  public async get_default_settings(): Promise<SolverSettings> {
    const result = await this.callSolver("get_default_settings");
    return JSON.parse(result as string);
  }

  public async get_recommended_settings(
    problem: Problem,
    desired_runtime_seconds: number
  ): Promise<SolverSettings> {
    // ===== DEBUG LOGGING =====
    // These logs help verify exactly what is sent to the WASM layer and what comes back.
    try {
      console.debug(
        "[SolverWorker] get_recommended_settings → problem:",
        JSON.stringify(problem, null, 2)
      );
      console.debug(
        "[SolverWorker] get_recommended_settings → desired_runtime_seconds:",
        desired_runtime_seconds
      );
    } catch (e) {
      // Swallow JSON.stringify errors for circular structures – shouldn't happen here.
    }

    const result = await this.callSolver(
      "get_recommended_settings",
      JSON.stringify(problem),
      desired_runtime_seconds
    );

    // Log the raw JSON result for inspection before parsing.
    try {
      console.debug(
        "[SolverWorker] get_recommended_settings ← raw result:",
        result
      );
    } catch {
      /* ignore */
    }

    return JSON.parse(result as string);
  }
}

export const solverWorkerService = new SolverWorkerService();
