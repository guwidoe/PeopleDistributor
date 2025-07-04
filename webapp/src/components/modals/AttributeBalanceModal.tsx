import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Constraint } from '../../types';
import { useAppStore } from '../../store';

interface Props {
  initial?: Constraint | null;
  onCancel: () => void;
  onSave: (constraint: Constraint) => void;
}

const AttributeBalanceModal: React.FC<Props> = ({ initial, onCancel, onSave }) => {
  const { GetProblem, attributeDefinitions, ui } = useAppStore();
  
  const getInitialState = () => {
    if (ui.isLoading) {
      return {
        group_id: '',
        attribute_key: '',
        desired_values: {},
        penalty_weight: 50,
        sessions: [],
      };
    }
    
    const problem = GetProblem();
    const editing = !!initial;

    if (editing && initial?.type === 'AttributeBalance') {
      return {
        group_id: initial.group_id || '',
        attribute_key: initial.attribute_key || '',
        desired_values: initial.desired_values || {},
        penalty_weight: initial.penalty_weight || 50,
        sessions: initial.sessions || [],
      };
    }
    return {
      group_id: problem.groups?.[0]?.id || '',
      attribute_key: attributeDefinitions?.[0]?.key || '',
      desired_values: {},
      penalty_weight: 50,
      sessions: [],
    };
  };

  const [formState, setFormState] = useState(getInitialState);
  const [validationError, setValidationError] = useState<string>('');
  
  // Don't render until loading is complete to avoid creating new problems
  if (ui.isLoading) {
    return null;
  }
  
  const problem = GetProblem();
  const editing = !!initial;

  const handleDesiredValueChange = (key: string, value: string) => {
    const numValue = parseInt(value, 10);
    setFormState(prev => ({
      ...prev,
      desired_values: { ...prev.desired_values, [key]: isNaN(numValue) ? 0 : numValue },
    }));
  };

  const handleSave = () => {
    setValidationError('');

    if (!formState.group_id) {
      setValidationError('Please select a group.');
      return;
    }
    if (!formState.attribute_key) {
      setValidationError('Please select an attribute.');
      return;
    }
    if (Object.keys(formState.desired_values).length === 0) {
      setValidationError('Please define at least one desired value for the distribution.');
      return;
    }
    if (formState.penalty_weight <= 0) {
      setValidationError('Penalty weight must be a positive number.');
      return;
    }

    const newConstraint: Constraint = {
      type: 'AttributeBalance',
      group_id: formState.group_id,
      attribute_key: formState.attribute_key,
      desired_values: formState.desired_values,
      penalty_weight: formState.penalty_weight,
      sessions: formState.sessions.length > 0 ? formState.sessions : undefined,
    };

    onSave(newConstraint);
  };

  const selectedAttribute = attributeDefinitions.find(a => a.key === formState.attribute_key);

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
      <div className="rounded-lg p-6 w-full max-w-lg mx-4 modal-content">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Attribute Balance' : 'Add Attribute Balance'}</h3>
          <button onClick={onCancel} className="transition-colors" style={{ color: 'var(--text-tertiary)' }}><X className="w-5 h-5" /></button>
        </div>

        {validationError && (
          <div className="mb-4 p-3 rounded-md border" style={{ backgroundColor: 'var(--color-error-50)', borderColor: 'var(--color-error-200)', color: 'var(--color-error-700)' }}>{validationError}</div>
        )}

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Group *</label>
            <select name="group_id" value={formState.group_id} onChange={e => setFormState(p => ({...p, group_id: e.target.value}))} className="select w-full">
              {problem.groups?.map(g => (<option key={g.id} value={g.id}>{g.id}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Attribute *</label>
            <select name="attribute_key" value={formState.attribute_key} onChange={e => setFormState(p => ({...p, attribute_key: e.target.value, desired_values: {}}))} className="select w-full">
              {attributeDefinitions.map(a => (<option key={a.key} value={a.key}>{a.key}</option>))}
            </select>
          </div>

          {selectedAttribute && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Desired Distribution *</label>
              <div className="border rounded p-3 space-y-2" style={{ borderColor: 'var(--border-secondary)' }}>
                {selectedAttribute.values.map(val => (
                  <div key={val} className="flex items-center justify-between gap-2">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{val}</span>
                    <input
                      type="number"
                      min="0"
                      value={formState.desired_values[val] || ''}
                      onChange={e => handleDesiredValueChange(val, e.target.value)}
                      className="input w-24 text-center"
                      placeholder="Count"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Penalty Weight</label>
            <input type="number" name="penalty_weight" value={formState.penalty_weight} onChange={e => setFormState(p => ({...p, penalty_weight: parseFloat(e.target.value) || 0}))} className="input w-full" />
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

export default AttributeBalanceModal; 