use crate::models::{ApiInput, AttributeBalanceParams, Constraint, LoggingOptions, SolverResult};
use rand::seq::SliceRandom;
use serde::Serialize;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
pub enum SolverError {
    #[error("Constraint violation: {0}")]
    ValidationError(String),
}

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
    // --- UI / Logging ---
    pub logging: LoggingOptions,

    // --- Core Data Structures ---
    // The main schedule: [day][group_idx] -> Vec<person_idx>
    pub schedule: Vec<Vec<Vec<usize>>>,
    // Fast lookup for a person's location: [day][person_idx] -> (group_idx, vec_idx)
    pub locations: Vec<Vec<(usize, usize)>>,

    // --- Problem Definition (integer-based) ---
    // [person_idx][attr_idx] -> value_idx for that attribute
    pub person_attributes: Vec<Vec<usize>>,
    pub attribute_balance_constraints: Vec<AttributeBalanceParams>,
    // -- New Constraint Structures --
    pub cliques: Vec<Vec<usize>>,
    pub person_to_clique_id: Vec<Option<usize>>,
    pub forbidden_pairs: Vec<(usize, usize)>,
    pub immovable_people: HashMap<(usize, usize), usize>, // (person_idx, session_idx) -> group_idx
    pub num_sessions: u32,

    // --- Scoring Data ---
    pub contact_matrix: Vec<Vec<u32>>,
    pub unique_contacts: i32,
    pub repetition_penalty: i32,
    pub attribute_balance_penalty: f64,
    pub constraint_penalty: i32,

    // --- Weights ---
    pub w_contacts: f64,
    pub w_repetition: f64,
    pub w_constraint: f64,
}

impl State {
    pub fn new(input: &ApiInput) -> Result<Self, SolverError> {
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
        if let Some(constraint) = input
            .constraints
            .iter()
            .find(|c| matches!(c, Constraint::RepeatEncounter(_)))
        {
            if let Constraint::RepeatEncounter(params) = constraint {
                w_repetition = params.penalty_weight;
            }
        }

        let schedule = vec![vec![vec![]; group_count]; input.problem.num_sessions as usize];
        let locations = vec![vec![(0, 0); people_count]; input.problem.num_sessions as usize];

        let mut state = Self {
            person_id_to_idx,
            person_idx_to_id,
            group_id_to_idx,
            group_idx_to_id,
            attr_key_to_idx,
            attr_val_to_idx,
            attr_idx_to_val,
            logging: input.solver.logging.clone(),
            schedule,
            locations,
            person_attributes,
            attribute_balance_constraints,
            cliques: vec![], // To be populated by preprocessing
            person_to_clique_id: vec![None; people_count], // To be populated
            forbidden_pairs: vec![], // To be populated
            immovable_people: HashMap::new(), // To be populated
            num_sessions: input.problem.num_sessions,
            contact_matrix: vec![vec![0; people_count]; people_count],
            unique_contacts: 0,
            repetition_penalty: 0,
            attribute_balance_penalty: 0.0,
            constraint_penalty: 0,
            w_contacts,
            w_repetition,
            w_constraint: 1000.0, // Hardcoded high weight for constraint violations
        };

        state._preprocess_and_validate_constraints(input)?;

        // --- Initialize with a random assignment (clique-aware) ---
        let mut rng = rand::rng();
        let mut unassigned_people: Vec<usize> = (0..people_count)
            .filter(|p| state.person_to_clique_id[*p].is_none())
            .collect();
        unassigned_people.shuffle(&mut rng);

        for (day, day_schedule) in state.schedule.iter_mut().enumerate() {
            let mut assigned_in_day = vec![false; people_count];
            let mut group_cursors = vec![0; group_count];

            // 0. Assign immovable people for this day
            for (person_idx, group_idx) in state
                .immovable_people
                .iter()
                .filter(|((_, s_idx), _)| *s_idx == day)
                .map(|((p_idx, _), g_idx)| (*p_idx, *g_idx))
            {
                let group_size = input.problem.groups[group_idx].size as usize;
                if group_cursors[group_idx] < group_size {
                    day_schedule[group_idx].push(person_idx);
                    assigned_in_day[person_idx] = true;
                    group_cursors[group_idx] += 1;
                } else {
                    return Err(SolverError::ValidationError(format!(
                        "Cannot place immovable person {} in group {}: group is full.",
                        state.person_idx_to_id[person_idx], state.group_idx_to_id[group_idx]
                    )));
                }
            }

            // After assigning immovables, remove them from the unassigned list
            unassigned_people.retain(|p_idx| !assigned_in_day[*p_idx]);

            // 1. Assign cliques first
            for clique in &state.cliques {
                let mut placed = false;
                let mut potential_groups: Vec<usize> = (0..group_count).collect();
                potential_groups.shuffle(&mut rng);

                for group_idx in potential_groups {
                    let group_size = input.problem.groups[group_idx].size as usize;
                    if group_cursors[group_idx] + clique.len() <= group_size {
                        for &person_idx in clique {
                            day_schedule[group_idx].push(person_idx);
                            assigned_in_day[person_idx] = true;
                        }
                        group_cursors[group_idx] += clique.len();
                        placed = true;
                        break;
                    }
                }
                if !placed {
                    // This should be rare if validation passed, but as a fallback:
                    println!("Warning: Could not place clique {:?} in any group.", clique);
                }
            }

            // 2. Assign remaining individuals
            let mut person_cursor = 0;
            while person_cursor < unassigned_people.len() {
                let person_idx = unassigned_people[person_cursor];
                let mut placed = false;

                let mut potential_groups: Vec<usize> = (0..group_count).collect();
                potential_groups.shuffle(&mut rng);

                for group_idx in potential_groups {
                    let group_size = input.problem.groups[group_idx].size as usize;
                    if group_cursors[group_idx] < group_size {
                        day_schedule[group_idx].push(person_idx);
                        group_cursors[group_idx] += 1;
                        placed = true;
                        break;
                    }
                }
                person_cursor += 1;
                if !placed {
                    println!(
                        "Warning: Could not place person {} in any group.",
                        state.person_idx_to_id[person_idx]
                    );
                }
            }
            unassigned_people.shuffle(&mut rng); // Re-shuffle for next day
        }

        state._recalculate_locations_from_schedule();
        state._recalculate_scores();
        Ok(state)
    }

    fn _preprocess_and_validate_constraints(
        &mut self,
        input: &ApiInput,
    ) -> Result<(), SolverError> {
        let people_count = self.person_id_to_idx.len();
        // --- Process `MustStayTogether` (Cliques) and `CannotBeTogether` (Forbidden Pairs) ---
        // This part combines clique logic and must-stay-together constraints.
        // It uses a Disjoint Set Union (DSU) data structure to merge people into cliques.

        let mut dsu = DSU::new(people_count);
        let mut person_to_clique_id = vec![None; people_count];

        for constraint in &input.constraints {
            if let Constraint::MustStayTogether { people } = constraint {
                if people.len() < 2 {
                    continue;
                }
                for i in 0..(people.len() - 1) {
                    let p1_id = &people[i];
                    let p2_id = &people[i + 1];
                    let p1_idx = self.person_id_to_idx.get(p1_id).ok_or_else(|| {
                        SolverError::ValidationError(format!("Person '{}' not found.", p1_id))
                    })?;
                    let p2_idx = self.person_id_to_idx.get(p2_id).ok_or_else(|| {
                        SolverError::ValidationError(format!("Person '{}' not found.", p2_id))
                    })?;
                    dsu.union(*p1_idx, *p2_idx);
                }
            }
        }

        let mut cliques: HashMap<usize, Vec<usize>> = HashMap::new();
        for i in 0..people_count {
            let root = dsu.find(i);
            cliques.entry(root).or_default().push(i);
        }

        self.cliques = Vec::new();
        let mut clique_id_counter = 0;
        for (_, clique_members) in cliques.into_iter().filter(|(_, v)| v.len() > 1) {
            // Validate clique size against group sizes
            let max_group_size = input
                .problem
                .groups
                .iter()
                .map(|g| g.size)
                .max()
                .unwrap_or(0);
            if clique_members.len() as u32 > max_group_size {
                let member_ids: Vec<String> = clique_members
                    .iter()
                    .map(|id| self.person_idx_to_id[*id].clone())
                    .collect();
                return Err(SolverError::ValidationError(format!(
                    "Clique {:?} is larger than any available group.",
                    member_ids
                )));
            }

            for &member_idx in &clique_members {
                person_to_clique_id[member_idx] = Some(clique_id_counter);
            }
            self.cliques.push(clique_members);
            clique_id_counter += 1;
        }
        self.person_to_clique_id = person_to_clique_id;

        // --- Process `CannotBeTogether` (Forbidden Pairs) ---
        for constraint in &input.constraints {
            if let Constraint::CannotBeTogether { people } = constraint {
                for i in 0..people.len() {
                    for j in (i + 1)..people.len() {
                        let p1_idx = *self.person_id_to_idx.get(&people[i]).unwrap();
                        let p2_idx = *self.person_id_to_idx.get(&people[j]).unwrap();

                        // Check for conflict with cliques
                        if let (Some(c1), Some(c2)) = (
                            self.person_to_clique_id[p1_idx],
                            self.person_to_clique_id[p2_idx],
                        ) {
                            if c1 == c2 {
                                return Err(SolverError::ValidationError(format!(
                                    "Forbidden pair ({}, {}) are in the same clique.",
                                    people[i], people[j]
                                )));
                            }
                        }
                        self.forbidden_pairs.push((p1_idx, p2_idx));
                    }
                }
            }
        }

        // --- Process `ImmovablePerson` ---
        for constraint in &input.constraints {
            if let Constraint::ImmovablePerson(params) = constraint {
                let p_idx = self
                    .person_id_to_idx
                    .get(&params.person_id)
                    .ok_or_else(|| {
                        SolverError::ValidationError(format!(
                            "Person '{}' not found.",
                            params.person_id
                        ))
                    })?;
                let g_idx = self.group_id_to_idx.get(&params.group_id).ok_or_else(|| {
                    SolverError::ValidationError(format!("Group '{}' not found.", params.group_id))
                })?;

                for &session in &params.sessions {
                    let s_idx = session as usize;
                    if s_idx >= self.num_sessions as usize {
                        return Err(SolverError::ValidationError(format!(
                            "Session index {} out of bounds for immovable person {}.",
                            s_idx, params.person_id
                        )));
                    }
                    self.immovable_people.insert((*p_idx, s_idx), *g_idx);
                }
            }
        }

        Ok(())
    }

    pub fn _recalculate_locations_from_schedule(&mut self) {
        for (day_idx, day_schedule) in self.schedule.iter().enumerate() {
            for (group_idx, group_vec) in day_schedule.iter().enumerate() {
                for (vec_idx, &person_idx) in group_vec.iter().enumerate() {
                    self.locations[day_idx][person_idx] = (group_idx, vec_idx);
                }
            }
        }
    }

    pub fn _recalculate_scores(&mut self) {
        self.unique_contacts = 0;
        self.repetition_penalty = 0;
        self.attribute_balance_penalty = 0.0;

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

        // --- Attribute Balance Penalty (Generalized) ---
        for day_schedule in &self.schedule {
            for (group_idx, group_people) in day_schedule.iter().enumerate() {
                let group_id = &self.group_idx_to_id[group_idx];

                for constraint in &self.attribute_balance_constraints {
                    // Check if the constraint applies to this group (or all groups)
                    if &constraint.group_id != group_id && constraint.group_id != "ALL" {
                        continue;
                    }

                    // Find the internal index for the attribute key (e.g., "gender", "department")
                    if let Some(&attr_idx) = self.attr_key_to_idx.get(&constraint.attribute_key) {
                        let num_values = self.attr_idx_to_val[attr_idx].len();
                        let mut value_counts = vec![0; num_values];

                        // Count how many people with each attribute value are in the group
                        for person_idx in group_people {
                            let val_idx = self.person_attributes[*person_idx][attr_idx];
                            if val_idx != usize::MAX {
                                value_counts[val_idx] += 1;
                            }
                        }

                        // Calculate the penalty for this specific constraint
                        let mut penalty_for_this_constraint = 0.0;
                        for (desired_val_str, desired_count) in &constraint.desired_values {
                            if let Some(&val_idx) =
                                self.attr_val_to_idx[attr_idx].get(desired_val_str)
                            {
                                let actual_count = value_counts[val_idx];
                                let diff = (actual_count as i32 - *desired_count as i32).abs();
                                penalty_for_this_constraint += diff.pow(2) as f64;
                            }
                        }

                        // Add the weighted penalty to the total
                        self.attribute_balance_penalty +=
                            penalty_for_this_constraint * constraint.penalty_weight;
                    }
                }
            }
        }

        // --- Constraint Penalty ---
        self.constraint_penalty = 0;
        for day_schedule in &self.schedule {
            for group in day_schedule {
                for &(p1, p2) in &self.forbidden_pairs {
                    let mut p1_in = false;
                    let mut p2_in = false;
                    for &member in group {
                        if member == p1 {
                            p1_in = true;
                        }
                        if member == p2 {
                            p2_in = true;
                        }
                    }
                    if p1_in && p2_in {
                        self.constraint_penalty += 1;
                    }
                }
            }
        }
    }

    pub fn to_solver_result(&self, final_score: f64) -> SolverResult {
        let mut schedule_output = HashMap::new();
        for (day, day_schedule) in self.schedule.iter().enumerate() {
            let session_key = format!("session_{}", day);
            let mut group_map = HashMap::new();
            for (group_idx, group) in day_schedule.iter().enumerate() {
                let group_key = self.group_idx_to_id[group_idx].clone();
                let person_ids = group
                    .iter()
                    .map(|&p_idx| self.person_idx_to_id[p_idx].clone())
                    .collect();
                group_map.insert(group_key, person_ids);
            }
            schedule_output.insert(session_key, group_map);
        }
        SolverResult {
            final_score,
            schedule: schedule_output,
            unique_contacts: self.unique_contacts,
            repetition_penalty: self.repetition_penalty,
            attribute_balance_penalty: self.attribute_balance_penalty as i32,
            constraint_penalty: self.constraint_penalty,
        }
    }

    /// Calculates the overall weighted score based on the current state.
    pub(crate) fn weighted_score(&self) -> f64 {
        self.unique_contacts as f64 * self.w_contacts
            - self.repetition_penalty as f64 * self.w_repetition
            - self.attribute_balance_penalty
            - self.constraint_penalty as f64 * self.w_constraint
    }

    fn get_attribute_counts(&self, group_members: &[usize], attr_idx: usize) -> Vec<u32> {
        let num_values = self.attr_idx_to_val.get(attr_idx).map_or(0, |v| v.len());
        let mut counts = vec![0; num_values];
        for &person_idx in group_members {
            let value_idx = self.person_attributes[person_idx][attr_idx];
            if value_idx != usize::MAX {
                counts[value_idx] += 1;
            }
        }
        counts
    }

    fn calculate_penalty_from_counts(&self, counts: &[u32], ac: &AttributeBalanceParams) -> f64 {
        let mut penalty = 0.0;
        for (val_str, desired_count) in &ac.desired_values {
            if let Some(&val_idx) =
                self.attr_val_to_idx[self.attr_key_to_idx[&ac.attribute_key]].get(val_str)
            {
                let actual_count = counts[val_idx];
                let diff = (actual_count as i32 - *desired_count as i32).abs();
                penalty += diff.pow(2) as f64 * ac.penalty_weight;
            }
        }
        penalty
    }

    fn _recalculate_attribute_balance_penalty(&mut self) {
        self.attribute_balance_penalty = 0.0;
        for day_schedule in &self.schedule {
            for (group_idx, group_people) in day_schedule.iter().enumerate() {
                let group_id = &self.group_idx_to_id[group_idx];

                for constraint in &self.attribute_balance_constraints {
                    // Check if the constraint applies to this group (or all groups)
                    if &constraint.group_id != group_id && constraint.group_id != "ALL" {
                        continue;
                    }

                    // Find the internal index for the attribute key (e.g., "gender", "department")
                    if let Some(&attr_idx) = self.attr_key_to_idx.get(&constraint.attribute_key) {
                        let num_values = self.attr_idx_to_val[attr_idx].len();
                        let mut value_counts = vec![0; num_values];

                        // Count how many people with each attribute value are in the group
                        for person_idx in group_people {
                            let val_idx = self.person_attributes[*person_idx][attr_idx];
                            if val_idx != usize::MAX {
                                value_counts[val_idx] += 1;
                            }
                        }

                        // Calculate the penalty for this specific constraint
                        let mut penalty_for_this_constraint = 0.0;
                        for (desired_val_str, desired_count) in &constraint.desired_values {
                            if let Some(&val_idx) =
                                self.attr_val_to_idx[attr_idx].get(desired_val_str)
                            {
                                let actual_count = value_counts[val_idx];
                                let diff = (actual_count as i32 - *desired_count as i32).abs();
                                penalty_for_this_constraint += diff.pow(2) as f64;
                            }
                        }

                        // Add the weighted penalty to the total
                        self.attribute_balance_penalty +=
                            penalty_for_this_constraint * constraint.penalty_weight;
                    }
                }
            }
        }
    }

    fn _recalculate_constraint_penalty(&mut self) {
        self.constraint_penalty = 0;
        for day_schedule in &self.schedule {
            for group in day_schedule {
                for &(p1, p2) in &self.forbidden_pairs {
                    let mut p1_in = false;
                    let mut p2_in = false;
                    for &member in group {
                        if member == p1 {
                            p1_in = true;
                        }
                        if member == p2 {
                            p2_in = true;
                        }
                    }
                    if p1_in && p2_in {
                        self.constraint_penalty += 1;
                    }
                }
            }
        }
    }

    fn calculate_group_attribute_penalty_for_members(
        &self,
        group_members: &[usize],
        ac: &AttributeBalanceParams,
    ) -> f64 {
        if let Some(&attr_idx) = self.attr_key_to_idx.get(&ac.attribute_key) {
            let counts = self.get_attribute_counts(group_members, attr_idx);
            return self.calculate_penalty_from_counts(&counts, ac);
        }
        0.0
    }

    pub fn calculate_swap_delta(&self, day: usize, p1_idx: usize, p2_idx: usize) -> f64 {
        let (g1_idx, _) = self.locations[day][p1_idx];
        let (g2_idx, _) = self.locations[day][p2_idx];

        if g1_idx == g2_idx {
            return 0.0;
        }

        let mut delta_score = 0.0;

        // Contact/Repetition Delta
        let g1_members = &self.schedule[day][g1_idx];
        let g2_members = &self.schedule[day][g2_idx];
        // p1
        for &member in g1_members.iter() {
            if member == p1_idx {
                continue;
            }
            let count = self.contact_matrix[p1_idx][member];
            delta_score +=
                self.w_repetition * ((count as i32 - 2).pow(2) - (count as i32 - 1).pow(2)) as f64;
            if count == 1 {
                delta_score -= self.w_contacts;
            }
        }
        for &member in g2_members.iter() {
            if member == p2_idx {
                continue;
            }
            let count = self.contact_matrix[p1_idx][member];
            delta_score +=
                self.w_repetition * ((count as i32).pow(2) - (count as i32 - 1).pow(2)) as f64;
            if count == 0 {
                delta_score += self.w_contacts;
            }
        }
        // p2
        for &member in g2_members.iter() {
            if member == p2_idx {
                continue;
            }
            let count = self.contact_matrix[p2_idx][member];
            delta_score +=
                self.w_repetition * ((count as i32 - 2).pow(2) - (count as i32 - 1).pow(2)) as f64;
            if count == 1 {
                delta_score -= self.w_contacts;
            }
        }
        for &member in g1_members.iter() {
            if member == p1_idx {
                continue;
            }
            let count = self.contact_matrix[p2_idx][member];
            delta_score +=
                self.w_repetition * ((count as i32).pow(2) - (count as i32 - 1).pow(2)) as f64;
            if count == 0 {
                delta_score += self.w_contacts;
            }
        }

        // Attribute Balance Delta
        for ac in &self.attribute_balance_constraints {
            let old_penalty_g1 = self.calculate_group_attribute_penalty_for_members(g1_members, ac);
            let old_penalty_g2 = self.calculate_group_attribute_penalty_for_members(g2_members, ac);

            let mut next_g1_members: Vec<usize> = g1_members
                .iter()
                .filter(|&&p| p != p1_idx)
                .cloned()
                .collect();
            next_g1_members.push(p2_idx);
            let mut next_g2_members: Vec<usize> = g2_members
                .iter()
                .filter(|&&p| p != p2_idx)
                .cloned()
                .collect();
            next_g2_members.push(p1_idx);

            let new_penalty_g1 =
                self.calculate_group_attribute_penalty_for_members(&next_g1_members, ac);
            let new_penalty_g2 =
                self.calculate_group_attribute_penalty_for_members(&next_g2_members, ac);

            delta_score -= (new_penalty_g1 + new_penalty_g2) - (old_penalty_g1 + old_penalty_g2);
        }

        // Hard Constraint Delta - Cliques
        if let Some(c_id) = self.person_to_clique_id[p1_idx] {
            let clique = &self.cliques[c_id];
            // If p2 is not in the same clique, this swap would break the clique
            if self.person_to_clique_id[p2_idx] != Some(c_id) {
                delta_score -= self.w_constraint * clique.len() as f64;
            }
        } else if let Some(c_id) = self.person_to_clique_id[p2_idx] {
            // Same logic if p2 is in a clique and p1 is not
            let clique = &self.cliques[c_id];
            if self.person_to_clique_id[p1_idx] != Some(c_id) {
                delta_score -= self.w_constraint * clique.len() as f64;
            }
        }

        // Hard Constraint Delta - Forbidden Pairs
        for &(p1, p2) in &self.forbidden_pairs {
            let p1_is_swapped = p1_idx == p1 || p2_idx == p1;
            let p2_is_swapped = p1_idx == p2 || p2_idx == p2;

            // If the pair is not involved in the swap, no change
            if !p1_is_swapped && !p2_is_swapped {
                continue;
            }

            // Penalty before swap
            if g1_members.contains(&p1) && g1_members.contains(&p2) {
                delta_score += self.w_constraint;
            }
            if g2_members.contains(&p1) && g2_members.contains(&p2) {
                delta_score += self.w_constraint;
            }

            // Penalty after swap
            let mut next_g1_members: Vec<usize> = g1_members
                .iter()
                .filter(|&&p| p != p1_idx)
                .cloned()
                .collect();
            next_g1_members.push(p2_idx);
            let mut next_g2_members: Vec<usize> = g2_members
                .iter()
                .filter(|&&p| p != p2_idx)
                .cloned()
                .collect();
            next_g2_members.push(p1_idx);
            if next_g1_members.contains(&p1) && next_g1_members.contains(&p2) {
                delta_score -= self.w_constraint;
            }
            if next_g2_members.contains(&p1) && next_g2_members.contains(&p2) {
                delta_score -= self.w_constraint;
            }
        }

        delta_score
    }

    pub fn apply_swap(&mut self, day: usize, p1_idx: usize, p2_idx: usize) {
        let (g1_idx, p1_vec_idx) = self.locations[day][p1_idx];
        let (g2_idx, p2_vec_idx) = self.locations[day][p2_idx];

        if g1_idx == g2_idx {
            return;
        }

        // Recalculate penalties for affected groups before the swap
        for ac in &self.attribute_balance_constraints.clone() {
            self.attribute_balance_penalty -=
                self.calculate_group_attribute_penalty_for_members(&self.schedule[day][g1_idx], ac);
            self.attribute_balance_penalty -=
                self.calculate_group_attribute_penalty_for_members(&self.schedule[day][g2_idx], ac);
        }

        // Contact/Repetition updates
        let g1_members = self.schedule[day][g1_idx].clone();
        let g2_members = self.schedule[day][g2_idx].clone();
        // p1
        for &member in g1_members.iter() {
            if member == p1_idx {
                continue;
            }
            let count = self.contact_matrix[p1_idx][member];
            self.repetition_penalty -= (count as i32 - 1).pow(2);
            if count > 1 {
                self.repetition_penalty += (count as i32 - 2).pow(2);
            }
            if count == 1 {
                self.unique_contacts -= 1;
            }
            self.contact_matrix[p1_idx][member] -= 1;
            self.contact_matrix[member][p1_idx] -= 1;
        }
        for &member in g2_members.iter() {
            if member == p2_idx {
                continue;
            }
            let count = self.contact_matrix[p1_idx][member];
            self.repetition_penalty -= (count as i32 - 1).pow(2);
            self.repetition_penalty += (count as i32).pow(2);
            if count == 0 {
                self.unique_contacts += 1;
            }
            self.contact_matrix[p1_idx][member] += 1;
            self.contact_matrix[member][p1_idx] += 1;
        }
        // p2
        for &member in g2_members.iter() {
            if member == p2_idx {
                continue;
            }
            let count = self.contact_matrix[p2_idx][member];
            self.repetition_penalty -= (count as i32 - 1).pow(2);
            if count > 1 {
                self.repetition_penalty += (count as i32 - 2).pow(2);
            }
            if count == 1 {
                self.unique_contacts -= 1;
            }
            self.contact_matrix[p2_idx][member] -= 1;
            self.contact_matrix[member][p2_idx] -= 1;
        }
        for &member in g1_members.iter() {
            if member == p1_idx {
                continue;
            }
            let count = self.contact_matrix[p2_idx][member];
            self.repetition_penalty -= (count as i32 - 1).pow(2);
            self.repetition_penalty += (count as i32).pow(2);
            if count == 0 {
                self.unique_contacts += 1;
            }
            self.contact_matrix[p2_idx][member] += 1;
            self.contact_matrix[member][p2_idx] += 1;
        }

        // Perform swap
        self.schedule[day][g1_idx][p1_vec_idx] = p2_idx;
        self.schedule[day][g2_idx][p2_vec_idx] = p1_idx;
        self.locations[day][p1_idx] = (g2_idx, p2_vec_idx);
        self.locations[day][p2_idx] = (g1_idx, p1_vec_idx);

        // Recalculate penalties for affected groups after the swap
        for ac in &self.attribute_balance_constraints.clone() {
            self.attribute_balance_penalty +=
                self.calculate_group_attribute_penalty_for_members(&self.schedule[day][g1_idx], ac);
            self.attribute_balance_penalty +=
                self.calculate_group_attribute_penalty_for_members(&self.schedule[day][g2_idx], ac);
        }

        // A full recalculation is cheap enough for this simple constraint
        self._recalculate_constraint_penalty();
    }
}

// Helper struct for Disjoint Set Union
struct DSU {
    parent: Vec<usize>,
}

impl DSU {
    fn new(n: usize) -> Self {
        DSU {
            parent: (0..n).collect(),
        }
    }

    fn find(&mut self, i: usize) -> usize {
        if self.parent[i] == i {
            i
        } else {
            self.parent[i] = self.find(self.parent[i]);
            self.parent[i]
        }
    }

    fn union(&mut self, i: usize, j: usize) {
        let root_i = self.find(i);
        let root_j = self.find(j);
        if root_i != root_j {
            self.parent[root_i] = root_j;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        ApiInput, Group, Person, ProblemDefinition, SimulatedAnnealingParams, SolverConfiguration,
        SolverParams, StopConditions,
    };
    use std::collections::HashMap;

    // Helper to create a deterministic test setup
    fn create_test_input(
        num_people: u32,
        groups_config: Vec<(u32, u32)>,
        num_sessions: u32,
    ) -> ApiInput {
        let people = (0..num_people)
            .map(|i| Person {
                id: format!("p{}", i),
                attributes: HashMap::new(),
            })
            .collect();

        let groups = groups_config
            .iter()
            .enumerate()
            .map(|(i, (num_groups, size))| {
                (0..*num_groups).map(move |j| Group {
                    id: format!("g{}_{}", i, j),
                    size: *size,
                })
            })
            .flatten()
            .collect();

        ApiInput {
            problem: ProblemDefinition {
                people,
                groups,
                num_sessions,
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
                solver_params: SolverParams::SimulatedAnnealing(SimulatedAnnealingParams {
                    initial_temperature: 1.0,
                    final_temperature: 0.1,
                    cooling_schedule: "linear".to_string(),
                }),
                logging: Default::default(),
            },
        }
    }

    #[test]
    fn test_recalculate_scores_is_correct() {
        // 1. Setup
        let input = create_test_input(6, vec![(2, 3)], 2);
        let mut state = State::new(&input).unwrap();
        state.schedule = vec![
            vec![vec![0, 1, 2], vec![3, 4, 5]], // Day 0: 6 contacts
            vec![vec![0, 3, 4], vec![1, 2, 5]], // Day 1: 6 contacts
        ];
        state._recalculate_locations_from_schedule();

        // 2. Action
        state._recalculate_scores();

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
        let input = create_test_input(6, vec![(2, 3)], 2);
        let mut state = State::new(&input).unwrap();

        // Force a known initial schedule for predictability
        state.schedule = vec![
            vec![vec![0, 1, 2], vec![3, 4, 5]], // Day 0
            vec![vec![0, 3, 4], vec![1, 2, 5]], // Day 1
        ];
        state._recalculate_locations_from_schedule();
        state._recalculate_scores();

        let mut state_after_swap = state.clone();

        // 2. Action: Swap person 2 (from G0) with person 3 (from G1) on day 0
        state_after_swap.apply_swap(0, 2, 3);
        state_after_swap._recalculate_scores();

        // 3. Assert
        assert_ne!(
            state.schedule, state_after_swap.schedule,
            "Schedule should change after a neutral-score swap."
        );

        // After swapping p2 and p3 on day 0, the new schedule is:
        // Day 0: G0=[0, 1, 3], G1=[2, 4, 5]
        let expected_day_0 = vec![vec![0, 1, 3], vec![2, 4, 5]];
        assert_eq!(
            state_after_swap.schedule[0], expected_day_0,
            "Day 0 of schedule is incorrect after swap."
        );

        // The scores don't change for this specific swap, but they should be recalculated correctly.
        assert_eq!(state_after_swap.unique_contacts, 10);
        assert_eq!(state_after_swap.repetition_penalty, 2);
    }

    #[test]
    fn test_clique_merging() {
        let mut input = create_test_input(10, vec![(1, 10)], 1);
        input.constraints = vec![
            Constraint::MustStayTogether {
                people: vec!["p0".into(), "p1".into()],
            },
            Constraint::MustStayTogether {
                people: vec!["p1".into(), "p2".into()],
            },
            Constraint::MustStayTogether {
                people: vec!["p4".into(), "p5".into()],
            },
        ];

        let state = State::new(&input).unwrap();
        assert_eq!(state.cliques.len(), 2, "Should have 2 merged cliques");

        let clique1 = state.cliques.iter().find(|c| c.contains(&0)).unwrap();
        assert!(
            clique1.contains(&1) && clique1.contains(&2),
            "Clique 1 is incorrect"
        );

        let clique2 = state.cliques.iter().find(|c| c.contains(&4)).unwrap();
        assert!(clique2.contains(&5), "Clique 2 is incorrect");

        assert_eq!(state.person_to_clique_id[0], state.person_to_clique_id[1]);
        assert_eq!(state.person_to_clique_id[1], state.person_to_clique_id[2]);
        assert_ne!(state.person_to_clique_id[2], state.person_to_clique_id[3]);
        assert_eq!(state.person_to_clique_id[4], state.person_to_clique_id[5]);
    }

    #[test]
    fn test_error_on_clique_too_large() {
        let mut input = create_test_input(5, vec![(1, 3)], 1);
        input.constraints = vec![Constraint::MustStayTogether {
            people: vec!["p0".into(), "p1".into(), "p2".into(), "p3".into()],
        }];

        let result = State::new(&input);
        assert!(result.is_err());
        if let Err(SolverError::ValidationError(msg)) = result {
            assert!(msg.contains("is larger than any available group"));
        } else {
            panic!("Expected a ValidationError");
        }
    }

    #[test]
    fn test_error_on_forbidden_pair_in_clique() {
        let mut input = create_test_input(5, vec![(1, 5)], 1);
        input.constraints = vec![
            Constraint::MustStayTogether {
                people: vec!["p0".into(), "p1".into()],
            },
            Constraint::CannotBeTogether {
                people: vec!["p0".into(), "p1".into()],
            },
        ];

        let result = State::new(&input);
        assert!(result.is_err());
        if let Err(SolverError::ValidationError(msg)) = result {
            assert!(msg.contains("Forbidden pair"));
            assert!(msg.contains("are in the same clique"));
        } else {
            panic!("Expected a ValidationError");
        }
    }
}
