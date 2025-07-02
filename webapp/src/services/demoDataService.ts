import { Problem, SolverSettings } from "../types";

export interface DemoCase {
  id: string;
  name: string;
  description: string;
  category: "Simple" | "Intermediate" | "Advanced" | "Benchmark";
  filename: string;
}

export interface DemoCaseWithMetrics extends DemoCase {
  peopleCount: number;
  groupCount: number;
  sessionCount: number;
}

// Dynamically discover test case files
// In a production environment, this would ideally be served by a backend endpoint
async function discoverTestCaseFiles(): Promise<string[]> {
  console.log("Discovering test case files...");

  // Try to fetch a manifest file first (if it exists)
  try {
    const manifestResponse = await fetch("/test_cases/manifest.json");
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      console.log("Found manifest file with test cases:", manifest.files);
      return manifest.files;
    }
  } catch (error) {
    // Manifest doesn't exist, fall back to empty list
    console.log(
      "No manifest file found, demo cases will need to be added manually"
    );
    return [];
  }

  return [];
}

// Convert test case format to webapp's Problem format
function convertTestCaseToProblem(testCase: any): Problem {
  const input = testCase.input;

  // Convert solver settings
  const solverParams = input.solver.solver_params;
  const settings: SolverSettings = {
    solver_type: input.solver.solver_type,
    stop_conditions: input.solver.stop_conditions,
    solver_params: {
      SimulatedAnnealing: {
        initial_temperature: solverParams.initial_temperature,
        final_temperature: solverParams.final_temperature,
        cooling_schedule: solverParams.cooling_schedule,
      },
    },
    logging: input.solver.logging,
  };

  return {
    people: input.problem.people,
    groups: input.problem.groups,
    num_sessions: input.problem.num_sessions,
    constraints: input.constraints || [],
    settings,
  };
}

// Load and parse a single test case file
async function loadTestCaseFile(
  filename: string
): Promise<DemoCaseWithMetrics | null> {
  try {
    const response = await fetch(`/test_cases/${filename}`);
    if (!response.ok) {
      console.warn(`Failed to load test case file: ${filename}`);
      return null;
    }

    const testCase = await response.json();

    // Check if this test case has demo metadata
    if (!testCase.demo_metadata) {
      return null; // Skip files without demo metadata
    }

    const metadata = testCase.demo_metadata;
    const problem = testCase.input.problem;

    return {
      id: metadata.id,
      name: metadata.display_name,
      description: metadata.description,
      category: metadata.category,
      filename: filename,
      peopleCount: problem.people?.length || 0,
      groupCount: problem.groups?.length || 0,
      sessionCount: problem.num_sessions || 0,
    };
  } catch (error) {
    console.error(`Error loading test case file ${filename}:`, error);
    return null;
  }
}

// Load all demo cases with metrics from test case files
export async function loadDemoCasesWithMetrics(): Promise<
  DemoCaseWithMetrics[]
> {
  console.log("Loading demo cases from test case files...");

  // First discover all available test case files
  const testCaseFiles = await discoverTestCaseFiles();

  const loadPromises = testCaseFiles.map((filename) =>
    loadTestCaseFile(filename)
  );
  const results = await Promise.all(loadPromises);

  // Filter out null results (files without demo metadata or that failed to load)
  const demoCases = results.filter(
    (result): result is DemoCaseWithMetrics => result !== null
  );

  // Sort by category and then by name
  const categoryOrder: Record<string, number> = {
    Simple: 1,
    Intermediate: 2,
    Advanced: 3,
    Benchmark: 4,
  };
  demoCases.sort((a, b) => {
    const categoryDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (categoryDiff !== 0) return categoryDiff;
    return a.name.localeCompare(b.name);
  });

  console.log(
    `Loaded ${demoCases.length} demo cases:`,
    demoCases.map((c) => c.name)
  );
  return demoCases;
}

// Load a specific demo case by ID
export async function loadDemoCase(demoCaseId: string): Promise<Problem> {
  console.log(`Loading demo case: ${demoCaseId}`);

  // First, load all demo cases to find the one with matching ID
  const demoCases = await loadDemoCasesWithMetrics();
  const demoCase = demoCases.find((c) => c.id === demoCaseId);

  if (!demoCase) {
    throw new Error(`Demo case not found: ${demoCaseId}`);
  }

  try {
    const response = await fetch(`/test_cases/${demoCase.filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load demo case: ${response.statusText}`);
    }

    const testCase = await response.json();
    return convertTestCaseToProblem(testCase);
  } catch (error) {
    console.error(`Error loading demo case ${demoCase.name}:`, error);

    // Fallback to the current demo data if loading fails
    if (demoCaseId === "ui-demo") {
      return createFallbackDemo();
    }

    throw error;
  }
}

// Fallback demo data (current implementation)
function createFallbackDemo(): Problem {
  const demoGroups = [
    { id: "team-alpha", size: 4 },
    { id: "team-beta", size: 4 },
    { id: "team-gamma", size: 4 },
  ];

  const demoPeople = [
    {
      id: "alice",
      attributes: {
        name: "Alice Johnson",
        gender: "female",
        department: "engineering",
        seniority: "senior",
      },
    },
    {
      id: "bob",
      attributes: {
        name: "Bob Smith",
        gender: "male",
        department: "marketing",
        seniority: "mid",
      },
    },
    {
      id: "charlie",
      attributes: {
        name: "Charlie Brown",
        gender: "male",
        department: "engineering",
        seniority: "junior",
      },
    },
    {
      id: "diana",
      attributes: {
        name: "Diana Prince",
        gender: "female",
        department: "sales",
        seniority: "lead",
      },
    },
    {
      id: "eve",
      attributes: {
        name: "Eve Davis",
        gender: "female",
        department: "hr",
        seniority: "mid",
      },
    },
    {
      id: "frank",
      attributes: {
        name: "Frank Miller",
        gender: "male",
        department: "finance",
        seniority: "senior",
      },
    },
    {
      id: "grace",
      attributes: {
        name: "Grace Lee",
        gender: "female",
        department: "engineering",
        seniority: "junior",
      },
    },
    {
      id: "henry",
      attributes: {
        name: "Henry Wilson",
        gender: "male",
        department: "marketing",
        seniority: "senior",
      },
    },
    {
      id: "iris",
      attributes: {
        name: "Iris Chen",
        gender: "female",
        department: "sales",
        seniority: "mid",
      },
    },
    {
      id: "jack",
      attributes: {
        name: "Jack Taylor",
        gender: "male",
        department: "hr",
        seniority: "junior",
      },
    },
    {
      id: "kate",
      attributes: {
        name: "Kate Anderson",
        gender: "female",
        department: "finance",
        seniority: "lead",
      },
    },
    {
      id: "leo",
      attributes: {
        name: "Leo Rodriguez",
        gender: "male",
        department: "engineering",
        seniority: "mid",
      },
      sessions: [1, 2], // Late arrival - misses first session
    },
  ];

  return {
    people: demoPeople,
    groups: demoGroups,
    num_sessions: 3,
    constraints: [
      // Limit repeat encounters
      {
        type: "RepeatEncounter",
        max_allowed_encounters: 1,
        penalty_function: "squared",
        penalty_weight: 100.0,
      },
      // Keep Alice and Bob together (they're project partners)
      {
        type: "MustStayTogether",
        people: ["alice", "bob"],
        penalty_weight: 1000.0,
        sessions: [0, 1], // Only for first two sessions
      },
      // Charlie and Diana can't be together (personality conflict)
      {
        type: "CannotBeTogether",
        people: ["charlie", "diana"],
        penalty_weight: 500.0,
      },
      // Maintain gender balance in team-alpha
      {
        type: "AttributeBalance",
        group_id: "team-alpha",
        attribute_key: "gender",
        desired_values: { male: 2, female: 2 },
        penalty_weight: 50.0,
      },
    ],
    settings: {
      solver_type: "SimulatedAnnealing",
      stop_conditions: {
        max_iterations: 10000,
        time_limit_seconds: 30,
        no_improvement_iterations: 1000,
      },
      solver_params: {
        SimulatedAnnealing: {
          initial_temperature: 1.0,
          final_temperature: 0.01,
          cooling_schedule: "geometric",
        },
      },
      logging: {
        log_frequency: 1000,
        log_initial_state: true,
        log_duration_and_score: true,
        display_final_schedule: true,
        log_initial_score_breakdown: true,
        log_final_score_breakdown: true,
        log_stop_condition: true,
      },
    },
  };
}
