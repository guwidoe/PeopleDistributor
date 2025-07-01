import React, { useState } from 'react';
import { useAppStore } from '../store';
import { 
  BarChart3, 
  Clock, 
  Zap, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Calendar,
  CheckSquare,
  Square,
  GitCompare,
  Download,
  Target,
  Users,
  Layers
} from 'lucide-react';
import type { ProblemResult } from '../types';

export function ResultsHistory() {
  const {
    currentProblemId,
    savedProblems,
    selectedResultIds,
    selectResultsForComparison,
    updateResultName,
    deleteResult,
    setShowResultComparison,
    solution: currentSolution,
  } = useAppStore();

  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const currentProblem = currentProblemId ? savedProblems[currentProblemId] : null;
  const results = currentProblem?.results || [];

  const toggleExpanded = (resultId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedResults(newExpanded);
  };

  const toggleResultSelection = (resultId: string) => {
    const newSelection = selectedResultIds.includes(resultId)
      ? selectedResultIds.filter(id => id !== resultId)
      : [...selectedResultIds, resultId];
    selectResultsForComparison(newSelection);
  };

  const handleRename = (result: ProblemResult) => {
    setEditingId(result.id);
    setEditingName(result.name || `Result ${results.indexOf(result) + 1}`);
  };

  const handleSaveRename = () => {
    if (editingId && editingName.trim()) {
      updateResultName(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = (resultId: string) => {
    if (confirm('Are you sure you want to delete this result? This action cannot be undone.')) {
      deleteResult(resultId);
    }
  };

  const handleBulkDelete = () => {
    if (selectedResultIds.length === 0) return;
    
    const count = selectedResultIds.length;
    const message = `Are you sure you want to delete ${count} result${count > 1 ? 's' : ''}? This action cannot be undone.`;
    
    if (confirm(message)) {
      selectedResultIds.forEach(resultId => {
        deleteResult(resultId);
      });
      selectResultsForComparison([]);
    }
  };

  const handleCompareSelected = () => {
    if (selectedResultIds.length >= 2) {
      setShowResultComparison(true);
    }
  };

  const handleExportResult = (result: ProblemResult) => {
    const exportData = {
      result,
      problem: currentProblem?.problem,
      exportedAt: Date.now(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `result_${result.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'result'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getScoreColor = (score: number) => {
    // Lower scores are better (penalties)
    if (score <= -50000) return 'text-red-600';
    if (score <= -10000) return 'text-orange-600';
    if (score <= -1000) return 'text-yellow-600';
    if (score <= 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getBestResult = () => {
    if (results.length === 0) return null;
    return results.reduce((best, current) => 
      current.solution.final_score < best.solution.final_score ? current : best
    );
  };

  const bestResult = getBestResult();

  if (!currentProblem) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No Problem Selected</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Please select a problem to view its results history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Results History</h2>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for "{currentProblem.name}"
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedResultIds.length > 0 && (
            <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>{selectedResultIds.length} selected</span>
              {selectedResultIds.length >= 2 && (
                <button
                  onClick={handleCompareSelected}
                  className="btn-primary flex items-center space-x-2"
                >
                  <GitCompare className="h-4 w-4" />
                  <span>Compare</span>
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                className="btn-danger flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete {selectedResultIds.length > 1 ? `${selectedResultIds.length} Results` : 'Result'}</span>
              </button>
              <button
                onClick={() => selectResultsForComparison([])}
                className="btn-secondary"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Problem Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Problem Overview</h3>
          <div className="flex items-center space-x-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{currentProblem.problem.people.length} people</span>
            </div>
            <div className="flex items-center space-x-1">
              <Layers className="h-4 w-4" />
              <span>{currentProblem.problem.groups.length} groups</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{currentProblem.problem.num_sessions} sessions</span>
            </div>
          </div>
        </div>
        
                  {bestResult && (
            <div className="rounded-lg p-4 border badge-best">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="h-5 w-5" style={{ color: 'var(--badge-best-text)' }} />
              <span className="font-medium" style={{ color: 'var(--badge-best-text)' }}>Best Result</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--badge-best-text)' }}>Score:</span>
                <span className="ml-2 font-medium" style={{ color: 'var(--badge-best-text)' }}>
                  {bestResult.solution.final_score.toFixed(2)}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--badge-best-text)' }}>Duration:</span>
                <span className="ml-2 font-medium" style={{ color: 'var(--badge-best-text)' }}>
                  {formatDuration(bestResult.duration)}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--badge-best-text)' }}>Iterations:</span>
                <span className="ml-2 font-medium" style={{ color: 'var(--badge-best-text)' }}>
                  {bestResult.solution.iteration_count.toLocaleString()}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--badge-best-text)' }}>Name:</span>
                <span className="ml-2 font-medium" style={{ color: 'var(--badge-best-text)' }}>
                  {bestResult.name}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results List */}
      {results.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No Results Yet</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Run the solver to generate results for this problem.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {results
            .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
            .map((result, index) => {
              const isExpanded = expandedResults.has(result.id);
              const isSelected = selectedResultIds.includes(result.id);
              const isBest = result.id === bestResult?.id;
              const isCurrent = currentSolution && 
                currentSolution.final_score === result.solution.final_score &&
                currentSolution.iteration_count === result.solution.iteration_count;

              return (
                <div
                  key={result.id}
                  className={`card transition-all ${
                    isSelected ? 'ring-2' : ''
                  } ${isBest ? 'badge-best' : ''}`}
                  style={{
                    ...(isSelected && { 
                      borderColor: 'var(--color-accent)',
                      boxShadow: `0 0 0 2px var(--color-accent)`
                    })
                  }}
                >
                  {/* Result Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleResultSelection(result.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        {editingId === result.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              className="input text-sm flex-1"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              autoFocus
                            />
                            <button
                              onClick={handleSaveRename}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelRename}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {result.name}
                            </h3>
                            {isBest && (
                              <span className="px-2 py-1 text-xs rounded-full badge-best">Best</span>
                            )}
                            {isCurrent && (
                              <span className="px-2 py-1 text-xs rounded-full border" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}>Current</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleExpanded(result.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Result Summary */}
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Score:</span>
                      <span className={`font-medium ${getScoreColor(result.solution.final_score)}`}>
                        {result.solution.final_score.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Duration:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatDuration(result.duration)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Iterations:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {result.solution.iteration_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Created:</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatDate(result.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Score Breakdown */}
                      <div>
                        <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Score Breakdown</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Unique Contacts</div>
                            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {result.solution.unique_contacts}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Repetition Penalty</div>
                            <div className="font-medium text-red-600">
                              {result.solution.repetition_penalty.toFixed(2)}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Balance Penalty</div>
                            <div className="font-medium text-orange-600">
                              {result.solution.attribute_balance_penalty.toFixed(2)}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Constraint Penalty</div>
                            <div className="font-medium text-purple-600">
                              {result.solution.constraint_penalty.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Solver Settings */}
                      <div>
                        <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Solver Configuration</h4>
                        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                              <span style={{ color: 'var(--text-secondary)' }}>Max Iterations:</span>
                              <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {result.solverSettings.stop_conditions.max_iterations?.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)' }}>Time Limit:</span>
                              <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {result.solverSettings.stop_conditions.time_limit_seconds}s
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)' }}>No Improvement:</span>
                              <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {result.solverSettings.stop_conditions.no_improvement_iterations?.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)' }}>Initial Temp:</span>
                              <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {result.solverSettings.solver_params.SimulatedAnnealing?.initial_temperature}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)' }}>Final Temp:</span>
                              <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {result.solverSettings.solver_params.SimulatedAnnealing?.final_temperature}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)' }}>Cooling:</span>
                              <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {result.solverSettings.solver_params.SimulatedAnnealing?.cooling_schedule}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRename(result)}
                            className="btn-secondary flex items-center space-x-2"
                          >
                            <Edit3 className="h-4 w-4" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={() => handleExportResult(result)}
                            className="btn-secondary flex items-center space-x-2"
                          >
                            <Download className="h-4 w-4" />
                            <span>Export</span>
                          </button>
                        </div>
                        <button
                          onClick={() => handleDelete(result.id)}
                          className="btn-danger flex items-center space-x-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
} 