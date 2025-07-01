import { useAppStore } from '../store';
import { Settings, Play, BarChart3, History, FolderOpen } from 'lucide-react';

export function Navigation() {
  const { ui, setActiveTab, setShowProblemManager, currentProblemId, savedProblems } = useAppStore();

  const tabs = [
    {
      id: 'problem' as const,
      label: 'Problem Setup',
      icon: Settings,
      description: 'Configure people, sessions, and constraints',
    },
    {
      id: 'solver' as const,
      label: 'Solver',
      icon: Play,
      description: 'Run the optimization algorithm',
    },
    {
      id: 'results' as const,
      label: 'Results',
      icon: BarChart3,
      description: 'View and analyze solutions',
    },
    {
      id: 'manage' as const,
      label: 'History',
      icon: History,
      description: 'View results history and comparisons',
    },
  ];

  const currentProblemName = currentProblemId ? savedProblems[currentProblemId]?.name : null;

  return (
    <div className="space-y-4">
      {/* Current Problem Indicator */}
      {currentProblemName && (
        <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FolderOpen className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Current Problem: {currentProblemName}
              </span>
            </div>
            <button
              onClick={() => setShowProblemManager(true)}
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--color-accent)' }}
            >
              Manage Problems
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="rounded-lg border p-1 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow)' }}>
      <div className="flex space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = ui.activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 border ${
                isActive
                  ? 'shadow-sm'
                  : 'border-transparent hover:bg-opacity-50'
              }`}
              style={{
                color: isActive ? 'var(--color-accent)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                borderColor: isActive ? 'var(--color-accent)' : 'transparent'
              }}
              title={tab.description}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>

      {/* Problem Manager Button (when no current problem) */}
      {!currentProblemName && (
        <div className="text-center">
          <button
            onClick={() => setShowProblemManager(true)}
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Manage Problems</span>
          </button>
          <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Create or load a problem to get started
          </p>
        </div>
      )}
    </div>
  );
} 