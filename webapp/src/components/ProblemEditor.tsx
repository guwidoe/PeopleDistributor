import { useState } from 'react';
import { useAppStore } from '../store';
import { Users, Calendar, Settings, Plus, Save, Upload, Trash2, Edit, X, Check, Zap, Hash, Tag, Clock } from 'lucide-react';
import type { Person, Group, Constraint, Problem, PersonFormData, GroupFormData, AttributeDefinition, SolverSettings } from '../types';

const getDefaultSolverSettings = (): SolverSettings => ({
  solver_type: "SimulatedAnnealing",
  stop_conditions: {
    max_iterations: 10000,
    time_limit_seconds: 30,
    no_improvement_iterations: 1000,
  },
  solver_params: {
    SimulatedAnnealing: {
      initial_temperature: 1.0,
      final_temperature: 0.01,
      cooling_schedule: "geometric",
    },
  },
  logging: {
    log_frequency: 1000,
    log_initial_state: true,
    log_duration_and_score: true,
    display_final_schedule: true,
    log_initial_score_breakdown: true,
    log_final_score_breakdown: true,
    log_stop_condition: true,
  },
});

export function ProblemEditor() {
  const { 
    problem, 
    setProblem, 
    addNotification, 
    generateDemoData,
    attributeDefinitions,
    addAttributeDefinition,
    removeAttributeDefinition 
  } = useAppStore();
  
  const [activeSection, setActiveSection] = useState<'people' | 'groups' | 'sessions' | 'attributes' | 'constraints'>('people');
  
  // Form states
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showAttributeForm, setShowAttributeForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingAttribute, setEditingAttribute] = useState<AttributeDefinition | null>(null);

  // Form data
  const [personForm, setPersonForm] = useState<PersonFormData>({
    attributes: {},
    sessions: []
  });

  const [groupForm, setGroupForm] = useState<GroupFormData>({
    size: 4
  });

  const [newAttribute, setNewAttribute] = useState({ key: '', values: [''] });
  const [sessionsCount, setSessionsCount] = useState(problem?.num_sessions || 3);

  // Constraint form states
  const [showConstraintForm, setShowConstraintForm] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<{ constraint: Constraint; index: number } | null>(null);
  const [constraintForm, setConstraintForm] = useState<{
    type: Constraint['type'];
    // RepeatEncounter
    max_allowed_encounters?: number;
    penalty_function?: 'linear' | 'squared';
    penalty_weight?: number;
    // AttributeBalance  
    group_id?: string;
    attribute_key?: string;
    desired_values?: Record<string, number>;
    // ImmovablePerson
    person_id?: string;
    // MustStayTogether / CannotBeTogether
    people?: string[];
    sessions?: number[];
  }>({
    type: 'RepeatEncounter',
    penalty_weight: 100
  });

  const handleSaveProblem = () => {
    if (!problem) {
      addNotification({
        type: 'error',
        title: 'No Problem',
        message: 'Please configure a problem first',
      });
      return;
    }

    localStorage.setItem('peopleDistributor-problem', JSON.stringify(problem));
    addNotification({
      type: 'success',
      title: 'Saved',
      message: 'Problem configuration saved successfully',
    });
  };

  const handleLoadProblem = () => {
    const saved = localStorage.getItem('peopleDistributor-problem');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProblem(parsed);
        setSessionsCount(parsed.num_sessions || 3);
        addNotification({
          type: 'success',
          title: 'Loaded',
          message: 'Problem configuration loaded successfully',
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Load Failed',
          message: 'Failed to load saved problem configuration',
        });
      }
    } else {
      addNotification({
        type: 'warning',
        title: 'No Saved Data',
        message: 'No saved problem configuration found',
      });
    }
  };

  const handleSessionsCountChange = (count: number) => {
    setSessionsCount(count);
    
    const updatedProblem: Problem = {
      people: problem?.people || [],
      groups: problem?.groups || [],
      num_sessions: count,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };

    setProblem(updatedProblem);
  };

  const handleAddPerson = () => {
    if (!personForm.attributes.name?.trim()) {
      addNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter a name for the person',
      });
      return;
    }

    const newPerson: Person = {
      id: `person_${Date.now()}`,
      attributes: { ...personForm.attributes },
      sessions: personForm.sessions.length > 0 ? personForm.sessions : undefined
    };

    const updatedProblem: Problem = {
      people: [...(problem?.people || []), newPerson],
      groups: problem?.groups || [],
      num_sessions: problem?.num_sessions || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };

    setProblem(updatedProblem);
    setPersonForm({ attributes: {}, sessions: [] });
    setShowPersonForm(false);
    
    addNotification({
      type: 'success',
      title: 'Person Added',
      message: `${newPerson.attributes.name} has been added to the problem`,
    });
  };

  const handleEditPerson = (person: Person) => {
    setEditingPerson(person);
    setPersonForm({
      attributes: { ...person.attributes },
      sessions: person.sessions || []
    });
    setShowPersonForm(true);
  };

  const handleUpdatePerson = () => {
    if (!editingPerson || !personForm.attributes.name?.trim()) return;

    const updatedPerson: Person = {
      ...editingPerson,
      attributes: { ...personForm.attributes },
      sessions: personForm.sessions.length > 0 ? personForm.sessions : undefined
    };

    const updatedProblem: Problem = {
      people: problem?.people.map(p => p.id === editingPerson.id ? updatedPerson : p) || [],
      groups: problem?.groups || [],
      num_sessions: problem?.num_sessions || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };

    setProblem(updatedProblem);
    setEditingPerson(null);
    setPersonForm({ attributes: {}, sessions: [] });
    setShowPersonForm(false);
    
    addNotification({
      type: 'success',
      title: 'Person Updated',
      message: `${updatedPerson.attributes.name} has been updated`,
    });
  };

  const handleDeletePerson = (personId: string) => {
    const updatedProblem: Problem = {
      people: problem?.people.filter(p => p.id !== personId) || [],
      groups: problem?.groups || [],
      num_sessions: problem?.num_sessions || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };

    setProblem(updatedProblem);
    
    addNotification({
      type: 'success',
      title: 'Person Removed',
      message: 'Person has been removed from the problem',
    });
  };

  const handleAddGroup = () => {
    if (!groupForm.id?.trim()) {
      addNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter a group ID',
      });
      return;
    }

    const newGroup: Group = {
      id: groupForm.id,
      size: groupForm.size
    };

    const updatedProblem: Problem = {
      people: problem?.people || [],
      groups: [...(problem?.groups || []), newGroup],
      num_sessions: problem?.num_sessions || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };

    setProblem(updatedProblem);
    setGroupForm({ size: 4 });
    setShowGroupForm(false);
    
    addNotification({
      type: 'success',
      title: 'Group Added',
      message: `Group "${newGroup.id}" has been added`,
    });
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupForm({
      id: group.id,
      size: group.size
    });
    setShowGroupForm(true);
  };

  const handleUpdateGroup = () => {
    if (!editingGroup || !groupForm.id?.trim()) return;

    const updatedGroup: Group = {
      id: groupForm.id,
      size: groupForm.size
    };

    const updatedProblem: Problem = {
      people: problem?.people || [],
      groups: problem?.groups.map(g => g.id === editingGroup.id ? updatedGroup : g) || [],
      num_sessions: problem?.num_sessions || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };

    setProblem(updatedProblem);
    setEditingGroup(null);
    setGroupForm({ size: 4 });
    setShowGroupForm(false);
    
    addNotification({
      type: 'success',
      title: 'Group Updated',
      message: `Group "${updatedGroup.id}" has been updated`,
    });
  };

  const handleDeleteGroup = (groupId: string) => {
    const updatedProblem: Problem = {
      people: problem?.people || [],
      groups: problem?.groups.filter(g => g.id !== groupId) || [],
      num_sessions: problem?.num_sessions || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };

    setProblem(updatedProblem);
    
    addNotification({
      type: 'success',
      title: 'Group Removed',
      message: `Group "${groupId}" has been removed`,
    });
  };

  const handleAddAttribute = () => {
    if (!newAttribute.key.trim() || newAttribute.values.some(v => !v.trim())) {
      addNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter an attribute key and at least one value',
      });
      return;
    }

    const definition: AttributeDefinition = {
      key: newAttribute.key,
      values: newAttribute.values.filter(v => v.trim())
    };

    addAttributeDefinition(definition);
    setNewAttribute({ key: '', values: [''] });
    setShowAttributeForm(false);
    
    addNotification({
      type: 'success',
      title: 'Attribute Added',
      message: `Attribute "${definition.key}" has been added`,
    });
  };

  const handleEditAttribute = (attribute: AttributeDefinition) => {
    setEditingAttribute(attribute);
    setNewAttribute({
      key: attribute.key,
      values: [...attribute.values]
    });
    setShowAttributeForm(true);
  };

  const handleUpdateAttribute = () => {
    if (!editingAttribute || !newAttribute.key.trim() || newAttribute.values.some(v => !v.trim())) {
      addNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter an attribute key and at least one value',
      });
      return;
    }

    // Remove the old attribute and add the new one
    removeAttributeDefinition(editingAttribute.key);
    
    const updatedDefinition: AttributeDefinition = {
      key: newAttribute.key.trim(),
      values: newAttribute.values.filter(v => v.trim())
    };

    addAttributeDefinition(updatedDefinition);
    
    setNewAttribute({ key: '', values: [''] });
    setEditingAttribute(null);
    setShowAttributeForm(false);
    
    addNotification({
      type: 'success',
      title: 'Attribute Updated',
      message: `Attribute "${updatedDefinition.key}" has been updated`,
    });
  };

  const handleAddConstraint = () => {
    let newConstraint: Constraint;

    try {
      switch (constraintForm.type) {
        case 'RepeatEncounter':
          if (!constraintForm.max_allowed_encounters || constraintForm.max_allowed_encounters < 0) {
            throw new Error('Please enter a valid maximum allowed encounters');
          }
          newConstraint = {
            type: 'RepeatEncounter',
            max_allowed_encounters: constraintForm.max_allowed_encounters,
            penalty_function: constraintForm.penalty_function || 'squared',
            penalty_weight: constraintForm.penalty_weight || 100
          };
          break;

        case 'AttributeBalance':
          if (!constraintForm.group_id || !constraintForm.attribute_key || !constraintForm.desired_values) {
            throw new Error('Please fill in all required fields for attribute balance');
          }
          newConstraint = {
            type: 'AttributeBalance',
            group_id: constraintForm.group_id,
            attribute_key: constraintForm.attribute_key,
            desired_values: constraintForm.desired_values,
            penalty_weight: constraintForm.penalty_weight || 50
          };
          break;

        case 'ImmovablePerson':
          if (!constraintForm.person_id || !constraintForm.group_id || !constraintForm.sessions?.length) {
            throw new Error('Please fill in all required fields for immovable person');
          }
          newConstraint = {
            type: 'ImmovablePerson',
            person_id: constraintForm.person_id,
            group_id: constraintForm.group_id,
            sessions: constraintForm.sessions
          };
          break;

        case 'MustStayTogether':
        case 'CannotBeTogether':
          if (!constraintForm.people?.length || constraintForm.people.length < 2) {
            throw new Error('Please select at least 2 people');
          }
          newConstraint = {
            type: constraintForm.type,
            people: constraintForm.people,
            penalty_weight: constraintForm.penalty_weight || 1000,
            sessions: constraintForm.sessions?.length ? constraintForm.sessions : undefined
          };
          break;

        default:
          throw new Error('Invalid constraint type');
      }

      const updatedProblem: Problem = {
        ...problem!,
        constraints: [...(problem?.constraints || []), newConstraint]
      };

      setProblem(updatedProblem);
      setConstraintForm({ type: 'RepeatEncounter', penalty_weight: 100 });
      setShowConstraintForm(false);
      
      addNotification({
        type: 'success',
        title: 'Constraint Added',
        message: `${constraintForm.type} constraint has been added`,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Invalid Input',
        message: error instanceof Error ? error.message : 'Please check your input',
      });
    }
  };

  const handleEditConstraint = (constraint: Constraint, index: number) => {
    setEditingConstraint({ constraint, index });
    setConstraintForm({
      type: constraint.type,
      max_allowed_encounters: constraint.max_allowed_encounters,
      penalty_function: constraint.penalty_function,
      penalty_weight: constraint.penalty_weight,
      group_id: constraint.group_id,
      attribute_key: constraint.attribute_key,
      desired_values: constraint.desired_values,
      person_id: constraint.person_id,
      people: constraint.people,
      sessions: constraint.sessions
    });
    setShowConstraintForm(true);
  };

  const handleUpdateConstraint = () => {
    if (!editingConstraint) return;

    try {
      let updatedConstraint: Constraint;

      switch (constraintForm.type) {
        case 'RepeatEncounter':
          if (!constraintForm.max_allowed_encounters || constraintForm.max_allowed_encounters < 0) {
            throw new Error('Please enter a valid maximum allowed encounters');
          }
          updatedConstraint = {
            type: 'RepeatEncounter',
            max_allowed_encounters: constraintForm.max_allowed_encounters,
            penalty_function: constraintForm.penalty_function || 'squared',
            penalty_weight: constraintForm.penalty_weight || 100
          };
          break;

        case 'AttributeBalance':
          if (!constraintForm.group_id || !constraintForm.attribute_key || !constraintForm.desired_values) {
            throw new Error('Please fill in all required fields for attribute balance');
          }
          updatedConstraint = {
            type: 'AttributeBalance',
            group_id: constraintForm.group_id,
            attribute_key: constraintForm.attribute_key,
            desired_values: constraintForm.desired_values,
            penalty_weight: constraintForm.penalty_weight || 50
          };
          break;

        case 'ImmovablePerson':
          if (!constraintForm.person_id || !constraintForm.group_id || !constraintForm.sessions?.length) {
            throw new Error('Please fill in all required fields for immovable person');
          }
          updatedConstraint = {
            type: 'ImmovablePerson',
            person_id: constraintForm.person_id,
            group_id: constraintForm.group_id,
            sessions: constraintForm.sessions
          };
          break;

        case 'MustStayTogether':
        case 'CannotBeTogether':
          if (!constraintForm.people?.length || constraintForm.people.length < 2) {
            throw new Error('Please select at least 2 people');
          }
          updatedConstraint = {
            type: constraintForm.type,
            people: constraintForm.people,
            penalty_weight: constraintForm.penalty_weight || 1000,
            sessions: constraintForm.sessions?.length ? constraintForm.sessions : undefined
          };
          break;

        default:
          throw new Error('Invalid constraint type');
      }

      const updatedConstraints = [...(problem?.constraints || [])];
      updatedConstraints[editingConstraint.index] = updatedConstraint;

      const updatedProblem: Problem = {
        ...problem!,
        constraints: updatedConstraints
      };

      setProblem(updatedProblem);
      setEditingConstraint(null);
      setConstraintForm({ type: 'RepeatEncounter', penalty_weight: 100 });
      setShowConstraintForm(false);
      
      addNotification({
        type: 'success',
        title: 'Constraint Updated',
        message: `${constraintForm.type} constraint has been updated`,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Invalid Input',
        message: error instanceof Error ? error.message : 'Please check your input',
      });
    }
  };

  const handleDeleteConstraint = (index: number) => {
    const updatedConstraints = problem?.constraints.filter((_, i) => i !== index) || [];
    const updatedProblem: Problem = {
      ...problem!,
      constraints: updatedConstraints
    };

    setProblem(updatedProblem);
    
    addNotification({
      type: 'success',
      title: 'Constraint Removed',
      message: 'Constraint has been removed',
    });
  };

  const renderPersonCard = (person: Person) => {
    const displayName = person.attributes.name || person.id;
    const sessionText = person.sessions 
      ? `Sessions: ${person.sessions.map(s => s + 1).join(', ')}`
      : 'All sessions';

    return (
      <div key={person.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-2">{displayName}</h4>
            <div className="space-y-1">
              <p className="text-sm text-blue-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {sessionText}
              </p>
              {Object.entries(person.attributes).map(([key, value]) => {
                if (key === 'name') return null;
                return (
                  <div key={key} className="flex items-center gap-1 text-xs">
                    <Tag className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-600">{key}:</span>
                    <span className="font-medium text-gray-800">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleEditPerson(person)}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeletePerson(person.id)}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGroupCard = (group: Group) => {
    return (
      <div key={group.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-2">{group.id}</h4>
            <p className="text-sm text-gray-600">
              Capacity: {group.size} people per session
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleEditGroup(group)}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteGroup(group.id)}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPersonForm = () => {
    const isEditing = editingPerson !== null;
    const sessions = Array.from({ length: sessionsCount }, (_, i) => i);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isEditing ? 'Edit Person' : 'Add Person'}
            </h3>
            <button
              onClick={() => {
                setShowPersonForm(false);
                setEditingPerson(null);
                setPersonForm({ attributes: {}, sessions: [] });
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Name (required) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={personForm.attributes.name || ''}
                onChange={(e) => setPersonForm(prev => ({
                  ...prev,
                  attributes: { ...prev.attributes, name: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter person's name"
              />
            </div>

            {/* Attributes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attributes
              </label>
              <div className="space-y-2">
                {attributeDefinitions.map(def => (
                  <div key={def.key}>
                    <label className="block text-xs text-gray-600 mb-1 capitalize">
                      {def.key}
                    </label>
                    <select
                      value={personForm.attributes[def.key] || ''}
                      onChange={(e) => setPersonForm(prev => ({
                        ...prev,
                        attributes: { ...prev.attributes, [def.key]: e.target.value }
                      }))}
                      className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select {def.key}</option>
                      {def.values.map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Sessions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Participation
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Leave empty for all sessions. Select specific sessions for late arrivals/early departures.
              </p>
              <div className="flex flex-wrap gap-2">
                {sessions.map(sessionIdx => (
                  <label key={sessionIdx} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={personForm.sessions.includes(sessionIdx)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPersonForm(prev => ({
                            ...prev,
                            sessions: [...prev.sessions, sessionIdx].sort()
                          }));
                        } else {
                          setPersonForm(prev => ({
                            ...prev,
                            sessions: prev.sessions.filter(s => s !== sessionIdx)
                          }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Session {sessionIdx + 1}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={isEditing ? handleUpdatePerson : handleAddPerson}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isEditing ? 'Update' : 'Add'} Person
            </button>
            <button
              onClick={() => {
                setShowPersonForm(false);
                setEditingPerson(null);
                setPersonForm({ attributes: {}, sessions: [] });
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGroupForm = () => {
    const isEditing = editingGroup !== null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isEditing ? 'Edit Group' : 'Add Group'}
            </h3>
            <button
              onClick={() => {
                setShowGroupForm(false);
                setEditingGroup(null);
                setGroupForm({ size: 4 });
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group ID *
              </label>
              <input
                type="text"
                value={groupForm.id || ''}
                onChange={(e) => setGroupForm(prev => ({ ...prev, id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., team-alpha, group-1"
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-xs text-gray-500 mt-1">Group ID cannot be changed when editing</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacity (people per session) *
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={groupForm.size}
                onChange={(e) => setGroupForm(prev => ({ ...prev, size: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum number of people that can be assigned to this group in any single session
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={isEditing ? handleUpdateGroup : handleAddGroup}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isEditing ? 'Update' : 'Add'} Group
            </button>
            <button
              onClick={() => {
                setShowGroupForm(false);
                setEditingGroup(null);
                setGroupForm({ size: 4 });
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderConstraintForm = () => {
    const isEditing = editingConstraint !== null;
    const sessions = Array.from({ length: sessionsCount }, (_, i) => i);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isEditing ? 'Edit Constraint' : 'Add Constraint'}
            </h3>
            <button
              onClick={() => {
                setShowConstraintForm(false);
                setEditingConstraint(null);
                setConstraintForm({ type: 'RepeatEncounter', penalty_weight: 100 });
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Constraint Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Constraint Type *
              </label>
              <select
                value={constraintForm.type}
                onChange={(e) => setConstraintForm(prev => ({ 
                  type: e.target.value as Constraint['type'],
                  penalty_weight: prev.penalty_weight 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isEditing}
              >
                <option value="RepeatEncounter">Repeat Encounter Limit</option>
                <option value="AttributeBalance">Attribute Balance</option>
                <option value="MustStayTogether">Must Stay Together</option>
                <option value="CannotBeTogether">Cannot Be Together</option>
                <option value="ImmovablePerson">Immovable Person</option>
              </select>
              {isEditing && (
                <p className="text-xs text-gray-500 mt-1">Constraint type cannot be changed when editing</p>
              )}
            </div>

            {/* Constraint-specific fields */}
            {constraintForm.type === 'RepeatEncounter' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Allowed Encounters *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={constraintForm.max_allowed_encounters || ''}
                    onChange={(e) => setConstraintForm(prev => ({ 
                      ...prev, 
                      max_allowed_encounters: parseInt(e.target.value) || 0 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum number of times any two people can be in the same group across all sessions
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Penalty Function
                  </label>
                  <select
                    value={constraintForm.penalty_function || 'squared'}
                    onChange={(e) => setConstraintForm(prev => ({ 
                      ...prev, 
                      penalty_function: e.target.value as 'linear' | 'squared' 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="linear">Linear</option>
                    <option value="squared">Squared (recommended)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Squared penalties increase more rapidly for multiple violations
                  </p>
                </div>
              </>
            )}

            {constraintForm.type === 'AttributeBalance' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Group *
                  </label>
                  <select
                    value={constraintForm.group_id || ''}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, group_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a group</option>
                    {problem?.groups.map(group => (
                      <option key={group.id} value={group.id}>{group.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attribute to Balance *
                  </label>
                  <select
                    value={constraintForm.attribute_key || ''}
                    onChange={(e) => setConstraintForm(prev => ({ 
                      ...prev, 
                      attribute_key: e.target.value,
                      desired_values: {} // Reset when attribute changes
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an attribute</option>
                    {attributeDefinitions.map(def => (
                      <option key={def.key} value={def.key}>{def.key}</option>
                    ))}
                  </select>
                </div>

                {constraintForm.attribute_key && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Desired Distribution *
                    </label>
                    <div className="space-y-2">
                      {attributeDefinitions
                        .find(def => def.key === constraintForm.attribute_key)
                        ?.values.map(value => (
                          <div key={value} className="flex items-center gap-2">
                            <span className="w-20 text-sm text-gray-600 capitalize">{value}:</span>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={constraintForm.desired_values?.[value] || ''}
                              onChange={(e) => setConstraintForm(prev => ({
                                ...prev,
                                desired_values: {
                                  ...prev.desired_values,
                                  [value]: parseInt(e.target.value) || 0
                                }
                              }))}
                              className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="0"
                            />
                          </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Desired number of people with each attribute value in this group
                    </p>
                  </div>
                )}
              </>
            )}

            {constraintForm.type === 'ImmovablePerson' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Person *
                  </label>
                  <select
                    value={constraintForm.person_id || ''}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, person_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a person</option>
                    {problem?.people.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.attributes.name || person.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fixed Group *
                  </label>
                  <select
                    value={constraintForm.group_id || ''}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, group_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a group</option>
                    {problem?.groups.map(group => (
                      <option key={group.id} value={group.id}>{group.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sessions *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sessions.map(sessionIdx => (
                      <label key={sessionIdx} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={constraintForm.sessions?.includes(sessionIdx) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConstraintForm(prev => ({
                                ...prev,
                                sessions: [...(prev.sessions || []), sessionIdx].sort()
                              }));
                            } else {
                              setConstraintForm(prev => ({
                                ...prev,
                                sessions: (prev.sessions || []).filter(s => s !== sessionIdx)
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Session {sessionIdx + 1}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Sessions where this person must be in the specified group
                  </p>
                </div>
              </>
            )}

            {(constraintForm.type === 'MustStayTogether' || constraintForm.type === 'CannotBeTogether') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    People * (select at least 2)
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                    {problem?.people.map(person => (
                      <label key={person.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={constraintForm.people?.includes(person.id) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConstraintForm(prev => ({
                                ...prev,
                                people: [...(prev.people || []), person.id]
                              }));
                            } else {
                              setConstraintForm(prev => ({
                                ...prev,
                                people: (prev.people || []).filter(id => id !== person.id)
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        {person.attributes.name || person.id}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apply to Sessions (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sessions.map(sessionIdx => (
                      <label key={sessionIdx} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={constraintForm.sessions?.includes(sessionIdx) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConstraintForm(prev => ({
                                ...prev,
                                sessions: [...(prev.sessions || []), sessionIdx].sort()
                              }));
                            } else {
                              setConstraintForm(prev => ({
                                ...prev,
                                sessions: (prev.sessions || []).filter(s => s !== sessionIdx)
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Session {sessionIdx + 1}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to apply to all sessions
                  </p>
                </div>
              </>
            )}

            {/* Penalty Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Penalty Weight
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={constraintForm.penalty_weight || ''}
                onChange={(e) => setConstraintForm(prev => ({ 
                  ...prev, 
                  penalty_weight: parseFloat(e.target.value) || 100 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher values make this constraint more important (1-10000). 
                Use 1000+ for hard constraints, 10-100 for preferences.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={isEditing ? handleUpdateConstraint : handleAddConstraint}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isEditing ? 'Update' : 'Add'} Constraint
            </button>
            <button
              onClick={() => {
                setShowConstraintForm(false);
                setEditingConstraint(null);
                setConstraintForm({ type: 'RepeatEncounter', penalty_weight: 100 });
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Problem Setup</h2>
          <p className="text-gray-600 mt-1">Configure people, groups, and constraints for optimization</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLoadProblem}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Load
          </button>
          <button
            onClick={handleSaveProblem}
            className="btn-secondary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={generateDemoData}
            className="btn-primary flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Demo Data
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'people', label: 'People', icon: Users, count: problem?.people.length },
            { id: 'groups', label: 'Groups', icon: Hash, count: problem?.groups.length },
            { id: 'sessions', label: 'Sessions', icon: Calendar, count: problem?.num_sessions },
            { id: 'attributes', label: 'Attributes', icon: Tag, count: attributeDefinitions.length },
            { id: 'constraints', label: 'Constraints', icon: Settings, count: problem?.constraints.length },
          ].map(({ id, label, icon: Icon, count }) => (
              <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSection === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {typeof count === 'number' && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {count}
                </span>
              )}
              </button>
          ))}
        </nav>
      </div>

      {/* Content */}
        {activeSection === 'people' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">People ({problem?.people.length || 0})</h3>
            <button
              onClick={() => setShowPersonForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Person
              </button>
            </div>

          {problem?.people.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {problem.people.map(renderPersonCard)}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No people added yet</p>
              <p className="text-sm">Add people to get started with your optimization problem</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Groups ({problem?.groups.length || 0})</h3>
            <button
              onClick={() => setShowGroupForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Group
            </button>
          </div>

          {problem?.groups.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {problem.groups.map(renderGroupCard)}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Hash className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No groups added yet</p>
              <p className="text-sm">Add groups where people will be assigned</p>
            </div>
          )}
          </div>
        )}

        {activeSection === 'sessions' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Sessions Configuration</h3>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Sessions
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sessionsCount}
                  onChange={(e) => handleSessionsCountChange(parseInt(e.target.value) || 1)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-2">
                  The algorithm will distribute people into groups across {sessionsCount} session{sessionsCount !== 1 ? 's' : ''}.
                  Each person can be assigned to one group per session.
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How Sessions Work</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Each session represents a time period (e.g., morning, afternoon, day 1, day 2)</li>
                  <li>• People are assigned to groups within each session</li>
                  <li>• The algorithm maximizes unique contacts across all sessions</li>
                  <li>• People can participate in all sessions or only specific ones</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'attributes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Attribute Definitions ({attributeDefinitions.length})</h3>
            <button
              onClick={() => setShowAttributeForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Attribute
              </button>
            </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">About Attributes</h4>
            <p className="text-sm text-blue-800">
              Attributes are key-value pairs that describe people (e.g., gender, department, seniority).
              They can be used in constraints like attribute balance or grouping preferences.
            </p>
          </div>

          {attributeDefinitions.length ? (
            <div className="space-y-3">
              {attributeDefinitions.map(def => (
                <div key={def.key} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 capitalize">{def.key}</h4>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {def.values.map(value => (
                          <span key={value} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditAttribute(def)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeAttributeDefinition(def.key)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Tag className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No attributes defined yet</p>
              <p className="text-sm">Add attribute definitions to categorize people</p>
            </div>
          )}
          </div>
        )}

        {activeSection === 'constraints' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Constraints ({problem?.constraints.length || 0})</h3>
            <button
              onClick={() => setShowConstraintForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Constraint
              </button>
            </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">About Constraints</h4>
            <p className="text-sm text-blue-800 mb-2">
              Constraints guide the optimization process by defining rules and preferences:
            </p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>RepeatEncounter:</strong> Limit how often people meet across sessions</li>
              <li>• <strong>AttributeBalance:</strong> Maintain desired distributions (e.g., gender balance)</li>
              <li>• <strong>MustStayTogether:</strong> Keep certain people in the same group</li>
              <li>• <strong>CannotBeTogether:</strong> Prevent certain people from being grouped</li>
              <li>• <strong>ImmovablePerson:</strong> Fix someone to a specific group in specific sessions</li>
            </ul>
          </div>

          {problem?.constraints.length ? (
            <div className="space-y-3">
              {problem.constraints.map((constraint, index) => (
                <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900">{constraint.type}</h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Weight: {constraint.penalty_weight || 'Default'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        {constraint.type === 'RepeatEncounter' && (
                          <>
                            <p>Max encounters: {constraint.max_allowed_encounters}</p>
                            <p>Penalty function: {constraint.penalty_function}</p>
                          </>
                        )}
                        
                        {constraint.type === 'AttributeBalance' && (
                          <>
                            <p>Group: {constraint.group_id}</p>
                            <p>Attribute: {constraint.attribute_key}</p>
                            <p>Desired distribution: {Object.entries(constraint.desired_values || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                          </>
                        )}
                        
                        {constraint.type === 'ImmovablePerson' && (
                          <>
                            <p>Person: {problem?.people.find(p => p.id === constraint.person_id)?.attributes.name || constraint.person_id}</p>
                            <p>Group: {constraint.group_id}</p>
                            <p>Sessions: {constraint.sessions?.map(s => s + 1).join(', ')}</p>
                          </>
                        )}
                        
                        {(constraint.type === 'MustStayTogether' || constraint.type === 'CannotBeTogether') && (
                          <>
                            <p>People: {constraint.people?.map(id => 
                              problem?.people.find(p => p.id === id)?.attributes.name || id
                            ).join(', ')}</p>
                            {constraint.sessions && (
                              <p>Sessions: {constraint.sessions.map(s => s + 1).join(', ')}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditConstraint(constraint, index)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteConstraint(index)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No constraints added yet</p>
              <p className="text-sm">Add constraints to guide the optimization process</p>
            </div>
          )}
          </div>
        )}

      {/* Forms */}
      {showPersonForm && renderPersonForm()}
      {showGroupForm && renderGroupForm()}
      {showConstraintForm && renderConstraintForm()}
      
      {showAttributeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingAttribute ? 'Edit Attribute Definition' : 'Add Attribute Definition'}
              </h3>
              <button
                onClick={() => {
                  setShowAttributeForm(false);
                  setNewAttribute({ key: '', values: [''] });
                  setEditingAttribute(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
      </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attribute Key *
                </label>
                <input
                  type="text"
                  value={newAttribute.key}
                  onChange={(e) => setNewAttribute(prev => ({ ...prev, key: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., skill_level, team, location"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Possible Values *
                </label>
                <div className="space-y-2">
                  {newAttribute.values.map((value, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => {
                          const newValues = [...newAttribute.values];
                          newValues[index] = e.target.value;
                          setNewAttribute(prev => ({ ...prev, values: newValues }));
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Value ${index + 1}`}
                      />
                      {newAttribute.values.length > 1 && (
                        <button
                          onClick={() => {
                            const newValues = newAttribute.values.filter((_, i) => i !== index);
                            setNewAttribute(prev => ({ ...prev, values: newValues }));
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNewAttribute(prev => ({ ...prev, values: [...prev.values, ''] }))}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Value
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={editingAttribute ? handleUpdateAttribute : handleAddAttribute}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {editingAttribute ? 'Update Attribute' : 'Add Attribute'}
              </button>
              <button
                onClick={() => {
                  setShowAttributeForm(false);
                  setNewAttribute({ key: '', values: [''] });
                  setEditingAttribute(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 