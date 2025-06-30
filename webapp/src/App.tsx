import { useEffect } from 'react';
import { useAppStore } from './store';
import { wasmService } from './services/wasm';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ProblemEditor } from './components/ProblemEditor';
import { SolverPanel } from './components/SolverPanel';
import { ResultsView } from './components/ResultsView';
import { NotificationContainer } from './components/NotificationContainer';

function App() {
  const { ui, addNotification } = useAppStore();

  useEffect(() => {
    // Initialize WASM service on app load
    const initWasm = async () => {
      try {
        await wasmService.initialize();
        addNotification({
          type: 'success',
          title: 'Ready',
          message: 'WASM solver initialized successfully',
          duration: 3000,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addNotification({
          type: 'warning',
          title: 'WASM Module Not Available',
          message: `${errorMessage}. You can still use the UI for development.`,
          duration: 5000,
        });
      }
    };

    initWasm();
  }, [addNotification]);

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
