//! Data models and types for the solver-core API.
//!
//! This module contains all the public data structures used to define optimization
//! problems, configure the solver, and receive results. The API is designed to be
//! serializable (JSON/YAML) for easy integration with web services and configuration files.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Complete input specification for the optimization solver.
///
/// This is the root structure that contains all information needed to run
/// an optimization: the problem definition (people, groups, sessions),
/// optimization objectives, constraints to satisfy, and solver configuration.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::*;
/// use std::collections::HashMap;
///
/// let input = ApiInput {
///     problem: ProblemDefinition {
///         people: vec![
///             Person {
///                 id: "Alice".to_string(),
///                 attributes: HashMap::new(),
///                 sessions: None,
///             }
///         ],
///         groups: vec![
///             Group { id: "Team1".to_string(), size: 4 }
///         ],
///         num_sessions: 3,
///     },
///     objectives: vec![
///         Objective {
///             r#type: "maximize_unique_contacts".to_string(),
///             weight: 1.0,
///         }
///     ],
///     constraints: vec![],
///     solver: SolverConfiguration {
///         solver_type: "SimulatedAnnealing".to_string(),
///         stop_conditions: StopConditions {
///             max_iterations: Some(10_000),
///             time_limit_seconds: None,
///             no_improvement_iterations: None,
///         },
///         solver_params: SolverParams::SimulatedAnnealing(
///             SimulatedAnnealingParams {
///                 initial_temperature: 100.0,
///                 final_temperature: 0.1,
///                 cooling_schedule: "geometric".to_string(),
///             }
///         ),
///         logging: LoggingOptions::default(),
///     },
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApiInput {
    /// The core problem definition: people, groups, and sessions
    pub problem: ProblemDefinition,
    /// Optimization objectives (defaults to empty list if not specified)
    #[serde(default)]
    pub objectives: Vec<Objective>,
    /// Constraints that must be satisfied or penalized (defaults to empty list)
    #[serde(default)]
    pub constraints: Vec<Constraint>,
    /// Solver algorithm configuration and parameters
    pub solver: SolverConfiguration,
}

/// Defines the core optimization problem: people, groups, and sessions.
///
/// This structure specifies the fundamental elements that need to be scheduled:
/// the list of people to be assigned, the groups they can be assigned to,
/// and how many scheduling sessions will occur.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProblemDefinition {
    /// List of all people to be scheduled into groups
    pub people: Vec<Person>,
    /// List of all available groups with their capacity limits
    pub groups: Vec<Group>,
    /// Total number of scheduling sessions (time periods)
    pub num_sessions: u32,
}

/// Represents a person who can be scheduled into groups.
///
/// Each person has a unique identifier, optional attributes for constraint
/// handling (e.g., gender, department), and can optionally specify which
/// sessions they will participate in.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::Person;
/// use std::collections::HashMap;
///
/// // Person participating in all sessions
/// let alice = Person {
///     id: "Alice".to_string(),
///     attributes: {
///         let mut attrs = HashMap::new();
///         attrs.insert("gender".to_string(), "female".to_string());
///         attrs.insert("department".to_string(), "engineering".to_string());
///         attrs
///     },
///     sessions: None, // Participates in all sessions
/// };
///
/// // Person with limited participation (late arrival/early departure)
/// let bob = Person {
///     id: "Bob".to_string(),
///     attributes: HashMap::new(),
///     sessions: Some(vec![1, 2]), // Only participates in sessions 1 and 2
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Person {
    /// Unique identifier for this person (must be unique across all people)
    pub id: String,
    /// Key-value attributes used for constraint evaluation (e.g., "gender" -> "female")
    pub attributes: HashMap<String, String>,
    /// Optional list of session indices this person participates in.
    /// If `None`, the person participates in all sessions.
    /// Session indices are 0-based (first session is 0).
    #[serde(default)]
    pub sessions: Option<Vec<u32>>,
}

/// Represents a group that people can be assigned to.
///
/// Each group has a unique identifier and a fixed capacity that limits
/// how many people can be assigned to it in any single session.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::Group;
///
/// let team = Group {
///     id: "Development Team".to_string(),
///     size: 6, // Can hold up to 6 people
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Group {
    /// Unique identifier for this group (must be unique across all groups)
    pub id: String,
    /// Maximum number of people that can be assigned to this group in any session
    pub size: u32,
}

/// Defines an optimization objective with its weight.
///
/// Objectives specify what the solver should optimize for. Multiple objectives
/// can be specified with different weights to create a multi-objective optimization.
///
/// # Supported Objective Types
///
/// - `"maximize_unique_contacts"`: Maximize the number of unique person-to-person interactions
///
/// # Example
///
/// ```no_run
/// use solver_core::models::Objective;
///
/// let objective = Objective {
///     r#type: "maximize_unique_contacts".to_string(),
///     weight: 1.0,
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Objective {
    /// The type of objective to optimize for
    pub r#type: String, // "maximize_unique_contacts"
    /// Weight of this objective in the overall optimization function
    pub weight: f64,
}

/// Represents a constraint that must be satisfied or penalized during optimization.
///
/// Constraints define rules that the scheduler should follow. They can be either
/// hard constraints (with very high penalty weights) or soft constraints (with
/// lower penalty weights that represent preferences).
///
/// All constraints support optional session-specific application, meaning they
/// can be applied to all sessions or only to specific sessions.
///
/// # Constraint Types
///
/// - **RepeatEncounter**: Limits how often people can be paired together
/// - **AttributeBalance**: Maintains desired attribute distributions within groups
/// - **ImmovablePerson**: Fixes specific people to specific groups in specific sessions
/// - **MustStayTogether**: Keeps certain people in the same group
/// - **CannotBeTogether**: Prevents certain people from being in the same group
///
/// # Examples
///
/// ```no_run
/// use solver_core::models::*;
/// use std::collections::HashMap;
///
/// // Limit repeat encounters
/// let repeat_constraint = Constraint::RepeatEncounter(RepeatEncounterParams {
///     max_allowed_encounters: 1,
///     penalty_function: "squared".to_string(),
///     penalty_weight: 100.0,
/// });
///
/// // Maintain gender balance in a specific group
/// let balance_constraint = Constraint::AttributeBalance(AttributeBalanceParams {
///     group_id: "Team1".to_string(),
///     attribute_key: "gender".to_string(),
///     desired_values: {
///         let mut values = HashMap::new();
///         values.insert("male".to_string(), 2);
///         values.insert("female".to_string(), 2);
///         values
///     },
///     penalty_weight: 50.0,
/// });
///
/// // Keep two people together (only in sessions 0 and 1)
/// let together_constraint = Constraint::MustStayTogether {
///     people: vec!["Alice".to_string(), "Bob".to_string()],
///     penalty_weight: 1000.0,
///     sessions: Some(vec![0, 1]),
/// };
///
/// // Prevent two people from being together
/// let apart_constraint = Constraint::CannotBeTogether {
///     people: vec!["Charlie".to_string(), "Diana".to_string()],
///     penalty_weight: 500.0,
///     sessions: None, // Applies to all sessions
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum Constraint {
    /// Limits how often people can encounter each other across sessions
    RepeatEncounter(RepeatEncounterParams),
    /// Maintains desired attribute distributions within specific groups
    AttributeBalance(AttributeBalanceParams),
    /// Fixes specific people to specific groups in specific sessions
    ImmovablePerson(ImmovablePersonParams),
    /// Keeps specified people in the same group
    MustStayTogether {
        /// List of person IDs that must stay together
        people: Vec<String>,
        /// Penalty weight for violations (higher = more important)
        #[serde(default = "default_constraint_weight")]
        penalty_weight: f64,
        /// Optional list of session indices where this constraint applies.
        /// If `None`, applies to all sessions.
        #[serde(default)]
        sessions: Option<Vec<u32>>,
    },
    /// Prevents specified people from being in the same group
    CannotBeTogether {
        /// List of person IDs that cannot be together
        people: Vec<String>,
        /// Penalty weight for violations (higher = more important)
        #[serde(default = "default_constraint_weight")]
        penalty_weight: f64,
        /// Optional list of session indices where this constraint applies.
        /// If `None`, applies to all sessions.
        #[serde(default)]
        sessions: Option<Vec<u32>>,
    },
}

/// Default penalty weight for constraints that don't specify one
fn default_constraint_weight() -> f64 {
    1000.0
}

/// Parameters for the RepeatEncounter constraint.
///
/// This constraint limits how often people can be paired together across sessions,
/// promoting social diversity by ensuring people meet new individuals rather than
/// always being grouped with the same people.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::RepeatEncounterParams;
///
/// // Allow at most 1 encounter, with squared penalty for violations
/// let params = RepeatEncounterParams {
///     max_allowed_encounters: 1,
///     penalty_function: "squared".to_string(),
///     penalty_weight: 100.0,
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RepeatEncounterParams {
    /// Maximum number of times two people can be in the same group
    pub max_allowed_encounters: u32,
    /// Penalty function type: "squared" for quadratic penalties, "linear" for linear penalties
    pub penalty_function: String, // "squared" or "linear"
    /// Weight of the penalty applied for constraint violations
    pub penalty_weight: f64,
}

/// Parameters for the AttributeBalance constraint.
///
/// This constraint maintains desired distributions of person attributes within
/// specific groups. For example, it can ensure gender balance or department
/// representation within teams.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::AttributeBalanceParams;
/// use std::collections::HashMap;
///
/// // Maintain 2 males and 2 females in "Team1"
/// let params = AttributeBalanceParams {
///     group_id: "Team1".to_string(),
///     attribute_key: "gender".to_string(),
///     desired_values: {
///         let mut values = HashMap::new();
///         values.insert("male".to_string(), 2);
///         values.insert("female".to_string(), 2);
///         values
///     },
///     penalty_weight: 50.0,
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AttributeBalanceParams {
    /// ID of the group where this balance constraint applies
    pub group_id: String,
    /// The attribute key to balance (e.g., "gender", "department")
    pub attribute_key: String,
    /// Desired count for each attribute value (e.g., {"male": 2, "female": 2})
    pub desired_values: HashMap<String, u32>,
    /// Weight of the penalty applied for balance violations
    pub penalty_weight: f64,
}

/// Parameters for the ImmovablePerson constraint.
///
/// This constraint fixes specific people to specific groups in specific sessions,
/// ensuring they cannot be moved during optimization. Useful for people with
/// special roles or requirements.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::ImmovablePersonParams;
///
/// // Fix "TeamLeader" to "Team1" for all sessions
/// let params = ImmovablePersonParams {
///     person_id: "TeamLeader".to_string(),
///     group_id: "Team1".to_string(),
///     sessions: vec![0, 1, 2], // Sessions 0, 1, and 2
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ImmovablePersonParams {
    /// ID of the person who must be fixed in place
    pub person_id: String,
    /// ID of the group where this person must be placed
    pub group_id: String,
    /// List of session indices where this person must be in the specified group
    pub sessions: Vec<u32>,
}

/// Complete configuration for the optimization solver.
///
/// This structure specifies which algorithm to use, when to stop optimization,
/// algorithm-specific parameters, and logging preferences.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::*;
///
/// let config = SolverConfiguration {
///     solver_type: "SimulatedAnnealing".to_string(),
///     stop_conditions: StopConditions {
///         max_iterations: Some(50_000),
///         time_limit_seconds: Some(60),
///         no_improvement_iterations: Some(5_000),
///     },
///     solver_params: SolverParams::SimulatedAnnealing(
///         SimulatedAnnealingParams {
///             initial_temperature: 100.0,
///             final_temperature: 0.1,
///             cooling_schedule: "geometric".to_string(),
///         }
///     ),
///     logging: LoggingOptions {
///         log_frequency: Some(1000),
///         display_final_schedule: true,
///         log_final_score_breakdown: true,
///         ..Default::default()
///     },
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolverConfiguration {
    /// Type of solver algorithm to use (currently "SimulatedAnnealing")
    pub solver_type: String,
    /// Conditions that determine when to stop optimization
    pub stop_conditions: StopConditions,
    /// Algorithm-specific parameters
    pub solver_params: SolverParams,
    /// Logging and output preferences (defaults to minimal logging)
    #[serde(default)]
    pub logging: LoggingOptions,
}

/// Defines when the optimization process should stop.
///
/// Multiple stop conditions can be specified, and the solver will stop when
/// the first condition is met. This allows for flexible control over optimization
/// duration vs. quality trade-offs.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::StopConditions;
///
/// // Stop after 10,000 iterations OR 30 seconds OR 1,000 iterations without improvement
/// let conditions = StopConditions {
///     max_iterations: Some(10_000),
///     time_limit_seconds: Some(30),
///     no_improvement_iterations: Some(1_000),
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StopConditions {
    /// Maximum number of optimization iterations before stopping
    pub max_iterations: Option<u64>,
    /// Maximum time in seconds before stopping
    pub time_limit_seconds: Option<u64>,
    /// Stop if no improvement found for this many iterations
    pub no_improvement_iterations: Option<u64>,
}

/// Algorithm-specific parameters for different solver types.
///
/// This enum allows different algorithms to have their own parameter structures
/// while maintaining a unified API.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "solver_type")]
pub enum SolverParams {
    /// Parameters for the Simulated Annealing algorithm
    SimulatedAnnealing(SimulatedAnnealingParams),
}

/// Parameters specific to the Simulated Annealing algorithm.
///
/// Simulated Annealing uses a temperature-based approach where the algorithm
/// starts with high randomness (high temperature) and gradually becomes more
/// selective (lower temperature) as it progresses.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::SimulatedAnnealingParams;
///
/// // Standard configuration with geometric cooling
/// let params = SimulatedAnnealingParams {
///     initial_temperature: 100.0,   // Start with high exploration
///     final_temperature: 0.1,       // End with focused local search
///     cooling_schedule: "geometric".to_string(), // Exponential temperature decay
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SimulatedAnnealingParams {
    /// Starting temperature (higher values allow more random moves initially)
    pub initial_temperature: f64,
    /// Ending temperature (lower values focus on local improvements)
    pub final_temperature: f64,
    /// Temperature reduction schedule: "geometric" for exponential decay, "linear" for linear decay
    pub cooling_schedule: String, // "geometric", "linear", etc
}

/// Configuration options for logging and output during optimization.
///
/// These options control what information is displayed during and after
/// the optimization process. Useful for debugging, monitoring progress,
/// and understanding the solver's behavior.
///
/// # Example
///
/// ```no_run
/// use solver_core::models::LoggingOptions;
///
/// // Comprehensive logging for debugging
/// let logging = LoggingOptions {
///     log_frequency: Some(1000),           // Log every 1000 iterations
///     log_initial_state: true,             // Show starting configuration
///     log_duration_and_score: true,        // Show final timing and score
///     display_final_schedule: true,        // Show the final schedule
///     log_initial_score_breakdown: true,   // Detailed initial scoring
///     log_final_score_breakdown: true,     // Detailed final scoring
///     log_stop_condition: true,            // Show why optimization stopped
/// };
///
/// // Minimal logging for production
/// let minimal_logging = LoggingOptions {
///     display_final_schedule: true,
///     log_final_score_breakdown: true,
///     ..Default::default()
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct LoggingOptions {
    /// How often to log progress (every N iterations). `None` disables progress logging.
    #[serde(default)]
    pub log_frequency: Option<u64>,
    /// Whether to log the initial state and configuration
    #[serde(default)]
    pub log_initial_state: bool,
    /// Whether to log the total optimization time and final score
    #[serde(default)]
    pub log_duration_and_score: bool,
    /// Whether to display the final schedule in a human-readable format
    #[serde(default)]
    pub display_final_schedule: bool,
    /// Whether to log a detailed breakdown of the initial score
    #[serde(default)]
    pub log_initial_score_breakdown: bool,
    /// Whether to log a detailed breakdown of the final score
    #[serde(default)]
    pub log_final_score_breakdown: bool,
    /// Whether to log the reason why optimization stopped
    #[serde(default)]
    pub log_stop_condition: bool,
}

/// Progress update information sent during solver execution.
///
/// This structure contains real-time information about the solver's progress
/// that can be used to update progress bars, charts, and other UI elements
/// while the optimization is running.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProgressUpdate {
    /// Current iteration number (0-based)
    pub iteration: u64,
    /// Total number of iterations planned
    pub max_iterations: u64,
    /// Current temperature (for simulated annealing)
    pub temperature: f64,
    /// Current solution cost/score
    pub current_score: f64,
    /// Best solution cost/score found so far
    pub best_score: f64,
    /// Number of unique contacts in current solution
    pub current_contacts: i32,
    /// Number of unique contacts in best solution
    pub best_contacts: i32,
    /// Current repetition penalty
    pub repetition_penalty: i32,
    /// Time elapsed since solver started (in seconds)
    pub elapsed_seconds: f64,
    /// Number of iterations without improvement
    pub no_improvement_count: u64,
}

/// Callback function type for receiving progress updates during solver execution.
///
/// The solver will call this function periodically during optimization to report
/// progress. The callback should return `true` to continue solving or `false`
/// to request early termination.
///
/// Callback function type for receiving progress updates during solver execution.
///
/// The solver will call this function periodically during optimization to report
/// progress. The callback should return `true` to continue solving or `false`
/// to request early termination.
pub type ProgressCallback = Box<dyn Fn(&ProgressUpdate) -> bool + Send>;

/// The result returned by the optimization solver.
///
/// Contains the optimized schedule along with detailed scoring information
/// that shows how well the solution satisfies the objectives and constraints.
/// The schedule format uses nested HashMaps for easy programmatic access.
///
/// # Schedule Format
///
/// The schedule is structured as:
/// ```text
/// schedule["session_0"]["Group1"] = ["Alice", "Bob", "Charlie"]
/// schedule["session_0"]["Group2"] = ["Diana", "Eve", "Frank"]
/// schedule["session_1"]["Group1"] = ["Alice", "Diana", "Grace"]
/// ...
/// ```
///
/// # Example
///
/// ```no_run
/// use solver_core::{run_solver, models::*};
/// use std::collections::HashMap;
///
/// // ... create input configuration ...
/// # let input = ApiInput {
/// #     problem: ProblemDefinition {
/// #         people: vec![],
/// #         groups: vec![],
/// #         num_sessions: 1,
/// #     },
/// #     objectives: vec![],
/// #     constraints: vec![],
/// #     solver: SolverConfiguration {
/// #         solver_type: "SimulatedAnnealing".to_string(),
/// #         stop_conditions: StopConditions {
/// #             max_iterations: Some(1000),
/// #             time_limit_seconds: None,
/// #             no_improvement_iterations: None,
/// #         },
/// #         solver_params: SolverParams::SimulatedAnnealing(
/// #             SimulatedAnnealingParams {
/// #                 initial_temperature: 10.0,
/// #                 final_temperature: 0.1,
/// #                 cooling_schedule: "geometric".to_string(),
/// #             }
/// #         ),
/// #         logging: LoggingOptions::default(),
/// #     },
/// # };
///
/// match run_solver(&input) {
///     Ok(result) => {
///         println!("Final score: {}", result.final_score);
///         println!("Unique contacts: {}", result.unique_contacts);
///         println!("Repetition penalty: {}", result.repetition_penalty);
///         
///         // Display the schedule
///         println!("Schedule:\n{}", result.display());
///         
///         // Access specific assignments programmatically
///         if let Some(session_0) = result.schedule.get("session_0") {
///             if let Some(group_1) = session_0.get("Group1") {
///                 println!("Group1 in session 0: {:?}", group_1);
///             }
///         }
///     }
///     Err(e) => eprintln!("Error: {:?}", e),
/// }
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolverResult {
    /// Overall optimization score (higher is better)
    pub final_score: f64,
    /// The optimized schedule: `schedule[session][group] = [people]`
    pub schedule: std::collections::HashMap<String, std::collections::HashMap<String, Vec<String>>>,
    /// Number of unique person-to-person contacts achieved
    pub unique_contacts: i32,
    /// Penalty points for exceeding repeat encounter limits
    pub repetition_penalty: i32,
    /// Penalty points for attribute balance violations
    pub attribute_balance_penalty: i32,
    /// Total penalty points for constraint violations
    pub constraint_penalty: i32,
}

impl SolverResult {
    /// Formats the schedule as a human-readable string.
    ///
    /// This method converts the nested HashMap schedule structure into a
    /// nicely formatted string that shows the group assignments for each session.
    /// Sessions and groups are sorted for consistent output.
    ///
    /// # Example Output
    ///
    /// ```text
    /// ========== SESSION_0 ==========
    /// Group1: Alice, Bob, Charlie
    /// Group2: Diana, Eve, Frank
    ///
    /// ========== SESSION_1 ==========
    /// Group1: Alice, Diana, Grace
    /// Group2: Bob, Eve, Henry
    ///
    /// ```
    ///
    /// # Returns
    ///
    /// A formatted string showing all group assignments across all sessions.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use solver_core::{run_solver, models::*};
    /// # use std::collections::HashMap;
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
    /// match run_solver(&input) {
    ///     Ok(result) => {
    ///         // Print the formatted schedule
    ///         println!("{}", result.display());
    ///     }
    ///     Err(e) => eprintln!("Error: {:?}", e),
    /// }
    /// ```
    pub fn display(&self) -> String {
        let mut output = String::new();

        let mut sorted_sessions: Vec<_> = self.schedule.keys().collect();
        sorted_sessions.sort_by_key(|a| {
            a.split('_')
                .next_back()
                .unwrap_or("0")
                .parse::<usize>()
                .unwrap_or(0)
        });

        for session_key in sorted_sessions {
            output.push_str(&format!(
                "========== {} ==========\n",
                session_key.to_uppercase()
            ));
            if let Some(groups) = self.schedule.get(session_key) {
                let mut sorted_groups: Vec<_> = groups.keys().collect();
                sorted_groups.sort();

                for group_key in sorted_groups {
                    if let Some(people) = groups.get(group_key) {
                        let people_list = people.join(", ");
                        output.push_str(&format!("{group_key}: {people_list}\n"));
                    }
                }
            }
            output.push('\n');
        }
        output
    }
}
