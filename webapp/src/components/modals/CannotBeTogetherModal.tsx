import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Constraint } from '../../types';
import PersonCard from '../PersonCard';
import { useAppStore } from '../../store';

interface Props {
  sessionsCount: number;
  initial?: Constraint | null; // if editing existing
  onCancel: () => void;
  onSave: (constraint: Constraint) => void;
}

const CannotBeTogetherModal: React.FC<Props> = ({ sessionsCount, initial, onCancel, onSave }) => {
  const { GetProblem, ui } = useAppStore();
  
  // Don't render until loading is complete to avoid creating new problems
  if (ui.isLoading) {
    return null;
  }
  
  const problem = GetProblem();
  
  const editing = !!initial;
  const initPeople: string[] = editing && initial?.type === 'CannotBeTogether' ? initial.people : [];
  const initSessions: number[] = (editing && initial?.type === 'CannotBeTogether' && initial.sessions) ? initial.sessions : [];
  const initWeight: number = editing && initial?.type === 'CannotBeTogether' ? initial.penalty_weight : 500;


  const [selectedPeople, setSelectedPeople] = useState<string[]>(initPeople);
  const [selectedSessions, setSelectedSessions] = useState<number[]>(initSessions);
  const [penaltyWeight, setPenaltyWeight] = useState<number>(initWeight);
  const [personSearch, setPersonSearch] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  
  const filteredPeople = problem.people.filter(p => p.id.toLowerCase().includes(personSearch.toLowerCase()));

  const handleSave = () => {
    setValidationError('');
    if (selectedPeople.length < 2) {
      setValidationError('You must select at least two people.');
      return;
    }
    if (penaltyWeight <= 0) {
      setValidationError('Penalty weight must be a positive number.');
      return;
    }

    const newConstraint: Constraint = {
      type: 'CannotBeTogether',
      people: selectedPeople,
      penalty_weight: penaltyWeight,
      sessions: selectedSessions.length > 0 && selectedSessions.length < sessionsCount ? selectedSessions : undefined,
    };
    
    onSave(newConstraint);
  };

  const toggleSession = (sessionIndex: number) => {
    setSelectedSessions(prev => prev.includes(sessionIndex) ? prev.filter(s => s !== sessionIndex) : [...prev, sessionIndex]);
  };
  
  const allSessionsSelected = selectedSessions.length === 0 || selectedSessions.length === sessionsCount;

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
      <div className="rounded-lg p-6 w-full max-w-2xl mx-4 modal-content flex flex-col" style={{height: '80vh'}}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Cannot Be Together' : 'Add Cannot Be Together'}</h3>
          <button onClick={onCancel} className="transition-colors" style={{ color: 'var(--text-tertiary)' }}><X className="w-5 h-5" /></button>
        </div>

        {validationError && (
          <div className="mb-4 p-3 rounded-md border" style={{ backgroundColor: 'var(--color-error-50)', borderColor: 'var(--color-error-200)', color: 'var(--color-error-700)' }}>{validationError}</div>
        )}

        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-hidden">
          {/* Left: People Selection */}
          <div className="flex flex-col h-full">
            <label className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}><Check className="inline-block w-4 h-4 mr-1" /> People *</label>
            <input
              type="text"
              placeholder="Search people..."
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              className="input w-full mb-2"
            />
            <div className="flex-grow overflow-y-auto border rounded p-2" style={{ borderColor: 'var(--border-secondary)' }}>
              {filteredPeople.map((person) => (
                <label key={person.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPeople.includes(person.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPeople([...selectedPeople, person.id]);
                      } else {
                        setSelectedPeople(selectedPeople.filter(id => id !== person.id));
                      }
                    }}
                  />
                  <PersonCard person={person} />
                </label>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Select two or more people who should not be placed in the same group.</p>
          </div>

          {/* Right: Sessions & Weight */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}><Check className="inline-block w-4 h-4 mr-1" /> Sessions</label>
              <div className="border rounded p-3" style={{ borderColor: 'var(--border-secondary)' }}>
                <div className="max-h-48 overflow-y-auto">
                  {Array.from({ length: sessionsCount }, (_, i) => (
                    <div key={i} className="flex items-center my-1">
                      <input
                        type="checkbox"
                        id={`session-${i}`}
                        checked={selectedSessions.includes(i)}
                        onChange={() => toggleSession(i)}
                        className="form-checkbox h-4 w-4"
                      />
                      <label htmlFor={`session-${i}`} className="ml-2 text-sm" style={{ color: 'var(--text-primary)' }}>Session {i + 1}</label>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  {allSessionsSelected ? "Applies to all sessions." : `Applies to ${selectedSessions.length} selected session(s).`} Leave all unchecked to apply to all.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Penalty Weight</label>
              <input 
                type="number"
                value={penaltyWeight}
                onChange={(e) => setPenaltyWeight(parseFloat(e.target.value) || 0)}
                className="input w-full"
              />
               <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Higher values make the solver prioritize this constraint more.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t" style={{borderColor: 'var(--border-secondary)'}}>
          <button onClick={onCancel} className="px-4 py-2 rounded text-sm" style={{backgroundColor:'var(--bg-tertiary)',color:'var(--text-secondary)'}}>Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded text-sm" style={{backgroundColor:'var(--color-accent)',color:'white'}}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default CannotBeTogetherModal; 