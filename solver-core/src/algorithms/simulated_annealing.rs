use crate::algorithms::Solver;
use crate::models::{SolverConfiguration, SolverParams, SolverResult};
use crate::solver::{SolverError, State};
use rand::{rng, Rng};
use std::time::Instant;

pub struct SimulatedAnnealing {
    pub max_iterations: u64,
    pub initial_temperature: f64,
    pub final_temperature: f64,
    pub time_limit_seconds: Option<u64>,
    pub no_improvement_iterations: Option<u64>,
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
            time_limit_seconds: params.stop_conditions.time_limit_seconds,
            no_improvement_iterations: params.stop_conditions.no_improvement_iterations,
        }
    }
}

impl Solver for SimulatedAnnealing {
    fn solve(&self, state: &mut State) -> Result<SolverResult, SolverError> {
        let start_time = Instant::now();
        let mut rng = rng();

        let mut current_state = state.clone();
        let mut best_state = state.clone();
        let mut best_cost = state.calculate_cost();
        let mut no_improvement_counter = 0;

        if state.logging.log_initial_state {
            println!("Initial {}", current_state.format_score_breakdown());
        }

        for i in 0..self.max_iterations {
            let temperature = self.initial_temperature
                * (self.final_temperature / self.initial_temperature)
                    .powf(i as f64 / self.max_iterations as f64);

            // --- Choose a random move ---
            let day = rng.random_range(0..current_state.num_sessions as usize);

            let swappable_people: Vec<usize> = (0..current_state.person_idx_to_id.len())
                .filter(|&p_idx| !current_state.immovable_people.contains_key(&(p_idx, day)))
                .collect();

            if swappable_people.len() < 2 {
                continue;
            }

            // Ensure we don't pick an immovable person for a swap
            let p1_idx = swappable_people[rng.random_range(0..swappable_people.len())];
            let mut p2_idx = swappable_people[rng.random_range(0..swappable_people.len())];
            while p1_idx == p2_idx {
                p2_idx = swappable_people[rng.random_range(0..swappable_people.len())];
            }

            // --- Evaluate the swap ---
            let delta_cost = current_state.calculate_swap_cost_delta(day, p1_idx, p2_idx);
            let current_cost = current_state.calculate_cost();
            let next_cost = current_cost + delta_cost;

            if delta_cost < 0.0 || rng.random::<f64>() < (-delta_cost / temperature).exp() {
                current_state.apply_swap(day, p1_idx, p2_idx);

                if next_cost < best_cost {
                    best_cost = next_cost;
                    best_state = current_state.clone();
                    no_improvement_counter = 0;
                }
            }

            // --- Logging ---
            if let Some(freq @ 1..) = state.logging.log_frequency {
                if i > 0 && i % freq == 0 {
                    println!(
                        "Iter {}: Temp={:.4}, Contacts={}, Rep Penalty={}",
                        i,
                        temperature,
                        current_state.unique_contacts,
                        current_state.repetition_penalty
                    );
                }
            }

            // --- Stop Conditions ---
            no_improvement_counter += 1;
            if let Some(no_improvement_limit) = self.no_improvement_iterations {
                if no_improvement_counter > no_improvement_limit {
                    println!(
                        "Stopping early: no improvement for {} iterations.",
                        no_improvement_limit
                    );
                    break;
                }
            }

            if let Some(time_limit) = self.time_limit_seconds {
                if start_time.elapsed().as_secs() >= time_limit {
                    println!(
                        "Stopping early: time limit of {} seconds reached.",
                        time_limit
                    );
                    break;
                }
            }
        }

        let final_cost = best_state.calculate_cost();
        let elapsed = start_time.elapsed().as_secs_f64();

        if state.logging.log_duration_and_score {
            println!(
                "Solver finished in {:.2} seconds. Final score: {:.2}",
                elapsed, final_cost
            );
        }

        // Log final state score breakdown if initial state was logged
        if state.logging.log_initial_state {
            println!("Final {}", best_state.format_score_breakdown());
        }

        best_state.validate_scores();
        let result = best_state.to_solver_result(final_cost);

        if state.logging.display_final_schedule {
            println!("{}", result.display());
        }

        Ok(result)
    }
}
