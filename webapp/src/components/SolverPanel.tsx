import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Play, Pause, RotateCcw, Settings, Zap, TrendingUp, Clock, Activity } from 'lucide-react';
import type { SolverSettings } from '../types';

export function SolverPanel() {
  const { problem, solverState, startSolver, stopSolver, resetSolver, addNotification } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);
  const [solverSettings, setSolverSettings] = useState<SolverSettings>({
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
  });

  // Simulate real-time updates when solver is running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (solverState.isRunning) {
      interval = setInterval(() => {
        // Simulate solver progress
        // In a real implementation, this would come from the WASM solver
        // For now, we'll just simulate the progress
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [solverState.isRunning, solverState.currentIteration, solverState.bestScore, solverState.elapsedTime]);

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
      startSolver();
      addNotification({
        type: 'info',
        title: 'Solving',
        message: 'Optimization algorithm started',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Solver Error',
        message: 'Failed to start solver',
      });
    }
  };

  const handleStopSolver = () => {
    stopSolver();
    addNotification({
      type: 'warning',
      title: 'Stopped',
      message: 'Solver stopped by user',
    });
  };

  const handleResetSolver = () => {
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
    return Math.min((solverState.elapsedTime / 1000 / solverSettings.stop_conditions.time_limit_seconds) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Solver</h2>
          <p className="text-gray-600 mt-1">
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Solver Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Max Iterations</label>
              <input
                type="number"
                className="input"
                value={solverSettings.stop_conditions.max_iterations || 10000}
                onChange={(e) => setSolverSettings({
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
                onChange={(e) => setSolverSettings({
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
              <label className="label">Initial Temperature</label>
              <input
                type="number"
                className="input"
                value={solverSettings.solver_params.SimulatedAnnealing?.initial_temperature || 1.0}
                onChange={(e) => setSolverSettings({
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
                onChange={(e) => setSolverSettings({
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
          <h3 className="text-lg font-semibold text-gray-900">Solver Status</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              solverState.isRunning ? 'bg-success-500 animate-pulse-slow' : 'bg-gray-300'
            }`}></div>
            <span className="text-sm text-gray-600">
              {solverState.isRunning ? 'Running' : 'Idle'}
            </span>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Iteration Progress</span>
              <span>{solverState.currentIteration.toLocaleString()} / {(solverSettings.stop_conditions.max_iterations || 0).toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Time Progress</span>
              <span>{(solverState.elapsedTime / 1000).toFixed(1)}s / {solverSettings.stop_conditions.time_limit_seconds || 0}s</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-warning-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getTimeProgressPercentage()}%` }}
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
            <div className="text-sm text-gray-600">Iterations</div>
          </div>
          <div className="text-center p-4 bg-success-50 rounded-lg">
            <TrendingUp className="h-8 w-8 text-success-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-success-600">
              {solverState.bestScore.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Best Score</div>
          </div>
          <div className="text-center p-4 bg-warning-50 rounded-lg">
            <Clock className="h-8 w-8 text-warning-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-warning-600">
              {(solverState.elapsedTime / 1000).toFixed(1)}s
            </div>
            <div className="text-sm text-gray-600">Elapsed Time</div>
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
              <span>Stop Solver</span>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Problem Status</h3>
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
              <div className="text-sm text-gray-600">People</div>
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
              <div className="text-sm text-gray-600">Sessions</div>
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
              <div className="text-sm text-gray-600">Constraints</div>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Algorithm Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Simulated Annealing</h4>
            <p className="text-sm text-gray-600 mb-3">
              A probabilistic optimization algorithm that mimics the annealing process in metallurgy.
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Starts with high temperature for exploration</li>
              <li>• Gradually cools to focus on local improvements</li>
              <li>• Can escape local optima</li>
              <li>• Well-suited for combinatorial problems</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Current Parameters</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Initial Temperature:</span>
                <span className="font-medium">{solverSettings.solver_params.SimulatedAnnealing?.initial_temperature || 1.0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Final Temperature:</span>
                <span className="font-medium">{solverSettings.solver_params.SimulatedAnnealing?.final_temperature || 0.01}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Iterations:</span>
                <span className="font-medium">{(solverSettings.stop_conditions.max_iterations || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time Limit:</span>
                <span className="font-medium">{solverSettings.stop_conditions.time_limit_seconds || 0}s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 