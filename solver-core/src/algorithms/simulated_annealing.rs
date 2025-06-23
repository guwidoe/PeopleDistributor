use crate::algorithms::Solver;
use crate::models::{SolverConfiguration, SolverParams, SolverResult};
use crate::solver::{SolverError, State};
use rand::rngs::ThreadRng;
use rand::{rng, Rng};
use std::time::Instant;

pub struct SimulatedAnnealing {
    pub max_iterations: u64,
    pub initial_temperature: f64,
    pub final_temperature: f64,
}

impl SimulatedAnnealing {
    pub fn new(params: &SolverConfiguration) -> Self {
        let sa_params = match &params.solver_params {
            SolverParams::SimulatedAnnealing(p) => p,
        };
        Self {
            max_iterations: params.stop_conditions.max_iterations.unwrap_or(100_000),
            initial_temperature: sa_params.initial_temperature,
            final_temperature: sa_params.final_temperature,
        }
    }
}

impl Solver for SimulatedAnnealing {
    fn solve(&self, state: &mut State) -> Result<SolverResult, SolverError> {
        let start_time = Instant::now();
        let mut rng = rng();

        let mut current_state = state.clone();
        let mut best_state = state.clone();
        let mut best_score = state.weighted_score();
        let mut no_improvement_counter = 0;

        println!(
            "Initial state: Contacts={}, Repetition={}, AttributeBalance={:.2}",
            current_state.unique_contacts,
            current_state.repetition_penalty,
            current_state.attribute_balance_penalty
        );

        for i in 0..self.max_iterations {
            let temperature = self.initial_temperature
                * (self.final_temperature / self.initial_temperature)
                    .powf(i as f64 / self.max_iterations as f64);

            // --- Choose a random move ---
            let day = rng.random_range(0..current_state.num_sessions as usize);
            let people_count = current_state.person_idx_to_id.len();
            let p1_idx = rng.random_range(0..people_count);
            let mut p2_idx = rng.random_range(0..people_count);
            while p1_idx == p2_idx {
                p2_idx = rng.random_range(0..people_count);
            }

            // --- Evaluate the swap ---
            let mut next_state = current_state.clone();
            next_state.swap_people(day, p1_idx, p2_idx);
            next_state._recalculate_scores();

            let current_score = current_state.weighted_score();
            let next_score = next_state.weighted_score();

            if accept_move(current_score, next_score, temperature, &mut rng) {
                current_state = next_state;
                if next_score > best_score {
                    best_score = next_score;
                    best_state = current_state.clone();
                    no_improvement_counter = 0;
                }
            }

            // --- Logging ---
            if i % 100000 == 0 {
                println!(
                    "Iter {}: Temp={:.4}, Contacts={}, Rep Penalty={}",
                    i, temperature, current_state.unique_contacts, current_state.repetition_penalty
                );
            }

            // --- Stop Condition ---
            no_improvement_counter += 1;
            if no_improvement_counter > 1000000 {
                // Stop if no improvement is found for a while
                println!("Stopping early due to no improvement.");
                break;
            }
        }

        let final_score = best_state.weighted_score();
        let elapsed = start_time.elapsed().as_secs_f64();
        println!("Solver finished in {:.2} seconds.", elapsed);

        Ok(best_state.to_solver_result(final_score))
    }
}

fn accept_move(current_score: f64, next_score: f64, temperature: f64, rng: &mut ThreadRng) -> bool {
    if next_score > current_score {
        true
    } else {
        if temperature == 0.0 {
            return false;
        }
        let probability = ((next_score - current_score) / temperature).exp();
        rng.random::<f64>() < probability
    }
}
