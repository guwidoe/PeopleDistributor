import React, { useState } from 'react';
import { useAppStore } from '../store';
import { 
  BarChart3, 
  Users, 
  Target, 
  AlertTriangle, 
  Calendar, 
  Hash,
  Eye,
  EyeOff,
  Download,
  RefreshCw
} from 'lucide-react';

export function ResultsView() {
  const { problem, solution, solverState, addNotification } = useAppStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDetails, setShowDetails] = useState(false);

  if (!solution) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Target className="w-16 h-16 mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">No Results Yet</h3>
        <p className="text-center max-w-md">
          Run the solver to see optimization results and group assignments.
        </p>
      </div>
    );
  }

  const handleExportResults = () => {
    const exportData = {
      problem,
      solution,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimization-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateSummaryText = () => {
    if (!problem || !solution) return '';
    
    return `Optimization Results Summary:
  
Final Score: ${solution.final_score.toFixed(2)}
Unique Contacts: ${solution.unique_contacts}
Repetition Penalty: ${solution.repetition_penalty}
Constraint Penalty: ${solution.constraint_penalty}
Iterations: ${solution.iteration_count}
Time: ${(solution.elapsed_time_ms / 1000).toFixed(2)}s
Sessions: ${problem?.num_sessions || 0}
Groups: ${problem?.groups.length || 0}`;
  };

  // Group assignments by session for display
  const sessionData = Array.from({ length: problem?.num_sessions || 0 }, (_, sessionIndex) => {
    const sessionAssignments = solution.assignments.filter(a => a.session_id === sessionIndex);
    const groups = problem?.groups.map(group => ({
      ...group,
      people: sessionAssignments
        .filter(a => a.group_id === group.id)
        .map(a => problem?.people.find(p => p.id === a.person_id))
        .filter(Boolean)
    })) || [];
    
    return {
      sessionIndex,
      groups,
      totalPeople: sessionAssignments.length
    };
  });

  const renderMetricCard = (title: string, value: string | number, icon: React.ComponentType<any>, color: string) => (
    <div className="rounded-lg border p-6 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        {React.createElement(icon, { className: `w-8 h-8 ${color.replace('text-', 'text-').replace('-600', '-400')}` })}
      </div>
    </div>
  );

  const renderPersonBadge = (person: any) => {
    if (!person) return null;
    const displayName = person.attributes?.name || person.id;
    
    return (
      <div key={person.id} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
        <Users className="w-3 h-3" />
        {displayName}
      </div>
    );
  };

  const renderScheduleGrid = () => (
    <div className="space-y-6">
      {sessionData.map(({ sessionIndex, groups, totalPeople }) => (
        <div key={sessionIndex} className="rounded-lg border p-6 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
              Session {sessionIndex + 1}
            </h4>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {totalPeople} people assigned
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium" style={{ color: 'var(--text-primary)' }}>{group.id}</h5>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {group.people.length}/{group.size}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.people.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {group.people.map(renderPersonBadge)}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No assignments</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderScheduleList = () => (
    <div className="rounded-lg border overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Person
              </th>
              {Array.from({ length: problem?.num_sessions || 0 }, (_, i) => (
                <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {problem?.people.map(person => {
              const personAssignments = solution.assignments.filter(a => a.person_id === person.id);
              const displayName = person.attributes?.name || person.id;
              
              return (
                <tr key={person.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
                    </div>
                  </td>
                  {Array.from({ length: problem?.num_sessions || 0 }, (_, sessionIndex) => {
                    const assignment = personAssignments.find(a => a.session_id === sessionIndex);
                    return (
                      <td key={sessionIndex} className="px-6 py-4 whitespace-nowrap">
                        {assignment ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {assignment.group_id}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not assigned</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Optimization Results</h2>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Final score: {solution.final_score.toFixed(2)} • 
            {solution.iteration_count.toLocaleString()} iterations • 
            {(solution.elapsed_time_ms / 1000).toFixed(2)}s
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="btn-secondary flex items-center gap-2"
          >
            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
          <button
            onClick={handleExportResults}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderMetricCard("Final Score", solution.final_score.toFixed(1), Target, "text-green-600")}
        {renderMetricCard("Unique Contacts", solution.unique_contacts, Users, "text-blue-600")}
        {renderMetricCard("Repetition Penalty", solution.repetition_penalty, RefreshCw, "text-orange-600")}
        {renderMetricCard("Constraint Penalty", solution.constraint_penalty, AlertTriangle, "text-red-600")}
      </div>

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border p-6 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Score Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Unique Contacts</span>
                <span className="font-medium text-green-600">+{solution.unique_contacts}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Repetition Penalty</span>
                <span className="font-medium text-orange-600">-{solution.repetition_penalty}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Attribute Balance Penalty</span>
                <span className="font-medium text-purple-600">-{solution.attribute_balance_penalty}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Constraint Penalty</span>
                <span className="font-medium text-red-600">-{solution.constraint_penalty}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Final Score</span>
                <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{solution.final_score.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-6 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Problem Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total People</span>
                <span className="font-medium">{problem?.people.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Groups</span>
                <span className="font-medium">{problem?.groups.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sessions</span>
                <span className="font-medium">{problem?.num_sessions || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Constraints</span>
                <span className="font-medium">{problem?.constraints.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Assignments</span>
                <span className="font-medium">{solution.assignments.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule View */}
      <div className="rounded-lg border transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Group Assignments</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'grid'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Hash className="w-4 h-4 inline mr-1" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'list'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-1" />
                List
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {viewMode === 'grid' ? renderScheduleGrid() : renderScheduleList()}
        </div>
      </div>
    </div>
  );
} 