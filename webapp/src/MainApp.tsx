import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from './store';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ProblemManager } from './components/ProblemManager';
import { NotificationContainer } from './components/NotificationContainer';

function MainApp() {
  const { ui, initializeApp, setShowProblemManager } = useAppStore();

  // Initialize app on start
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

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
          <Outlet />
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

export default MainApp; 