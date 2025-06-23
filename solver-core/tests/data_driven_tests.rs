use serde::Deserialize;
use solver_core::{
    models::{ApiInput, SolverResult},
    run_solver,
};
use std::fs;
use std::path::Path;

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
}

#[test]
fn run_data_driven_tests() {
    let paths = fs::read_dir("tests/test_cases").unwrap();

    for path in paths {
        let path = path.unwrap().path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            run_test_case_from_file(&path);
        }
    }
}

fn run_test_case_from_file(path: &Path) {
    let file_content = fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("Failed to read test case file {:?}: {}", path, e));
    let test_case: TestCase = serde_json::from_str(&file_content)
        .unwrap_or_else(|e| panic!("Failed to parse test case {:?}: {}", path, e));

    println!("--- Running Test: {} ---", test_case.name);
    let result = run_solver(&test_case.input);

    assert!(
        result.is_ok(),
        "Solver failed for test case {}: {:?}",
        test_case.name,
        result.err()
    );
    let result = result.unwrap();

    if test_case.expected.must_stay_together_respected {
        assert_cliques_respected(&test_case.input, &result);
    }

    if test_case.expected.cannot_be_together_respected {
        assert_forbidden_pairs_respected(&test_case.input, &result);
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
