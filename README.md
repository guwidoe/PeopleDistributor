# PeopleDistributor

A sophisticated Rust-based solution for optimally distributing people into groups across multiple sessions to maximize social interactions while respecting various constraints.

## Overview

PeopleDistributor solves the social group scheduling problem using advanced optimization algorithms. It distributes a given number of people into groups across multiple sessions, maximizing the number of unique contacts while respecting various hard and soft constraints.

## Architecture

The project is organized as a Rust workspace with three main components:

### 🧠 `solver-core` - Core Optimization Engine

The heart of the system, providing:

- **Simulated Annealing** algorithm for optimization
- **Flexible constraint system** supporting:
  - Repeat encounter limits (with configurable penalty functions)
  - Attribute balance constraints (e.g., gender distribution)
  - Immovable person assignments
  - Must-stay-together constraints
  - Cannot-be-together constraints
- **Comprehensive scoring system** with detailed breakdowns
- **Configurable stop conditions** (time limits, iteration limits, improvement thresholds)
- **Extensive test suite** with data-driven tests

### 🌐 `solver-server` - Web API Server

A high-performance HTTP server built with Axum that provides:

- **RESTful API** for submitting optimization jobs
- **Asynchronous job processing** with background task management
- **Real-time job status tracking**
- **JSON-based input/output** for easy integration

### ⚡ `solver-wasm` - WebAssembly Module

WebAssembly compilation of the core solver for:

- **Client-side optimization** in web browsers
- **Offline processing capabilities**
- **Cross-platform deployment**

## Key Features

### Advanced Optimization

- **Simulated Annealing** with configurable temperature schedules
- **Multiple objective functions** for different problem sizes
- **Penalty-based constraint handling** with adjustable weights
- **Detailed score breakdown** for debugging and analysis

### Flexible Constraints

- **Repeat encounter limits** with squared or linear penalty functions
- **Attribute balance** (e.g., gender distribution per group)
- **Immovable assignments** (fixed person-group-session assignments)
- **Grouping constraints** (must-stay-together, cannot-be-together)
- **Configurable penalty weights** for fine-tuning

### Robust Configuration

- **JSON-based problem definition** with comprehensive schema
- **Multiple stop conditions** (time, iterations, improvement)
- **Extensive logging options** for debugging and monitoring
- **Solver parameter tuning** for different problem characteristics

### Production Ready

- **Comprehensive test suite** with 20+ test cases
- **Benchmark scenarios** for performance validation
- **Error handling** with detailed error messages
- **Documentation** and examples

## Quick Start

### Using the Web Server

1. **Start the server:**

   ```bash
   cd solver-server
   cargo run
   ```

2. **Submit a job via HTTP POST to `http://localhost:3000/solve`:**
   ```json
   {
     "problem": {
       "people": [
         { "id": "Alice", "attributes": { "gender": "female" } },
         { "id": "Bob", "attributes": { "gender": "male" } }
       ],
       "groups": [{ "id": "Group1", "size": 2 }],
       "num_sessions": 3
     },
     "constraints": [
       {
         "type": "RepeatEncounter",
         "max_allowed_encounters": 1,
         "penalty_function": "squared",
         "penalty_weight": 100.0
       }
     ],
     "solver": {
       "solver_type": "SimulatedAnnealing",
       "stop_conditions": {
         "max_iterations": 10000,
         "time_limit_seconds": 30
       },
       "solver_params": {
         "SimulatedAnnealing": {
           "initial_temperature": 100.0,
           "final_temperature": 0.1,
           "cooling_schedule": "geometric"
         }
       }
     }
   }
   ```

### Using the Core Library

```rust
use solver_core::{run_solver, models::ApiInput};

let input = ApiInput {
    // ... configuration
};

match run_solver(&input) {
    Ok(result) => {
        println!("Final score: {}", result.final_score);
        println!("Schedule:\n{}", result.display());
    }
    Err(e) => eprintln!("Error: {:?}", e),
}
```

## Problem Definition

The system solves problems defined by:

- **People**: List of individuals with optional attributes
- **Groups**: Collection of groups with specified sizes
- **Sessions**: Number of rounds to distribute people
- **Objectives**: Goals to optimize (e.g., maximize unique contacts)
- **Constraints**: Rules that must be satisfied or penalized
- **Solver Configuration**: Algorithm parameters and stop conditions

## Algorithms

### Simulated Annealing

The primary optimization algorithm that:

- Starts with a high "temperature" allowing large changes
- Gradually cools to focus on local improvements
- Uses configurable cooling schedules (geometric, linear)
- Supports multiple stop conditions

## Testing

The project includes extensive testing:

```bash
# Run all tests
cargo test

# Run specific test categories
cargo test --test data_driven_tests

# Run benchmarks
cargo test --test data_driven_tests -- --ignored
```

Test cases cover:

- Basic functionality
- Constraint handling
- Performance benchmarks
- Edge cases and stress tests
- Comparison with Google CP-SAT solver

## Legacy Components

The project also includes:

- **Legacy C++ implementation** (`legacy_cpp/`)
- **Legacy Rust implementation** (`legacy_rust/`)
- **Python Google CP-SAT solver** (`python/`) for comparison

## Performance

The Rust implementation provides significant performance improvements over the original C++ version, with:

- **Faster execution** through optimized algorithms
- **Better memory management** with Rust's ownership system
- **Concurrent processing** capabilities
- **Scalable architecture** for large problem sizes

## Contributing

The project welcomes contributions! Areas for improvement include:

- Additional optimization algorithms (Hill Climbing, Genetic Algorithms)
- More constraint types
- Performance optimizations
- Web interface development
- Additional export formats

## License

See [LICENSE.md](LICENSE.md) for details.
