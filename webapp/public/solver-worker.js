// Web Worker for running the WASM solver off the main thread
let wasmModule = null;
let isInitializing = false;

// Initialize the WASM module
async function initWasm() {
  if (wasmModule) {
    return wasmModule;
  }
  
  if (isInitializing) {
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return wasmModule;
  }
  
  isInitializing = true;
  
  try {
    console.log('Initializing WASM in worker...');
    
    // Load the no-modules WASM build
    importScripts('./solver_wasm.js');
    
    // Initialize WASM with the .wasm file
    await wasm_bindgen('./solver_wasm_bg.wasm');
    
    wasmModule = wasm_bindgen;
    console.log('WASM initialized successfully in worker');
    
    // Initialize panic hook
    if (wasmModule.init_panic_hook) {
      wasmModule.init_panic_hook();
    }
    
    isInitializing = false;
    return wasmModule;
  } catch (error) {
    isInitializing = false;
    console.error('Failed to load WASM in worker:', error);
    throw new Error(`WASM initialization failed: ${error.message}`);
  }
}

// Handle messages from the main thread
self.onmessage = async function(e) {
  const { type, id, data } = e.data;
  
  console.log(`Worker received message: ${type} with id: ${id}`);
  
  try {
    switch (type) {
      case 'INIT':
        console.log('Worker initializing WASM...');
        await initWasm();
        console.log('Worker WASM initialization complete');
        self.postMessage({ type: 'INIT_SUCCESS', id });
        break;
        
      case 'SOLVE':
        console.log('Worker starting solve...');
        const { problemJson, useProgress } = data;
        
        if (!wasmModule) {
          await initWasm(); // Try to initialize if not already done
        }
        
        if (!wasmModule) {
          throw new Error('WASM module not initialized');
        }
        
        if (useProgress) {
          console.log('Worker solving with progress...');
          // Create a progress callback that sends updates to the main thread
          const progressCallback = (progressJson) => {
            self.postMessage({ 
              type: 'PROGRESS', 
              id, 
              data: { progressJson } 
            });
            return true; // Always continue for now - cancellation will be handled differently
          };
          
          const result = wasmModule.solve_with_progress(problemJson, progressCallback);
          console.log('Worker solve completed');
          self.postMessage({ type: 'SOLVE_SUCCESS', id, data: { result } });
        } else {
          console.log('Worker solving without progress...');
          const result = wasmModule.solve(problemJson);
          console.log('Worker solve completed');
          self.postMessage({ type: 'SOLVE_SUCCESS', id, data: { result } });
        }
        break;
        
      case 'CANCEL':
        console.log('Worker handling cancellation...');
        // For now, we'll implement cancellation by terminating and restarting the worker
        // A more sophisticated approach would involve modifying the WASM to check a cancellation flag
        self.postMessage({ type: 'CANCELLED', id });
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({ 
      type: 'ERROR', 
      id, 
      data: { 
        error: error.message,
        stack: error.stack 
      } 
    });
  }
};

// Handle worker errors
self.onerror = function(error) {
  self.postMessage({ 
    type: 'ERROR', 
    data: { 
      error: error.message,
      filename: error.filename,
      lineno: error.lineno 
    } 
  });
}; 