use serde::Deserialize;
use solver_core::{
    models::{ApiInput, SolverResult},
    run_solver,
};
use std::fs;
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

#[derive(Deserialize)]
struct TestCase {
    name: String,
    input: ApiInput,
    expected: ExpectedMetrics,
}

#[derive(Deserialize)]
struct ExpectedMetrics {
    #[serde(default)]
    must_stay_together_respected: bool,
    #[serde(default)]
    cannot_be_together_respected: bool,
    max_constraint_penalty: Option<u32>,
    #[serde(default)]
    immovable_person_respected: bool,
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
            let test_case: TestCase = serde_json::from_str(&file_content)
                .unwrap_or_else(|e| panic!("Failed to parse test case {:?}: {}", path, e));

            let should_run = match settings.mode {
                TestMode::All => true,
                TestMode::Filter => settings
                    .filter_patterns
                    .iter()
                    .any(|pattern| test_case.name.contains(pattern)),
            };

            if should_run {
                println!("--- Running Test: {} ---", test_case.name);
                run_test_case(&test_case, &path);
            }
        }
    }
}

fn run_test_case(test_case: &TestCase, path: &Path) {
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

    if let Some(max_penalty) = test_case.expected.max_constraint_penalty {
        assert!(
            result.constraint_penalty as u32 <= max_penalty,
            "Constraint penalty {} exceeds maximum of {}",
            result.constraint_penalty,
            max_penalty
        );
    }
}

fn assert_cliques_respected(input: &ApiInput, result: &SolverResult) {
    let cliques: Vec<_> = input
        .constraints
        .iter()
        .filter_map(|c| match c {
            solver_core::models::Constraint::MustStayTogether { people } => Some(people),
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
            solver_core::models::Constraint::CannotBeTogether { people } => Some(people),
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
