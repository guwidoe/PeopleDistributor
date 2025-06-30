import type { Problem, Solution, SolverSettings, WasmModule } from "../types";

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
      // Load the WASM module from the src/wasm directory
      const wasmModule = await import("../wasm/solver_wasm.js").catch(
        (error) => {
          console.warn(
            "WASM module not found - this is expected during development:",
            error.message
          );
          throw new Error(
            "WASM module not available - please build it first with 'npm run build-wasm'"
          );
        }
      );

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
        "WASM module not available - please build it first with 'npm run build-wasm'"
      );
    }

    try {
      const problemJson = JSON.stringify(problem);
      const resultJson = this.module.solve(problemJson);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error("WASM solve error:", error);
      throw new Error("Failed to solve problem");
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
          "WASM module not available - please build it first with 'npm run build-wasm'",
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
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 0.1,
      };
    }

    try {
      const settingsJson = this.module.get_default_settings();
      return JSON.parse(settingsJson);
    } catch (error) {
      console.error("WASM get default settings error:", error);
      // Fallback to reasonable defaults
      return {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 0.1,
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
}

export const wasmService = new WasmService();
