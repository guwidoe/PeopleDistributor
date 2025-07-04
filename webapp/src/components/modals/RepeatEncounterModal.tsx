import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Constraint } from '../../types';

interface Props {
  initial?: Constraint | null; // if editing existing
  onCancel: () => void;
  onSave: (constraint: Constraint) => void;
}

const RepeatEncounterModal: React.FC<Props> = ({ initial, onCancel, onSave }) => {
  const editing = !!initial;

  const getInitialState = () => {
    if (editing && initial?.type === 'RepeatEncounter') {
      return {
        max_allowed_encounters: initial.max_allowed_encounters ?? 1,
        penalty_function: initial.penalty_function ?? 'squared',
        penalty_weight: initial.penalty_weight ?? 100,
      };
    }
    return {
      max_allowed_encounters: 1,
      penalty_function: 'squared',
      penalty_weight: 100,
    };
  };

  const [formState, setFormState] = useState(getInitialState);
  const [validationError, setValidationError] = useState<string>('');

  const handleSave = () => {
    setValidationError('');

    if (formState.max_allowed_encounters < 0) {
      setValidationError('Max allowed encounters cannot be negative.');
      return;
    }
    if (formState.penalty_weight <= 0) {
      setValidationError('Penalty weight must be a positive number.');
      return;
    }

    const newConstraint: Constraint = {
      type: 'RepeatEncounter',
      max_allowed_encounters: formState.max_allowed_encounters,
      penalty_function: formState.penalty_function as 'linear' | 'squared',
      penalty_weight: formState.penalty_weight,
    };
    
    onSave(newConstraint);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: name === 'max_allowed_encounters' || name === 'penalty_weight' ? parseFloat(value) : value,
    }));
    if (validationError) setValidationError('');
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
      <div className="rounded-lg p-6 w-full max-w-md mx-4 modal-content">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Repeat Encounter' : 'Add Repeat Encounter'}</h3>
          <button onClick={onCancel} className="transition-colors" style={{ color: 'var(--text-tertiary)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="mb-4 p-3 rounded-md border" style={{ backgroundColor: 'var(--color-error-50)', borderColor: 'var(--color-error-200)', color: 'var(--color-error-700)' }}>
            {validationError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="max_allowed_encounters" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Max Allowed Encounters</label>
            <input
              id="max_allowed_encounters"
              name="max_allowed_encounters"
              type="number"
              value={formState.max_allowed_encounters}
              onChange={handleChange}
              className="input w-full"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>The number of times any two people can be in the same group before penalties apply.</p>
          </div>

          <div>
            <label htmlFor="penalty_function" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Penalty Function</label>
            <select
              id="penalty_function"
              name="penalty_function"
              value={formState.penalty_function}
              onChange={handleChange}
              className="select w-full"
            >
              <option value="squared">Squared</option>
              <option value="linear">Linear</option>
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>The penalty for each additional encounter beyond the maximum. `(n-max)^2` or `(n-max)`.</p>
          </div>

          <div>
            <label htmlFor="penalty_weight" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Penalty Weight</label>
            <input
              id="penalty_weight"
              name="penalty_weight"
              type="number"
              value={formState.penalty_weight}
              onChange={handleChange}
              className="input w-full"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Multiplier for the penalty score. Higher values make the solver prioritize this constraint more.</p>
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

export default RepeatEncounterModal; 