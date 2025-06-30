import { useEffect } from 'react';
import { useAppStore } from './store';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ProblemEditor } from './components/ProblemEditor';
import { SolverPanel } from './components/SolverPanel';
import { ResultsView } from './components/ResultsView';
import { NotificationContainer } from './components/NotificationContainer';

function App() {
  const { ui } = useAppStore();

  const renderContent = () => {
    switch (ui.activeTab) {
      case 'problem':
        return <ProblemEditor />;
      case 'solver':
        return <SolverPanel />;
      case 'results':
        return <ResultsView />;
      default:
        return <ProblemEditor />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
    </div>
  );
}

export default App;
