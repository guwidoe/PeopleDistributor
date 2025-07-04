import { NavLink } from 'react-router-dom';
import { Settings, Play, BarChart3, History } from 'lucide-react';

export function Navigation() {


  const tabs = [
    {
      id: 'problem',
      path: '/app/problem',
      label: 'Problem Setup',
      icon: Settings,
      description: 'Configure people, sessions, and constraints',
    },
    {
      id: 'solver',
      path: '/app/solver',
      label: 'Solver',
      icon: Play,
      description: 'Run the optimization algorithm',
    },
    {
      id: 'manage',
      path: '/app/history',
      label: 'Results',
      icon: History,
      description: 'View and manage all saved results',
    },
    {
      id: 'results',
      path: '/app/results',
      label: 'Result Details',
      icon: BarChart3,
      description: 'Inspect a single result in depth',
    },
  ];



  return (
    <div className="space-y-4">
      {/* Navigation Tabs */}
      <nav className="rounded-lg border p-1 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow)' }}>
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={({ isActive }) =>
                  `flex-1 flex items-center justify-center space-x-2 px-2 sm:px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 border ${
                    isActive
                      ? 'shadow-sm'
                      : 'border-transparent hover:bg-opacity-50'
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--color-accent)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                  borderColor: isActive ? 'var(--color-accent)' : 'transparent'
                })}
                title={tab.description}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs sm:text-sm">{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
} 