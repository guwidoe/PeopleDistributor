declare module "/pkg/solver_wasm.js" {
  export function solve(problem_json: string): string;
  export function solve_with_progress(
    problem_json: string,
    callback?: (progress_json: string) => boolean
  ): string;
  export function validate_problem(problem_json: string): string;
  export function get_default_settings(): string;
  export function greet(): void;
  export function init_panic_hook(): void;
  export default function init(
    module_or_path?: string | URL | Request
  ): Promise<void>;
}
