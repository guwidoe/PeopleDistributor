use crate::algorithms::simulated_annealing::SimulatedAnnealing;
use crate::algorithms::Solver;
use crate::solver::{SolverError, State};
pub use models::{ApiInput, SolverResult};

pub mod algorithms;
pub mod models;
pub mod solver;

pub fn run_solver(input: &ApiInput) -> Result<SolverResult, SolverError> {
    let mut state = State::new(input)?;
    let solver = match input.solver.solver_type.as_str() {
        "SimulatedAnnealing" => Box::new(SimulatedAnnealing::new(&input.solver)),
        // "HillClimbing" => Box::new(HillClimbing::new(&input)), // Future extension
        _ => panic!("Unknown solver type"),
    };
    solver.solve(&mut state)
}
