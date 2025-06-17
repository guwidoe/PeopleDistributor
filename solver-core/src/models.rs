use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApiInput {
    #[serde(flatten)]
    pub problem: ProblemDefinition,
    pub objectives: Vec<Objective>,
    pub constraints: Vec<Constraint>,
    #[serde(flatten)]
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
    pub session: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolverConfiguration {
    pub solver_type: String,
    pub stop_conditions: StopConditions,
    #[serde(flatten)]
    pub solver_params: Option<SolverParams>,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolverResult {
    pub final_score: f64,
    pub schedule: std::collections::HashMap<String, std::collections::HashMap<String, Vec<String>>>,
}
