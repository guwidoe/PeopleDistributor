import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { wasmService } from './services/wasm';

function App() {
  const { addNotification } = useAppStore();
  const [wasmStatus, setWasmStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    // Initialize WASM service on app load
    const initWasm = async () => {
      try {
        await wasmService.initialize();
        setWasmStatus('ready');
        addNotification({
          type: 'success',
          title: 'Ready',
          message: 'WASM solver initialized successfully',
          duration: 3000,
        });
      } catch (error) {
        setWasmStatus('failed');
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

  const getWasmStatusIcon = () => {
    switch (wasmStatus) {
      case 'loading': return '🔄';
      case 'ready': return '✅';
      case 'failed': return '❌';
    }
  };

  const getWasmStatusText = () => {
    switch (wasmStatus) {
      case 'loading': return 'WASM module loading...';
      case 'ready': return 'WASM module ready';
      case 'failed': return 'WASM module failed to load';
    }
  };

  return (
    <div style={{ 
      backgroundColor: '#f9fafb', 
      minHeight: '100vh', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#1f2937', marginBottom: '20px' }}>
        🎉 PeopleDistributor WebApp is Running!
      </h1>
      
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#374151', marginBottom: '10px' }}>Status:</h2>
        <p style={{ color: '#6b7280' }}>
          ✅ React is working<br/>
          ✅ Development server is running<br/>
          ✅ You can see this content<br/>
          ✅ WASM module has been built and is available at /wasm/<br/>
          {getWasmStatusIcon()} {getWasmStatusText()}<br/>
          💡 Check browser console for detailed logs
        </p>
      </div>

      <div style={{ 
        backgroundColor: '#dbeafe', 
        padding: '15px', 
        borderRadius: '6px',
        border: '1px solid #93c5fd'
      }}>
        <strong>Next steps:</strong>
        <ul style={{ marginTop: '10px', color: '#1e40af' }}>
          <li>Check browser console for any errors</li>
          <li>We can now work on the UI components</li>
          <li>WASM integration can be fixed later</li>
        </ul>
        
        {wasmStatus === 'ready' && (
          <div style={{ marginTop: '15px' }}>
            <button 
              onClick={async () => {
                try {
                  const settings = await wasmService.getDefaultSettings();
                  console.log('WASM Test - Default settings:', settings);
                  addNotification({
                    type: 'success',
                    title: 'WASM Test Successful',
                    message: `Got default settings: ${JSON.stringify(settings)}`,
                    duration: 5000,
                  });
                } catch (error) {
                  console.error('WASM Test failed:', error);
                  addNotification({
                    type: 'error',
                    title: 'WASM Test Failed',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    duration: 5000,
                  });
                }
              }}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🧪 Test WASM Module
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
