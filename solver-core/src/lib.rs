//! # Solver-Core: Advanced Group Distribution Optimization Engine
//!
//! This crate provides a high-performance optimization engine for solving the social group
//! scheduling problem. It distributes people into groups across multiple sessions while
//! maximizing social interactions and respecting complex constraints.
//!
//! ## Quick Example
//!
//! ```no_run
//! use solver_core::{run_solver, models::*};
//! use std::collections::HashMap;
//!
//! let input = ApiInput {
//!     problem: ProblemDefinition {
//!         people: vec![
//!             Person {
//!                 id: "Alice".to_string(),
//!                 attributes: HashMap::new(),
//!                 sessions: None,
//!             },
//!             Person {
//!                 id: "Bob".to_string(),
//!                 attributes: HashMap::new(),
//!                 sessions: None,
//!             },
//!         ],
//!         groups: vec![
//!             Group { id: "Team1".to_string(), size: 2 }
//!         ],
//!         num_sessions: 2,
//!     },
//!     objectives: vec![],
//!     constraints: vec![],
//!     solver: SolverConfiguration {
//!         solver_type: "SimulatedAnnealing".to_string(),
//!         stop_conditions: StopConditions {
//!             max_iterations: Some(1000),
//!             time_limit_seconds: None,
//!             no_improvement_iterations: None,
//!         },
//!         solver_params: SolverParams::SimulatedAnnealing(
//!             SimulatedAnnealingParams {
//!                 initial_temperature: 10.0,
//!                 final_temperature: 0.1,
//!                 cooling_schedule: "geometric".to_string(),
//!             }
//!         ),
//!         logging: LoggingOptions::default(),
//!     },
//! };
//!
//! match run_solver(&input) {
//!     Ok(result) => {
//!         println!("Final score: {}", result.final_score);
//!         println!("Schedule:\n{}", result.display());
//!     },
//!     Err(e) => eprintln!("Error: {:?}", e),
//! }
//! ```

use crate::algorithms::simulated_annealing::SimulatedAnnealing;
use crate::algorithms::Solver;
use crate::solver::{SolverError, State};
pub use models::{ApiInput, ProgressCallback, ProgressUpdate, SolverResult};

pub mod algorithms;
pub mod models;
pub mod solver;

/// Runs the optimization solver with the given input configuration.
///
/// This is the main entry point for the solver-core library. It takes a complete
/// problem definition with constraints and solver configuration, then returns an
/// optimized schedule that maximizes unique social contacts while respecting all
/// specified constraints.
///
/// # Arguments
///
/// * `input` - A complete problem specification including:
///   - `problem`: People, groups, and number of sessions to schedule
///   - `objectives`: Optimization goals (e.g., maximize unique contacts)
///   - `constraints`: Rules that must be satisfied or penalized
///   - `solver`: Algorithm configuration and parameters
///
/// # Returns
///
/// Returns a `Result` containing either:
/// - `Ok(SolverResult)`: The optimized schedule with detailed scoring breakdown
/// - `Err(SolverError)`: An error if the problem configuration is invalid
///
/// # Errors
///
/// This function will return an error if:
/// - The total group capacity is insufficient for all people
/// - Constraint definitions are contradictory or invalid
/// - Required solver parameters are missing or invalid
/// - People or group IDs are not unique
///
/// # Example
///
/// ```no_run
/// use solver_core::{run_solver, models::*};
/// use std::collections::HashMap;
///
/// let input = ApiInput {
///     problem: ProblemDefinition {
///         people: vec![
///             Person {
///                 id: "Alice".to_string(),
///                 attributes: {
///                     let mut attrs = HashMap::new();
///                     attrs.insert("gender".to_string(), "female".to_string());
///                     attrs
///                 },
///                 sessions: None, // Participates in all sessions
///             },
///             Person {
///                 id: "Bob".to_string(),
///                 attributes: {
///                     let mut attrs = HashMap::new();
///                     attrs.insert("gender".to_string(), "male".to_string());
///                     attrs
///                 },
///                 sessions: Some(vec![0, 1]), // Only sessions 0 and 1
///             },
///         ],
///         groups: vec![
///             Group { id: "Team1".to_string(), size: 2 },
///         ],
///         num_sessions: 3,
///     },
///     objectives: vec![
///         Objective {
///             r#type: "maximize_unique_contacts".to_string(),
///             weight: 1.0,
///         }
///     ],
///     constraints: vec![
///         Constraint::RepeatEncounter(RepeatEncounterParams {
///             max_allowed_encounters: 1,
///             penalty_function: "squared".to_string(),
///             penalty_weight: 100.0,
///         }),
///     ],
///     solver: SolverConfiguration {
///         solver_type: "SimulatedAnnealing".to_string(),
///         stop_conditions: StopConditions {
///             max_iterations: Some(10_000),
///             time_limit_seconds: Some(30),
///             no_improvement_iterations: Some(1_000),
///         },
///         solver_params: SolverParams::SimulatedAnnealing(
///             SimulatedAnnealingParams {
///                 initial_temperature: 100.0,
///                 final_temperature: 0.1,
///                 cooling_schedule: "geometric".to_string(),
///             }
///         ),
///         logging: LoggingOptions {
///             display_final_schedule: true,
///             log_final_score_breakdown: true,
///             ..Default::default()
///         },
///     },
/// };
///
/// match run_solver(&input) {
///     Ok(result) => {
///         println!("Optimization completed!");
///         println!("Final score: {}", result.final_score);
///         println!("Unique contacts: {}", result.unique_contacts);
///         println!("Repetition penalty: {}", result.repetition_penalty);
///         println!("\nSchedule:");
///         println!("{}", result.display());
///     }
///     Err(e) => {
///         eprintln!("Optimization failed: {:?}", e);
///     }
/// }
/// ```
///
/// # Supported Solver Types
///
/// Currently supported solver types:
/// - `"SimulatedAnnealing"`: Temperature-based optimization with configurable cooling schedules
///
/// # Performance Notes
///
/// The solver uses efficient delta cost calculations and integer-based internal
/// representations for optimal performance. Typical performance characteristics:
/// - Small problems (12 people, 3 groups): < 1 second
/// - Medium problems (30 people, 6 groups): 5-10 seconds  
/// - Large problems (60+ people, 10+ groups): 30-60 seconds
pub fn run_solver(input: &ApiInput) -> Result<SolverResult, SolverError> {
    run_solver_with_progress(input, None)
}

/// Runs the optimization solver with progress callback support.
///
/// This is an extended version of `run_solver` that accepts an optional progress
/// callback function. The callback will be called periodically during optimization
/// to report progress information such as current iteration, temperature, and scores.
///
/// # Arguments
///
/// * `input` - A complete problem specification (same as `run_solver`)
/// * `progress_callback` - Optional callback function that receives progress updates
///   and can request early termination by returning `false`
///
/// # Returns
///
/// Same as `run_solver`: either the optimized result or an error.
///
/// # Example
///
/// ```no_run
/// use solver_core::{run_solver_with_progress, models::*};
/// use std::collections::HashMap;
///
/// # let input = ApiInput {
/// #     problem: ProblemDefinition { people: vec![], groups: vec![], num_sessions: 1 },
/// #     objectives: vec![], constraints: vec![],
/// #     solver: SolverConfiguration {
/// #         solver_type: "SimulatedAnnealing".to_string(),
/// #         stop_conditions: StopConditions { max_iterations: Some(1000), time_limit_seconds: None, no_improvement_iterations: None },
/// #         solver_params: SolverParams::SimulatedAnnealing(SimulatedAnnealingParams { initial_temperature: 10.0, final_temperature: 0.1, cooling_schedule: "geometric".to_string() }),
/// #         logging: LoggingOptions::default(),
/// #     },
/// # };
///
/// let progress_callback = Box::new(|progress: &ProgressUpdate| -> bool {
///     println!("Iteration {}/{}: Score = {:.2}, Temperature = {:.4}",
///              progress.iteration, progress.max_iterations,
///              progress.current_score, progress.temperature);
///     
///     // Continue optimization (return false to stop early)
///     true
/// });
///
/// match run_solver_with_progress(&input, Some(&progress_callback)) {
///     Ok(result) => println!("Final score: {}", result.final_score),
///     Err(e) => eprintln!("Error: {:?}", e),
/// }
/// ```
pub fn run_solver_with_progress(
    input: &ApiInput,
    progress_callback: Option<&models::ProgressCallback>,
) -> Result<SolverResult, SolverError> {
    let mut state = State::new(input)?;
    let solver = match input.solver.solver_type.as_str() {
        "SimulatedAnnealing" => Box::new(SimulatedAnnealing::new(&input.solver)),
        // "HillClimbing" => Box::new(HillClimbing::new(&input)), // Future extension
        _ => panic!("Unknown solver type"),
    };
    solver.solve(&mut state, progress_callback)
}
