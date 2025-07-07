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
        penalty_weight: initial.penalty_weight ?? 1,
      };
    }
    return {
      max_allowed_encounters: 1,
      penalty_function: 'squared',
      penalty_weight: 1,
    };
  };

  const [formState, setFormState] = useState(getInitialState);
  const [validationError, setValidationError] = useState<string>('');

  // Validation functions
  const isMaxEncountersValid = (value: number | null) => {
    return value !== null && value >= 0;
  };

  const isPenaltyWeightValid = (value: number | null) => {
    return value !== null && value > 0;
  };

  const handleSave = () => {
    setValidationError('');

    if (!isMaxEncountersValid(formState.max_allowed_encounters)) {
      setValidationError('Max allowed encounters must be a non-negative number.');
      return;
    }
    if (!isPenaltyWeightValid(formState.penalty_weight)) {
      setValidationError('Penalty weight must be a positive number.');
      return;
    }

    const newConstraint: Constraint = {
      type: 'RepeatEncounter',
      max_allowed_encounters: formState.max_allowed_encounters!,
      penalty_function: formState.penalty_function as 'linear' | 'squared',
      penalty_weight: formState.penalty_weight!,
    };
    
    onSave(newConstraint);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'max_allowed_encounters' || name === 'penalty_weight') {
      const numValue = value === '' ? null : parseFloat(value);
      setFormState(prev => ({
        ...prev,
        [name]: numValue,
      }));
    } else {
      setFormState(prev => ({
        ...prev,
        [name]: value,
      }));
    }
    
    if (validationError) setValidationError('');
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="rounded-lg p-4 sm:p-6 w-full max-w-md mx-auto modal-content max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Repeat Encounter' : 'Add Repeat Encounter'}</h3>
          <button 
            onClick={onCancel} 
            className="transition-colors p-2 -m-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800" 
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="mb-4 p-3 rounded-md border" style={{ backgroundColor: 'var(--color-error-50)', borderColor: 'var(--color-error-200)', color: 'var(--color-error-700)' }}>
            {validationError}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label htmlFor="max_allowed_encounters" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Max Allowed Encounters</label>
            <input
              id="max_allowed_encounters"
              name="max_allowed_encounters"
              type="number"
              value={formState.max_allowed_encounters ?? ''}
              onChange={handleChange}
              className={`input w-full text-base py-3 ${!isMaxEncountersValid(formState.max_allowed_encounters) ? 'border-red-500 focus:border-red-500' : ''}`}
              min="0"
            />
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>The number of times any two people can be in the same group before penalties apply.</p>
          </div>

          <div>
            <label htmlFor="penalty_function" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Penalty Function</label>
            <select
              id="penalty_function"
              name="penalty_function"
              value={formState.penalty_function}
              onChange={handleChange}
              className="select w-full text-base py-3"
            >
              <option value="squared">Squared</option>
              <option value="linear">Linear</option>
            </select>
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>The penalty for each additional encounter beyond the maximum. `(n-max)^2` or `(n-max)`.</p>
          </div>

          <div>
            <label htmlFor="penalty_weight" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Penalty Weight</label>
            <input
              id="penalty_weight"
              name="penalty_weight"
              type="number"
              value={formState.penalty_weight ?? ''}
              onChange={handleChange}
              className={`input w-full text-base py-3 ${!isPenaltyWeightValid(formState.penalty_weight) ? 'border-red-500 focus:border-red-500' : ''}`}
              min="0"
              step="0.1"
            />
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>Multiplier for the penalty score. Higher values make the solver prioritize this constraint more.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <button 
            onClick={onCancel} 
            className="btn-secondary flex-1 sm:flex-none px-6 py-3 text-base font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="btn-primary flex-1 sm:flex-none px-6 py-3 text-base font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepeatEncounterModal; 