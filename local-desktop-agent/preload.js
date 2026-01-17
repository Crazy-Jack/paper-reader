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
  saveDeepResearchKeys: (keys) => ipcRenderer.invoke('save-deep-research-keys', keys),
  loadDeepResearchKeys: () => ipcRenderer.invoke('load-deep-research-keys'),
  deepResearch: (params) => ipcRenderer.invoke('deep-research', params),
  onDeepResearchProgress: (callback) => {
    ipcRenderer.on('deep-research-progress', (event, progress) => callback(progress));
  },
  callGemini: (params) => ipcRenderer.invoke('call-gemini', params),
  googleSearch: (params) => ipcRenderer.invoke('google-search', params),
  getEmbeddings: (params) => ipcRenderer.invoke('get-embeddings', params),
  saveEmbeddings: (params) => ipcRenderer.invoke('save-embeddings', params),
  loadEmbeddings: (params) => ipcRenderer.invoke('load-embeddings', params),
  proposeThesisEdit: (params) => ipcRenderer.invoke('propose-thesis-edit', params)
});

