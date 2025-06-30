import { useState } from 'react';
import { useAppStore } from '../store';
import { Play, Pause, RotateCcw, Settings, Zap } from 'lucide-react';

export function SolverPanel() {
  const { problem, solverState, startSolver, stopSolver, resetSolver, addNotification } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);

  const handleStartSolver = async () => {
    if (!problem) {
      addNotification({
        type: 'error',
        title: 'No Problem',
        message: 'Please configure a problem first',
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
                placeholder="10000"
                defaultValue={10000}
              />
            </div>
            <div>
              <label className="label">Time Limit (seconds)</label>
              <input
                type="number"
                className="input"
                placeholder="30"
                defaultValue={30}
              />
            </div>
            <div>
              <label className="label">Temperature</label>
              <input
                type="number"
                className="input"
                placeholder="1.0"
                step="0.1"
                defaultValue={1.0}
              />
            </div>
            <div>
              <label className="label">Cooling Rate</label>
              <input
                type="number"
                className="input"
                placeholder="0.99"
                step="0.01"
                defaultValue={0.99}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {solverState.currentIteration.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Iterations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success-600">
              {solverState.bestScore.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Best Score</div>
          </div>
          <div className="text-center">
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
              disabled={!problem}
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
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {problem.people.length}
              </div>
              <div className="text-sm text-gray-600">People</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {problem.sessions.length}
              </div>
              <div className="text-sm text-gray-600">Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
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
    </div>
  );
} 