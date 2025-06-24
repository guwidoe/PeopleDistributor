use solver_core::{
    models::{
        ApiInput, LoggingOptions, SimulatedAnnealingParams, SolverConfiguration, SolverParams,
        StopConditions,
    },
    run_solver,
};

fn main() {
    // Create a simple test case with logging enabled
    let input = ApiInput {
        problem: solver_core::models::ProblemDefinition {
            people: vec![
                solver_core::models::Person {
                    id: "p0".to_string(),
                    attributes: std::collections::HashMap::new(),
                },
                solver_core::models::Person {
                    id: "p1".to_string(),
                    attributes: std::collections::HashMap::new(),
                },
                solver_core::models::Person {
                    id: "p2".to_string(),
                    attributes: std::collections::HashMap::new(),
                },
                solver_core::models::Person {
                    id: "p3".to_string(),
                    attributes: std::collections::HashMap::new(),
                },
            ],
            groups: vec![
                solver_core::models::Group {
                    id: "g0".to_string(),
                    size: 2,
                },
                solver_core::models::Group {
                    id: "g1".to_string(),
                    size: 2,
                },
            ],
            num_sessions: 2,
        },
        objectives: vec![solver_core::models::Objective {
            r#type: "maximize_unique_contacts".to_string(),
            weight: 1.0,
        }],
        constraints: vec![],
        solver: SolverConfiguration {
            solver_type: "SimulatedAnnealing".to_string(),
            stop_conditions: StopConditions {
                max_iterations: Some(100),
                time_limit_seconds: None,
                no_improvement_iterations: None,
            },
            solver_params: SolverParams::SimulatedAnnealing(SimulatedAnnealingParams {
                initial_temperature: 10.0,
                final_temperature: 0.1,
                cooling_schedule: "geometric".to_string(),
            }),
            logging: LoggingOptions {
                log_frequency: Some(50),
                log_initial_state: false,
                log_duration_and_score: true,
                display_final_schedule: false,
                log_initial_score_breakdown: true,
                log_final_score_breakdown: true,
                log_stop_condition: false,
            },
        },
    };

    println!("Running test with logging enabled...");
    let result = run_solver(&input);
    match result {
        Ok(result) => {
            println!("Test completed successfully!");
            println!("Final score: {}", result.final_score);
        }
        Err(e) => {
            println!("Test failed: {:?}", e);
        }
    }
}
