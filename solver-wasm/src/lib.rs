use serde::Serialize;
use solver_core::{ApiInput, ProgressCallback, ProgressUpdate, SolverResult};
use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, solver-wasm!");
}

// When the `console_error_panic_hook` feature is enabled, we can call the
// `set_panic_hook` function at least once during initialization, and then
// we will get better error messages if our code ever panics.
//
// For more details see
// https://github.com/rustwasm/console_error_panic_hook#readme
#[cfg(feature = "console_error_panic_hook")]
fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    set_panic_hook();
}

#[wasm_bindgen]
pub fn solve(problem_json: &str) -> Result<String, JsValue> {
    init_panic_hook();

    let api_input: ApiInput = serde_json::from_str(problem_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse problem: {}", e)))?;

    let result = solver_core::run_solver(&api_input)
        .map_err(|e| JsValue::from_str(&format!("Solver error: {}", e)))?;

    let result_json = serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))?;

    Ok(result_json)
}

#[wasm_bindgen]
pub fn solve_with_progress(
    problem_json: &str,
    progress_callback: Option<js_sys::Function>,
) -> Result<String, JsValue> {
    init_panic_hook();

    let api_input: ApiInput = serde_json::from_str(problem_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse problem: {}", e)))?;

    let result = if let Some(js_callback) = progress_callback {
        // Create a Rust callback that calls the JavaScript callback
        let rust_callback = Box::new(move |progress: &ProgressUpdate| -> bool {
            let progress_json = match serde_json::to_string(progress) {
                Ok(json) => json,
                Err(e) => {
                    web_sys::console::error_1(
                        &format!("Failed to serialize progress: {}", e).into(),
                    );
                    return true; // Continue on serialization error
                }
            };

            // Call the JavaScript function with the JSON string
            let this = JsValue::null();
            let json_value = JsValue::from_str(&progress_json);

            match js_callback.call1(&this, &json_value) {
                Ok(result) => {
                    // Convert the result to boolean, defaulting to true
                    result.as_bool().unwrap_or(true)
                }
                Err(e) => {
                    web_sys::console::error_1(&format!("Progress callback error: {:?}", e).into());
                    true // Continue on callback error
                }
            }
        }) as Box<dyn Fn(&ProgressUpdate) -> bool>;

        // SAFETY: WASM is single-threaded, so we can safely transmute to add Send
        let rust_callback: Box<dyn Fn(&ProgressUpdate) -> bool + Send> =
            unsafe { std::mem::transmute(rust_callback) };

        solver_core::run_solver_with_progress(&api_input, Some(&rust_callback))
            .map_err(|e| JsValue::from_str(&format!("Solver error: {}", e)))?
    } else {
        solver_core::run_solver(&api_input)
            .map_err(|e| JsValue::from_str(&format!("Solver error: {}", e)))?
    };

    let result_json = serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))?;

    Ok(result_json)
}

#[wasm_bindgen]
pub fn validate_problem(problem_json: &str) -> Result<String, JsValue> {
    init_panic_hook();

    let api_input: ApiInput = serde_json::from_str(problem_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse problem: {}", e)))?;

    // Basic validation
    let mut errors = Vec::new();

    if api_input.problem.people.is_empty() {
        errors.push("No people defined".to_string());
    }

    if api_input.problem.groups.is_empty() {
        errors.push("No groups defined".to_string());
    }

    if api_input.problem.num_sessions == 0 {
        errors.push("Number of sessions must be greater than 0".to_string());
    }

    // Check if people have valid session participation
    for person in &api_input.problem.people {
        if let Some(sessions) = &person.sessions {
            for &session_id in sessions {
                if session_id >= api_input.problem.num_sessions {
                    errors.push(format!(
                        "Person {} is assigned to invalid session {} (max: {})",
                        person.id,
                        session_id,
                        api_input.problem.num_sessions - 1
                    ));
                }
            }
        }
    }

    let valid = errors.is_empty();

    #[derive(Serialize)]
    struct ValidationResult {
        valid: bool,
        errors: Vec<String>,
    }

    let result = ValidationResult { valid, errors };
    let result_json = serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize validation result: {}", e)))?;

    Ok(result_json)
}

#[wasm_bindgen]
pub fn get_default_settings() -> Result<String, JsValue> {
    init_panic_hook();

    use solver_core::models::{
        LoggingOptions, SimulatedAnnealingParams, SolverConfiguration, SolverParams, StopConditions,
    };

    let settings = SolverConfiguration {
        solver_type: "SimulatedAnnealing".to_string(),
        stop_conditions: StopConditions {
            max_iterations: Some(10000),
            time_limit_seconds: Some(30),
            no_improvement_iterations: Some(5000),
        },
        solver_params: SolverParams::SimulatedAnnealing(SimulatedAnnealingParams {
            initial_temperature: 1.0,
            final_temperature: 0.01,
            cooling_schedule: "geometric".to_string(),
        }),
        logging: LoggingOptions {
            log_frequency: Some(1000),
            log_initial_state: true,
            log_duration_and_score: true,
            display_final_schedule: true,
            log_initial_score_breakdown: true,
            log_final_score_breakdown: true,
            log_stop_condition: true,
            ..Default::default()
        },
    };

    let settings_json = serde_json::to_string(&settings)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize settings: {}", e)))?;

    Ok(settings_json)
}
