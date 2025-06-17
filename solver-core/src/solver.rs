use crate::models::{
    ApiInput, AttributeBalanceParams, Constraint, Group, Person, ProblemDefinition,
    SimulatedAnnealingParams, SolverResult, StopConditions,
};
use rand::seq::SliceRandom;
use rand::Rng;
use std::collections::HashMap;

/// The internal state of the solver, designed for performance.
/// It translates string IDs from the API input into integer indices
/// for fast lookups and array operations during optimization.
#[derive(Debug, Clone)]
pub struct State {
    // --- Mappings ---
    pub person_id_to_idx: HashMap<String, usize>,
    pub person_idx_to_id: Vec<String>,
    pub group_id_to_idx: HashMap<String, usize>,
    pub group_idx_to_id: Vec<String>,
    // Attribute key ("gender") -> internal index (0)
    pub attr_key_to_idx: HashMap<String, usize>,
    // For each attribute, Value String ("male") -> value index (0)
    pub attr_val_to_idx: Vec<HashMap<String, usize>>,
    // For each attribute, value index (0) -> Value String ("male")
    pub attr_idx_to_val: Vec<Vec<String>>,

    // --- Core Data Structures ---
    // The main schedule: [day][group_idx] -> Vec<person_idx>
    pub schedule: Vec<Vec<Vec<usize>>>,
    // Fast lookup for a person's location: [day][person_idx] -> (group_idx, vec_idx)
    pub locations: Vec<Vec<(usize, usize)>>,

    // --- Problem Definition (integer-based) ---
    // [person_idx][attr_idx] -> value_idx for that attribute
    pub person_attributes: Vec<Vec<usize>>,
    pub attribute_balance_constraints: Vec<AttributeBalanceParams>,
    pub num_sessions: u32,

    // --- Scoring Data ---
    pub contact_matrix: Vec<Vec<u32>>,
    pub unique_contacts: i32,
    pub repetition_penalty: i32,
    pub gender_balance_penalty: i32,

    // --- Weights ---
    pub w_contacts: f64,
    pub w_repetition: f64,
    pub w_gender: f64,
}

impl State {
    pub fn new(input: &ApiInput) -> Self {
        let people_count = input.problem.people.len();
        let group_count = input.problem.groups.len();

        let person_id_to_idx: HashMap<String, usize> = input
            .problem
            .people
            .iter()
            .enumerate()
            .map(|(idx, p)| (p.id.clone(), idx))
            .collect();

        let person_idx_to_id: Vec<String> =
            input.problem.people.iter().map(|p| p.id.clone()).collect();

        let group_id_to_idx: HashMap<String, usize> = input
            .problem
            .groups
            .iter()
            .enumerate()
            .map(|(idx, g)| (g.id.clone(), idx))
            .collect();

        let group_idx_to_id: Vec<String> =
            input.problem.groups.iter().map(|g| g.id.clone()).collect();

        // --- Build Attribute Mappings ---
        let mut attr_key_to_idx = HashMap::new();
        let mut attr_val_to_idx: Vec<HashMap<String, usize>> = Vec::new();
        let mut attr_idx_to_val: Vec<Vec<String>> = Vec::new();

        let all_constraints = &input.constraints;
        for constraint in all_constraints {
            if let Constraint::AttributeBalance(params) = constraint {
                if !attr_key_to_idx.contains_key(&params.attribute_key) {
                    let attr_idx = attr_key_to_idx.len();
                    attr_key_to_idx.insert(params.attribute_key.clone(), attr_idx);
                    attr_val_to_idx.push(HashMap::new());
                    attr_idx_to_val.push(Vec::new());
                }
            }
        }
        for person in &input.problem.people {
            for (key, val) in &person.attributes {
                if let Some(&attr_idx) = attr_key_to_idx.get(key) {
                    let val_map = &mut attr_val_to_idx[attr_idx];
                    if !val_map.contains_key(val) {
                        let val_idx = val_map.len();
                        val_map.insert(val.clone(), val_idx);
                        attr_idx_to_val[attr_idx].push(val.clone());
                    }
                }
            }
        }

        // --- Convert Person Attributes to Integer-based format ---
        let mut person_attributes = vec![vec![usize::MAX; attr_key_to_idx.len()]; people_count];
        for (p_idx, person) in input.problem.people.iter().enumerate() {
            for (key, val) in &person.attributes {
                if let Some(&attr_idx) = attr_key_to_idx.get(key) {
                    if let Some(&val_idx) = attr_val_to_idx[attr_idx].get(val) {
                        person_attributes[p_idx][attr_idx] = val_idx;
                    }
                }
            }
        }

        let attribute_balance_constraints = input
            .constraints
            .iter()
            .filter_map(|c| match c {
                Constraint::AttributeBalance(params) => Some(params.clone()),
                _ => None,
            })
            .collect();

        // --- Extract weights from objectives and constraints ---
        let mut w_contacts = 0.0;
        if let Some(objective) = input
            .objectives
            .iter()
            .find(|o| o.r#type == "maximize_unique_contacts")
        {
            w_contacts = objective.weight;
        }

        let mut w_repetition = 0.0;
        let mut w_gender = 0.0;
        for constraint in &input.constraints {
            match constraint {
                Constraint::RepeatEncounter(params) => w_repetition = params.penalty_weight,
                Constraint::AttributeBalance(params) => w_gender = params.penalty_weight,
                // We assume one gender balance constraint for the weight, but the logic can handle multiple
                _ => (),
            }
        }

        let mut schedule = vec![vec![vec![]; group_count]; input.problem.num_sessions as usize];
        let mut locations = vec![vec![(0, 0); people_count]; input.problem.num_sessions as usize];

        // --- Initialize with a random assignment ---
        let mut person_indices: Vec<usize> = (0..people_count).collect();
        let mut rng = rand::thread_rng();

        for (day_idx, day_schedule) in schedule.iter_mut().enumerate() {
            person_indices.shuffle(&mut rng);
            let mut person_cursor = 0;
            'group_loop: for (group_idx, group_vec) in day_schedule.iter_mut().enumerate() {
                let group_size = input.problem.groups[group_idx].size as usize;
                for i in 0..group_size {
                    if person_cursor >= people_count {
                        break 'group_loop; // All people have been assigned
                    }
                    let person_idx = person_indices[person_cursor];
                    group_vec.push(person_idx);
                    locations[day_idx][person_idx] = (group_idx, i);
                    person_cursor += 1;
                }
            }
        }

        let mut state = Self {
            person_id_to_idx,
            person_idx_to_id,
            group_id_to_idx,
            group_idx_to_id,
            attr_key_to_idx,
            attr_val_to_idx,
            attr_idx_to_val,
            schedule,
            locations,
            person_attributes,
            attribute_balance_constraints,
            num_sessions: input.problem.num_sessions,
            contact_matrix: vec![vec![0; people_count]; people_count],
            unique_contacts: 0,
            repetition_penalty: 0,
            gender_balance_penalty: 0,
            w_contacts,
            w_repetition,
            w_gender,
        };

        state.recalculate_scores();
        state
    }

    pub fn recalculate_locations_from_schedule(&mut self) {
        for (day_idx, day_schedule) in self.schedule.iter().enumerate() {
            for (group_idx, group_vec) in day_schedule.iter().enumerate() {
                for (vec_idx, &person_idx) in group_vec.iter().enumerate() {
                    self.locations[day_idx][person_idx] = (group_idx, vec_idx);
                }
            }
        }
    }

    pub fn recalculate_scores(&mut self) {
        self.unique_contacts = 0;
        self.repetition_penalty = 0;
        self.gender_balance_penalty = 0;

        for row in self.contact_matrix.iter_mut() {
            for val in row.iter_mut() {
                *val = 0;
            }
        }

        for day_schedule in &self.schedule {
            for group in day_schedule {
                for p1_idx in 0..group.len() {
                    for p2_idx in (p1_idx + 1)..group.len() {
                        let p1 = group[p1_idx];
                        let p2 = group[p2_idx];
                        self.contact_matrix[p1][p2] += 1;
                        self.contact_matrix[p2][p1] += 1;
                    }
                }
            }
        }

        for i in 0..self.contact_matrix.len() {
            for j in (i + 1)..self.contact_matrix[i].len() {
                if self.contact_matrix[i][j] > 0 {
                    self.unique_contacts += 1;
                }
                if self.contact_matrix[i][j] > 1 {
                    self.repetition_penalty += (self.contact_matrix[i][j] - 1).pow(2) as i32;
                }
            }
        }

        // --- Gender Balance Penalty ---
        if self.attribute_balance_constraints.is_empty() {
            return;
        }

        for day_schedule in &self.schedule {
            for (group_idx, group_people) in day_schedule.iter().enumerate() {
                let group_id = &self.group_idx_to_id[group_idx];

                for constraint in &self.attribute_balance_constraints {
                    if &constraint.group_id != group_id && constraint.group_id != "ALL" {
                        continue;
                    }

                    if let Some(&attr_idx) = self.attr_key_to_idx.get(&constraint.attribute_key) {
                        let num_values = self.attr_idx_to_val[attr_idx].len();
                        let mut value_counts = vec![0; num_values];
                        for person_idx in group_people {
                            let val_idx = self.person_attributes[*person_idx][attr_idx];
                            if val_idx != usize::MAX {
                                value_counts[val_idx] += 1;
                            }
                        }

                        for (desired_val_str, desired_count) in &constraint.desired_values {
                            if let Some(&val_idx) =
                                self.attr_val_to_idx[attr_idx].get(desired_val_str)
                            {
                                let actual_count = value_counts[val_idx];
                                let diff = (actual_count as i32 - *desired_count as i32).abs();
                                self.gender_balance_penalty += diff.pow(2) as i32;
                            }
                        }
                    }
                }
            }
        }
    }

    fn _calculate_one_group_gender_penalty(&self, group_people: &[usize]) -> i32 {
        if self.attribute_balance_constraints.is_empty() {
            return 0;
        }
        let mut penalty = 0;
        if let Some(constraint) = self.attribute_balance_constraints.first() {
            if let Some(&attr_idx) = self.attr_key_to_idx.get(&constraint.attribute_key) {
                let num_values = self.attr_idx_to_val[attr_idx].len();
                let mut value_counts = vec![0; num_values];
                for person_idx in group_people {
                    let val_idx = self.person_attributes[*person_idx][attr_idx];
                    if val_idx != usize::MAX {
                        value_counts[val_idx] += 1;
                    }
                }
                for (desired_val_str, desired_count) in &constraint.desired_values {
                    if let Some(&val_idx) = self.attr_val_to_idx[attr_idx].get(desired_val_str) {
                        let actual_count = value_counts[val_idx];
                        let diff = (actual_count as i32 - *desired_count as i32).abs();
                        penalty += diff.pow(2) as i32;
                    }
                }
            }
        }
        penalty
    }

    fn _calculate_one_group_attribute_penalty_incremental(
        &self,
        value_counts: &mut Vec<u32>,
        constraint: &AttributeBalanceParams,
        attr_idx: usize,
        p_in_attr_val: usize,
        p_out_attr_val: usize,
    ) -> i32 {
        if p_in_attr_val == p_out_attr_val {
            return 0; // No change in attribute counts
        }

        let mut penalty_delta = 0;

        // --- Process p_out ---
        if p_out_attr_val != usize::MAX {
            if let Some(desired_count) = constraint
                .desired_values
                .get(&self.attr_idx_to_val[attr_idx][p_out_attr_val])
            {
                let current_count = value_counts[p_out_attr_val];
                let old_diff_sq = (current_count as i32 - *desired_count as i32).pow(2);
                let new_diff_sq = (current_count as i32 - 1 - *desired_count as i32).pow(2);
                penalty_delta += new_diff_sq - old_diff_sq;
                value_counts[p_out_attr_val] -= 1;
            }
        }

        // --- Process p_in ---
        if p_in_attr_val != usize::MAX {
            if let Some(desired_count) = constraint
                .desired_values
                .get(&self.attr_idx_to_val[attr_idx][p_in_attr_val])
            {
                let current_count = value_counts[p_in_attr_val];
                let old_diff_sq = (current_count as i32 - *desired_count as i32).pow(2);
                let new_diff_sq = (current_count as i32 + 1 - *desired_count as i32).pow(2);
                penalty_delta += new_diff_sq - old_diff_sq;
                value_counts[p_in_attr_val] += 1;
            }
        }

        penalty_delta
    }

    /// Calculate the change in score if p1 and p2 were swapped on a given day.
    /// This is the performance-critical function.
    fn _calculate_score_delta(&self, day: usize, p1_idx: usize, p2_idx: usize) -> (i32, i32, i32) {
        let (g1_idx, _) = self.locations[day][p1_idx];
        let (g2_idx, _) = self.locations[day][p2_idx];

        let mut contact_delta = 0;
        let mut repetition_delta = 0;

        // --- Contact & Repetition Delta ---
        // Process effect of p1 leaving g1 and p2 joining it
        for &member_idx in &self.schedule[day][g1_idx] {
            if member_idx == p1_idx {
                continue;
            }
            // p1 no longer meets member
            let p1_contacts = self.contact_matrix[p1_idx][member_idx];
            if p1_contacts == 1 {
                contact_delta -= 1;
            }
            if p1_contacts > 1 {
                let old_penalty = (p1_contacts - 1).pow(2) as i32;
                let new_penalty = (p1_contacts - 2).pow(2) as i32;
                repetition_delta += new_penalty - old_penalty;
            }

            // p2 now meets member
            let p2_contacts = self.contact_matrix[p2_idx][member_idx];
            if p2_contacts == 0 {
                contact_delta += 1;
            }
            if p2_contacts > 0 {
                let old_penalty = (p2_contacts - 1).pow(2) as i32;
                let new_penalty = (p2_contacts).pow(2) as i32;
                repetition_delta += new_penalty - old_penalty;
            }
        }

        // Process effect of p2 leaving g2 and p1 joining it
        for &member_idx in &self.schedule[day][g2_idx] {
            if member_idx == p2_idx {
                continue;
            }
            // p2 no longer meets member
            let p2_contacts = self.contact_matrix[p2_idx][member_idx];
            if p2_contacts == 1 {
                contact_delta -= 1;
            }
            if p2_contacts > 1 {
                let old_penalty = (p2_contacts - 1).pow(2) as i32;
                let new_penalty = (p2_contacts - 2).pow(2) as i32;
                repetition_delta += new_penalty - old_penalty;
            }

            // p1 now meets member
            let p1_contacts = self.contact_matrix[p1_idx][member_idx];
            if p1_contacts == 0 {
                contact_delta += 1;
            }
            if p1_contacts > 0 {
                let old_penalty = (p1_contacts - 1).pow(2) as i32;
                let new_penalty = (p1_contacts).pow(2) as i32;
                repetition_delta += new_penalty - old_penalty;
            }
        }

        // --- Gender Balance Delta ---
        let mut gender_balance_delta = 0;
        for constraint in &self.attribute_balance_constraints {
            if let Some(&attr_idx) = self.attr_key_to_idx.get(&constraint.attribute_key) {
                let p1_attr_val = self.person_attributes[p1_idx][attr_idx];
                let p2_attr_val = self.person_attributes[p2_idx][attr_idx];

                if p1_attr_val == p2_attr_val {
                    continue;
                }

                // Calculate for g1
                let mut g1_counts = vec![0; self.attr_idx_to_val[attr_idx].len()];
                for p_idx in &self.schedule[day][g1_idx] {
                    let val_idx = self.person_attributes[*p_idx][attr_idx];
                    if val_idx != usize::MAX {
                        g1_counts[val_idx] += 1;
                    }
                }
                gender_balance_delta += self._calculate_one_group_attribute_penalty_incremental(
                    &mut g1_counts,
                    constraint,
                    attr_idx,
                    p2_attr_val,
                    p1_attr_val,
                );

                // Calculate for g2
                let mut g2_counts = vec![0; self.attr_idx_to_val[attr_idx].len()];
                for p_idx in &self.schedule[day][g2_idx] {
                    let val_idx = self.person_attributes[*p_idx][attr_idx];
                    if val_idx != usize::MAX {
                        g2_counts[val_idx] += 1;
                    }
                }
                gender_balance_delta += self._calculate_one_group_attribute_penalty_incremental(
                    &mut g2_counts,
                    constraint,
                    attr_idx,
                    p1_attr_val,
                    p2_attr_val,
                );
            }
        }

        (contact_delta, repetition_delta, gender_balance_delta)
    }

    pub fn swap(
        &mut self,
        day: usize,
        p1_idx: usize,
        p2_idx: usize,
        temp: f64,
        rng: &mut impl Rng,
    ) {
        let (g1_idx, p1_vec_idx) = self.locations[day][p1_idx];
        let (g2_idx, p2_vec_idx) = self.locations[day][p2_idx];

        if g1_idx == g2_idx {
            return;
        }

        let (contact_delta, repetition_delta, gender_balance_delta) =
            self._calculate_score_delta(day, p1_idx, p2_idx);

        let score_delta = contact_delta as f64 * self.w_contacts
            - repetition_delta as f64 * self.w_repetition
            - gender_balance_delta as f64 * self.w_gender;

        // --- Decide whether to keep the swap ---
        if score_delta >= 0.0 || rng.gen::<f64>() < (score_delta / temp).exp() {
            // --- Update Contact Matrix ---
            let g1_members: Vec<usize> = self.schedule[day][g1_idx]
                .iter()
                .cloned()
                .filter(|&p| p != p1_idx)
                .collect();
            let g2_members: Vec<usize> = self.schedule[day][g2_idx]
                .iter()
                .cloned()
                .filter(|&p| p != p2_idx)
                .collect();

            for member_idx in g1_members {
                self.contact_matrix[p1_idx][member_idx] -= 1;
                self.contact_matrix[member_idx][p1_idx] -= 1;
                self.contact_matrix[p2_idx][member_idx] += 1;
                self.contact_matrix[member_idx][p2_idx] += 1;
            }
            for member_idx in g2_members {
                self.contact_matrix[p2_idx][member_idx] -= 1;
                self.contact_matrix[member_idx][p2_idx] -= 1;
                self.contact_matrix[p1_idx][member_idx] += 1;
                self.contact_matrix[member_idx][p1_idx] += 1;
            }

            // --- Perform Swap in schedule and locations---
            self.schedule[day][g1_idx][p1_vec_idx] = p2_idx;
            self.schedule[day][g2_idx][p2_vec_idx] = p1_idx;
            self.locations[day][p1_idx] = (g2_idx, p2_vec_idx);
            self.locations[day][p2_idx] = (g1_idx, p1_vec_idx);

            // --- Update Scores ---
            self.unique_contacts += contact_delta;
            self.repetition_penalty += repetition_delta;
            self.gender_balance_penalty += gender_balance_delta;
        }
    }

    pub fn to_solver_result(&self, final_score: f64) -> SolverResult {
        let mut schedule = HashMap::new();
        for (day_idx, day_schedule) in self.schedule.iter().enumerate() {
            let session_key = format!("session_{}", day_idx);
            let mut group_map = HashMap::new();
            for (group_idx, group) in day_schedule.iter().enumerate() {
                let group_key = self.group_idx_to_id[group_idx].clone();
                let person_ids = group
                    .iter()
                    .map(|&p_idx| self.person_idx_to_id[p_idx].clone())
                    .collect();
                group_map.insert(group_key, person_ids);
            }
            schedule.insert(session_key, group_map);
        }
        SolverResult {
            final_score,
            schedule,
        }
    }
}

pub fn run_solver(input: ApiInput) -> SolverResult {
    let mut state = State::new(&input);
    let mut rng = rand::thread_rng();

    // Extract solver params
    let (initial_temp, final_temp, cooling_schedule) =
        if let Some(crate::models::SolverParams::SimulatedAnnealing(params)) =
            input.solver.solver_params.as_ref()
        {
            (
                params.initial_temperature,
                params.final_temperature,
                params.cooling_schedule.as_str(),
            )
        } else {
            // Default values if not specified
            (1.0, 0.001, "geometric")
        };

    let max_iter = input
        .solver
        .stop_conditions
        .max_iterations
        .unwrap_or(100_000);
    let cooling_rate = (final_temp / initial_temp).powf(1.0 / max_iter as f64);
    let mut temp = initial_temp;

    println!("Solver starting...");
    println!(" -> Initial Temperature: {}", initial_temp);
    println!(" -> Max Iterations: {}", max_iter);
    println!(
        " -> Initial Scores: Contacts={}, Repetition Penalty={}, Gender Balance Penalty={}",
        state.unique_contacts, state.repetition_penalty, state.gender_balance_penalty
    );

    // Main simulated annealing loop
    for _ in 0..max_iter {
        let p1 = rng.gen_range(0..state.person_idx_to_id.len());
        let p2 = rng.gen_range(0..state.person_idx_to_id.len());
        let day = rng.gen_range(0..state.num_sessions as usize);

        state.swap(day, p1, p2, temp, &mut rng);

        // Cool down temperature
        match cooling_schedule {
            "geometric" => temp *= cooling_rate,
            "linear" => temp -= (initial_temp - final_temp) / max_iter as f64,
            _ => temp *= cooling_rate, // Default to geometric
        }
        if temp < final_temp {
            temp = final_temp;
        }
    }

    let final_score = state.unique_contacts as f64 * state.w_contacts
        - state.repetition_penalty as f64 * state.w_repetition
        - state.gender_balance_penalty as f64 * state.w_gender;

    println!("Solver finished.");
    println!(
        " -> Final Scores: Contacts={}, Repetition Penalty={}, Gender Balance Penalty={}",
        state.unique_contacts, state.repetition_penalty, state.gender_balance_penalty
    );
    println!(" -> Final Weighted Score: {}", final_score);

    state.to_solver_result(final_score)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        ApiInput, Group, Person, ProblemDefinition, SimulatedAnnealingParams, SolverConfiguration,
        SolverParams, StopConditions,
    };
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;
    use std::collections::HashMap;

    // Helper to create a deterministic test setup
    fn create_test_input() -> ApiInput {
        ApiInput {
            problem: ProblemDefinition {
                people: (0..6)
                    .map(|i| Person {
                        id: format!("p{}", i),
                        attributes: HashMap::new(),
                    })
                    .collect(),
                groups: (0..2)
                    .map(|i| Group {
                        id: format!("g{}", i),
                        size: 3,
                    })
                    .collect(),
                num_sessions: 2,
            },
            objectives: vec![],
            constraints: vec![],
            solver: SolverConfiguration {
                solver_type: "SimulatedAnnealing".to_string(),
                stop_conditions: StopConditions {
                    max_iterations: Some(1),
                    time_limit_seconds: None,
                    no_improvement_iterations: None,
                },
                solver_params: Some(SolverParams::SimulatedAnnealing(SimulatedAnnealingParams {
                    initial_temperature: 1.0,
                    final_temperature: 0.1,
                    cooling_schedule: "linear".to_string(),
                })),
            },
        }
    }

    #[test]
    fn test_recalculate_scores_is_correct() {
        // 1. Setup
        let input = create_test_input();
        let mut state = State::new(&input);
        state.schedule = vec![
            vec![vec![0, 1, 2], vec![3, 4, 5]], // Day 0: 6 contacts
            vec![vec![0, 3, 4], vec![1, 2, 5]], // Day 1: 6 contacts
        ];
        state.recalculate_locations_from_schedule();

        // 2. Action
        state.recalculate_scores();

        // 3. Assert
        // Unique contacts:
        // Day 0: (0,1), (0,2), (1,2), (3,4), (3,5), (4,5) -> 6 unique
        // Day 1: (0,3), (0,4), (3,4), (1,2), (1,5), (2,5) -> 6 unique
        // Total unique pairs: (0,1), (0,2), (0,3), (0,4), (1,2), (1,5), (2,5), (3,4), (3,5), (4,5) -> 10 unique
        //
        // Repetition penalty:
        // (1,2) appears twice -> (2-1)^2 = 1
        // (3,4) appears twice -> (2-1)^2 = 1
        // Total penalty = 2
        assert_eq!(state.unique_contacts, 10);
        assert_eq!(state.repetition_penalty, 2);
    }

    #[test]
    fn test_swap_updates_scores_correctly() {
        // 1. Setup
        let input = create_test_input();
        let mut state = State::new(&input);
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        // Force a known initial schedule for predictability
        state.schedule = vec![
            vec![vec![0, 1, 2], vec![3, 4, 5]], // Day 0
            vec![vec![0, 3, 4], vec![1, 2, 5]], // Day 1
        ];
        state.recalculate_locations_from_schedule();
        state.recalculate_scores();

        let initial_schedule = state.schedule.clone();

        // 2. Action: Swap person 2 (from G0) with person 3 (from G1) on day 0
        // This swap has a score_delta of 0. It should be accepted.
        state.swap(0, 2, 3, 1.0, &mut rng);

        // 3. Assert
        assert_ne!(
            initial_schedule, state.schedule,
            "Schedule should change after a neutral-score swap."
        );

        // After swapping p2 and p3 on day 0, the new schedule is:
        // Day 0: G0=[0, 1, 3], G1=[2, 4, 5]
        let expected_day_0 = vec![vec![0, 1, 3], vec![2, 4, 5]];
        assert_eq!(
            state.schedule[0], expected_day_0,
            "Day 0 of schedule is incorrect after swap."
        );

        // The scores don't change for this specific swap, but they should be recalculated correctly.
        assert_eq!(state.unique_contacts, 10);
        assert_eq!(state.repetition_penalty, 2);
    }
}
