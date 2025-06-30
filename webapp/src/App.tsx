import { useEffect } from 'react';
import { useAppStore } from './store';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ProblemEditor } from './components/ProblemEditor';
import { SolverPanel } from './components/SolverPanel';
import { ResultsView } from './components/ResultsView';
import { NotificationContainer } from './components/NotificationContainer';
import { wasmService } from './services/wasm';

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
        addNotification({
          type: 'error',
          title: 'Initialization Failed',
          message: 'Failed to load WASM solver. Some features may be unavailable.',
          duration: 0, // Don't auto-dismiss
        });
      }
    };

    initWasm();
  }, [addNotification]);

  const renderActiveTab = () => {
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
      <Header />
      <div className="container mx-auto px-4 py-6">
        <Navigation />
        <main className="mt-6">
          {renderActiveTab()}
        </main>
      </div>
      <NotificationContainer />
      </div>
  );
}

export default App;
