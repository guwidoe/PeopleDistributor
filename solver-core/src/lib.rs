use crate::algorithms::simulated_annealing::SimulatedAnnealing;
use crate::algorithms::Solver;
use crate::models::{ApiInput, SolverResult};
use crate::solver::State;

pub mod algorithms;
pub mod models;
pub mod solver;

pub fn run_solver(input: ApiInput) -> SolverResult {
    // 1. Create the initial state
    let mut state = State::new(&input).unwrap();

    // 2. Select the solver based on input config
    let solver: Box<dyn Solver> = match input.solver.solver_type.as_str() {
        "SimulatedAnnealing" => Box::new(SimulatedAnnealing::new(&input)),
        // "HillClimbing" => Box::new(HillClimbing::new(&input)), // Future extension
        _ => panic!("Unknown solver type: {}", input.solver.solver_type),
    };

    // 3. Run the solver
    solver.solve(&mut state)
}
