// Web Worker for running the WASM solver off the main thread
let wasmModule = null;
let isInitializing = false;
let lastProblemJson = null; // store latest JSON for error reporting

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

// // ========= Forward worker console logs to the main thread =========
// const _origLog = console.log.bind(console);
// const _origWarn = console.warn.bind(console);
// const _origError = console.error.bind(console);
// const _origDebug = console.debug ? console.debug.bind(console) : _origLog;

// function sendLog(level, args) {
//   try {
//     self.postMessage({ type: "LOG", data: { level, args: args.map(serializeForPostMessage) } });
//   } catch {
//     // Silent – avoid infinite loops if postMessage fails
//   }
// }

// function serializeForPostMessage(val) {
//   if (val instanceof Error) {
//     return { message: val.message, stack: val.stack, name: val.name };
//   }
//   try {
//     return JSON.parse(JSON.stringify(val));
//   } catch {
//     // Fallback to string when circular refs etc.
//     return String(val);
//   }
// }

// console.log = (...args) => {
//   _origLog(...args);
//   sendLog("log", args);
// };
// console.warn = (...args) => {
//   _origWarn(...args);
//   sendLog("warn", args);
// };
// console.error = (...args) => {
//   _origError(...args);
//   sendLog("error", args);
// };
// console.debug = (...args) => {
//   _origDebug(...args);
//   sendLog("debug", args);
// };

// ================================================================

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
        lastProblemJson = problemJson;
        
        // // Forward the raw problem JSON to the main thread for easier debugging
        // self.postMessage({
        //   type: 'PROBLEM_JSON',
        //   id,
        //   data: { problemJson },
        // });
        
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
              // console.log(`[Worker] Progress ${progressCallCount}: iteration=${progress.iteration}, current_score=${progress.current_score}, best_score=${progress.best_score}`);
            } catch (e) {
              // console.log(`[Worker] Progress ${progressCallCount}: ${progressJson}`);
            }
            
            self.postMessage({ 
              type: 'PROGRESS', 
              id, 
              data: { progressJson } 
            });
            
            return true; // Always continue for now - cancellation will be handled differently
          };
          
          // console.log('[Worker] Starting solve_with_progress...');
          const result = wasmModule.solve_with_progress(problemJson, progressCallback);
          // console.log('[Worker] solve_with_progress completed');

          // Parse and log the final result for debugging
          try {
            const parsedResult = JSON.parse(result);
            // console.log(`[Worker] Final result: final_score=${parsedResult.final_score}, unique_contacts=${parsedResult.unique_contacts}`);
          } catch (e) {
            // console.log(`[Worker] Final result (raw): ${result}`);
          }

          // Parse and log the last progress for comparison
          if (lastProgressJson) {
            try {
              const lastProgress = JSON.parse(lastProgressJson);
              // console.log(`[Worker] Last progress: current_score=${lastProgress.current_score}, best_score=${lastProgress.best_score}`);
            } catch (e) {
              // console.log(`[Worker] Last progress (raw): ${lastProgressJson}`);
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
        
      case 'get_default_settings':
        try {
          if (!wasmModule) {
            throw new Error("WASM module not initialized.");
          }
          const settings = wasmModule.get_default_settings();
          self.postMessage({ type: 'RPC_SUCCESS', id, data: { result: settings } });
        } catch (error) {
          self.postMessage({ type: 'RPC_ERROR', id, data: { error: error.message } });
        }
        break;

      case 'get_recommended_settings':
        try {
          if (!wasmModule) {
            throw new Error("WASM module not initialized.");
          }
          const { problemJson, desired_runtime_seconds } = data;
          const settings = wasmModule.get_recommended_settings(problemJson, BigInt(desired_runtime_seconds));
          self.postMessage({ type: 'RPC_SUCCESS', id, data: { result: settings } });
        } catch (error) {
          self.postMessage({ type: 'RPC_ERROR', id, data: { error: error.message } });
        }
        break;
        
      default:
        console.warn(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('Worker error:', error);
    // Ensure we always send a meaningful error string back to the main thread
    const errorString = error && error.message ? error.message : String(error);

    self.postMessage({ 
      type: 'ERROR', 
      id, 
      data: { 
        error: errorString,
        stack: error && error.stack ? error.stack : undefined,
        problemJson: lastProblemJson
      } 
    });
  }
};

// Handle worker errors
self.onerror = function(error) {
  // Same fallback logic as above for global errors
  const errMsg = error && error.message ? error.message : String(error);

  self.postMessage({ 
    type: 'ERROR', 
    data: { 
      error: errMsg,
      filename: error.filename,
      lineno: error.lineno 
    } 
  });
}; 