declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	export function greet(): void;
	export function init_panic_hook(): void;
	export function solve(problem_json: string): string;
	export function solve_with_progress(problem_json: string, progress_callback?: Function | null): string;
	export function validate_problem(problem_json: string): string;
	export function get_default_settings(): string;
	export function test_callback_consistency(problem_json: string): string;
	
}

declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly solve: (a: number, b: number, c: number) => void;
  readonly solve_with_progress: (a: number, b: number, c: number, d: number) => void;
  readonly validate_problem: (a: number, b: number, c: number) => void;
  readonly get_default_settings: (a: number) => void;
  readonly test_callback_consistency: (a: number, b: number, c: number) => void;
  readonly greet: () => void;
  readonly init_panic_hook: () => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
