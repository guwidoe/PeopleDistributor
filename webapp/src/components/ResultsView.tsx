import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { 
  BarChart3, 
  Users, 
  Target, 
  AlertTriangle, 
  Hash,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  PieChart,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { Constraint, Person } from '../types';
import { Tooltip } from './Tooltip';
import PersonCard from './PersonCard';

export function ResultsView() {
  const { problem, solution, solverState, currentProblemId, savedProblems } = useAppStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDetails, setShowDetails] = useState(false);

  // Derive the name of the currently displayed result (if any)
  const resultName = useMemo(() => {
    if (!currentProblemId || !solution) return undefined;
    const problem = savedProblems[currentProblemId];
    if (!problem) return undefined;
    const match = problem.results.find(r => r.solution === solution);
    return match?.name;
  }, [currentProblemId, savedProblems, solution]);

  // === Derived Metrics ===
  const avgUniqueContacts = useMemo(() => {
    if (!problem || !solution) return 0;
    const peopleCount = problem.people.length || 1;
    return (solution.unique_contacts * 2) / peopleCount;
  }, [problem, solution]);

  // === Maximum values for normalization ===
  const peopleCount = problem?.people.length || 1;
  const numSessions = problem?.num_sessions || 0;
  const maxUniqueTotalTheoretical = useMemo(() => (peopleCount * (peopleCount - 1)) / 2, [peopleCount]);
  const maxAvgContactsTheoretical = peopleCount - 1;

  // Alternative bound based on sessions & largest group capacity
  const capacityBiggestGroup = useMemo(() => {
    return problem?.groups && problem.groups.length > 0
      ? Math.max(...problem.groups.map(g => g.size))
      : 0;
  }, [problem]);

  const altMaxAvgContacts = numSessions * Math.max(0, capacityBiggestGroup - 1);
  const altMaxUniqueTotal = (altMaxAvgContacts * peopleCount) / 2;

  const effectiveMaxAvgContacts = Math.max(1, Math.min(maxAvgContactsTheoretical, altMaxAvgContacts || maxAvgContactsTheoretical));
  const effectiveMaxUniqueTotal = Math.max(1, Math.min(maxUniqueTotalTheoretical, altMaxUniqueTotal || maxUniqueTotalTheoretical));

  const uniqueRatio = useMemo(() => solution?.unique_contacts ? solution.unique_contacts / effectiveMaxUniqueTotal : 0, [solution?.unique_contacts, effectiveMaxUniqueTotal]);
  const avgRatio = useMemo(() => avgUniqueContacts / effectiveMaxAvgContacts, [avgUniqueContacts, effectiveMaxAvgContacts]);

  // Constraint penalty normalization
  const finalConstraintPenalty = solution?.weighted_constraint_penalty ?? solution?.constraint_penalty ?? 0;
  const baselineConstraintPenalty = useMemo(() => {
    const base = solverState.initialConstraintPenalty ?? solverState.currentConstraintPenalty ?? finalConstraintPenalty;
    return base === 0 ? (finalConstraintPenalty > 0 ? finalConstraintPenalty : 1) : base;
  }, [solverState.initialConstraintPenalty, solverState.currentConstraintPenalty, finalConstraintPenalty]);

  const constraintRatio = Math.min(finalConstraintPenalty / baselineConstraintPenalty, 1);

  // === Constraint Compliance Evaluation ===
  type ConstraintCompliance = { constraint: Constraint; adheres: boolean; violations: number };

  const constraintResults: ConstraintCompliance[] = useMemo(() => {
    if (!problem || !solution) return [];

    // Build schedule map: session -> group -> people array
    const schedule: Record<number, Record<string, string[]>> = {};
    solution.assignments.forEach(a => {
      if (!schedule[a.session_id]) schedule[a.session_id] = {};
      if (!schedule[a.session_id][a.group_id]) schedule[a.session_id][a.group_id] = [];
      schedule[a.session_id][a.group_id].push(a.person_id);
    });

    const personMap = new Map<string, Person>(problem.people.map(p => [p.id, p]));

    const results: ConstraintCompliance[] = problem.constraints.map((c): ConstraintCompliance => {
      switch (c.type) {
        case 'RepeatEncounter': {
          const pairCounts = new Map<string, number>();
          Object.values(schedule).forEach(groups => {
            Object.values(groups).forEach(peopleIds => {
              for (let i = 0; i < peopleIds.length; i++) {
                for (let j = i + 1; j < peopleIds.length; j++) {
                  const pairKey = [peopleIds[i], peopleIds[j]].sort().join('|');
                  pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
                }
              }
            });
          });
          let violations = 0;
          pairCounts.forEach(count => {
            if (count > c.max_allowed_encounters) {
              // Encounters exceed allowed total count
              violations += count - c.max_allowed_encounters;
            }
          });
          return { constraint: c, adheres: violations === 0, violations };
        }
        case 'AttributeBalance': {
          let violations = 0;
          const sessionsToCheck = c.sessions ?? Array.from({ length: problem.num_sessions }, (_, i) => i);
          sessionsToCheck.forEach(session => {
            const peopleIds = schedule[session]?.[c.group_id] || [];
            const counts: Record<string, number> = {};
            peopleIds.forEach(pid => {
              const person = personMap.get(pid);
              const val = person?.attributes?.[c.attribute_key] ?? '__UNKNOWN__';
              counts[val] = (counts[val] || 0) + 1;
            });
            Object.entries(c.desired_values).forEach(([val, desired]) => {
              if ((counts[val] || 0) !== desired) violations += Math.abs((counts[val] || 0) - desired);
            });
          });
          return { constraint: c, adheres: violations === 0, violations };
        }
        case 'ImmovablePeople': {
          let violations = 0;
          const sessions = c.sessions ?? Array.from({ length: problem.num_sessions }, (_, i) => i);
          sessions.forEach(session => {
            const peopleIds = schedule[session]?.[c.group_id] || [];
            c.people.forEach(pid => {
              if (!peopleIds.includes(pid)) violations += 1;
            });
          });
          return { constraint: c, adheres: violations === 0, violations };
        }
        case 'MustStayTogether': {
          const sessions = c.sessions ?? Array.from({ length: problem.num_sessions }, (_, i) => i);
          let violations = 0;
          sessions.forEach(session => {
            const groupIdSet = new Set<string>();
            c.people.forEach(pid => {
              let assignedGroup: string | undefined;
              const groups = schedule[session];
              if (groups) {
                for (const [gid, ids] of Object.entries(groups)) {
                  if (ids.includes(pid)) {
                    assignedGroup = gid;
                    break;
                  }
                }
              }
              if (assignedGroup) groupIdSet.add(assignedGroup);
              else violations += 1; // person not assigned
            });
            if (groupIdSet.size > 1) violations += groupIdSet.size - 1;
          });
          return { constraint: c, adheres: violations === 0, violations };
        }
        case 'ShouldNotBeTogether': {
          const sessions = c.sessions ?? Array.from({ length: problem.num_sessions }, (_, i) => i);
          let violations = 0;
          sessions.forEach(session => {
            const groups = schedule[session] || {};
            Object.values(groups).forEach(ids => {
              const overlap = ids.filter(id => c.people.includes(id));
              if (overlap.length > 1) violations += overlap.length - 1;
            });
          });
          return { constraint: c, adheres: violations === 0, violations };
        }
        default:
          return { constraint: c as Constraint, adheres: true, violations: 0 };
      }
    });

    return results;
  }, [problem, solution]);

  if (!solution) {
    return (
      <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--text-secondary)' }}>
        <Target className="w-16 h-16 mb-4" style={{ color: 'var(--text-tertiary)' }} />
        <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>No Results Yet</h3>
        <p className="text-center max-w-md" style={{ color: 'var(--text-secondary)' }}>
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

  // Color classes
  const uniqueColorClass = getColorClass(uniqueRatio);
  const avgColorClass = getColorClass(avgRatio);
  const constraintColorClass = getColorClass(constraintRatio, true);

  const getPersonById = (id: string) => problem?.people.find(p => p.id === id);

  const formatConstraintLabel = (constraint: Constraint): React.ReactNode => {
    switch (constraint.type) {
      case 'RepeatEncounter':
        return `Repeat Encounter (max ${constraint.max_allowed_encounters})`;
      case 'AttributeBalance':
        return (
          <>
            Attribute Balance – <span className="font-medium">{constraint.group_id}</span> ({constraint.attribute_key})
          </>
        );
      case 'ImmovablePeople': {
        return (
          <>
            Immovable – (
            {constraint.people.map((pid: string, idx: number) => {
              const person = getPersonById(pid);
              return (
                <React.Fragment key={pid}>
                  {idx > 0 && ''}
                  {person ? <PersonCard person={person} /> : pid}
                </React.Fragment>
              );
            })}
            ) in <span className="font-medium">{constraint.group_id}</span>
          </>
        );
      }
      case 'MustStayTogether': {
        return (
          <>
            Must Stay Together (
            {constraint.people.map((pid, idx) => {
              const person = getPersonById(pid);
              return (
                <React.Fragment key={pid}>
                  {idx > 0 && ''}
                  {person ? <PersonCard person={person} /> : pid}
                </React.Fragment>
              );
            })}
            )
          </>
        );
      }
      case 'ShouldNotBeTogether': {
        return (
          <>
            Should Not Be Together (
            {constraint.people.map((pid, idx) => {
              const person = getPersonById(pid);
              return (
                <React.Fragment key={pid}>
                  {idx > 0 && ''}
                  {person ? <PersonCard person={person} /> : pid}
                </React.Fragment>
              );
            })}
            )
          </>
        );
      }
      default:
        return 'Unknown Constraint';
    }
  };

  const renderMetricCard = (title: string, value: string | number, icon: React.ComponentType<{ className?: string }>, color: string) => (
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

  const renderPersonBadge = (person: Person) => {
    if (!person) return null;
    return <PersonCard key={person.id} person={person} />;
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
              <div key={group.id} className="border rounded-lg p-4" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium" style={{ color: 'var(--text-primary)' }}>{group.id}</h5>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {group.people.length}/{group.size}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.people.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {group.people.filter((person): person is Person => person !== undefined).map(renderPersonBadge)}
                    </div>
                  ) : (
                    <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>No assignments</p>
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
        <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
          <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Person
              </th>
              {Array.from({ length: problem?.num_sessions || 0 }, (_, i) => (
                <th key={i} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Session {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-secondary)' }}>
            {problem?.people.map(person => {
              const personAssignments = solution.assignments.filter(a => a.person_id === person.id);
              const displayName = person.attributes?.name || person.id;
              
              return (
                <tr key={person.id} className="transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
                    </div>
                  </td>
                  {Array.from({ length: problem?.num_sessions || 0 }, (_, sessionIndex) => {
                    const assignment = personAssignments.find(a => a.session_id === sessionIndex);
                    return (
                      <td key={sessionIndex} className="px-6 py-4 whitespace-nowrap">
                        {assignment ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}>
                            {assignment.group_id}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Not assigned</span>
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

  // === Helper for dynamic metric colors ===
  function getColorClass(ratio: number, invert: boolean = false): string {
    // Clamp between 0 and 1
    let r = Math.max(0, Math.min(1, ratio));
    if (invert) r = 1 - r;
    if (r >= 0.9) return 'text-green-600';
    if (r >= 0.75) return 'text-lime-600';
    if (r >= 0.5) return 'text-yellow-600';
    if (r >= 0.25) return 'text-orange-600';
    return 'text-red-600';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            Optimization Results{resultName ? ` - ${resultName}` : ''}
          </h2>
          <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-2">
              Cost Score: {solution.final_score.toFixed(2)}
              <Tooltip content={<span>Cost Score = Unique contacts minus penalties. <b>Lower is better.</b></span>}>
                <Info className="w-4 h-4" />
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              {solution.iteration_count.toLocaleString()} iterations • 
              {(solution.elapsed_time_ms / 1000).toFixed(2)}s <span className="ml-1 italic">(lower cost is better)</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="btn-secondary flex items-center gap-2 justify-center sm:justify-start"
          >
            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
          <button
            onClick={handleExportResults}
            className="btn-secondary flex items-center gap-2 justify-center sm:justify-start"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {renderMetricCard("Cost Score", solution.final_score.toFixed(1), Target, 'text-green-600')}
        {renderMetricCard("Unique Contacts", `${solution.unique_contacts} / ${effectiveMaxUniqueTotal}`, Users, uniqueColorClass)}
        {renderMetricCard("Avg Contacts / Person", `${avgUniqueContacts.toFixed(1)} / ${effectiveMaxAvgContacts}`, PieChart, avgColorClass)}
        {renderMetricCard("Repetition Penalty", (solution.weighted_repetition_penalty ?? solution.repetition_penalty).toFixed(1), RefreshCw, getColorClass((solution.weighted_repetition_penalty ?? solution.repetition_penalty) / ((solverState.currentRepetitionPenalty ?? (solution.weighted_repetition_penalty ?? solution.repetition_penalty)) || 1), true))}
        {renderMetricCard("Constraint Penalty", finalConstraintPenalty.toFixed(1), AlertTriangle, constraintColorClass)}
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
                <span className="font-medium text-orange-600">-{(solution.weighted_repetition_penalty ?? solution.repetition_penalty).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Attribute Balance Penalty</span>
                <span className="font-medium text-purple-600">-{solution.attribute_balance_penalty}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Constraint Penalty</span>
                <span className="font-medium text-red-600">-{(solution.weighted_constraint_penalty ?? solution.constraint_penalty).toFixed(2)}</span>
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

      {/* Constraint Compliance */}
      <div className="rounded-lg border p-6 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
        <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Constraint Compliance</h3>
        <div className="space-y-2">
          {constraintResults.length > 0 ? constraintResults.map((res, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {res.adheres ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                {formatConstraintLabel(res.constraint)}
              </div>
              {!res.adheres && (
                <span className="text-sm font-medium text-red-600">{res.violations} violation{res.violations !== 1 ? 's' : ''}</span>
              )}
            </div>
          )) : (
            <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>No constraints defined for this problem.</p>
          )}
        </div>
      </div>

      {/* Schedule View */}
      <div className="rounded-lg border transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
            <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Group Assignments</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className="px-3 py-1 rounded text-sm transition-colors"
                style={{
                  backgroundColor: viewMode === 'grid' ? 'var(--bg-tertiary)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--color-accent)' : 'var(--text-secondary)',
                  border: viewMode === 'grid' ? '1px solid var(--color-accent)' : '1px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'grid') {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'grid') {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <Hash className="w-4 h-4 inline mr-1" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className="px-3 py-1 rounded text-sm transition-colors"
                style={{
                  backgroundColor: viewMode === 'list' ? 'var(--bg-tertiary)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--color-accent)' : 'var(--text-secondary)',
                  border: viewMode === 'list' ? '1px solid var(--color-accent)' : '1px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'list') {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'list') {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
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