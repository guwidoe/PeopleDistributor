import { useState } from 'react';
import { useAppStore } from '../store';
import { Users, Calendar, Settings, Plus, Save, Upload, Trash2, Edit, X, Check, Zap, Hash } from 'lucide-react';
import type { Person, Group, Constraint, Problem } from '../types';

export function ProblemEditor() {
  const { problem, setProblem, addNotification, generateDemoData } = useAppStore();
  const [activeSection, setActiveSection] = useState<'people' | 'groups' | 'sessions' | 'constraints'>('people');
  
  // Form states
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Form data
  const [personForm, setPersonForm] = useState({
    name: '',
    gender: '' as 'male' | 'female' | '',
    groups: [] as number[]
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    max_people: 10,
    min_people: 1
  });

  const [sessionsCount, setSessionsCount] = useState(problem?.sessions_count || 3);

  const handleSaveProblem = () => {
    if (!problem) {
      addNotification({
        type: 'error',
        title: 'No Problem',
        message: 'Please configure a problem first',
      });
      return;
    }

    // Save to localStorage for now
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
        setSessionsCount(parsed.sessions_count || 3);
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
      sessions_count: count,
      constraints: problem?.constraints || [],
      settings: problem?.settings || {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 100
      }
    };

    setProblem(updatedProblem);
  };

  const handleAddPerson = () => {
    if (!personForm.name.trim()) {
      addNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter a name for the person',
      });
      return;
    }

    const newPerson: Person = {
      id: `person_${Date.now()}`,
      name: personForm.name,
      gender: personForm.gender || undefined,
      groups: personForm.groups.length > 0 ? personForm.groups : undefined
    };

    const updatedProblem: Problem = {
      people: [...(problem?.people || []), newPerson],
      groups: problem?.groups || [],
      sessions_count: problem?.sessions_count || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 100
      }
    };

    setProblem(updatedProblem);
    setPersonForm({ name: '', gender: '', groups: [] });
    setShowPersonForm(false);
    
    addNotification({
      type: 'success',
      title: 'Person Added',
      message: `${newPerson.name} has been added to the problem`,
    });
  };

  const handleEditPerson = (person: Person) => {
    setEditingPerson(person);
    setPersonForm({
      name: person.name,
      gender: person.gender || '',
      groups: person.groups || []
    });
    setShowPersonForm(true);
  };

  const handleUpdatePerson = () => {
    if (!editingPerson || !personForm.name.trim()) return;

    const updatedPerson: Person = {
      ...editingPerson,
      name: personForm.name,
      gender: personForm.gender || undefined,
      groups: personForm.groups.length > 0 ? personForm.groups : undefined
    };

    const updatedProblem: Problem = {
      people: problem?.people.map(p => p.id === editingPerson.id ? updatedPerson : p) || [],
      groups: problem?.groups || [],
      sessions_count: problem?.sessions_count || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 100
      }
    };

    setProblem(updatedProblem);
    setEditingPerson(null);
    setPersonForm({ name: '', gender: '', groups: [] });
    setShowPersonForm(false);
    
    addNotification({
      type: 'success',
      title: 'Person Updated',
      message: `${updatedPerson.name} has been updated`,
    });
  };

  const handleDeletePerson = (personId: string) => {
    const updatedProblem: Problem = {
      people: problem?.people.filter(p => p.id !== personId) || [],
      groups: problem?.groups || [],
      sessions_count: problem?.sessions_count || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 100
      }
    };

    setProblem(updatedProblem);
    
    addNotification({
      type: 'success',
      title: 'Person Removed',
      message: 'Person has been removed from the problem',
    });
  };

  const handleAddGroup = () => {
    if (!groupForm.name.trim()) {
      addNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter a name for the group',
      });
      return;
    }

    const newGroup: Group = {
      id: Date.now(),
      name: groupForm.name,
      max_people: groupForm.max_people,
      min_people: groupForm.min_people
    };

    const updatedProblem: Problem = {
      people: problem?.people || [],
      groups: [...(problem?.groups || []), newGroup],
      sessions_count: problem?.sessions_count || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 100
      }
    };

    setProblem(updatedProblem);
    setGroupForm({ name: '', max_people: 10, min_people: 1 });
    setShowGroupForm(false);
    
    addNotification({
      type: 'success',
      title: 'Group Added',
      message: `${newGroup.name} has been added to the problem`,
    });
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      max_people: group.max_people,
      min_people: group.min_people
    });
    setShowGroupForm(true);
  };

  const handleUpdateGroup = () => {
    if (!editingGroup || !groupForm.name.trim()) return;

    const updatedGroup: Group = {
      ...editingGroup,
      name: groupForm.name,
      max_people: groupForm.max_people,
      min_people: groupForm.min_people
    };

    const updatedProblem: Problem = {
      people: problem?.people || [],
      groups: problem?.groups.map(g => g.id === editingGroup.id ? updatedGroup : g) || [],
      sessions_count: problem?.sessions_count || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 100
      }
    };

    setProblem(updatedProblem);
    setEditingGroup(null);
    setGroupForm({ name: '', max_people: 10, min_people: 1 });
    setShowGroupForm(false);
    
    addNotification({
      type: 'success',
      title: 'Group Updated',
      message: `${updatedGroup.name} has been updated`,
    });
  };

  const handleDeleteGroup = (groupId: number) => {
    const updatedProblem: Problem = {
      people: problem?.people || [],
      groups: problem?.groups.filter(g => g.id !== groupId) || [],
      sessions_count: problem?.sessions_count || 3,
      constraints: problem?.constraints || [],
      settings: problem?.settings || {
        max_iterations: 10000,
        time_limit_seconds: 30,
        temperature: 1.0,
        cooling_rate: 0.99,
        repetition_penalty: 100
      }
    };

    setProblem(updatedProblem);
    
    addNotification({
      type: 'success',
      title: 'Group Removed',
      message: 'Group has been removed from the problem',
    });
  };

  const sections = [
    {
      id: 'people' as const,
      label: 'People',
      icon: Users,
      description: 'Add and configure people',
    },
    {
      id: 'groups' as const,
      label: 'Groups',
      icon: Hash,
      description: 'Define groups and capacity',
    },
    {
      id: 'sessions' as const,
      label: 'Sessions',
      icon: Calendar,
      description: 'Define sessions and capacity',
    },
    {
      id: 'constraints' as const,
      label: 'Constraints',
      icon: Settings,
      description: 'Set optimization constraints',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Problem Setup</h2>
          <p className="text-gray-600 mt-1">
            Configure people, groups, and constraints for optimization
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={generateDemoData}
            className="btn-secondary flex items-center space-x-2"
          >
            <Zap className="h-4 w-4" />
            <span>Load Demo</span>
          </button>
          <button
            onClick={handleLoadProblem}
            className="btn-secondary flex items-center space-x-2"
          >
            <Upload className="h-4 w-4" />
            <span>Load</span>
          </button>
          <button
            onClick={handleSaveProblem}
            className="btn-primary flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
        <div className="flex space-x-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                title={section.description}
              >
                <Icon className="h-4 w-4" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="card">
        {activeSection === 'people' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">People</h3>
              <button 
                onClick={() => setShowPersonForm(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Person</span>
              </button>
            </div>

            {/* People Grid */}
            {problem?.people && problem.people.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {problem.people.map((person) => (
                  <div key={person.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-medium">
                          {person.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEditPerson(person)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePerson(person.id)}
                          className="p-1.5 text-gray-400 hover:text-error-600 hover:bg-error-50 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 mb-1">{person.name}</div>
                      <div className="text-sm text-gray-500">
                        {person.gender && (
                          <span className="inline-block bg-gray-200 px-2 py-0.5 rounded text-xs mr-1">
                            {person.gender}
                          </span>
                        )}
                        <span className="text-xs">
                          {person.groups ? `${person.groups.length} groups` : 'All groups'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No people added yet</p>
                <p className="text-sm">Click "Add Person" to get started</p>
              </div>
            )}

            {/* Add Person Form */}
            {showPersonForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingPerson ? 'Edit Person' : 'Add Person'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowPersonForm(false);
                        setEditingPerson(null);
                        setPersonForm({ name: '', gender: '', groups: [] });
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="label">Name</label>
                      <input
                        type="text"
                        className="input"
                        value={personForm.name}
                        onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })}
                        placeholder="Enter person's name"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Gender (Optional)</label>
                      <select
                        className="select"
                        value={personForm.gender}
                        onChange={(e) => setPersonForm({ ...personForm, gender: e.target.value as 'male' | 'female' | '' })}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowPersonForm(false);
                          setEditingPerson(null);
                          setPersonForm({ name: '', gender: '', groups: [] });
                        }}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={editingPerson ? handleUpdatePerson : handleAddPerson}
                        className="btn-primary flex-1 flex items-center justify-center space-x-2"
                      >
                        <Check className="h-4 w-4" />
                        <span>{editingPerson ? 'Update' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Groups</h3>
              <button 
                onClick={() => setShowGroupForm(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Group</span>
              </button>
            </div>

            {/* Groups List */}
            {problem?.groups && problem.groups.length > 0 ? (
              <div className="space-y-2">
                {problem.groups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                        <Hash className="h-4 w-4 text-success-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{group.name}</div>
                        <div className="text-sm text-gray-500">
                          {group.min_people}-{group.max_people} people
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditGroup(group)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1 text-gray-400 hover:text-error-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Hash className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No groups defined yet</p>
                <p className="text-sm">Click "Add Group" to get started</p>
              </div>
            )}

            {/* Add Group Form */}
            {showGroupForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingGroup ? 'Edit Group' : 'Add Group'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowGroupForm(false);
                        setEditingGroup(null);
                        setGroupForm({ name: '', max_people: 10, min_people: 1 });
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="label">Group Name</label>
                      <input
                        type="text"
                        className="input"
                        value={groupForm.name}
                        onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                        placeholder="Enter group name"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Min People</label>
                        <input
                          type="number"
                          className="input"
                          value={groupForm.min_people}
                          onChange={(e) => setGroupForm({ ...groupForm, min_people: parseInt(e.target.value) || 1 })}
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="label">Max People</label>
                        <input
                          type="number"
                          className="input"
                          value={groupForm.max_people}
                          onChange={(e) => setGroupForm({ ...groupForm, max_people: parseInt(e.target.value) || 10 })}
                          min="1"
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowGroupForm(false);
                          setEditingGroup(null);
                          setGroupForm({ name: '', max_people: 10, min_people: 1 });
                        }}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={editingGroup ? handleUpdateGroup : handleAddGroup}
                        className="btn-primary flex-1 flex items-center justify-center space-x-2"
                      >
                        <Check className="h-4 w-4" />
                        <span>{editingGroup ? 'Update' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'sessions' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sessions Configuration</h3>
              <p className="text-sm text-gray-600 mb-4">
                Specify how many sessions the algorithm should run. Each session will distribute people into the defined groups.
              </p>
            </div>

            {/* Sessions Count Configuration */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <label className="label text-base font-medium">Number of Sessions</label>
                  <p className="text-sm text-gray-500 mb-3">
                    The algorithm will create {sessionsCount} different sessions, distributing people into groups for each session
                  </p>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={sessionsCount}
                      onChange={(e) => handleSessionsCountChange(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={sessionsCount}
                        onChange={(e) => handleSessionsCountChange(parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm text-gray-500">sessions</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sessions Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Preview</h4>
              <p className="text-sm text-blue-700">
                The algorithm will create <strong>{sessionsCount} sessions</strong> with the following structure:
              </p>
              <div className="mt-3 space-y-1">
                {Array.from({ length: Math.min(sessionsCount, 5) }, (_, i) => (
                  <div key={i} className="text-sm text-blue-600">
                    • Session {i + 1}: People distributed across {problem?.groups?.length || 0} groups
                  </div>
                ))}
                {sessionsCount > 5 && (
                  <div className="text-sm text-blue-600">
                    • ... and {sessionsCount - 5} more sessions
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'constraints' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Constraints</h3>
              <button 
                onClick={() => {
                  addNotification({
                    type: 'info',
                    title: 'Coming Soon',
                    message: 'Constraint management will be implemented in the next phase',
                  });
                }}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Constraint</span>
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Constraint management coming soon</p>
              <p className="text-sm">This feature will allow you to define optimization constraints</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 