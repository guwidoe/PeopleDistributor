import { useAppStore } from '../store';
import { Settings, Play, BarChart3 } from 'lucide-react';

export function Navigation() {
  const { ui, setActiveTab } = useAppStore();

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
  ];

  return (
    <nav className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
      <div className="flex space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = ui.activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-700 border border-primary-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              title={tab.description}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
} 