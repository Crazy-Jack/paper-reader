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
  callGemini: (params) => ipcRenderer.invoke('call-gemini', params),
  getEmbeddings: (params) => ipcRenderer.invoke('get-embeddings', params),
  saveEmbeddings: (params) => ipcRenderer.invoke('save-embeddings', params),
  loadEmbeddings: (params) => ipcRenderer.invoke('load-embeddings', params),
  proposeThesisEdit: (params) => ipcRenderer.invoke('propose-thesis-edit', params)
});

