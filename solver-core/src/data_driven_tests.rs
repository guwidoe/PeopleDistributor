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
                {"id": "team-gamma", "size": 3}
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
                "SimulatedAnnealing": {
                    "initial_temperature": 1,
                    "final_temperature": 0.01,
                    "cooling_schedule": "geometric"
                }
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
    let result = crate::run_solver(&api_input);
    assert!(
        result.is_ok(),
        "Solver should succeed with user-reported JSON: {:?}",
        result.err()
    );

    let solution = result.unwrap();
    assert!(solution.final_score > 0.0);
    assert!(solution.schedule.len() > 0);
}
