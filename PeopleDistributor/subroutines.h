#pragma once

#include <iostream>

#include "State.h"


void run_random_hillclimbing_algorithm(State hill_climbing, 
                                       unsigned int num_iterations);

void run_simulated_annealing_algorithm(State simulated_annealing, 
                                       unsigned int num_iterations);

