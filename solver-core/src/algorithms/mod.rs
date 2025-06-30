//! Optimization algorithms for the solver-core.
//!
//! This module contains different optimization algorithms that can be used
//! to solve the social group scheduling problem. All algorithms implement
//! the `Solver` trait for a consistent interface.
//!
//! # Available Algorithms
//!
//! - **Simulated Annealing**: Temperature-based optimization with dual-mode moves
//!   (regular person swaps and intelligent clique swaps)
//!
//! # Adding New Algorithms
//!
//! To add a new optimization algorithm:
//!
//! 1. Create a new module file (e.g., `hill_climbing.rs`)
//! 2. Implement the `Solver` trait for your algorithm struct
//! 3. Add the algorithm to the match statement in `lib.rs`
//! 4. Update the `SolverParams` enum in `models.rs` if algorithm-specific parameters are needed
//!
//! ```no_run
//! use solver_core::algorithms::Solver;
//! use solver_core::models::{SolverResult, SolverConfiguration};
//! use solver_core::solver::{SolverError, State};
//!
//! pub struct MyAlgorithm {
//!     // algorithm parameters
//! }
//!
//! impl MyAlgorithm {
//!     pub fn new(config: &SolverConfiguration) -> Self {
//!         // initialize from configuration
//!         Self { }
//!     }
//! }
//!
//! impl Solver for MyAlgorithm {
//!     fn solve(&self, state: &mut State) -> Result<SolverResult, SolverError> {
//!         // implement your optimization algorithm here
//!         todo!()
//!     }
//! }
//! ```
//!
//! # Algorithm Performance
//!
//! Different algorithms have different performance characteristics:
//!
//! - **Simulated Annealing**: Good balance of exploration and exploitation,
//!   works well for medium to large problems. Slower convergence but higher quality.
//! - **Hill Climbing** (future): Fast convergence, good for small problems,
//!   may get stuck in local optima.
//! - **Genetic Algorithm** (future): Good for very large problems,
//!   population-based approach with parallel evaluation potential.

use crate::models::SolverResult;
use crate::solver::{SolverError, State};

pub mod simulated_annealing;
// pub mod hill_climbing; // Example for future extension

/// A trait that all solver algorithms must implement.
///
/// This trait provides a unified interface for different optimization algorithms.
/// Each algorithm takes a mutable reference to the problem state and returns
/// either an optimized solution or an error.
///
/// The state contains all the problem data (people, groups, constraints) in
/// an efficient internal representation, along with the current schedule and
/// scoring information.
///
/// # Implementation Requirements
///
/// Implementations should:
/// - Use the provided `State` methods for cost calculation and move evaluation
/// - Respect the stop conditions configured in the solver parameters
/// - Log progress information based on the logging configuration
/// - Return the best solution found, even if optimization is stopped early
///
/// # Example Implementation
///
/// ```no_run
/// use solver_core::algorithms::Solver;
/// use solver_core::models::SolverResult;
/// use solver_core::solver::{SolverError, State};
///
/// struct SimpleHillClimbing;
///
/// impl Solver for SimpleHillClimbing {
///     fn solve(&self, state: &mut State) -> Result<SolverResult, SolverError> {
///         let mut best_cost = state.calculate_cost();
///         let mut iterations = 0;
///         
///         loop {
///             // Try a random move
///             let improved = false; // ... implement move logic
///             
///             if !improved {
///                 break; // Local optimum reached
///             }
///             
///             iterations += 1;
///             if iterations >= 10000 {
///                 break; // Prevent infinite loops
///             }
///         }
///         
///         // Return the final result
///         Ok(state.to_solver_result(best_cost))
///     }
/// }
/// ```
pub trait Solver {
    /// Runs the optimization algorithm on the given state.
    ///
    /// This method should optimize the current schedule in the state to
    /// maximize the objective function while minimizing constraint penalties.
    /// The algorithm should respect all configured stop conditions and
    /// logging preferences.
    ///
    /// # Arguments
    ///
    /// * `state` - Mutable reference to the problem state containing the
    ///   current schedule, problem definition, and scoring information.
    ///   The algorithm should modify this state during optimization.
    ///
    /// # Returns
    ///
    /// * `Ok(SolverResult)` - The optimized schedule with detailed scoring
    /// * `Err(SolverError)` - An error if optimization fails
    ///
    /// # Algorithm Guidelines
    ///
    /// - Use `state.calculate_cost()` to evaluate the current solution quality
    /// - Use `state.calculate_swap_cost_delta()` for efficient move evaluation
    /// - Use `state.apply_swap()` to make moves that improve the solution
    /// - Check stop conditions periodically to avoid running indefinitely
    /// - Log progress using the configured logging options
    /// - Always return the best solution found, even if stopped early
    fn solve(&self, state: &mut State) -> Result<SolverResult, SolverError>;
}
