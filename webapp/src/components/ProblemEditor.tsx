import { useState, useEffect, useRef } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useAppStore } from '../store';
import { Users, Calendar, Settings, Plus, Save, Upload, Trash2, Edit, X, Check, Zap, Hash, Clock, ChevronDown, ChevronRight, Tag, BarChart3, ArrowUpDown, Table } from 'lucide-react';
import type { Person, Group, Constraint, Problem, PersonFormData, GroupFormData, AttributeDefinition, SolverSettings } from '../types';
import { loadDemoCasesWithMetrics, type DemoCaseWithMetrics } from '../services/demoDataService';

const getDefaultSolverSettings = (): SolverSettings => ({
  solver_type: "SimulatedAnnealing",
  stop_conditions: {
    max_iterations: 10000,
    time_limit_seconds: 30,
    no_improvement_iterations: 5000,
  },
  solver_params: {
    SimulatedAnnealing: {
      initial_temperature: 1.0,
      final_temperature: 0.01,
      cooling_schedule: "geometric",
      reheat_after_no_improvement: 0,
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
    loadDemoCase,
    demoDropdownOpen,
    setDemoDropdownOpen,
    attributeDefinitions,
    addAttributeDefinition,
    removeAttributeDefinition,
    currentProblemId,
    saveProblem,
    updateCurrentProblem
  } = useAppStore();
  
  const { section } = useParams<{ section: string }>();
  const activeSection = section || 'people';

  const [showAttributesSection, setShowAttributesSection] = useState(false);
  const [peopleViewMode, setPeopleViewMode] = useState<'grid' | 'list'>('grid');
  const [peopleSortBy, setPeopleSortBy] = useState<'name' | 'sessions'>('name');
  const [peopleSortOrder, setPeopleSortOrder] = useState<'asc' | 'desc'>('asc');

  // Auto-expand attributes section when there are no attributes defined
  useEffect(() => {
    if (attributeDefinitions.length === 0 && activeSection === 'people') {
      setShowAttributesSection(true);
    }
  }, [attributeDefinitions.length, activeSection]);
  
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

  // Demo dropdown ref for click outside handling
  const demoDropdownRef = useRef<HTMLDivElement>(null);
  
  // Demo cases with metrics state
  const [demoCasesWithMetrics, setDemoCasesWithMetrics] = useState<DemoCaseWithMetrics[]>([]);
  const [loadingDemoMetrics, setLoadingDemoMetrics] = useState(false);

  // Load demo cases with metrics when dropdown is opened
  useEffect(() => {
    if (demoDropdownOpen && demoCasesWithMetrics.length === 0 && !loadingDemoMetrics) {
      setLoadingDemoMetrics(true);
      loadDemoCasesWithMetrics()
        .then(cases => {
          setDemoCasesWithMetrics(cases);
        })
        .catch(error => {
          console.error('Failed to load demo cases with metrics:', error);
          addNotification({
            type: 'error',
            title: 'Demo Cases Load Failed',
            message: 'Failed to load demo case metrics',
          });
        })
        .finally(() => {
          setLoadingDemoMetrics(false);
        });
    }
  }, [demoDropdownOpen, demoCasesWithMetrics.length, loadingDemoMetrics, addNotification]);

  // Click outside to close demo dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (demoDropdownRef.current && !demoDropdownRef.current.contains(event.target as Node)) {
        setDemoDropdownOpen(false);
      }
    };

    if (demoDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [demoDropdownOpen, setDemoDropdownOpen]);

  // Auto-save functionality
  useEffect(() => {
    if (problem && currentProblemId) {
      // Debounced auto-save will be handled by the storage service
      updateCurrentProblem(currentProblemId, problem);
    }
  }, [problem, currentProblemId, updateCurrentProblem]);

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
    penalty_weight: 1
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
            penalty_weight: constraintForm.penalty_weight || 1
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
          if (!constraintForm.person_id || !constraintForm.group_id) {
            throw new Error('Please fill in all required fields for immovable person');
          }
          // If no sessions selected, apply to all sessions
          const allSessions = Array.from({ length: sessionsCount }, (_, i) => i);
          const immovableSessions = constraintForm.sessions?.length ? constraintForm.sessions : allSessions;
          newConstraint = {
            type: 'ImmovablePerson',
            person_id: constraintForm.person_id,
            group_id: constraintForm.group_id,
            sessions: immovableSessions
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
      setConstraintForm({ type: 'RepeatEncounter', penalty_weight: 1 });
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
    
    // Extract fields based on constraint type
    switch (constraint.type) {
      case 'RepeatEncounter':
        setConstraintForm({
          type: constraint.type,
          max_allowed_encounters: constraint.max_allowed_encounters,
          penalty_function: constraint.penalty_function,
          penalty_weight: constraint.penalty_weight
        });
        break;
      case 'AttributeBalance':
        setConstraintForm({
          type: constraint.type,
          group_id: constraint.group_id,
          attribute_key: constraint.attribute_key,
          desired_values: constraint.desired_values,
          penalty_weight: constraint.penalty_weight
        });
        break;
      case 'ImmovablePerson':
        setConstraintForm({
          type: constraint.type,
          person_id: constraint.person_id,
          group_id: constraint.group_id,
          sessions: constraint.sessions,
          penalty_weight: undefined // ImmovablePerson doesn't have penalty_weight
        });
        break;
      case 'MustStayTogether':
      case 'CannotBeTogether':
        setConstraintForm({
          type: constraint.type,
          people: constraint.people,
          sessions: constraint.sessions,
          penalty_weight: constraint.penalty_weight
        });
        break;
    }
    
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
            penalty_weight: constraintForm.penalty_weight || 1
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
          if (!constraintForm.person_id || !constraintForm.group_id) {
            throw new Error('Please fill in all required fields for immovable person');
          }
          // If no sessions selected, apply to all sessions
          const allUpdateSessions = Array.from({ length: sessionsCount }, (_, i) => i);
          const immovableUpdateSessions = constraintForm.sessions?.length ? constraintForm.sessions : allUpdateSessions;
          updatedConstraint = {
            type: 'ImmovablePerson',
            person_id: constraintForm.person_id,
            group_id: constraintForm.group_id,
            sessions: immovableUpdateSessions
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
      setConstraintForm({ type: 'RepeatEncounter', penalty_weight: 1 });
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

  const sortPeople = (people: Person[]) => {
    return [...people].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (peopleSortBy === 'name') {
        aValue = (a.attributes.name || a.id).toLowerCase();
        bValue = (b.attributes.name || b.id).toLowerCase();
      } else if (peopleSortBy === 'sessions') {
        aValue = a.sessions ? a.sessions.length : sessionsCount;
        bValue = b.sessions ? b.sessions.length : sessionsCount;
      } else {
        return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return peopleSortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return peopleSortOrder === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });
  };

  const handleSortToggle = (sortBy: 'name' | 'sessions') => {
    if (peopleSortBy === sortBy) {
      setPeopleSortOrder(peopleSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPeopleSortBy(sortBy);
      setPeopleSortOrder('asc');
    }
  };

  const renderPersonCard = (person: Person) => {
    const displayName = person.attributes.name || person.id;
    const sessionText = person.sessions 
      ? `Sessions: ${person.sessions.map(s => s + 1).join(', ')}`
      : 'All sessions';

    return (
              <div key={person.id} className="rounded-lg border p-4 hover:shadow-md transition-all" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
              <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{displayName}</h4>
            <div className="space-y-1">
              <p className="text-sm flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
                <Clock className="w-3 h-3" />
                {sessionText}
              </p>
              {Object.entries(person.attributes).map(([key, value]) => {
                if (key === 'name') return null;
                return (
                  <div key={key} className="flex items-center gap-1 text-xs">
                    <Tag className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{key}:</span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleEditPerson(person)}
              className="p-1 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeletePerson(person.id)}
              className="p-1 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error-600)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPeopleGrid = () => {
    if (!problem?.people.length) {
      return (
        <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
          <Users className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <p>No people added yet</p>
          <p className="text-sm">
            {attributeDefinitions.length === 0 
              ? "Consider defining attributes first, then add people to get started"
              : "Add people to get started with your optimization problem"
            }
          </p>
        </div>
      );
    }

    const sortedPeople = sortPeople(problem.people);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedPeople.map(renderPersonCard)}
      </div>
    );
  };

  const renderPeopleList = () => {
    if (!problem?.people.length) {
      return (
        <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
          <Users className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <p>No people added yet</p>
          <p className="text-sm">
            {attributeDefinitions.length === 0 
              ? "Consider defining attributes first, then add people to get started"
              : "Add people to get started with your optimization problem"
            }
          </p>
        </div>
      );
    }

    const sortedPeople = sortPeople(problem.people);
    
    return (
      <div className="rounded-lg border overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
            <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  <button
                    onClick={() => handleSortToggle('name')}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    Name
                    <ArrowUpDown className="w-3 h-3" />
                    {peopleSortBy === 'name' && (
                      <span className="text-xs">{peopleSortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  <button
                    onClick={() => handleSortToggle('sessions')}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    Sessions
                    <ArrowUpDown className="w-3 h-3" />
                    {peopleSortBy === 'sessions' && (
                      <span className="text-xs">{peopleSortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {attributeDefinitions.map(attr => (
                  <th key={attr.key} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {attr.key}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-secondary)' }}>
              {sortedPeople.map(person => {
                const displayName = person.attributes.name || person.id;
                const sessionText = person.sessions 
                  ? `${person.sessions.length}/${sessionsCount} (${person.sessions.map(s => s + 1).join(', ')})`
                  : `All (${sessionsCount})`;
                
                return (
                  <tr 
                    key={person.id} 
                    className="transition-colors hover:bg-tertiary" 
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2" style={{ color: 'var(--text-tertiary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
                        <Clock className="w-3 h-3" />
                        {sessionText}
                      </span>
                    </td>
                    {attributeDefinitions.map(attr => (
                      <td key={attr.key} className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {person.attributes[attr.key] || '-'}
                        </span>
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEditPerson(person)}
                          className="p-1 transition-colors"
                          style={{ color: 'var(--text-tertiary)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePerson(person.id)}
                          className="p-1 transition-colors"
                          style={{ color: 'var(--text-tertiary)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error-600)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderGroupCard = (group: Group) => {
    return (
              <div key={group.id} className="rounded-lg border p-4 hover:shadow-md transition-all" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
              <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{group.id}</h4>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Capacity: {group.size} people per session</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleEditGroup(group)}
              className="p-1 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteGroup(group.id)}
              className="p-1 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error-600)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
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
      <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
                  <div className="rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto modal-content">
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
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Name *
              </label>
              <input
                type="text"
                value={personForm.attributes.name || ''}
                onChange={(e) => setPersonForm(prev => ({
                  ...prev,
                  attributes: { ...prev.attributes, name: e.target.value }
                }))}
                className="input"
                placeholder="Enter person's name"
              />
            </div>

            {/* Attributes */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Attributes
              </label>
              <div className="space-y-2">
                {attributeDefinitions.map(def => (
                  <div key={def.key}>
                    <label className="block text-xs mb-1 capitalize" style={{ color: 'var(--text-tertiary)' }}>
                      {def.key}
                    </label>
                    <select
                      value={personForm.attributes[def.key] || ''}
                      onChange={(e) => setPersonForm(prev => ({
                        ...prev,
                        attributes: { ...prev.attributes, [def.key]: e.target.value }
                      }))}
                      className="select text-sm"
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
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Session Participation
              </label>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
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
                      className="rounded border-gray-300 focus:ring-2"
                      style={{ color: 'var(--color-accent)', accentColor: 'var(--color-accent)' }}
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
              className="flex-1 px-4 py-2 rounded-md font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {isEditing ? 'Update' : 'Add'} Person
            </button>
            <button
              onClick={() => {
                setShowPersonForm(false);
                setEditingPerson(null);
                setPersonForm({ attributes: {}, sessions: [] });
              }}
              className="btn-secondary px-4 py-2 rounded-md"
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
      <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
                  <div className="rounded-lg p-6 w-full max-w-md mx-4 modal-content">
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
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Group ID *
              </label>
              <input
                type="text"
                value={groupForm.id || ''}
                onChange={(e) => setGroupForm(prev => ({ ...prev, id: e.target.value }))}
                className="input"
                placeholder="e.g., team-alpha, group-1"
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Group ID cannot be changed when editing</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Capacity (people per session) *
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={groupForm.size}
                onChange={(e) => setGroupForm(prev => ({ ...prev, size: parseInt(e.target.value) || 1 }))}
                className="input"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                Maximum number of people that can be assigned to this group in any single session
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={isEditing ? handleUpdateGroup : handleAddGroup}
              className="flex-1 px-4 py-2 rounded-md font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {isEditing ? 'Update' : 'Add'} Group
            </button>
            <button
              onClick={() => {
                setShowGroupForm(false);
                setEditingGroup(null);
                setGroupForm({ size: 4 });
              }}
              className="btn-secondary px-4 py-2 rounded-md"
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
      <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
        <div className="rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto modal-content">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isEditing ? 'Edit Constraint' : 'Add Constraint'}
            </h3>
            <button
              onClick={() => {
                setShowConstraintForm(false);
                setEditingConstraint(null);
                setConstraintForm({ type: 'RepeatEncounter', penalty_weight: 1 });
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Constraint Type */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Constraint Type *
              </label>
              <select
                value={constraintForm.type}
                onChange={(e) => setConstraintForm(prev => ({ 
                  type: e.target.value as Constraint['type'],
                  penalty_weight: prev.penalty_weight 
                }))}
                className="select"
                disabled={isEditing}
              >
                <option value="RepeatEncounter">Repeat Encounter Limit</option>
                <option value="AttributeBalance">Attribute Balance</option>
                <option value="MustStayTogether">Must Stay Together</option>
                <option value="CannotBeTogether">Cannot Be Together</option>
                <option value="ImmovablePerson">Immovable Person</option>
              </select>
              {isEditing && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Constraint type cannot be changed when editing</p>
              )}
            </div>

            {/* Constraint-specific fields */}
            {constraintForm.type === 'RepeatEncounter' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
                    className="input"
                    placeholder="e.g., 1"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    Maximum number of times any two people can be in the same group across all sessions
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Penalty Function
                  </label>
                  <select
                    value={constraintForm.penalty_function || 'squared'}
                    onChange={(e) => setConstraintForm(prev => ({ 
                      ...prev, 
                      penalty_function: e.target.value as 'linear' | 'squared' 
                    }))}
                    className="select"
                  >
                    <option value="linear">Linear</option>
                    <option value="squared">Squared (recommended)</option>
                  </select>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    Squared penalties increase more rapidly for multiple violations
                  </p>
                </div>
              </>
            )}

            {constraintForm.type === 'AttributeBalance' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Target Group *
                  </label>
                  <select
                    value={constraintForm.group_id || ''}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, group_id: e.target.value }))}
                    className="select"
                  >
                    <option value="">Select a group</option>
                    {problem?.groups.map(group => (
                      <option key={group.id} value={group.id}>{group.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Attribute to Balance *
                  </label>
                  <select
                    value={constraintForm.attribute_key || ''}
                    onChange={(e) => setConstraintForm(prev => ({ 
                      ...prev, 
                      attribute_key: e.target.value,
                      desired_values: {} // Reset when attribute changes
                    }))}
                    className="select"
                  >
                    <option value="">Select an attribute</option>
                    {attributeDefinitions.map(def => (
                      <option key={def.key} value={def.key}>{def.key}</option>
                    ))}
                  </select>
                </div>

                {constraintForm.attribute_key && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Desired Distribution *
                    </label>
                    <div className="space-y-2">
                      {attributeDefinitions
                        .find(def => def.key === constraintForm.attribute_key)
                        ?.values.map(value => (
                          <div key={value} className="flex items-center gap-2">
                            <span className="w-20 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{value}:</span>
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
                              className="input flex-1"
                              placeholder="0"
                            />
                          </div>
                        ))}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Desired number of people with each attribute value in this group
                    </p>
                  </div>
                )}
              </>
            )}

            {constraintForm.type === 'ImmovablePerson' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Person *
                  </label>
                  <select
                    value={constraintForm.person_id || ''}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, person_id: e.target.value }))}
                    className="select"
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
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Fixed Group *
                  </label>
                  <select
                    value={constraintForm.group_id || ''}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, group_id: e.target.value }))}
                    className="select"
                  >
                    <option value="">Select a group</option>
                    {problem?.groups.map(group => (
                      <option key={group.id} value={group.id}>{group.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
                          className="rounded border-gray-300 focus:ring-2"
                          style={{ color: 'var(--color-accent)', accentColor: 'var(--color-accent)' }}
                        />
                        Session {sessionIdx + 1}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    Leave empty to apply to all sessions
                  </p>
                </div>
              </>
            )}

            {(constraintForm.type === 'MustStayTogether' || constraintForm.type === 'CannotBeTogether') && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    People * (select at least 2)
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2" style={{ borderColor: 'var(--border-secondary)' }}>
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
                          className="rounded border-gray-300 focus:ring-2"
                          style={{ color: 'var(--color-accent)', accentColor: 'var(--color-accent)' }}
                        />
                        {person.attributes.name || person.id}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
                          className="rounded border-gray-300 focus:ring-2"
                          style={{ color: 'var(--color-accent)', accentColor: 'var(--color-accent)' }}
                        />
                        Session {sessionIdx + 1}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    Leave empty to apply to all sessions
                  </p>
                </div>
              </>
            )}

            {/* Penalty Weight - only for constraints that use it */}
            {constraintForm.type !== 'ImmovablePerson' && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Penalty Weight
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={constraintForm.penalty_weight || ''}
                  onChange={(e) => setConstraintForm(prev => ({ 
                    ...prev, 
                    penalty_weight: parseFloat(e.target.value) || 1 
                  }))}
                  className="input"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  Higher values make this constraint more important (1-10000). 
                  Use 1000+ for hard constraints, 10-100 for preferences.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={isEditing ? handleUpdateConstraint : handleAddConstraint}
              className="flex-1 px-4 py-2 rounded-md font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {isEditing ? 'Update' : 'Add'} Constraint
            </button>
            <button
              onClick={() => {
                setShowConstraintForm(false);
                setEditingConstraint(null);
                setConstraintForm({ type: 'RepeatEncounter', penalty_weight: 1 });
              }}
              className="btn-secondary px-4 py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Bulk add dropdown & modal states
  const bulkDropdownRef = useRef<HTMLDivElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkDropdownOpen, setBulkDropdownOpen] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkTextMode, setBulkTextMode] = useState<'text' | 'grid'>('text');
  const [bulkCsvInput, setBulkCsvInput] = useState('');
  const [bulkHeaders, setBulkHeaders] = useState<string[]>([]);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);

  // Close bulk dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bulkDropdownRef.current && !bulkDropdownRef.current.contains(event.target as Node)) {
        setBulkDropdownOpen(false);
      }
    };
    if (bulkDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [bulkDropdownOpen]);

  const openBulkFormFromCsv = (csvText: string) => {
    setBulkCsvInput(csvText);
    const { headers, rows } = parseCsv(csvText);
    setBulkHeaders(headers);
    setBulkRows(rows);
    setBulkTextMode('text');
    setShowBulkForm(true);
  };

  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      openBulkFormFromCsv(text);
    };
    reader.readAsText(file);
    // reset value so same file can be selected again
    e.target.value = '';
  };

  const handleAddBulkPeople = () => {
    if (!bulkHeaders.includes('name')) {
      addNotification({ type: 'error', title: 'Missing Column', message: 'CSV must include a "name" column.' });
      return;
    }

    const newPeople: Person[] = bulkRows.map((row, idx) => {
      const personAttrs: Record<string, string> = {};
      bulkHeaders.forEach(h => {
        if (row[h]) personAttrs[h] = row[h];
      });
      if (!personAttrs.name) personAttrs.name = `Person ${Date.now()}_${idx}`;
      return {
        id: `person_${Date.now()}_${idx}`,
        attributes: personAttrs,
        sessions: undefined,
      };
    });

    // Collect new attribute definitions
    const attrValueMap: Record<string, Set<string>> = {};
    bulkHeaders.forEach(h => {
      if (h === 'name') return;
      attrValueMap[h] = new Set();
    });
    newPeople.forEach(p => {
      Object.entries(p.attributes).forEach(([k, v]) => {
        if (k !== 'name') attrValueMap[k]?.add(v);
      });
    });
    Object.entries(attrValueMap).forEach(([key, valSet]) => {
      if (!attributeDefinitions.find(def => def.key === key)) {
        addAttributeDefinition({ key, values: Array.from(valSet) });
      }
    });

    const updatedProblem: Problem = {
      people: [...(problem?.people || []), ...newPeople],
      groups: problem?.groups || [],
      num_sessions: problem?.num_sessions || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };
    setProblem(updatedProblem);
    setShowBulkForm(false);
    setBulkCsvInput('');
    setBulkHeaders([]);
    setBulkRows([]);

    addNotification({ type: 'success', title: 'People Added', message: `${newPeople.length} people added.` });
  };

  const renderBulkAddForm = () => {
    return (
      <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
        <div className="rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto modal-content">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Bulk Add People</h3>
            <button
              onClick={() => setShowBulkForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                if (bulkTextMode === 'grid') {
                  setBulkCsvInput(rowsToCsv(bulkHeaders, bulkRows));
                }
                setBulkTextMode('text');
              }}
              className={`px-3 py-1 rounded text-sm ${bulkTextMode === 'text' ? 'font-bold' : ''}`}
              style={{ color: 'var(--text-primary)', backgroundColor: bulkTextMode === 'text' ? 'var(--bg-tertiary)' : 'transparent' }}
            >
              CSV Text
            </button>
            <button
              onClick={() => {
                if (bulkTextMode === 'text') {
                  const { headers, rows } = parseCsv(bulkCsvInput);
                  setBulkHeaders(headers);
                  setBulkRows(rows);
                }
                setBulkTextMode('grid');
              }}
              className={`px-3 py-1 rounded text-sm ${bulkTextMode === 'grid' ? 'font-bold' : ''}`}
              style={{ color: 'var(--text-primary)', backgroundColor: bulkTextMode === 'grid' ? 'var(--bg-tertiary)' : 'transparent' }}
            >
              Data Grid
            </button>
          </div>

          {bulkTextMode === 'text' ? (
            <textarea
              value={bulkCsvInput}
              onChange={(e) => setBulkCsvInput(e.target.value)}
              className="w-full h-64 p-2 border rounded"
              placeholder="Paste CSV here. First row should contain column headers (e.g., name, attribute1, attribute2)"
            ></textarea>
          ) : (
            <div className="overflow-x-auto max-h-64 mb-4">
              {bulkHeaders.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No data parsed yet.</p>
              ) : (
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                  <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <tr>
                      {bulkHeaders.map(h => (
                        <th key={h} className="px-2 py-1 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-secondary)' }}>
                    {bulkRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {bulkHeaders.map(h => (
                          <td key={h} className="px-2 py-1">
                            <input
                              type="text"
                              value={row[h] || ''}
                              onChange={(e) => {
                                const newRows = [...bulkRows];
                                newRows[rowIdx][h] = e.target.value;
                                setBulkRows(newRows);
                              }}
                              className="w-full text-sm border rounded p-1"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {bulkTextMode === 'text' && (
              <button
                onClick={() => {
                  const { headers, rows } = parseCsv(bulkCsvInput);
                  setBulkHeaders(headers);
                  setBulkRows(rows);
                  setBulkTextMode('grid');
                }}
                className="btn-secondary"
              >
                Preview Grid
              </button>
            )}
            <button
              onClick={handleAddBulkPeople}
              className="flex-1 px-4 py-2 rounded-md font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Add People
            </button>
          </div>
        </div>
      </div>
    );
  };

  const groupBulkDropdownRef = useRef<HTMLDivElement>(null);
  const groupCsvFileInputRef = useRef<HTMLInputElement>(null);
  const [groupBulkDropdownOpen, setGroupBulkDropdownOpen] = useState(false);
  const [showGroupBulkForm, setShowGroupBulkForm] = useState(false);
  const [groupBulkTextMode, setGroupBulkTextMode] = useState<'text' | 'grid'>('text');
  const [groupBulkCsvInput, setGroupBulkCsvInput] = useState('');
  const [groupBulkHeaders, setGroupBulkHeaders] = useState<string[]>([]);
  const [groupBulkRows, setGroupBulkRows] = useState<Record<string, string>[]>([]);
  const [groupGenCount, setGroupGenCount] = useState(3);
  const [groupGenSize, setGroupGenSize] = useState(4);

  // Close group bulk dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupBulkDropdownRef.current && !groupBulkDropdownRef.current.contains(event.target as Node)) {
        setGroupBulkDropdownOpen(false);
      }
    };
    if (groupBulkDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [groupBulkDropdownOpen]);

  const openGroupBulkFormFromCsv = (csvText: string) => {
    setGroupBulkCsvInput(csvText);
    const { headers, rows } = parseCsv(csvText);
    setGroupBulkHeaders(headers);
    setGroupBulkRows(rows);
    setGroupBulkTextMode('text');
    setShowGroupBulkForm(true);
  };

  const handleGroupCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      openGroupBulkFormFromCsv(text);
    };
    reader.readAsText(file);
    // reset value so same file can be selected again
    e.target.value = '';
  };

  const handleAddGroupBulkPeople = () => {
    if (!groupBulkHeaders.includes('id')) {
      addNotification({ type: 'error', title: 'Missing Column', message: 'CSV must include an "id" column.' });
      return;
    }

    const newGroups: Group[] = groupBulkRows.map((row, idx) => {
      const id = row['id'] ?? `Group_${Date.now()}_${idx}`;
      const size = parseInt(row['size'] ?? '') || 4;
      return { id, size };
    });

    // Collect new attribute definitions
    const attrValueMap: Record<string, Set<string>> = {};
    groupBulkHeaders.forEach(h => {
      if (h === 'id') return;
      attrValueMap[h] = new Set();
    });
    newGroups.forEach(g => {
      Object.entries(g).forEach(([k, v]) => {
        if (k !== 'id') attrValueMap[k]?.add(v);
      });
    });
    Object.entries(attrValueMap).forEach(([key, valSet]) => {
      if (!attributeDefinitions.find(def => def.key === key)) {
        addAttributeDefinition({ key, values: Array.from(valSet) });
      }
    });

    const updatedProblem: Problem = {
      people: problem?.people || [],
      groups: [...(problem?.groups || []), ...newGroups],
      num_sessions: problem?.num_sessions || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || getDefaultSolverSettings()
    };
    setProblem(updatedProblem);
    setShowGroupBulkForm(false);
    setGroupBulkCsvInput('');
    setGroupBulkHeaders([]);
    setGroupBulkRows([]);

    addNotification({ type: 'success', title: 'Groups Added', message: `${newGroups.length} groups added.` });
  };

  const renderGroupBulkAddForm = () => {
    return (
      <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
        <div className="rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto modal-content">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Bulk Add Groups</h3>
            <button
              onClick={() => setShowGroupBulkForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                if (groupBulkTextMode === 'grid') {
                  setGroupBulkCsvInput(rowsToCsv(groupBulkHeaders, groupBulkRows));
                }
                setGroupBulkTextMode('text');
              }}
              className={`px-3 py-1 rounded text-sm ${groupBulkTextMode === 'text' ? 'font-bold' : ''}`}
              style={{ color: 'var(--text-primary)', backgroundColor: groupBulkTextMode === 'text' ? 'var(--bg-tertiary)' : 'transparent' }}
            >
              CSV Text
            </button>
            <button
              onClick={() => {
                if (groupBulkTextMode === 'text') {
                  const { headers, rows } = parseCsv(groupBulkCsvInput);
                  setGroupBulkHeaders(headers);
                  setGroupBulkRows(rows);
                }
                setGroupBulkTextMode('grid');
              }}
              className={`px-3 py-1 rounded text-sm ${groupBulkTextMode === 'grid' ? 'font-bold' : ''}`}
              style={{ color: 'var(--text-primary)', backgroundColor: groupBulkTextMode === 'grid' ? 'var(--bg-tertiary)' : 'transparent' }}
            >
              Data Grid
            </button>
          </div>

          {groupBulkTextMode === 'text' ? (
            <textarea
              value={groupBulkCsvInput}
              onChange={(e) => setGroupBulkCsvInput(e.target.value)}
              className="w-full h-64 p-2 border rounded"
              placeholder="Paste CSV here. First row should contain column headers (e.g., id, size)"
            ></textarea>
          ) : (
            <div className="overflow-x-auto max-h-64 mb-4">
              {groupBulkHeaders.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No data parsed yet.</p>
              ) : (
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                  <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <tr>
                      {groupBulkHeaders.map(h => (
                        <th key={h} className="px-2 py-1 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-secondary)' }}>
                    {groupBulkRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {groupBulkHeaders.map(h => (
                          <td key={h} className="px-2 py-1">
                            <input
                              type="text"
                              value={row[h] || ''}
                              onChange={(e) => {
                                const newRows = [...groupBulkRows];
                                newRows[rowIdx][h] = e.target.value;
                                setGroupBulkRows(newRows);
                              }}
                              className="w-full text-sm border rounded p-1"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {groupBulkTextMode === 'text' && (
              <button
                onClick={() => {
                  const { headers, rows } = parseCsv(groupBulkCsvInput);
                  setGroupBulkHeaders(headers);
                  setGroupBulkRows(rows);
                  setGroupBulkTextMode('grid');
                }}
                className="btn-secondary"
              >
                Preview Grid
              </button>
            )}
            <button
              onClick={handleAddGroupBulkPeople}
              className="flex-1 px-4 py-2 rounded-md font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Add Groups
            </button>
          </div>
        </div>
      </div>
    );
  };

  // === Shared CSV helpers ===
  const parseCsv = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cells = line.split(',');
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (cells[idx] || '').trim();
      });
      return row;
    });
    return { headers, rows };
  };

  const rowsToCsv = (headers: string[], rows: Record<string, string>[]) => {
    const headerLine = headers.join(',');
    const dataLines = rows.map(r => headers.map(h => r[h] ?? '').join(','));
    return [headerLine, ...dataLines].join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Problem Setup</h2>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Configure people, groups, and constraints for optimization
          </p>
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
          <div className="relative" ref={demoDropdownRef}>
            <button
              onClick={() => setDemoDropdownOpen(!demoDropdownOpen)}
              className="btn-secondary flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Demo Data
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {demoDropdownOpen && (
              <div className="absolute right-0 mt-1 w-80 rounded-md shadow-lg z-10 border overflow-hidden max-h-96 overflow-y-auto" 
                   style={{ 
                     backgroundColor: 'var(--bg-primary)', 
                     borderColor: 'var(--border-primary)' 
                   }}>
                {loadingDemoMetrics ? (
                  <div className="p-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
                    <span className="ml-2 text-sm">Loading demo cases...</span>
                  </div>
                ) : (
                  <>
                    {/* Category groups */}
                    {(['Simple', 'Intermediate', 'Advanced', 'Benchmark'] as const).map(category => {
                      const casesInCategory = demoCasesWithMetrics.filter(c => c.category === category);
                      if (casesInCategory.length === 0) return null;
                      
                      return (
                        <div key={category}>
                          <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b"
                               style={{ 
                                 backgroundColor: 'var(--bg-tertiary)', 
                                 borderColor: 'var(--border-primary)',
                                 color: 'var(--text-tertiary)'
                               }}>
                            {category}
                          </div>
                          {casesInCategory.map(demoCase => (
                            <button
                              key={demoCase.id}
                              onClick={() => loadDemoCase(demoCase.id)}
                              className="flex flex-col w-full px-3 py-3 text-left transition-colors border-b last:border-b-0"
                              style={{ 
                                color: 'var(--text-primary)',
                                backgroundColor: 'transparent',
                                borderColor: 'var(--border-primary)'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{demoCase.name}</span>
                                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                  <Users className="w-3 h-3" />
                                  <span>{demoCase.peopleCount}</span>
                                  <Hash className="w-3 h-3 ml-1" />
                                  <span>{demoCase.groupCount}</span>
                                  <Calendar className="w-3 h-3 ml-1" />
                                  <span>{demoCase.sessionCount}</span>
                                </div>
                              </div>
                              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                {demoCase.description}
                              </p>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <nav className="flex space-x-8">
          {[
            { id: 'people', label: 'People', icon: Users, count: problem?.people.length },
            { id: 'groups', label: 'Groups', icon: Hash, count: problem?.groups.length },
            { id: 'sessions', label: 'Sessions', icon: Calendar, count: problem?.num_sessions },
            { id: 'constraints', label: 'Constraints', icon: Settings, count: problem?.constraints.length },
          ].map(({ id, label, icon: Icon, count }) => (
              <NavLink
              key={id}
              to={`/app/problem/${id}`}
              className="flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors"
              style={({ isActive }) => ({
                borderBottomColor: isActive ? 'var(--color-accent)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--text-secondary)'
              })}
            >
              <Icon className="w-4 h-4" />
              {label}
              {typeof count === 'number' && (
                <span style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} className="px-2 py-0.5 rounded-full text-xs">
                  {count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Content */}
        {activeSection === 'people' && (
          <div className="space-y-4">
            {/* Attributes Section Header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowAttributesSection(!showAttributesSection)}
                className="flex items-center gap-3 text-left transition-colors"
              >
                {showAttributesSection ? (
                  <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                ) : (
                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                )}
                <Tag className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                <h3 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                  Attribute Definitions ({attributeDefinitions.length})
                </h3>
              </button>
              <button
                onClick={() => setShowAttributeForm(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-white text-sm transition-colors"
                style={{ backgroundColor: 'var(--color-accent)' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <Plus className="w-3 h-3" />
                Add Attribute
              </button>
            </div>

            {/* Collapsible Attributes Section */}
            {showAttributesSection && (
              <div className="rounded-lg border transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                <div className="p-4 space-y-3">
                  <div className="rounded-md p-3 border text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Attributes are key-value pairs that describe people (e.g., gender, department, seniority).
                      Define them here before adding people to use them in constraints like attribute balance.
                    </p>
                  </div>

                  {attributeDefinitions.length ? (
                    <div className="space-y-2">
                      {attributeDefinitions.map(def => (
                        <div key={def.key} className="rounded-lg border p-3 transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium capitalize text-sm" style={{ color: 'var(--text-primary)' }}>{def.key}</h4>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {def.values.map(value => (
                                  <span key={value} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} className="px-2 py-0.5 rounded-full text-xs font-medium">
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
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => removeAttributeDefinition(def.key)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
                      <Tag className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm">No attributes defined yet</p>
                      <p className="text-xs">Click "Add Attribute" to get started</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* People Section */}
            <div className="rounded-lg border transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
              <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                    People ({problem?.people.length || 0})
                  </h3>
                  <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPeopleViewMode('grid')}
                        className="px-3 py-1 rounded text-sm transition-colors"
                        style={{
                          backgroundColor: peopleViewMode === 'grid' ? 'var(--bg-tertiary)' : 'transparent',
                          color: peopleViewMode === 'grid' ? 'var(--color-accent)' : 'var(--text-secondary)',
                          border: peopleViewMode === 'grid' ? '1px solid var(--color-accent)' : '1px solid transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (peopleViewMode !== 'grid') {
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (peopleViewMode !== 'grid') {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                      >
                        <Hash className="w-4 h-4 inline mr-1" />
                        Grid
                      </button>
                      <button
                        onClick={() => setPeopleViewMode('list')}
                        className="px-3 py-1 rounded text-sm transition-colors"
                        style={{
                          backgroundColor: peopleViewMode === 'list' ? 'var(--bg-tertiary)' : 'transparent',
                          color: peopleViewMode === 'list' ? 'var(--color-accent)' : 'var(--text-secondary)',
                          border: peopleViewMode === 'list' ? '1px solid var(--color-accent)' : '1px solid transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (peopleViewMode !== 'list') {
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (peopleViewMode !== 'list') {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                      >
                        <BarChart3 className="w-4 h-4 inline mr-1" />
                        List
                      </button>
                    </div>
                    {/* Add Person Button Replacement */}
                    <div className="flex items-center gap-2">
                      {/* Bulk Add Dropdown */}
                      <div className="relative" ref={bulkDropdownRef}>
                        <button
                          onClick={() => setBulkDropdownOpen(!bulkDropdownOpen)}
                          className="btn-secondary flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Bulk Add
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {bulkDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-56 rounded-md shadow-lg z-10 border overflow-hidden"
                               style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                            <button
                              onClick={() => {
                                setBulkDropdownOpen(false);
                                csvFileInputRef.current?.click();
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-b last:border-b-0"
                              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Upload className="w-4 h-4" />
                              Upload CSV
                            </button>
                            <button
                              onClick={() => {
                                setBulkDropdownOpen(false);
                                addNotification({ type: 'info', title: 'Coming Soon', message: 'Excel import is not yet implemented.' });
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-b last:border-b-0"
                              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Upload className="w-4 h-4" />
                              Upload Excel
                            </button>
                            <button
                              onClick={() => {
                                setBulkDropdownOpen(false);
                                setBulkCsvInput('');
                                setBulkHeaders([]);
                                setBulkRows([]);
                                setBulkTextMode('text');
                                setShowBulkForm(true);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                              style={{ color: 'var(--text-primary)' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Table className="w-4 h-4" />
                              Open Bulk Form
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Add Person Button */}
                      <button
                        onClick={() => setShowPersonForm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-white transition-colors"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <Plus className="w-4 h-4" />
                        Add Person
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {peopleViewMode === 'grid' ? renderPeopleGrid() : renderPeopleList()}
              </div>
            </div>
        </div>
      )}

      {activeSection === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Groups ({problem?.groups.length || 0})</h3>
            <div className="flex items-center gap-2">
              {/* Bulk Add Groups Dropdown */}
              <div className="relative" ref={groupBulkDropdownRef}>
                <button
                  onClick={() => setGroupBulkDropdownOpen(!groupBulkDropdownOpen)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Bulk Add
                  <ChevronDown className="w-3 h-3" />
                </button>
                {groupBulkDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-56 rounded-md shadow-lg z-10 border overflow-hidden"
                       style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                    <button
                      onClick={() => {
                        setGroupBulkDropdownOpen(false);
                        groupCsvFileInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-b last:border-b-0"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Upload className="w-4 h-4" />
                      Upload CSV
                    </button>
                    <button
                      onClick={() => {
                        setGroupBulkDropdownOpen(false);
                        setGroupBulkCsvInput('');
                        setGroupBulkHeaders([]);
                        setGroupBulkRows([]);
                        setGroupBulkTextMode('text');
                        setShowGroupBulkForm(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Table className="w-4 h-4" />
                      Open Bulk Form
                    </button>
                  </div>
                )}
              </div>
              {/* Add Group Button */}
              <button
                onClick={() => setShowGroupForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--color-accent)' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Plus className="w-4 h-4" />
                Add Group
              </button>
            </div>
          </div>

          {problem?.groups.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {problem.groups.map(renderGroupCard)}
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
              <Hash className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
              <p>No groups added yet</p>
              <p className="text-sm">Add groups where people will be assigned</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'sessions' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Sessions Configuration</h3>
          
          <div className="rounded-lg border p-6 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Number of Sessions
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sessionsCount}
                  onChange={(e) => handleSessionsCountChange(parseInt(e.target.value) || 1)}
                  className="input w-32"
                />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  The algorithm will distribute people into groups across {sessionsCount} sessions. Each person can be assigned to one group per session.
                </p>
              </div>
              
              <div className="rounded-md p-4 border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
                <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>How Sessions Work</h4>
                <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
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

      {activeSection === 'constraints' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Constraints ({problem?.constraints.length || 0})</h3>
            <button
              onClick={() => setShowConstraintForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Plus className="w-4 h-4" />
              Add Constraint
            </button>
          </div>
          
          <div className="rounded-md p-4 border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>About Constraints</h4>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Constraints guide the optimization process by defining rules and preferences:
            </p>
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>• <strong>RepeatEncounter:</strong> Limit how often people meet across sessions</li>
              <li>• <strong>AttributeBalance:</strong> Maintain desired distributions (e.g., gender balance)</li>
              <li>• <strong>MustStayTogether:</strong> Keep certain people in the same group</li>
              <li>• <strong>CannotBeTogether:</strong> Prevent certain people from being grouped</li>
              <li>• <strong>ImmovablePerson:</strong> Fix someone to a specific group in specific sessions</li>
            </ul>
          </div>

          {problem?.constraints.length ? (
            <div className="space-y-6">
              {/* Group constraints by type */}
              {(() => {
                const constraintsByType = problem.constraints.reduce((acc, constraint, index) => {
                  if (!acc[constraint.type]) {
                    acc[constraint.type] = [];
                  }
                  acc[constraint.type].push({ constraint, index });
                  return acc;
                }, {} as Record<string, { constraint: Constraint; index: number }[]>);

                const constraintTypeLabels = {
                  'RepeatEncounter': 'Repeat Encounter Limits',
                  'AttributeBalance': 'Attribute Balance',
                  'ImmovablePerson': 'Immovable People',
                  'MustStayTogether': 'Must Stay Together',
                  'CannotBeTogether': 'Cannot Be Together'
                };

                return Object.entries(constraintsByType).map(([type, items]) => (
                  <div key={type} className="space-y-3">
                    <h4 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}></div>
                      {constraintTypeLabels[type as keyof typeof constraintTypeLabels] || type}
                      <span className="text-sm font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {items.length}
                      </span>
                    </h4>
                    
                    <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                      {items.map(({ constraint, index }) => (
                        <div key={index} className="rounded-lg border p-4 transition-colors hover:shadow-md" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                  {constraint.type}
                                </span>
                                {constraint.type !== 'ImmovablePerson' && (
                                  <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}>
                                    Weight: {(constraint as any).penalty_weight}
                                  </span>
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
                                    <div className="break-words">Distribution: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{Object.entries(constraint.desired_values || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}</span></div>
                                  </>
                                )}
                                
                                {constraint.type === 'ImmovablePerson' && (
                                  <>
                                    <div>Person: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.person_id}</span></div>
                                    <div>Fixed to: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.group_id}</span></div>
                                    <div>Sessions: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.sessions.map(s => s + 1).join(', ')}</span></div>
                                  </>
                                )}
                                
                                {(constraint.type === 'MustStayTogether' || constraint.type === 'CannotBeTogether') && (
                                  <>
                                    <div className="break-words">People: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.people.join(', ')}</span></div>
                                    {constraint.sessions && constraint.sessions.length > 0 ? (
                                      <div>Sessions: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{constraint.sessions.map(s => s + 1).join(', ')}</span></div>
                                    ) : (
                                      <div>Sessions: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>All sessions</span></div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handleEditConstraint(constraint, index)}
                                className="p-1.5 rounded transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'var(--color-accent)';
                                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--text-tertiary)';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteConstraint(index)}
                                className="p-1.5 rounded transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'var(--color-error-600)';
                                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--text-tertiary)';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
              <Settings className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
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
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
          <div className="rounded-lg p-6 w-full max-w-md mx-4 modal-content">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingAttribute ? 'Edit Attribute Definition' : 'Add Attribute Definition'}
                </h3>
              <button
                onClick={() => {
                  setShowAttributeForm(false);
                  setNewAttribute({ key: '', values: [''] });
                  setEditingAttribute(null);
                }}
                className="transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Attribute Name *
                </label>
                <input
                  type="text"
                  value={newAttribute.key}
                  onChange={(e) => setNewAttribute(prev => ({ ...prev, key: e.target.value }))}
                  className="input"
                  placeholder="e.g., department, experience, location"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
                        className="input flex-1"
                        placeholder={`Value ${index + 1}`}
                      />
                      {newAttribute.values.length > 1 && (
                        <button
                          onClick={() => {
                            const newValues = newAttribute.values.filter((_, i) => i !== index);
                            setNewAttribute(prev => ({ ...prev, values: newValues }));
                          }}
                          className="px-3 py-2 rounded-md transition-colors"
                          style={{ 
                            backgroundColor: 'var(--color-error-100)', 
                            color: 'var(--color-error-700)' 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-error-200)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-error-100)'}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNewAttribute(prev => ({ ...prev, values: [...prev.values, ''] }))}
                  className="btn-secondary text-sm mt-2"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Value
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={editingAttribute ? handleUpdateAttribute : handleAddAttribute}
                className="flex-1 px-4 py-2 rounded-md font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--color-accent)' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {editingAttribute ? 'Update Attribute' : 'Add Attribute'}
              </button>
              <button
                onClick={() => {
                  setShowAttributeForm(false);
                  setNewAttribute({ key: '', values: [''] });
                  setEditingAttribute(null);
                }}
                className="btn-secondary px-4 py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showBulkForm && renderBulkAddForm()}
      {showGroupBulkForm && renderGroupBulkAddForm()}

      <input type="file" accept=".csv,text/csv" ref={csvFileInputRef} className="hidden" onChange={handleCsvFileSelected} />
      <input type="file" accept=".csv,text/csv" ref={groupCsvFileInputRef} className="hidden" onChange={handleGroupCsvFileSelected} />
    </div>
  );
} 