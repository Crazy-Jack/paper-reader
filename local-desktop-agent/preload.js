const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the APIs in a secure way
contextBridge.exposeInMainWorld('electronAPI', {
  selectImage: () => ipcRenderer.invoke('select-image'),
  loadPapers: (dataset) => ipcRenderer.invoke('load-papers', dataset),
  downloadPDF: (forumId) => ipcRenderer.invoke('download-pdf', forumId),
  loadPDFText: (forumId) => ipcRenderer.invoke('load-pdf-text', forumId),
  saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),
  callGemini: (params) => ipcRenderer.invoke('call-gemini', params)
});

