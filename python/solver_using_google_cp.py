from ortools.sat.python import cp_model
import collections
import time


def solve_group_scheduling():
    """
    Solves the social group scheduling problem using the CP-SAT solver.

    This function models the problem by defining variables, constraints, and the
    objective, then uses the OR-Tools solver to find an optimal solution.
    """
    # ==============================================================================
    # 1. Problem Configuration
    # ==============================================================================
    # --- People and their attributes ---
    # We use a simple list of people IDs. Attributes are stored separately.
    people = [f"p{i}" for i in range(30)]  # 30 people in total
    genders = {p: "male" if i < 15 else "female" for i, p in enumerate(people)}

    # --- Groups and Sessions ---
    num_groups = 5
    group_size = 6  # Each group must have exactly 6 people
    num_sessions = 10  # Number of days/rounds

    # --- Constraints and Objectives Configuration ---
    # Pairs of people who should never be in the same group
    conflict_pairs = {("p0", "p1"), ("p5", "p6")}

    # People who must be in a specific group on a specific day
    immovable_assignments = {
        # (person, session, group): True
        ("p2", 0, 0): True,
        ("p3", 0, 0): True,
    }

    # Desired gender balance for each group (soft constraint)
    # The penalty will be applied for each person deviation from this target.
    desired_gender_balance = {"male": 3, "female": 3}
    gender_balance_penalty_weight = 10  # How much to penalize imbalance

    # --- Solver Configuration ---
    solver_time_limit_seconds = 60.0

    # ==============================================================================
    # 2. Model Creation
    # ==============================================================================
    model = cp_model.CpModel()

    # Create a variable lookup (person_id -> index)
    p_indices = {person: i for i, person in enumerate(people)}
    num_people = len(people)

    # --- Core Variables ---
    # `assignments[(p, s, g)]` is a boolean variable, true if person `p`
    # is in group `g` in session `s`.
    assignments = {}
    for p_idx in range(num_people):
        for s in range(num_sessions):
            for g in range(num_groups):
                assignments[(p_idx, s, g)] = model.NewBoolVar(
                    f"assign_p{p_idx}_s{s}_g{g}"
                )

    # ==============================================================================
    # 3. Constraint Implementation
    # ==============================================================================
    print("Adding constraints...")

    # --- Each person must be in exactly one group per session ---
    for p_idx in range(num_people):
        for s in range(num_sessions):
            model.AddExactlyOne([assignments[(p_idx, s, g)] for g in range(num_groups)])

    # --- Each group must have an exact size per session ---
    for s in range(num_sessions):
        for g in range(num_groups):
            model.Add(
                sum(assignments[(p_idx, s, g)] for p_idx in range(num_people))
                == group_size
            )

    # --- Handle immovable people (fixed assignments) ---
    for (person_id, session, group), is_assigned in immovable_assignments.items():
        if is_assigned:
            p_idx = p_indices[person_id]
            model.Add(assignments[(p_idx, session, group)] == 1)

    # --- Handle conflict pairs (people who can't be together) ---
    for s in range(num_sessions):
        for g in range(num_groups):
            for p1_id, p2_id in conflict_pairs:
                p1_idx, p2_idx = p_indices[p1_id], p_indices[p2_id]
                # At most one of them can be in this group.
                model.AddAtMostOne(
                    [assignments[(p1_idx, s, g)], assignments[(p2_idx, s, g)]]
                )

    # ==============================================================================
    # 4. Objective Function: Maximize Unique Contacts & Penalize Imbalance
    # ==============================================================================
    print("Building the objective function...")

    # --- Create variables to track unique encounters ---
    # `met_at_least_once[(p1, p2)]` is true if p1 and p2 meet at all.
    met_at_least_once = {}
    for p1_idx in range(num_people):
        for p2_idx in range(p1_idx + 1, num_people):
            met_at_least_once[(p1_idx, p2_idx)] = model.NewBoolVar(
                f"met_{p1_idx}_{p2_idx}"
            )

            # --- Link `met_at_least_once` to `assignments` ---
            # For each pair of people, create intermediate booleans `met_on_day_s`
            # `met_on_day_s` is true if they are in the same group on day `s`.
            met_on_day = []
            for s in range(num_sessions):
                met_on_day_s_g = []
                for g in range(num_groups):
                    # `b` is true if both p1 and p2 are in group g on session s
                    b = model.NewBoolVar(f"met_{p1_idx}_{p2_idx}_s{s}_g{g}")
                    model.AddBoolAnd(
                        [assignments[(p1_idx, s, g)], assignments[(p2_idx, s, g)]]
                    ).OnlyEnforceIf(b)
                    model.AddImplication(b, assignments[(p1_idx, s, g)])
                    model.AddImplication(b, assignments[(p2_idx, s, g)])
                    met_on_day_s_g.append(b)

                # They meet on day s if they meet in any group
                met_this_day = model.NewBoolVar(f"met_{p1_idx}_{p2_idx}_s{s}")
                model.AddBoolOr(met_on_day_s_g).OnlyEnforceIf(met_this_day)
                model.AddImplication(
                    met_this_day, model.NewBoolVar("").Not()
                )  # This is a trick to make it work

                met_on_day.append(met_this_day)

            # `met_at_least_once` is true if they meet on any day.
            model.AddBoolOr(met_on_day).OnlyEnforceIf(
                met_at_least_once[(p1_idx, p2_idx)]
            )
            model.AddImplication(
                met_at_least_once[(p1_idx, p2_idx)], model.NewBoolVar("").Not()
            )

    # --- Define the total number of unique contacts ---
    total_unique_contacts = model.NewIntVar(
        0, num_people * (num_people - 1) // 2, "total_unique_contacts"
    )
    model.Add(total_unique_contacts == sum(met_at_least_once.values()))

    # --- Calculate penalties for gender imbalance (soft constraint) ---
    total_penalty = model.NewIntVar(
        0, 10000, "total_penalty"
    )  # A large enough upper bound
    penalties = []
    for s in range(num_sessions):
        for g in range(num_groups):
            # Count males and females in this group
            males_in_group = [
                assignments[(p_idx, s, g)]
                for p_idx, p_id in enumerate(people)
                if genders[p_id] == "male"
            ]
            females_in_group = [
                assignments[(p_idx, s, g)]
                for p_idx, p_id in enumerate(people)
                if genders[p_id] == "female"
            ]

            # Calculate deviation from the desired count
            male_deviation = model.NewIntVar(
                -group_size, group_size, f"male_dev_s{s}_g{g}"
            )
            model.Add(
                male_deviation == sum(males_in_group) - desired_gender_balance["male"]
            )

            female_deviation = model.NewIntVar(
                -group_size, group_size, f"female_dev_s{s}_g{g}"
            )
            model.Add(
                female_deviation
                == sum(females_in_group) - desired_gender_balance["female"]
            )

            # Use absolute values for penalty
            abs_male_dev = model.NewIntVar(0, group_size, f"abs_male_dev_s{s}_g{g}")
            model.AddAbsEquality(abs_male_dev, male_deviation)
            penalties.append(abs_male_dev)

            abs_female_dev = model.NewIntVar(0, group_size, f"abs_female_dev_s{s}_g{g}")
            model.AddAbsEquality(abs_female_dev, female_deviation)
            penalties.append(abs_female_dev)

    model.Add(total_penalty == sum(penalties))

    # --- Set the final objective function ---
    # We want to maximize contacts and minimize penalty.
    # Maximize(A - B) is equivalent to Maximize(A - k*B) where k is a weight.
    model.Maximize(
        total_unique_contacts - gender_balance_penalty_weight * total_penalty
    )

    # ==============================================================================
    # 5. Solve and Display Results
    # ==============================================================================
    print("Solving...")
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = solver_time_limit_seconds
    solver.parameters.log_search_progress = True  # Show solver logs

    start_time = time.time()
    status = solver.Solve(model)
    end_time = time.time()

    print("-" * 30)
    print(f"Solving finished in {end_time - start_time:.2f} seconds.")

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        print(f"Objective value (Contacts - Penalty*Weight): {solver.ObjectiveValue()}")
        print(f"Total Unique Contacts: {solver.Value(total_unique_contacts)}")
        print(f"Total Penalty Score: {solver.Value(total_penalty)}")
        print("-" * 30)
        print("Schedule:")

        schedule = collections.defaultdict(lambda: collections.defaultdict(list))
        for s in range(num_sessions):
            for g in range(num_groups):
                for p_idx, p_id in enumerate(people):
                    if solver.Value(assignments[(p_idx, s, g)]) == 1:
                        schedule[s][g].append(p_id)

        for s in sorted(schedule.keys()):
            print(f"\n--- Session {s} ---")
            for g in sorted(schedule[s].keys()):
                group_members = sorted(schedule[s][g], key=lambda x: int(x[1:]))
                print(f"  Group {g}: {group_members}")
    else:
        print("No solution found.")
        print(f"Solver status: {solver.StatusName(status)}")


# --- Run the solver ---
if __name__ == "__main__":
    solve_group_scheduling()
