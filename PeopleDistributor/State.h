#pragma once
#include <iostream>
#include <vector>
#include <stdexcept>
#include <random>
#include <stdint.h>
#include <ctime>
#include <fstream>


class State
{
private:

	// For fast generation of good pseudorandom numbers this 
	// xorshift 128 generator will be used
	struct xorshift128p_state {
		uint64_t a, b;
	};

	xorshift128p_state rnd_state;

	// The state must be seeded so that it is not all zero
	uint64_t xorshift128p(struct xorshift128p_state* state)
	{
		uint64_t t = state->a;
		uint64_t const s = state->b;
		state->a = s;
		t ^= t << 23;		// a
		t ^= t >> 17;		// b
		t ^= s ^ (s >> 26);	// c
		state->b = t;
		return t + s;
	}

	// These are the 4 main variables defined during the creation of the object
	// every "day" the groups get redistributed
	unsigned int number_of_groups;
	unsigned int number_of_males_per_group;
	unsigned int number_of_females_per_group;
	unsigned int number_of_days;

	// These 3-dimensional vectors store all the information about the state
	// meaning exactly which group each person is in during every single day
	std::vector<std::vector<std::vector<unsigned int>>> m_day_group_person;
	std::vector<std::vector<std::vector<unsigned int>>> f_day_group_person;

	// This is used in a not very elegant way of "freezing" a certain number of people 
	// in each group that was implemented last minute
	// The "immovable" people will never change group
	std::vector<unsigned int> m_number_of_immovable_people_per_group;
	std::vector<unsigned int> f_number_of_immovable_people_per_group;

	// These methods just initialize two vectors of sequential numbers 
	// Each of the numbers is going to represent one person
	std::vector<unsigned int> create_male_numbers_vector(unsigned int total_males);
	std::vector<unsigned int> create_female_numbers_vector(unsigned int total_females, 
		unsigned int total_males);

	// To understand why the following in necessary, a little explanation of the
	// algorithm will be given.
	// The simulated annealing algorithm makes billions of random changes to 
	// the "state" i.e. the distribution of people into groups and then clalculates
	// the change in the function to maximize (the total number of contacts). 
	// The problem is, evalutaing this function for a given state is quite complex 
	// and will, using a trivial way of doing so, require quite a bit of computing 
	// time. The algorithm requires billions of iterations to make any sense, which
	// would just take too long using that approach.
	// Thats why the state object not only stores the current distribution of 
	// people, but also how many times each person has been in the 
	// same group as each other person. Then after a change is made to the state
	// only the change of contacts in the affected groups has to be calculated,
	// greatly increasing the speed of evaluating the function after each iteration.
	// The two dimensional vactor curr_contacts tracks how many times each person 
	// has been in the same group with each other person. It is a symmetrical matrix
	// and the diagonal elements obviously don't matter. Because the direction of the
	// contact doesn't matter (A sees B) == (B sees A) in theory only the triangle
	// matrix has to be stored, but the nature of how some of the state change 
	// mechanics are implemented require both halves to be filled. (It's not very clean)
	std::vector<std::vector<unsigned int>> curr_contacts;
	
	// Just a variable storing the result of the target function for the current state.
	int curr_num_contacts;

	float average_contacts_per_person();

	// These methods return how the target function would change if two m or f persons
	// would swap groups on a certain day. The simulated annealing algorithm needs to know this 
	// to decide whether or not to execute the swap.
	int contact_delta_of_swap_m(unsigned int day, unsigned int male_group1, unsigned int male1, 
		unsigned int male_group2, unsigned int male2);
	int contact_delta_of_swap_f(unsigned int day, unsigned int female_group1, unsigned int female1, 
		unsigned int female_group2, unsigned int female2);

	// These methods actually execute a swap in the state
	void swap_m(unsigned int day, unsigned int male_group1, unsigned int male1, 
		unsigned int male_group2, unsigned int male2);
	void swap_f(unsigned int day, unsigned int female_group1, unsigned int female1, 
		unsigned int female_group2, unsigned int female2);

public:
	State();
	State(unsigned int number_of_groups, unsigned int number_of_males_per_group, 
		unsigned int number_of_females_per_group, unsigned int number_of_days);
	~State();

	// ALARM: THIS INITIALIZING ROUTINE IS NOT GERERALLY USABLE
	// A little explanation why: Initializing the state with completely 
	// sequential numbers and perfect order in the beginning will lead to
	// the hillclimbing and even the simulated annealing algorithm to
	// hit a very poor local maximum very early, therefore
	// only the first day will be initialized sequentially and the remaining 
	// days will be randomly scrambled initially. This random scrambling 
	// leads to the algorithms finding much better local maxima.
	// To implement the "number of immovable people" the immovable part must
	// of course not be scrambled. The way this is implemented currently 
	// is very hacky and unfortunately
	// HARD CODED FOR THE CURRENT INITILIZING PARAMETERS IN MAIN!
	// THIS MEANS THIS WONT CURRENTLY WORK CORRECTLY FOR ARBITRARY INITIALIZE
	// PARAMETERS!
	void initialize(unsigned int number_of_groups, unsigned int number_of_males_per_group,
		unsigned int number_of_females_per_group, unsigned int number_of_days);

	void add_number_of_immovable_males_per_group(std::vector<unsigned int> number_of_immovable_males_per_group);
	void add_number_of_immovable_females_per_group(std::vector<unsigned int> number_of_immovable_females_per_group);

	void try_random_male_swap_and_proceed_if_contact_delta_pos();
	void try_random_female_swap_and_proceed_if_contact_delta_pos();

	void perform_simulated_annealing_step(double temp);

	void print_number_of_contacts_per_person();
	void print_total_number_of_contacts();
	void print_random_number();

	void print_state();
	void write_state_to_csv();

	double random();
	

};


