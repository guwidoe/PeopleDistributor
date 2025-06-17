use rand::seq::SliceRandom;
use rand::Rng;

pub struct Xorshift128pState {
    a: u64,
    b: u64,
}

impl Xorshift128pState {
    pub fn new() -> Self {
        let mut rng = rand::rng();
        Self {
            a: rng.random(),
            b: rng.random(),
        }
    }

    pub fn next(&mut self) -> u64 {
        let mut t = self.a;
        let s = self.b;
        self.a = s;
        t ^= t << 23;
        t ^= t >> 17;
        t ^= s ^ (s >> 26);
        self.b = t;
        t.wrapping_add(s)
    }
}

pub struct State {
    num_of_groups: u32,
    num_ms_per_group: u32,
    num_fs_per_group: u32,
    num_of_days: u32,

    m_day_group_person: Vec<u32>,
    f_day_group_person: Vec<u32>,

    m_num_of_immovable_people_per_group: Vec<u32>,
    f_num_of_immovable_people_per_group: Vec<u32>,

    curr_contacts: Vec<Vec<u32>>,
    pub curr_num_contacts: i32,
    pub curr_penalty: i32,

    rnd_state: Xorshift128pState,
}

impl State {
    pub fn new(
        num_of_groups: u32,
        num_ms_per_group: u32,
        num_fs_per_group: u32,
        num_of_days: u32,
    ) -> Self {
        let mut state = Self {
            num_of_groups: 0,
            num_ms_per_group: 0,
            num_fs_per_group: 0,
            num_of_days: 0,
            m_day_group_person: Vec::new(),
            f_day_group_person: Vec::new(),
            m_num_of_immovable_people_per_group: Vec::new(),
            f_num_of_immovable_people_per_group: Vec::new(),
            curr_contacts: Vec::new(),
            curr_num_contacts: 0,
            curr_penalty: 0,
            rnd_state: Xorshift128pState::new(),
        };
        state.initialize(
            num_of_groups,
            num_ms_per_group,
            num_fs_per_group,
            num_of_days,
        );
        state
    }

    pub fn initialize(
        &mut self,
        num_of_groups: u32,
        num_ms_per_group: u32,
        num_fs_per_group: u32,
        num_of_days: u32,
    ) {
        self.num_of_groups = num_of_groups;
        self.num_ms_per_group = num_ms_per_group;
        self.num_fs_per_group = num_fs_per_group;
        self.num_of_days = num_of_days;

        let total_ms = num_of_groups * num_ms_per_group;
        let total_fs = num_of_groups * num_fs_per_group;
        let total_people = total_ms + total_fs;

        self.m_num_of_immovable_people_per_group = vec![0; num_of_groups as usize];
        self.f_num_of_immovable_people_per_group = vec![0; num_of_groups as usize];

        self.curr_contacts = vec![vec![0; total_people as usize]; total_people as usize];

        self.m_day_group_person =
            vec![0; (num_of_days * num_of_groups * num_ms_per_group) as usize];
        self.f_day_group_person =
            vec![0; (num_of_days * num_of_groups * num_fs_per_group) as usize];

        let ms = self.create_m_nums_vec(total_ms);
        let fs = self.create_f_nums_vec(total_fs, total_ms);

        for group in 0..num_of_groups as usize {
            for person in 0..num_ms_per_group as usize {
                self.m_day_group_person[group * num_ms_per_group as usize + person] =
                    ms[group * num_ms_per_group as usize + person];
            }
        }

        for group in 0..num_of_groups as usize {
            for person in 0..num_fs_per_group as usize {
                self.f_day_group_person[group * num_fs_per_group as usize + person] =
                    fs[group * num_fs_per_group as usize + person];
            }
        }

        let mut rng = rand::rng();
        for day in 1..num_of_days as usize {
            let mut shuffled_ms = ms.clone();
            shuffled_ms.shuffle(&mut rng);
            let day_offset = day * total_ms as usize;
            for (i, &m) in shuffled_ms.iter().enumerate() {
                self.m_day_group_person[day_offset + i] = m;
            }

            let mut shuffled_fs = fs.clone();
            shuffled_fs.shuffle(&mut rng);
            let day_offset = day * total_fs as usize;
            for (i, &f) in shuffled_fs.iter().enumerate() {
                self.f_day_group_person[day_offset + i] = f;
            }
        }

        self.curr_num_contacts = 0;
        for day in 0..self.num_of_days as usize {
            for group in 0..self.num_of_groups as usize {
                for m1_idx in 0..self.num_ms_per_group as usize {
                    for m2_idx in (m1_idx + 1)..self.num_ms_per_group as usize {
                        let m1 = self.get_m(day as u32, group as u32, m1_idx as u32);
                        let m2 = self.get_m(day as u32, group as u32, m2_idx as u32);
                        if self.curr_contacts[m1 as usize][m2 as usize] == 0 {
                            self.curr_num_contacts += 1;
                        }
                        self.curr_contacts[m1 as usize][m2 as usize] += 1;
                        self.curr_contacts[m2 as usize][m1 as usize] += 1;
                    }
                }
                for f1_idx in 0..self.num_fs_per_group as usize {
                    for f2_idx in (f1_idx + 1)..self.num_fs_per_group as usize {
                        let f1 = self.get_f(day as u32, group as u32, f1_idx as u32);
                        let f2 = self.get_f(day as u32, group as u32, f2_idx as u32);
                        if self.curr_contacts[f1 as usize][f2 as usize] == 0 {
                            self.curr_num_contacts += 1;
                        }
                        self.curr_contacts[f1 as usize][f2 as usize] += 1;
                        self.curr_contacts[f2 as usize][f1 as usize] += 1;
                    }
                }
                for m_idx in 0..self.num_ms_per_group as usize {
                    for f_idx in 0..self.num_fs_per_group as usize {
                        let m = self.get_m(day as u32, group as u32, m_idx as u32);
                        let f = self.get_f(day as u32, group as u32, f_idx as u32);
                        if self.curr_contacts[m as usize][f as usize] == 0 {
                            self.curr_num_contacts += 1;
                        }
                        self.curr_contacts[m as usize][f as usize] += 1;
                        self.curr_contacts[f as usize][m as usize] += 1;
                    }
                }
            }
        }

        self.curr_penalty = 0;
        for i in 0..total_people as usize {
            for j in (i + 1)..total_people as usize {
                if self.curr_contacts[i][j] > 1 {
                    self.curr_penalty += (self.curr_contacts[i][j] - 1).pow(2) as i32;
                }
            }
        }
    }

    fn get_m_idx(&self, day: u32, group: u32, person: u32) -> usize {
        (day as usize * (self.num_of_groups * self.num_ms_per_group) as usize)
            + (group as usize * self.num_ms_per_group as usize)
            + person as usize
    }

    fn get_f_idx(&self, day: u32, group: u32, person: u32) -> usize {
        (day as usize * (self.num_of_groups * self.num_fs_per_group) as usize)
            + (group as usize * self.num_fs_per_group as usize)
            + person as usize
    }

    fn get_m(&self, day: u32, group: u32, person: u32) -> u32 {
        self.m_day_group_person[self.get_m_idx(day, group, person)]
    }

    fn get_f(&self, day: u32, group: u32, person: u32) -> u32 {
        self.f_day_group_person[self.get_f_idx(day, group, person)]
    }

    fn set_m(&mut self, day: u32, group: u32, person: u32, val: u32) {
        let idx = self.get_m_idx(day, group, person);
        self.m_day_group_person[idx] = val;
    }

    fn set_f(&mut self, day: u32, group: u32, person: u32, val: u32) {
        let idx = self.get_f_idx(day, group, person);
        self.f_day_group_person[idx] = val;
    }

    fn create_m_nums_vec(&self, total_ms: u32) -> Vec<u32> {
        (0..total_ms).collect()
    }

    fn create_f_nums_vec(&self, total_fs: u32, total_ms: u32) -> Vec<u32> {
        (total_ms..total_ms + total_fs).collect()
    }

    fn penalty_delta_of_swap_m(&self, day: u32, m_gr1: u32, m1: u32, m_gr2: u32, m2: u32) -> i32 {
        if m_gr1 == m_gr2 {
            return 0;
        }
        let mut penalty_delta = 0;

        let m1_num = self.get_m(day, m_gr1, m1);
        for m_in_gr1 in 0..self.num_ms_per_group {
            let other_m_num = self.get_m(day, m_gr1, m_in_gr1);
            if self.curr_contacts[other_m_num as usize][m1_num as usize] > 1 {
                if other_m_num != m1_num {
                    penalty_delta -= (self.curr_contacts[other_m_num as usize][m1_num as usize] - 1)
                        .pow(2) as i32;
                }
            }
        }

        let m2_num = self.get_m(day, m_gr2, m2);
        for m_in_gr2 in 0..self.num_ms_per_group {
            let other_m_num = self.get_m(day, m_gr2, m_in_gr2);
            if self.curr_contacts[other_m_num as usize][m2_num as usize] > 1 {
                if other_m_num != m2_num {
                    penalty_delta -= (self.curr_contacts[other_m_num as usize][m2_num as usize] - 1)
                        .pow(2) as i32;
                }
            }
        }

        for m_in_gr2 in 0..self.num_ms_per_group {
            if m_in_gr2 != m2 {
                let other_m_num = self.get_m(day, m_gr2, m_in_gr2);
                penalty_delta +=
                    self.curr_contacts[other_m_num as usize][m1_num as usize].pow(2) as i32;
            }
        }

        for m_in_gr1 in 0..self.num_ms_per_group {
            if m_in_gr1 != m1 {
                let other_m_num = self.get_m(day, m_gr1, m_in_gr1);
                penalty_delta +=
                    self.curr_contacts[other_m_num as usize][m2_num as usize].pow(2) as i32;
            }
        }

        penalty_delta
    }

    fn penalty_delta_of_swap_f(&self, day: u32, f_gr1: u32, f1: u32, f_gr2: u32, f2: u32) -> i32 {
        if f_gr1 == f_gr2 {
            return 0;
        }
        let mut penalty_delta = 0;

        let f1_num = self.get_f(day, f_gr1, f1);
        for f_in_gr1 in 0..self.num_fs_per_group {
            let other_f_num = self.get_f(day, f_gr1, f_in_gr1);
            if self.curr_contacts[other_f_num as usize][f1_num as usize] > 1 {
                if other_f_num != f1_num {
                    penalty_delta -= (self.curr_contacts[other_f_num as usize][f1_num as usize] - 1)
                        .pow(2) as i32;
                }
            }
        }

        let f2_num = self.get_f(day, f_gr2, f2);
        for f_in_gr2 in 0..self.num_fs_per_group {
            let other_f_num = self.get_f(day, f_gr2, f_in_gr2);
            if self.curr_contacts[other_f_num as usize][f2_num as usize] > 1 {
                if other_f_num != f2_num {
                    penalty_delta -= (self.curr_contacts[other_f_num as usize][f2_num as usize] - 1)
                        .pow(2) as i32;
                }
            }
        }

        for f_in_gr2 in 0..self.num_fs_per_group {
            if f_in_gr2 != f2 {
                let other_f_num = self.get_f(day, f_gr2, f_in_gr2);
                penalty_delta +=
                    self.curr_contacts[other_f_num as usize][f1_num as usize].pow(2) as i32;
            }
        }

        for f_in_gr1 in 0..self.num_fs_per_group {
            if f_in_gr1 != f1 {
                let other_f_num = self.get_f(day, f_gr1, f_in_gr1);
                penalty_delta +=
                    self.curr_contacts[other_f_num as usize][f2_num as usize].pow(2) as i32;
            }
        }

        penalty_delta
    }

    fn contact_delta_of_swap_m(&self, day: u32, m_gr1: u32, m1: u32, m_gr2: u32, m2: u32) -> i32 {
        if m_gr1 == m_gr2 {
            return 0;
        }
        let mut contact_delta = 0;

        let m1_num = self.get_m(day, m_gr1, m1);
        for m_in_gr1 in 0..self.num_ms_per_group {
            let other_m_num = self.get_m(day, m_gr1, m_in_gr1);
            if self.curr_contacts[other_m_num as usize][m1_num as usize] == 1 {
                contact_delta -= 1;
            }
        }

        let m2_num = self.get_m(day, m_gr2, m2);
        for m_in_gr2 in 0..self.num_ms_per_group {
            let other_m_num = self.get_m(day, m_gr2, m_in_gr2);
            if self.curr_contacts[other_m_num as usize][m2_num as usize] == 1 {
                contact_delta -= 1;
            }
        }

        for m_in_gr2 in 0..self.num_ms_per_group {
            if m_in_gr2 != m2 {
                let other_m_num = self.get_m(day, m_gr2, m_in_gr2);
                if self.curr_contacts[other_m_num as usize][m1_num as usize] == 0 {
                    contact_delta += 1;
                }
            }
        }

        for m_in_gr1 in 0..self.num_ms_per_group {
            if m_in_gr1 != m1 {
                let other_m_num = self.get_m(day, m_gr1, m_in_gr1);
                if self.curr_contacts[other_m_num as usize][m2_num as usize] == 0 {
                    contact_delta += 1;
                }
            }
        }

        contact_delta
    }

    fn contact_delta_of_swap_f(&self, day: u32, f_gr1: u32, f1: u32, f_gr2: u32, f2: u32) -> i32 {
        if f_gr1 == f_gr2 {
            return 0;
        }
        let mut contact_delta = 0;

        let f1_num = self.get_f(day, f_gr1, f1);
        for f_in_gr1 in 0..self.num_fs_per_group {
            let other_f_num = self.get_f(day, f_gr1, f_in_gr1);
            if self.curr_contacts[other_f_num as usize][f1_num as usize] == 1 {
                contact_delta -= 1;
            }
        }

        let f2_num = self.get_f(day, f_gr2, f2);
        for f_in_gr2 in 0..self.num_fs_per_group {
            let other_f_num = self.get_f(day, f_gr2, f_in_gr2);
            if self.curr_contacts[other_f_num as usize][f2_num as usize] == 1 {
                contact_delta -= 1;
            }
        }

        for f_in_gr2 in 0..self.num_fs_per_group {
            if f_in_gr2 != f2 {
                let other_f_num = self.get_f(day, f_gr2, f_in_gr2);
                if self.curr_contacts[other_f_num as usize][f1_num as usize] == 0 {
                    contact_delta += 1;
                }
            }
        }

        for f_in_gr1 in 0..self.num_fs_per_group {
            if f_in_gr1 != f1 {
                let other_f_num = self.get_f(day, f_gr1, f_in_gr1);
                if self.curr_contacts[other_f_num as usize][f2_num as usize] == 0 {
                    contact_delta += 1;
                }
            }
        }

        contact_delta
    }

    fn swap_m(&mut self, day: u32, m_gr1: u32, m1: u32, m_gr2: u32, m2: u32) {
        let m1_num = self.get_m(day, m_gr1, m1);
        let m2_num = self.get_m(day, m_gr2, m2);

        for m_in_gr1 in 0..self.num_ms_per_group {
            let other_m = self.get_m(day, m_gr1, m_in_gr1);
            if self.curr_contacts[m1_num as usize][other_m as usize] > 0 {
                self.curr_contacts[m1_num as usize][other_m as usize] -= 1;
                self.curr_contacts[other_m as usize][m1_num as usize] -= 1;
            }
        }

        for m_in_gr2 in 0..self.num_ms_per_group {
            let other_m = self.get_m(day, m_gr2, m_in_gr2);
            if self.curr_contacts[m2_num as usize][other_m as usize] > 0 {
                self.curr_contacts[m2_num as usize][other_m as usize] -= 1;
                self.curr_contacts[other_m as usize][m2_num as usize] -= 1;
            }
        }

        self.set_m(day, m_gr1, m1, m2_num);
        self.set_m(day, m_gr2, m2, m1_num);

        for m_in_gr1 in 0..self.num_ms_per_group {
            let other_m = self.get_m(day, m_gr1, m_in_gr1);
            self.curr_contacts[m2_num as usize][other_m as usize] += 1;
            self.curr_contacts[other_m as usize][m2_num as usize] += 1;
        }

        for m_in_gr2 in 0..self.num_ms_per_group {
            let other_m = self.get_m(day, m_gr2, m_in_gr2);
            self.curr_contacts[m1_num as usize][other_m as usize] += 1;
            self.curr_contacts[other_m as usize][m1_num as usize] += 1;
        }
    }

    fn swap_f(&mut self, day: u32, f_gr1: u32, f1: u32, f_gr2: u32, f2: u32) {
        let f1_num = self.get_f(day, f_gr1, f1);
        let f2_num = self.get_f(day, f_gr2, f2);

        for f_in_gr1 in 0..self.num_fs_per_group {
            let other_f = self.get_f(day, f_gr1, f_in_gr1);
            if self.curr_contacts[f1_num as usize][other_f as usize] > 0 {
                self.curr_contacts[f1_num as usize][other_f as usize] -= 1;
                self.curr_contacts[other_f as usize][f1_num as usize] -= 1;
            }
        }

        for f_in_gr2 in 0..self.num_fs_per_group {
            let other_f = self.get_f(day, f_gr2, f_in_gr2);
            if self.curr_contacts[f2_num as usize][other_f as usize] > 0 {
                self.curr_contacts[f2_num as usize][other_f as usize] -= 1;
                self.curr_contacts[other_f as usize][f2_num as usize] -= 1;
            }
        }

        self.set_f(day, f_gr1, f1, f2_num);
        self.set_f(day, f_gr2, f2, f1_num);

        for f_in_gr1 in 0..self.num_fs_per_group {
            let other_f = self.get_f(day, f_gr1, f_in_gr1);
            self.curr_contacts[f2_num as usize][other_f as usize] += 1;
            self.curr_contacts[other_f as usize][f2_num as usize] += 1;
        }

        for f_in_gr2 in 0..self.num_fs_per_group {
            let other_f = self.get_f(day, f_gr2, f_in_gr2);
            self.curr_contacts[f1_num as usize][other_f as usize] += 1;
            self.curr_contacts[other_f as usize][f1_num as usize] += 1;
        }
    }

    pub fn try_random_m_swap_and_proceed_if_contact_delta_pos(&mut self) {
        let day = self.random() as u32 % self.num_of_days;
        let m_gr1 = self.random() as u32 % self.num_of_groups;
        let m_gr2 = self.random() as u32 % self.num_of_groups;
        let m1 = self.random() as u32 % self.num_ms_per_group;
        let m2 = self.random() as u32 % self.num_ms_per_group;

        let contact_delta = self.contact_delta_of_swap_m(day, m_gr1, m1, m_gr2, m2);
        if contact_delta > 0 {
            let penalty_delta = self.penalty_delta_of_swap_m(day, m_gr1, m1, m_gr2, m2);
            self.swap_m(day, m_gr1, m1, m_gr2, m2);
            self.curr_num_contacts += contact_delta;
            self.curr_penalty += penalty_delta;
        }
    }

    pub fn try_random_f_swap_and_proceed_if_contact_delta_pos(&mut self) {
        let day = self.random() as u32 % self.num_of_days;
        let f_gr1 = self.random() as u32 % self.num_of_groups;
        let f_gr2 = self.random() as u32 % self.num_of_groups;
        let f1 = self.random() as u32 % self.num_fs_per_group;
        let f2 = self.random() as u32 % self.num_fs_per_group;

        let contact_delta = self.contact_delta_of_swap_f(day, f_gr1, f1, f_gr2, f2);
        if contact_delta > 0 {
            let penalty_delta = self.penalty_delta_of_swap_f(day, f_gr1, f1, f_gr2, f2);
            self.swap_f(day, f_gr1, f1, f_gr2, f2);
            self.curr_num_contacts += contact_delta;
            self.curr_penalty += penalty_delta;
        }
    }

    pub fn perform_simulated_annealing_step(&mut self, temp: f64) {
        let day = self.random() as u32 % self.num_of_days;
        let m_gr1 = self.random() as u32 % self.num_of_groups;
        let m_gr2 = self.random() as u32 % self.num_of_groups;
        let m1 = self.random() as u32
            % (self.num_ms_per_group - self.m_num_of_immovable_people_per_group[m_gr1 as usize]);
        let m2 = self.random() as u32
            % (self.num_ms_per_group - self.m_num_of_immovable_people_per_group[m_gr2 as usize]);

        let contact_delta = self.contact_delta_of_swap_m(day, m_gr1, m1, m_gr2, m2);

        if contact_delta > 0 {
            let penalty_delta = self.penalty_delta_of_swap_m(day, m_gr1, m1, m_gr2, m2);
            self.swap_m(day, m_gr1, m1, m_gr2, m2);
            self.curr_num_contacts += contact_delta;
            self.curr_penalty += penalty_delta;
        } else if (self.random() as f64 / std::u64::MAX as f64)
            < (contact_delta as f64 / temp).exp()
        {
            let penalty_delta = self.penalty_delta_of_swap_m(day, m_gr1, m1, m_gr2, m2);
            self.swap_m(day, m_gr1, m1, m_gr2, m2);
            self.curr_num_contacts += contact_delta;
            self.curr_penalty += penalty_delta;
        }

        let f_gr1 = self.random() as u32 % self.num_of_groups;
        let f_gr2 = self.random() as u32 % self.num_of_groups;
        let f1 = self.random() as u32
            % (self.num_fs_per_group - self.f_num_of_immovable_people_per_group[f_gr1 as usize]);
        let f2 = self.random() as u32
            % (self.num_fs_per_group - self.f_num_of_immovable_people_per_group[f_gr2 as usize]);

        let contact_delta = self.contact_delta_of_swap_f(day, f_gr1, f1, f_gr2, f2);

        if contact_delta > 0 {
            let penalty_delta = self.penalty_delta_of_swap_f(day, f_gr1, f1, f_gr2, f2);
            self.swap_f(day, f_gr1, f1, f_gr2, f2);
            self.curr_num_contacts += contact_delta;
            self.curr_penalty += penalty_delta;
        } else if (self.random() as f64 / std::u64::MAX as f64)
            < (contact_delta as f64 / temp).exp()
        {
            let penalty_delta = self.penalty_delta_of_swap_f(day, f_gr1, f1, f_gr2, f2);
            self.swap_f(day, f_gr1, f1, f_gr2, f2);
            self.curr_num_contacts += contact_delta;
            self.curr_penalty += penalty_delta;
        }
    }

    pub fn perform_simulated_annealing_penalty_version_step(&mut self, temp: f64) {
        let day = self.random() as u32 % self.num_of_days;
        let m_gr1 = self.random() as u32 % self.num_of_groups;
        let m_gr2 = self.random() as u32 % self.num_of_groups;
        let m1 = self.random() as u32
            % (self.num_ms_per_group - self.m_num_of_immovable_people_per_group[m_gr1 as usize]);
        let m2 = self.random() as u32
            % (self.num_ms_per_group - self.m_num_of_immovable_people_per_group[m_gr2 as usize]);

        let penalty_delta = self.penalty_delta_of_swap_m(day, m_gr1, m1, m_gr2, m2);

        if penalty_delta < 0 {
            let contact_delta = self.contact_delta_of_swap_m(day, m_gr1, m1, m_gr2, m2);
            self.swap_m(day, m_gr1, m1, m_gr2, m2);
            self.curr_penalty += penalty_delta;
            self.curr_num_contacts += contact_delta;
        } else if (self.random() as f64 / std::u64::MAX as f64)
            < (-penalty_delta as f64 / temp).exp()
        {
            let contact_delta = self.contact_delta_of_swap_m(day, m_gr1, m1, m_gr2, m2);
            self.swap_m(day, m_gr1, m1, m_gr2, m2);
            self.curr_penalty += penalty_delta;
            self.curr_num_contacts += contact_delta;
        }

        let f_gr1 = self.random() as u32 % self.num_of_groups;
        let f_gr2 = self.random() as u32 % self.num_of_groups;
        let f1 = self.random() as u32
            % (self.num_fs_per_group - self.f_num_of_immovable_people_per_group[f_gr1 as usize]);
        let f2 = self.random() as u32
            % (self.num_fs_per_group - self.f_num_of_immovable_people_per_group[f_gr2 as usize]);

        let penalty_delta = self.penalty_delta_of_swap_f(day, f_gr1, f1, f_gr2, f2);

        if penalty_delta < 0 {
            let contact_delta = self.contact_delta_of_swap_f(day, f_gr1, f1, f_gr2, f2);
            self.swap_f(day, f_gr1, f1, f_gr2, f2);
            self.curr_penalty += penalty_delta;
            self.curr_num_contacts += contact_delta;
        } else if (self.random() as f64 / std::u64::MAX as f64)
            < (-penalty_delta as f64 / temp).exp()
        {
            let contact_delta = self.contact_delta_of_swap_f(day, f_gr1, f1, f_gr2, f2);
            self.swap_f(day, f_gr1, f1, f_gr2, f2);
            self.curr_penalty += penalty_delta;
            self.curr_num_contacts += contact_delta;
        }
    }

    pub fn random(&mut self) -> u64 {
        self.rnd_state.next()
    }

    pub fn set_num_of_immovable_ms_per_group(&mut self, num_of_immovable_ms_per_group: Vec<u32>) {
        self.m_num_of_immovable_people_per_group = num_of_immovable_ms_per_group;
    }

    pub fn set_num_of_immovable_fs_per_group(&mut self, num_of_immovable_fs_per_group: Vec<u32>) {
        self.f_num_of_immovable_people_per_group = num_of_immovable_fs_per_group;
    }

    pub fn print_num_of_contacts_per_person(&self) {
        let total_people =
            (self.num_of_groups * (self.num_ms_per_group + self.num_fs_per_group)) as usize;
        let mut num_of_contacts = vec![0; total_people];
        for i in 0..total_people {
            for j in (i + 1)..total_people {
                if self.curr_contacts[i][j] > 0 {
                    num_of_contacts[i] += 1;
                    num_of_contacts[j] += 1;
                }
            }
        }
        println!("Number of contacts per person:");
        for (i, n) in num_of_contacts.iter().enumerate() {
            println!("Person {}: {}", i, n);
        }
    }

    pub fn print_total_num_of_contacts(&self) {
        println!("Total number of contacts: {}", self.curr_num_contacts);
    }

    pub fn print_total_penalty(&self) {
        println!("Total penalty: {}", self.curr_penalty);
    }

    pub fn print_penalty_per_person(&self) {
        let total_people =
            (self.num_of_groups * (self.num_ms_per_group + self.num_fs_per_group)) as usize;
        let mut penalty_per_person = vec![0; total_people];
        for i in 0..total_people {
            for j in (i + 1)..total_people {
                if self.curr_contacts[i][j] > 1 {
                    let penalty = (self.curr_contacts[i][j] - 1).pow(2) as i32;
                    penalty_per_person[i] += penalty;
                    penalty_per_person[j] += penalty;
                }
            }
        }
        println!("Penalty per person:");
        for (i, p) in penalty_per_person.iter().enumerate() {
            println!("Person {}: {}", i, p);
        }
    }

    pub fn print_state(&self) {
        for day in 0..self.num_of_days {
            println!("Day {}", day);
            for group in 0..self.num_of_groups {
                print!("Group {}: ", group);
                for m in 0..self.num_ms_per_group {
                    print!("m{} ", self.get_m(day, group, m));
                }
                for f in 0..self.num_fs_per_group {
                    print!("f{} ", self.get_f(day, group, f));
                }
                println!();
            }
        }
    }

    pub fn write_state_to_csv(&self) {
        let mut wtr = csv::Writer::from_path("state.csv").unwrap();
        for day in 0..self.num_of_days {
            for group in 0..self.num_of_groups {
                let mut row = vec![day.to_string(), group.to_string()];
                for m in 0..self.num_ms_per_group {
                    row.push(format!("m{}", self.get_m(day, group, m)));
                }
                for f in 0..self.num_fs_per_group {
                    row.push(format!("f{}", self.get_f(day, group, f)));
                }
                wtr.write_record(&row).unwrap();
            }
        }
        wtr.flush().unwrap();
    }

    pub fn is_valid(&self) -> bool {
        let total_ms = self.num_of_groups * self.num_ms_per_group;
        let total_fs = self.num_of_groups * self.num_fs_per_group;

        for day in 0..self.num_of_days {
            let mut was_found = vec![false; total_ms as usize];
            for group in 0..self.num_of_groups {
                for m_idx in 0..self.num_ms_per_group {
                    let m = self.get_m(day, group, m_idx);
                    if was_found[m as usize] {
                        return false;
                    }
                    was_found[m as usize] = true;
                }
            }
            for found in was_found {
                if !found {
                    return false;
                }
            }
        }

        for day in 0..self.num_of_days {
            let mut was_found_f = vec![false; total_fs as usize];
            for group in 0..self.num_of_groups {
                for f_idx in 0..self.num_fs_per_group {
                    let f = self.get_f(day, group, f_idx);
                    if was_found_f[(f - total_ms) as usize] {
                        return false;
                    }
                    was_found_f[(f - total_ms) as usize] = true;
                }
            }
            for found in was_found_f {
                if !found {
                    return false;
                }
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestState {
        state: State,
    }

    impl TestState {
        fn new(
            num_of_groups: u32,
            num_ms_per_group: u32,
            num_fs_per_group: u32,
            num_of_days: u32,
        ) -> Self {
            let mut state = State::new(
                num_of_groups,
                num_ms_per_group,
                num_fs_per_group,
                num_of_days,
            );
            state.rnd_state = Xorshift128pState { a: 1, b: 2 };
            Self { state }
        }
    }

    #[test]
    fn run_all_tests() {
        // test_initialize
        let state = TestState::new(2, 2, 2, 2).state;
        assert_eq!(state.num_of_groups, 2);
        assert_eq!(state.num_ms_per_group, 2);
        assert_eq!(state.num_fs_per_group, 2);
        assert_eq!(state.num_of_days, 2);
        let total_people =
            (state.num_of_groups * (state.num_ms_per_group + state.num_fs_per_group)) as usize;
        assert_eq!(state.curr_contacts.len(), total_people);
        assert!(state.curr_num_contacts > 0);
        assert!(state.is_valid());

        // test_swap_m
        let mut state_m = TestState::new(2, 2, 2, 2).state;
        let initial_contacts_m = state_m.curr_num_contacts;
        let initial_penalty_m = state_m.curr_penalty;
        let contact_delta_m = state_m.contact_delta_of_swap_m(0, 0, 0, 1, 0);
        let penalty_delta_m = state_m.penalty_delta_of_swap_m(0, 0, 0, 1, 0);
        state_m.swap_m(0, 0, 0, 1, 0);
        assert!(state_m.is_valid());

        let total_people = (state_m.num_of_groups
            * (state_m.num_ms_per_group + state_m.num_fs_per_group))
            as usize;
        let mut new_num_contacts = 0;
        let mut new_penalty = 0;
        for i in 0..total_people {
            for j in (i + 1)..total_people {
                if state_m.curr_contacts[i][j] > 0 {
                    new_num_contacts += 1;
                }
                if state_m.curr_contacts[i][j] > 1 {
                    new_penalty += (state_m.curr_contacts[i][j] - 1).pow(2) as i32;
                }
            }
        }
        assert_eq!(new_num_contacts, initial_contacts_m + contact_delta_m);
        assert_eq!(new_penalty, initial_penalty_m + penalty_delta_m);

        // test_swap_f
        let mut state_f = TestState::new(2, 2, 2, 2).state;
        let initial_contacts_f = state_f.curr_num_contacts;
        let initial_penalty_f = state_f.curr_penalty;
        let contact_delta_f = state_f.contact_delta_of_swap_f(0, 0, 0, 1, 0);
        let penalty_delta_f = state_f.penalty_delta_of_swap_f(0, 0, 0, 1, 0);
        state_f.swap_f(0, 0, 0, 1, 0);
        assert!(state_f.is_valid());

        let total_people = (state_f.num_of_groups
            * (state_f.num_ms_per_group + state_f.num_fs_per_group))
            as usize;
        let mut new_num_contacts = 0;
        let mut new_penalty = 0;
        for i in 0..total_people {
            for j in (i + 1)..total_people {
                if state_f.curr_contacts[i][j] > 0 {
                    new_num_contacts += 1;
                }
                if state_f.curr_contacts[i][j] > 1 {
                    new_penalty += (state_f.curr_contacts[i][j] - 1).pow(2) as i32;
                }
            }
        }
        assert_eq!(new_num_contacts, initial_contacts_f + contact_delta_f);
        assert_eq!(new_penalty, initial_penalty_f + penalty_delta_f);
    }
}
