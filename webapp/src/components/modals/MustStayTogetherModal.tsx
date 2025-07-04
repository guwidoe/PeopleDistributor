import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Constraint } from '../../types';
import PersonCard from '../PersonCard';
import { useAppStore } from '../../store';

interface Props {
  sessionsCount: number;
  initial?: Constraint | null; // if editing existing
  onCancel: () => void;
  onSave: (constraint: Constraint) => void;
}

const MustStayTogetherModal: React.FC<Props> = ({ sessionsCount, initial, onCancel, onSave }) => {
  const { GetProblem, ui } = useAppStore();
  
  // Don't render until loading is complete to avoid creating new problems
  if (ui.isLoading) {
    return null;
  }
  
  const problem = GetProblem();
  
  const editing = !!initial;
  const initPeople: string[] = editing && initial?.type === 'MustStayTogether' ? initial.people : [];
  const initSessions: number[] = (editing && initial?.type === 'MustStayTogether' && initial.sessions) ? initial.sessions : [];

  const [selectedPeople, setSelectedPeople] = useState<string[]>(initPeople);
  const [selectedSessions, setSelectedSessions] = useState<number[]>(initSessions);
  const [validationError, setValidationError] = useState<string>('');

  const togglePerson = (pid: string) => {
    setSelectedPeople(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);
    if (validationError) setValidationError(''); // Clear error when user makes changes
  };

  const toggleSession = (idx: number) => {
    setSelectedSessions(prev => prev.includes(idx) ? prev.filter(s => s !== idx) : [...prev, idx]);
    if (validationError) setValidationError(''); // Clear error when user makes changes
  };

  const handleSave = () => {
    // Clear any previous validation errors
    setValidationError('');
    
    // Validation
    if (!problem.people || problem.people.length === 0) {
      setValidationError('No people available. Please add people to the problem first.');
      return;
    }
    
    if (selectedPeople.length < 2) {
      setValidationError('Please select at least two people to form a clique.');
      return;
    }
    
    const sessions = selectedSessions.length > 0 ? selectedSessions : undefined;
    
    const newConstraint: Constraint = {
      type: 'MustStayTogether',
      people: selectedPeople,
      penalty_weight: 1000.0, // Hard constraint
      sessions,
    };
    
    onSave(newConstraint);
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
      <div className="rounded-lg p-6 w-full max-w-lg mx-4 modal-content">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Must Stay Together' : 'Add Must Stay Together'}</h3>
          <button onClick={onCancel} className="transition-colors" style={{ color: 'var(--text-tertiary)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="mb-4 p-3 rounded-md border" style={{ backgroundColor: 'var(--color-error-50)', borderColor: 'var(--color-error-200)', color: 'var(--color-error-700)' }}>
            {validationError}
          </div>
        )}

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* People select */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>People (select 2 or more) *</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedPeople.map(pid => {
                const per = problem.people?.find(p => p.id === pid);
                return per ? <PersonCard key={pid} person={per} /> : <span key={pid} className="text-xs px-2 py-0.5 rounded-full" style={{backgroundColor:'var(--bg-tertiary)', color:'var(--color-accent)'}}>{pid}</span>;
              })}
            </div>
            <div className="border rounded p-2 max-h-40 overflow-y-auto" style={{ borderColor:'var(--border-secondary)' }}>
              {problem.people && problem.people.length > 0 ? (
                problem.people.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer mb-1" style={{ color:'var(--text-secondary)' }}>
                    <input type="checkbox" checked={selectedPeople.includes(p.id)} onChange={() => togglePerson(p.id)} />
                    {p.attributes.name || p.id}
                  </label>
                ))
              ) : (
                <div className="text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                  <p className="text-sm">No people available</p>
                  <p className="text-xs">Add people to the problem first</p>
                </div>
              )}
            </div>
          </div>

          {/* Sessions select */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sessions</label>
            <div className="flex flex-wrap gap-2">
              {Array.from({length: sessionsCount},(_,i)=>i).map(i=> (
                <label key={i} className="flex items-center gap-1 text-xs cursor-pointer" style={{color:'var(--text-secondary)'}}>
                  <input type="checkbox" checked={selectedSessions.includes(i)} onChange={()=>toggleSession(i)} />
                  Session {i+1}
                </label>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {selectedSessions.length === 0 ? 'No sessions selected - will apply to all sessions' : `Selected ${selectedSessions.length} session(s)`}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded text-sm" style={{backgroundColor:'var(--bg-tertiary)',color:'var(--text-secondary)'}}>Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded text-sm" style={{backgroundColor:'var(--color-accent)',color:'white'}}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default MustStayTogetherModal; 