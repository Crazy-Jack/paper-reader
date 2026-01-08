// Research Agent class for paper analysis and idea generation
class ResearchAgent {
  constructor() {
    this.papers = [];
    this.filteredPapers = [];
    this.currentDataset = null;
    this.selectedPaper = null;
    this.loadedContexts = {}; // Store loaded PDF contexts by forum ID
    this.geminiApiKey = null; // Store Gemini API key
    this.useGemini = false; // Flag to enable/disable Gemini
    
    this.init();
    this.loadApiKey();
  }

  init() {
    // DOM elements
    this.loadPapersBtn = document.getElementById('load-papers-btn');
    this.datasetSelect = document.getElementById('paper-dataset-select');
    this.paperCount = document.getElementById('paper-count');
    this.paperList = document.getElementById('paper-list');
    this.searchInput = document.getElementById('search-papers');
    this.presentationFilter = document.getElementById('filter-presentation');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('send-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.loadedContextsInfo = document.getElementById('loaded-contexts-info');
    this.loadedContextsList = document.getElementById('loaded-contexts-list');
    this.loadedContextsContent = document.getElementById('loaded-contexts-content');
    this.clearAllContextsBtn = document.getElementById('clear-all-contexts-btn');
    this.toggleContextsBtn = document.getElementById('toggle-contexts-btn');
    this.togglePaperDbBtn = document.getElementById('toggle-paper-db-btn');
    this.toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    this.toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    this.paperDbContent = document.getElementById('paper-db-content');
    this.filtersContent = document.getElementById('filters-content');
    this.settingsContent = document.getElementById('settings-content');
    this.geminiApiKeyInput = document.getElementById('gemini-api-key');
    this.saveApiKeyBtn = document.getElementById('save-api-key-btn');
    this.apiKeySavedIndicator = document.getElementById('api-key-saved-indicator');
    
    // Track collapse states
    this.contextsPanelExpanded = true;
    this.paperDbExpanded = true;
    this.filtersExpanded = true;
    this.settingsExpanded = true;

    // Event listeners
    this.loadPapersBtn.addEventListener('click', () => this.loadPapers());
    this.clearAllContextsBtn.addEventListener('click', () => this.clearAllContexts());
    this.toggleContextsBtn.addEventListener('click', () => this.toggleContextsPanel());
    this.togglePaperDbBtn.addEventListener('click', () => this.togglePaperDbPanel());
    this.toggleFiltersBtn.addEventListener('click', () => this.toggleFiltersPanel());
    this.toggleSettingsBtn.addEventListener('click', () => this.toggleSettingsPanel());
    this.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
    this.searchInput.addEventListener('input', () => this.filterPapers());
    this.presentationFilter.addEventListener('change', () => this.filterPapers());
    this.findRelevantPapersBtn = document.getElementById('find-relevant-papers-btn');
    this.findRelevantPapersBtn.addEventListener('click', () => this.findRelevantPapersFromThesis());
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.clearBtn.addEventListener('click', () => this.clearChat());
    
    // Allow Enter to send (Shift+Enter for new line)
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
  }

  async loadPapers() {
    const dataset = this.datasetSelect.value;
    if (!dataset) {
      alert('Please select a dataset first');
      return;
    }

    this.loadPapersBtn.disabled = true;
    this.loadPapersBtn.textContent = 'Loading...';
    
    try {
      if (window.electronAPI && window.electronAPI.loadPapers) {
        const result = await window.electronAPI.loadPapers(dataset);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        if (result.success && result.papers) {
          this.papers = result.papers;
          this.currentDataset = result.dataset || dataset;
          this.filteredPapers = [...this.papers];
          this.renderPapers();
          this.updatePaperCount();
          this.addMessage('agent', `Loaded ${result.count} papers from ${this.currentDataset}!`);
        } else {
          throw new Error('Invalid response format');
        }
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('Error loading papers:', error);
      alert('Error loading papers: ' + error.message);
      this.addMessage('agent', `Error loading papers: ${error.message}`);
    } finally {
      this.loadPapersBtn.disabled = false;
      this.loadPapersBtn.textContent = 'Load Papers';
    }
  }

  filterPapers() {
    const searchTerm = this.searchInput.value.toLowerCase();
    const presentationFilter = this.presentationFilter.value;

    this.filteredPapers = this.papers.filter(paper => {
      // Search filter
      const matchesSearch = !searchTerm || 
        (paper.title && paper.title.toLowerCase().includes(searchTerm)) ||
        (paper.abstract && paper.abstract.toLowerCase().includes(searchTerm)) ||
        (paper.authors && paper.authors.some(a => a && a.toLowerCase().includes(searchTerm)));

      // Presentation filter
      const matchesPresentation = !presentationFilter || 
        paper.presentation === presentationFilter;

      return matchesSearch && matchesPresentation;
    });

    this.renderPapers();
  }

  renderPapers() {
    if (this.filteredPapers.length === 0) {
      this.paperList.innerHTML = '<div class="empty-state">No papers found</div>';
      return;
    }

    this.paperList.innerHTML = this.filteredPapers.map((paper, index) => {
      const title = paper.title || 'Untitled';
      const abstract = paper.abstract ? 
        (paper.abstract.length > 150 ? this.cleanAbstract(paper.abstract).substring(0, 150) + '...' : this.cleanAbstract(paper.abstract)) : 
        'No abstract available';
      const venue = paper.venue || 'Unknown venue';
      const presentation = paper.presentation ? ` • ${paper.presentation}` : '';
      const selectedClass = this.selectedPaper === index ? 'selected' : '';

      const forumId = paper.forum || '';
      const hasForumId = forumId && forumId.length > 0;
      const isContextLoaded = this.loadedContexts[forumId] ? 'loaded' : '';
      const contextButtonTitle = isContextLoaded ? 'Unload Context (Click to remove)' : 'Load as Context';
      
      return `
        <div class="paper-item ${selectedClass}" data-index="${index}">
          <div class="paper-header-row">
            <div class="paper-title">${this.escapeHtml(title)}</div>
            ${hasForumId ? `
              <div class="paper-actions">
                <button class="btn btn-small btn-download" data-forum="${forumId}" title="Download PDF">⬇️</button>
                <button class="btn btn-small btn-context ${isContextLoaded}" data-forum="${forumId}" title="${contextButtonTitle}">${isContextLoaded ? '✓' : '📄'}</button>
              </div>
            ` : ''}
          </div>
          <div class="paper-meta">${this.escapeHtml(venue)}${presentation}</div>
          <div class="paper-abstract">${this.escapeHtml(abstract)}</div>
        </div>
      `;
    }).join('');

    // Add click handlers
    this.paperList.querySelectorAll('.paper-item').forEach((item, index) => {
      // Click on paper item (but not on buttons)
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.paper-actions')) {
          this.selectedPaper = index;
          this.renderPapers();
          this.showPaperDetails(this.filteredPapers[index]);
        }
      });
      
      // Download button
      const downloadBtn = item.querySelector('.btn-download');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const forumId = downloadBtn.getAttribute('data-forum');
          this.downloadPDF(forumId, index);
        });
      }
      
      // Load context button (toggle - load or unload)
      const contextBtn = item.querySelector('.btn-context');
      if (contextBtn) {
        contextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const forumId = contextBtn.getAttribute('data-forum');
          if (this.loadedContexts[forumId]) {
            // Already loaded - unload it
            this.unloadPDFContext(forumId, index);
          } else {
            // Not loaded - load it
            this.loadPDFContext(forumId, index);
          }
        });
      }
    });
  }

  async downloadPDF(forumId, paperIndex, silent = false) {
    if (!forumId) {
      if (!silent) {
        alert('No forum ID available for this paper');
      }
      return;
    }

    const paper = paperIndex >= 0 ? this.filteredPapers[paperIndex] : 
                  (this.papers.find(p => p.forum === forumId) || 
                   (this.loadedContexts[forumId] && this.loadedContexts[forumId].paper));
    const title = paper ? (paper.title || 'Unknown') : 'Unknown';
    
    if (!silent) {
      // Show downloading status
      this.addMessage('agent', `Downloading PDF for: ${title}...`);
    }

    try {
      if (window.electronAPI && window.electronAPI.downloadPDF) {
        const result = await window.electronAPI.downloadPDF(forumId);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        if (!silent) {
          const message = result.cached 
            ? `✓ PDF already exists locally for: ${title}`
            : `✓ PDF downloaded successfully for: ${title}`;
          this.addMessage('agent', message);
        }
        
        return { success: true, cached: result.cached };
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      if (!silent) {
        this.addMessage('agent', `Error downloading PDF: ${error.message}`);
      }
      return { success: false, error: error.message };
    }
  }

  async loadPDFContext(forumId, paperIndex, silent = false) {
    if (!forumId) {
      if (!silent) {
        alert('No forum ID available for this paper');
      }
      return;
    }

    // Get paper from filteredPapers or all papers
    let paper = null;
    if (paperIndex >= 0 && paperIndex < this.filteredPapers.length) {
      paper = this.filteredPapers[paperIndex];
    } else if (this.loadedContexts[forumId] && this.loadedContexts[forumId].paper) {
      paper = this.loadedContexts[forumId].paper;
    } else {
      // Try to find in all papers
      const allPaperIndex = this.papers.findIndex(p => p.forum === forumId);
      if (allPaperIndex !== -1) {
        paper = this.papers[allPaperIndex];
      }
    }
    
    if (!paper) {
      if (!silent) {
        this.addMessage('agent', `Error: Could not find paper data for forum ID: ${forumId}`);
      }
      return;
    }
    
    const title = paper.title || 'Unknown';
    
    let loadingId = null;
    if (!silent) {
      // Show loading status
      loadingId = this.addMessage('agent', `Loading PDF context for: ${title}...`, true);
    }

    try {
      // First ensure PDF is downloaded
      if (window.electronAPI && window.electronAPI.downloadPDF) {
        const downloadResult = await window.electronAPI.downloadPDF(forumId);
        if (downloadResult.error && !downloadResult.success) {
          throw new Error(downloadResult.error);
        }
      }

      // Load PDF text
      if (window.electronAPI && window.electronAPI.loadPDFText) {
        const result = await window.electronAPI.loadPDFText(forumId);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // Store context (upgrade from abstract to full paper if it was abstract-only)
        this.loadedContexts[forumId] = {
          title: title,
          text: result.text,
          numPages: result.numPages,
          type: 'full',
          loadedAt: new Date().toISOString(),
          forumId: forumId,
          paper: paper
        };
        
        // Update UI to show context is loaded
        this.renderPapers();
        this.updateLoadedContextsUI();
        
        if (!silent) {
          // Get abstract from paper data
          const abstract = this.cleanAbstract(paper.abstract || 'No abstract available');
          const abstractPreview = abstract.length > 500 ? abstract.substring(0, 500) + '...' : abstract;
          
          const loadedCount = Object.keys(this.loadedContexts).length;
          this.updateMessage(loadingId, `
**PDF Context Loaded: ${title}**

- **Pages**: ${result.numPages}
- **Text Length**: ${result.text.length.toLocaleString()} characters
- **Abstract**: ${abstractPreview}

**Currently loaded papers**: ${loadedCount} ${loadedCount === 1 ? 'paper' : 'papers'}

You can now ask questions about ${loadedCount === 1 ? 'this paper' : 'these papers'}, and I'll use ${loadedCount === 1 ? 'its' : 'their'} content as context!
          `);
        }
        
        return { success: true };
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('Error loading PDF context:', error);
      if (!silent && loadingId) {
        this.updateMessage(loadingId, `Error loading PDF context: ${error.message}`);
      }
      return { success: false, error: error.message };
    }
  }

  unloadPDFContext(forumId, paperIndex) {
    const paper = this.filteredPapers[paperIndex];
    const title = paper.title || 'Unknown';
    
    if (!this.loadedContexts[forumId]) {
      this.addMessage('agent', `Context for "${title}" is not loaded.`);
      return;
    }
    
    // Remove from loaded contexts
    delete this.loadedContexts[forumId];
    
    // Update UI
    this.renderPapers();
    this.updateLoadedContextsUI();
    
    const remainingCount = Object.keys(this.loadedContexts).length;
    this.addMessage('agent', `
**PDF Context Unloaded: ${title}**

**Remaining loaded papers**: ${remainingCount} ${remainingCount === 0 ? '(none)' : remainingCount === 1 ? 'paper' : 'papers'}

${remainingCount === 0 ? 'No papers are currently loaded as context.' : `You can still ask questions about the remaining ${remainingCount === 1 ? 'paper' : 'papers'}.`}
    `);
  }

  updateLoadedContextsUI() {
    const loadedCount = Object.keys(this.loadedContexts).length;
    
    if (loadedCount === 0) {
      this.loadedContextsInfo.style.display = 'none';
      return;
    }
    
    this.loadedContextsInfo.style.display = 'block';
    
    // List all loaded papers with remove buttons
    const contextsList = Object.entries(this.loadedContexts)
      .map(([forumId, context]) => {
        const contextType = context.type === 'abstract' ? 'Abstract Only' : 'Full Paper';
        const metaInfo = context.type === 'abstract' 
          ? `${(context.text.length / 1000).toFixed(1)}k chars`
          : `${context.numPages} pages • ${(context.text.length / 1000).toFixed(1)}k chars`;
        
        const hasForumId = forumId && forumId.length > 0 && !forumId.startsWith('index_');
        const loadFullButton = (context.type === 'abstract' && hasForumId) 
          ? `<button class="btn-load-full-from-context btn-small" data-forum="${forumId}" data-title="${this.escapeHtml(context.title)}" title="Load full paper (download and parse PDF)">📄 Load Full</button>`
          : '';
        const useAbstractButton = (context.type === 'full' && context.paper && context.paper.abstract) 
          ? `<button class="btn-use-abstract-only btn-small" data-forum="${forumId}" data-title="${this.escapeHtml(context.title)}" title="Switch to abstract only">📝 Use Abstract Only</button>`
          : '';
        
        return `
          <div class="loaded-context-item" data-forum="${forumId}">
            <div class="loaded-context-info">
              <div class="loaded-context-title">${this.escapeHtml(context.title)}</div>
              <div class="loaded-context-meta">${contextType} • ${metaInfo}</div>
            </div>
            <div class="loaded-context-actions">
              ${loadFullButton}
              ${useAbstractButton}
              <button class="btn-remove-context" data-forum="${forumId}" title="Remove this context">×</button>
            </div>
          </div>
        `;
      })
      .join('');
    
    this.loadedContextsList.innerHTML = contextsList || '<div class="empty-state">No papers loaded</div>';
    
    // Add event listeners for use abstract only buttons
    this.loadedContextsList.querySelectorAll('.btn-use-abstract-only').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const forumId = btn.getAttribute('data-forum');
        const title = btn.getAttribute('data-title');
        const context = this.loadedContexts[forumId];
        
        if (context && context.type === 'full' && context.paper && context.paper.abstract) {
          // Convert to abstract-only
          const abstract = this.cleanAbstract(context.paper.abstract || 'No abstract available');
          
          this.loadedContexts[forumId] = {
            title: title,
            text: `Title: ${title}\n\nAbstract:\n${abstract}`,
            type: 'abstract',
            loadedAt: new Date().toISOString(),
            forumId: forumId,
            paper: context.paper
          };
          
          // Update UI
          this.renderPapers();
          this.updateLoadedContextsUI();
        }
      });
    });
    
    // Add event listeners for load full paper buttons
    this.loadedContextsList.querySelectorAll('.btn-load-full-from-context').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const forumId = btn.getAttribute('data-forum');
        const title = btn.getAttribute('data-title');
        
        // Update button state
        btn.disabled = true;
        btn.textContent = '📄 Loading...';
        
        // Find paper in filteredPapers or all papers
        let paperIndex = this.filteredPapers.findIndex(p => p.forum === forumId);
        let paper = null;
        
        if (paperIndex !== -1) {
          paper = this.filteredPapers[paperIndex];
        } else {
          // Try to find in all papers
          const allPaperIndex = this.papers.findIndex(p => p.forum === forumId);
          if (allPaperIndex !== -1) {
            paper = this.papers[allPaperIndex];
            paperIndex = allPaperIndex;
          }
        }
        
        let result = null;
        if (paper) {
          result = await this.loadPDFContext(forumId, paperIndex, true);
        } else {
          // If paper not found in lists, try to load using the context's paper data
          const context = this.loadedContexts[forumId];
          if (context && context.paper) {
            // Temporarily add to filteredPapers for the load function
            const tempIndex = this.filteredPapers.length;
            this.filteredPapers.push(context.paper);
            result = await this.loadPDFContext(forumId, tempIndex, true);
            // Remove if it wasn't originally there
            if (paperIndex === -1) {
              this.filteredPapers.pop();
            }
          }
        }
        
        // Update button state based on result
        if (result && result.success) {
          btn.textContent = '✓ Loaded';
          btn.style.backgroundColor = '#27ae60';
          btn.disabled = true; // Keep disabled since it's now loaded
        } else {
          btn.textContent = '📄 Load Full';
          btn.disabled = false;
          console.error('Load failed:', result?.error);
        }
      });
    });
    
    // Add event listeners to remove buttons
    this.loadedContextsList.querySelectorAll('.btn-remove-context').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const forumId = btn.getAttribute('data-forum');
        // Find the paper index
        let paperIndex = this.filteredPapers.findIndex(p => p.forum === forumId);
        if (paperIndex === -1) {
          // Try all papers
          paperIndex = this.papers.findIndex(p => p.forum === forumId);
        }
        if (paperIndex !== -1) {
          this.unloadPDFContext(forumId, paperIndex);
        } else {
          // Just remove from contexts if paper not found
          delete this.loadedContexts[forumId];
          this.updateLoadedContextsUI();
        }
      });
    });
  }

  toggleContextsPanel() {
    this.contextsPanelExpanded = !this.contextsPanelExpanded;
    
    if (this.contextsPanelExpanded) {
      this.loadedContextsContent.style.display = 'block';
      this.toggleContextsBtn.textContent = '▼';
      this.toggleContextsBtn.title = 'Collapse';
    } else {
      this.loadedContextsContent.style.display = 'none';
      this.toggleContextsBtn.textContent = '▶';
      this.toggleContextsBtn.title = 'Expand';
    }
  }


  togglePaperDbPanel() {
    this.paperDbExpanded = !this.paperDbExpanded;
    
    if (this.paperDbExpanded) {
      this.paperDbContent.style.display = 'block';
      this.togglePaperDbBtn.textContent = '▼';
      this.togglePaperDbBtn.title = 'Collapse';
    } else {
      this.paperDbContent.style.display = 'none';
      this.togglePaperDbBtn.textContent = '▶';
      this.togglePaperDbBtn.title = 'Expand';
    }
  }

  toggleFiltersPanel() {
    this.filtersExpanded = !this.filtersExpanded;
    
    if (this.filtersExpanded) {
      this.filtersContent.style.display = 'block';
      this.toggleFiltersBtn.textContent = '▼';
      this.toggleFiltersBtn.title = 'Collapse';
    } else {
      this.filtersContent.style.display = 'none';
      this.toggleFiltersBtn.textContent = '▶';
      this.toggleFiltersBtn.title = 'Expand';
    }
  }

  clearAllContexts() {
    const loadedCount = Object.keys(this.loadedContexts).length;
    
    if (loadedCount === 0) {
      this.addMessage('agent', 'No papers are currently loaded as context.');
      return;
    }
    
    if (!confirm(`Unload all ${loadedCount} loaded ${loadedCount === 1 ? 'paper' : 'papers'}?`)) {
      return;
    }
    
    // Clear all contexts
    this.loadedContexts = {};
    
    // Update UI
    this.renderPapers();
    this.updateLoadedContextsUI();
    
    this.addMessage('agent', `All ${loadedCount} ${loadedCount === 1 ? 'paper has' : 'papers have'} been unloaded. No papers are currently loaded as context.`);
  }

  summarizeContext(text) {
    // Get first 500 characters and clean up
    const preview = text.substring(0, 500).replace(/\s+/g, ' ').trim();
    if (text.length > 500) {
      return preview + '...';
    }
    return preview;
  }

  showPaperDetails(paper) {
    const forumId = paper.forum || 'N/A';
    const pdfUrl = forumId !== 'N/A' ? `https://openreview.net/pdf/${forumId}.pdf` : (paper.pdf || 'N/A');
    
    const details = `
**Paper Details:**
- **Title**: ${paper.title || 'N/A'}
- **Venue**: ${paper.venue || 'N/A'}
- **Presentation**: ${paper.presentation || 'N/A'}
- **Authors**: ${paper.authors ? paper.authors.join(', ') : 'N/A'}
- **Abstract**: ${paper.abstract ? this.cleanAbstract(paper.abstract).substring(0, 500) + '...' : 'N/A'}
- **PDF URL**: ${pdfUrl}
- **Forum ID**: ${forumId}

${forumId !== 'N/A' ? 'Use the ⬇️ button to download the PDF or 📄 button to load it as context!' : ''}
    `;
    
    this.addMessage('agent', details);
  }

  updatePaperCount() {
    const total = this.papers.length;
    const filtered = this.filteredPapers.length;
    
    if (filtered === total) {
      this.paperCount.textContent = `${total} papers`;
    } else {
      this.paperCount.textContent = `${filtered} of ${total} papers`;
    }
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    if (this.papers.length === 0) {
      alert('Please load papers first');
      return;
    }

    // Add user message
    this.addMessage('user', message);
    this.chatInput.value = '';

    // Show thinking indicator
    const thinkingId = this.addMessage('agent', 'Thinking...', true);

    // Process the question - use Gemini if API key is available
    const loadedContexts = Object.keys(this.loadedContexts);
    
    // Always use Gemini if API key is set (even without context)
    if (this.useGemini && this.geminiApiKey) {
      try {
        const contexts = loadedContexts.length > 0 
          ? loadedContexts.map(id => this.loadedContexts[id])
          : null;
        
        const result = await window.electronAPI.callGemini({
          apiKey: this.geminiApiKey,
          prompt: message,
          context: contexts
        });
        
        if (result.error) {
          this.updateMessage(thinkingId, `Error: ${result.error}\n\nFalling back to local analysis...`);
          // Fallback to local processing
          setTimeout(() => {
            const response = this.processQuestion(message);
            this.updateMessage(thinkingId, response);
          }, 500);
        } else {
          // Display Gemini response naturally (no special formatting)
          this.updateMessage(thinkingId, result.text);
        }
      } catch (error) {
        console.error('Error calling Gemini:', error);
        this.updateMessage(thinkingId, `Error calling Gemini: ${error.message}\n\nFalling back to local analysis...`);
        // Fallback to local processing
        setTimeout(() => {
          const response = this.processQuestion(message);
          this.updateMessage(thinkingId, response);
        }, 500);
      }
    } else {
      // Use local processing (no API key or Gemini disabled)
      setTimeout(() => {
        const response = this.processQuestion(message);
        this.updateMessage(thinkingId, response);
      }, 500);
    }
  }
  
  async loadApiKey() {
    try {
      if (window.electronAPI && window.electronAPI.loadApiKey) {
        const result = await window.electronAPI.loadApiKey();
        if (result.apiKey) {
          this.geminiApiKey = result.apiKey;
          this.useGemini = true;
          // Don't show the actual key in the input, just indicate it's saved
          this.geminiApiKeyInput.placeholder = 'API key saved ✓ (enter new key to change)';
          this.geminiApiKeyInput.value = '';
          this.geminiApiKeyInput.type = 'password'; // Keep it as password field
          // Show saved indicator
          if (this.apiKeySavedIndicator) {
            this.apiKeySavedIndicator.style.display = 'block';
          }
          console.log('API key loaded successfully from saved configuration');
        } else {
          // No saved key
          this.geminiApiKeyInput.placeholder = 'Enter your Gemini API key...';
          this.geminiApiKeyInput.type = 'password';
          if (this.apiKeySavedIndicator) {
            this.apiKeySavedIndicator.style.display = 'none';
          }
        }
      }
    } catch (error) {
      console.error('Error loading API key:', error);
      this.geminiApiKeyInput.placeholder = 'Enter your Gemini API key...';
      if (this.apiKeySavedIndicator) {
        this.apiKeySavedIndicator.style.display = 'none';
      }
    }
  }
  
  async saveApiKey() {
    const apiKey = this.geminiApiKeyInput.value.trim();
    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }

    try {
      if (window.electronAPI && window.electronAPI.saveApiKey) {
        const result = await window.electronAPI.saveApiKey(apiKey);
        if (result.error) {
          alert('Error saving API key: ' + result.error);
        } else {
          // Save to memory and persist to disk
          this.geminiApiKey = apiKey;
          this.useGemini = true;
          this.geminiApiKeyInput.value = '';
          this.geminiApiKeyInput.placeholder = 'API key saved ✓ (enter new key to change)';
          this.geminiApiKeyInput.type = 'password';
          // Show saved indicator
          if (this.apiKeySavedIndicator) {
            this.apiKeySavedIndicator.style.display = 'block';
          }
          console.log('API key saved successfully');
          this.addMessage('agent', '✓ Gemini API key saved successfully! The key is now stored and will be loaded automatically on startup. The agent will use Gemini for responses.');
        }
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Error saving API key: ' + error.message);
    }
  }

  toggleSettingsPanel() {
    this.settingsExpanded = !this.settingsExpanded;
    
    if (this.settingsExpanded) {
      this.settingsContent.style.display = 'block';
      this.toggleSettingsBtn.textContent = '▼';
      this.toggleSettingsBtn.title = 'Collapse';
    } else {
      this.settingsContent.style.display = 'none';
      this.toggleSettingsBtn.textContent = '▶';
      this.toggleSettingsBtn.title = 'Expand';
    }
  }

  async findRelevantPapersFromThesis() {
    // Get thesis content from the thesis editor
    const thesisEditor = document.getElementById('thesis-editor');
    if (!thesisEditor) {
      this.addMessage('agent', 'Error: Could not find thesis editor. Make sure you are on the Thesis Editor tab.');
      return;
    }

    // Get plain text from thesis (strip HTML)
    const thesisText = this.getPlainTextFromElement(thesisEditor);
    
    if (!thesisText || thesisText.trim().length < 50) {
      this.addMessage('agent', 'Your thesis appears to be empty or too short. Please write some content in the thesis editor first.');
      return;
    }

    if (this.papers.length === 0) {
      this.addMessage('agent', 'Please load papers first by selecting a dataset and clicking "Load Papers".');
      return;
    }

    if (!this.geminiApiKey) {
      this.addMessage('agent', 'Please set your Gemini API key in Settings first. Embedding-based search requires an API key.');
      return;
    }

    // Show searching message
    const searchingId = this.addMessage('agent', 'Computing embeddings and searching for relevant papers...', true);

    try {
      // Get or compute thesis embedding
      this.updateMessage(searchingId, 'Step 1/3: Computing thesis embedding...');
      const thesisEmbedding = await this.getOrComputeThesisEmbedding(thesisText);
      if (!thesisEmbedding) {
        this.updateMessage(searchingId, 'Error: Failed to compute thesis embedding. Please check your API key.');
        return;
      }

      // Get or compute paper embeddings with progress callback (only for filtered papers)
      let cachedCount = 0;
      const papersToSearch = this.filteredPapers.length > 0 ? this.filteredPapers : this.papers;
      const progressCallback = (current, total, percentage, fromCache = 0) => {
        const message = fromCache > 0 
          ? `Step 2/3: Computing embeddings for ${papersToSearch.length} papers... (${fromCache} cached, ${current - fromCache} computed)`
          : `Step 2/3: Computing embeddings for ${papersToSearch.length} papers...`;
        this.updateMessageWithProgress(searchingId, message, current, total, percentage);
      };
      const paperEmbeddings = await this.getOrComputePaperEmbeddings(progressCallback, papersToSearch);
      if (!paperEmbeddings || paperEmbeddings.length === 0) {
        this.updateMessage(searchingId, 'Error: Failed to compute paper embeddings.');
        return;
      }

      // Compute similarity scores
      this.updateMessage(searchingId, 'Step 3/3: Computing similarity scores...');
      const relevantPapers = this.computeSimilarityScores(thesisEmbedding, paperEmbeddings);
      
      // Display results
      this.displayRelevantPapers(relevantPapers, searchingId);
    } catch (error) {
      console.error('Error in semantic search:', error);
      this.updateMessage(searchingId, `Error: ${error.message}`);
    }
  }

  async getOrComputeThesisEmbedding(thesisText) {
    // Compute content hash for cache validation
    const contentHash = this.computeHash(thesisText);
    
    // Check cache first
    if (window.electronAPI && window.electronAPI.loadEmbeddings) {
      const cached = await window.electronAPI.loadEmbeddings({ type: 'thesis' });
      if (cached.success && cached.embeddings && cached.embeddings.length > 0) {
        const cachedItem = cached.embeddings[0];
        // Check if cached embedding matches current thesis by hash
        if (cachedItem.contentHash === contentHash) {
          return cachedItem.embedding;
        }
      }
    }

    // Compute new embedding
    if (window.electronAPI && window.electronAPI.getEmbeddings) {
      const result = await window.electronAPI.getEmbeddings({
        apiKey: this.geminiApiKey,
        texts: [thesisText]
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.embeddings && result.embeddings.length > 0) {
        const embedding = result.embeddings[0];
        
        // Cache the embedding with content hash
        if (window.electronAPI && window.electronAPI.saveEmbeddings) {
          await window.electronAPI.saveEmbeddings({
            dataset: 'thesis',
            type: 'thesis',
            embeddings: [{
              text: thesisText.substring(0, 100),
              embedding: embedding,
              contentHash: contentHash
            }]
          });
        }

        return embedding;
      }
    }

    return null;
  }

  computeHash(text) {
    // Simple hash function for cache validation
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  async getOrComputePaperEmbeddings(progressCallback = null, papersToProcess = null) {
    // progressCallback signature: (current, total, percentage, fromCache)
    // papersToProcess: optional array of papers to process (defaults to all papers)
    if (!this.currentDataset) {
      return null;
    }

    // Use provided papers or default to all papers
    const targetPapers = papersToProcess || this.papers;
    
    // Create a map of target papers by forum ID for quick lookup
    const targetPapersMap = new Map();
    targetPapers.forEach((paper, idx) => {
      const forumId = paper.forum || `index_${idx}`;
      targetPapersMap.set(forumId, { paper, originalIndex: this.papers.findIndex(p => p.forum === paper.forum) });
    });

    // Load cached embeddings and create a map by forum ID
    const cachedEmbeddingsMap = new Map();
    let cachedCount = 0;
    
    if (window.electronAPI && window.electronAPI.loadEmbeddings) {
      const cached = await window.electronAPI.loadEmbeddings({
        dataset: this.currentDataset,
        type: 'papers'
      });

      if (cached.success && cached.embeddings) {
        // Build a map of cached embeddings by forum ID (only for target papers)
        cached.embeddings.forEach(item => {
          let forumId = null;
          if (item.forumId) {
            forumId = item.forumId;
          } else if (item.paperIndex !== undefined && this.papers[item.paperIndex]) {
            // Fallback: use paperIndex if forumId not available
            const paper = this.papers[item.paperIndex];
            forumId = paper.forum || `index_${item.paperIndex}`;
          }
          
          // Only include if this paper is in our target set
          if (forumId && targetPapersMap.has(forumId)) {
            cachedEmbeddingsMap.set(forumId, item);
          }
        });
        cachedCount = cachedEmbeddingsMap.size;
      }
    }

    // Identify papers that need embeddings (only from target papers)
    const papersToCompute = [];
    const papersToComputeIndices = [];
    
    targetPapers.forEach((paper, idx) => {
      const forumId = paper.forum || `index_${idx}`;
      if (!cachedEmbeddingsMap.has(forumId)) {
        papersToCompute.push(paper);
        // Find original index in this.papers array
        const originalIndex = this.papers.findIndex(p => p.forum === paper.forum);
        papersToComputeIndices.push(originalIndex !== -1 ? originalIndex : idx);
      }
    });

    // If all target papers are cached, return immediately
    if (papersToCompute.length === 0) {
      if (progressCallback) {
        progressCallback(targetPapers.length, targetPapers.length, 100, cachedCount);
      }
      
      // Map cached embeddings back to target papers
      return targetPapers.map((paper, idx) => {
        const forumId = paper.forum || `index_${idx}`;
        const cached = cachedEmbeddingsMap.get(forumId);
        const originalIndex = this.papers.findIndex(p => p.forum === paper.forum);
        const paperIndex = originalIndex !== -1 ? originalIndex : idx;
        
        if (cached) {
          return {
            paperIndex: paperIndex,
            paper: paper,
            text: cached.text || '',
            embedding: cached.embedding
          };
        }
        return null;
      }).filter(item => item !== null);
    }

    // Show resuming message if we have cached embeddings
    if (cachedCount > 0 && progressCallback) {
      progressCallback(cachedCount, targetPapers.length, Math.round((cachedCount / targetPapers.length) * 100), cachedCount);
      // Small delay to show the resuming state
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Compute embeddings only for missing papers
    const allEmbeddings = [];
    
    // First, add all cached embeddings for target papers
    targetPapers.forEach((paper, idx) => {
      const forumId = paper.forum || `index_${idx}`;
      const cached = cachedEmbeddingsMap.get(forumId);
      const originalIndex = this.papers.findIndex(p => p.forum === paper.forum);
      const paperIndex = originalIndex !== -1 ? originalIndex : idx;
      
      if (cached) {
        allEmbeddings.push({
          paperIndex: paperIndex,
          paper: paper,
          text: cached.text || '',
          embedding: cached.embedding
        });
      }
    });

    // Compute embeddings for missing papers
    if (window.electronAPI && window.electronAPI.getEmbeddings && papersToCompute.length > 0) {
      // Prepare texts: title + abstract for each paper that needs computing
      const texts = papersToCompute.map(paper => {
        const title = paper.title || '';
        const abstract = paper.abstract || '';
        return `${title}\n\n${abstract}`.trim();
      });

      // Get embeddings in batches to avoid API limits
      const batchSize = 10;
      const totalBatches = Math.ceil(texts.length / batchSize);
      let computedCount = 0;
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchIndices = papersToComputeIndices.slice(i, i + batchSize);
        
        const result = await window.electronAPI.getEmbeddings({
          apiKey: this.geminiApiKey,
          texts: batch
        });

        if (result.error) {
          throw new Error(result.error);
        }

        if (result.embeddings) {
          // Map embeddings back to papers with metadata
          result.embeddings.forEach((embedding, idx) => {
            const paperIndex = batchIndices[idx];
            const paper = this.papers[paperIndex];
            const forumId = paper.forum || `index_${paperIndex}`;
            
            allEmbeddings.push({
              paperIndex: paperIndex,
              paper: paper,
              text: batch[idx],
              embedding: embedding
            });
            
            computedCount++;
          });
        }

        // Update progress callback
        if (progressCallback) {
          const totalProcessed = cachedCount + computedCount;
          const percentage = Math.round((totalProcessed / targetPapers.length) * 100);
          progressCallback(totalProcessed, targetPapers.length, percentage, cachedCount);
        }

        // Small delay to avoid rate limiting
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Cache all embeddings (cached + newly computed)
      // Note: We save all embeddings from the full dataset cache, not just target papers
      // This ensures we maintain the full cache for future use
      if (window.electronAPI && window.electronAPI.saveEmbeddings) {
        // Load full cache to merge with new embeddings
        const fullCache = await window.electronAPI.loadEmbeddings({
          dataset: this.currentDataset,
          type: 'papers'
        });
        
        const fullCacheMap = new Map();
        if (fullCache.success && fullCache.embeddings) {
          fullCache.embeddings.forEach(item => {
            const forumId = item.forumId || (item.paperIndex !== undefined && this.papers[item.paperIndex] 
              ? (this.papers[item.paperIndex].forum || `index_${item.paperIndex}`) 
              : null);
            if (forumId) {
              fullCacheMap.set(forumId, item);
            }
          });
        }
        
        // Add newly computed embeddings to the cache map
        allEmbeddings.forEach(item => {
          const forumId = item.paper.forum || `index_${item.paperIndex}`;
          fullCacheMap.set(forumId, {
            forumId: forumId,
            text: item.text.substring(0, 200),
            embedding: item.embedding,
            paperIndex: item.paperIndex
          });
        });
        
        // Save the complete cache (all papers, not just target)
        const embeddingsToSave = Array.from(fullCacheMap.values());
        
        await window.electronAPI.saveEmbeddings({
          dataset: this.currentDataset,
          type: 'papers',
          embeddings: embeddingsToSave
        });
      }
    }

    // Return embeddings for target papers only
    return allEmbeddings.filter(item => item !== null && item !== undefined);
  }

  computeSimilarityScores(thesisEmbedding, paperEmbeddings) {
    const scoredPapers = paperEmbeddings.map(item => {
      const similarity = this.cosineSimilarity(thesisEmbedding, item.embedding);
      return {
        paper: item.paper,
        score: similarity,
        index: item.paperIndex
      };
    })
    .filter(item => item.score > 0) // Only papers with positive similarity
    .sort((a, b) => b.score - a.score) // Sort by similarity (higher is better)
    .slice(0, 20); // Top 20 most relevant

    return scoredPapers;
  }

  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      console.error('Vector length mismatch:', vecA.length, vecB.length);
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  getPlainTextFromElement(element) {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);
    
    // Remove images and figures (keep only text)
    clone.querySelectorAll('figure, img').forEach(el => el.remove());
    
    // Get text content
    return clone.textContent || clone.innerText || '';
  }

  cleanAbstract(abstract) {
    if (!abstract) return abstract;
    
    // Remove LaTeX math delimiters
    let cleaned = abstract
      // Remove block math $$...$$
      .replace(/\$\$[\s\S]*?\$\$/g, '')
      // Remove inline math $...$
      .replace(/\$[^$]*?\$/g, '')
      // Remove LaTeX math environments \(...\) and \[...\]
      .replace(/\\\([\s\S]*?\\\)/g, '')
      .replace(/\\\[[\s\S]*?\\\]/g, '')
      // Remove LaTeX commands (backslash followed by letters)
      .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1') // \command{content} -> content
      .replace(/\\[a-zA-Z]+/g, '') // Remove standalone commands
      // Remove LaTeX special characters but keep the content
      .replace(/\{|\}/g, '') // Remove braces
      .replace(/\^/g, '') // Remove superscript markers
      .replace(/_/g, ' ') // Replace subscript markers with space
      .replace(/`/g, '') // Remove backticks
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  }


  displayRelevantPapers(relevantPapers, messageId) {
    if (relevantPapers.length === 0) {
      this.updateMessage(messageId, `
**No Relevant Papers Found**

I couldn't find papers that match your thesis content. Try:
- Adding more content to your thesis
- Using more specific technical terms
- Loading a different dataset
      `);
      return;
    }

    // Automatically add abstracts to context
    relevantPapers.forEach((item) => {
      const paper = item.paper;
      const forumId = paper.forum || `index_${item.index}`;
      
      // Only add if not already loaded (as full paper)
      if (!this.loadedContexts[forumId] || this.loadedContexts[forumId].type === 'abstract') {
        const abstract = this.cleanAbstract(paper.abstract || 'No abstract available');
        const title = paper.title || 'Untitled';
        
        this.loadedContexts[forumId] = {
          title: title,
          text: `Title: ${title}\n\nAbstract:\n${abstract}`,
          type: 'abstract',
          loadedAt: new Date().toISOString(),
          forumId: forumId,
          paper: paper
        };
      }
    });

    // Update UI to show loaded contexts
    this.updateLoadedContextsUI();

    // Build response with full abstracts - add unique text markers for button insertion
    let response = `**Found ${relevantPapers.length} Relevant Papers Based on Your Thesis:**\n\n`;
    response += `*Abstracts have been automatically added to context. You can download PDFs or load full papers below.*\n\n`;
    
    relevantPapers.forEach((item, idx) => {
      const paper = item.paper;
      const forumId = paper.forum || `index_${item.index}`;
      const title = paper.title || 'Untitled';
      const abstract = this.cleanAbstract(paper.abstract || 'No abstract available');
      const venue = paper.venue || 'Unknown venue';
      
      const similarityPercent = (item.score * 100).toFixed(1);
      response += `${idx + 1}. **${title}** (Similarity: ${similarityPercent}%)\n`;
      response += `   ${venue}\n`;
      response += `   **Abstract:** ${abstract}\n`;
      // Add a unique text marker on its own line for easier insertion
      response += `\n   [PAPER_BUTTON_MARKER_${idx}_${forumId.substring(0, 8)}]\n\n`;
    });
    
    response += `\n*The paper list has been filtered to show these relevant papers.*`;
    
    this.updateMessage(messageId, response);
    
    // Add buttons right after each abstract using the text markers
    setTimeout(() => {
      const messageDiv = document.getElementById(messageId);
      if (messageDiv) {
        const contentDiv = messageDiv.querySelector('.message-content');
        if (contentDiv) {
          // Process papers in order, but track inserted buttons to avoid duplicates
          const insertedButtons = new Set();
          
          relevantPapers.forEach((item, idx) => {
            const paper = item.paper;
            const forumId = paper.forum || `index_${item.index}`;
            const title = paper.title || 'Untitled';
            const abstract = this.cleanAbstract(paper.abstract || '');
            const hasForumId = forumId && forumId.length > 0 && !forumId.startsWith('index_');
            
            if (hasForumId && abstract) {
              // Find the marker text in the DOM
              const markerPattern = `PAPER_BUTTON_MARKER_${idx}_${forumId.substring(0, 8)}`;
              const fullMarker = `[${markerPattern}]`;
              const walker = document.createTreeWalker(
                contentDiv,
                NodeFilter.SHOW_TEXT,
                null,
                false
              );
              
              let textNode = null;
              let found = false;
              
              // First, find and remove all markers
              while (textNode = walker.nextNode()) {
                if (textNode.textContent.includes(markerPattern)) {
                  found = true;
                  const parentElement = textNode.parentElement;
                  
                  // Remove the marker from text
                  textNode.textContent = textNode.textContent.replace(fullMarker, '').trim();
                  
                  // Only insert button if we haven't inserted one for this paper yet
                  if (!insertedButtons.has(idx)) {
                    // Create button container
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'paper-action-buttons-inline';
                    buttonContainer.style.marginTop = '0.5rem';
                    buttonContainer.style.marginBottom = '1rem';
                    buttonContainer.style.paddingLeft = '0';
                    
                    const loadBtn = document.createElement('button');
                    loadBtn.className = 'btn-inline btn-load-full-paper';
                    loadBtn.setAttribute('data-forum', forumId);
                    loadBtn.setAttribute('data-title', title);
                    loadBtn.textContent = '📄 Load Full Paper';
                    
                    buttonContainer.appendChild(loadBtn);
                    
                    // Insert button container right after the parent element containing the marker
                    if (parentElement && parentElement.parentNode) {
                      parentElement.parentNode.insertBefore(buttonContainer, parentElement.nextSibling);
                      insertedButtons.add(idx);
                    } else if (parentElement) {
                      // If no parent, append to contentDiv
                      contentDiv.appendChild(buttonContainer);
                      insertedButtons.add(idx);
                    }
                  }
                  
                  break; // Found and processed, move to next paper
                }
              }
              
              if (!found) {
                console.warn(`Could not find marker for paper ${idx}: ${title}`);
              }
            } else {
              // Remove marker even if no button
              const markerPattern = `PAPER_BUTTON_MARKER_${idx}_`;
              const fullMarkerPattern = new RegExp(`\\[${markerPattern}[^\\]]+\\]`, 'g');
              const walker = document.createTreeWalker(
                contentDiv,
                NodeFilter.SHOW_TEXT,
                null,
                false
              );
              
              let textNode = null;
              while (textNode = walker.nextNode()) {
                if (textNode.textContent.includes(markerPattern)) {
                  textNode.textContent = textNode.textContent.replace(fullMarkerPattern, '').trim();
                  break;
                }
              }
            }
          });
          
          // Add event listeners for load buttons
          // Load full paper buttons
          contentDiv.querySelectorAll('.btn-load-full-paper').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const forumId = btn.getAttribute('data-forum');
              const title = btn.getAttribute('data-title');
              
              // Update button state
              btn.disabled = true;
              btn.textContent = '📄 Loading...';
              
              // Find paper index
              let paperIndex = this.filteredPapers.findIndex(p => p.forum === forumId);
              if (paperIndex === -1) {
                // Try all papers
                paperIndex = this.papers.findIndex(p => p.forum === forumId);
              }
              
              let result = null;
              if (paperIndex !== -1) {
                result = await this.loadPDFContext(forumId, paperIndex, true);
              } else {
                // Use context's paper data if available
                const context = this.loadedContexts[forumId];
                if (context && context.paper) {
                  const tempIndex = this.filteredPapers.length;
                  this.filteredPapers.push(context.paper);
                  result = await this.loadPDFContext(forumId, tempIndex, true);
                  this.filteredPapers.pop();
                }
              }
              
              // Update button state based on result
              if (result && result.success) {
                btn.textContent = '✓ Loaded';
                btn.style.backgroundColor = '#27ae60';
                // Button will stay in loaded state since context is now loaded
              } else {
                btn.textContent = '📄 Load Full Paper';
                btn.disabled = false;
                // Show error in button tooltip or console
                console.error('Load failed:', result?.error);
              }
            });
          });
        }
      }
    }, 200);
    
    // Also update the paper list to show these papers
    // Filter to show only relevant papers
    this.filteredPapers = relevantPapers.map(item => item.paper);
    this.renderPapers();
    
    // Update search input to show we're filtering
    this.searchInput.value = 'Relevant to thesis';
    this.updatePaperCount();
  }

  processQuestion(question) {
    const lowerQuestion = question.toLowerCase();

    // Check if we have loaded contexts - prioritize context-aware responses
    const loadedPapers = Object.keys(this.loadedContexts);
    if (loadedPapers.length > 0) {
      // Always use context if papers are loaded (multiple papers are supported)
      return this.answerWithContext(question, loadedPapers);
    }

    // Analyze question type and generate response
    if (lowerQuestion.includes('trend') || lowerQuestion.includes('main topic') || lowerQuestion.includes('research direction')) {
      return this.analyzeTrends();
    } else if (lowerQuestion.includes('find') || lowerQuestion.includes('search') || lowerQuestion.includes('related to')) {
      return this.searchRelatedPapers(question);
    } else if (lowerQuestion.includes('compare') || lowerQuestion.includes('difference')) {
      return this.comparePapers(question);
    } else if (lowerQuestion.includes('idea') || lowerQuestion.includes('unexplored') || lowerQuestion.includes('gap')) {
      return this.generateIdeas();
    } else if (lowerQuestion.includes('summary') || lowerQuestion.includes('overview')) {
      return this.getSummary();
    } else {
      return this.genericResponse(question);
    }
  }

  hasPaperContext(question) {
    // Check if question mentions loaded papers
    const loadedPapers = Object.keys(this.loadedContexts);
    return loadedPapers.some(forumId => {
      const context = this.loadedContexts[forumId];
      const titleWords = context.title.toLowerCase().split(/\s+/);
      return titleWords.some(word => word.length > 3 && question.includes(word));
    });
  }

  answerWithContext(question, loadedForumIds) {
    // Use loaded PDF context to answer questions (supports multiple papers)
    const contexts = loadedForumIds.map(id => this.loadedContexts[id]);
    
    const papersCount = contexts.length;
    let response = `**Answering based on ${papersCount} loaded ${papersCount === 1 ? 'paper' : 'papers'}:**\n\n`;
    
    contexts.forEach((context, idx) => {
      const paperTitle = context.title;
      const text = context.text.toLowerCase();
      const questionLower = question.toLowerCase();
      
      // Simple keyword matching to find relevant sections
      const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);
      const relevantSections = this.findRelevantSections(text, questionWords);
      
      const contextType = context.type === 'abstract' ? 'Abstract Only' : 'Full Paper';
      const pageInfo = context.numPages ? ` (${context.numPages} pages)` : '';
      
      if (papersCount > 1) {
        response += `### Paper ${idx + 1}: ${paperTitle}${pageInfo} - ${contextType}\n\n`;
      } else {
        response += `**${paperTitle}**${pageInfo} - ${contextType}:\n\n`;
      }
      
      if (relevantSections.length > 0) {
        response += `Based on this paper's content:\n\n`;
        relevantSections.slice(0, 3).forEach((section, i) => {
          const cleanedSection = section.trim().substring(0, 300);
          response += `${i + 1}. ${cleanedSection}${section.length > 300 ? '...' : ''}\n\n`;
        });
      } else {
        // General summary if no specific matches
        const summary = this.extractKeyPoints(text);
        response += `Key points from this paper:\n${summary}\n\n`;
      }
      
      if (idx < contexts.length - 1) {
        response += '---\n\n';
      }
    });
    
    if (papersCount > 1) {
      response += `\n*Note: Responses combine information from ${papersCount} papers. This is based on extracted PDF text. For detailed analysis, refer to the full papers.*`;
    } else {
      response += `\n*Note: This is based on extracted PDF text. For detailed analysis, refer to the full paper.*`;
    }
    
    return response;
  }

  findRelevantSections(text, keywords) {
    // Find sentences or paragraphs containing the keywords
    const sentences = text.split(/[.!?]\s+/);
    const relevant = [];
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const matchCount = keywords.filter(kw => lowerSentence.includes(kw)).length;
      
      if (matchCount >= Math.min(2, keywords.length)) {
        relevant.push(sentence.trim());
      }
    });
    
    // Return top 5 most relevant sections
    return relevant.slice(0, 5);
  }

  extractKeyPoints(text) {
    // Extract first few paragraphs as key points
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    const keyPoints = paragraphs.slice(0, 3).map((p, i) => {
      const cleaned = p.trim().substring(0, 200).replace(/\s+/g, ' ');
      return `${i + 1}. ${cleaned}...`;
    });
    
    return keyPoints.join('\n');
  }

  analyzeTrends() {
    // Extract keywords from paper titles and abstracts
    const keywords = {};
    const presentationTypes = {};
    
    this.filteredPapers.forEach(paper => {
      // Count presentation types
      if (paper.presentation) {
        presentationTypes[paper.presentation] = (presentationTypes[paper.presentation] || 0) + 1;
      }

      // Extract common keywords from titles
      if (paper.title) {
        const words = paper.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
          // Filter out common stop words
          if (word.length > 4 && !['paper', 'learning', 'model', 'method', 'approach', 'using', 'with', 'from', 'that', 'this'].includes(word)) {
            keywords[word] = (keywords[word] || 0) + 1;
          }
        });
      }
    });

    // Get top keywords
    const topKeywords = Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => `${word} (${count})`)
      .join(', ');

    const presentationStats = Object.entries(presentationTypes)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ') || 'No presentation data available';

    return `
**Main Trends in ${this.currentDataset}:**

**Top Keywords:** ${topKeywords}

**Presentation Types:**
${presentationStats}

**Analysis:**
Based on ${this.filteredPapers.length} papers, the main research directions appear to focus on the topics mentioned above. Consider exploring intersections between these areas for novel research ideas.
    `;
  }

  searchRelatedPapers(question) {
    // Extract keywords from question
    const keywords = question.toLowerCase()
      .replace(/find|search|papers|related|to|about/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    // Find matching papers
    const matchingPapers = this.filteredPapers
      .map((paper, index) => {
        let score = 0;
        const title = (paper.title || '').toLowerCase();
        const abstract = (paper.abstract || '').toLowerCase();

        keywords.forEach(keyword => {
          if (title.includes(keyword)) score += 3;
          if (abstract.includes(keyword)) score += 1;
        });

        return { paper, score, index };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (matchingPapers.length === 0) {
      return `No papers found matching "${question}". Try different keywords or load a different dataset.`;
    }

    const paperList = matchingPapers.map(({ paper, score }, idx) => {
      return `${idx + 1}. **${paper.title || 'Untitled'}** (relevance: ${score})\n   ${paper.venue || 'Unknown venue'}\n   ${paper.abstract ? this.cleanAbstract(paper.abstract).substring(0, 200) + '...' : 'No abstract'}`;
    }).join('\n\n');

    return `
**Found ${matchingPapers.length} related papers:**

${paperList}

**Suggested Next Steps:**
- Review these papers to understand current approaches
- Identify gaps or limitations in existing methods
- Consider combining techniques from multiple papers
    `;
  }

  comparePapers(question) {
    // For now, return a general comparison based on presentation types and keywords
    const oralPapers = this.filteredPapers.filter(p => p.presentation === 'Oral');
    const spotlightPapers = this.filteredPapers.filter(p => p.presentation === 'Spotlight');
    const posterPapers = this.filteredPapers.filter(p => p.presentation === 'Poster');

    return `
**Comparison Analysis:**

**Oral Presentations (${oralPapers.length} papers):**
These typically represent the most significant contributions. Review these for cutting-edge methods.

**Spotlight Presentations (${spotlightPapers.length} papers):**
These often showcase interesting approaches or novel applications worth exploring.

**Poster Presentations (${posterPapers.length} papers):**
These may contain practical applications or extensions of existing methods.

**Research Strategy:**
- Start with Oral papers to understand current state-of-the-art
- Review Spotlight papers for emerging ideas
- Use Poster papers for practical insights and applications
    `;
  }

  generateIdeas() {
    // Generate research ideas based on papers
    const allKeywords = {};
    
    this.filteredPapers.forEach(paper => {
      if (paper.title) {
        const words = paper.title.toLowerCase().match(/\b\w{5,}\b/g) || [];
        words.forEach(word => {
          if (!['paper', 'learning', 'model', 'method', 'approach', 'using'].includes(word)) {
            allKeywords[word] = (allKeywords[word] || 0) + 1;
          }
        });
      }
    });

    const topKeywords = Object.entries(allKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return `
**Research Ideas Based on Current Papers:**

1. **Interdisciplinary Approach**: Combine techniques from different areas. For example, explore how ${topKeywords[0]} can be applied to ${topKeywords[1]}.

2. **Extension Research**: Many papers present initial results. Consider:
   - Extending these methods to new domains
   - Improving scalability or efficiency
   - Addressing limitations mentioned in the papers

3. **Underexplored Combinations**: Look for pairs of concepts that haven't been combined yet:
   - ${topKeywords[2]} + ${topKeywords[3]}
   - ${topKeywords[0]} + ${topKeywords[4]}

4. **Practical Applications**: Many theoretical papers lack real-world validation. Consider:
   - Implementing and testing in production environments
   - Adapting for specific industries or use cases
   - Creating open-source tools based on these methods

5. **Methodology Improvements**: Review papers that use similar approaches and identify:
   - Common failure modes
   - Scalability bottlenecks
   - Evaluation limitations

**Action Items:**
- Pick 2-3 related papers to deeply study
- Identify their limitations and assumptions
- Brainstorm how to address these gaps
    `;
  }

  getSummary() {
    const venueCounts = {};
    const presentationCounts = {};
    
    this.filteredPapers.forEach(paper => {
      if (paper.venue) {
        venueCounts[paper.venue] = (venueCounts[paper.venue] || 0) + 1;
      }
      if (paper.presentation) {
        presentationCounts[paper.presentation] = (presentationCounts[paper.presentation] || 0) + 1;
      }
    });

    return `
**Dataset Summary: ${this.currentDataset}**

- **Total Papers**: ${this.filteredPapers.length}
- **Presentation Types**: ${Object.entries(presentationCounts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A'}
- **Unique Venues**: ${Object.keys(venueCounts).length}

**Top Venues:**
${Object.entries(venueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([venue, count]) => `- ${venue}: ${count} papers`).join('\n')}

Use specific questions to dive deeper into the papers!
    `;
  }

  genericResponse(question) {
    return `
I understand you're asking: "${question}"

Based on the ${this.filteredPapers.length} papers loaded, here are some ways I can help:

1. **Trend Analysis**: Ask "What are the main trends?" to see what topics are popular
2. **Paper Search**: Ask "Find papers related to [topic]" to search for specific papers
3. **Ideas**: Ask "Generate research ideas" to get suggestions for new research directions
4. **Comparison**: Ask "Compare different approaches" to see how methods differ

Try one of these queries, or ask a more specific question about the papers!
    `;
  }

  addMessage(sender, content, isTemporary = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const id = isTemporary ? `temp-${Date.now()}` : null;
    if (id) messageDiv.id = id;

    // Format content (simple markdown-like formatting)
    const formattedContent = this.formatMessage(content);

    messageDiv.innerHTML = `
      <div class="message-header">${sender === 'user' ? 'You' : 'Research Agent'}</div>
      <div class="message-content">${formattedContent}</div>
    `;

    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    // Remove welcome message if it exists
    const welcomeMsg = this.chatMessages.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    return id;
  }

  updateMessage(messageId, newContent) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
      const contentDiv = messageDiv.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.innerHTML = this.formatMessage(newContent);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      }
    }
  }

  updateMessageWithProgress(messageId, message, current, total, percentage) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
      const contentDiv = messageDiv.querySelector('.message-content');
      if (contentDiv) {
        const escapedMessage = this.escapeHtml(message);
        const progressBarHtml = `
          <div style="margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <span style="font-size: 0.9rem; color: #666;">${escapedMessage}</span>
              <span style="font-size: 0.9rem; color: #666; font-weight: 600;">${percentage}%</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <div style="font-size: 0.85rem; color: #888; margin-top: 0.25rem;">
              Processed ${current} of ${total} papers
            </div>
          </div>
        `;
        contentDiv.innerHTML = progressBarHtml;
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      }
    }
  }

  formatMessage(content) {
    // Natural markdown formatting for conversational chat
    let formatted = this.escapeHtml(content);
    
    // Bold text (**text**)
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text (*text*)
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Code blocks (```code```)
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code (`code`)
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Lists (lines starting with - or *)
    formatted = formatted.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Numbered lists
    formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    
    // Line breaks - preserve paragraphs (double line breaks)
    formatted = formatted.replace(/\n\n+/g, '</p><p>');
    formatted = formatted.replace(/\n/g, '<br>');
    formatted = '<p>' + formatted + '</p>';
    
    return formatted;
  }

  clearChat() {
    if (confirm('Clear chat history?')) {
      this.chatMessages.innerHTML = `
        <div class="welcome-message">
          <h2>Research Agent</h2>
          <p>Ask questions about recent papers to generate research ideas!</p>
          <p>Example questions:</p>
          <ul>
            <li>"What are the main trends in ICLR 2025?"</li>
            <li>"Find papers related to transformer architectures"</li>
            <li>"What are some unexplored research directions?"</li>
            <li>"Compare different approaches to few-shot learning"</li>
          </ul>
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize agent when DOM is ready
let researchAgent;
document.addEventListener('DOMContentLoaded', () => {
  researchAgent = new ResearchAgent();
});

