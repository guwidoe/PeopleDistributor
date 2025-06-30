import { useState } from 'react';
import { useAppStore } from '../store';
import { Users, Calendar, Settings, Plus, Save, Upload } from 'lucide-react';
import type { Person, Session, Constraint } from '../types';

export function ProblemEditor() {
  const { problem, setProblem, addNotification } = useAppStore();
  const [activeSection, setActiveSection] = useState<'people' | 'sessions' | 'constraints'>('people');

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

  const sections = [
    {
      id: 'people' as const,
      label: 'People',
      icon: Users,
      description: 'Add and configure people',
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
            Configure people, sessions, and constraints for optimization
          </p>
        </div>
        <div className="flex space-x-3">
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
              <button className="btn-primary flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Person</span>
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No people added yet</p>
              <p className="text-sm">Click "Add Person" to get started</p>
            </div>
          </div>
        )}

        {activeSection === 'sessions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
              <button className="btn-primary flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Session</span>
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No sessions defined yet</p>
              <p className="text-sm">Click "Add Session" to get started</p>
            </div>
          </div>
        )}

        {activeSection === 'constraints' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Constraints</h3>
              <button className="btn-primary flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Constraint</span>
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No constraints defined yet</p>
              <p className="text-sm">Click "Add Constraint" to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 