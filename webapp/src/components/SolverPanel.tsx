import { useState, useRef } from 'react';
import { useAppStore } from '../store';
import { Play, Pause, RotateCcw, Settings, Zap, TrendingUp, Clock, Activity } from 'lucide-react';
import type { SolverSettings, SolverState } from '../types';
import { solverWorkerService } from '../services/solverWorker';
import type { ProgressUpdate } from '../services/wasm';

export function SolverPanel() {
  const { problem, solverState, startSolver, stopSolver, resetSolver, setSolverState, setSolution, addNotification, addResult, currentProblemId, updateProblem } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);
  const cancelledRef = useRef(false);
  const solverCompletedRef = useRef(false);

  // Get solver settings from the current problem, with fallback to defaults
  const getDefaultSolverSettings = (): SolverSettings => ({
    solver_type: "SimulatedAnnealing",
    stop_conditions: {
      max_iterations: 10000,
      time_limit_seconds: 30,
      no_improvement_iterations: 5000,
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
  });

  const solverSettings = problem?.settings || getDefaultSolverSettings();

  const updateSolverSettings = (newSettings: SolverSettings) => {
    if (problem) {
      updateProblem({ settings: newSettings });
    }
  };

  // No more simulation needed - real progress comes from WASM solver

  const handleStartSolver = async () => {
    if (!problem) {
      addNotification({
        type: 'error',
        title: 'No Problem',
        message: 'Please configure a problem first',
      });
      return;
    }

    if (!problem.people || problem.people.length === 0) {
      addNotification({
        type: 'error',
        title: 'No People',
        message: 'Please add people to the problem first',
      });
      return;
    }

    if (!problem.groups || problem.groups.length === 0) {
      addNotification({
        type: 'error',
        title: 'No Groups',
        message: 'Please add groups to the problem first',
      });
      return;
    }

    try {
      // Reset cancellation flag
      cancelledRef.current = false;
      solverCompletedRef.current = false;
      
      startSolver();
      addNotification({
        type: 'info',
        title: 'Solving',
        message: 'Optimization algorithm started',
      });

      // Create the problem with the current solver settings
      const problemWithSettings = {
        ...problem,
        settings: solverSettings,
      };

      // Progress callback to update the UI in real-time
      const progressCallback = (progress: ProgressUpdate): boolean => {
        // Ignore progress updates if solver has already completed
        if (solverCompletedRef.current) {
          return false;
        }
        
        setSolverState({
          currentIteration: progress.iteration,
          bestScore: progress.best_score,
          elapsedTime: progress.elapsed_seconds * 1000, // Convert to milliseconds
          noImprovementCount: progress.no_improvement_count,
        });
        
        // Check if solver was cancelled
        if (cancelledRef.current) {
          return false; // Stop the solver
        }
        
        return true; // Continue solving
      };

      // Run the solver with progress updates using Web Worker
      const { solution, lastProgress } = await solverWorkerService.solveWithProgress(problemWithSettings, progressCallback);
      
      // Mark solver as completed to prevent late progress updates
      solverCompletedRef.current = true;
      
      // Check if the solver was cancelled
      if (cancelledRef.current) {
        setSolverState({ 
          isRunning: false, 
          isComplete: false,
        });
        addNotification({
          type: 'warning',
          title: 'Solver Cancelled',
          message: 'Optimization was cancelled by user',
        });
        return;
      }
      
      // Update the solution and mark as complete
      setSolution(solution);
      
      // Determine the final no improvement count
      const finalNoImprovementCount = lastProgress 
        ? lastProgress.no_improvement_count 
        : solverState.noImprovementCount;

      // Add a small delay to ensure any late progress messages are ignored
      await new Promise(resolve => setTimeout(resolve, 50));

      // Update final solver state with actual final values from solution
      setSolverState({ 
        isRunning: false, 
        isComplete: true,
        currentIteration: solution.iteration_count,
        elapsedTime: solution.elapsed_time_ms,
        bestScore: solution.final_score,
        noImprovementCount: finalNoImprovementCount,
      });

      addNotification({
        type: 'success',
        title: 'Optimization Complete',
        message: `Found solution with score ${solution.final_score.toFixed(2)}`,
      });

      // Automatically save result if there's a current problem
      if (currentProblemId) {
        addResult(solution, solverSettings);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if this is a cancellation error
      if (errorMessage.includes('cancelled')) {
        setSolverState({ isRunning: false, isComplete: false });
        addNotification({
          type: 'warning',
          title: 'Solver Cancelled',
          message: 'Optimization was cancelled by user',
        });
      } else {
        setSolverState({ isRunning: false, error: errorMessage });
        addNotification({
          type: 'error',
          title: 'Solver Error',
          message: errorMessage,
        });
      }
    }
  };

  const handleStopSolver = async () => {
    // Set the cancellation flag to stop the solver
    cancelledRef.current = true;
    stopSolver();
    
    addNotification({
      type: 'info',
      title: 'Cancelling',
      message: 'Stopping solver...',
    });
    
    try {
      await solverWorkerService.cancel();
      // Success notification will be handled by the main solve error handler
    } catch (error) {
      console.error('Cancellation error:', error);
      // Don't show error notification - cancellation usually succeeds even if there are errors
    }
  };

  const handleResetSolver = () => {
    // Reset cancellation flag
    cancelledRef.current = false;
    solverCompletedRef.current = false;
    resetSolver();
    addNotification({
      type: 'info',
      title: 'Reset',
      message: 'Solver state reset',
    });
  };

  const getProgressPercentage = () => {
    if (!solverSettings.stop_conditions.max_iterations) return 0;
    return Math.min((solverState.currentIteration / solverSettings.stop_conditions.max_iterations) * 100, 100);
  };

  const getTimeProgressPercentage = () => {
    if (!solverSettings.stop_conditions.time_limit_seconds) return 0;
    const timeLimit = solverSettings.stop_conditions.time_limit_seconds;
    return Math.min((solverState.elapsedTime / 1000 / timeLimit) * 100, 100);
  };

  const getNoImprovementProgressPercentage = () => {
    if (!solverSettings.stop_conditions.no_improvement_iterations) return 0;
    return Math.min((solverState.noImprovementCount / solverSettings.stop_conditions.no_improvement_iterations) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Solver</h2>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Run the optimization algorithm to find the best solution
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="btn-secondary flex items-center space-x-2"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="card">
                      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Solver Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Max Iterations</label>
              <input
                type="number"
                className="input"
                value={solverSettings.stop_conditions.max_iterations || 10000}
                onChange={(e) => updateSolverSettings({
                  ...solverSettings,
                  stop_conditions: {
                    ...solverSettings.stop_conditions,
                    max_iterations: parseInt(e.target.value) || 10000
                  }
                })}
                min="1000"
                max="100000"
              />
            </div>
            <div>
              <label className="label">Time Limit (seconds)</label>
              <input
                type="number"
                className="input"
                value={solverSettings.stop_conditions.time_limit_seconds || 30}
                onChange={(e) => updateSolverSettings({
                  ...solverSettings,
                  stop_conditions: {
                    ...solverSettings.stop_conditions,
                    time_limit_seconds: parseInt(e.target.value) || 30
                  }
                })}
                min="10"
                max="300"
              />
            </div>
            <div>
              <label className="label">No Improvement Limit</label>
              <input
                type="number"
                className="input"
                value={solverSettings.stop_conditions.no_improvement_iterations || 5000}
                onChange={(e) => updateSolverSettings({
                  ...solverSettings,
                  stop_conditions: {
                    ...solverSettings.stop_conditions,
                    no_improvement_iterations: parseInt(e.target.value) || 5000
                  }
                })}
                min="100"
                max="50000"
                placeholder="Iterations without improvement before stopping"
              />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Stop after this many iterations without improvement
              </p>
            </div>
            <div>
              <label className="label">Initial Temperature</label>
              <input
                type="number"
                className="input"
                value={solverSettings.solver_params.SimulatedAnnealing?.initial_temperature || 1.0}
                onChange={(e) => updateSolverSettings({
                  ...solverSettings,
                  solver_params: {
                    ...solverSettings.solver_params,
                    SimulatedAnnealing: {
                      ...solverSettings.solver_params.SimulatedAnnealing!,
                      initial_temperature: parseFloat(e.target.value) || 1.0
                    }
                  }
                })}
                step="0.1"
                min="0.1"
                max="10.0"
              />
            </div>
            <div>
              <label className="label">Final Temperature</label>
              <input
                type="number"
                className="input"
                value={solverSettings.solver_params.SimulatedAnnealing?.final_temperature || 0.01}
                onChange={(e) => updateSolverSettings({
                  ...solverSettings,
                  solver_params: {
                    ...solverSettings.solver_params,
                    SimulatedAnnealing: {
                      ...solverSettings.solver_params.SimulatedAnnealing!,
                      final_temperature: parseFloat(e.target.value) || 0.01
                    }
                  }
                })}
                step="0.001"
                min="0.001"
                max="1.0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Status Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Solver Status</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              solverState.isRunning ? 'bg-success-500 animate-pulse-slow' : 'bg-gray-300'
            }`}></div>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {solverState.isRunning ? 'Running' : 'Idle'}
            </span>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>Iteration Progress</span>
              <span>{solverState.currentIteration.toLocaleString()} / {(solverSettings.stop_conditions.max_iterations || 0).toLocaleString()}</span>
            </div>
            <div className="w-full" style={{ backgroundColor: 'var(--border-secondary)' }}>
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${getProgressPercentage()}%`,
                  backgroundColor: '#2563eb' // Blue color for iteration progress
                }}
                data-percentage={getProgressPercentage()}
                data-debug="iteration-progress"
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>Time Progress</span>
              <span>{(solverState.elapsedTime / 1000).toFixed(1)}s / {solverSettings.stop_conditions.time_limit_seconds || 0}s</span>
            </div>
            <div className="w-full" style={{ backgroundColor: 'var(--border-secondary)' }}>
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${getTimeProgressPercentage()}%`,
                  backgroundColor: '#d97706' // Orange color for time progress
                }}
                data-percentage={getTimeProgressPercentage()}
                data-debug="time-progress"
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>No Improvement Progress</span>
              <span>{solverState.noImprovementCount.toLocaleString()} / {(solverSettings.stop_conditions.no_improvement_iterations || 0).toLocaleString()}</span>
            </div>
            <div className="w-full" style={{ backgroundColor: 'var(--border-secondary)' }}>
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${getNoImprovementProgressPercentage()}%`,
                  backgroundColor: '#dc2626' // Red color for no improvement progress
                }}
                data-percentage={getNoImprovementProgressPercentage()}
                data-debug="no-improvement-progress"
              ></div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-primary-50 rounded-lg">
            <Activity className="h-8 w-8 text-primary-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-primary-600">
              {solverState.currentIteration.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Iterations</div>
          </div>
          <div className="text-center p-4 bg-success-50 rounded-lg">
            <TrendingUp className="h-8 w-8 text-success-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-success-600">
              {solverState.bestScore.toFixed(2)}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Best Score</div>
          </div>
          <div className="text-center p-4 bg-warning-50 rounded-lg">
            <Clock className="h-8 w-8 text-warning-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-warning-600">
              {(solverState.elapsedTime / 1000).toFixed(1)}s
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Elapsed Time</div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex space-x-3">
          {!solverState.isRunning ? (
            <button
              onClick={handleStartSolver}
              className="btn-success flex-1 flex items-center justify-center space-x-2"
              disabled={!problem || !problem.people?.length || !problem.groups?.length}
            >
              <Play className="h-4 w-4" />
              <span>Start Solver</span>
            </button>
          ) : (
            <button
              onClick={handleStopSolver}
              className="btn-warning flex-1 flex items-center justify-center space-x-2"
            >
              <Pause className="h-4 w-4" />
              <span>Cancel Solver</span>
            </button>
          )}
          
          <button
            onClick={handleResetSolver}
            className="btn-secondary flex items-center space-x-2"
            disabled={solverState.isRunning}
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Problem Status */}
      <div className="card">
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Problem Status</h3>
        {problem ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-primary-600 font-medium text-sm">
                  {problem.people.length}
                </span>
              </div>
              <div className="text-2xl font-bold text-primary-600">
                {problem.people.length}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>People</div>
            </div>
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-success-600 font-medium text-sm">
                  {problem.num_sessions}
                </span>
              </div>
              <div className="text-2xl font-bold text-success-600">
                {problem.num_sessions}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sessions</div>
            </div>
            <div className="text-center p-4 bg-warning-50 rounded-lg">
              <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-warning-600 font-medium text-sm">
                  {problem.constraints.length}
                </span>
              </div>
              <div className="text-2xl font-bold text-warning-600">
                {problem.constraints.length}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Constraints</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No problem configured</p>
            <p className="text-sm">Go to Problem Setup to configure your optimization problem</p>
          </div>
        )}
      </div>

      {/* Algorithm Info */}
      <div className="card">
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Algorithm Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
                          <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Simulated Annealing</h4>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              A probabilistic optimization algorithm that mimics the annealing process in metallurgy.
            </p>
            <ul className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <li>• Starts with high temperature for exploration</li>
              <li>• Gradually cools to focus on local improvements</li>
              <li>• Can escape local optima</li>
              <li>• Well-suited for combinatorial problems</li>
            </ul>
          </div>
          <div>
                          <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Current Parameters</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Initial Temperature:</span>
                <span className="font-medium">{solverSettings.solver_params.SimulatedAnnealing?.initial_temperature || 1.0}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Final Temperature:</span>
                <span className="font-medium">{solverSettings.solver_params.SimulatedAnnealing?.final_temperature || 0.01}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Max Iterations:</span>
                <span className="font-medium">{(solverSettings.stop_conditions.max_iterations || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Time Limit:</span>
                <span className="font-medium">{solverSettings.stop_conditions.time_limit_seconds || 0}s</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>No Improvement Limit:</span>
                <span className="font-medium">{(solverSettings.stop_conditions.no_improvement_iterations || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 