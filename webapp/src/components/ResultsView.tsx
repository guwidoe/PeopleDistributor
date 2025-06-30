import { useState } from 'react';
import { useAppStore } from '../store';
import { BarChart3, Download, Share2, TrendingUp, Clock, Users, Calendar, Eye, EyeOff, Filter, Hash } from 'lucide-react';

export function ResultsView() {
  const { solution, problem, addNotification } = useAppStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDetails, setShowDetails] = useState(true);
  const [filterSession, setFilterSession] = useState<string>('all');

  const handleExportResults = () => {
    if (!solution) {
      addNotification({
        type: 'error',
        title: 'No Results',
        message: 'No solution to export',
      });
      return;
    }

    // Create CSV export
    const csvContent = [
      'Person,Group,Session',
      ...solution.assignments.map(a => `${getPersonName(a.person_id)},${getGroupName(a.group_id)},Session ${a.session_id}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'people_distribution.csv';
    a.click();
    URL.revokeObjectURL(url);

    addNotification({
      type: 'success',
      title: 'Exported',
      message: 'Results exported as CSV',
    });
  };

  const handleShareResults = () => {
    if (!solution) {
      addNotification({
        type: 'error',
        title: 'No Results',
        message: 'No solution to share',
      });
      return;
    }

    // Copy to clipboard
    const resultsText = `PeopleDistributor Results:
Score: ${solution.score}
Constraint Violations: ${solution.constraint_violations}
Iterations: ${solution.iteration_count}
Time: ${(solution.elapsed_time_ms / 1000).toFixed(2)}s
Sessions: ${problem?.sessions_count || 0}
Groups: ${problem?.groups.length || 0}`;

    navigator.clipboard.writeText(resultsText).then(() => {
      addNotification({
        type: 'success',
        title: 'Copied',
        message: 'Results copied to clipboard',
      });
    });
  };

  const getSessionAssignments = (sessionId: number) => {
    if (!solution) return [];
    return solution.assignments.filter(a => a.session_id === sessionId);
  };

  const getGroupAssignments = (groupId: number, sessionId?: number) => {
    if (!solution) return [];
    return solution.assignments.filter(a => 
      a.group_id === groupId && (sessionId === undefined || a.session_id === sessionId)
    );
  };

  const getGroupName = (groupId: number) => {
    if (!problem) return `Group ${groupId}`;
    const group = problem.groups.find(g => g.id === groupId);
    return group ? group.name : `Group ${groupId}`;
  };

  const getPersonName = (personId: string) => {
    if (!problem) return personId;
    const person = problem.people.find(p => p.id === personId);
    return person ? person.name : personId;
  };

  const getQualityScore = () => {
    if (!solution) return 0;
    return ((1 - solution.constraint_violations / solution.assignments.length) * 100);
  };

  const getIterationsPerSecond = () => {
    if (!solution) return 0;
    return Math.round(solution.iteration_count / (solution.elapsed_time_ms / 1000));
  };

  const getUniqueSessionIds = () => {
    if (!solution) return [];
    const sessionIds = [...new Set(solution.assignments.map(a => a.session_id))];
    return sessionIds.sort((a, b) => a - b);
  };

  if (!solution) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Results</h2>
          <p className="text-gray-600 mt-1">
            View and analyze optimization results
          </p>
        </div>

        <div className="card">
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No results available</p>
            <p className="text-sm">Run the solver to see optimization results</p>
          </div>
        </div>
      </div>
    );
  }

  const uniqueSessionIds = getUniqueSessionIds();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Results</h2>
          <p className="text-gray-600 mt-1">
            Optimization completed successfully
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="btn-secondary flex items-center space-x-2"
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showDetails ? 'Hide' : 'Show'} Details</span>
          </button>
          <button
            onClick={handleShareResults}
            className="btn-secondary flex items-center space-x-2"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
          <button
            onClick={handleExportResults}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-success-500" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {solution.score.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-primary-500" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {solution.assignments.length}
              </div>
              <div className="text-sm text-gray-600">Assignments</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-warning-500" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {solution.constraint_violations}
              </div>
              <div className="text-sm text-gray-600">Violations</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8 text-error-500" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {(solution.elapsed_time_ms / 1000).toFixed(1)}s
              </div>
              <div className="text-sm text-gray-600">Time</div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      {showDetails && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="text-2xl font-bold text-primary-600">
                {solution.iteration_count.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Iterations</div>
            </div>
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <div className="text-2xl font-bold text-success-600">
                {getIterationsPerSecond().toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Iterations/sec</div>
            </div>
            <div className="text-center p-4 bg-warning-50 rounded-lg">
              <div className="text-2xl font-bold text-warning-600">
                {getQualityScore().toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Quality Score</div>
            </div>
            <div className="text-center p-4 bg-error-50 rounded-lg">
              <div className="text-2xl font-bold text-error-600">
                {problem?.sessions_count || 0}
              </div>
              <div className="text-sm text-gray-600">Sessions</div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Visualization */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Schedule</h3>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1"
                value={filterSession}
                onChange={(e) => setFilterSession(e.target.value)}
              >
                <option value="all">All Sessions</option>
                {uniqueSessionIds.map(sessionId => (
                  <option key={sessionId} value={sessionId.toString()}>
                    Session {sessionId}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'grid' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'list' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Session-based view */}
        <div className="space-y-6">
          {uniqueSessionIds.map((sessionId) => {
            const isFiltered = filterSession !== 'all' && filterSession !== sessionId.toString();
            if (isFiltered) return null;

            const sessionAssignments = getSessionAssignments(sessionId);
            
            return (
              <div key={sessionId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-primary-600" />
                    <h4 className="font-medium text-gray-900">Session {sessionId}</h4>
                  </div>
                  <span className="text-sm text-gray-500">
                    {sessionAssignments.length} people in {problem?.groups.length || 0} groups
                  </span>
                </div>

                {/* Groups within this session */}
                <div className={viewMode === 'grid' ? 
                  'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 
                  'space-y-3'
                }>
                  {problem?.groups.map((group) => {
                    const groupAssignments = getGroupAssignments(group.id, sessionId);
                    
                    return (
                      <div key={group.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Hash className="h-4 w-4 text-success-600" />
                            <span className="font-medium text-gray-900">{group.name}</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {groupAssignments.length}/{group.max_people}
                          </span>
                        </div>
                        
                        {groupAssignments.length > 0 ? (
                          <div className={viewMode === 'grid' ? 'space-y-1' : 'flex flex-wrap gap-2'}>
                            {groupAssignments.map((assignment, index) => (
                              <div key={index} className={
                                viewMode === 'grid' ? 
                                'flex items-center space-x-2 p-1' :
                                'flex items-center space-x-1 bg-white px-2 py-1 rounded text-sm'
                              }>
                                <div className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center">
                                  <span className="text-primary-600 text-xs font-medium">
                                    {getPersonName(assignment.person_id).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-sm text-gray-700">
                                  {getPersonName(assignment.person_id)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-2 text-gray-400">
                            <span className="text-xs">Empty</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group Distribution Chart */}
      {showDetails && problem && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Distribution</h3>
          <div className="space-y-4">
            {problem.groups.map((group) => {
              const allGroupAssignments = getGroupAssignments(group.id);
              const capacityPercentage = (allGroupAssignments.length / (group.max_people * uniqueSessionIds.length)) * 100;
              
              return (
                <div key={group.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {group.name}
                    </span>
                    <span className="text-gray-600">
                      {allGroupAssignments.length} total assignments across {uniqueSessionIds.length} sessions
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        capacityPercentage > 100 ? 'bg-error-500' : 
                        capacityPercentage > 80 ? 'bg-warning-500' : 'bg-success-500'
                      }`}
                      style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {capacityPercentage.toFixed(1)}% of total capacity ({group.max_people} × {uniqueSessionIds.length} sessions)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Assignments Table */}
      {showDetails && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Assignments</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Person</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Group</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Session</th>
                </tr>
              </thead>
              <tbody>
                {solution.assignments.map((assignment, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 text-sm text-gray-900">
                      {getPersonName(assignment.person_id)}
                    </td>
                    <td className="py-2 px-2 text-sm text-gray-600">
                      {getGroupName(assignment.group_id)}
                    </td>
                    <td className="py-2 px-2 text-sm text-gray-600">
                      Session {assignment.session_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 