use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApiInput {
    pub problem: ProblemDefinition,
    #[serde(default)]
    pub objectives: Vec<Objective>,
    #[serde(default)]
    pub constraints: Vec<Constraint>,
    pub solver: SolverConfiguration,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProblemDefinition {
    pub people: Vec<Person>,
    pub groups: Vec<Group>,
    pub num_sessions: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Person {
    pub id: String,
    pub attributes: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Group {
    pub id: String,
    pub size: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Objective {
    pub r#type: String, // "maximize_unique_contacts"
    pub weight: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum Constraint {
    RepeatEncounter(RepeatEncounterParams),
    AttributeBalance(AttributeBalanceParams),
    ImmovablePerson(ImmovablePersonParams),
    MustStayTogether {
        people: Vec<String>,
        #[serde(default = "default_constraint_weight")]
        penalty_weight: f64,
        #[serde(default)]
        sessions: Option<Vec<u32>>,
    },
    CannotBeTogether {
        people: Vec<String>,
        #[serde(default = "default_constraint_weight")]
        penalty_weight: f64,
        #[serde(default)]
        sessions: Option<Vec<u32>>,
    },
}

fn default_constraint_weight() -> f64 {
    1000.0
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RepeatEncounterParams {
    pub max_allowed_encounters: u32,
    pub penalty_function: String, // "squared" or "linear"
    pub penalty_weight: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AttributeBalanceParams {
    pub group_id: String,
    pub attribute_key: String,
    pub desired_values: HashMap<String, u32>,
    pub penalty_weight: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ImmovablePersonParams {
    pub person_id: String,
    pub group_id: String,
    pub sessions: Vec<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolverConfiguration {
    pub solver_type: String,
    pub stop_conditions: StopConditions,
    pub solver_params: SolverParams,
    #[serde(default)]
    pub logging: LoggingOptions,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StopConditions {
    pub max_iterations: Option<u64>,
    pub time_limit_seconds: Option<u64>,
    pub no_improvement_iterations: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "solver_type")]
pub enum SolverParams {
    SimulatedAnnealing(SimulatedAnnealingParams),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SimulatedAnnealingParams {
    pub initial_temperature: f64,
    pub final_temperature: f64,
    pub cooling_schedule: String, // "geometric", "linear", etc
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct LoggingOptions {
    #[serde(default)]
    pub log_frequency: Option<u64>,
    #[serde(default)]
    pub log_initial_state: bool,
    #[serde(default)]
    pub log_duration_and_score: bool,
    #[serde(default)]
    pub display_final_schedule: bool,
    #[serde(default)]
    pub log_initial_score_breakdown: bool,
    #[serde(default)]
    pub log_final_score_breakdown: bool,
    #[serde(default)]
    pub log_stop_condition: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolverResult {
    pub final_score: f64,
    pub schedule: std::collections::HashMap<String, std::collections::HashMap<String, Vec<String>>>,
    pub unique_contacts: i32,
    pub repetition_penalty: i32,
    pub attribute_balance_penalty: i32,
    pub constraint_penalty: i32,
}

impl SolverResult {
    pub fn display(&self) -> String {
        let mut output = String::new();

        let mut sorted_sessions: Vec<_> = self.schedule.keys().collect();
        sorted_sessions.sort_by_key(|a| {
            a.split('_')
                .last()
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
                        output.push_str(&format!("{}: {}\n", group_key, people_list));
                    }
                }
            }
            output.push('\n');
        }
        output
    }
}
