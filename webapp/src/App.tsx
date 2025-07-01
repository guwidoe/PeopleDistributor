import { useEffect } from 'react';
import { useAppStore } from './store';
import { useThemeStore } from './store/theme';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ProblemEditor } from './components/ProblemEditor';
import { SolverPanel } from './components/SolverPanel';
import { ResultsView } from './components/ResultsView';
import { ResultsHistory } from './components/ResultsHistory';
import { ProblemManager } from './components/ProblemManager';
import { NotificationContainer } from './components/NotificationContainer';

function App() {
  const { ui, initializeApp, setShowProblemManager } = useAppStore();

  // Initialize app on start
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const renderContent = () => {
    switch (ui.activeTab) {
      case 'problem':
        return <ProblemEditor />;
      case 'solver':
        return <SolverPanel />;
      case 'results':
        return <ResultsView />;
      case 'manage':
        return <ResultsHistory />;
      default:
        return <ProblemEditor />;
    }
  };

  return (
    <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Navigation */}
        <div className="mb-6">
          <Navigation />
        </div>

        {/* Content Area */}
        <div className="animate-fade-in">
          {renderContent()}
        </div>
      </main>

      {/* Notifications */}
      <NotificationContainer />

      {/* Problem Manager Modal */}
      <ProblemManager 
        isOpen={ui.showProblemManager} 
        onClose={() => setShowProblemManager(false)} 
      />
    </div>
  );
}

export default App;
