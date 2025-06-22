use crate::algorithms::Solver;
use crate::models::{ApiInput, SimulatedAnnealingParams, SolverParams, SolverResult};
use crate::solver::State;
use rand::seq::IndexedRandom;
use rand::Rng;

pub struct SimulatedAnnealing {
    params: SimulatedAnnealingParams,
    max_iterations: u64,
}

impl SimulatedAnnealing {
    pub fn new(input: &ApiInput) -> Self {
        let params = if let Some(SolverParams::SimulatedAnnealing(p)) = &input.solver.solver_params
        {
            p.clone()
        } else {
            // Provide default SA params if not specified
            SimulatedAnnealingParams {
                initial_temperature: 1.0,
                final_temperature: 0.001,
                cooling_schedule: "geometric".to_string(),
            }
        };
        let max_iterations = input
            .solver
            .stop_conditions
            .max_iterations
            .unwrap_or(100_000);
        Self {
            params,
            max_iterations,
        }
    }
}

impl Solver for SimulatedAnnealing {
    fn solve(&self, state: &mut State) -> SolverResult {
        let mut rng = rand::rng();
        let mut temp = self.params.initial_temperature;
        let final_temp = self.params.final_temperature;
        let cooling_rate = (final_temp / temp).powf(1.0 / self.max_iterations as f64);

        println!("Simulated Annealing starting...");
        println!(" -> Initial Temperature: {}", temp);
        println!(" -> Max Iterations: {}", self.max_iterations);
        println!(
            " -> Initial Scores: Contacts={}, Repetition Penalty={}, Gender Balance Penalty={}",
            state.unique_contacts, state.repetition_penalty, state.gender_balance_penalty
        );

        // Main simulated annealing loop
        for _ in 0..self.max_iterations {
            let move_type = rng.random::<f32>();

            if !state.cliques.is_empty() && move_type < 0.5 {
                // --- Perform a Clique Swap ---
                let clique_idx = rng.random_range(0..state.cliques.len());
                let clique_to_move = state.cliques[clique_idx].clone();
                let day = rng.random_range(0..state.num_sessions as usize);
                let g1_idx = state.locations[day][clique_to_move[0]].0;

                let potential_g2s: Vec<usize> = (0..state.group_idx_to_id.len())
                    .filter(|&g| g != g1_idx)
                    .collect();
                if potential_g2s.is_empty() {
                    continue;
                }
                let g2_idx = potential_g2s[rng.random_range(0..potential_g2s.len())];

                let g2_individuals: Vec<usize> = state.schedule[day][g2_idx]
                    .iter()
                    .cloned()
                    .filter(|p| state.person_to_clique_id[*p].is_none())
                    .collect();

                if g2_individuals.len() >= clique_to_move.len() {
                    let people_from_g2: Vec<usize> = g2_individuals
                        .choose_multiple(&mut rng, clique_to_move.len())
                        .cloned()
                        .collect();
                    let deltas =
                        state._calculate_multi_swap_delta(day, &clique_to_move, &people_from_g2);
                    let (
                        contact_delta,
                        repetition_delta,
                        gender_balance_delta,
                        constraint_penalty_delta,
                    ) = deltas;
                    let score_delta = contact_delta as f64 * state.w_contacts
                        - repetition_delta as f64 * state.w_repetition
                        - gender_balance_delta as f64 * state.w_gender
                        - constraint_penalty_delta as f64 * state.w_constraint;

                    if score_delta >= 0.0 || rng.random::<f64>() < (score_delta / temp).exp() {
                        state._apply_multi_swap(
                            day,
                            g1_idx,
                            g2_idx,
                            &clique_to_move,
                            &people_from_g2,
                        );
                    }
                }
            } else {
                // --- Perform a Single Person Swap ---
                let p1_idx = rng.random_range(0..state.person_idx_to_id.len());
                let p2_idx = rng.random_range(0..state.person_idx_to_id.len());

                if state.person_to_clique_id[p1_idx].is_some()
                    || state.person_to_clique_id[p2_idx].is_some()
                {
                    continue; // For simplicity, only swap individuals not in cliques
                }

                let day = rng.random_range(0..state.num_sessions as usize);
                let (g1_idx, _) = state.locations[day][p1_idx];
                let (g2_idx, _) = state.locations[day][p2_idx];

                if g1_idx != g2_idx {
                    let deltas = state._calculate_score_delta(day, p1_idx, p2_idx);
                    let (
                        contact_delta,
                        repetition_delta,
                        gender_balance_delta,
                        constraint_penalty_delta,
                    ) = deltas;

                    let score_delta = contact_delta as f64 * state.w_contacts
                        - repetition_delta as f64 * state.w_repetition
                        - gender_balance_delta as f64 * state.w_gender
                        - constraint_penalty_delta as f64 * state.w_constraint;

                    if score_delta >= 0.0 || rng.random::<f64>() < (score_delta / temp).exp() {
                        state._apply_swap(day, p1_idx, p2_idx, deltas);
                    }
                }
            }

            // Cool down temperature
            match self.params.cooling_schedule.as_str() {
                "geometric" => temp *= cooling_rate,
                "linear" => {
                    temp -=
                        (self.params.initial_temperature - final_temp) / self.max_iterations as f64
                }
                _ => temp *= cooling_rate, // Default to geometric
            }
            if temp < final_temp {
                temp = final_temp;
            }
        }

        let final_score = state.unique_contacts as f64 * state.w_contacts
            - state.repetition_penalty as f64 * state.w_repetition
            - state.gender_balance_penalty as f64 * state.w_gender
            - state.constraint_penalty as f64 * state.w_constraint;

        println!("Solver finished.");
        println!(
            " -> Final Scores: Contacts={}, Repetition Penalty={}, Gender Balance Penalty={}",
            state.unique_contacts, state.repetition_penalty, state.gender_balance_penalty
        );
        println!(" -> Final Weighted Score: {}", final_score);

        state.to_solver_result(final_score)
    }
}
