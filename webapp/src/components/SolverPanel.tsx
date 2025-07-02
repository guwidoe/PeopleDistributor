import React, { useState, useRef } from 'react';
import { useAppStore } from '../store';
import { Play, Pause, RotateCcw, Settings, Zap, TrendingUp, Clock, Activity, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { SolverSettings, SolverState } from '../types';
import { solverWorkerService } from '../services/solverWorker';
import type { ProgressUpdate } from '../services/wasm';
import { Tooltip } from './Tooltip';

export function SolverPanel() {
  const { problem, solverState, startSolver, stopSolver, resetSolver, setSolverState, setSolution, addNotification, addResult, currentProblemId, updateProblem } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const cancelledRef = useRef(false);
  const solverCompletedRef = useRef(false);
  const [desiredRuntime, setDesiredRuntime] = useState<number>(3);

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
        reheat_after_no_improvement: 0, // 0 = disabled
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

  const handleSettingsChange = (newSettings: Partial<SolverSettings>) => {
    if (problem && currentProblemId) {
      const updatedProblem = {
        ...problem,
        settings: {
          ...solverSettings,
          ...newSettings,
          // Deep merge for nested objects if necessary
          ...(newSettings.solver_params && {
            solver_params: {
              ...solverSettings.solver_params,
              ...newSettings.solver_params,
            },
          }),
          ...(newSettings.stop_conditions && {
            stop_conditions: {
              ...solverSettings.stop_conditions,
              ...newSettings.stop_conditions,
            },
          }),
        },
      };
      updateProblem({ settings: updatedProblem.settings });
    }
  };

  // No more simulation needed - real progress comes from WASM solver

  const formatIterationTime = (ms: number): string => {
    if (ms >= 1) {
      return `${ms.toFixed(2)} ms`;
    }
    const us = ms * 1000;
    if (us >= 1) {
      return `${us.toFixed(2)} µs`;
    }
    const ns = us * 1000;
    return `${ns.toFixed(2)} ns`;
  };

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
        
        // Debug logging for progress updates
        if (progress.iteration % 1000 === 0 || progress.iteration < 10) {
          console.log(`[SolverPanel] Progress ${progress.iteration}: current_score=${progress.current_score}, best_score=${progress.best_score}`);
        }
        
        setSolverState({
          // Preserve initial constraint penalty for baseline coloring
          ...(progress.iteration === 0 && { initialConstraintPenalty: progress.current_constraint_penalty }),
          currentIteration: progress.iteration,
          bestScore: progress.best_score,
          elapsedTime: progress.elapsed_seconds * 1000, // Convert to milliseconds
          noImprovementCount: progress.no_improvement_count,
          
          // === Live Algorithm Metrics ===
          temperature: progress.temperature,
          coolingProgress: progress.cooling_progress,
          
          // Move type statistics
          cliqueSwapsTried: progress.clique_swaps_tried,
          cliqueSwapsAccepted: progress.clique_swaps_accepted,
          transfersTried: progress.transfers_tried,
          transfersAccepted: progress.transfers_accepted,
          swapsTried: progress.swaps_tried,
          swapsAccepted: progress.swaps_accepted,
          
          // Acceptance rates
          overallAcceptanceRate: progress.overall_acceptance_rate,
          recentAcceptanceRate: progress.recent_acceptance_rate,
          
          // Move quality metrics
          avgAttemptedMoveDelta: progress.avg_attempted_move_delta,
          avgAcceptedMoveDelta: progress.avg_accepted_move_delta,
          biggestAcceptedIncrease: progress.biggest_accepted_increase,
          biggestAttemptedIncrease: progress.biggest_attempted_increase,
          
          // Score breakdown
          currentRepetitionPenalty: progress.current_repetition_penalty,
          currentBalancePenalty: progress.current_balance_penalty,
          currentConstraintPenalty: progress.current_constraint_penalty,
          bestRepetitionPenalty: progress.best_repetition_penalty,
          bestBalancePenalty: progress.best_balance_penalty,
          bestConstraintPenalty: progress.best_constraint_penalty,
          
          // Algorithm behavior
          reheatsPerformed: progress.reheats_performed,
          iterationsSinceLastReheat: progress.iterations_since_last_reheat,
          localOptimaEscapes: progress.local_optima_escapes,
          avgTimePerIterationMs: progress.avg_time_per_iteration_ms,
          
          // Success rates by move type
          cliqueSwapSuccessRate: progress.clique_swap_success_rate,
          transferSuccessRate: progress.transfer_success_rate,
          swapSuccessRate: progress.swap_success_rate,
          
          // Advanced analytics
          scoreVariance: progress.score_variance,
          searchEfficiency: progress.search_efficiency,
        });
        
        // Log significant score improvements
        if (progress.best_score < (window as any).lastLoggedBestScore - 50 || !(window as any).lastLoggedBestScore) {
          console.log(`[SolverPanel] Significant improvement: best_score dropped to ${progress.best_score} at iteration ${progress.iteration}`);
          (window as any).lastLoggedBestScore = progress.best_score;
        }
        
        // Check if solver was cancelled
        if (cancelledRef.current) {
          return false; // Stop the solver
        }
        
        return true; // Continue solving
      };

      // Run the solver with progress updates using Web Worker
      const { solution, lastProgress } = await solverWorkerService.solveWithProgress(problemWithSettings, progressCallback);
      
      // Debug logging
      console.log('[SolverPanel] Solver completed');
      console.log('[SolverPanel] Solution final_score:', solution.final_score);
      console.log('[SolverPanel] Last progress best_score:', lastProgress?.best_score);
      console.log('[SolverPanel] Last progress current_score:', lastProgress?.current_score);
      
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
      console.log('[SolverPanel] Setting final solver state with bestScore:', solution.final_score);
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

  const handleAutoSetSettings = async () => {
    if (!problem) return;
    try {
      const recommendedSettings = await solverWorkerService.get_recommended_settings(problem, desiredRuntime);

      // Transform solver_params to UI structure if returned in flattened form
      let uiSettings: SolverSettings = recommendedSettings as any;
      const sp: any = (recommendedSettings as any).solver_params;
      if (sp && !('SimulatedAnnealing' in sp) && sp.solver_type === 'SimulatedAnnealing') {
        const {
          initial_temperature,
          final_temperature,
          cooling_schedule,
          reheat_after_no_improvement,
        } = sp as any;

        uiSettings = {
          ...recommendedSettings,
          solver_params: {
            SimulatedAnnealing: {
              initial_temperature,
              final_temperature,
              cooling_schedule,
              reheat_after_no_improvement,
            },
          },
        } as SolverSettings;
      }

      handleSettingsChange(uiSettings);
      addNotification({
        type: 'success',
        title: 'Settings Updated',
        message: 'Algorithm settings have been automatically configured.',
        duration: 5000,
      });
    } catch (error) {
      console.error("Error getting recommended settings:", error);
      addNotification({
        type: 'error',
        title: 'Auto-set Failed',
        message: `Could not determine recommended settings. ${error instanceof Error ? error.message : ''}`,
        duration: 5000,
      });
    }
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
          <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4 gap-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Solver Settings</h3>

            {/* Automatic Configuration (header right) */}
            <div className="flex items-end gap-2 p-3 rounded-lg" style={{ border: '1px solid var(--border-secondary)', backgroundColor: 'var(--background-secondary)' }}>
              <div className="flex-grow">
                <label htmlFor="desiredRuntime" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Desired Runtime (s)
                </label>
                <input
                  id="desiredRuntime"
                  type="number"
                  value={desiredRuntime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDesiredRuntime(Number(e.target.value))}
                  disabled={solverState.isRunning}
                  className="input w-24 md:w-32"
                />
              </div>
              <Tooltip text="Run a short trial to estimate optimal solver parameters for the specified runtime.">
                <button
                  onClick={handleAutoSetSettings}
                  disabled={solverState.isRunning}
                  className="btn-primary whitespace-nowrap"
                >
                  Auto-set
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <label htmlFor="maxIterations" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Max Iterations
                </label>
                <Tooltip text="The maximum number of iterations the solver will run.">
                  <Info className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </Tooltip>
              </div>
              <input
                type="number"
                className="input"
                value={solverSettings.stop_conditions.max_iterations || 10000}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSettingsChange({
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
              <div className="flex items-center space-x-2 mb-1">
                <label htmlFor="timeLimit" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Time Limit (seconds)
                </label>
                <Tooltip text="The maximum time the solver will run in seconds.">
                  <Info className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </Tooltip>
              </div>
              <input
                type="number"
                className="input"
                value={solverSettings.stop_conditions.time_limit_seconds || 30}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSettingsChange({
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
              <div className="flex items-center space-x-2 mb-1">
                <label htmlFor="noImprovementLimit" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  No Improvement Limit
                </label>
                <Tooltip text="Stop after this many iterations without improvement.">
                  <Info className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </Tooltip>
              </div>
              <input
                type="number"
                className="input"
                value={solverSettings.stop_conditions.no_improvement_iterations || 5000}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSettingsChange({
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
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <label htmlFor="initialTemperature" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Initial Temperature
                </label>
                <Tooltip text="The starting temperature for the simulated annealing algorithm. Higher values allow more exploration.">
                  <Info className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </Tooltip>
              </div>
              <input
                type="number"
                className="input"
                value={solverSettings.solver_params.SimulatedAnnealing?.initial_temperature || 1.0}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSettingsChange({
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
              <div className="flex items-center space-x-2 mb-1">
                <label htmlFor="finalTemperature" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Final Temperature
                </label>
                <Tooltip text="The temperature at which the algorithm will stop.">
                  <Info className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </Tooltip>
              </div>
              <input
                type="number"
                className="input"
                value={solverSettings.solver_params.SimulatedAnnealing?.final_temperature || 0.01}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSettingsChange({
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
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <label htmlFor="reheatAfterNoImprovement" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Reheat After No Improvement
                </label>
                <Tooltip text="Reset temperature to initial value after this many iterations without improvement (0 = disabled).">
                  <Info className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </Tooltip>
              </div>
              <input
                type="number"
                className="input"
                value={solverSettings.solver_params.SimulatedAnnealing?.reheat_after_no_improvement || 0}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSettingsChange({
                  ...solverSettings,
                  solver_params: {
                    ...solverSettings.solver_params,
                    SimulatedAnnealing: {
                      ...solverSettings.solver_params.SimulatedAnnealing!,
                      reheat_after_no_improvement: parseInt(e.target.value) || 0
                    }
                  }
                })}
                min="0"
                max="50000"
                placeholder="0 = disabled"
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

        {/* Basic Metrics Grid */}
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
        <div className="flex space-x-3 mb-6">
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

        {/* Live Algorithm Metrics */}
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer mb-3"
            onClick={() => setShowMetrics(!showMetrics)}
          >
            <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {solverState.isRunning
                ? "Live Algorithm Metrics"
                : solverState.isComplete
                ? "Final Algorithm Metrics"
                : "Algorithm Metrics"}
            </h4>
            {showMetrics ? (
              <ChevronDown className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            ) : (
              <ChevronRight className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            )}
          </div>
          
          {showMetrics && (
            <>
              {/* Temperature and Progress */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Temperature</span>
                    <Tooltip text="Current temperature of the simulated annealing algorithm.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-blue)' }}>
                    {solverState.temperature?.toFixed(4) || '0.0000'}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Cooling Progress</span>
                    <Tooltip text="Percentage of the way through the cooling schedule.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-purple)' }}>
                    {((solverState.coolingProgress || 0) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Acceptance Rate</span>
                    <Tooltip text="Overall percentage of proposed moves that have been accepted.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-green)' }}>
                    {((solverState.overallAcceptanceRate || 0) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Recent Acceptance</span>
                    <Tooltip text="Percentage of proposed moves accepted over the last 1000 iterations.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-orange)' }}>
                    {((solverState.recentAcceptanceRate || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Move Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <h5 className="font-medium mb-2 flex items-center space-x-2" style={{ color: 'var(--text-accent-indigo)' }}>
                    <span>Clique Swaps</span>
                    <Tooltip text="Swapping two entire groups of people who are incompatible with their current groups but compatible with each other's.">
                      <Info className="h-4 w-4" />
                    </Tooltip>
                  </h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Tried:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{solverState.cliqueSwapsTried?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Accepted:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{solverState.cliqueSwapsAccepted?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Success Rate:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{((solverState.cliqueSwapSuccessRate || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <h5 className="font-medium mb-2 flex items-center space-x-2" style={{ color: 'var(--text-accent-teal)' }}>
                    <span>Transfers</span>
                    <Tooltip text="Moving a single person from one group to another.">
                      <Info className="h-4 w-4" />
                    </Tooltip>
                  </h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Tried:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{solverState.transfersTried?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Accepted:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{solverState.transfersAccepted?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Success Rate:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{((solverState.transferSuccessRate || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <h5 className="font-medium mb-2 flex items-center space-x-2" style={{ color: 'var(--text-accent-cyan)' }}>
                    <span>Regular Swaps</span>
                    <Tooltip text="Swapping two people from different groups.">
                      <Info className="h-4 w-4" />
                    </Tooltip>
                  </h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Tried:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{solverState.swapsTried?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Accepted:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{solverState.swapsAccepted?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Success Rate:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{((solverState.swapSuccessRate || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Algorithm Behavior */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Local Optima Escapes</span>
                    <Tooltip text="Number of times the algorithm accepted a move that resulted in a worse score to escape a local optimum.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-red)' }}>
                    {solverState.localOptimaEscapes?.toLocaleString() || '0'}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Reheats Performed</span>
                    <Tooltip text="Number of times the temperature was reset to its initial value.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-yellow)' }}>
                    {solverState.reheatsPerformed || '0'}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Avg Time/Iteration</span>
                    <Tooltip text="Average time taken to complete one iteration in milliseconds.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-pink)' }}>
                    {formatIterationTime(solverState.avgTimePerIterationMs || 0)}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Search Efficiency</span>
                    <Tooltip text="A measure of how effectively the search is exploring the solution space.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-emerald)' }}>
                    {(solverState.searchEfficiency || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Score Quality Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                   <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Avg Attempted Delta</span>
                    <Tooltip text="Average change in score for all proposed moves.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-lime)' }}>
                    {(solverState.avgAttemptedMoveDelta || 0).toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                   <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Avg Accepted Delta</span>
                    <Tooltip text="Average change in score for all accepted moves.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-amber)' }}>
                    {(solverState.avgAcceptedMoveDelta || 0).toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                   <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Max Attempted Delta</span>
                    <Tooltip text="Largest score increase from an attempted move.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-red)' }}>
                    {(solverState.biggestAttemptedIncrease || 0).toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                   <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Max Accepted Delta</span>
                    <Tooltip text="Largest score increase from an accepted move (local optima escape).">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-orange)' }}>
                    {(solverState.biggestAcceptedIncrease || 0).toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                   <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Score Variance</span>
                    <Tooltip text="Statistical variance of the score over time.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-accent-rose)' }}>
                    {(solverState.scoreVariance || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Penalty Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Current Repetition Penalty</span>
                    <Tooltip text="Penalty applied for people who have been in groups together previously.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {solverState.currentRepetitionPenalty?.toFixed(2) || '0'}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                   <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Current Balance Penalty</span>
                    <Tooltip text="Penalty applied for imbalance in group sizes or attribute distribution.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {solverState.currentBalancePenalty?.toFixed(2) || '0'}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-secondary)' }}>
                   <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Current Constraint Penalty</span>
                    <Tooltip text="Penalty applied for violating hard constraints (e.g., people who must or must not be together).">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {solverState.currentConstraintPenalty?.toFixed(2) || '0'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Problem Status */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Problem Status</h3>
        {problem ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="text-2xl font-bold text-primary-600">
                {problem.people.length}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>People</div>
            </div>
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <div className="text-2xl font-bold text-success-600">
                {problem.num_sessions}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sessions</div>
            </div>
            <div className="text-center p-4 bg-warning-50 rounded-lg">
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
              <li>• Optional reheat feature restarts exploration when stuck</li>
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
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Reheat After:</span>
                <span className="font-medium">
                  {(solverSettings.solver_params.SimulatedAnnealing?.reheat_after_no_improvement || 0) === 0 
                    ? 'Disabled' 
                    : (solverSettings.solver_params.SimulatedAnnealing?.reheat_after_no_improvement || 0).toLocaleString()
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 