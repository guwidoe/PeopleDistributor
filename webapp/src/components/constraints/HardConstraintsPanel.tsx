import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, Clock } from 'lucide-react';
import type { Constraint, Person } from '../../types';
import PersonCard from '../PersonCard';
import { useAppStore } from '../../store';

interface Props {
  onAddConstraint: (type: 'ImmovablePeople' | 'MustStayTogether') => void;
  onEditConstraint: (constraint: Constraint, index: number) => void;
  onDeleteConstraint: (index: number) => void;
}

const HARD_TABS = ['ImmovablePeople', 'MustStayTogether'] as const;

const constraintTypeLabels: Record<typeof HARD_TABS[number], string> = {
  ImmovablePeople: 'Immovable People',
  MustStayTogether: 'Must Stay Together',
};

function HardConstraintsPanel({ onAddConstraint, onEditConstraint, onDeleteConstraint }: Props) {
  const [activeTab, setActiveTab] = useState<typeof HARD_TABS[number]>('ImmovablePeople');
  const [showInfo, setShowInfo] = useState(false);
  const { GetProblem, ui } = useAppStore();

  // Don't render until loading is complete to avoid creating new problems
  if (ui.isLoading) {
    return <div className="space-y-4 pt-1 pl-0">Loading...</div>;
  }

  const problem = GetProblem();

  const constraintsByType = (problem.constraints || []).reduce((acc: Record<string, { constraint: Constraint; index: number }[]>, c, i) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push({ constraint: c, index: i });
    return acc;
  }, {});

  const selectedItems = constraintsByType[activeTab] || [];

  return (
    <div className="space-y-4 pt-0 pl-0">
      {/* Title */}
      <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Hard Constraints</h3>
      {/* Info Box */}
      <div className="rounded-md border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
        <button
          className="flex items-center gap-2 w-full p-4 text-left"
          onClick={() => setShowInfo(!showInfo)}
        >
          {showInfo ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />}
          <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>How do Hard Constraints work?</h4>
        </button>
        {showInfo && (
          <div className="p-4 pt-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p className="mb-2">Hard constraints <strong>must</strong> be satisfied. The solver throws an error if they cannot all be met.</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>Immovable People</strong>: Fix selected people to a group in chosen sessions.</li>
              <li><strong>Must Stay Together</strong>: Keep selected people in the same group.</li>
            </ul>
          </div>
        )}
      </div>
      {/* Sub-tabs and constraint lists remain unchanged */}
      <div className="flex gap-0 border-b mb-4" style={{ borderColor: 'var(--border-primary)' }}>
        {HARD_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={
              `px-4 py-2 -mb-px text-sm font-medium transition-colors rounded-t-md focus:outline-none ` +
              (activeTab === t
                ? 'border-x border-t border-b-0 border-[var(--color-accent)] text-[var(--color-accent)] shadow-sm z-10'
                : 'bg-transparent text-[var(--text-secondary)] border-0 hover:text-[var(--color-accent)]')
            }
            style={activeTab === t
              ? { 
                  borderColor: 'var(--color-accent)', 
                  borderBottom: 'none',
                  backgroundColor: 'var(--bg-primary)'
                }
              : {}}
          >
            {constraintTypeLabels[t]}
            <span className="ml-1 text-xs">({constraintsByType[t]?.length || 0})</span>
          </button>
        ))}
      </div>
      <div>
        <button
          onClick={() => onAddConstraint(activeTab)}
          className="btn-primary flex items-center gap-2 px-3 py-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'ImmovablePeople' ? 'Add Immovable People' : 'Add Clique'}
        </button>
      </div>
      {selectedItems.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No {constraintTypeLabels[activeTab]} constraints defined.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {selectedItems.map(({ constraint, index }) => (
            <div key={index} className="rounded-lg border p-4 transition-colors hover:shadow-md flex items-start justify-between" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{constraint.type}</span>
                </div>
                <div className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  {constraint.type === 'ImmovablePeople' && (
                    <>
                      <div className="flex flex-wrap items-center gap-1">
                        <span>People:</span>
                        {constraint.people.map((pid: string, idx: number) => {
                          const per = problem.people.find((p: Person) => p.id === pid);
                          return (
                            <React.Fragment key={pid}>
                              {per ? <PersonCard person={per} /> : <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{pid}</span>}
                              {idx < constraint.people.length - 1 && <span></span>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <div>Group: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.group_id}</span></div>
                      <div className="flex items-center gap-1 text-xs" style={{color:'var(--color-accent)'}}>
                        <Clock className="w-3 h-3" />
                        <span>Sessions:</span>
                        {constraint.sessions && constraint.sessions.length > 0 ? constraint.sessions.map((s:number)=>s+1).join(', ') : 'All Sessions'}
                      </div>
                    </>
                  )}

                  {constraint.type === 'MustStayTogether' && (
                    <>
                      <div className="flex flex-wrap items-center gap-1">
                        <span>People:</span>
                        {constraint.people.map((pid: string, idx: number) => {
                          const per = problem.people.find((p: Person) => p.id === pid);
                          return (
                            <React.Fragment key={pid}>
                              {per ? <PersonCard person={per} /> : <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{pid}</span>}
                              {idx < constraint.people.length - 1 && <span></span>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 text-xs" style={{color:'var(--color-accent)'}}>
                        <Clock className="w-3 h-3" />
                        <span>Sessions:</span>
                        {constraint.sessions && constraint.sessions.length > 0 ? constraint.sessions.map((s:number)=>s+1).join(', ') : 'All Sessions'}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => onEditConstraint(constraint, index)}
                  className="p-1 transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteConstraint(index)}
                  className="p-1 transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error-600)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HardConstraintsPanel;