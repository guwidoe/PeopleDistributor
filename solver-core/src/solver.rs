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
    // Session-specific constraint data (None means all sessions)
    pub clique_sessions: Vec<Option<Vec<usize>>>, // Which sessions each clique applies to
    pub forbidden_pair_sessions: Vec<Option<Vec<usize>>>, // Which sessions each forbidden pair applies to
    pub num_sessions: u32,

    // --- Scoring Data ---
    pub contact_matrix: Vec<Vec<u32>>,
    pub unique_contacts: i32,
    pub repetition_penalty: i32,
    pub attribute_balance_penalty: f64,
    pub constraint_penalty: i32, // Kept for backward compatibility, but now calculated as sum
    // --- Individual Constraint Penalties (unweighted counts) ---
    pub clique_violations: Vec<i32>,         // Violations per clique
    pub forbidden_pair_violations: Vec<i32>, // Violations per forbidden pair
    pub immovable_violations: i32,           // Total immovable person violations

    // --- Weights ---
    pub w_contacts: f64,
    pub w_repetition: f64,
    pub clique_weights: Vec<f64>,         // Weight for each clique
    pub forbidden_pair_weights: Vec<f64>, // Weight for each forbidden pair
}

impl State {
    pub fn new(input: &ApiInput) -> Result<Self, SolverError> {
        // --- Pre-validation ---
        let people_count = input.problem.people.len();
        let total_capacity: u32 = input.problem.groups.iter().map(|g| g.size).sum();
        if (people_count as u32) > total_capacity {
            return Err(SolverError::ValidationError(format!(
                "Not enough group capacity for all people. People: {}, Capacity: {}",
                people_count, total_capacity
            )));
        }

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
            clique_sessions: vec![], // To be populated by preprocessing
            forbidden_pair_sessions: vec![], // To be populated by preprocessing
            num_sessions: input.problem.num_sessions,
            contact_matrix: vec![vec![0; people_count]; people_count],
            unique_contacts: 0,
            repetition_penalty: 0,
            attribute_balance_penalty: 0.0,
            constraint_penalty: 0,
            clique_violations: Vec::new(), // Will be resized after constraint preprocessing
            forbidden_pair_violations: Vec::new(), // Will be resized after constraint preprocessing
            immovable_violations: 0,
            w_contacts,
            w_repetition,
            clique_weights: Vec::new(),
            forbidden_pair_weights: Vec::new(),
        };

        state._preprocess_and_validate_constraints(input)?;

        // --- Initialize with a random assignment (clique-aware) ---
        let mut rng = rand::rng();

        for (day, day_schedule) in state.schedule.iter_mut().enumerate() {
            let mut group_cursors = vec![0; group_count];
            let mut assigned_in_day = vec![false; people_count];

            // --- Step 1: Place all immovable people first ---
            for (person_idx, group_idx) in state
                .immovable_people
                .iter()
                .filter(|((_, s_idx), _)| *s_idx == day)
                .map(|((p_idx, _), g_idx)| (*p_idx, *g_idx))
            {
                if assigned_in_day[person_idx] {
                    continue;
                } // Already placed as part of a clique

                let group_size = input.problem.groups[group_idx].size as usize;
                if group_cursors[group_idx] < group_size {
                    // If this person is in a clique, we must place the whole clique
                    if let Some(clique_id) = state.person_to_clique_id[person_idx] {
                        let clique = &state.cliques[clique_id];
                        if group_cursors[group_idx] + clique.len() <= group_size {
                            for &p_in_clique in clique {
                                day_schedule[group_idx].push(p_in_clique);
                                assigned_in_day[p_in_clique] = true;
                            }
                            group_cursors[group_idx] += clique.len();
                        } else {
                            return Err(SolverError::ValidationError(format!(
                                "Not enough space for immovable clique."
                            )));
                        }
                    } else {
                        // Just a single immovable person
                        day_schedule[group_idx].push(person_idx);
                        assigned_in_day[person_idx] = true;
                        group_cursors[group_idx] += 1;
                    }
                } else {
                    return Err(SolverError::ValidationError(format!(
                        "Not enough space for immovable person."
                    )));
                }
            }

            // --- Step 2: Place remaining cliques ---
            let mut potential_cliques: Vec<&Vec<usize>> = state.cliques.iter().collect();
            potential_cliques.shuffle(&mut rng);
            for clique in potential_cliques {
                if assigned_in_day[clique[0]] {
                    continue;
                } // Already placed (e.g. part of immovable)

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
                    return Err(SolverError::ValidationError(format!(
                        "Could not place clique"
                    )));
                }
            }

            // --- Step 3: Place all remaining individuals ---
            let mut unassigned_people: Vec<usize> =
                (0..people_count).filter(|p| !assigned_in_day[*p]).collect();
            unassigned_people.shuffle(&mut rng);

            for person_idx in unassigned_people {
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
                if !placed {
                    return Err(SolverError::ValidationError(format!(
                        "Could not place person"
                    )));
                }
            }
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
            if let Constraint::MustStayTogether {
                people,
                penalty_weight: _,
                sessions: _,
            } = constraint
            {
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
        self.clique_weights = Vec::new();
        self.clique_sessions = Vec::new();
        let mut clique_id_counter = 0;
        for (_, clique_members) in cliques {
            if clique_members.len() < 2 {
                continue;
            }

            // Check if the clique is too large for any available group
            let max_group_size = input
                .problem
                .groups
                .iter()
                .map(|g| g.size)
                .max()
                .unwrap_or(0) as usize;
            if clique_members.len() > max_group_size {
                let member_ids: Vec<String> = clique_members
                    .iter()
                    .map(|id| self.person_idx_to_id[*id].clone())
                    .collect();
                return Err(SolverError::ValidationError(format!(
                    "Clique {:?} (size {}) is larger than any available group (max size: {})",
                    member_ids,
                    clique_members.len(),
                    max_group_size
                )));
            }

            // Find the constraint weight and sessions for this clique
            let mut clique_weight = 1000.0;
            let mut clique_sessions_opt = None;

            for constraint in &input.constraints {
                if let Constraint::MustStayTogether {
                    people,
                    penalty_weight,
                    sessions,
                } = constraint
                {
                    // Check if this constraint applies to this clique
                    let constraint_person_indices: Vec<usize> = people
                        .iter()
                        .filter_map(|p| self.person_id_to_idx.get(p))
                        .cloned()
                        .collect();

                    if constraint_person_indices
                        .iter()
                        .any(|&p| clique_members.contains(&p))
                    {
                        clique_weight = *penalty_weight;
                        clique_sessions_opt = sessions.clone();
                        break;
                    }
                }
            }

            for &member in &clique_members {
                person_to_clique_id[member] = Some(clique_id_counter);
            }
            self.cliques.push(clique_members);
            self.clique_weights.push(clique_weight);

            // Convert sessions to indices if provided
            if let Some(sessions) = clique_sessions_opt {
                let session_indices: Vec<usize> = sessions.iter().map(|&s| s as usize).collect();
                self.clique_sessions.push(Some(session_indices));
            } else {
                self.clique_sessions.push(None); // Apply to all sessions
            }

            clique_id_counter += 1;
        }
        self.person_to_clique_id = person_to_clique_id;

        // --- Process `CannotBeTogether` (Forbidden Pairs) ---
        for constraint in &input.constraints {
            if let Constraint::CannotBeTogether {
                people,
                penalty_weight,
                sessions: constraint_sessions,
            } = constraint
            {
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
                                let clique_member_ids: Vec<String> = self.cliques[c1]
                                    .iter()
                                    .map(|id| self.person_idx_to_id[*id].clone())
                                    .collect();
                                return Err(SolverError::ValidationError(format!(
                                    "CannotBeTogether constraint conflicts with MustStayTogether: people {:?} are in the same clique {:?}",
                                    people, clique_member_ids
                                )));
                            }
                        }

                        self.forbidden_pairs.push((p1_idx, p2_idx));
                        self.forbidden_pair_weights.push(*penalty_weight);

                        // Convert sessions to indices if provided
                        if let Some(sessions) = constraint_sessions {
                            let session_indices: Vec<usize> =
                                sessions.iter().map(|&s| s as usize).collect();
                            self.forbidden_pair_sessions.push(Some(session_indices));
                        } else {
                            self.forbidden_pair_sessions.push(None); // Apply to all sessions
                        }
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

        // Initialize constraint violation vectors with correct sizes
        self.clique_violations = vec![0; self.cliques.len()];
        self.forbidden_pair_violations = vec![0; self.forbidden_pairs.len()];

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

        // --- Individual Constraint Penalties ---
        self._recalculate_constraint_penalty();
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

    /// Calculates the overall cost of the current state, which the optimizer will try to minimize.
    /// It combines maximizing unique contacts (by negating it) and minimizing penalties.
    pub(crate) fn calculate_cost(&self) -> f64 {
        // Calculate weighted constraint penalty
        let mut weighted_constraint_penalty = 0.0;
        let mut violation_count = 0;

        for day_schedule in &self.schedule {
            for group in day_schedule {
                for (pair_idx, &(p1, p2)) in self.forbidden_pairs.iter().enumerate() {
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
                        weighted_constraint_penalty += self.forbidden_pair_weights[pair_idx];
                        violation_count += 1;
                    }
                }
            }
        }

        // Verify the unweighted count matches our cached value
        debug_assert_eq!(violation_count, self.constraint_penalty);

        (self.repetition_penalty as f64 * self.w_repetition)
            + self.attribute_balance_penalty
            + weighted_constraint_penalty
            - (self.unique_contacts as f64 * self.w_contacts)
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
        // Reset all constraint penalties
        for violation in &mut self.clique_violations {
            *violation = 0;
        }
        for violation in &mut self.forbidden_pair_violations {
            *violation = 0;
        }
        self.immovable_violations = 0;

        // Calculate forbidden pair violations
        for (day_idx, day_schedule) in self.schedule.iter().enumerate() {
            for group in day_schedule {
                for (pair_idx, &(p1, p2)) in self.forbidden_pairs.iter().enumerate() {
                    // Check if this forbidden pair applies to this session
                    if let Some(ref sessions) = self.forbidden_pair_sessions[pair_idx] {
                        if !sessions.contains(&day_idx) {
                            continue; // Skip this constraint for this session
                        }
                    }
                    // If sessions is None, apply to all sessions

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
                        self.forbidden_pair_violations[pair_idx] += 1;
                    }
                }
            }
        }

        // Calculate clique violations (when clique members are separated)
        for (clique_idx, clique) in self.cliques.iter().enumerate() {
            for (day_idx, day_schedule) in self.schedule.iter().enumerate() {
                // Check if this clique applies to this session
                if let Some(ref sessions) = self.clique_sessions[clique_idx] {
                    if !sessions.contains(&day_idx) {
                        continue; // Skip this constraint for this session
                    }
                }
                // If sessions is None, apply to all sessions

                let mut group_counts = vec![0; day_schedule.len()];

                // Count how many clique members are in each group
                for &member in clique {
                    let (group_idx, _) = self.locations[day_idx][member];
                    group_counts[group_idx] += 1;
                }

                // Count violations: total clique members minus the largest group
                let max_in_one_group = *group_counts.iter().max().unwrap_or(&0);
                let separated_members = clique.len() as i32 - max_in_one_group;
                self.clique_violations[clique_idx] += separated_members;
            }
        }

        // Calculate immovable person violations
        for ((person_idx, session_idx), required_group_idx) in &self.immovable_people {
            let (actual_group_idx, _) = self.locations[*session_idx][*person_idx];
            if actual_group_idx != *required_group_idx {
                self.immovable_violations += 1;
            }
        }

        // Update the legacy constraint_penalty field for backward compatibility
        self.constraint_penalty = self.forbidden_pair_violations.iter().sum::<i32>()
            + self.clique_violations.iter().sum::<i32>()
            + self.immovable_violations;
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

    /// Calculates the change in the total cost function if a swap were to be performed.
    /// A negative delta indicates an improvement (a lower cost).
    pub fn calculate_swap_cost_delta(&self, day: usize, p1_idx: usize, p2_idx: usize) -> f64 {
        let (g1_idx, _) = self.locations[day][p1_idx];
        let (g2_idx, _) = self.locations[day][p2_idx];

        if g1_idx == g2_idx {
            return 0.0;
        }

        let mut delta_cost = 0.0;

        // --- Contact/Repetition Delta ---
        let g1_members = &self.schedule[day][g1_idx];
        let g2_members = &self.schedule[day][g2_idx];

        // --- Changes for p1 (loses contacts with g1, gains with g2) ---
        for &member in g1_members.iter() {
            if member == p1_idx {
                continue;
            }
            let count = self.contact_matrix[p1_idx][member];
            if count > 0 {
                // Repetition penalty change: (new_penalty - old_penalty)
                delta_cost += self.w_repetition
                    * ((count as i32 - 2).pow(2) - (count as i32 - 1).pow(2)) as f64;
                if count == 1 {
                    // Unique contacts: losing one, so cost increases
                    delta_cost += self.w_contacts;
                }
            }
        }
        for &member in g2_members.iter() {
            if member == p2_idx {
                continue;
            }
            let count = self.contact_matrix[p1_idx][member];
            // Repetition penalty change: (new_penalty - old_penalty)
            delta_cost +=
                self.w_repetition * ((count as i32).pow(2) - (count as i32 - 1).pow(2)) as f64;
            if count == 0 {
                // Unique contacts: gaining one, so cost decreases
                delta_cost -= self.w_contacts;
            }
        }

        // --- Changes for p2 (loses contacts with g2, gains with g1) ---
        for &member in g2_members.iter() {
            if member == p2_idx {
                continue;
            }
            let count = self.contact_matrix[p2_idx][member];
            if count > 0 {
                delta_cost += self.w_repetition
                    * ((count as i32 - 2).pow(2) - (count as i32 - 1).pow(2)) as f64;
                if count == 1 {
                    delta_cost += self.w_contacts;
                }
            }
        }
        for &member in g1_members.iter() {
            if member == p1_idx {
                continue;
            }
            let count = self.contact_matrix[p2_idx][member];
            delta_cost +=
                self.w_repetition * ((count as i32).pow(2) - (count as i32 - 1).pow(2)) as f64;
            if count == 0 {
                delta_cost -= self.w_contacts;
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

            let delta_penalty =
                (new_penalty_g1 + new_penalty_g2) - (old_penalty_g1 + old_penalty_g2);
            delta_cost += delta_penalty * ac.penalty_weight;
        }

        // Hard Constraint Delta - Cliques
        if let Some(c_id) = self.person_to_clique_id[p1_idx] {
            let clique = &self.cliques[c_id];
            // If p2 is not in the same clique, this swap would break the clique
            if self.person_to_clique_id[p2_idx] != Some(c_id) {
                delta_cost += self.clique_weights[c_id] * clique.len() as f64;
            }
        } else if let Some(c_id) = self.person_to_clique_id[p2_idx] {
            // Same logic if p2 is in a clique and p1 is not
            let clique = &self.cliques[c_id];
            if self.person_to_clique_id[p1_idx] != Some(c_id) {
                delta_cost += self.clique_weights[c_id] * clique.len() as f64;
            }
        }

        // Hard Constraint Delta - Forbidden Pairs
        for (pair_idx, &(p1, p2)) in self.forbidden_pairs.iter().enumerate() {
            let p1_is_swapped = p1_idx == p1 || p2_idx == p1;
            let p2_is_swapped = p1_idx == p2 || p2_idx == p2;

            // If the pair is not involved in the swap, no change
            if !p1_is_swapped && !p2_is_swapped {
                continue;
            }

            let pair_weight = self.forbidden_pair_weights[pair_idx];

            // Penalty before swap
            if g1_members.contains(&p1) && g1_members.contains(&p2) {
                delta_cost -= pair_weight;
            }
            if g2_members.contains(&p1) && g2_members.contains(&p2) {
                delta_cost -= pair_weight;
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
                delta_cost += pair_weight;
            }
            if next_g2_members.contains(&p1) && next_g2_members.contains(&p2) {
                delta_cost += pair_weight;
            }
        }

        delta_cost
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
            if count > 0 {
                // This pair is losing a contact
                if count > 1 {
                    self.repetition_penalty -= (count as i32 - 1).pow(2);
                }
                if count > 2 {
                    self.repetition_penalty += (count as i32 - 2).pow(2);
                }
                if count == 1 {
                    self.unique_contacts -= 1;
                }
                self.contact_matrix[p1_idx][member] -= 1;
                self.contact_matrix[member][p1_idx] -= 1;
            }
        }
        for &member in g2_members.iter() {
            if member == p2_idx {
                continue;
            }
            let count = self.contact_matrix[p1_idx][member];
            // This pair is gaining a contact
            if count > 0 {
                self.repetition_penalty -= (count as i32 - 1).pow(2);
            }
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
            if count > 0 {
                // This pair is losing a contact
                if count > 1 {
                    self.repetition_penalty -= (count as i32 - 1).pow(2);
                }
                if count > 2 {
                    self.repetition_penalty += (count as i32 - 2).pow(2);
                }
                if count == 1 {
                    self.unique_contacts -= 1;
                }
                self.contact_matrix[p2_idx][member] -= 1;
                self.contact_matrix[member][p2_idx] -= 1;
            }
        }
        for &member in g1_members.iter() {
            if member == p1_idx {
                continue;
            }
            let count = self.contact_matrix[p2_idx][member];
            // This pair is gaining a contact
            if count > 0 {
                self.repetition_penalty -= (count as i32 - 1).pow(2);
            }
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

    pub fn validate_scores(&mut self) {
        // 1. Store the scores calculated incrementally
        let cached_unique_contacts = self.unique_contacts;
        let cached_repetition_penalty = self.repetition_penalty;
        let cached_attribute_balance_penalty = self.attribute_balance_penalty;
        let cached_constraint_penalty = self.constraint_penalty;

        // 2. Perform a full recalculation from the schedule
        self._recalculate_scores();

        // 3. Store the freshly calculated scores
        let fresh_unique_contacts = self.unique_contacts;
        let fresh_repetition_penalty = self.repetition_penalty;
        let fresh_attribute_balance_penalty = self.attribute_balance_penalty;
        let fresh_constraint_penalty = self.constraint_penalty;

        // 4. Compare and collect errors
        let mut errors = Vec::new();

        if cached_unique_contacts != fresh_unique_contacts {
            errors.push(format!(
                "Unique Contacts mismatch: cached={}, recalculated={}",
                cached_unique_contacts, fresh_unique_contacts
            ));
        }

        if cached_repetition_penalty != fresh_repetition_penalty {
            errors.push(format!(
                "Repetition Penalty mismatch: cached={}, recalculated={}",
                cached_repetition_penalty, fresh_repetition_penalty
            ));
        }

        if (cached_attribute_balance_penalty - fresh_attribute_balance_penalty).abs() > 1e-9 {
            errors.push(format!(
                "Attribute Balance Penalty mismatch: cached={}, recalculated={}",
                cached_attribute_balance_penalty, fresh_attribute_balance_penalty
            ));
        }

        if cached_constraint_penalty != fresh_constraint_penalty {
            errors.push(format!(
                "Constraint Penalty mismatch: cached={}, recalculated={}",
                cached_constraint_penalty, fresh_constraint_penalty
            ));
        }

        // 5. Restore the original incremental scores so the original output is preserved
        self.unique_contacts = cached_unique_contacts;
        self.repetition_penalty = cached_repetition_penalty;
        self.attribute_balance_penalty = cached_attribute_balance_penalty;
        self.constraint_penalty = cached_constraint_penalty;

        // 6. Panic if any errors were found
        if !errors.is_empty() {
            panic!(
                "Score validation failed!\n{}\nFinal State: {:?}",
                errors.join("\n"),
                self
            );
        }
    }

    /// Formats the current score breakdown as a well-structured multi-line format
    pub fn format_score_breakdown(&self) -> String {
        let mut breakdown = format!(
            "Score Breakdown:\n  UniqueContacts: {} (weight: {:.1})\n  RepetitionPenalty: {} (weight: {:.1})\n  AttributeBalancePenalty: {:.2}",
            self.unique_contacts,
            self.w_contacts,
            self.repetition_penalty,
            self.w_repetition,
            self.attribute_balance_penalty
        );

        // Add individual constraint penalties
        let mut has_constraints = false;

        // Forbidden pair violations
        for (pair_idx, &violation_count) in self.forbidden_pair_violations.iter().enumerate() {
            if violation_count > 0 {
                let weight = self.forbidden_pair_weights[pair_idx];
                breakdown.push_str(&format!(
                    "\n  CannotBeTogether[{}]: {} (weight: {:.1})",
                    pair_idx, violation_count, weight
                ));
                has_constraints = true;
            }
        }

        // Clique violations
        for (clique_idx, &violation_count) in self.clique_violations.iter().enumerate() {
            if violation_count > 0 {
                let weight = self.clique_weights[clique_idx];
                breakdown.push_str(&format!(
                    "\n  MustStayTogether[{}]: {} (weight: {:.1})",
                    clique_idx, violation_count, weight
                ));
                has_constraints = true;
            }
        }

        // Immovable person violations
        if self.immovable_violations > 0 {
            breakdown.push_str(&format!(
                "\n  ImmovablePerson: {} (weight: 1000.0)",
                self.immovable_violations
            ));
            has_constraints = true;
        }

        // If no constraint violations, show that constraints are satisfied
        if !has_constraints {
            breakdown.push_str("\n  Constraints: All satisfied");
        }

        breakdown.push_str(&format!("\n  Total: {:.2}", self.calculate_cost()));
        breakdown
    }

    /// Calculate the probability of attempting a clique swap based on clique density
    pub fn calculate_clique_swap_probability(&self) -> f64 {
        let total_people = self.person_idx_to_id.len();
        let people_in_cliques = self
            .person_to_clique_id
            .iter()
            .filter(|clique_id| clique_id.is_some())
            .count();

        if people_in_cliques == 0 || total_people == 0 {
            return 0.0; // No cliques, no clique swaps
        }

        let clique_ratio = people_in_cliques as f64 / total_people as f64;
        // Probability scales with clique density, maxing out at 0.3 when all people are in cliques
        (clique_ratio * 0.3).min(0.3)
    }

    /// Find all non-clique, movable people in a specific group for a given day
    pub fn find_non_clique_movable_people(&self, day: usize, group_idx: usize) -> Vec<usize> {
        self.schedule[day][group_idx]
            .iter()
            .filter(|&&person_idx| {
                // Person must not be in a clique
                self.person_to_clique_id[person_idx].is_none() &&
                // Person must not be immovable for this day
                !self.immovable_people.contains_key(&(person_idx, day))
            })
            .cloned()
            .collect()
    }

    /// Check if a clique swap is feasible between two groups
    pub fn is_clique_swap_feasible(
        &self,
        day: usize,
        clique_idx: usize,
        _from_group: usize,
        to_group: usize,
    ) -> bool {
        let clique = &self.cliques[clique_idx];
        let non_clique_people_in_to_group = self.find_non_clique_movable_people(day, to_group);

        // Need at least as many non-clique people in target group as clique size
        non_clique_people_in_to_group.len() >= clique.len()
    }

    /// Calculate the cost delta for swapping a clique with non-clique people
    pub fn calculate_clique_swap_cost_delta(
        &self,
        day: usize,
        clique_idx: usize,
        from_group: usize,
        to_group: usize,
        target_people: &[usize],
    ) -> f64 {
        let clique = &self.cliques[clique_idx];

        if clique.len() != target_people.len() {
            return f64::INFINITY; // Invalid swap
        }

        let mut delta_cost = 0.0;
        let from_group_members = &self.schedule[day][from_group];
        let to_group_members = &self.schedule[day][to_group];

        // Calculate contact/repetition delta for each person in the clique
        for &clique_person in clique {
            // Lost contacts: clique person with remaining people in from_group
            for &other_person in from_group_members {
                if other_person == clique_person || clique.contains(&other_person) {
                    continue; // Skip self and other clique members
                }
                let count = self.contact_matrix[clique_person][other_person];
                if count > 0 {
                    delta_cost += self.w_repetition
                        * ((count as i32 - 2).pow(2) - (count as i32 - 1).pow(2)) as f64;
                    if count == 1 {
                        delta_cost += self.w_contacts; // Losing unique contact
                    }
                }
            }

            // Gained contacts: clique person with remaining people in to_group
            for &other_person in to_group_members {
                if clique.contains(&other_person) || target_people.contains(&other_person) {
                    continue; // Skip other clique members and people being swapped out
                }
                let count = self.contact_matrix[clique_person][other_person];
                delta_cost +=
                    self.w_repetition * ((count as i32).pow(2) - (count as i32 - 1).pow(2)) as f64;
                if count == 0 {
                    delta_cost -= self.w_contacts; // Gaining unique contact
                }
            }
        }

        // Calculate contact/repetition delta for each target person
        for &target_person in target_people {
            // Lost contacts: target person with remaining people in to_group
            for &other_person in to_group_members {
                if other_person == target_person
                    || target_people.contains(&other_person)
                    || clique.contains(&other_person)
                {
                    continue;
                }
                let count = self.contact_matrix[target_person][other_person];
                if count > 0 {
                    delta_cost += self.w_repetition
                        * ((count as i32 - 2).pow(2) - (count as i32 - 1).pow(2)) as f64;
                    if count == 1 {
                        delta_cost += self.w_contacts; // Losing unique contact
                    }
                }
            }

            // Gained contacts: target person with remaining people in from_group
            for &other_person in from_group_members {
                if clique.contains(&other_person) || target_people.contains(&other_person) {
                    continue;
                }
                let count = self.contact_matrix[target_person][other_person];
                delta_cost +=
                    self.w_repetition * ((count as i32).pow(2) - (count as i32 - 1).pow(2)) as f64;
                if count == 0 {
                    delta_cost -= self.w_contacts; // Gaining unique contact
                }
            }
        }

        // Attribute balance penalty delta (simplified - would need full recalculation for precision)
        // This is an approximation for performance
        delta_cost += self.calculate_attribute_balance_delta_for_groups(
            day,
            from_group,
            to_group,
            clique,
            target_people,
        );

        // Calculate constraint penalty delta for clique swaps
        delta_cost += self.calculate_clique_swap_constraint_penalty_delta(
            day,
            clique,
            target_people,
            from_group,
            to_group,
        );

        delta_cost
    }

    /// Calculate constraint penalty delta for clique swaps
    fn calculate_clique_swap_constraint_penalty_delta(
        &self,
        day: usize,
        clique: &[usize],
        target_people: &[usize],
        from_group: usize,
        to_group: usize,
    ) -> f64 {
        let mut delta = 0.0;

        // Get the affected group memberships before and after the swap
        let from_group_members = &self.schedule[day][from_group];
        let to_group_members = &self.schedule[day][to_group];

        // Calculate new group compositions after swap
        let mut new_from_members: Vec<usize> = from_group_members
            .iter()
            .filter(|&&p| !clique.contains(&p))
            .cloned()
            .collect();
        new_from_members.extend_from_slice(target_people);

        let mut new_to_members: Vec<usize> = to_group_members
            .iter()
            .filter(|&&p| !target_people.contains(&p))
            .cloned()
            .collect();
        new_to_members.extend_from_slice(clique);

        // Check CannotBeTogether constraints
        for (pair_idx, &(person1, person2)) in self.forbidden_pairs.iter().enumerate() {
            let pair_weight = self.forbidden_pair_weights[pair_idx];

            // Old constraint penalty contributions
            let old_penalty = if (from_group_members.contains(&person1)
                && from_group_members.contains(&person2))
                || (to_group_members.contains(&person1) && to_group_members.contains(&person2))
            {
                pair_weight // Constraint violated in current state
            } else {
                0.0 // Constraint satisfied in current state
            };

            // New constraint penalty contributions
            let new_penalty = if (new_from_members.contains(&person1)
                && new_from_members.contains(&person2))
                || (new_to_members.contains(&person1) && new_to_members.contains(&person2))
            {
                pair_weight // Constraint violated in new state
            } else {
                0.0 // Constraint satisfied in new state
            };

            delta += new_penalty - old_penalty;
        }

        // Check ImmovablePerson constraints for the affected people
        for &person in clique.iter().chain(target_people.iter()) {
            if let Some(&required_group) = self.immovable_people.get(&(person, day)) {
                let current_group = self.locations[day][person].0;
                let new_group = if clique.contains(&person) {
                    to_group
                } else {
                    from_group
                };

                // Old penalty (using default weight for immovable person constraints)
                let old_penalty = if current_group != required_group {
                    1000.0 // Default hard constraint weight for immovable people
                } else {
                    0.0
                };

                // New penalty
                let new_penalty = if new_group != required_group {
                    1000.0 // Default hard constraint weight for immovable people
                } else {
                    0.0
                };

                delta += new_penalty - old_penalty;
            }
        }

        delta
    }

    /// Simplified attribute balance delta calculation for clique swaps
    fn calculate_attribute_balance_delta_for_groups(
        &self,
        day: usize,
        from_group: usize,
        to_group: usize,
        clique: &[usize],
        target_people: &[usize],
    ) -> f64 {
        let mut delta = 0.0;

        for ac in &self.attribute_balance_constraints {
            // Only consider constraints that apply to these groups
            if ac.group_id != "ALL"
                && ac.group_id != self.group_idx_to_id[from_group]
                && ac.group_id != self.group_idx_to_id[to_group]
            {
                continue;
            }

            let from_group_members = &self.schedule[day][from_group];
            let to_group_members = &self.schedule[day][to_group];

            // Calculate old penalties
            let old_from_penalty =
                self.calculate_group_attribute_penalty_for_members(from_group_members, ac);
            let old_to_penalty =
                self.calculate_group_attribute_penalty_for_members(to_group_members, ac);

            // Calculate new group compositions
            let mut new_from_members: Vec<usize> = from_group_members
                .iter()
                .filter(|&&p| !clique.contains(&p))
                .cloned()
                .collect();
            new_from_members.extend_from_slice(target_people);

            let mut new_to_members: Vec<usize> = to_group_members
                .iter()
                .filter(|&&p| !target_people.contains(&p))
                .cloned()
                .collect();
            new_to_members.extend_from_slice(clique);

            // Calculate new penalties
            let new_from_penalty =
                self.calculate_group_attribute_penalty_for_members(&new_from_members, ac);
            let new_to_penalty =
                self.calculate_group_attribute_penalty_for_members(&new_to_members, ac);

            delta += (new_from_penalty + new_to_penalty) - (old_from_penalty + old_to_penalty);
        }

        delta
    }

    /// Apply a clique swap, moving the clique to a new group and swapping with target people
    pub fn apply_clique_swap(
        &mut self,
        day: usize,
        clique_idx: usize,
        from_group: usize,
        to_group: usize,
        target_people: &[usize],
    ) {
        let clique = self.cliques[clique_idx].clone(); // Clone to avoid borrow checker issues

        if clique.len() != target_people.len() {
            return; // Invalid swap, should not happen if prechecked
        }

        // Update the schedule by removing and adding people to groups
        // Remove clique members from from_group
        self.schedule[day][from_group].retain(|&p| !clique.contains(&p));
        // Remove target people from to_group
        self.schedule[day][to_group].retain(|&p| !target_people.contains(&p));

        // Add target people to from_group
        self.schedule[day][from_group].extend_from_slice(target_people);
        // Add clique members to to_group
        self.schedule[day][to_group].extend_from_slice(&clique);

        // Update locations lookup
        self._recalculate_locations_from_schedule();

        // Recalculate all scores for accuracy (clique swaps are complex, so we use full recalc)
        self._recalculate_scores();
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
                penalty_weight: 1000.0,
                sessions: None,
            },
            Constraint::MustStayTogether {
                people: vec!["p1".into(), "p2".into()],
                penalty_weight: 1000.0,
                sessions: None,
            },
            Constraint::MustStayTogether {
                people: vec!["p4".into(), "p5".into()],
                penalty_weight: 1000.0,
                sessions: None,
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
            penalty_weight: 1000.0,
            sessions: None,
        }];

        let result = State::new(&input);
        assert!(result.is_err());
        if let Err(SolverError::ValidationError(msg)) = result {
            // The validation can fail in three ways now:
            // 1. The new check for total people vs. total capacity.
            // 2. The original check in `_preprocess_and_validate_constraints` for clique size.
            // 3. The new check during initial placement.
            // We accept any of these error messages as a valid failure for this test case.
            let is_capacity_error = msg.contains("Not enough group capacity");
            let is_specific_error = msg.contains("is larger than any available group");
            let is_general_error = msg.contains("Could not place clique");
            assert!(
                is_capacity_error || is_specific_error || is_general_error,
                "Error message did not match expected patterns. Got: {}",
                msg
            );
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
                penalty_weight: 1000.0,
                sessions: None,
            },
            Constraint::CannotBeTogether {
                people: vec!["p0".into(), "p1".into()],
                penalty_weight: 1000.0,
                sessions: None,
            },
        ];

        let result = State::new(&input);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("CannotBeTogether constraint conflicts with MustStayTogether"));
    }

    #[test]
    fn test_clique_swap_probability_calculation() {
        // Test with no cliques
        let input_no_cliques = create_test_input(10, vec![(2, 5)], 1);
        let state_no_cliques = State::new(&input_no_cliques).unwrap();
        assert_eq!(state_no_cliques.calculate_clique_swap_probability(), 0.0);

        // Test with some cliques
        let mut input_with_cliques = create_test_input(10, vec![(2, 5)], 1);
        input_with_cliques.constraints = vec![
            Constraint::MustStayTogether {
                people: vec!["p0".into(), "p1".into()],
                penalty_weight: 1000.0,
                sessions: None,
            },
            Constraint::MustStayTogether {
                people: vec!["p2".into(), "p3".into()],
                penalty_weight: 1000.0,
                sessions: None,
            },
        ];
        let state_with_cliques = State::new(&input_with_cliques).unwrap();
        let probability = state_with_cliques.calculate_clique_swap_probability();

        // 4 people in cliques out of 10 total = 0.4 ratio
        // Expected probability: 0.4 * 0.3 = 0.12
        assert!((probability - 0.12).abs() < 0.001);
    }

    #[test]
    fn test_find_non_clique_movable_people() {
        let mut input = create_test_input(8, vec![(2, 4)], 2);
        input.constraints = vec![
            Constraint::MustStayTogether {
                people: vec!["p0".into(), "p1".into()],
                penalty_weight: 1000.0,
                sessions: None,
            },
            Constraint::ImmovablePerson(crate::models::ImmovablePersonParams {
                person_id: "p2".into(),
                group_id: "g0_0".into(),
                sessions: vec![0, 1],
            }),
        ];
        let state = State::new(&input).unwrap();

        // Find non-clique movable people in group 0 for day 0
        let non_clique_people = state.find_non_clique_movable_people(0, 0);

        // Should exclude p0, p1 (clique members) and p2 (immovable)
        assert!(!non_clique_people.contains(&0)); // p0 in clique
        assert!(!non_clique_people.contains(&1)); // p1 in clique
        assert!(!non_clique_people.contains(&2)); // p2 immovable

        // Should only include movable non-clique people
        for &person_idx in &non_clique_people {
            assert!(state.person_to_clique_id[person_idx].is_none());
            assert!(!state.immovable_people.contains_key(&(person_idx, 0)));
        }
    }

    #[test]
    fn test_clique_swap_feasibility() {
        let mut input = create_test_input(10, vec![(2, 5)], 1);
        input.constraints = vec![Constraint::MustStayTogether {
            people: vec!["p0".into(), "p1".into(), "p2".into()],
            penalty_weight: 1000.0,
            sessions: None,
        }];
        let state = State::new(&input).unwrap();

        // Find the clique (should be clique 0)
        let clique_idx = 0;
        let clique_group = state.locations[0][0].0; // Group where p0 is located
        let other_group = if clique_group == 0 { 1 } else { 0 };

        // Check feasibility - need at least 3 non-clique people in target group
        let is_feasible = state.is_clique_swap_feasible(0, clique_idx, clique_group, other_group);

        // Should be feasible since we have enough non-clique people
        let non_clique_in_other = state.find_non_clique_movable_people(0, other_group);
        if non_clique_in_other.len() >= 3 {
            assert!(is_feasible);
        } else {
            assert!(!is_feasible);
        }
    }

    #[test]
    fn test_clique_swap_delta_calculation() {
        let mut input = create_test_input(8, vec![(2, 4)], 1);
        input.constraints = vec![Constraint::MustStayTogether {
            people: vec!["p0".into(), "p1".into()],
            penalty_weight: 1000.0,
            sessions: None,
        }];
        let mut state = State::new(&input).unwrap();

        // Recalculate scores to ensure we have a baseline
        state._recalculate_scores();
        let initial_cost = state.calculate_cost();

        let clique_idx = 0;
        let clique_group = state.locations[0][0].0;
        let other_group = if clique_group == 0 { 1 } else { 0 };
        let non_clique_people = state.find_non_clique_movable_people(0, other_group);

        if non_clique_people.len() >= 2 {
            let target_people: Vec<usize> = non_clique_people.into_iter().take(2).collect();

            // Calculate delta
            let delta = state.calculate_clique_swap_cost_delta(
                0,
                clique_idx,
                clique_group,
                other_group,
                &target_people,
            );

            // Apply the swap and verify the delta was correct
            let mut test_state = state.clone();
            test_state.apply_clique_swap(0, clique_idx, clique_group, other_group, &target_people);
            test_state.validate_scores(); // Ensure scores are consistent

            let actual_new_cost = test_state.calculate_cost();
            let expected_new_cost = initial_cost + delta;

            // Allow small floating point differences
            assert!(
                (actual_new_cost - expected_new_cost).abs() < 0.01,
                "Delta calculation incorrect: expected {}, got {}, delta was {}",
                expected_new_cost,
                actual_new_cost,
                delta
            );
        }
    }

    #[test]
    fn test_clique_swap_preserves_clique_integrity() {
        let mut input = create_test_input(10, vec![(2, 5)], 1);
        input.constraints = vec![Constraint::MustStayTogether {
            people: vec!["p0".into(), "p1".into(), "p2".into()],
            penalty_weight: 1000.0,
            sessions: None,
        }];
        let mut state = State::new(&input).unwrap();

        let clique_idx = 0;
        let clique_group = state.locations[0][0].0;
        let other_group = if clique_group == 0 { 1 } else { 0 };
        let non_clique_people = state.find_non_clique_movable_people(0, other_group);

        if non_clique_people.len() >= 3 {
            let target_people: Vec<usize> = non_clique_people.into_iter().take(3).collect();
            let clique_members = state.cliques[clique_idx].clone();

            // Apply clique swap
            state.apply_clique_swap(0, clique_idx, clique_group, other_group, &target_people);

            // Verify all clique members are in the same group after swap
            let first_member_group = state.locations[0][clique_members[0]].0;
            for &member in &clique_members {
                assert_eq!(
                    state.locations[0][member].0, first_member_group,
                    "Clique member {} not in same group as other members",
                    member
                );
            }

            // Verify they're in the target group
            assert_eq!(
                first_member_group, other_group,
                "Clique not moved to target group"
            );

            // Verify target people are in the original group
            for &target_person in &target_people {
                assert_eq!(
                    state.locations[0][target_person].0, clique_group,
                    "Target person {} not moved to clique's original group",
                    target_person
                );
            }
        }
    }
}
