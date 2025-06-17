mod state;
mod subroutines;

fn main() {
    println!("Starting PeopleDistributor...");
    subroutines::run_final_algorithm();
    println!("...PeopleDistributor finished.");
}
