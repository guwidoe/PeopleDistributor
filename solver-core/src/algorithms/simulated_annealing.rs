//! Simulated Annealing optimization algorithm implementation.
//!
//! This module implements a sophisticated Simulated Annealing algorithm specifically
//! designed for the Social Group Scheduling Problem. The algorithm uses temperature-based
//! acceptance probabilities to explore the solution space effectively, avoiding local
//! optima through controlled acceptance of worse solutions.
//!
//! # Algorithm Features
//!
//! - **Dual Move Types**: Regular person swaps and intelligent clique swaps
//! - **Adaptive Probability**: Dynamic adjustment between move types based on problem characteristics
//! - **Geometric Cooling**: Temperature decreases geometrically over iterations
//! - **Multiple Stop Conditions**: Iteration limits, time limits, and no-improvement detection
//! - **Comprehensive Logging**: Detailed progress tracking and debugging information
//!
//! # Temperature Schedule
//!
//! The algorithm uses a geometric cooling schedule:
//! ```text
//! temperature(i) = initial_temp × (final_temp / initial_temp)^(i / max_iterations)
//! ```
//!
//! This provides smooth temperature decay from high exploration to low exploitation.

use crate::algorithms::Solver;
use crate::models::{SolverConfiguration, SolverParams, SolverResult};
use crate::solver::{SolverError, State};
use rand::seq::SliceRandom;
use rand::{rng, Rng};
use std::time::Instant;

/// Simulated Annealing solver for the Social Group Scheduling Problem.
///
/// This implementation combines classical simulated annealing with domain-specific
/// optimizations for social group scheduling. It intelligently balances exploration
/// and exploitation while respecting complex constraints like clique integrity.
///
/// # Algorithm Overview
///
/// Simulated Annealing is a probabilistic optimization algorithm inspired by the
/// annealing process in metallurgy. It starts with high "temperature" allowing
/// many moves (including poor ones) and gradually "cools" to focus on improvements.
///
/// ## Key Components
///
/// 1. **Temperature Schedule**: Controls exploration vs exploitation balance
/// 2. **Move Generation**: Intelligent selection between person swaps and clique moves
/// 3. **Acceptance Criterion**: Metropolis criterion for probabilistic acceptance
/// 4. **Stop Conditions**: Multiple termination criteria for robust convergence
///
/// ## Move Types
///
/// ### Regular Swaps
/// - Swaps two individual people between groups
/// - Fast to evaluate and execute
/// - Good for fine-tuning solutions
///
/// ### Clique Swaps
/// - Moves entire cliques (groups that must stay together)
/// - More complex but respects constraint structure
/// - Essential for problems with many clique constraints
///
/// # Configuration
///
/// The algorithm is configured through `SimulatedAnnealingParams`:
/// - `initial_temperature`: Starting temperature (higher = more exploration)
/// - `final_temperature`: Ending temperature (lower = more focused)
/// - `cooling_schedule`: How temperature decreases (currently "geometric")
///
/// Stop conditions are configured through `StopConditions`:
/// - `max_iterations`: Maximum optimization iterations
/// - `time_limit_seconds`: Wall-clock time limit
/// - `no_improvement_iterations`: Early stopping on convergence
///
/// # Example Usage
///
/// ```no_run
/// use solver_core::algorithms::simulated_annealing::SimulatedAnnealing;
/// use solver_core::algorithms::Solver;
/// use solver_core::models::*;
/// use solver_core::solver::State;
/// use std::collections::HashMap;
///
/// // Configure the algorithm
/// let config = SolverConfiguration {
///     solver_type: "SimulatedAnnealing".to_string(),
///     stop_conditions: StopConditions {
///         max_iterations: Some(10000),
///         time_limit_seconds: Some(30),
///         no_improvement_iterations: Some(1000),
///     },
///     solver_params: SolverParams::SimulatedAnnealing(
///         SimulatedAnnealingParams {
///             initial_temperature: 100.0,  // High exploration
///             final_temperature: 0.01,     // Low exploitation
///             cooling_schedule: "geometric".to_string(),
///         }
///     ),
///     logging: LoggingOptions {
///         log_frequency: Some(1000),
///         log_duration_and_score: true,
///         log_final_score_breakdown: true,
///         ..Default::default()
///     },
/// };
///
/// // Create and run the solver
/// let solver = SimulatedAnnealing::new(&config);
/// let input = ApiInput { /* ... */ };
/// # let input = ApiInput {
/// #     problem: ProblemDefinition { people: vec![], groups: vec![], num_sessions: 1 },
/// #     objectives: vec![], constraints: vec![], solver: config,
/// # };
/// let mut state = State::new(&input)?;
/// let result = solver.solve(&mut state)?;
///
/// println!("Final score: {}", result.final_score);
/// println!("Unique contacts: {}", result.unique_contacts);
/// # Ok::<(), solver_core::solver::SolverError>(())
/// ```
///
/// # Performance Characteristics
///
/// - **Time Complexity**: O(iterations × move_evaluation_cost)
/// - **Space Complexity**: O(problem_size) for state storage plus cloning overhead
/// - **Convergence**: Typically requires 10,000-100,000 iterations for good solutions
/// - **Scaling**: Handles problems with hundreds of people and complex constraints
///
/// # Parameter Tuning Guidelines
///
/// ## Temperature Range
/// - **Initial Temperature**: Set high enough that ~80% of worse moves are initially accepted
/// - **Final Temperature**: Set low enough that only small improvements are accepted at the end
/// - **Rule of thumb**: `initial_temp / final_temp` ratio of 100-1000
///
/// ## Iteration Count
/// - **Small problems** (< 50 people): 10,000-50,000 iterations
/// - **Medium problems** (50-200 people): 50,000-200,000 iterations  
/// - **Large problems** (> 200 people): 200,000+ iterations
///
/// ## Stop Conditions
/// - **Time limits**: Use for production systems with response time requirements
/// - **No improvement**: Typically 5-10% of max_iterations for early stopping
/// - **Iteration limits**: Primary termination condition for consistent results
pub struct SimulatedAnnealing {
    /// Maximum number of optimization iterations to perform
    pub max_iterations: u64,
    /// Starting temperature for the annealing schedule
    pub initial_temperature: f64,
    /// Ending temperature for the annealing schedule
    pub final_temperature: f64,
    /// Optional wall-clock time limit in seconds
    pub time_limit_seconds: Option<u64>,
    /// Optional early stopping after this many iterations without improvement
    pub no_improvement_iterations: Option<u64>,
}

impl SimulatedAnnealing {
    /// Creates a new Simulated Annealing solver from configuration.
    ///
    /// Extracts the simulated annealing parameters from the solver configuration
    /// and sets up the algorithm with appropriate stop conditions.
    ///
    /// # Arguments
    ///
    /// * `params` - Complete solver configuration including SA parameters and stop conditions
    ///
    /// # Returns
    ///
    /// A configured `SimulatedAnnealing` instance ready to solve problems.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use solver_core::algorithms::simulated_annealing::SimulatedAnnealing;
    /// use solver_core::models::*;
    ///
    /// let config = SolverConfiguration {
    ///     solver_type: "SimulatedAnnealing".to_string(),
    ///     stop_conditions: StopConditions {
    ///         max_iterations: Some(50000),
    ///         time_limit_seconds: None,
    ///         no_improvement_iterations: Some(5000),
    ///     },
    ///     solver_params: SolverParams::SimulatedAnnealing(
    ///         SimulatedAnnealingParams {
    ///             initial_temperature: 50.0,
    ///             final_temperature: 0.1,
    ///             cooling_schedule: "geometric".to_string(),
    ///         }
    ///     ),
    ///     logging: LoggingOptions::default(),
    /// };
    ///
    /// let solver = SimulatedAnnealing::new(&config);
    /// assert_eq!(solver.max_iterations, 50000);
    /// assert_eq!(solver.initial_temperature, 50.0);
    /// ```
    pub fn new(params: &SolverConfiguration) -> Self {
        let SolverParams::SimulatedAnnealing(sa_params) = &params.solver_params;
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
    /// Executes the simulated annealing optimization algorithm.
    ///
    /// This method implements the complete simulated annealing optimization process,
    /// including temperature scheduling, move generation, acceptance decisions, and
    /// convergence detection. It modifies the provided state to find the best
    /// solution within the configured limits.
    ///
    /// # Algorithm Flow
    ///
    /// 1. **Initialization**: Set up tracking variables and log initial state
    /// 2. **Main Loop**: For each iteration:
    ///    - Calculate current temperature using geometric cooling
    ///    - Choose move type (regular swap vs clique swap) probabilistically
    ///    - Generate and evaluate a random move
    ///    - Accept/reject using Metropolis criterion
    ///    - Update best solution if improved
    ///    - Check stop conditions
    /// 3. **Finalization**: Return best solution found and log results
    ///
    /// # Move Selection Strategy
    ///
    /// The algorithm intelligently chooses between two move types:
    ///
    /// ## Clique Swaps (Probability-Based)
    /// - Triggered when `calculate_clique_swap_probability()` suggests it
    /// - Moves entire cliques while respecting constraints
    /// - More expensive but handles constraint structure better
    /// - Essential for problems with many "must-stay-together" constraints
    ///
    /// ## Regular Swaps (Default)
    /// - Swaps individual people between groups
    /// - Fast to evaluate and execute
    /// - Excludes immovable people and clique members
    /// - Good for fine-tuning and general optimization
    ///
    /// # Acceptance Criterion
    ///
    /// Uses the Metropolis criterion for probabilistic acceptance:
    /// ```text
    /// if delta_cost < 0:
    ///     accept (improvement)
    /// else:
    ///     accept with probability = exp(-delta_cost / temperature)
    /// ```
    ///
    /// This allows exploration of worse solutions early (high temperature) and
    /// focuses on improvements later (low temperature).
    ///
    /// # Arguments
    ///
    /// * `state` - Mutable reference to the problem state to optimize
    ///
    /// # Returns
    ///
    /// * `Ok(SolverResult)` - The best solution found with detailed scoring
    /// * `Err(SolverError)` - If an error occurs during optimization
    ///
    /// # Stop Conditions
    ///
    /// The algorithm stops when the first of these conditions is met:
    /// - **Max iterations**: Reached the configured iteration limit
    /// - **Time limit**: Exceeded the wall-clock time limit
    /// - **No improvement**: No better solution found for the specified number of iterations
    ///
    /// # Performance Notes
    ///
    /// - **Memory usage**: Maintains current state + best state (2x problem size)
    /// - **CPU usage**: Dominated by move evaluation and acceptance calculations
    /// - **Iteration speed**: Typically 100-10,000 iterations per second depending on problem size
    /// - **Convergence**: Usually finds good solutions within first 10-20% of iterations
    ///
    /// # Logging Output
    ///
    /// Controlled by `LoggingOptions`, the method can output:
    /// - Initial score breakdown
    /// - Periodic progress updates (temperature, contacts, penalties)
    /// - Stop condition messages
    /// - Final timing and score information
    /// - Detailed final score breakdown
    ///
    /// # Example Usage
    ///
    /// ```no_run
    /// use solver_core::algorithms::simulated_annealing::SimulatedAnnealing;
    /// use solver_core::algorithms::Solver;
    /// use solver_core::models::*;
    /// use solver_core::solver::State;
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
    /// // Set up the problem and solver
    /// let solver = SimulatedAnnealing::new(&input.solver);
    /// let mut state = State::new(&input)?;
    ///
    /// // Run optimization
    /// let initial_cost = state.calculate_cost();
    /// let result = solver.solve(&mut state)?;
    ///
    /// // Analyze results
    /// println!("Optimization completed!");
    /// println!("Initial cost: {:.2}", initial_cost);
    /// println!("Final cost: {:.2}", result.final_score);
    /// println!("Improvement: {:.2}", initial_cost - result.final_score);
    /// println!("Unique contacts achieved: {}", result.unique_contacts);
    ///
    /// // Access the optimized schedule
    /// for (session, groups) in &result.schedule {
    ///     println!("{}:", session);
    ///     for (group_name, people) in groups {
    ///         println!("  {}: {:?}", group_name, people);
    ///     }
    /// }
    /// # Ok::<(), solver_core::solver::SolverError>(())
    /// ```
    ///
    /// # Algorithm Details
    ///
    /// ## Temperature Schedule
    /// ```text
    /// T(i) = T_initial × (T_final / T_initial)^(i / max_iterations)
    /// ```
    /// This geometric schedule provides smooth cooling from exploration to exploitation.
    ///
    /// ## Clique Swap Logic
    /// When attempting a clique swap:
    /// 1. Select a random clique
    /// 2. Find its current group location
    /// 3. Identify feasible target groups (capacity + constraints)
    /// 4. Select non-clique people to swap out
    /// 5. Evaluate cost delta for the complex move
    /// 6. Apply Metropolis acceptance criterion
    ///
    /// ## Regular Swap Logic
    /// When attempting a regular swap:
    /// 1. Filter to swappable people (non-immovable, non-clique)
    /// 2. Select two random people
    /// 3. Evaluate cost delta efficiently
    /// 4. Apply Metropolis acceptance criterion
    ///
    /// # Tuning Recommendations
    ///
    /// For **exploration problems** (many local optima):
    /// - Increase `initial_temperature`
    /// - Increase `max_iterations`
    /// - Use longer `no_improvement_iterations`
    ///
    /// For **exploitation problems** (single broad optimum):
    /// - Decrease `initial_temperature`
    /// - Decrease cooling rate (smaller `final_temperature`)
    /// - Use shorter iteration limits
    ///
    /// For **constraint-heavy problems**:
    /// - Increase constraint penalty weights
    /// - Monitor clique swap acceptance rates
    /// - Use longer optimization times
    fn solve(&self, state: &mut State) -> Result<SolverResult, SolverError> {
        let start_time = Instant::now();
        let mut rng = rng();

        let mut current_state = state.clone();
        let mut best_state = state.clone();
        let mut best_cost = state.calculate_cost();
        let mut no_improvement_counter = 0;

        if state.logging.log_initial_score_breakdown {
            println!(
                "Initial state score breakdown: {}",
                state.format_score_breakdown()
            );
        }

        for i in 0..self.max_iterations {
            let temperature = self.initial_temperature
                * (self.final_temperature / self.initial_temperature)
                    .powf(i as f64 / self.max_iterations as f64);

            // --- Choose a random move ---
            let day = rng.random_range(0..current_state.num_sessions as usize);

            // Decide whether to attempt a clique swap or regular swap
            let clique_swap_probability = current_state.calculate_clique_swap_probability();
            let should_attempt_clique_swap = rng.random::<f64>() < clique_swap_probability;

            if should_attempt_clique_swap && !current_state.cliques.is_empty() {
                // --- Attempt Clique Swap ---
                let clique_idx = rng.random_range(0..current_state.cliques.len());
                let clique = &current_state.cliques[clique_idx];

                // Find which group the clique is currently in
                let current_group = current_state.locations[day][clique[0]].0;

                // Find a different group to swap with
                let num_groups = current_state.group_idx_to_id.len();
                let possible_target_groups: Vec<usize> = (0..num_groups)
                    .filter(|&g| g != current_group)
                    .filter(|&g| {
                        current_state.is_clique_swap_feasible(day, clique_idx, current_group, g)
                    })
                    .collect();

                if !possible_target_groups.is_empty() {
                    let target_group =
                        possible_target_groups[rng.random_range(0..possible_target_groups.len())];
                    let mut non_clique_people =
                        current_state.find_non_clique_movable_people(day, target_group);

                    if non_clique_people.len() >= clique.len() {
                        // Randomly select exactly clique.len() people to swap
                        non_clique_people.shuffle(&mut rng);
                        let target_people: Vec<usize> =
                            non_clique_people.into_iter().take(clique.len()).collect();

                        // Calculate delta cost for clique swap
                        let delta_cost = current_state.calculate_clique_swap_cost_delta(
                            day,
                            clique_idx,
                            current_group,
                            target_group,
                            &target_people,
                        );

                        let current_cost = current_state.calculate_cost();
                        let next_cost = current_cost + delta_cost;

                        // Accept or reject the clique swap
                        if delta_cost < 0.0
                            || rng.random::<f64>() < (-delta_cost / temperature).exp()
                        {
                            current_state.apply_clique_swap(
                                day,
                                clique_idx,
                                current_group,
                                target_group,
                                &target_people,
                            );

                            if next_cost < best_cost {
                                best_cost = next_cost;
                                best_state = current_state.clone();
                                no_improvement_counter = 0;
                            }
                        }
                    }
                }
            } else {
                // --- Regular Single Person Swap ---
                let swappable_people: Vec<usize> = (0..current_state.person_idx_to_id.len())
                    .filter(|&p_idx| !current_state.immovable_people.contains_key(&(p_idx, day)))
                    .filter(|&p_idx| current_state.person_to_clique_id[p_idx].is_none())
                    .collect();

                if swappable_people.len() < 2 {
                    continue;
                }

                // Pick two non-clique, non-immovable people for a swap
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
                    if state.logging.log_stop_condition {
                        println!(
                            "Stopping early: no improvement for {no_improvement_limit} iterations."
                        );
                    }
                    break;
                }
            }

            if let Some(time_limit) = self.time_limit_seconds {
                if start_time.elapsed().as_secs() >= time_limit {
                    if state.logging.log_stop_condition {
                        println!("Stopping early: time limit of {time_limit} seconds reached.");
                    }
                    break;
                }
            }
        }

        let final_cost = best_state.calculate_cost();
        let elapsed = start_time.elapsed().as_secs_f64();

        if state.logging.log_duration_and_score {
            println!("Solver finished in {elapsed:.2} seconds. Final score: {final_cost:.2}");
        }

        if state.logging.log_final_score_breakdown {
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
