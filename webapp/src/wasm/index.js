// Stub file for development when WASM module is not built
// This prevents import errors and allows the frontend to run

export function solve() {
  throw new Error("WASM module not built - please run 'npm run build-wasm'");
}

export function validate_problem() {
  throw new Error("WASM module not built - please run 'npm run build-wasm'");
}

export function get_default_settings() {
  throw new Error("WASM module not built - please run 'npm run build-wasm'");
} 