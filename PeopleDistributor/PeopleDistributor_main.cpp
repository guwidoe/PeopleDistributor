#include <iostream>
#include <unordered_set>
#include <chrono>
#include <ctime>

#include "State.h"
#include "subroutines.h"


int main() {
  long long time_span;
  unsigned int num_iterations = 5000000;

  std::cout << "Starting program...\n";

  State s;
  s.initialize(6, 6, 6, 6);
  std::vector<unsigned int> num_of_immovable_ms_per_group{ 1,0,1,1,1,1 };
  std::vector<unsigned int> num_of_immovable_fs_per_group{ 0,1,0,0,0,0 };

  s.add_num_of_immovable_ms_per_group(num_of_immovable_ms_per_group);
  s.add_num_of_immovable_fs_per_group(num_of_immovable_fs_per_group);

  s.print_state();

  std::chrono::high_resolution_clock::time_point time_point = 
    std::chrono::high_resolution_clock::now();

  //run_random_hillclimbing_algorithm(s, num_iterations);

  time_span = std::chrono::duration_cast<std::chrono::microseconds>
    (std::chrono::high_resolution_clock::now() - time_point).count();
  std::cout << "Hillclimbing algorithm took " << static_cast<float>
    (time_span) / 1000000.0 << " seconds." << std::endl << std::endl;

  time_point = std::chrono::high_resolution_clock::now();

  run_simulated_annealing_algorithm(s, num_iterations);

  time_span = std::chrono::duration_cast<std::chrono::microseconds>
    (std::chrono::high_resolution_clock::now() - time_point).count();
  std::cout << "Simulated annealing algorithm took " << static_cast<float>
    (time_span) / 1000000.0 << " seconds." << std::endl;

}
