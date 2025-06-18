use solver_core::{
    models::{
        ApiInput, AttributeBalanceParams, Constraint, Group, Objective, Person, ProblemDefinition,
        SimulatedAnnealingParams, SolverConfiguration, SolverParams, StopConditions,
    },
    run_solver,
};
use std::collections::HashMap;
use std::time::Instant;

fn create_benchmark_input() -> ApiInput {
    let num_people = 30;
    let num_groups = 5;
    let group_size = 6;
    let num_sessions = 10;
    let iterations = 1_000_000;

    let people: Vec<Person> = (0..num_people)
        .map(|i| {
            let gender = if i % 2 == 0 { "M" } else { "F" };
            let mut attributes = HashMap::new();
            attributes.insert("gender".to_string(), gender.to_string());
            Person {
                id: format!("p{}", i),
                attributes,
            }
        })
        .collect();

    let groups: Vec<Group> = (0..num_groups)
        .map(|i| Group {
            id: format!("g{}", i),
            size: group_size,
        })
        .collect();

    let mut desired_gender_balance = HashMap::new();
    desired_gender_balance.insert("M".to_string(), 3);
    desired_gender_balance.insert("F".to_string(), 3);

    let constraints = vec![Constraint::AttributeBalance(AttributeBalanceParams {
        group_id: "ALL".to_string(),
        attribute_key: "gender".to_string(),
        desired_values: desired_gender_balance,
        penalty_weight: 10.0,
    })];

    let objectives = vec![Objective {
        r#type: "maximize_unique_contacts".to_string(),
        weight: 1.0,
    }];

    ApiInput {
        problem: ProblemDefinition {
            people,
            groups,
            num_sessions,
        },
        objectives,
        constraints,
        solver: SolverConfiguration {
            solver_type: "SimulatedAnnealing".to_string(),
            stop_conditions: StopConditions {
                max_iterations: Some(iterations),
                time_limit_seconds: None,
                no_improvement_iterations: None,
            },
            solver_params: Some(SolverParams::SimulatedAnnealing(SimulatedAnnealingParams {
                initial_temperature: 1.0,
                final_temperature: 0.0001,
                cooling_schedule: "geometric".to_string(),
            })),
        },
    }
}

#[test]
#[ignore]
fn run_full_algorithm_benchmark() {
    let input = create_benchmark_input();

    println!("--- Starting Benchmark ---");
    println!(
        "People: {}, Groups: {}, Sessions: {}",
        input.problem.people.len(),
        input.problem.groups.len(),
        input.problem.num_sessions
    );
    println!(
        "Iterations: {}",
        input.solver.stop_conditions.max_iterations.unwrap_or(0)
    );

    let start_time = Instant::now();
    let result = run_solver(input);
    let duration = start_time.elapsed();

    println!("--- Benchmark Finished ---");
    println!("Total runtime: {:.4} seconds", duration.as_secs_f64());

    // You can add more assertions here if needed, for now, we print the result.
    // For example, assert that the final score is within an expected range.
    println!("Final result: {:?}", result);
}
