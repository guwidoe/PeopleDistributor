#include <iostream>
#include <unordered_set>
#include <chrono>
#include <ctime>

#include "State.h"
#include "subroutines.h"


int main()
{
    long long time_span;
    unsigned int number_of_iterations = 10000000;

    std::cout << "Starting program...\n";

    State s;
    s.initialize(6, 6, 6, 6);
    std::vector<unsigned int> number_of_immovable_males_per_group{ 1,0,1,1,1,1 };
    std::vector<unsigned int> number_of_immovable_females_per_group{ 0,1,0,0,0,0 };

    s.add_number_of_immovable_males_per_group(number_of_immovable_males_per_group);
    s.add_number_of_immovable_females_per_group(number_of_immovable_females_per_group);

    s.print_state();

    std::chrono::high_resolution_clock::time_point time_point = std::chrono::high_resolution_clock::now();

    //run_random_hillclimbing_algorithm(s, number_of_iterations);

    time_span = std::chrono::duration_cast<std::chrono::microseconds>
        (std::chrono::high_resolution_clock::now() - time_point).count();
    std::cout << "Hillclimbing algorithm took " << static_cast<float>
        ( time_span)/1000000.0 << " seconds." << std::endl << std::endl;

    time_point = std::chrono::high_resolution_clock::now();

    run_simulated_annealing_algorithm(s, number_of_iterations);

    time_span = std::chrono::duration_cast<std::chrono::microseconds>
        (std::chrono::high_resolution_clock::now() - time_point).count();
    std::cout << "Simulated annealing algorithm took " << static_cast<float>
        (time_span) / 1000000.0 << " seconds." << std::endl;

}
