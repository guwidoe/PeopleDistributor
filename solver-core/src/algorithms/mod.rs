use crate::models::SolverResult;
use crate::solver::{SolverError, State};

pub mod simulated_annealing;
// pub mod hill_climbing; // Example for future extension

/// A trait that all solver algorithms must implement.
pub trait Solver {
    /// Takes the initial state and runs the algorithm to produce a final schedule.
    fn solve(&self, state: &mut State) -> Result<SolverResult, SolverError>;
}
