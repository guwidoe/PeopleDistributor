import type { Problem, Solution, SolverSettings, WasmModule } from "../types";

class WasmService {
  private module: WasmModule | null = null;
  private loading = false;

  async initialize(): Promise<void> {
    if (this.module || this.loading) {
      return;
    }

    this.loading = true;

    try {
      // Import the WASM module
      const wasmModule = await import("../../../solver-wasm/pkg");
      this.module = wasmModule as unknown as WasmModule;

      console.log("WASM module loaded successfully");
    } catch (error) {
      console.error("Failed to load WASM module:", error);
      throw new Error("Failed to initialize WASM solver");
    } finally {
      this.loading = false;
    }
  }

  async solve(problem: Problem): Promise<Solution> {
    if (!this.module) {
      await this.initialize();
    }

    if (!this.module) {
      throw new Error("WASM module not available");
    }

    try {
      return this.module.solve(problem);
    } catch (error) {
      console.error("WASM solve error:", error);
      throw new Error("Failed to solve problem");
    }
  }

  async validateProblem(
    problem: Problem
  ): Promise<{ valid: boolean; errors: string[] }> {
    if (!this.module) {
      await this.initialize();
    }

    if (!this.module) {
      throw new Error("WASM module not available");
    }

    try {
      return this.module.validate_problem(problem);
    } catch (error) {
      console.error("WASM validation error:", error);
      return { valid: false, errors: ["Validation failed"] };
    }
  }

  async getDefaultSettings(): Promise<SolverSettings> {
    if (!this.module) {
      await this.initialize();
    }

    if (!this.module) {
      throw new Error("WASM module not available");
    }

    try {
      return this.module.get_default_settings();
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
}

export const wasmService = new WasmService();
