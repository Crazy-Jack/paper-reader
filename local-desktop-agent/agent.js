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
    this.mode = 'ask'; // 'ask', 'edit', or 'search' mode
    
    this.init();
    this.loadApiKey();
    this.loadDeepResearchKeys();
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
    this.firecrawlApiKeyInput = document.getElementById('firecrawl-api-key');
    this.openaiApiKeyInput = document.getElementById('openai-api-key');
    this.fireworksApiKeyInput = document.getElementById('fireworks-api-key');
    this.openaiEndpointInput = document.getElementById('openai-endpoint');
    this.customModelInput = document.getElementById('custom-model');
    this.saveDeepResearchKeysBtn = document.getElementById('save-deep-research-keys-btn');
    this.firecrawlKeySavedIndicator = document.getElementById('firecrawl-key-saved-indicator');
    this.openaiKeySavedIndicator = document.getElementById('openai-key-saved-indicator');
    this.fireworksKeySavedIndicator = document.getElementById('fireworks-key-saved-indicator');
    this.modeToggleBtn = document.getElementById('mode-toggle-btn');
    this.modeDropdownMenu = document.getElementById('mode-dropdown-menu');
    this.editProposalModal = document.getElementById('edit-proposal-modal');
    this.closeEditProposalModal = document.getElementById('close-edit-proposal-modal');
    this.approveEditBtn = document.getElementById('approve-edit-btn');
    this.rejectEditBtn = document.getElementById('reject-edit-btn');
    this.currentProposal = null; // Store current edit proposal
    this.originalEditRequest = null; // Store original edit request for regeneration
    this.originalEditContext = null; // Store original context (thesis content, loaded contexts)
    this.rejectionCount = 0; // Track number of rejections for this request
    this.maxRetries = 3; // Maximum number of proposal regenerations
    
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
    if (this.saveDeepResearchKeysBtn) {
      this.saveDeepResearchKeysBtn.addEventListener('click', () => this.saveDeepResearchKeys());
    }
    this.searchInput.addEventListener('input', () => this.filterPapers());
    this.presentationFilter.addEventListener('change', () => this.filterPapers());
    this.findRelevantPapersBtn = document.getElementById('find-relevant-papers-btn');
    this.findRelevantPapersBtn.addEventListener('click', () => this.findRelevantPapersFromThesis());
    this.deepResearchBtn = document.getElementById('deep-research-btn');
    if (this.deepResearchBtn) {
      this.deepResearchBtn.addEventListener('click', () => this.startDeepResearchFromButton());
    }
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.clearBtn.addEventListener('click', () => this.clearChat());
    
    // Mode toggle dropdown
    if (this.modeToggleBtn) {
      this.modeToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
      this.updateModeUI();
    }

    // Handle dropdown menu items
    if (this.modeDropdownMenu) {
      this.modeDropdownMenu.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = e.target.closest('.dropdown-item');
        if (item) {
          const mode = item.getAttribute('data-mode');
          
          if (mode) {
            // Set mode (Ask, Edit, or Search)
            this.mode = mode;
            this.updateModeUI();
            this.closeDropdown();
          }
        }
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.modeDropdownMenu && this.modeToggleBtn) {
        if (!this.modeToggleBtn.contains(e.target) && !this.modeDropdownMenu.contains(e.target)) {
          this.closeDropdown();
        }
      }
    });
    
    // Edit proposal modal handlers
    if (this.closeEditProposalModal) {
      this.closeEditProposalModal.addEventListener('click', () => this.closeEditProposal());
    }
    if (this.approveEditBtn) {
      this.approveEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('=== APPROVE BUTTON CLICKED ===');
        console.log('Current proposal:', this.currentProposal);
        this.approveEdit();
      });
    }
    if (this.rejectEditBtn) {
      this.rejectEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.rejectEdit();
      });
    }
    if (this.editProposalModal) {
      this.editProposalModal.addEventListener('click', (e) => {
        if (e.target === this.editProposalModal) {
          this.closeEditProposal();
        }
      });
    }
    
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
          
          // Add button after message is updated (use setTimeout to ensure DOM is ready)
          setTimeout(() => {
            const messageDiv = document.getElementById(loadingId);
            if (messageDiv) {
              const contentDiv = messageDiv.querySelector('.message-content');
              if (contentDiv) {
                // Check if button already exists
                const existingButton = contentDiv.querySelector('.btn-use-abstract-only-chat');
                if (existingButton) {
                  existingButton.remove();
                }
                
                const button = document.createElement('button');
                button.className = 'btn-use-abstract-only-chat btn-small';
                button.setAttribute('data-forum', forumId);
                button.setAttribute('data-title', title);
                button.style.marginTop = '0.5rem';
                button.style.display = 'block';
                button.textContent = '📝 Use Abstract Only';
                
                button.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  const btnForumId = button.getAttribute('data-forum');
                  const btnTitle = button.getAttribute('data-title');
                  const context = this.loadedContexts[btnForumId];
                  
                  if (context && context.type === 'full' && context.paper && context.paper.abstract) {
                    // Convert to abstract-only
                    const abstractText = this.cleanAbstract(context.paper.abstract || 'No abstract available');
                    
                    this.loadedContexts[btnForumId] = {
                      title: btnTitle,
                      text: `Title: ${btnTitle}\n\nAbstract:\n${abstractText}`,
                      type: 'abstract',
                      loadedAt: new Date().toISOString(),
                      forumId: btnForumId,
                      paper: context.paper
                    };
                    
                    // Update UI
                    this.renderPapers();
                    this.updateLoadedContextsUI();
                    
                    // Replace button with success message
                    const successSpan = document.createElement('span');
                    successSpan.style.color = '#27ae60';
                    successSpan.style.fontWeight = '600';
                    successSpan.textContent = '✓ Switched to Abstract Only';
                    button.replaceWith(successSpan);
                  }
                });
                
                contentDiv.appendChild(button);
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
              }
            }
          }, 0);
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

  toggleDropdown() {
    if (this.modeDropdownMenu) {
      const isVisible = this.modeDropdownMenu.style.display !== 'none';
      this.modeDropdownMenu.style.display = isVisible ? 'none' : 'block';
    }
  }

  closeDropdown() {
    if (this.modeDropdownMenu) {
      this.modeDropdownMenu.style.display = 'none';
    }
  }

  updateModeUI() {
    if (this.modeToggleBtn) {
      let label;
      if (this.mode === 'ask') {
        label = 'Ask Mode';
      } else if (this.mode === 'edit') {
        label = 'Edit Mode';
      } else if (this.mode === 'search') {
        label = 'Search Mode';
      } else {
        label = 'Ask Mode';
      }
      
      const modeLabel = this.modeToggleBtn.querySelector('.mode-label');
      if (modeLabel) {
        modeLabel.textContent = label;
      }
      this.modeToggleBtn.setAttribute('data-mode', this.mode);
      
      // Update button appearance
      this.modeToggleBtn.classList.remove('edit-mode', 'search-mode');
      if (this.mode === 'edit') {
        this.modeToggleBtn.classList.add('edit-mode');
      } else if (this.mode === 'search') {
        this.modeToggleBtn.classList.add('search-mode');
      }
      
      // Update chat input placeholder
      if (this.chatInput) {
        if (this.mode === 'ask') {
          this.chatInput.placeholder = 'Ask a question about the papers...';
        } else if (this.mode === 'edit') {
          this.chatInput.placeholder = 'Describe the edit you want to make to your thesis...';
        } else if (this.mode === 'search') {
          this.chatInput.placeholder = 'Enter search query to find relevant papers...';
        }
      }
    }

    // Update dropdown menu active states
    if (this.modeDropdownMenu) {
      const items = this.modeDropdownMenu.querySelectorAll('.dropdown-item[data-mode]');
      items.forEach(item => {
        const itemMode = item.getAttribute('data-mode');
        if (itemMode === this.mode) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    // Check for deep research commands
    if (message.startsWith('/research') || message.startsWith('/research-report')) {
      this.chatInput.value = '';
      await this.handleDeepResearchCommand(message);
      return;
    }

    // Check for web search command (works in any mode)
    if (this.isWebSearchCommand(message)) {
      this.chatInput.value = '';
      this.addMessage('user', message);
      const webQuery = this.extractWebSearchQuery(message);
      await this.handleWebSearchAction(webQuery);
      return;
    }

    // Add user message
    this.addMessage('user', message);
    this.chatInput.value = '';

    // Check mode - edit mode, search mode, or ask mode
    if (this.mode === 'edit') {
      await this.handleEditMode(message);
      return;
    } else if (this.mode === 'search') {
      // Handle search mode
      await this.handleSearchAction(message);
      return;
    }

    // Original ask mode logic
    if (this.papers.length === 0) {
      alert('Please load papers first');
      return;
    }

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
          // Check if Gemini response suggests a search is needed
          // If so, trigger semantic search
          if (this.shouldPerformSearch(result.text, message)) {
            this.updateMessage(thinkingId, 'Performing semantic search to find relevant papers...');
            await this.handleSearchAction(message);
          } else {
            // Display Gemini response naturally (no special formatting)
            this.updateMessage(thinkingId, result.text);
          }
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

  async handleEditMode(message) {
    if (!this.geminiApiKey) {
      this.addMessage('agent', 'Please set your Gemini API key in Settings first. Edit proposals require an API key.');
      return;
    }

    // Get thesis content
    let thesisContent = null;
    if (window.getThesisHTML) {
      thesisContent = window.getThesisHTML();
    } else {
      // Fallback: try to access thesis editor directly
      const thesisEditor = document.getElementById('thesis-editor');
      if (thesisEditor) {
        thesisContent = {
          html: thesisEditor.innerHTML,
          plainText: thesisEditor.textContent || thesisEditor.innerText
        };
      }
    }

    if (!thesisContent || !thesisContent.plainText || thesisContent.plainText.trim().length < 10) {
      this.addMessage('agent', 'Your thesis appears to be empty or too short. Please write some content in the thesis editor first.');
      return;
    }

    // Show thinking indicator
    const thinkingId = this.addMessage('agent', 'Analyzing your thesis and generating edit proposal...', true);

    try {
      // Gather loaded contexts
      const loadedContexts = Object.keys(this.loadedContexts).length > 0
        ? Object.keys(this.loadedContexts).map(id => this.loadedContexts[id])
        : null;

      // Call edit proposal IPC handler
      const result = await window.electronAPI.proposeThesisEdit({
        apiKey: this.geminiApiKey,
        userIntention: message,
        thesisContent: thesisContent.plainText,
        thesisHTML: thesisContent.html, // Pass HTML for better paragraph detection
        loadedContexts: loadedContexts
      });

      if (result.error) {
        this.updateMessage(thinkingId, `Error generating edit proposal: ${result.error}${result.rawResponse ? '\n\nRaw response:\n' + result.rawResponse.substring(0, 500) : ''}`);
      } else if (result.success && result.proposal) {
        // Process references if any papers need to be added
        let proposal = result.proposal;
        
        if (result.referencesToCreate && result.referencesToCreate.length > 0) {
          console.log(`Processing ${result.referencesToCreate.length} papers to add to reference bank`);
          const paperToRefIdMap = new Map(); // Map paper index -> refId
          
          // Wait a bit to ensure thesisApp is fully initialized
          let retries = 0;
          while (!window.createReferenceFromPaper && retries < 5) {
            console.warn(`window.createReferenceFromPaper not available, waiting... (attempt ${retries + 1}/5)`);
            await new Promise(resolve => setTimeout(resolve, 200));
            retries++;
          }
          
          if (!window.createReferenceFromPaper) {
            console.error('window.createReferenceFromPaper still not available after waiting');
            this.updateMessage(thinkingId, '✓ Edit proposal generated! ⚠️ Warning: Could not create references automatically. Please check the browser console for details.');
          }
          
          // Create references for each paper
          for (const paperData of result.referencesToCreate) {
            try {
              if (window.createReferenceFromPaper && typeof window.createReferenceFromPaper === 'function') {
                console.log(`Creating reference for Paper ${paperData.paperIndex}: ${paperData.title}`);
                const refId = window.createReferenceFromPaper(paperData);
                if (refId) {
                  paperToRefIdMap.set(paperData.paperIndex, refId);
                  console.log(`✓ Created reference ${refId} for Paper ${paperData.paperIndex}: ${paperData.title}`);
                } else {
                  console.warn(`Failed to create reference for Paper ${paperData.paperIndex}: ${paperData.title}`);
                }
              } else {
                console.error('window.createReferenceFromPaper is not available or not a function');
              }
            } catch (error) {
              console.error(`Error creating reference for Paper ${paperData.paperIndex}:`, error);
            }
          }
          
          // Replace Paper1, Paper2 citations with [@ref1], [@ref2] format in the proposal
          if (paperToRefIdMap.size > 0) {
            console.log(`Replacing citations using map:`, Array.from(paperToRefIdMap.entries()));
            proposal = this.replacePaperCitations(proposal, paperToRefIdMap);
            console.log('Proposal after citation replacement:', JSON.stringify(proposal, null, 2));
            
            // Show message about references created with details
            const refCount = paperToRefIdMap.size;
            const refDetails = result.referencesToCreate
              .filter(p => paperToRefIdMap.has(p.paperIndex))
              .map(p => `- ${p.title}`)
              .join('\n');
            
            this.updateMessage(thinkingId, `✓ Edit proposal generated!\n\n**Automatically added ${refCount} ${refCount === 1 ? 'reference' : 'references'} to your reference bank:**\n${refDetails}\n\n*Check the References section in the Thesis Editor tab to see them. Citations in the proposal have been updated to use proper [@refId] format.*\n\nReview the proposal in the modal below.`);
            
            // Force a small delay to ensure UI updates
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Try to refresh reference display if we can access it
            if (window.thesisApp && typeof window.thesisApp.renderReferences === 'function') {
              window.thesisApp.renderReferences();
            }
          } else {
            console.warn('No references were created successfully');
            this.updateMessage(thinkingId, '✓ Edit proposal generated! Review it in the modal below.');
          }
        } else {
          this.updateMessage(thinkingId, '✓ Edit proposal generated! Review it in the modal below.');
        }
        
        // Store proposal and display it
        this.currentProposal = proposal;
        
        // Store original request and context for potential regeneration
        this.originalEditRequest = message;
        this.originalEditContext = {
          thesisContent: thesisContent.plainText,
          loadedContexts: loadedContexts
        };
        this.rejectionCount = 0; // Reset rejection count for new request
        
        this.displayEditProposal(proposal);
      } else {
        this.updateMessage(thinkingId, 'Failed to generate edit proposal. Please try again.');
      }
    } catch (error) {
      console.error('Error in edit mode:', error);
      this.updateMessage(thinkingId, `Error: ${error.message}`);
    }
  }

  // Replace Paper1, Paper2 citations with [@ref1], [@ref2] format
  replacePaperCitations(proposal, paperToRefIdMap) {
    // More flexible pattern: matches "Paper1", "Paper 1", "Paper  1", "(Paper1)", "[Paper1]", etc.
    const citationPattern = /(?:\(|\[)?Paper\s*(\d+)(?:\)|\])?/gi;
    
    // Create a deep copy of the proposal to avoid mutating the original
    const updatedProposal = JSON.parse(JSON.stringify(proposal));
    
    // Process each change in the proposal
    if (updatedProposal.changes && Array.isArray(updatedProposal.changes)) {
      updatedProposal.changes.forEach(change => {
        if (change.newText) {
          console.log(`Before replacement - newText:`, change.newText);
          
          // Replace all Paper N citations with [@refId] format
          change.newText = change.newText.replace(citationPattern, (match, paperNumStr) => {
            const paperIndex = parseInt(paperNumStr);
            const refId = paperToRefIdMap.get(paperIndex);
            console.log(`Found citation: "${match}", paperIndex: ${paperIndex}, refId: ${refId}`);
            if (refId) {
              return `[@${refId}]`;
            }
            // If no reference ID found, keep original citation
            console.warn(`No refId found for Paper ${paperIndex}, keeping original citation`);
            return match;
          });
          
          console.log(`After replacement - newText:`, change.newText);
          
          // Reset regex lastIndex after each replacement
          citationPattern.lastIndex = 0;
        }
        
        // Also check searchText and surroundingText for citations (though less common)
        if (change.searchText) {
          change.searchText = change.searchText.replace(citationPattern, (match, paperNumStr) => {
            const paperIndex = parseInt(paperNumStr);
            const refId = paperToRefIdMap.get(paperIndex);
            if (refId) {
              return `[@${refId}]`;
            }
            return match;
          });
          citationPattern.lastIndex = 0;
        }
        
        if (change.surroundingText) {
          change.surroundingText = change.surroundingText.replace(citationPattern, (match, paperNumStr) => {
            const paperIndex = parseInt(paperNumStr);
            const refId = paperToRefIdMap.get(paperIndex);
            if (refId) {
              return `[@${refId}]`;
            }
            return match;
          });
          citationPattern.lastIndex = 0;
        }
      });
    }
    
    // Also check description and reasoning fields
    if (updatedProposal.description) {
      updatedProposal.description = updatedProposal.description.replace(citationPattern, (match, paperNumStr) => {
        const paperIndex = parseInt(paperNumStr);
        const refId = paperToRefIdMap.get(paperIndex);
        if (refId) {
          return `[@${refId}]`;
        }
        return match;
      });
      citationPattern.lastIndex = 0;
    }
    
    if (updatedProposal.reasoning) {
      updatedProposal.reasoning = updatedProposal.reasoning.replace(citationPattern, (match, paperNumStr) => {
        const paperIndex = parseInt(paperNumStr);
        const refId = paperToRefIdMap.get(paperIndex);
        if (refId) {
          return `[@${refId}]`;
        }
        return match;
      });
      citationPattern.lastIndex = 0;
    }
    
    return updatedProposal;
  }

  displayEditProposal(proposal) {
    console.log('Displaying edit proposal:', JSON.stringify(proposal, null, 2));
    
    if (!this.editProposalModal) {
      console.error('Edit proposal modal not found!');
      return;
    }

    // Store proposal for approval
    this.currentProposal = proposal;

    // Populate modal with proposal data
    const descriptionEl = this.editProposalModal.querySelector('.proposal-description');
    const beforeTextEl = this.editProposalModal.querySelector('.before-text');
    const afterTextEl = this.editProposalModal.querySelector('.after-text');
    const reasoningEl = this.editProposalModal.querySelector('.proposal-reasoning');
    const locationContextEl = this.editProposalModal.querySelector('.proposal-location');
    const locationTextEl = this.editProposalModal.querySelector('.proposal-location-text');

    if (descriptionEl) {
      descriptionEl.textContent = proposal.description || 'No description provided';
    }

    // Show first change's before/after with location context
    if (proposal.changes && Array.isArray(proposal.changes) && proposal.changes.length > 0) {
      const firstChange = proposal.changes[0];
      console.log('First change:', firstChange);
      
      // Show location context if available
      if (locationContextEl && locationTextEl) {
        if (firstChange.locationContext || firstChange.surroundingText) {
          let locationText = '';
          if (firstChange.locationContext) {
            locationText += `📍 ${firstChange.locationContext}\n\n`;
          }
          if (firstChange.surroundingText) {
            locationText += `Context around edit location:\n${firstChange.surroundingText}`;
          }
          locationTextEl.textContent = locationText;
          locationContextEl.style.display = 'block';
        } else {
          // Try to infer location from searchText
          if (firstChange.searchText) {
            // Show a portion of searchText to indicate location
            const searchPreview = firstChange.searchText.length > 150 
              ? firstChange.searchText.substring(0, 150) + '...'
              : firstChange.searchText;
            locationTextEl.textContent = `Edit will be applied where this text appears:\n"${searchPreview}"`;
            locationContextEl.style.display = 'block';
          } else {
            locationContextEl.style.display = 'none';
          }
        }
      }
      
      // Show before text with search context
      if (beforeTextEl) {
        let beforeText = '';
        if (firstChange.searchText) {
          beforeText = firstChange.searchText;
        } else if (firstChange.surroundingText) {
          beforeText = firstChange.surroundingText;
        } else {
          beforeText = firstChange.before || 'N/A';
        }
        beforeTextEl.textContent = beforeText;
      }
      
      // Show after text
      if (afterTextEl) {
        afterTextEl.textContent = firstChange.newText || firstChange.after || 'N/A';
      }
    } else {
      console.warn('Proposal has no changes or invalid format:', proposal.changes);
      if (beforeTextEl) beforeTextEl.textContent = 'N/A';
      if (afterTextEl) afterTextEl.textContent = 'N/A';
      if (locationContextEl) locationContextEl.style.display = 'none';
    }

    if (reasoningEl) {
      reasoningEl.textContent = proposal.reasoning || 'No reasoning provided';
    }

    // Show review results if available
    if (proposal.review) {
      const reviewSection = this.editProposalModal.querySelector('#proposal-review');
      const verdictBadge = this.editProposalModal.querySelector('#review-verdict-badge');
      const issuesSection = this.editProposalModal.querySelector('#review-issues');
      const issuesList = this.editProposalModal.querySelector('#review-issues-list');
      const suggestionsSection = this.editProposalModal.querySelector('#review-suggestions');
      const suggestionsList = this.editProposalModal.querySelector('#review-suggestions-list');
      
      if (reviewSection && verdictBadge) {
        reviewSection.style.display = 'block';
        
        // Set verdict badge
        const verdict = proposal.review.overallVerdict || (proposal.review.approved ? 'approve' : 'reject');
        verdictBadge.textContent = verdict === 'approve' ? '✅ Approved' : 
                                   verdict === 'approve_with_suggestions' ? '⚠️ Approved with Suggestions' : 
                                   '❌ Rejected';
        verdictBadge.className = `review-badge ${verdict === 'approve' ? 'approved' : verdict === 'approve_with_suggestions' ? 'warning' : 'rejected'}`;
        
        // Show issues if any
        if (proposal.review.issues && proposal.review.issues.length > 0) {
          issuesSection.style.display = 'block';
          issuesList.innerHTML = '';
          proposal.review.issues.forEach(issue => {
            const li = document.createElement('li');
            const severityClass = issue.severity === 'blocker' ? 'blocker' : issue.severity === 'warning' ? 'warning' : 'nit';
            li.className = `review-issue ${severityClass}`;
            li.innerHTML = `
              <strong>[${issue.severity.toUpperCase()}]</strong> ${issue.type}: ${issue.description}
              ${issue.suggestion ? `<br><em>Suggestion: ${issue.suggestion}</em>` : ''}
            `;
            issuesList.appendChild(li);
          });
        } else {
          issuesSection.style.display = 'none';
        }
        
        // Show suggestions if any
        if (proposal.review.suggestions && proposal.review.suggestions.length > 0) {
          suggestionsSection.style.display = 'block';
          suggestionsList.innerHTML = '';
          proposal.review.suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            suggestionsList.appendChild(li);
          });
        } else {
          suggestionsSection.style.display = 'none';
        }
      }
    } else {
      const reviewSection = this.editProposalModal.querySelector('#proposal-review');
      if (reviewSection) {
        reviewSection.style.display = 'none';
      }
    }

    // Show modal
    this.editProposalModal.classList.add('active');
    console.log('Edit proposal modal shown');
  }

  async approveEdit() {
    if (!this.currentProposal) {
      alert('No edit proposal to approve');
      return;
    }

    console.log('=== APPROVING EDIT PROPOSAL ===');
    console.log('Proposal:', JSON.stringify(this.currentProposal, null, 2));
    console.log('window.applyBasicEdit available?', typeof window.applyBasicEdit);
    console.log('window.getThesisHTML available?', typeof window.getThesisHTML);
    
    // Check if thesis editor exists
    const thesisEditor = document.getElementById('thesis-editor');
    console.log('Thesis editor element:', thesisEditor);
    if (thesisEditor) {
      console.log('Current thesis content length:', (thesisEditor.textContent || '').length);
      console.log('Current thesis HTML length:', (thesisEditor.innerHTML || '').length);
    }

    // Apply the edit
    if (window.applyBasicEdit && typeof window.applyBasicEdit === 'function') {
      try {
        const result = window.applyBasicEdit(this.currentProposal);
        console.log('Edit application result:', result);
        
        if (result && result.success) {
          // Verify the edit was actually applied
          if (thesisEditor) {
            const newContent = thesisEditor.textContent || thesisEditor.innerText || '';
            console.log('New thesis content length after edit:', newContent.length);
            console.log('New thesis preview:', newContent.substring(Math.max(0, newContent.length - 200)));
          }
          
          this.addMessage('agent', '✓ Edit applied successfully! Check the thesis editor to see the changes.');
          
          // Reset rejection tracking since edit was approved
          this.rejectionCount = 0;
          this.originalEditRequest = null;
          this.originalEditContext = null;
          
          this.closeEditProposal();
          
          // Switch to thesis tab first if in agent tab
          const tabThesis = document.getElementById('tab-thesis');
          const workspace = document.querySelector('.workspace');
          const agentSection = document.getElementById('agent-section');
          
          if (tabThesis && !tabThesis.classList.contains('active')) {
            console.log('Switching to thesis tab...');
            tabThesis.classList.add('active');
            const tabAgent = document.getElementById('tab-agent');
            if (tabAgent) {
              tabAgent.classList.remove('active');
            }
            if (workspace) {
              workspace.style.display = 'flex';
            }
            if (agentSection) {
              agentSection.style.display = 'none';
            }
            // Also trigger click event to ensure all handlers fire
            tabThesis.click();
          }
          
          // Wait a bit for tab switch to complete, then focus editor
          setTimeout(() => {
            // Try to focus and scroll to editor
            if (thesisEditor) {
              thesisEditor.focus();
              thesisEditor.scrollTop = thesisEditor.scrollHeight;
              // Scroll window to make editor visible
              thesisEditor.scrollIntoView({ behavior: 'smooth', block: 'center' });
              console.log('✓ Editor focused and scrolled');
            }
          }, 100);
        } else {
          const errorMsg = result && result.error ? result.error : 'Unknown error';
          console.error('Edit application failed:', errorMsg);
          alert(`Error applying edit: ${errorMsg}\n\nCheck the browser console for details.`);
          this.addMessage('agent', `✗ Error applying edit: ${errorMsg}`);
        }
      } catch (error) {
        console.error('Exception while applying edit:', error);
        console.error('Stack:', error.stack);
        alert(`Error applying edit: ${error.message}\n\nCheck the browser console for details.`);
        this.addMessage('agent', `✗ Error applying edit: ${error.message}`);
      }
    } else {
      console.error('applyBasicEdit function not available on window');
      console.error('Available window functions:', Object.keys(window).filter(k => k.includes('apply') || k.includes('thesis')));
      alert('Error: Edit application function not available. Please refresh the app.\n\nCheck the browser console for details.');
      
      // Try fallback: direct access to thesisApp or thesis editor
      console.log('Attempting fallback methods...');
      
      // Method 1: window.thesisApp
      if (typeof window.thesisApp !== 'undefined' && window.thesisApp && typeof window.thesisApp.applyBasicEdit === 'function') {
        console.log('Trying fallback method 1: window.thesisApp.applyBasicEdit');
        try {
          const result = window.thesisApp.applyBasicEdit(this.currentProposal);
          if (result && result.success) {
            this.addMessage('agent', '✓ Edit applied successfully (via fallback method 1)!');
            this.closeEditProposal();
            return;
          }
        } catch (fallbackError) {
          console.error('Fallback method 1 failed:', fallbackError);
        }
      }
      
      // Method 2: Direct DOM manipulation as last resort
      const thesisEditor = document.getElementById('thesis-editor');
      if (thesisEditor) {
        console.log('Trying fallback method 2: Direct DOM manipulation');
        try {
          // Get new text from proposal
          let newText = '';
          if (this.currentProposal.changes && this.currentProposal.changes.length > 0) {
            const firstChange = this.currentProposal.changes[0];
            newText = firstChange.newText || firstChange.newContent || firstChange.after || '';
          } else if (this.currentProposal.newText || this.currentProposal.newContent) {
            newText = this.currentProposal.newText || this.currentProposal.newContent || '';
          }
          
          if (newText) {
            // Escape HTML
            const div = document.createElement('div');
            div.textContent = newText;
            const escapedText = div.innerHTML;
            const newTextHtml = escapedText.replace(/\n/g, '<br>');
            
            // Append to end
            thesisEditor.innerHTML += '<br><br><div style="border-left: 3px solid #27ae60; padding-left: 10px; margin: 10px 0;"><strong>[Edit Applied - Fallback Method]</strong></div><br>' + newTextHtml;
            
            // Focus and scroll
            thesisEditor.focus();
            thesisEditor.scrollTop = thesisEditor.scrollHeight;
            
            // Save if possible
            if (window.thesisApp && typeof window.thesisApp.saveToStorage === 'function') {
              window.thesisApp.saveToStorage();
            }
            
            this.addMessage('agent', '✓ Edit applied successfully (via fallback method 2 - direct DOM)!');
            this.closeEditProposal();
            
            // Switch to thesis tab
            const tabThesis = document.getElementById('tab-thesis');
            const workspace = document.querySelector('.workspace');
            const agentSection = document.getElementById('agent-section');
            
            if (tabThesis && !tabThesis.classList.contains('active')) {
              console.log('Switching to thesis tab (fallback method 2)...');
              tabThesis.classList.add('active');
              const tabAgent = document.getElementById('tab-agent');
              if (tabAgent) {
                tabAgent.classList.remove('active');
              }
              if (workspace) {
                workspace.style.display = 'flex';
              }
              if (agentSection) {
                agentSection.style.display = 'none';
              }
              tabThesis.click();
            }
            
            // Wait a bit then scroll to editor
            setTimeout(() => {
              if (thesisEditor) {
                thesisEditor.focus();
                thesisEditor.scrollTop = thesisEditor.scrollHeight;
                thesisEditor.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
            
            return;
          }
        } catch (fallbackError) {
          console.error('Fallback method 2 also failed:', fallbackError);
        }
      }
      
      console.error('All methods failed to apply edit');
    }
  }

  async rejectEdit() {
    this.rejectionCount++;
    
    // Close the current proposal modal
    this.closeEditProposal();
    
    // Check if we should generate a new proposal
    if (this.rejectionCount < this.maxRetries && this.originalEditRequest && this.originalEditContext) {
      this.addMessage('agent', `Edit proposal rejected. Generating alternative proposal (attempt ${this.rejectionCount + 1}/${this.maxRetries})...`);
      
      // Generate a new proposal with feedback about the rejection
      const thinkingId = this.addMessage('agent', 'Generating alternative edit proposal...', true);
      
      try {
        // Call edit proposal IPC handler with feedback about previous rejection
        const result = await window.electronAPI.proposeThesisEdit({
          apiKey: this.geminiApiKey,
          userIntention: `${this.originalEditRequest}\n\nNote: Previous proposal was rejected. Please try a different approach. Consider: different location, different style, or different content focus.`,
          thesisContent: this.originalEditContext.thesisContent,
          loadedContexts: this.originalEditContext.loadedContexts,
          previousRejectionCount: this.rejectionCount
        });

        if (result.error) {
          this.updateMessage(thinkingId, `Error generating alternative proposal: ${result.error}`);
          this.addMessage('agent', 'Unable to generate alternative proposal. Please try modifying your request.');
        } else if (result.success && result.proposal) {
          // Process references if any papers need to be added (same as original)
          let proposal = result.proposal;
          
          if (result.referencesToCreate && result.referencesToCreate.length > 0) {
            const paperToRefIdMap = new Map();
            
            let retries = 0;
            while (!window.createReferenceFromPaper && retries < 5) {
              await new Promise(resolve => setTimeout(resolve, 200));
              retries++;
            }
            
            if (window.createReferenceFromPaper) {
              for (const paperData of result.referencesToCreate) {
                try {
                  const refId = window.createReferenceFromPaper(paperData);
                  if (refId) {
                    paperToRefIdMap.set(paperData.paperIndex, refId);
                  }
                } catch (error) {
                  console.error(`Error creating reference:`, error);
                }
              }
              
              if (paperToRefIdMap.size > 0) {
                proposal = this.replacePaperCitations(proposal, paperToRefIdMap);
              }
            }
          }
          
          this.updateMessage(thinkingId, `✓ Alternative edit proposal generated! Review the new proposal below.`);
          
          // Store and display new proposal
          this.currentProposal = proposal;
          this.displayEditProposal(proposal);
        } else {
          this.updateMessage(thinkingId, 'Failed to generate alternative proposal. Please try again.');
        }
      } catch (error) {
        console.error('Error generating alternative proposal:', error);
        this.updateMessage(thinkingId, `Error: ${error.message}`);
        this.addMessage('agent', 'Unable to generate alternative proposal. Please try modifying your request.');
      }
    } else {
      // Max retries reached or no original request stored
      if (this.rejectionCount >= this.maxRetries) {
        this.addMessage('agent', `Edit proposal rejected. Maximum retry attempts (${this.maxRetries}) reached. Please refine your request and try again.`);
        // Reset for next attempt
        this.rejectionCount = 0;
        this.originalEditRequest = null;
        this.originalEditContext = null;
      } else {
        this.addMessage('agent', 'Edit proposal rejected.');
      }
    }
  }

  closeEditProposal() {
    if (this.editProposalModal) {
      this.editProposalModal.classList.remove('active');
    }
    this.currentProposal = null;
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

  async loadDeepResearchKeys() {
    try {
      if (window.electronAPI && window.electronAPI.loadDeepResearchKeys) {
        const result = await window.electronAPI.loadDeepResearchKeys();
        if (result.keys) {
          const keys = result.keys;
          if (keys.firecrawlApiKey && this.firecrawlApiKeyInput) {
            this.firecrawlApiKeyInput.placeholder = 'Firecrawl API key saved ✓ (enter new key to change)';
            if (this.firecrawlKeySavedIndicator) {
              this.firecrawlKeySavedIndicator.style.display = 'block';
            }
          }
          if (keys.openaiApiKey && this.openaiApiKeyInput) {
            this.openaiApiKeyInput.placeholder = 'OpenAI API key saved ✓ (enter new key to change)';
            if (this.openaiKeySavedIndicator) {
              this.openaiKeySavedIndicator.style.display = 'block';
            }
          }
          if (keys.fireworksApiKey && this.fireworksApiKeyInput) {
            this.fireworksApiKeyInput.placeholder = 'Fireworks API key saved ✓ (enter new key to change)';
            if (this.fireworksKeySavedIndicator) {
              this.fireworksKeySavedIndicator.style.display = 'block';
            }
          }
          if (keys.openaiEndpoint && this.openaiEndpointInput) {
            this.openaiEndpointInput.value = keys.openaiEndpoint;
          }
          if (keys.customModel && this.customModelInput) {
            this.customModelInput.value = keys.customModel;
          }
        }
      }
    } catch (error) {
      console.error('Error loading deep research API keys:', error);
    }
  }

  async saveDeepResearchKeys() {
    const keys = {
      firecrawlApiKey: this.firecrawlApiKeyInput ? this.firecrawlApiKeyInput.value.trim() : '',
      openaiApiKey: this.openaiApiKeyInput ? this.openaiApiKeyInput.value.trim() : '',
      fireworksApiKey: this.fireworksApiKeyInput ? this.fireworksApiKeyInput.value.trim() : '',
      openaiEndpoint: this.openaiEndpointInput ? this.openaiEndpointInput.value.trim() : '',
      customModel: this.customModelInput ? this.customModelInput.value.trim() : '',
    };

    // Firecrawl is required
    if (!keys.firecrawlApiKey) {
      alert('Firecrawl API key is required for Deep Research');
      return;
    }

    // At least one LLM API key is required
    if (!keys.openaiApiKey && !keys.fireworksApiKey) {
      alert('At least one LLM API key (OpenAI or Fireworks) is required for Deep Research');
      return;
    }

    try {
      if (window.electronAPI && window.electronAPI.saveDeepResearchKeys) {
        const result = await window.electronAPI.saveDeepResearchKeys(keys);
        if (result.error) {
          alert('Error saving API keys: ' + result.error);
        } else {
          // Clear inputs and show saved indicators
          if (this.firecrawlApiKeyInput) {
            this.firecrawlApiKeyInput.value = '';
            this.firecrawlApiKeyInput.placeholder = 'Firecrawl API key saved ✓ (enter new key to change)';
          }
          if (this.openaiApiKeyInput) {
            this.openaiApiKeyInput.value = '';
            this.openaiApiKeyInput.placeholder = 'OpenAI API key saved ✓ (enter new key to change)';
          }
          if (this.fireworksApiKeyInput) {
            this.fireworksApiKeyInput.value = '';
            this.fireworksApiKeyInput.placeholder = 'Fireworks API key saved ✓ (enter new key to change)';
          }
          
          if (this.firecrawlKeySavedIndicator) {
            this.firecrawlKeySavedIndicator.style.display = 'block';
          }
          if (this.openaiKeySavedIndicator && keys.openaiApiKey) {
            this.openaiKeySavedIndicator.style.display = 'block';
          }
          if (this.fireworksKeySavedIndicator && keys.fireworksApiKey) {
            this.fireworksKeySavedIndicator.style.display = 'block';
          }
          
          console.log('Deep Research API keys saved successfully');
          this.addMessage('agent', '✓ Deep Research API keys saved successfully! You can now use Deep Research features.');
        }
      }
    } catch (error) {
      console.error('Error saving deep research API keys:', error);
      alert('Error saving API keys: ' + error.message);
    }
  }

  async startDeepResearchFromButton() {
    const message = this.chatInput.value.trim();
    if (!message) {
      alert('Please enter a research query first');
      return;
    }
    this.chatInput.value = '';
    await this.startDeepResearch(message, 4, 2, false);
  }

  async handleDeepResearchCommand(message) {
    // Parse command: /research <query> [--breadth N] [--depth N]
    // or: /research-report <query> [--breadth N] [--depth N]
    const generateReport = message.startsWith('/research-report');
    const command = generateReport ? '/research-report' : '/research';
    
    let query = message.slice(command.length).trim();
    let breadth = 4;
    let depth = 2;

    // Parse optional parameters
    const breadthMatch = query.match(/--breadth\s+(\d+)/);
    if (breadthMatch) {
      breadth = parseInt(breadthMatch[1], 10);
      query = query.replace(/--breadth\s+\d+/g, '').trim();
    }

    const depthMatch = query.match(/--depth\s+(\d+)/);
    if (depthMatch) {
      depth = parseInt(depthMatch[1], 10);
      query = query.replace(/--depth\s+\d+/g, '').trim();
    }

    if (!query) {
      this.addMessage('agent', 'Please provide a research query. Example: /research What are the latest developments in transformer architectures?');
      return;
    }

    await this.startDeepResearch(query, breadth, depth, generateReport);
  }

  async startDeepResearch(query, breadth, depth, generateReport) {
    // Add user message
    this.addMessage('user', generateReport ? `/research-report ${query}` : `/research ${query}`);

    // Show initial message
    const progressId = this.addMessage('agent', '🔍 Starting deep research...', true);

    try {
      // Set up progress listener
      if (window.electronAPI && window.electronAPI.onDeepResearchProgress) {
        window.electronAPI.onDeepResearchProgress((progress) => {
          this.displayDeepResearchProgress(progressId, progress);
        });
      }

      // Call deep research
      if (!window.electronAPI || !window.electronAPI.deepResearch) {
        throw new Error('Deep research API not available');
      }

      const result = await window.electronAPI.deepResearch({
        query,
        breadth,
        depth,
        generateReport,
      });

      if (result.error) {
        let errorMsg = result.error;
        // Provide helpful suggestions for common errors
        if (errorMsg.includes('API key') || errorMsg.includes('Authentication')) {
          errorMsg += '\n\n💡 Tip: Please configure your API keys in Settings → Deep Research API Keys';
        } else if (errorMsg.includes('Rate limit')) {
          errorMsg += '\n\n💡 Tip: Please wait a moment and try again, or check your API quota.';
        } else if (errorMsg.includes('Network error') || errorMsg.includes('timeout')) {
          errorMsg += '\n\n💡 Tip: Please check your internet connection and try again.';
        }
        this.updateMessage(progressId, `❌ Error: ${errorMsg}`);
        return;
      }

      // Display results
      this.displayDeepResearchResult(progressId, result, generateReport);
    } catch (error) {
      console.error('Error in deep research:', error);
      let errorMsg = error.message || 'Unknown error occurred';
      // Provide helpful suggestions for common errors
      if (errorMsg.includes('API key') || errorMsg.includes('Authentication')) {
        errorMsg += '\n\n💡 Tip: Please configure your API keys in Settings → Deep Research API Keys';
      } else if (errorMsg.includes('Rate limit')) {
        errorMsg += '\n\n💡 Tip: Please wait a moment and try again, or check your API quota.';
      } else if (errorMsg.includes('Network error') || errorMsg.includes('timeout')) {
        errorMsg += '\n\n💡 Tip: Please check your internet connection and try again.';
      }
      this.updateMessage(progressId, `❌ Error performing deep research: ${errorMsg}`);
    }
  }

  displayDeepResearchProgress(messageId, progress) {
    const { currentDepth, totalDepth, currentBreadth, totalBreadth, currentQuery, totalQueries, completedQueries } = progress;
    
    let progressText = '🔍 Researching...\n\n';
    progressText += `Depth: ${totalDepth - currentDepth + 1}/${totalDepth}\n`;
    progressText += `Breadth: ${currentBreadth}/${totalBreadth}\n`;
    progressText += `Queries: ${completedQueries}/${totalQueries}\n`;
    if (currentQuery) {
      progressText += `\nCurrent query: ${currentQuery}`;
    }

    this.updateMessage(messageId, progressText);
  }

  displayDeepResearchResult(messageId, result, generateReport) {
    let content = '';

    if (generateReport && result.report) {
      content = `## Research Report\n\n${result.report}`;
    } else if (result.answer) {
      content = `## Research Answer\n\n${result.answer}`;
    }

    if (result.learnings && result.learnings.length > 0) {
      content += `\n\n## Key Learnings\n\n`;
      result.learnings.forEach((learning, index) => {
        content += `${index + 1}. ${learning}\n`;
      });
    }

    if (result.visitedUrls && result.visitedUrls.length > 0) {
      content += `\n\n## Sources (${result.visitedUrls.length})\n\n`;
      content += '<details><summary>Click to view sources</summary>\n\n';
      result.visitedUrls.forEach((url) => {
        content += `- [${url}](${url})\n`;
      });
      content += '\n</details>';
    }

    this.updateMessage(messageId, content);
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
      
      // Load full cache once at the start for merging
      let fullCacheMap = new Map();
      if (window.electronAPI && window.electronAPI.loadEmbeddings) {
        const fullCache = await window.electronAPI.loadEmbeddings({
          dataset: this.currentDataset,
          type: 'papers'
        });
        
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
      }
      
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
            
            const embeddingItem = {
              paperIndex: paperIndex,
              paper: paper,
              text: batch[idx],
              embedding: embedding
            };
            
            allEmbeddings.push(embeddingItem);
            
            // Add to cache map immediately for periodic saving
            fullCacheMap.set(forumId, {
              forumId: forumId,
              text: batch[idx].substring(0, 200),
              embedding: embedding,
              paperIndex: paperIndex
            });
            
            computedCount++;
          });
        }

        // Save after each batch to preserve progress
        if (window.electronAPI && window.electronAPI.saveEmbeddings) {
          const embeddingsToSave = Array.from(fullCacheMap.values());
          await window.electronAPI.saveEmbeddings({
            dataset: this.currentDataset,
            type: 'papers',
            embeddings: embeddingsToSave
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
      // For search requests, suggest using semantic search instead
      return `I can help you search for papers. For better results, use semantic search by typing "/search [your query]" or ask me directly and I'll perform a semantic search.\n\n${this.searchRelatedPapers(question)}`;
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

  /**
   * Construct a search query from user input using LLM
   * This creates an optimized search query for semantic search
   */
  isWebSearchCommand(message) {
    return /^\s*(\/(websearch|gsearch|web|search-web)\b|web:\s*|google:\s*)/i.test(message);
  }

  extractWebSearchQuery(message) {
    return message
      .replace(/^\s*\/(websearch|gsearch|web|search-web)\s*/i, '')
      .replace(/^\s*(web|google):\s*/i, '')
      .trim();
  }

  async constructSearchQuery(userQuery) {
    if (!this.geminiApiKey) {
      // Fallback: use user query directly if no API key
      return userQuery;
    }

    try {
      const prompt = `Given the following user query, construct an optimal search query for finding relevant research papers. The search query should:
1. Be concise and focused (1-2 sentences or key phrases)
2. Include important technical terms and concepts
3. Remove conversational elements or questions
4. Focus on the core research topic or question

User query: "${userQuery}"

Return only the optimized search query text, nothing else.`;

      const result = await window.electronAPI.callGemini({
        apiKey: this.geminiApiKey,
        prompt: prompt,
        context: null
      });

      if (result.error) {
        console.warn('Error constructing search query with LLM, using original query:', result.error);
        return userQuery;
      }

      // Extract the search query from the response
      const searchQuery = result.text.trim();
      return searchQuery.length > 0 ? searchQuery : userQuery;
    } catch (error) {
      console.warn('Error constructing search query with LLM, using original query:', error);
      return userQuery;
    }
  }

  /**
   * Handle search action - called when user requests a search
   */
  async handleSearchAction(message) {
    if (this.isWebSearchCommand(message)) {
      const webQuery = this.extractWebSearchQuery(message);
      await this.handleWebSearchAction(webQuery);
      return;
    }

    // Extract search query (remove /search prefix if present)
    let searchQuery = message.replace(/^\/search\s*/i, '').replace(/^search:\s*/i, '').trim();
    if (!searchQuery) {
      this.addMessage('agent', 'Please provide a search query. Usage: /search [your query] or "search for [topic]"');
      return;
    }

    // Show searching indicator
    const searchingId = this.addMessage('agent', 'Performing semantic search...', true);

    try {
      this.updateMessage(searchingId, 'Step 1/2: Computing embedding for search query...');
      
      // Perform semantic search (use original query, don't construct optimized version)
      const searchResult = await this.performSemanticSearch(searchQuery, {
        maxResults: 20,
        minSimilarity: 0.0,
        constructQuery: false
      });

      this.updateMessage(searchingId, 'Step 2/2: Searching embedding database and formatting results...');
      
      // Format and display results
      this.displaySearchResults(searchResult, searchingId);

    } catch (error) {
      console.error('Error in search action:', error);
      this.updateMessage(searchingId, `Error performing search: ${error.message}\n\nPlease ensure:\n- Papers are loaded\n- Gemini API key is set\n- Embeddings database exists for the current dataset`);
    }
  }

  /**
   * Handle web search action using Gemini Google Search grounding
   */
  async handleWebSearchAction(query) {
    const searchQuery = (query || '').trim();
    if (!searchQuery) {
      this.addMessage('agent', 'Please provide a web search query. Usage: /websearch [your query] or "web: [topic]"');
      return;
    }

    if (!this.geminiApiKey) {
      this.addMessage('agent', 'Please set your Gemini API key in Settings first. Web search requires an API key.');
      return;
    }

    const searchingId = this.addMessage('agent', 'Searching the web with Gemini...', true);

    try {
      const result = await window.electronAPI.googleSearch({
        apiKey: this.geminiApiKey,
        query: searchQuery
      });

      if (result.error) {
        this.updateMessage(searchingId, `Error performing web search: ${result.error}`);
        return;
      }

      const groundedHtml = this.formatGroundedResponse(result.text, result.groundingMetadata);
      this.updateMessageHtml(searchingId, groundedHtml);
    } catch (error) {
      console.error('Error in web search action:', error);
      this.updateMessage(searchingId, `Error performing web search: ${error.message}`);
    }
  }

  formatGroundedResponse(text, groundingMetadata) {
    const safeText = text || '';
    if (!groundingMetadata) {
      return this.formatPlainHtml(safeText);
    }

    const supports = groundingMetadata.groundingSupports || [];
    const chunks = groundingMetadata.groundingChunks || [];

    const insertions = supports
      .map((support) => {
        const endIndex = support.segment?.endIndex;
        if (endIndex === undefined || !support.groundingChunkIndices?.length) {
          return null;
        }

        const citationLinks = support.groundingChunkIndices
          .map((index) => {
            const uri = chunks[index]?.web?.uri;
            if (!uri) return null;
            return `<a href="${uri}" target="_blank" rel="noopener noreferrer">[${index + 1}]</a>`;
          })
          .filter(Boolean);

        if (citationLinks.length === 0) {
          return null;
        }

        return {
          index: endIndex,
          html: ` ${citationLinks.join(' ')}`
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);

    const sourcesHtml = this.buildSourcesHtml(chunks);
    if (insertions.length === 0) {
      const baseHtml = this.formatPlainHtml(safeText);
      return sourcesHtml ? `${baseHtml}${sourcesHtml}` : baseHtml;
    }

    let html = '';
    let lastIndex = 0;
    insertions.forEach((insertion) => {
      const segment = safeText.slice(lastIndex, insertion.index);
      html += this.escapeHtml(segment);
      html += insertion.html;
      lastIndex = insertion.index;
    });
    html += this.escapeHtml(safeText.slice(lastIndex));

    const baseHtml = this.formatPlainHtml(html, true);
    return sourcesHtml ? `${baseHtml}${sourcesHtml}` : baseHtml;
  }

  buildSourcesHtml(chunks) {
    const sources = (chunks || [])
      .map((chunk, index) => {
        const uri = chunk?.web?.uri;
        if (!uri) return null;
        const title = chunk?.web?.title || uri;
        return `<li><a href="${uri}" target="_blank" rel="noopener noreferrer">[${index + 1}] ${this.escapeHtml(title)}</a></li>`;
      })
      .filter(Boolean);

    if (sources.length === 0) {
      return '';
    }

    return `
      <div class="websearch-sources">
        <div class="websearch-sources-title">Sources</div>
        <ul>
          ${sources.join('')}
        </ul>
      </div>
    `;
  }

  formatPlainHtml(content, isHtml = false) {
    const rawText = content || '';
    const codeBlocks = [];
    const textWithPlaceholders = rawText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const token = `__CODE_BLOCK_${codeBlocks.length}__`;
      const escapedCode = this.escapeHtml(code);
      const languageClass = language ? ` class="language-${language.toLowerCase()}"` : '';
      codeBlocks.push(`<pre><code${languageClass}>${escapedCode}</code></pre>`);
      return token;
    });

    const text = isHtml ? textWithPlaceholders : this.escapeHtml(textWithPlaceholders);
    const lines = text.split('\n');
    let html = '';
    let inList = false;
    let listType = null;

    const applyInlineMarkdown = (value) => {
      let formatted = value;
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
      formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
      formatted = this.applyInlineMath(formatted);
      return formatted;
    };

    const closeList = () => {
      if (inList) {
        html += listType === 'ol' ? '</ol>' : '</ul>';
        inList = false;
        listType = null;
      }
    };

    lines.forEach((line) => {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        html += `<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`;
        return;
      }

      if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
        closeList();
        html += '<hr>';
        return;
      }

      const blockquoteMatch = line.match(/^>\s+(.+)$/);
      if (blockquoteMatch) {
        closeList();
        html += `<blockquote>${applyInlineMarkdown(blockquoteMatch[1])}</blockquote>`;
        return;
      }

      const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (orderedMatch) {
        if (!inList || listType !== 'ol') {
          closeList();
          html += '<ol>';
          inList = true;
          listType = 'ol';
        }
        html += `<li>${applyInlineMarkdown(orderedMatch[1])}</li>`;
        return;
      }

      const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
      if (listMatch) {
        if (!inList || listType !== 'ul') {
          closeList();
          html += '<ul>';
          inList = true;
          listType = 'ul';
        }
        html += `<li>${applyInlineMarkdown(listMatch[1])}</li>`;
        return;
      }

      closeList();

      if (!line.trim()) {
        html += '<br>';
        return;
      }

      html += `<p>${applyInlineMarkdown(line)}</p>`;
    });

    closeList();

    codeBlocks.forEach((block, index) => {
      html = html.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return html;
  }

  /**
   * Check if a Gemini response suggests a search should be performed
   */
  shouldPerformSearch(geminiResponse, originalMessage) {
    const lowerResponse = geminiResponse.toLowerCase();
    const lowerMessage = originalMessage.toLowerCase();
    
    // Check if response mentions searching or finding papers
    const searchKeywords = ['search', 'find papers', 'look for', 'find relevant', 'semantic search'];
    const hasSearchKeywords = searchKeywords.some(keyword => 
      lowerResponse.includes(keyword) || lowerMessage.includes(keyword)
    );

    // Also check if user message is clearly a search request
    const isSearchIntent = lowerMessage.includes('find') || 
                          lowerMessage.includes('search') ||
                          lowerMessage.includes('papers about') ||
                          lowerMessage.includes('papers on');

    return hasSearchKeywords || isSearchIntent;
  }

  /**
   * Display formatted search results
   */
  displaySearchResults(searchResult, messageId) {
    const { query, originalQuery, results, totalResults, dataset } = searchResult;

    if (results.length === 0) {
      this.updateMessage(messageId, `
**No Papers Found**

I couldn't find papers matching your search query: "${originalQuery}"

**Suggestions:**
- Try different keywords or rephrase your query
- Check if embeddings database exists for dataset: ${dataset}
- Ensure papers are loaded for the current dataset
- Try a broader or more specific search term
      `);
      return;
    }

    // Automatically add top results to context (abstracts only)
    results.slice(0, 10).forEach((item) => {
      const paper = item.paper;
      const forumId = item.forumId;
      
      if (forumId && (!this.loadedContexts[forumId] || this.loadedContexts[forumId].type === 'abstract')) {
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

    // Build formatted response
    let response = `**Semantic Search Results**\n\n`;
    response += `**Search query:** "${originalQuery}"\n`;
    response += `**Found ${totalResults} relevant papers** (dataset: ${dataset})\n\n`;
    response += `*Top results have been automatically added to context as abstracts.*\n\n`;

    results.forEach((item, idx) => {
      const paper = item.paper;
      const forumId = item.forumId;
      const title = paper.title || 'Untitled';
      const abstract = this.cleanAbstract(paper.abstract || 'No abstract available');
      const venue = paper.venue || 'Unknown venue';
      const similarityPercent = (item.similarity * 100).toFixed(1);

      response += `${idx + 1}. **${title}** (Similarity: ${similarityPercent}%)\n`;
      response += `   ${venue}\n`;
      if (abstract) {
        response += `   **Abstract:** ${abstract}\n`;
      }
      
      // Add button marker (without brackets - buttons will be inserted here)
      if (forumId && !forumId.startsWith('index_')) {
        response += `\n   SEARCH_BUTTON_MARKER_${idx}_${forumId.substring(0, 8)}\n\n`;
      } else {
        response += `\n`;
      }
    });

    response += `\n*Use the buttons below each paper to download PDFs or load full paper content.*`;

    this.updateMessage(messageId, response);

    // Add action buttons after message is updated
    setTimeout(() => {
      this.addSearchResultButtons(results, messageId);
    }, 100);
  }

  /**
   * Add action buttons to search results
   */
  addSearchResultButtons(results, messageId) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) return;

    const contentDiv = messageDiv.querySelector('.message-content');
    if (!contentDiv) return;

    results.forEach((item, idx) => {
      const paper = item.paper;
      const forumId = item.forumId;
      
      if (!forumId || forumId.startsWith('index_')) return;

      const markerPattern = `SEARCH_BUTTON_MARKER_${idx}_${forumId.substring(0, 8)}`;
      const walker = document.createTreeWalker(
        contentDiv,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.includes(markerPattern)) {
          const buttonContainer = document.createElement('div');
          buttonContainer.className = 'paper-action-buttons-inline';
          
          // Download button
          const downloadBtn = document.createElement('button');
          downloadBtn.className = 'btn-inline btn-download-pdf';
          downloadBtn.textContent = '⬇️ Download PDF';
          downloadBtn.setAttribute('data-forum', forumId);
          downloadBtn.title = 'Download PDF';
          downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Find paper index for download
            let paperIndex = this.filteredPapers.findIndex(p => p.forum === forumId);
            if (paperIndex === -1) {
              paperIndex = this.papers.findIndex(p => p.forum === forumId);
            }
            if (paperIndex !== -1) {
              await this.downloadPDF(forumId, paperIndex);
            } else {
              // Try to download without index
              await this.downloadPDF(forumId);
            }
          });

          // Load full paper button
          const loadBtn = document.createElement('button');
          loadBtn.className = 'btn-inline btn-load-full-paper';
          loadBtn.textContent = '📄 Load Full Paper';
          loadBtn.setAttribute('data-forum', forumId);
          loadBtn.setAttribute('data-title', paper.title || 'Untitled');
          loadBtn.title = 'Load full paper content';
          
          // Update button state handler
          loadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Update button state
            loadBtn.disabled = true;
            loadBtn.textContent = '📄 Loading...';
            
            // Find paper index
            let paperIndex = this.filteredPapers.findIndex(p => p.forum === forumId);
            if (paperIndex === -1) {
              paperIndex = this.papers.findIndex(p => p.forum === forumId);
            }
            
            try {
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
                  if (!this.papers.find(p => p.forum === forumId)) {
                    this.filteredPapers.pop();
                  }
                }
              }
              
              // Update button state based on result
              // Check if paper was successfully loaded by checking if context exists and is full
              if (this.loadedContexts[forumId] && this.loadedContexts[forumId].type === 'full') {
                loadBtn.textContent = '✓ Loaded';
                loadBtn.style.backgroundColor = '#27ae60';
                loadBtn.disabled = true; // Keep disabled since it's now loaded
              } else if (result && result.success) {
                loadBtn.textContent = '✓ Loaded';
                loadBtn.style.backgroundColor = '#27ae60';
                loadBtn.disabled = true;
              } else {
                loadBtn.textContent = '📄 Load Full Paper';
                loadBtn.disabled = false;
              }
            } catch (error) {
              console.error('Error loading paper:', error);
              loadBtn.textContent = '📄 Load Full Paper';
              loadBtn.disabled = false;
            }
          });

          buttonContainer.appendChild(downloadBtn);
          buttonContainer.appendChild(loadBtn);

          // Replace marker with buttons
          // Remove any brackets around the marker pattern
          const parent = node.parentNode;
          if (parent) {
            let fullText = node.textContent;
            const markerIndex = fullText.indexOf(markerPattern);
            
            if (markerIndex !== -1) {
              // Find the start - look backwards for opening bracket or whitespace
              let startIndex = markerIndex;
              while (startIndex > 0 && (fullText[startIndex - 1] === '[' || /\s/.test(fullText[startIndex - 1]))) {
                if (fullText[startIndex - 1] === '[') {
                  startIndex--; // Include the opening bracket
                  break;
                }
                startIndex--; // Include whitespace
              }
              
              // Find the end - look forwards for closing bracket or whitespace
              let endIndex = markerIndex + markerPattern.length;
              while (endIndex < fullText.length && (fullText[endIndex] === ']' || /\s/.test(fullText[endIndex]))) {
                endIndex++; // Include whitespace or closing bracket
                if (fullText[endIndex - 1] === ']') {
                  break; // Stop after closing bracket
                }
              }
              
              const textBefore = fullText.substring(0, startIndex);
              const textAfter = fullText.substring(endIndex);
              
              parent.insertBefore(document.createTextNode(textBefore), node);
              parent.insertBefore(buttonContainer, node);
              
              if (textAfter.trim()) {
                parent.insertBefore(document.createTextNode(textAfter), node);
              }
              parent.removeChild(node);
            }
          }
          break;
        }
      }
    });
  }

  /**
   * Perform semantic search using embeddings
   * Constructs search query, embeds it, and searches the embedding database
   */
  async performSemanticSearch(userQuery, options = {}) {
    const {
      maxResults = 20,
      minSimilarity = 0.0,
      dataset = null,
      constructQuery = true
    } = options;

    // Check prerequisites
    if (this.papers.length === 0) {
      throw new Error('Please load papers first by selecting a dataset and clicking "Load Papers".');
    }

    if (!this.geminiApiKey) {
      throw new Error('Please set your Gemini API key in Settings first. Embedding-based search requires an API key.');
    }

    const targetDataset = dataset || this.currentDataset;
    if (!targetDataset) {
      throw new Error('No dataset loaded. Please load a dataset first.');
    }

    try {
      // Step 1: Construct search query using LLM
      const searchQuery = constructQuery 
        ? await this.constructSearchQuery(userQuery)
        : userQuery;

      // Step 2: Get embedding for search query
      let queryEmbedding;
      if (window.electronAPI && window.electronAPI.getEmbeddings) {
        const result = await window.electronAPI.getEmbeddings({
          apiKey: this.geminiApiKey,
          texts: [searchQuery]
        });

        if (result.error) {
          throw new Error(`Failed to generate embedding: ${result.error}`);
        }

        if (!result.embeddings || result.embeddings.length === 0) {
          throw new Error('Failed to generate embedding: No embeddings returned');
        }

        queryEmbedding = result.embeddings[0];
      } else {
        throw new Error('Embedding API not available');
      }

      // Step 3: Load embeddings from database
      let databaseEmbeddings = [];
      if (window.electronAPI && window.electronAPI.loadEmbeddings) {
        const cached = await window.electronAPI.loadEmbeddings({
          dataset: targetDataset,
          type: 'papers'
        });

        if (cached.success && cached.embeddings) {
          databaseEmbeddings = cached.embeddings;
        } else {
          throw new Error('No embeddings found in database. Please compute embeddings first.');
        }
      } else {
        throw new Error('Embedding loading API not available');
      }

      if (databaseEmbeddings.length === 0) {
        throw new Error('Embedding database is empty. Please compute embeddings first.');
      }

      // Step 4: Perform similarity search
      const scoredResults = databaseEmbeddings
        .map(item => {
          let paper = null;
          let forumId = item.forumId;

          // Find the corresponding paper
          if (forumId) {
            paper = this.papers.find(p => p.forum === forumId);
          } else if (item.paperIndex !== undefined && this.papers[item.paperIndex]) {
            paper = this.papers[item.paperIndex];
            forumId = paper.forum || `index_${item.paperIndex}`;
          }

          if (!paper || !item.embedding) {
            return null;
          }

          const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);

          return {
            paper: paper,
            forumId: forumId,
            similarity: similarity,
            text: item.text || (paper.abstract ? this.cleanAbstract(paper.abstract) : ''),
            embedding: item.embedding
          };
        })
        .filter(item => item !== null && item.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);

      return {
        query: searchQuery,
        originalQuery: userQuery,
        results: scoredResults,
        totalResults: scoredResults.length,
        dataset: targetDataset
      };
    } catch (error) {
      console.error('Error performing semantic search:', error);
      throw error;
    }
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
    this.applySyntaxHighlighting(messageDiv);

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
        this.applySyntaxHighlighting(messageDiv);
      }
    }
  }

  updateMessageHtml(messageId, htmlContent) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
      const contentDiv = messageDiv.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.innerHTML = htmlContent;
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        this.applySyntaxHighlighting(messageDiv);
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
    const rawText = content || '';
    const codeBlocks = [];
    const textWithPlaceholders = rawText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const token = `__CODE_BLOCK_${codeBlocks.length}__`;
      const escapedCode = this.escapeHtml(code);
      const languageClass = language ? ` class="language-${language.toLowerCase()}"` : '';
      codeBlocks.push(`<pre><code${languageClass}>${escapedCode}</code></pre>`);
      return token;
    });

    const text = this.escapeHtml(textWithPlaceholders);
    const lines = text.split('\n');
    let html = '';
    let inList = false;
    let listType = null;

    const applyInlineMarkdown = (value) => {
      let formatted = value;
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
      formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
      formatted = this.applyInlineMath(formatted);
      return formatted;
    };

    const closeList = () => {
      if (inList) {
        html += listType === 'ol' ? '</ol>' : '</ul>';
        inList = false;
        listType = null;
      }
    };

    lines.forEach((line) => {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        html += `<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`;
        return;
      }

      if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
        closeList();
        html += '<hr>';
        return;
      }

      const blockquoteMatch = line.match(/^>\s+(.+)$/);
      if (blockquoteMatch) {
        closeList();
        html += `<blockquote>${applyInlineMarkdown(blockquoteMatch[1])}</blockquote>`;
        return;
      }

      const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (orderedMatch) {
        if (!inList || listType !== 'ol') {
          closeList();
          html += '<ol>';
          inList = true;
          listType = 'ol';
        }
        html += `<li>${applyInlineMarkdown(orderedMatch[1])}</li>`;
        return;
      }

      const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
      if (listMatch) {
        if (!inList || listType !== 'ul') {
          closeList();
          html += '<ul>';
          inList = true;
          listType = 'ul';
        }
        html += `<li>${applyInlineMarkdown(listMatch[1])}</li>`;
        return;
      }

      closeList();

      if (!line.trim()) {
        html += '<br>';
        return;
      }

      html += `<p>${applyInlineMarkdown(line)}</p>`;
    });

    closeList();

    codeBlocks.forEach((block, index) => {
      html = html.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return html;
  }

  applyInlineMath(value) {
    let formatted = value;
    formatted = formatted.replace(/\\\[(.+?)\\\]/g, '<div class="math-block">$1</div>');
    formatted = formatted.replace(/\$\$([\s\S]+?)\$\$/g, '<div class="math-block">$1</div>');
    formatted = formatted.replace(/\\\((.+?)\\\)/g, '<span class="math-inline">$1</span>');
    return formatted;
  }

  applySyntaxHighlighting(container) {
    if (!window.hljs || !container) {
      return;
    }
    const blocks = container.querySelectorAll('pre code');
    blocks.forEach((block) => {
      window.hljs.highlightElement(block);
    });
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

