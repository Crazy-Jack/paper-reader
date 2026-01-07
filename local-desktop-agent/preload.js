const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// the APIs in a secure way
contextBridge.exposeInMainWorld('electronAPI', {
  // Add your API methods here as needed
  // Example:
  // getVersion: () => process.versions.electron,
});

