use crate::state::State;
use indicatif::ProgressBar;
use std::time::Instant;

pub fn run_random_hillclimbing_algorithm(mut state: State, num_iterations: u32) {
    println!("Total number of contacts in initial state for hill climbing:");
    state.print_total_num_of_contacts();
    state.print_num_of_contacts_per_person();
    let bar = ProgressBar::new(num_iterations as u64);
    for _ in 0..num_iterations {
        state.try_random_m_swap_and_proceed_if_contact_delta_pos();
        state.try_random_f_swap_and_proceed_if_contact_delta_pos();
        bar.inc(1);
    }
    bar.finish();
    println!(
        "Total number of contacts after {} steps of some random state:",
        num_iterations
    );
    state.print_total_num_of_contacts();
    state.print_num_of_contacts_per_person();
}

pub fn run_simulated_annealing_contacts_algorithm(mut state: State, num_iterations: u32) {
    println!("Total number of contacts in initial state for simulated annealing (contacts optimizing version):");
    state.print_total_num_of_contacts();
    state.print_num_of_contacts_per_person();
    state.print_total_penalty();
    state.print_penalty_per_person();
    let t_start: f64 = 1000.0;
    let t_end: f64 = 0.001;
    let mut temp = t_start;

    let lambda = (t_start / t_end).powf(1.0 / num_iterations as f64);

    println!("Starting temperature: {}", temp);
    println!("Temperature reduction factor lambda: {}", lambda);
    let bar = ProgressBar::new(num_iterations as u64);
    for _ in 0..num_iterations {
        state.perform_simulated_annealing_step(temp);
        temp /= lambda;
        bar.inc(1);
    }
    bar.finish();
    println!(
        "Total number of contacts after {} steps of simulated annealing (contacts optimizing version):",
        num_iterations
    );
    state.print_total_num_of_contacts();
    state.print_num_of_contacts_per_person();
    state.print_total_penalty();
    state.print_penalty_per_person();
    println!("End temperature: {}", temp);
}

pub fn run_simulated_annealing_penalty_algorithm(mut state: State, num_iterations: u32) {
    println!(
        "Total number of contacts in initial state for simulated annealing (penalty version):"
    );
    state.print_total_num_of_contacts();
    state.print_num_of_contacts_per_person();
    state.print_total_penalty();
    state.print_penalty_per_person();
    let t_start: f64 = 10000.0;
    let t_end: f64 = 0.01;
    let mut temp = t_start;

    let lambda = (t_start / t_end).powf(1.0 / num_iterations as f64);

    println!("Starting temperature: {}", temp);
    println!("Temperature reduction factor lambda: {}", lambda);
    let bar = ProgressBar::new(num_iterations as u64);
    for _ in 0..num_iterations {
        state.perform_simulated_annealing_penalty_version_step(temp);
        temp /= lambda;
        bar.inc(1);
    }
    bar.finish();
    println!(
        "Total number of contacts after {} steps of simulated annealing (penalty version):",
        num_iterations
    );
    state.print_total_num_of_contacts();
    state.print_num_of_contacts_per_person();
    state.print_total_penalty();
    state.print_penalty_per_person();
    println!("End temperature: {}", temp);
}

pub fn run_combined_algorithm(mut state: State, num_iterations: u32) {
    println!(
        "Total number of contacts in initial state for simulated annealing (combined version):"
    );
    state.print_total_num_of_contacts();
    state.print_num_of_contacts_per_person();
    state.print_total_penalty();
    state.print_penalty_per_person();
    let t_start: f64 = 1000.0;
    let t_end: f64 = 0.001;
    let mut temp = t_start;

    let lambda = (t_start / t_end).powf(1.0 / num_iterations as f64);

    println!("Starting temperature: {}", temp);
    println!("Temperature reduction factor lambda: {}", lambda);

    let bar = ProgressBar::new(num_iterations as u64);
    for _ in 0..10 {
        temp *= 5.0;
        for _ in 0..num_iterations / 10 {
            state.perform_simulated_annealing_penalty_version_step(temp);
            temp /= lambda;
            bar.inc(1);
        }
        temp /= 5.0;
        for _ in 0..num_iterations / 10 {
            state.perform_simulated_annealing_step(temp);
            temp /= lambda;
            bar.inc(1);
        }
    }
    bar.finish();

    println!(
        "Total number of contacts after {} steps of simulated annealing (combined version):",
        num_iterations
    );
    state.print_total_num_of_contacts();
    state.print_num_of_contacts_per_person();
    state.print_total_penalty();
    state.print_penalty_per_person();
    println!("End temperature: {}", temp);
    state.print_state();
    state.write_state_to_csv();
}

pub fn run_algorithms() {
    let num_iterations = 500000;

    println!("Starting program...");

    let mut s = State::new(6, 6, 6, 6);
    let num_of_immovable_ms_per_group = vec![1, 0, 1, 1, 1, 1];
    let num_of_immovable_fs_per_group = vec![0, 1, 0, 0, 0, 0];

    s.set_num_of_immovable_ms_per_group(num_of_immovable_ms_per_group);
    s.set_num_of_immovable_fs_per_group(num_of_immovable_fs_per_group);

    s.print_state();

    let time_point = Instant::now();
    run_simulated_annealing_contacts_algorithm(s, num_iterations);
    println!(
        "Simulated annealing algorithm took {} seconds.",
        time_point.elapsed().as_secs_f32()
    );

    let time_point = Instant::now();
    let mut s = State::new(6, 6, 6, 6);
    let num_of_immovable_ms_per_group = vec![1, 0, 1, 1, 1, 1];
    let num_of_immovable_fs_per_group = vec![0, 1, 0, 0, 0, 0];
    s.set_num_of_immovable_ms_per_group(num_of_immovable_ms_per_group);
    s.set_num_of_immovable_fs_per_group(num_of_immovable_fs_per_group);
    run_simulated_annealing_penalty_algorithm(s, num_iterations);
    println!(
        "Simulated annealing algorithm took {} seconds.",
        time_point.elapsed().as_secs_f32()
    );

    let time_point = Instant::now();
    let mut s = State::new(6, 6, 6, 6);
    let num_of_immovable_ms_per_group = vec![1, 0, 1, 1, 1, 1];
    let num_of_immovable_fs_per_group = vec![0, 1, 0, 0, 0, 0];
    s.set_num_of_immovable_ms_per_group(num_of_immovable_ms_per_group);
    s.set_num_of_immovable_fs_per_group(num_of_immovable_fs_per_group);
    run_combined_algorithm(s, num_iterations);
    println!(
        "Simulated annealing algorithm took {} seconds.",
        time_point.elapsed().as_secs_f32()
    );
}

pub fn run_final_algorithm() {
    let num_iterations = 1000000;

    let mut best_start = State::new(5, 3, 3, 10);
    let num_of_immovable_ms_per_group = vec![0, 0, 0, 0, 0];
    let num_of_immovable_fs_per_group = vec![0, 0, 0, 0, 0];
    best_start.set_num_of_immovable_ms_per_group(num_of_immovable_ms_per_group);
    best_start.set_num_of_immovable_fs_per_group(num_of_immovable_fs_per_group);

    let bar = ProgressBar::new(10000);
    for _ in 0..10000 {
        let mut s = State::new(5, 3, 3, 10);
        let num_of_immovable_ms_per_group = vec![0, 0, 0, 0, 0];
        let num_of_immovable_fs_per_group = vec![0, 0, 0, 0, 0];
        s.set_num_of_immovable_ms_per_group(num_of_immovable_ms_per_group);
        s.set_num_of_immovable_fs_per_group(num_of_immovable_fs_per_group);
        if s.curr_num_contacts > best_start.curr_num_contacts {
            best_start = s;
        }
        bar.inc(1);
    }
    bar.finish();
    println!("{}", best_start.curr_num_contacts);

    let time_point = Instant::now();

    run_combined_algorithm(best_start, num_iterations);

    println!(
        "Simulated annealing algorithm took {} seconds.",
        time_point.elapsed().as_secs_f32()
    );
}

pub fn debug() {
    let mut s = State::new(6, 6, 6, 6);
    s.print_state();
    println!("state is valid: {}", s.is_valid());
    let num_of_immovable_ms_per_group = vec![1, 1, 1, 1, 1, 1];
    let num_of_immovable_fs_per_group = vec![1, 1, 0, 0, 0, 0];
    s.set_num_of_immovable_ms_per_group(num_of_immovable_ms_per_group);
    s.set_num_of_immovable_fs_per_group(num_of_immovable_fs_per_group);
    println!(
        "state is valid after adding num immovable people: {}",
        s.is_valid()
    );
    println!("false = {}", false);
    println!("true = {}", true);
    s.print_state();
}

#[test]
fn test_run_random_hillclimbing_algorithm() {
    let state = State::new(2, 2, 2, 2);
    let _initial_contacts = state.curr_num_contacts;
    run_random_hillclimbing_algorithm(state, 100);
    // We can't be sure it will be greater, but it should run without errors.
    // A more complex test could check if the final contacts are >= initial_contacts.
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::State;

    #[test]
    fn run_all_subroutine_tests() {
        // test_run_random_hillclimbing_algorithm
        let state_hill = State::new(2, 2, 2, 2);
        run_random_hillclimbing_algorithm(state_hill, 100);

        // test_run_simulated_annealing_contacts_algorithm
        let state_contacts = State::new(2, 2, 2, 2);
        run_simulated_annealing_contacts_algorithm(state_contacts, 100);

        // test_run_simulated_annealing_penalty_algorithm
        let state_penalty = State::new(2, 2, 2, 2);
        run_simulated_annealing_penalty_algorithm(state_penalty, 100);
    }
}
