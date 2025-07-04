import { Link } from 'react-router-dom';
import { Users, FolderOpen, Bug } from 'lucide-react';
import { HeaderThemeToggle } from './ThemeToggle';
import { useAppStore } from '../store';

export function Header() {
  const { currentProblemId, savedProblems, setShowProblemManager } = useAppStore();
  const currentProblemName = currentProblemId ? savedProblems[currentProblemId]?.name : null;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <Link to="/landingpage" className="flex items-center space-x-3 group">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 transition-colors" style={{ color: 'var(--color-accent)' }} />
              <h1 className="text-2xl font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>
                Group Mixer
              </h1>
            </div>
          </Link>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            {!currentProblemName && (
              <button
                onClick={() => setShowProblemManager(true)}
                className="btn-secondary flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-start"
                title="Manage problems"
              >
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Manage Problems</span>
                <span className="sm:hidden">Manage</span>
              </button>
            )}
            {currentProblemName && (
              <div className="hidden sm:flex items-center space-x-2 text-sm p-2 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                <FolderOpen className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                <span className="hidden md:inline">
                  Current: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{currentProblemName}</span>
                </span>
                <button
                  onClick={() => setShowProblemManager(true)}
                  className="ml-1 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--color-accent)' }}
                >
                  (Manage)
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a href="https://github.com/guwidoe/PeopleDistributor/issues" target="_blank" rel="noopener noreferrer" title="Report an issue or suggest a feature" className="flex items-center space-x-2 text-sm transition-colors p-2 rounded-md hover:bg-opacity-50 flex-1 sm:flex-none justify-center sm:justify-start" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)' }}>
                <Bug className="h-4 w-4" />
                <span className="hidden lg:inline">Report Issue</span>
                <span className="lg:hidden">Issues</span>
              </a>
              
              <HeaderThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
} 