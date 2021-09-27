#include "subroutines.h"

void run_random_hillclimbing_algorithm(State hill_climbing, unsigned int number_of_iterations) {
    std::cout << "Total number of contacts in initial state for hill climbing:\n";
    hill_climbing.print_total_number_of_contacts();
    hill_climbing.print_number_of_contacts_per_person();
    for (unsigned long int i = 0; i < number_of_iterations; ++i) {
        hill_climbing.try_random_male_swap_and_proceed_if_contact_delta_pos();
        hill_climbing.try_random_female_swap_and_proceed_if_contact_delta_pos();
    }
    std::cout << "Total number of contacts after " << number_of_iterations << 
        " steps of some random hillclimbing:\n";
    hill_climbing.print_total_number_of_contacts();
    hill_climbing.print_number_of_contacts_per_person();
}

void run_simulated_annealing_algorithm(State simulated_annealing, unsigned int number_of_iterations) {
    std::cout << "Total number of contacts in initial state for simulated annealing:\n";
    simulated_annealing.print_total_number_of_contacts();
    simulated_annealing.print_number_of_contacts_per_person();
    double t_start = 1000.0;
    double t_end = 0.001;
    double temp = t_start;

    double lambda = pow(t_start / t_end, 1.0 / static_cast<double>(number_of_iterations));

    std::cout << "Starting temperature: " << temp << std::endl;
    std::cout << "Temperature reduction factor lambda: " << lambda << std::endl;
    for (unsigned long int i = 0; i < number_of_iterations; ++i) {
        simulated_annealing.perform_simulated_annealing_step(temp);
        temp = temp / lambda;
    }
    std::cout << "Total number of contacts after " << number_of_iterations << " steps of simulated annealing:\n";
    simulated_annealing.print_total_number_of_contacts();
    simulated_annealing.print_number_of_contacts_per_person();
    std::cout << "End temperature: " << temp << std::endl << std::endl << "Simulated annealing result: \n";
    simulated_annealing.print_state();
    simulated_annealing.write_state_to_csv();
}