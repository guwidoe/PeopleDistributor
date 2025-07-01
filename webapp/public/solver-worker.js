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
  
  try {
    switch (type) {
      case 'INIT':
        await initWasm();
        self.postMessage({ type: 'INIT_SUCCESS', id });
        break;
        
      case 'SOLVE':
        const { problemJson, useProgress } = data;
        
        if (!wasmModule) {
          await initWasm(); // Try to initialize if not already done
        }
        
        if (!wasmModule) {
          throw new Error('WASM module not initialized');
        }
        
        if (useProgress) {
          let lastProgressJson = null;
          let progressCallCount = 0;
          
          // Create a progress callback that sends updates to the main thread
          const progressCallback = (progressJson) => {
            progressCallCount++;
            lastProgressJson = progressJson;
            
            // Parse and log the progress for debugging
            try {
              const progress = JSON.parse(progressJson);
              console.log(`[Worker] Progress ${progressCallCount}: iteration=${progress.iteration}, current_score=${progress.current_score}, best_score=${progress.best_score}`);
            } catch (e) {
              console.log(`[Worker] Progress ${progressCallCount}: ${progressJson}`);
            }
            
            self.postMessage({ 
              type: 'PROGRESS', 
              id, 
              data: { progressJson } 
            });
            
            return true; // Always continue for now - cancellation will be handled differently
          };
          
          console.log('[Worker] Starting solve_with_progress...');
          const result = wasmModule.solve_with_progress(problemJson, progressCallback);
          console.log('[Worker] solve_with_progress completed');

          // Parse and log the final result for debugging
          try {
            const parsedResult = JSON.parse(result);
            console.log(`[Worker] Final result: final_score=${parsedResult.final_score}, unique_contacts=${parsedResult.unique_contacts}`);
          } catch (e) {
            console.log(`[Worker] Final result (raw): ${result}`);
          }

          // Parse and log the last progress for comparison
          if (lastProgressJson) {
            try {
              const lastProgress = JSON.parse(lastProgressJson);
              console.log(`[Worker] Last progress: current_score=${lastProgress.current_score}, best_score=${lastProgress.best_score}`);
            } catch (e) {
              console.log(`[Worker] Last progress (raw): ${lastProgressJson}`);
            }
          }

          self.postMessage({ type: 'SOLVE_SUCCESS', id, data: { result, lastProgressJson } });
        } else {
          const result = wasmModule.solve(problemJson);
          self.postMessage({ type: 'SOLVE_SUCCESS', id, data: { result } });
        }
        break;
        
      case 'CANCEL':
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