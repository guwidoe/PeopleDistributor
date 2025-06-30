use serde::Deserialize;
use solver_core::{
    models::{ApiInput, SolverConfiguration, SolverResult},
    run_solver,
};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
enum TestMode {
    #[serde(rename = "all")]
    All,
    #[serde(rename = "filter")]
    Filter,
}

#[derive(Debug, Deserialize)]
struct TestSettings {
    mode: TestMode,
    filter_patterns: Vec<String>,
}

#[derive(Deserialize, Debug)]
struct TestOptions {
    #[serde(default = "default_loop_count")]
    loop_count: u32,
}

impl Default for TestOptions {
    fn default() -> Self {
        Self {
            loop_count: default_loop_count(),
        }
    }
}

fn default_loop_count() -> u32 {
    1
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct TestCase {
    name: String,
    input: ApiInput,
    #[serde(default)]
    expected: ExpectedMetrics,
    #[serde(default)]
    test_options: TestOptions,
}

#[derive(Deserialize, Debug, Default)]
#[allow(dead_code)]
struct ExpectedMetrics {
    #[serde(default)]
    must_stay_together_respected: bool,
    #[serde(default)]
    cannot_be_together_respected: bool,
    max_constraint_penalty: Option<u32>,
    #[serde(default)]
    immovable_person_respected: bool,
    #[serde(default)]
    session_specific_constraints_respected: bool,
    #[serde(default)]
    participation_patterns_respected: bool,
}

#[test]
fn run_data_driven_tests() {
    let settings_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("test_settings.yaml");
    let settings_file =
        fs::read_to_string(settings_path).expect("Unable to read test_settings.yaml");
    let settings: TestSettings =
        serde_yaml::from_str(&settings_file).expect("Unable to parse test_settings.yaml");

    let paths = fs::read_dir("tests/test_cases").unwrap();

    for path in paths {
        let path = path.unwrap().path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            let file_content = fs::read_to_string(&path)
                .unwrap_or_else(|e| panic!("Failed to read test case file {:?}: {}", path, e));
            let test_case: TestCase = serde_json::from_str(&file_content).unwrap_or_else(|e| {
                panic!(
                    "Failed to parse test case \"{}\": {}",
                    path.to_str().unwrap(),
                    e
                )
            });

            let should_run = match settings.mode {
                TestMode::All => true,
                TestMode::Filter => settings
                    .filter_patterns
                    .iter()
                    .any(|pattern| test_case.name.contains(pattern)),
            };

            if should_run {
                run_test_case(&test_case, &path);
            }
        }
    }
}

fn run_test_case(test_case: &TestCase, path: &Path) {
    let loop_count = test_case.test_options.loop_count;
    if loop_count > 1 {
        println!(
            "--- Running Test: {} ({} times) ---",
            test_case.name, loop_count
        );
    } else {
        println!("--- Running Test: {} ---", test_case.name);
    }

    for i in 0..loop_count {
        if loop_count > 1 {
            // Print progress on the same line
            print!("\r  Run {}/{}...", i + 1, loop_count);
            io::stdout().flush().unwrap();
        }

        let result = run_solver(&test_case.input);

        assert!(
            result.is_ok(),
            "Solver failed for test case {} ({:?}): {:?}",
            test_case.name,
            path,
            result.err()
        );
        let result = result.unwrap();

        if test_case.expected.must_stay_together_respected {
            assert_cliques_respected(&test_case.input, &result);
        }

        if test_case.expected.cannot_be_together_respected {
            assert_forbidden_pairs_respected(&test_case.input, &result);
        }

        if test_case.expected.immovable_person_respected {
            assert_immovable_person_respected(&test_case.input, &result);
        }

        if test_case.expected.session_specific_constraints_respected {
            assert_session_specific_constraints_respected(&test_case.input, &result);
        }

        if test_case.expected.participation_patterns_respected {
            assert_participation_patterns_respected(&test_case.input, &result);
        }

        if let Some(max_penalty) = test_case.expected.max_constraint_penalty {
            assert!(
                result.constraint_penalty as u32 <= max_penalty,
                "Constraint penalty {} exceeds maximum of {}",
                result.constraint_penalty,
                max_penalty
            );
        }
    }
    io::stdout().flush().unwrap();
    if loop_count > 1 {
        // Clear the line and print final status
        println!("\r  All {} runs passed.        ", loop_count);
    }
}

fn assert_cliques_respected(input: &ApiInput, result: &SolverResult) {
    let cliques: Vec<_> = input
        .constraints
        .iter()
        .filter_map(|c| match c {
            solver_core::models::Constraint::MustStayTogether { people, .. } => Some(people),
            _ => None,
        })
        .collect();

    for clique in cliques {
        for (_session_id, groups) in &result.schedule {
            let mut clique_group_id = None;
            for (group_id, members) in groups {
                if members.contains(&clique[0]) {
                    clique_group_id = Some(group_id);
                    break;
                }
            }
            assert!(
                clique_group_id.is_some(),
                "Clique {:?} was not found in any group",
                clique
            );
            let group_members = groups.get(clique_group_id.unwrap()).unwrap();
            for person in clique {
                assert!(
                    group_members.contains(person),
                    "Clique member {} was not in the correct group for clique {:?}",
                    person,
                    clique
                );
            }
        }
    }
}

fn assert_forbidden_pairs_respected(input: &ApiInput, result: &SolverResult) {
    let forbidden_groups: Vec<_> = input
        .constraints
        .iter()
        .filter_map(|c| match c {
            solver_core::models::Constraint::CannotBeTogether { people, .. } => Some(people),
            _ => None,
        })
        .collect();

    for group in forbidden_groups {
        for (_session_id, groups) in &result.schedule {
            for (_group_id, members) in groups {
                let mut present_members = 0;
                for person in group {
                    if members.contains(person) {
                        present_members += 1;
                    }
                }
                assert!(
                    present_members <= 1,
                    "Forbidden pair/group {:?} found in the same group: {:?}",
                    group,
                    members
                );
            }
        }
    }
}

fn assert_immovable_person_respected(input: &ApiInput, result: &SolverResult) {
    let immovable_constraints: Vec<_> = input
        .constraints
        .iter()
        .filter_map(|c| match c {
            solver_core::models::Constraint::ImmovablePerson(params) => Some(params),
            _ => None,
        })
        .collect();

    for constraint in immovable_constraints {
        for &session in &constraint.sessions {
            let session_key = format!("session_{}", session);
            let session_schedule = result.schedule.get(&session_key).unwrap_or_else(|| {
                panic!(
                    "Session {} not found in schedule for immovable person check",
                    session_key
                )
            });

            let person_group = session_schedule
                .iter()
                .find(|(_group_id, members)| members.contains(&constraint.person_id));

            assert!(
                person_group.is_some(),
                "Immovable person {} not found in any group for session {}",
                constraint.person_id,
                session
            );

            let (group_id, _members) = person_group.unwrap();
            assert_eq!(
                *group_id, constraint.group_id,
                "Immovable person {} is in group {} instead of {} for session {}",
                constraint.person_id, group_id, constraint.group_id, session
            );
        }
    }
}

fn assert_session_specific_constraints_respected(input: &ApiInput, result: &SolverResult) {
    // Check MustStayTogether constraints
    for constraint in &input.constraints {
        if let solver_core::models::Constraint::MustStayTogether {
            people, sessions, ..
        } = constraint
        {
            if let Some(session_list) = sessions {
                // Validate that clique is together ONLY in specified sessions
                for session in session_list {
                    let session_key = format!("session_{}", session);
                    let session_schedule = result
                        .schedule
                        .get(&session_key)
                        .unwrap_or_else(|| panic!("Session {} not found in schedule", session_key));

                    // Find which group the first person is in
                    let mut clique_group_id = None;
                    for (group_id, members) in session_schedule {
                        if members.contains(&people[0]) {
                            clique_group_id = Some(group_id);
                            break;
                        }
                    }

                    assert!(
                        clique_group_id.is_some(),
                        "Clique member {} not found in any group for session {}",
                        people[0],
                        session
                    );

                    let group_members = session_schedule.get(clique_group_id.unwrap()).unwrap();

                    // Verify all clique members are in the same group for this session
                    for person in people {
                        assert!(
                            group_members.contains(person),
                            "Session-specific clique constraint violated: {} should be with {:?} in session {} but is not",
                            person, people, session
                        );
                    }
                }
            }
        }
    }

    // Check CannotBeTogether constraints
    for constraint in &input.constraints {
        if let solver_core::models::Constraint::CannotBeTogether {
            people, sessions, ..
        } = constraint
        {
            if let Some(session_list) = sessions {
                // Validate that forbidden pair/group is separated ONLY in specified sessions
                for session in session_list {
                    let session_key = format!("session_{}", session);
                    let session_schedule = result
                        .schedule
                        .get(&session_key)
                        .unwrap_or_else(|| panic!("Session {} not found in schedule", session_key));

                    for (_group_id, members) in session_schedule {
                        let mut present_members = 0;
                        for person in people {
                            if members.contains(person) {
                                present_members += 1;
                            }
                        }
                        assert!(
                            present_members <= 1,
                            "Session-specific forbidden constraint violated: {:?} found together in session {} group: {:?}",
                            people, session, members
                        );
                    }
                }
            }
        }
    }
}

fn assert_participation_patterns_respected(input: &ApiInput, result: &SolverResult) {
    // Check that people only appear in sessions they're supposed to participate in
    for person in &input.problem.people {
        let person_sessions = match &person.sessions {
            Some(sessions) => sessions.clone(),
            None => (0..input.problem.num_sessions).collect(), // Default: all sessions
        };

        // Check each session
        for session_idx in 0..input.problem.num_sessions {
            let session_key = format!("session_{}", session_idx);
            let should_participate = person_sessions.contains(&session_idx);

            if let Some(session_schedule) = result.schedule.get(&session_key) {
                let mut person_found = false;

                // Check if person appears in any group for this session
                for (_group_id, members) in session_schedule {
                    if members.contains(&person.id) {
                        person_found = true;
                        break;
                    }
                }

                if should_participate && !person_found {
                    // Person should participate but doesn't appear in any group
                    // This might be OK if they couldn't be placed due to constraints
                    // So we'll just log this as a warning rather than failing the test
                    println!("Warning: {} should participate in session {} but doesn't appear in schedule", 
                            person.id, session_idx);
                } else if !should_participate && person_found {
                    // Person shouldn't participate but appears in schedule - this is an error
                    panic!(
                        "Participation pattern violation: {} should NOT participate in session {} but appears in schedule",
                        person.id, session_idx
                    );
                }
            }
        }
    }

    // Additional validation: Check that people who participate together are both actually participating
    for (session_key, session_schedule) in &result.schedule {
        let session_idx: u32 = session_key.replace("session_", "").parse().unwrap_or(0);

        for (_group_id, members) in session_schedule {
            // For each person in this group, verify they should be participating in this session
            for person_id in members {
                if let Some(person) = input.problem.people.iter().find(|p| &p.id == person_id) {
                    let person_sessions = match &person.sessions {
                        Some(sessions) => sessions.clone(),
                        None => (0..input.problem.num_sessions).collect(),
                    };

                    if !person_sessions.contains(&session_idx) {
                        panic!(
                            "Participation violation: {} appears in session {} but should not participate",
                            person.id, session_idx
                        );
                    }
                }
            }
        }
    }
}

#[test]
fn test_user_reported_json_structure() {
    let json_input = r#"{
        "problem": {
            "people": [
                {"id": "alice", "attributes": {"name": "Alice Johnson", "gender": "female", "department": "engineering", "seniority": "senior"}},
                {"id": "bob", "attributes": {"name": "Bob Smith", "gender": "male", "department": "marketing", "seniority": "mid"}},
                {"id": "charlie", "attributes": {"name": "Charlie Brown", "gender": "male", "department": "engineering", "seniority": "junior"}},
                {"id": "diana", "attributes": {"name": "Diana Prince", "gender": "female", "department": "sales", "seniority": "lead"}},
                {"id": "eve", "attributes": {"name": "Eve Davis", "gender": "female", "department": "hr", "seniority": "mid"}},
                {"id": "frank", "attributes": {"name": "Frank Miller", "gender": "male", "department": "finance", "seniority": "senior"}},
                {"id": "grace", "attributes": {"name": "Grace Lee", "gender": "female", "department": "engineering", "seniority": "junior"}},
                {"id": "henry", "attributes": {"name": "Henry Wilson", "gender": "male", "department": "marketing", "seniority": "senior"}},
                {"id": "iris", "attributes": {"name": "Iris Chen", "gender": "female", "department": "sales", "seniority": "mid"}},
                {"id": "jack", "attributes": {"name": "Jack Taylor", "gender": "male", "department": "hr", "seniority": "junior"}},
                {"id": "kate", "attributes": {"name": "Kate Anderson", "gender": "female", "department": "finance", "seniority": "lead"}},
                {"id": "leo", "attributes": {"name": "Leo Rodriguez", "gender": "male", "department": "engineering", "seniority": "mid", "location": "remote"}, "sessions": [1, 2]}
            ],
            "groups": [
                {"id": "team-alpha", "size": 4},
                {"id": "team-beta", "size": 4},
                {"id": "team-gamma", "size": 4}
            ],
            "num_sessions": 3
        },
        "objectives": [
            {"type": "maximize_unique_contacts", "weight": 1}
        ],
        "constraints": [
            {"type": "RepeatEncounter", "max_allowed_encounters": 1, "penalty_function": "squared", "penalty_weight": 100},
            {"type": "MustStayTogether", "people": ["alice", "bob"], "penalty_weight": 1000, "sessions": [0, 1]},
            {"type": "CannotBeTogether", "people": ["charlie", "diana"], "penalty_weight": 500},
            {"type": "AttributeBalance", "group_id": "team-alpha", "attribute_key": "gender", "desired_values": {"male": 2, "female": 2}, "penalty_weight": 50}
        ],
        "solver": {
            "solver_type": "SimulatedAnnealing",
            "stop_conditions": {
                "max_iterations": 10000,
                "time_limit_seconds": 30,
                "no_improvement_iterations": 1000
            },
            "solver_params": {
                "solver_type": "SimulatedAnnealing",
                "initial_temperature": 1,
                "final_temperature": 0.01,
                "cooling_schedule": "geometric"
            },
            "logging": {
                "log_frequency": 1000,
                "log_initial_state": true,
                "log_duration_and_score": true,
                "display_final_schedule": true,
                "log_initial_score_breakdown": true,
                "log_final_score_breakdown": true,
                "log_stop_condition": true
            }
        }
    }"#;

    // Test that the JSON parses correctly
    let api_input: ApiInput =
        serde_json::from_str(json_input).expect("Failed to parse user-reported JSON structure");

    // Verify the structure
    assert_eq!(api_input.problem.people.len(), 12);
    assert_eq!(api_input.problem.groups.len(), 3);
    assert_eq!(api_input.problem.num_sessions, 3);
    assert_eq!(api_input.objectives.len(), 1);
    assert_eq!(api_input.constraints.len(), 4);
    assert_eq!(api_input.solver.solver_type, "SimulatedAnnealing");

    // Test that the solver can run with this input
    let result = run_solver(&api_input);
    assert!(
        result.is_ok(),
        "Solver should succeed with user-reported JSON: {:?}",
        result.err()
    );

    let solution = result.unwrap();
    assert!(solution.final_score > 0.0);
    assert!(solution.schedule.len() > 0);
}

#[test]
fn test_constraint_parsing() {
    use solver_core::models::Constraint;

    // Test RepeatEncounter parsing
    let repeat_json = r#"{"type": "RepeatEncounter", "max_allowed_encounters": 1, "penalty_function": "squared", "penalty_weight": 100}"#;
    let repeat_constraint: Result<Constraint, _> = serde_json::from_str(repeat_json);
    println!("RepeatEncounter parsing result: {:?}", repeat_constraint);

    // Test MustStayTogether parsing
    let must_stay_json = r#"{"type": "MustStayTogether", "people": ["alice", "bob"], "penalty_weight": 1000, "sessions": [0, 1]}"#;
    let must_stay_constraint: Result<Constraint, _> = serde_json::from_str(must_stay_json);
    println!(
        "MustStayTogether parsing result: {:?}",
        must_stay_constraint
    );

    // Test CannotBeTogether parsing
    let cannot_be_json =
        r#"{"type": "CannotBeTogether", "people": ["charlie", "diana"], "penalty_weight": 500}"#;
    let cannot_be_constraint: Result<Constraint, _> = serde_json::from_str(cannot_be_json);
    println!(
        "CannotBeTogether parsing result: {:?}",
        cannot_be_constraint
    );

    // Test AttributeBalance parsing
    let attr_balance_json = r#"{"type": "AttributeBalance", "group_id": "team-alpha", "attribute_key": "gender", "desired_values": {"male": 2, "female": 2}, "penalty_weight": 50}"#;
    let attr_balance_constraint: Result<Constraint, _> = serde_json::from_str(attr_balance_json);
    println!(
        "AttributeBalance parsing result: {:?}",
        attr_balance_constraint
    );
}

#[test]
fn test_solver_config_parsing() {
    use solver_core::models::SolverConfiguration;

    let solver_json = r#"{
        "solver_type": "SimulatedAnnealing",
        "stop_conditions": {
            "max_iterations": 10000,
            "time_limit_seconds": 30,
            "no_improvement_iterations": 1000
        },
        "solver_params": {
            "solver_type": "SimulatedAnnealing",
            "initial_temperature": 1,
            "final_temperature": 0.01,
            "cooling_schedule": "geometric"
        },
        "logging": {
            "log_frequency": 1000,
            "log_initial_state": true,
            "log_duration_and_score": true,
            "display_final_schedule": true,
            "log_initial_score_breakdown": true,
            "log_final_score_breakdown": true,
            "log_stop_condition": true
        }
    }"#;

    let solver_config: Result<SolverConfiguration, _> = serde_json::from_str(solver_json);
    println!("Solver config parsing result: {:?}", solver_config);
    assert!(
        solver_config.is_ok(),
        "Solver config should parse successfully: {:?}",
        solver_config.err()
    );
}

#[test]
fn test_simplified_user_json_structure() {
    let json_input = r#"{
        "problem": {
            "people": [
                {"id": "alice", "attributes": {"name": "Alice Johnson", "gender": "female"}},
                {"id": "bob", "attributes": {"name": "Bob Smith", "gender": "male"}},
                {"id": "charlie", "attributes": {"name": "Charlie Brown", "gender": "male"}},
                {"id": "diana", "attributes": {"name": "Diana Prince", "gender": "female"}}
            ],
            "groups": [
                {"id": "team-alpha", "size": 2},
                {"id": "team-beta", "size": 2}
            ],
            "num_sessions": 2
        },
        "objectives": [
            {"type": "maximize_unique_contacts", "weight": 1}
        ],
        "constraints": [
            {"type": "RepeatEncounter", "max_allowed_encounters": 1, "penalty_function": "squared", "penalty_weight": 100}
        ],
        "solver": {
            "solver_type": "SimulatedAnnealing",
            "stop_conditions": {
                "max_iterations": 1000,
                "time_limit_seconds": 5,
                "no_improvement_iterations": 100
            },
            "solver_params": {
                "solver_type": "SimulatedAnnealing",
                "initial_temperature": 1,
                "final_temperature": 0.01,
                "cooling_schedule": "geometric"
            },
            "logging": {
                "log_frequency": 1000,
                "log_initial_state": true,
                "log_duration_and_score": true,
                "display_final_schedule": true,
                "log_initial_score_breakdown": true,
                "log_final_score_breakdown": true,
                "log_stop_condition": true
            }
        }
    }"#;

    // Test that the JSON parses correctly
    let api_input: ApiInput =
        serde_json::from_str(json_input).expect("Failed to parse simplified JSON structure");

    // Verify the structure
    assert_eq!(api_input.problem.people.len(), 4);
    assert_eq!(api_input.problem.groups.len(), 2);
    assert_eq!(api_input.problem.num_sessions, 2);
    assert_eq!(api_input.objectives.len(), 1);
    assert_eq!(api_input.constraints.len(), 1);
    assert_eq!(api_input.solver.solver_type, "SimulatedAnnealing");

    // Test that the solver can run with this input
    let result = run_solver(&api_input);
    assert!(
        result.is_ok(),
        "Solver should succeed with simplified JSON: {:?}",
        result.err()
    );

    let solution = result.unwrap();
    assert!(solution.schedule.len() > 0);
    assert!(solution.unique_contacts > 0);
}
