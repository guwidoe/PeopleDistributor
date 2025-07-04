import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, Clock } from 'lucide-react';
import type { Constraint } from '../../types';
import { useAppStore } from '../../store';
import AttributeBalanceDashboard from '../AttributeBalanceDashboard';

interface Props {
  onAddConstraint: (type: 'RepeatEncounter' | 'CannotBeTogether' | 'AttributeBalance') => void;
  onEditConstraint: (constraint: Constraint, index: number) => void;
  onDeleteConstraint: (index: number) => void;
}

const SOFT_TABS = ['RepeatEncounter', 'CannotBeTogether', 'AttributeBalance'] as const;

const constraintTypeLabels: Record<typeof SOFT_TABS[number], string> = {
  RepeatEncounter: 'Repeat Encounter',
  CannotBeTogether: 'Cannot Be Together',
  AttributeBalance: 'Attribute Balance',
};

const SoftConstraintsPanel: React.FC<Props> = ({ onAddConstraint, onEditConstraint, onDeleteConstraint }) => {
  const [activeTab, setActiveTab] = useState<typeof SOFT_TABS[number]>('RepeatEncounter');
  const [showInfo, setShowInfo] = useState(false);
  const { GetProblem } = useAppStore();

  const problem = GetProblem();

  const constraintsByType = (problem.constraints || []).reduce((acc: Record<string, { constraint: Constraint; index: number }[]>, c, i) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push({ constraint: c, index: i });
    return acc;
  }, {});

  const selectedItems = constraintsByType[activeTab] || [];

  return (
    <div className="space-y-3">
      <div className="mt-1">
        <button
          className="flex items-center gap-1 text-xs font-medium hover:text-primary transition-colors"
          onClick={() => setShowInfo(!showInfo)}
          style={{ color: 'var(--text-secondary)' }}
        >
          {showInfo ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>About Soft Constraints</span>
        </button>
        {showInfo && (
          <div className="mt-1 pl-5 text-xs space-y-1" style={{ color: 'var(--text-tertiary)' }}>
            <p>Soft constraints can be violated. Each violation increases the schedule cost by its penalty weight.</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>Repeat Encounter</strong>: Limit how often pairs meet.</li>
              <li><strong>Attribute Balance</strong>: Keep group attribute distributions balanced.</li>
              <li><strong>Cannot Be Together</strong>: Discourage specified people from sharing a group.</li>
            </ul>
          </div>
        )}
      </div>

      {/* sub tabs */}
      <div className="flex flex-wrap gap-2 mb-2">
        {SOFT_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
            style={{ backgroundColor: activeTab === t ? 'var(--color-accent)' : 'var(--bg-tertiary)', color: activeTab === t ? 'white' : 'var(--text-secondary)' }}
          >
            {constraintTypeLabels[t]}
            <span className="ml-1 text-xs">({constraintsByType[t]?.length || 0})</span>
          </button>
        ))}
      </div>

      <div className="mt-1 mb-3">
        <button
          onClick={() => onAddConstraint(activeTab)}
          className="flex items-center gap-2 px-3 py-2 rounded-md font-medium text-white text-sm transition-colors"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'RepeatEncounter' ? 'Add Repeat Limit' : activeTab === 'AttributeBalance' ? 'Add Attribute Balance' : 'Add Cannot Be Together'}
        </button>
      </div>

      {/* Attribute Balance Dashboard */}
      {activeTab === 'AttributeBalance' && selectedItems.length > 0 && (
        <div className="mb-4">
          <AttributeBalanceDashboard 
            constraints={selectedItems.map(i => i.constraint as any)} 
            problem={problem} 
          />
        </div>
      )}

      {/* list */}
      {selectedItems.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No {constraintTypeLabels[activeTab]} constraints defined.</p>
      ) : (
        <div className="grid gap-3" style={{gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))'}}>
          {selectedItems.map(({ constraint, index }) => (
            <div key={index} className="rounded-lg border p-4 transition-colors hover:shadow-md flex items-start justify-between" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{constraint.type}</span>
                  {(constraint as Constraint & { penalty_weight?: number }).penalty_weight !== undefined && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}>Weight: {(constraint as Constraint & { penalty_weight: number }).penalty_weight}</span>
                  )}
                </div>
                <div className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  {constraint.type === 'RepeatEncounter' && (
                    <>
                      <div>Max encounters: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.max_allowed_encounters}</span></div>
                      <div>Penalty function: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.penalty_function}</span></div>
                    </>
                  )}

                  {constraint.type === 'AttributeBalance' && (
                    <>
                      <div>Group: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.group_id}</span></div>
                      <div>Attribute: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.attribute_key}</span></div>
                      <div className="flex flex-wrap gap-1 items-center text-xs">
                        <span style={{color:'var(--text-secondary)'}}>Distribution:</span>
                        {Object.entries(constraint.desired_values || {}).map(([k, v]) => (
                          <span key={k} className="inline-flex px-2 py-0.5 rounded-full font-medium" style={{backgroundColor:'var(--bg-tertiary)',color:'var(--color-accent)',border:`1px solid var(--color-accent)`}}>{k}: {v}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-xs" style={{color:'var(--color-accent)'}}>
                        <Clock className="w-3 h-3" />
                        <span>Sessions:</span>
                        {constraint.sessions && constraint.sessions.length > 0 ? (
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.sessions.map((s:number)=>s+1).join(', ')}</span>
                        ) : (
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>All sessions</span>
                        )}
                      </div>
                    </>
                  )}

                  {constraint.type === 'CannotBeTogether' && (
                    <>
                      <div className="break-words">People: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.people.join(', ')}</span></div>
                      <div className="flex items-center gap-1 text-xs" style={{color:'var(--color-accent)'}}>
                        <Clock className="w-3 h-3" />
                        <span>Sessions:</span>
                        {constraint.sessions && constraint.sessions.length > 0 ? (
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.sessions.map((s:number)=>s+1).join(', ')}</span>
                        ) : (
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>All sessions</span>
                        )}
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

export default SoftConstraintsPanel; 