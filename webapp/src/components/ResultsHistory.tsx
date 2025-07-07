import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  Clock, 
  Zap, 
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
  Layers,
  FileText,
  FileSpreadsheet,
  Eye
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
    setSolution,
  } = useAppStore();
  const navigate = useNavigate();

  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [exportDropdownOpen, setExportDropdownOpen] = useState<string | null>(null);

  const currentProblem = currentProblemId ? savedProblems[currentProblemId] : null;
  const results = currentProblem?.results || [];
  const allResultIds = results.map(r => r.id);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(null);
      }
    };

    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportDropdownOpen]);

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

  const handleSelectAll = () => {
    if (selectedResultIds.length === allResultIds.length) {
      selectResultsForComparison([]);
    } else {
      selectResultsForComparison(allResultIds);
    }
  };

  // Open details tab for this result
  const handleOpenDetails = (result: ProblemResult) => {
    setSolution(result.solution);
    navigate('/app/results');
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

  const handleExportResult = (result: ProblemResult, format: 'json' | 'csv' | 'excel') => {
    const fileName = result.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'result';
    
    if (format === 'json') {
      const exportData = {
        result,
        problem: currentProblem?.problem,
        exportedAt: Date.now(),
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      downloadFile(blob, `${fileName}.json`);
    } else if (format === 'csv') {
      const csvData = generateCSV(result);
      const blob = new Blob([csvData], { type: 'text/csv' });
      downloadFile(blob, `${fileName}.csv`);
    } else if (format === 'excel') {
      const csvData = generateCSV(result);
      const blob = new Blob([csvData], { type: 'application/vnd.ms-excel' });
      downloadFile(blob, `${fileName}.xls`);
    }
    
    setExportDropdownOpen(null);
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateCSV = (result: ProblemResult) => {
    const headers = [
      'Person ID',
      'Group ID', 
      'Session',
      'Person Name',
      'Person Attributes'
    ];

    const rows = result.solution.assignments.map(assignment => {
      const person = currentProblem?.problem.people.find(p => p.id === assignment.person_id);
      const personName = person?.attributes.name || assignment.person_id;
      const personAttrs = person ? Object.entries(person.attributes)
        .filter(([key]) => key !== 'name')
        .map(([key, value]) => `${key}:${value}`)
        .join('; ') : '';

      return [
        assignment.person_id,
        assignment.group_id,
        assignment.session_id + 1, // Convert to 1-based for user display
        personName,
        personAttrs
      ];
    });

    // Add metadata at the top
    const metadata = [
      ['Result Name', result.name || 'Unnamed Result'],
      ['Export Date', new Date().toISOString()],
      ['Final Score', result.solution.final_score.toFixed(2)],
      ['Unique Contacts', result.solution.unique_contacts.toString()],
      ['Duration', formatDuration(result.duration)],
      ['Iterations', result.solution.iteration_count.toLocaleString()],
      ['Repetition Penalty', (result.solution.weighted_repetition_penalty ?? result.solution.repetition_penalty).toFixed(2)],
      ['Balance Penalty', result.solution.attribute_balance_penalty.toFixed(2)],
      ['Constraint Penalty', (result.solution.weighted_constraint_penalty ?? result.solution.constraint_penalty).toFixed(2)],
      [], // Empty row
      headers
    ];

    const allRows = [...metadata, ...rows];
    
    return allRows.map(row => 
      row.map(cell => 
        typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) 
          ? `"${cell.replace(/"/g, '""')}"` 
          : cell
      ).join(',')
    ).join('\n');
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

  // Find the most recent result (by timestamp)
  const mostRecentResult = results.length > 0 ? results.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)) : null;
  const mostRecentResultId = mostRecentResult?.id;

  // === Helper: dynamic color class (copied from ResultsView) ===
  function getColorClass(ratio: number, invert: boolean = false): string {
    let r = Math.max(0, Math.min(1, ratio));
    if (invert) r = 1 - r;
    if (r >= 0.9) return 'text-green-600';
    if (r >= 0.75) return 'text-lime-600';
    if (r >= 0.5) return 'text-yellow-600';
    if (r >= 0.25) return 'text-orange-600';
    return 'text-red-600';
  }

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
      {/* Header & Bulk Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Results History</h2>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for "{currentProblem.name}"
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {results.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="btn-secondary text-sm w-full sm:w-auto"
            >
              {selectedResultIds.length === allResultIds.length ? 'Clear Selection' : 'Select All'}
            </button>
          )}
          {selectedResultIds.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm w-full sm:w-auto" style={{ color: 'var(--text-secondary)' }}>
              <span className="text-center sm:text-left">{selectedResultIds.length} selected</span>
              <div className="flex flex-col sm:flex-row gap-2">
                {selectedResultIds.length >= 2 && (
                  <button
                    onClick={handleCompareSelected}
                    className="btn-primary flex items-center justify-center sm:justify-start space-x-2"
                  >
                    <GitCompare className="h-4 w-4" />
                    <span>Compare</span>
                  </button>
                )}
                <button
                  onClick={handleBulkDelete}
                  className="btn-danger flex items-center justify-center sm:justify-start space-x-2"
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
            </div>
          )}
        </div>
      </div>

      {/* Problem Summary */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-4">
                      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Problem Overview</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
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
            .map((result) => {
              const isExpanded = expandedResults.has(result.id);
              const isSelected = selectedResultIds.includes(result.id);
              const isBest = result.id === bestResult?.id;
              // Only the most recent result is 'Current'
              const isCurrent = result.id === mostRecentResultId;

              // === Derived colors (mirror Result Details panel) ===
              const peopleCount = currentProblem.problem.people.length || 1;
              const maxUniqueTotalTheoretical = (peopleCount * (peopleCount - 1)) / 2;
              const numSessions = currentProblem.problem.num_sessions;
              const capacityBiggestGroup = Math.max(...currentProblem.problem.groups.map(g => g.size));
              const altMaxAvgContacts = numSessions * Math.max(0, capacityBiggestGroup - 1);
              const altMaxUniqueTotal = (altMaxAvgContacts * peopleCount) / 2;
              const effectiveMaxUniqueTotal = Math.max(1, Math.min(maxUniqueTotalTheoretical, altMaxUniqueTotal || maxUniqueTotalTheoretical));
              const uniqueRatio = result.solution.unique_contacts / effectiveMaxUniqueTotal;
              const uniqueColorClass = getColorClass(uniqueRatio);

              const repPenalty = result.solution.weighted_repetition_penalty ?? result.solution.repetition_penalty;
              const balPenalty = result.solution.attribute_balance_penalty;
              const conPenalty = result.solution.weighted_constraint_penalty ?? result.solution.constraint_penalty;

              const repColorClass = getColorClass(repPenalty === 0 ? 0 : 1, true);
              const balColorClass = getColorClass(balPenalty === 0 ? 0 : 1, true);
              const conColorClass = getColorClass(conPenalty === 0 ? 0 : 1, true);

              return (
                <div
                  key={result.id}
                  className={`card transition-all ${isCurrent ? '' : isSelected ? 'ring-2' : ''} ${isBest ? 'badge-best' : ''}`}
                  style={{
                    ...(isCurrent ? {
                      borderColor: 'var(--text-accent-green)',
                      boxShadow: `0 0 0 3px var(--text-accent-green)`
                    } : isSelected ? {
                      borderColor: 'var(--color-accent)',
                      boxShadow: `0 0 0 2px var(--color-accent)`
                    } : {})
                  }}
                  onClick={(e) => {
                    // Ignore clicks on interactive elements to prevent double toggle
                    const target = e.target as HTMLElement;
                    if (target.closest('button, a, input, textarea, svg')) return;
                    toggleResultSelection(result.id);
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
                      {isCurrent ? (
                        <button
                          onClick={() => handleOpenDetails(result)}
                          className="btn-primary flex items-center gap-2 px-3 py-1 text-sm"
                        >
                          <Eye className="h-4 w-4" />
                          View in Result Details
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenDetails(result)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Open in Result Details"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      )}
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
                            <div className={`font-medium ${uniqueColorClass}`}>
                              {result.solution.unique_contacts}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Repetition Penalty</div>
                            <div className={`font-medium ${repColorClass}`}>{repPenalty === 0 ? repPenalty.toFixed(2) : `-${repPenalty.toFixed(2)}`}</div>
                          </div>
                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Balance Penalty</div>
                            <div className={`font-medium ${balColorClass}`}>{balPenalty === 0 ? balPenalty.toFixed(2) : `-${balPenalty.toFixed(2)}`}</div>
                          </div>
                          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Constraint Penalty</div>
                            <div className={`font-medium ${conColorClass}`}>{conPenalty === 0 ? conPenalty.toFixed(2) : `-${conPenalty.toFixed(2)}`}</div>
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
                            <div>
                              <span style={{ color: 'var(--text-secondary)' }}>Reheat After:</span>
                              <span className="ml-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {(result.solverSettings.solver_params.SimulatedAnnealing?.reheat_after_no_improvement || 0) === 0 
                                  ? 'Disabled' 
                                  : (result.solverSettings.solver_params.SimulatedAnnealing?.reheat_after_no_improvement || 0).toLocaleString()
                                }
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
                          <div className="relative" ref={dropdownRef}>
                            <button
                              onClick={() => setExportDropdownOpen(
                                exportDropdownOpen === result.id ? null : result.id
                              )}
                              className="btn-secondary flex items-center space-x-2"
                            >
                              <Download className="h-4 w-4" />
                              <span>Export</span>
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            
                            {exportDropdownOpen === result.id && (
                              <div className="absolute left-0 mt-1 w-40 rounded-md shadow-lg z-10 border overflow-hidden" 
                                   style={{ 
                                     backgroundColor: 'var(--bg-primary)', 
                                     borderColor: 'var(--border-primary)' 
                                   }}>
                                <button
                                  onClick={() => handleExportResult(result, 'json')}
                                  className="flex items-center w-full px-3 py-2 text-sm text-left transition-colors"
                                  style={{ 
                                    color: 'var(--text-primary)',
                                    backgroundColor: 'transparent'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span>Export as JSON</span>
                                </button>
                                <button
                                  onClick={() => handleExportResult(result, 'csv')}
                                  className="flex items-center w-full px-3 py-2 text-sm text-left transition-colors"
                                  style={{ 
                                    color: 'var(--text-primary)',
                                    backgroundColor: 'transparent'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <FileSpreadsheet className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span>Export as CSV</span>
                                </button>
                                <button
                                  onClick={() => handleExportResult(result, 'excel')}
                                  className="flex items-center w-full px-3 py-2 text-sm text-left transition-colors"
                                  style={{ 
                                    color: 'var(--text-primary)',
                                    backgroundColor: 'transparent'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <FileSpreadsheet className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span>Export as Excel</span>
                                </button>
                              </div>
                            )}
                          </div>
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