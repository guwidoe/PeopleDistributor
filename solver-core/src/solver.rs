use crate::models::{ApiInput, AttributeBalanceParams, Constraint, SolverResult};
use rand::seq::SliceRandom;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
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
    pub num_sessions: u32,

    // --- Scoring Data ---
    pub contact_matrix: Vec<Vec<u32>>,
    pub unique_contacts: i32,
    pub repetition_penalty: i32,
    pub gender_balance_penalty: i32,
    pub constraint_penalty: i32,

    // --- Weights ---
    pub w_contacts: f64,
    pub w_repetition: f64,
    pub w_gender: f64,
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
        if let Some(objective) = input
            .objectives
            .iter()
            .find(|o| o.r#type == "minimize_repetition_penalty")
        {
            w_repetition = objective.weight;
        }

        let mut w_gender = 0.0;
        for constraint in &input.constraints {
            match constraint {
                Constraint::AttributeBalance(params) => w_gender = params.penalty_weight,
                // NOTE: RepeatEncounter constraint is not fully implemented.
                // Penalty weight should be set via "minimize_repetition_penalty" objective.
                _ => (),
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
            schedule,
            locations,
            person_attributes,
            attribute_balance_constraints,
            cliques: vec![], // To be populated by preprocessing
            person_to_clique_id: vec![None; people_count], // To be populated
            forbidden_pairs: vec![], // To be populated
            num_sessions: input.problem.num_sessions,
            contact_matrix: vec![vec![0; people_count]; people_count],
            unique_contacts: 0,
            repetition_penalty: 0,
            gender_balance_penalty: 0,
            constraint_penalty: 0,
            w_contacts,
            w_repetition,
            w_gender,
            w_constraint: 1000.0, // Hardcoded high weight for constraint violations
        };

        state._preprocess_and_validate_constraints(input)?;

        // --- Initialize with a random assignment (clique-aware) ---
        let mut rng = rand::rng();
        let mut unassigned_people: Vec<usize> = (0..people_count)
            .filter(|p| state.person_to_clique_id[*p].is_none())
            .collect();
        unassigned_people.shuffle(&mut rng);

        for day_schedule in state.schedule.iter_mut() {
            let mut assigned_in_day = vec![false; people_count];
            let mut group_cursors = vec![0; group_count];

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

        state.recalculate_locations_from_schedule();
        state.recalculate_scores();
        Ok(state)
    }

    fn _preprocess_and_validate_constraints(
        &mut self,
        input: &ApiInput,
    ) -> Result<(), SolverError> {
        let max_group_size = input
            .problem
            .groups
            .iter()
            .map(|g| g.size)
            .max()
            .unwrap_or(0) as usize;
        let people_count = self.person_id_to_idx.len();

        // --- 1. Process MustStayTogether constraints and merge cliques ---
        let mut dsu = DSU::new(people_count);
        let mut cliques_from_constraints: Vec<Vec<usize>> = Vec::new();

        for constraint in &input.constraints {
            if let Constraint::MustStayTogether { people } = constraint {
                let clique: Vec<usize> =
                    people.iter().map(|id| self.person_id_to_idx[id]).collect();
                for i in 0..(clique.len() - 1) {
                    dsu.union(clique[i], clique[i + 1]);
                }
                cliques_from_constraints.push(clique);
            }
        }

        let mut merged_cliques: HashMap<usize, Vec<usize>> = HashMap::new();
        for i in 0..people_count {
            let root = dsu.find(i);
            merged_cliques.entry(root).or_default().push(i);
        }

        self.cliques = merged_cliques
            .into_values()
            .filter(|c| c.len() > 1)
            .collect();

        // --- 2. Validate clique sizes and populate person_to_clique_id map ---
        for (clique_id, clique) in self.cliques.iter().enumerate() {
            if clique.len() > max_group_size {
                let member_ids: Vec<String> = clique
                    .iter()
                    .map(|p_idx| self.person_idx_to_id[*p_idx].clone())
                    .collect();
                return Err(SolverError::ValidationError(format!(
                    "Clique {:?} is larger than any available group.",
                    member_ids
                )));
            }
            for &person_idx in clique {
                self.person_to_clique_id[person_idx] = Some(clique_id);
            }
        }

        // --- 3. Process and validate CannotBeTogether constraints ---
        for constraint in &input.constraints {
            if let Constraint::CannotBeTogether { people } = constraint {
                let person_indices: Vec<usize> =
                    people.iter().map(|id| self.person_id_to_idx[id]).collect();
                for i in 0..person_indices.len() {
                    for j in (i + 1)..person_indices.len() {
                        let p1_idx = person_indices[i];
                        let p2_idx = person_indices[j];

                        // Validate against cliques
                        if let (Some(c1), Some(c2)) = (
                            self.person_to_clique_id[p1_idx],
                            self.person_to_clique_id[p2_idx],
                        ) {
                            if c1 == c2 {
                                return Err(SolverError::ValidationError(format!(
                                    "Forbidden pair ({}, {}) exists within the same clique.",
                                    self.person_idx_to_id[p1_idx], self.person_idx_to_id[p2_idx]
                                )));
                            }
                        }
                        self.forbidden_pairs.push((p1_idx, p2_idx));
                    }
                }
            }
        }

        Ok(())
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
    pub(crate) fn _calculate_score_delta(
        &self,
        day: usize,
        p1_idx: usize,
        p2_idx: usize,
    ) -> (i32, i32, i32, i32) {
        let (g1_idx, _) = self.locations[day][p1_idx];
        let (g2_idx, _) = self.locations[day][p2_idx];

        if g1_idx == g2_idx {
            return (0, 0, 0, 0);
        }

        let mut contact_delta = 0;
        let mut repetition_delta = 0;

        // --- Contact & Repetition Delta ---
        let g1_members = &self.schedule[day][g1_idx];
        let g2_members = &self.schedule[day][g2_idx];

        // Step 1: Account for broken contacts in original groups
        for &member_idx in g1_members {
            if member_idx == p1_idx {
                continue;
            }
            let (cd, rd) = self._get_contact_deltas_for_pair(p1_idx, member_idx, -1);
            contact_delta += cd;
            repetition_delta += rd;
        }
        for &member_idx in g2_members {
            if member_idx == p2_idx {
                continue;
            }
            let (cd, rd) = self._get_contact_deltas_for_pair(p2_idx, member_idx, -1);
            contact_delta += cd;
            repetition_delta += rd;
        }

        // Step 2: Account for formed contacts in new groups
        for &member_idx in g1_members {
            if member_idx == p1_idx {
                continue;
            }
            let (cd, rd) = self._get_contact_deltas_for_pair(p2_idx, member_idx, 1);
            contact_delta += cd;
            repetition_delta += rd;
        }
        for &member_idx in g2_members {
            if member_idx == p2_idx {
                continue;
            }
            let (cd, rd) = self._get_contact_deltas_for_pair(p1_idx, member_idx, 1);
            contact_delta += cd;
            repetition_delta += rd;
        }

        // --- Gender Balance Delta ---
        let mut gender_balance_delta = 0;
        // The logic for calculating gender balance delta needs to be correct.
        // It should calculate the state before and after the swap for the two affected groups.
        let g1_before = g1_members;
        let g2_before = g2_members;

        // Create a temporary representation of the groups *after* the swap
        let mut g1_after: Vec<usize> = g1_members
            .iter()
            .filter(|&&p| p != p1_idx)
            .cloned()
            .collect();
        g1_after.push(p2_idx);

        let mut g2_after: Vec<usize> = g2_members
            .iter()
            .filter(|&&p| p != p2_idx)
            .cloned()
            .collect();
        g2_after.push(p1_idx);

        let penalty_before = self._calculate_one_group_gender_penalty(g1_before)
            + self._calculate_one_group_gender_penalty(g2_before);
        let penalty_after = self._calculate_one_group_gender_penalty(&g1_after)
            + self._calculate_one_group_gender_penalty(&g2_after);

        gender_balance_delta = penalty_after - penalty_before;

        // --- Constraint Violation Delta ---
        let mut constraint_penalty_delta = 0;
        let p1_group = g1_members;
        let p2_group = g2_members;

        for &(f1, f2) in &self.forbidden_pairs {
            let p1f1 = p1_idx == f1;
            let p1f2 = p1_idx == f2;
            let p2f1 = p2_idx == f1;
            let p2f2 = p2_idx == f2;

            // Check if p1 moves into a group with its forbidden partner (f2)
            if (p1f1 && p2_group.contains(&f2)) || (p1f2 && p2_group.contains(&f1)) {
                constraint_penalty_delta += 1;
            }
            // Check if p1 moves out of a group with its forbidden partner (f2)
            if (p1f1 && p1_group.contains(&f2)) || (p1f2 && p1_group.contains(&f1)) {
                constraint_penalty_delta -= 1;
            }
            // Check if p2 moves into a group with its forbidden partner (f1)
            if (p2f1 && p1_group.contains(&f2)) || (p2f2 && p1_group.contains(&f1)) {
                constraint_penalty_delta += 1;
            }
            // Check if p2 moves out of a group with its forbidden partner (f1)
            if (p2f1 && p2_group.contains(&f2)) || (p2f2 && p2_group.contains(&f1)) {
                constraint_penalty_delta -= 1;
            }
        }

        (
            contact_delta,
            repetition_delta,
            gender_balance_delta,
            constraint_penalty_delta,
        )
    }

    /// Swaps two people within the schedule for a given day.
    pub(crate) fn swap_people(&mut self, day: usize, p1_idx: usize, p2_idx: usize) {
        let (g1_idx, v1_idx) = self.locations[day][p1_idx];
        let (g2_idx, v2_idx) = self.locations[day][p2_idx];

        if g1_idx == g2_idx {
            return; // No need to swap if they are in the same group
        }

        // Direct swap in the schedule vector
        self.schedule[day][g1_idx][v1_idx] = p2_idx;
        self.schedule[day][g2_idx][v2_idx] = p1_idx;

        // Update the locations to match
        self.locations[day][p1_idx] = (g2_idx, v2_idx);
        self.locations[day][p2_idx] = (g1_idx, v1_idx);
    }

    /// Applies a swap to the state and updates the scores using pre-calculated deltas.
    pub(crate) fn _apply_swap(
        &mut self,
        day: usize,
        p1_idx: usize,
        p2_idx: usize,
        (contact_delta, repetition_delta, gender_balance_delta, constraint_penalty_delta): (
            i32,
            i32,
            i32,
            i32,
        ),
    ) {
        let (g1_idx, p1_vec_idx) = self.locations[day][p1_idx];
        let (g2_idx, p2_vec_idx) = self.locations[day][p2_idx];

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
        self.constraint_penalty += constraint_penalty_delta;
    }

    pub(crate) fn _calculate_multi_swap_delta(
        &self,
        day: usize,
        people_from_g1: &[usize],
        people_from_g2: &[usize],
    ) -> (i32, i32, i32, i32) {
        let mut contact_delta = 0;
        let mut repetition_delta = 0;
        let mut gender_balance_delta = 0;
        let mut constraint_penalty_delta = 0;

        let g1_idx = self.locations[day][people_from_g1[0]].0;
        let g2_idx = self.locations[day][people_from_g2[0]].0;

        // --- 1. Contact and Repetition Deltas ---
        let g1_stayers: Vec<usize> = self.schedule[day][g1_idx]
            .iter()
            .cloned()
            .filter(|p| !people_from_g1.contains(p))
            .collect();
        let g2_stayers: Vec<usize> = self.schedule[day][g2_idx]
            .iter()
            .cloned()
            .filter(|p| !people_from_g2.contains(p))
            .collect();

        // Pairs broken in g1, formed with g2 stayers
        for &p1 in people_from_g1 {
            for &p2 in &g1_stayers {
                // broken
                let (cd, rd) = self._get_contact_deltas_for_pair(p1, p2, -1);
                contact_delta += cd;
                repetition_delta += rd;
            }
            for &p2 in &g2_stayers {
                // formed
                let (cd, rd) = self._get_contact_deltas_for_pair(p1, p2, 1);
                contact_delta += cd;
                repetition_delta += rd;
            }
        }
        // Pairs broken in g2, formed with g1 stayers
        for &p1 in people_from_g2 {
            for &p2 in &g2_stayers {
                // broken
                let (cd, rd) = self._get_contact_deltas_for_pair(p1, p2, -1);
                contact_delta += cd;
                repetition_delta += rd;
            }
            for &p2 in &g1_stayers {
                // formed
                let (cd, rd) = self._get_contact_deltas_for_pair(p1, p2, 1);
                contact_delta += cd;
                repetition_delta += rd;
            }
        }
        // Pairs formed between the two moving groups
        for &p1 in people_from_g1 {
            for &p2 in people_from_g2 {
                let (cd, rd) = self._get_contact_deltas_for_pair(p1, p2, 1);
                contact_delta += cd;
                repetition_delta += rd;
            }
        }

        // --- 2. Gender and Constraint Deltas (Before/After) ---
        let g1_before = &self.schedule[day][g1_idx];
        let g2_before = &self.schedule[day][g2_idx];

        let g1_after: Vec<usize> = g1_stayers
            .iter()
            .cloned()
            .chain(people_from_g2.iter().cloned())
            .collect();
        let g2_after: Vec<usize> = g2_stayers
            .iter()
            .cloned()
            .chain(people_from_g1.iter().cloned())
            .collect();

        let gender_before = self._calculate_one_group_gender_penalty(g1_before)
            + self._calculate_one_group_gender_penalty(g2_before);
        let gender_after = self._calculate_one_group_gender_penalty(&g1_after)
            + self._calculate_one_group_gender_penalty(&g2_after);
        gender_balance_delta = gender_after - gender_before;

        let mut constraints_before = 0;
        let mut constraints_after = 0;
        for &(p1, p2) in &self.forbidden_pairs {
            if g1_before.contains(&p1) && g1_before.contains(&p2) {
                constraints_before += 1;
            }
            if g2_before.contains(&p1) && g2_before.contains(&p2) {
                constraints_before += 1;
            }
            if g1_after.contains(&p1) && g1_after.contains(&p2) {
                constraints_after += 1;
            }
            if g2_after.contains(&p1) && g2_after.contains(&p2) {
                constraints_after += 1;
            }
        }
        constraint_penalty_delta = constraints_after - constraints_before;

        (
            contact_delta,
            repetition_delta,
            gender_balance_delta,
            constraint_penalty_delta,
        )
    }

    // Helper to get contact/repetition deltas for a single pair
    fn _get_contact_deltas_for_pair(&self, p1: usize, p2: usize, change: i32) -> (i32, i32) {
        let mut contact_delta = 0;
        let repetition_delta;

        let current_contacts = self.contact_matrix[p1][p2];
        let new_contacts = (current_contacts as i32 + change) as u32;

        if change > 0 {
            // Gaining contact
            if current_contacts == 0 {
                contact_delta += 1;
            }
        } else {
            // Losing contact
            if new_contacts == 0 {
                contact_delta -= 1;
            }
        }

        repetition_delta = (new_contacts.saturating_sub(1).pow(2) as i32)
            - (current_contacts.saturating_sub(1).pow(2) as i32);

        (contact_delta, repetition_delta)
    }

    pub(crate) fn _apply_multi_swap(
        &mut self,
        day: usize,
        g1_idx: usize,
        g2_idx: usize,
        people_from_g1: &[usize],
        people_from_g2: &[usize],
        deltas: (i32, i32, i32, i32),
    ) {
        // --- 1. Update contact matrix ---
        let g1_stayers: Vec<usize> = self.schedule[day][g1_idx]
            .iter()
            .cloned()
            .filter(|p| !people_from_g1.contains(p))
            .collect();
        let g2_stayers: Vec<usize> = self.schedule[day][g2_idx]
            .iter()
            .cloned()
            .filter(|p| !people_from_g2.contains(p))
            .collect();

        // Pairs broken
        for &p1 in people_from_g1 {
            for &p2 in &g1_stayers {
                self.contact_matrix[p1][p2] -= 1;
                self.contact_matrix[p2][p1] -= 1;
            }
        }
        for &p1 in people_from_g2 {
            for &p2 in &g2_stayers {
                self.contact_matrix[p1][p2] -= 1;
                self.contact_matrix[p2][p1] -= 1;
            }
        }
        // Pairs formed
        for &p1 in people_from_g1 {
            for &p2 in &g2_stayers {
                self.contact_matrix[p1][p2] += 1;
                self.contact_matrix[p2][p1] += 1;
            }
        }
        for &p1 in people_from_g2 {
            for &p2 in &g1_stayers {
                self.contact_matrix[p1][p2] += 1;
                self.contact_matrix[p2][p1] += 1;
            }
        }
        for &p1 in people_from_g1 {
            for &p2 in people_from_g2 {
                self.contact_matrix[p1][p2] += 1;
                self.contact_matrix[p2][p1] += 1;
            }
        }

        // --- 2. Update schedule ---
        self.schedule[day][g1_idx].retain(|p| !people_from_g1.contains(p));
        self.schedule[day][g2_idx].retain(|p| !people_from_g2.contains(p));
        self.schedule[day][g1_idx].extend_from_slice(people_from_g2);
        self.schedule[day][g2_idx].extend_from_slice(people_from_g1);

        // --- 3. Update locations for affected groups ---
        self.recalculate_locations_for_groups(day, &[g1_idx, g2_idx]);

        // --- 4. Update scores ---
        self.unique_contacts += deltas.0;
        self.repetition_penalty += deltas.1;
        self.gender_balance_penalty += deltas.2;
        self.constraint_penalty += deltas.3;
    }

    /// Recalculates all score components from scratch based on the current schedule.
    /// This is expensive and should only be used for initialization, debugging, or validation.
    pub fn _recalculate_scores(&mut self) {
        self.unique_contacts = 0;
        self.repetition_penalty = 0;
        self.gender_balance_penalty = 0;
        self.constraint_penalty = 0;
        self.contact_matrix =
            vec![vec![0; self.person_id_to_idx.len()]; self.person_id_to_idx.len()];

        self.recalculate_locations_from_schedule();

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

    fn recalculate_locations_for_groups(&mut self, day: usize, group_indices: &[usize]) {
        for &g_idx in group_indices {
            for (pos, &p_idx) in self.schedule[day][g_idx].iter().enumerate() {
                self.locations[day][p_idx] = (g_idx, pos);
            }
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
            unique_contacts: self.unique_contacts,
            repetition_penalty: self.repetition_penalty,
            gender_balance_penalty: self.gender_balance_penalty,
            constraint_penalty: self.constraint_penalty,
        }
    }

    /// Calculates the overall weighted score based on the current state.
    pub(crate) fn weighted_score(&self) -> f64 {
        self.unique_contacts as f64 * self.w_contacts
            - self.repetition_penalty as f64 * self.w_repetition
            - self.gender_balance_penalty as f64 * self.w_gender
            - self.constraint_penalty as f64 * self.w_constraint
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
        let mut input = create_test_input(6, vec![(2, 3)], 2);
        let mut state = State::new(&input).unwrap();
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
        let mut input = create_test_input(6, vec![(2, 3)], 2);
        let mut state = State::new(&input).unwrap();

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
        let deltas = state._calculate_score_delta(0, 2, 3);
        state._apply_swap(0, 2, 3, deltas);

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
            assert!(msg.contains("exists within the same clique"));
        } else {
            panic!("Expected a ValidationError");
        }
    }
}
