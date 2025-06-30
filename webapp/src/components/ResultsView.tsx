import { useAppStore } from '../store';
import { BarChart3, Download, Share2, TrendingUp, Clock, Users } from 'lucide-react';

export function ResultsView() {
  const { solution, problem, addNotification } = useAppStore();

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
      'Person,Session',
      ...solution.assignments.map(a => `${a.person_id},${a.session_id}`)
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
Time: ${(solution.elapsed_time_ms / 1000).toFixed(2)}s`;

    navigator.clipboard.writeText(resultsText).then(() => {
      addNotification({
        type: 'success',
        title: 'Copied',
        message: 'Results copied to clipboard',
      });
    });
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

      {/* Detailed Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignments Table */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignments</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Person</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Session</th>
                </tr>
              </thead>
              <tbody>
                {solution.assignments.map((assignment, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-2 text-sm text-gray-900">
                      {assignment.person_id}
                    </td>
                    <td className="py-2 px-2 text-sm text-gray-600">
                      {assignment.session_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Session Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Distribution</h3>
          {problem && (
            <div className="space-y-3">
              {problem.sessions.map((session) => {
                const assignments = solution.assignments.filter(
                  a => a.session_id === session.id
                );
                const percentage = (assignments.length / problem.people.length) * 100;
                
                return (
                  <div key={session.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        {session.name}
                      </span>
                      <span className="text-gray-600">
                        {assignments.length}/{session.max_people}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600">Iterations</div>
            <div className="text-xl font-semibold text-gray-900">
              {solution.iteration_count.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Iterations per Second</div>
            <div className="text-xl font-semibold text-gray-900">
              {Math.round(solution.iteration_count / (solution.elapsed_time_ms / 1000)).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Quality Score</div>
            <div className="text-xl font-semibold text-gray-900">
              {((1 - solution.constraint_violations / solution.assignments.length) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 