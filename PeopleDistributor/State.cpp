#include "State.h"


std::vector<unsigned int> State::create_male_numbers_vector(unsigned int total_males)
{
	std::vector<unsigned int> males(total_males, 0);
	for (unsigned int i = 0; i < total_males; ++i) {
		males[i] = i;
	}
	return males;
}

std::vector<unsigned int> State::create_female_numbers_vector(unsigned int total_females, 
	unsigned int total_males)
{
	std::vector<unsigned int> females(total_females, 0);
	for (unsigned int i = 0; i < total_females; ++i) {
		females[i] = total_males + i;
	}
	return females;
}

float State::average_contacts_per_person()
{
	return (static_cast<float>(curr_num_contacts)*2.0f)/ (number_of_groups * 
		(number_of_males_per_group + number_of_females_per_group));
}

int State::contact_delta_of_swap_m(unsigned int day, unsigned int male_group1, unsigned int male1, 
	unsigned int male_group2, unsigned int male2)
{
	if (male_group1 == male_group2) {
		return 0;
	}
	int contact_delta = 0;

	// Else: calculate how the contact matrix would change if the two were changed.
	// Calculate losses of contacts of male1
	unsigned int male1_num = m_day_group_person[day][male_group1][male1];
	for (unsigned int male_in_group1 = 0; male_in_group1 < number_of_males_per_group; ++male_in_group1) {
		if (curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male1_num] == 0) {
			throw std::runtime_error("curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male1_num] == 0 ASSUMPTION FALSE, THIS SHOULDN't BE POSSIBLE!");
		}
		if (curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male1_num] == 1){
			contact_delta--;
		}
	}
	// Calculate losses of contacts of male2
	unsigned int male2_num = m_day_group_person[day][male_group2][male2];
	for (unsigned int male_in_group2 = 0; male_in_group2 < number_of_males_per_group; ++male_in_group2) {
		if (curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male2_num] == 0) {
			throw std::runtime_error("curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male2_num] == 0 ASSUMPTION FALSE, THIS SHOULDN't BE POSSIBLE!");
		}
		if (curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male2_num] == 1) {
			contact_delta--;
		}
	}

	// Calculate newly gained contacts of male1
	for (unsigned int male_in_group2 = 0; male_in_group2 < number_of_males_per_group; ++male_in_group2) {
		if (curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male1_num] == 0) {
			// The following if is necessary because the person who just left the group is not going to be met
			if (male_in_group2 != male2) {
				contact_delta++;
			}
		}
	}
	// Calculate newly gained contacts of male2
	for (unsigned int male_in_group1 = 0; male_in_group1 < number_of_males_per_group; ++male_in_group1) {
		if (curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male2_num] == 0) {
			// The following if is necessary because the person who just left the group is not going to be met
			if (male_in_group1 != male1) {
				contact_delta++;
			}
		}
	}

	return contact_delta;
}

int State::contact_delta_of_swap_f(unsigned int day, unsigned int female_group1, 
	unsigned int female1, unsigned int female_group2, unsigned int female2)
{
	if (female_group1 == female_group2) {
		return 0;
	}
	int contact_delta = 0;

	// Else: calculate how the contact matrix would change if the two were changed.
	// Calculate losses of contacts of female1
	unsigned int female1_num = f_day_group_person[day][female_group1][female1];
	for (unsigned int female_in_group1 = 0; female_in_group1 < number_of_females_per_group; ++female_in_group1) {
		//if (curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female1_num] == 0) {
		//	throw std::runtime_error("curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female1_num] == 0 ASSUMPTION FALSE, THIS SHOULDN't BE POSSIBLE!");
		//}
		if (curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female1_num] == 1) {
			contact_delta--;
		}
	}
	// Calculate losses of contacts of female2
	unsigned int female2_num = f_day_group_person[day][female_group2][female2];
	for (unsigned int female_in_group2 = 0; female_in_group2 < number_of_females_per_group; ++female_in_group2) {
		//if (curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female2_num] == 0) {
		//	throw std::runtime_error("curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female2_num] == 0 ASSUMPTION FALSE, THIS SHOULDN't BE POSSIBLE!");
		//}
		if (curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female2_num] == 1) {
			contact_delta--;
		}
	}

	// Calculate newly gained contacts of female1
	for (unsigned int female_in_group2 = 0; female_in_group2 < number_of_females_per_group; ++female_in_group2) {
		if (curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female1_num] == 0) {
			// The following if is necessary because the person who just left the group is not going to be met
			if (female_in_group2 != female2) {
				contact_delta++;
			}
		}
	}
	// Calculate newly gained contacts of female2
	for (unsigned int female_in_group1 = 0; female_in_group1 < number_of_females_per_group; ++female_in_group1) {
		if (curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female2_num] == 0) {
			// The following if is necessary because the person who just left the group is not going to be met
			if (female_in_group1 != female1) {
				contact_delta++;
			}
		}
	}

	return contact_delta;
}

void State::swap_m(unsigned int day, unsigned int male_group1, unsigned int male1, 
	unsigned int male_group2, unsigned int male2)
{
	unsigned int male1_num = m_day_group_person[day][male_group1][male1];
	unsigned int male2_num = m_day_group_person[day][male_group2][male2];
	
	// Swap the two numbers in the state
	m_day_group_person[day][male_group2][male2] = male1_num;
	m_day_group_person[day][male_group1][male1] = male2_num;

	// In this case nothing about the contacts changes
	if (male_group1 == male_group2) {
		return;
	}

	// Else: calculate how the contact matrix changes if the two change.
	// Consider losses of contacts of male1
	for (unsigned int male_in_group1 = 0; male_in_group1 < number_of_males_per_group; ++male_in_group1) {
		if (male_in_group1 != male1) {
			if (curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male1_num] == 0) {
				throw std::runtime_error("curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male1_num] == 0 ASSUMPTION FALSE, THIS SHOULDN't BE POSSIBLE!");
			}
			if (curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male1_num] == 1) {
				curr_num_contacts--;
			}
			curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male1_num]--;
			curr_contacts[male1_num][m_day_group_person[day][male_group1][male_in_group1]]--;
		}
		
	}
	// Consider losses of contacts of male2
	for (unsigned int male_in_group2 = 0; male_in_group2 < number_of_males_per_group; ++male_in_group2) {
		if (male_in_group2 != male2) {
			if (curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male2_num] == 0) {
				throw std::runtime_error("curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male2_num] == 0 ASSUMPTION FALSE, THIS SHOULDN't BE POSSIBLE!");
			}
			if (curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male2_num] == 1) {
				curr_num_contacts--;
			}
			curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male2_num]--;
			curr_contacts[male2_num][m_day_group_person[day][male_group2][male_in_group2]]--;
		}
	}

	// Calculate newly gained contacts of male1
	for (unsigned int male_in_group2 = 0; male_in_group2 < number_of_males_per_group; ++male_in_group2) {
		if (curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male1_num] == 0) {
			// The following if is necessary because the person who just left the group is not going to be met
			if (male_in_group2 != male2) {
				curr_num_contacts++;
			}
		}
		if (male_in_group2 != male2) {
			curr_contacts[m_day_group_person[day][male_group2][male_in_group2]][male1_num]++;
			curr_contacts[male1_num][m_day_group_person[day][male_group2][male_in_group2]]++;
		}
	}
	// Calculate newly gained contacts of male2
	for (unsigned int male_in_group1 = 0; male_in_group1 < number_of_males_per_group; ++male_in_group1) {
		if (curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male2_num] == 0) {
			// The following if is necessary because the person who just left the group is not going to be met
			if (male_in_group1 != male1) {
				curr_num_contacts++;
			}
		}
		if (male_in_group1 != male1) {
			curr_contacts[m_day_group_person[day][male_group1][male_in_group1]][male2_num]++;
			curr_contacts[male2_num][m_day_group_person[day][male_group1][male_in_group1]]++;
		}
	}
}

void State::swap_f(unsigned int day, unsigned int female_group1, unsigned int female1, 
	unsigned int female_group2, unsigned int female2)
{
	unsigned int female1_num = f_day_group_person[day][female_group1][female1];
	unsigned int female2_num = f_day_group_person[day][female_group2][female2];

	// Swap the two numbers in the state
	f_day_group_person[day][female_group2][female2] = female1_num;
	f_day_group_person[day][female_group1][female1] = female2_num;

	// In this case nothing about the contacts changes
	if (female_group1 == female_group2) {
		return;
	}

	// Else: calculate how the contact matrix changes if the two change.
	// Consider losses of contacts of female1
	for (unsigned int female_in_group1 = 0; female_in_group1 < number_of_females_per_group; ++female_in_group1) {
		if (female_in_group1 != female1) {
			if (curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female1_num] == 0) {
				throw std::runtime_error("curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female1_num] == 0 ASSUMPTION FALSE, THIS SHOULDN't BE POSSIBLE!");
			}
			if (curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female1_num] == 1) {
				curr_num_contacts--;
			}
			curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female1_num]--;
			curr_contacts[female1_num][f_day_group_person[day][female_group1][female_in_group1]]--;
		}

	}
	// Consider losses of contacts of female2
	for (unsigned int female_in_group2 = 0; female_in_group2 < number_of_females_per_group; ++female_in_group2) {
		if (female_in_group2 != female2) {
			if (curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female2_num] == 0) {
				throw std::runtime_error("curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female2_num] == 0 ASSUMPTION FALSE, THIS SHOULDN't BE POSSIBLE!");
			}
			if (curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female2_num] == 1) {
				curr_num_contacts--;
			}
			curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female2_num]--;
			curr_contacts[female2_num][f_day_group_person[day][female_group2][female_in_group2]]--;
		}
	}

	// Calculate newly gained contacts of female1
	for (unsigned int female_in_group2 = 0; female_in_group2 < number_of_females_per_group; ++female_in_group2) {
		if (curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female1_num] == 0) {
			// The following if is necessary because the person who just left the group is not going to be met
			if (female_in_group2 != female2) {
				curr_num_contacts++;
			}
		}
		if (female_in_group2 != female2) {
			curr_contacts[f_day_group_person[day][female_group2][female_in_group2]][female1_num]++;
			curr_contacts[female1_num][f_day_group_person[day][female_group2][female_in_group2]]++;
		}
	}
	// Calculate newly gained contacts of female2
	for (unsigned int female_in_group1 = 0; female_in_group1 < number_of_females_per_group; ++female_in_group1) {
		if (curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female2_num] == 0) {
			// The following if is necessary because the person who just left the group is not going to be met
			if (female_in_group1 != female1) {
				curr_num_contacts++;
			}
		}
		if (female_in_group1 != female1) {
			curr_contacts[f_day_group_person[day][female_group1][female_in_group1]][female2_num]++;
			curr_contacts[female2_num][f_day_group_person[day][female_group1][female_in_group1]]++;
		}
	}
}

void State::add_number_of_immovable_males_per_group(std::vector<unsigned int> number_of_immovable_males_per_group)
{
	m_number_of_immovable_people_per_group = number_of_immovable_males_per_group;
}

void State::add_number_of_immovable_females_per_group(std::vector<unsigned int> number_of_immovable_females_per_group)
{
	f_number_of_immovable_people_per_group = number_of_immovable_females_per_group;
}



void State::try_random_male_swap_and_proceed_if_contact_delta_pos()
{
	// Required random numbers and their range: day:			(1 - number_of_days-1)
	//											male_group1:	(0 - number_of_groups-1)
	//											male1:			(0 - number_of_males_per_group)
	//											male_group2:	(0 - number_of_groups-1)
	//											male2:			(0 - number_of_males_per_group)
	unsigned int day = (xorshift128p(&rnd_state) % (number_of_days - 1)) + 1;
	unsigned int male_group1= xorshift128p(&rnd_state) % number_of_groups;
	unsigned int male_group2 = xorshift128p(&rnd_state) % number_of_groups;
	unsigned int male1 = xorshift128p(&rnd_state) % (number_of_males_per_group - m_number_of_immovable_people_per_group[male_group1]) 
		+ m_number_of_immovable_people_per_group[male_group1];
	unsigned int male2 = xorshift128p(&rnd_state) % (number_of_males_per_group - m_number_of_immovable_people_per_group[male_group2]) 
		+ m_number_of_immovable_people_per_group[male_group2];

	if (contact_delta_of_swap_m(day, male_group1, male1, male_group2, male2) >= 0) {
		swap_m(day, male_group1, male1, male_group2, male2);
	}
}

void State::try_random_female_swap_and_proceed_if_contact_delta_pos()
{
	// Required random numbers and their range: day:			(1 - number_of_days-1)
	//											female_group1:	(0 - number_of_groups-1)
	//											female1:			(0 - number_of_females_per_group)
	//											female_group2:	(0 - number_of_groups-1)
	//											female2:			(0 - number_of_females_per_group)
	unsigned int day = (xorshift128p(&rnd_state) % (number_of_days - 1)) + 1;
	unsigned int female_group1 = xorshift128p(&rnd_state) % number_of_groups;
	unsigned int female_group2 = xorshift128p(&rnd_state) % number_of_groups;
	unsigned int female1 = xorshift128p(&rnd_state) % (number_of_females_per_group - 
		f_number_of_immovable_people_per_group[female_group1]) + f_number_of_immovable_people_per_group[female_group1];
	unsigned int female2 = xorshift128p(&rnd_state) % (number_of_females_per_group - 
		f_number_of_immovable_people_per_group[female_group2]) + f_number_of_immovable_people_per_group[female_group2];

	if (contact_delta_of_swap_f(day, female_group1, female1, female_group2, female2) >= 0) {
		swap_f(day, female_group1, female1, female_group2, female2);
	}
}

void State::perform_simulated_annealing_step(double temp)
{
	unsigned int day = (xorshift128p(&rnd_state) % (number_of_days - 1)) + 1;
	unsigned int male_group1 = xorshift128p(&rnd_state) % number_of_groups;
	unsigned int male_group2 = xorshift128p(&rnd_state) % number_of_groups;
	unsigned int male1 = xorshift128p(&rnd_state) % (number_of_males_per_group - 
		m_number_of_immovable_people_per_group[male_group1]) + m_number_of_immovable_people_per_group[male_group1];
	unsigned int male2 = xorshift128p(&rnd_state) % (number_of_males_per_group - 
		m_number_of_immovable_people_per_group[male_group2]) + m_number_of_immovable_people_per_group[male_group2];

	int delta_male = contact_delta_of_swap_m(day, male_group1, male1, male_group2, male2);

	if (delta_male >= 0) {
		swap_m(day, male_group1, male1, male_group2, male2);
	}
	else if ((static_cast<double>(xorshift128p(&rnd_state)) / static_cast<double>(UINT64_MAX)) < 
		exp(static_cast<double>(delta_male) / temp)) {
		swap_m(day, male_group1, male1, male_group2, male2);
	}

	unsigned int female_group1 = xorshift128p(&rnd_state) % number_of_groups;
	unsigned int female_group2 = xorshift128p(&rnd_state) % number_of_groups;
	unsigned int female1 = xorshift128p(&rnd_state) % (number_of_females_per_group - 
		f_number_of_immovable_people_per_group[female_group1]) + f_number_of_immovable_people_per_group[female_group1];
	unsigned int female2 = xorshift128p(&rnd_state) % (number_of_females_per_group - 
		f_number_of_immovable_people_per_group[female_group2]) + f_number_of_immovable_people_per_group[female_group2];

	int delta_female = contact_delta_of_swap_f(day, female_group1, female1, female_group2, female2);
	if (delta_female >= 0) {
		swap_f(day, female_group1, female1, female_group2, female2);
	}
	else if ((static_cast<double>(xorshift128p(&rnd_state)) / static_cast<double>(UINT64_MAX)) < 
		exp(static_cast<double>(delta_female) / temp)) {
		swap_f(day, female_group1, female1, female_group2, female2);
	}
}

State::State(){
	//rnd_state = new xorshift128p_state();
	rnd_state.a = std::time(0);
	rnd_state.b = 1234124124;
}

State::State(unsigned int in_number_of_groups, unsigned int in_number_of_males_per_group,
	unsigned int in_number_of_females_per_group, unsigned int in_number_of_days)
{
	rnd_state.a = std::time(0);
	rnd_state.b = 1234124124;
	initialize(in_number_of_groups, in_number_of_males_per_group, in_number_of_females_per_group, in_number_of_days);
}

State::~State()
{
}

void State::initialize(unsigned int in_number_of_groups, unsigned int in_number_of_males_per_group, 
	unsigned int in_number_of_females_per_group, unsigned int in_number_of_days)
{
	number_of_groups = in_number_of_groups;
	number_of_males_per_group = in_number_of_males_per_group;
	number_of_females_per_group = in_number_of_females_per_group;
	number_of_days = in_number_of_days;

	unsigned int total_people = number_of_groups * (number_of_males_per_group + number_of_females_per_group);
	unsigned int total_males = number_of_groups * number_of_males_per_group;
	unsigned int total_females = number_of_groups * number_of_females_per_group;

	std::vector<unsigned int> m_number_of_immovable_people_per_group(number_of_groups, 0);
	std::vector<unsigned int> f_number_of_immovable_people_per_group(number_of_groups, 0);


	std::vector<std::vector<unsigned int>> vec_curr_c (total_people, std::vector<unsigned int> (total_people, 0));
	curr_contacts = vec_curr_c;

	std::vector<std::vector<std::vector<unsigned int>>>
		vec_m(number_of_days, std::vector<std::vector<unsigned int>>
			(number_of_groups, std::vector<unsigned int>
				(number_of_males_per_group, 0)));

	m_day_group_person = vec_m;

	std::vector<std::vector<std::vector<unsigned int>>>
		vec_f(number_of_days, std::vector<std::vector<unsigned int>>
			(number_of_groups, std::vector<unsigned int>
				(number_of_females_per_group, 0)));

	f_day_group_person = vec_f;

	// Create an initial state:

	// To create an initial state the 3-dimensional vectors m_day_group_person and 
	// f_day_group_person must be completely filled with values. In every 'layer'
	// every number from 0 - total_males - 1 (for m_day_group_person) or 
	// total_males - total_people - 1 (for f_day_group_person respectively) must appear
	// exactly once.
	// In the first layer, they are going to appear in order, in the other layers they
	// will be mixed randomly.

	// Starting with m_day_group_person:
	// Males will be represented by the integers 0 - total_males - 1.
	std::vector<unsigned int> males;
	males = create_male_numbers_vector(total_males);

	// On the first day the people are always ordered
	for (unsigned int person = 0; person < number_of_males_per_group; ++person) { // for each column
	for (unsigned int group = 0; group < number_of_groups; ++group) {   // for each row
			//if (males[0] != number_of_males_per_group * group + person) {
			//	throw std::runtime_error("males[0] != number_of_males_per_group * group + person ASSUMPTION FALSE!");
			//}
			m_day_group_person[0][group][person] = males[0]; //number_of_groups * group + person
			males.erase(males.begin());
		}
	}
	// On the remaining days they get shuffled.
	for (unsigned int day = 1; day < number_of_days; ++day) {	// for each layer
		males = create_male_numbers_vector(total_males);
		// shuffle the vector randomly
		std::random_device random_dev;
		std::mt19937       generator(random_dev());
		// Ugly: doesn't shuffle the parts there the immovable persons sit
		// @@@@@@@@@@@@@@ HARD CODED TO INITIALIZE PARAMETERS FOR THIS PROBLEM!!! @@@@@@@@@@@@@@@@@
		std::shuffle(males.begin()+6, males.end(), generator);
		for (unsigned int person = 0; person < number_of_males_per_group; ++person) { // for each column
			for (unsigned int group = 0; group < number_of_groups; ++group) {   // for each row
			
				m_day_group_person[day][group][person] = males[0]; //number_of_groups * group + person
				males.erase(males.begin());
			}
		}
	}

	// f_day_group_person:
	// Females will be represented by the integers total_males - total_people - 1.
	std::vector<unsigned int> females;
	females = create_female_numbers_vector(total_females, total_males);

	for (unsigned int person = 0; person < number_of_females_per_group; ++person) { // for each column
		for (unsigned int group = 0; group < number_of_groups; ++group) {   // for each row
			//if (females[0] != total_males + number_of_females_per_group * group + person) {
			//	throw std::runtime_error("females[0] != total_males + number_of_females_per_group * group + person ASSUMPTION FALSE!");
			//}
			f_day_group_person[0][group][person] = females[0]; //number_of_groups * group + person
			females.erase(females.begin());
		}
	}
	// On the remaining days they get shuffled.
	for (unsigned int day = 1; day < number_of_days; ++day) {	// for each layer
		females = create_female_numbers_vector(total_females, total_males);
		// shuffle the vector randomly
		std::random_device random_dev;
		std::mt19937       generator(random_dev());
		// Ugly: doesn't shuffle the parts there the immovable persons sit
		// @@@@@@@@@@@@@@ HARD CODED TO INITIALIZE PARAMETERS FOR THIS PROBLEM!!! @@@@@@@@@@@@@@@@@
		std::shuffle(females.begin()+2, females.end(), generator);
		for (unsigned int person = 0; person < number_of_females_per_group; ++person) { // for each column
		for (unsigned int group = 0; group < number_of_groups; ++group) {   // for each row

				f_day_group_person[day][group][person] = females[0]; //number_of_groups * group + person
				females.erase(females.begin());
			}
		}
	}

	// Now the state is randomly initialized and only the contacts matrix must be still updated.
	// This can easily be done in a loop:
	curr_num_contacts = 0;
	bool new_contact;

	for (unsigned int day = 0; day < number_of_days; ++day) {
		for (unsigned int group = 0; group < number_of_groups; ++group) {
			for (unsigned int male1 = 0; male1 < number_of_males_per_group; ++male1) {
				// All the males that see each other
				for (unsigned int male2 = 0; male2 < number_of_males_per_group; ++male2) {
					if (curr_contacts[m_day_group_person[day][group][male1]][m_day_group_person[day][group][male2]] == 0) {
						new_contact = true;
					}
					else {
						new_contact = false;
					}
					curr_contacts[m_day_group_person[day][group][male1]][m_day_group_person[day][group][male2]]++;
					if (new_contact) {
						if (m_day_group_person[day][group][male1] < m_day_group_person[day][group][male2]) {
							curr_num_contacts++;
						}
					}
				}
				// All the females the males see
				for (unsigned int female2 = 0; female2 < number_of_females_per_group; ++female2) {
					if (curr_contacts[m_day_group_person[day][group][male1]][f_day_group_person[day][group][female2]] == 0) {
						new_contact = true;
					}
					else {
						new_contact = false;
					}
					curr_contacts[m_day_group_person[day][group][male1]][f_day_group_person[day][group][female2]]++;
					// To make the matrix properly symmetrical (necessary so the swap functions work correctly):
					curr_contacts[f_day_group_person[day][group][female2]][m_day_group_person[day][group][male1]]++;
					if (new_contact) {
						curr_num_contacts++;
					}
				}
			}
			for (unsigned int female1 = 0; female1 < number_of_females_per_group; ++female1) {
				// All the females that see each other
				for (unsigned int female2 = 0; female2 < number_of_females_per_group; ++female2) {
					if (curr_contacts[f_day_group_person[day][group][female1]][f_day_group_person[day][group][female2]] == 0) {
						new_contact = true;
					}
					else {
						new_contact = false;
					}
					curr_contacts[f_day_group_person[day][group][female1]][f_day_group_person[day][group][female2]]++;
					if (new_contact) {
						if (f_day_group_person[day][group][female1] < f_day_group_person[day][group][female2]) {
							curr_num_contacts++;
						}
					}
				}
			}
		}
	}
}

void State::print_number_of_contacts_per_person()
{
	std::cout << "Average contacts per person in the current state: " << average_contacts_per_person() << std::endl;
}

void State::print_total_number_of_contacts()
{
	std::cout << "Total contacts in the current state: " << curr_num_contacts << std::endl;
}

void State::print_random_number()
{
	std::cout << "Random number: " << (xorshift128p(&rnd_state)%6)+1 << std::endl;
}

void State::print_state()
{
	for (unsigned int day = 0; day < number_of_days; ++day) {
		for (unsigned int male = 0; male < number_of_males_per_group; ++male) {
			for (unsigned int group = 0; group < number_of_groups; ++group) {
				std::cout << m_day_group_person[day][group][male] << "	";
			}
			std::cout << "\n";
		}
		for (unsigned int female = 0; female < number_of_females_per_group; ++female) {
			for (unsigned int group = 0; group < number_of_groups; ++group) {
				std::cout << f_day_group_person[day][group][female] << "	";
			}
			std::cout << "\n";
		}
		std::cout << "\n";
	}
}

void State::write_state_to_csv()
{
	std::ofstream ocsv;
	ocsv.open("Data.csv");
	for (unsigned int day = 0; day < number_of_days; ++day) {
		for (unsigned int male = 0; male < number_of_males_per_group; ++male) {
			for (unsigned int group = 0; group < number_of_groups; ++group) {
				ocsv << m_day_group_person[day][group][male] << ",";
			}
			ocsv << "\n";
		}
		for (unsigned int female = 0; female < number_of_females_per_group; ++female) {
			for (unsigned int group = 0; group < number_of_groups; ++group) {
				ocsv << f_day_group_person[day][group][female] << ",";
			}
			ocsv << "\n";
		}
		ocsv << "\n";
	}
	ocsv.close();
}

double State::random()
{
	return static_cast<double>(xorshift128p(&rnd_state))/ static_cast<double>(UINT64_MAX);
}
