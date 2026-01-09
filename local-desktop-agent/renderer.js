// Renderer process script
class ThesisEditor {
  constructor() {
    this.references = [];
    this.editingRefId = null;
    this.nextRefId = 1;
    this.nextImageId = 1;
    this.highlightedRefId = null; // Track currently highlighted reference
    
    this.init();
    this.loadFromStorage();
    // Wrap citations in spans after loading content
    setTimeout(() => this.ensureCitationsWrapped(), 100);
    this.initTabs();
  }
  
  initTabs() {
    const tabThesis = document.getElementById('tab-thesis');
    const tabAgent = document.getElementById('tab-agent');
    const workspace = document.querySelector('.workspace');
    const agentSection = document.getElementById('agent-section');
    
    if (tabThesis && tabAgent && workspace && agentSection) {
      tabThesis.addEventListener('click', () => {
        tabThesis.classList.add('active');
        tabAgent.classList.remove('active');
        workspace.style.display = 'flex';
        agentSection.style.display = 'none';
      });
      
      tabAgent.addEventListener('click', () => {
        tabAgent.classList.add('active');
        tabThesis.classList.remove('active');
        workspace.style.display = 'none';
        agentSection.style.display = 'block';
      });
    }
  }

  init() {
    // DOM elements
    this.thesisEditor = document.getElementById('thesis-editor');
    this.referencesList = document.getElementById('references-list');
    this.addRefBtn = document.getElementById('add-ref-btn');
    this.insertImageBtn = document.getElementById('insert-image-btn');
    this.saveBtn = document.getElementById('save-btn');
    this.exportBtn = document.getElementById('export-btn');
    this.exportHtmlBtn = document.getElementById('export-html-btn');
    
    // Check if elements exist
    if (!this.insertImageBtn) {
      console.error('Insert Image button not found!');
      return;
    }
    
    // Modal elements
    this.modal = document.getElementById('ref-modal');
    this.refForm = document.getElementById('ref-form');
    this.modalTitle = document.getElementById('modal-title');
    this.closeModal = document.getElementById('close-modal');
    this.cancelRefBtn = document.getElementById('cancel-ref-btn');
    
    // Form inputs
    this.refTitle = document.getElementById('ref-title');
    this.refAuthors = document.getElementById('ref-authors');
    this.refYear = document.getElementById('ref-year');
    this.refVenue = document.getElementById('ref-venue');
    this.refUrl = document.getElementById('ref-url');
    this.refNotes = document.getElementById('ref-notes');

    // BibTeX elements
    this.bibtexText = document.getElementById('bibtex-text');
    this.bibtexInput = document.getElementById('bibtex-input');
    this.formFields = document.getElementById('form-fields');
    this.toggleFormMode = document.getElementById('toggle-form-mode');
    this.toggleBibtexMode = document.getElementById('toggle-bibtex-mode');
    this.parseBibtexBtn = document.getElementById('parse-bibtex-btn');
    this.cancelRefBtnBibtex = document.getElementById('cancel-ref-btn-bibtex');
    this.inputMode = 'form'; // 'form' or 'bibtex'

    // Event listeners
    this.addRefBtn.addEventListener('click', () => this.openAddRefModal());
    
    // Add event listener for insert image button with error handling
    if (this.insertImageBtn) {
    this.insertImageBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Insert Image button clicked');
      // Always insert side-by-side (will create new container or add to existing)
      this.insertImage(true).catch(err => {
        console.error('Error inserting image:', err);
        alert('Error inserting image: ' + err.message);
      });
    });
    } else {
      console.error('Cannot attach event listener: insertImageBtn is null');
    }
    this.saveBtn.addEventListener('click', () => this.save());
    this.exportBtn.addEventListener('click', () => this.export());
    this.exportHtmlBtn.addEventListener('click', () => this.exportAsHTML());
    this.closeModal.addEventListener('click', () => this.closeModalDialog());
    this.cancelRefBtn.addEventListener('click', () => this.closeModalDialog());
    this.cancelRefBtnBibtex.addEventListener('click', () => this.closeModalDialog());
    this.refForm.addEventListener('submit', (e) => this.handleRefSubmit(e));
    this.toggleFormMode.addEventListener('click', () => this.switchToFormMode());
    this.toggleBibtexMode.addEventListener('click', () => this.switchToBibtexMode());
    this.parseBibtexBtn.addEventListener('click', () => this.parseBibTeX());
    
    // Auto-save on thesis editor change
    this.thesisEditor.addEventListener('input', () => {
      this.saveToStorage();
    });

    // Handle paste events for images
    this.thesisEditor.addEventListener('paste', (e) => this.handlePaste(e));

    // Handle drag and drop for images
    this.thesisEditor.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.thesisEditor.addEventListener('drop', (e) => this.handleDrop(e));

    // Close modal on outside click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModalDialog();
      }
    });
    
    // Click to select/deselect images or deselect when clicking on text
    this.thesisEditor.addEventListener('click', (e) => {
      // Check if clicking on image-related elements
      const clickedFigure = e.target.closest('figure');
      const clickedImageContainer = e.target.closest('.image-container');
      const clickedResizeHandle = e.target.closest('.resize-handle');
      const clickedCaption = e.target.closest('figcaption');
      
      // Don't deselect if clicking on resize handle (that's for resizing)
      if (clickedResizeHandle) {
        return;
      }
      
      // If clicking on caption, don't deselect (allow caption editing)
      if (clickedCaption && clickedCaption.isContentEditable) {
        return;
      }
      
      // If clicking on an already selected image, deselect it
      if (clickedFigure && clickedFigure.classList.contains('selected')) {
        this.deselectAllImages();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // If clicking on image container or figure, let the image's click handler deal with it
      if (clickedImageContainer || clickedFigure) {
        return; // Image click handler will select it
      }
      
      // Otherwise, deselect all images (clicking on text or empty space)
      this.deselectAllImages();
    });
    
    // Handle Delete/Backspace key to delete selected images
    this.thesisEditor.addEventListener('keydown', (e) => {
      // Don't delete if user is editing a caption
      if (e.target.tagName === 'FIGCAPTION' && e.target.isContentEditable) {
        return;
      }
      
      // Delete selected images with Delete or Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedFigures = this.thesisEditor.querySelectorAll('figure.selected');
        if (selectedFigures.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          
          selectedFigures.forEach(figure => {
            this.deleteImage(figure);
          });
        }
      }
      
      // Escape key to deselect
      if (e.key === 'Escape') {
        this.deselectAllImages();
      }
    });
    
    // Handle Ctrl+S / Cmd+S for save
    document.addEventListener('keydown', (e) => {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        this.save();
      }
    });
  }

  selectImage(figure) {
    // Deselect all other images
    this.deselectAllImages();
    
    // Select this image
    figure.classList.add('selected');
    const imageContainer = figure.querySelector('.image-container');
    if (imageContainer) {
      imageContainer.classList.add('selected');
    }
  }

  deselectAllImages() {
    this.thesisEditor.querySelectorAll('figure.selected').forEach(fig => {
      fig.classList.remove('selected');
      const container = fig.querySelector('.image-container');
      if (container) {
        container.classList.remove('selected');
      }
    });
  }

  deleteImage(figure) {
    // Check if figure is in a side-by-side container
    const sideBySideContainer = figure.closest('.images-side-by-side');
    
    if (sideBySideContainer) {
      // Store reference to next sibling before removal (for regular figures outside container)
      const nextSibling = figure.nextSibling;
      
      // Remove the figure from side-by-side container
      figure.remove();
      
      // If only one figure left, remove side-by-side wrapper and restore normal layout
      const remainingFigures = sideBySideContainer.querySelectorAll('figure');
      if (remainingFigures.length === 1) {
        const singleFigure = remainingFigures[0];
        const parent = sideBySideContainer.parentNode;
        const brAfter = sideBySideContainer.nextSibling;
        parent.insertBefore(singleFigure, sideBySideContainer);
        if (brAfter && brAfter.nodeType === Node.ELEMENT_NODE && brAfter.tagName === 'BR') {
          singleFigure.after(brAfter);
        }
        sideBySideContainer.remove();
      } else if (remainingFigures.length === 0) {
        // No figures left, remove the empty container and any trailing BR
        const brAfter = sideBySideContainer.nextSibling;
        if (brAfter && brAfter.nodeType === Node.ELEMENT_NODE && brAfter.tagName === 'BR') {
          brAfter.remove();
        }
        sideBySideContainer.remove();
      }
    } else {
      // Regular figure, remove it and clean up trailing BR if exists
      const nextSibling = figure.nextSibling;
      figure.remove();
      
      // Clean up BR tag that was after the figure
      if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.tagName === 'BR') {
        nextSibling.remove();
      }
    }
    
    this.deselectAllImages();
    this.saveToStorage();
  }

  setupImageResize(container, handle, img) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    const self = this; // Store reference to this

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      
      const rect = img.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startWidth = rect.width;
      startHeight = rect.height;
      
      // Store original aspect ratio if Shift key is held
      const aspectRatio = startWidth / startHeight;
      
      function onMouseMove(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startWidth + deltaX;
        let newHeight = startHeight + deltaY;
        
        // Maintain aspect ratio if Shift key is pressed
        if (e.shiftKey) {
          newHeight = newWidth / aspectRatio;
        }
        
        // Set minimum size
        const minSize = 50;
        newWidth = Math.max(minSize, newWidth);
        newHeight = Math.max(minSize, newHeight);
        
        img.style.width = newWidth + 'px';
        img.style.height = newHeight + 'px';
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
      }
      
      function onMouseUp() {
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        self.saveToStorage();
      }
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  async insertImage(sideBySide = false) {
    // Use Electron's file dialog to select an image
    if (window.electronAPI && window.electronAPI.selectImage) {
      const result = await window.electronAPI.selectImage();
      if (result && result.dataUrl) {
        this.insertImageAtCursor(result.dataUrl, result.fileName, sideBySide);
      }
    } else {
      // Fallback for browser testing - use file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.insertImageAtCursor(event.target.result, file.name, sideBySide);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  }

  insertImageAtCursor(dataUrl, fileName = 'image', sideBySide = false) {
    const imgId = `img-${this.nextImageId++}`;
    
    // Create figure with image and caption
    const figure = document.createElement('figure');
    figure.id = imgId;
    figure.className = 'thesis-image';
    
    // Create resize handle first
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.innerHTML = '◢';
    resizeHandle.title = 'Drag to resize image';
    
    // Wrap image in a container for resizing
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';
    
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = fileName;
    img.title = 'Click to select, drag corners to resize';
    img.draggable = false; // Prevent dragging the image itself
    
    // Append image and resize handle to container
    imageContainer.appendChild(img);
    imageContainer.appendChild(resizeHandle);
    
    // Add click handler for selection - reference imageContainer after it's created
    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectImage(figure);
      return false;
    });
    
    // Add click handler to container
    imageContainer.addEventListener('click', (e) => {
      // Don't handle if clicking resize handle
      if (e.target === resizeHandle) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      this.selectImage(figure);
      return false;
    });
    
    // Set up resize functionality
    this.setupImageResize(imageContainer, resizeHandle, img);
    
    const figcaption = document.createElement('figcaption');
    figcaption.contentEditable = 'true';
    figcaption.textContent = `Figure: ${fileName}`;
    figcaption.setAttribute('data-placeholder', 'Enter caption...');
    
    // Handle Enter key to create line breaks
    figcaption.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.execCommand('insertLineBreak', false, null);
      }
    });
    
    figcaption.addEventListener('blur', () => this.saveToStorage());
    figcaption.addEventListener('input', () => this.saveToStorage());
    
    figure.appendChild(imageContainer);
    figure.appendChild(figcaption);
    
    // Insert at cursor position
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Check if we're inside the thesis editor
      if (this.thesisEditor.contains(range.commonAncestorContainer)) {
        // Check if we should insert side by side
        if (sideBySide) {
          const sideBySideContainer = this.findOrCreateSideBySideContainer(range);
          sideBySideContainer.appendChild(figure);
          
          // Add a new line after the side-by-side container
          const br = document.createElement('br');
          sideBySideContainer.after(br);
          
          range.setStartAfter(br);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          range.deleteContents();
          range.insertNode(figure);
          
          // Add a new line after the figure
          const br = document.createElement('br');
          figure.after(br);
          
          // Move cursor after the figure
          range.setStartAfter(br);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        // If cursor is not in editor, append to end
        this.thesisEditor.appendChild(figure);
        this.thesisEditor.appendChild(document.createElement('br'));
      }
    } else {
      // No selection, append to end
      this.thesisEditor.appendChild(figure);
      this.thesisEditor.appendChild(document.createElement('br'));
    }
    
    this.thesisEditor.focus();
    this.saveToStorage();
  }

  findOrCreateSideBySideContainer(range) {
    // Check if we're inside an existing side-by-side container
    let node = range.startContainer;
    while (node && node !== this.thesisEditor) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains('images-side-by-side')) {
        return node;
      }
      node = node.parentNode;
    }
    
    // Check if previous sibling is a figure or side-by-side container
    const prevSibling = this.getPreviousSiblingElement(range.startContainer);
    if (prevSibling) {
      if (prevSibling.tagName === 'FIGURE') {
        // Create side-by-side wrapper and move previous figure into it
        const sideBySideWrapper = document.createElement('div');
        sideBySideWrapper.className = 'images-side-by-side';
        prevSibling.parentNode.insertBefore(sideBySideWrapper, prevSibling);
        sideBySideWrapper.appendChild(prevSibling);
        return sideBySideWrapper;
      } else if (prevSibling.classList && prevSibling.classList.contains('images-side-by-side')) {
        return prevSibling;
      }
    }
    
    // Create new side-by-side container
    const sideBySideWrapper = document.createElement('div');
    sideBySideWrapper.className = 'images-side-by-side';
    
    // Insert the wrapper
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      range.startContainer.parentNode.insertBefore(sideBySideWrapper, range.startContainer);
    } else {
      range.insertNode(sideBySideWrapper);
    }
    
    return sideBySideWrapper;
  }

  getPreviousSiblingElement(node) {
    // Get the previous sibling element (skip text nodes)
    let sibling = node.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE) {
        return sibling;
      }
      sibling = sibling.previousSibling;
    }
    
    // Check parent's previous siblings
    if (node.parentNode && node.parentNode !== this.thesisEditor) {
      sibling = node.parentNode.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE) {
          return sibling;
        }
        sibling = sibling.previousSibling;
      }
    }
    
    return null;
  }

  handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          this.insertImageAtCursor(event.target.result, 'pasted-image');
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.insertImageAtCursor(event.target.result, file.name);
      };
      reader.readAsDataURL(file);
    }
  }

  openAddRefModal(refId = null) {
    this.editingRefId = refId;
    
    // Reset to form mode when opening modal
    this.switchToFormMode();
    
    if (refId) {
      // Edit mode
      const ref = this.references.find(r => r.id === refId);
      if (ref) {
        this.modalTitle.textContent = 'Edit Reference';
        this.refTitle.value = ref.title || '';
        this.refAuthors.value = ref.authors || '';
        this.refYear.value = ref.year || '';
        this.refVenue.value = ref.venue || '';
        this.refUrl.value = ref.url || '';
        this.refNotes.value = ref.notes || '';
      }
    } else {
      // Add mode
      this.modalTitle.textContent = 'Add Reference';
      this.refForm.reset();
      this.bibtexText.value = '';
    }
    
    this.modal.classList.add('active');
    this.refTitle.focus();
  }

  switchToFormMode() {
    this.inputMode = 'form';
    this.formFields.style.display = 'block';
    this.bibtexInput.style.display = 'none';
    this.toggleFormMode.classList.add('active');
    this.toggleBibtexMode.classList.remove('active');
  }

  switchToBibtexMode() {
    this.inputMode = 'bibtex';
    this.formFields.style.display = 'none';
    this.bibtexInput.style.display = 'block';
    this.toggleFormMode.classList.remove('active');
    this.toggleBibtexMode.classList.add('active');
    this.bibtexText.focus();
  }

  parseBibTeX() {
    const bibtex = this.bibtexText.value.trim();
    if (!bibtex) {
      alert('Please paste a BibTeX entry.');
      return;
    }

    try {
      const parsed = this.parseBibTeXEntry(bibtex);
      
      // Populate form fields
      this.refTitle.value = parsed.title || '';
      this.refAuthors.value = parsed.authors || '';
      this.refYear.value = parsed.year || '';
      this.refVenue.value = parsed.venue || '';
      this.refUrl.value = parsed.url || '';
      this.refNotes.value = parsed.notes || '';

      // Switch to form mode to show the populated fields
      this.switchToFormMode();
      
      // Show success message
      alert('BibTeX parsed successfully! Review and save the reference.');
      this.refTitle.focus();
    } catch (error) {
      alert('Error parsing BibTeX: ' + error.message);
      console.error('BibTeX parsing error:', error);
    }
  }

  parseBibTeXEntry(bibtex) {
    // Remove comments and normalize whitespace
    bibtex = bibtex.replace(/%.*$/gm, '').trim();
    
    // Match BibTeX entry: @type{key, fields}
    const entryMatch = bibtex.match(/@(\w+)\s*\{([^,]+),\s*([\s\S]*)\}/);
    if (!entryMatch) {
      throw new Error('Invalid BibTeX format. Expected @type{key, fields}');
    }

    const [, entryType, entryKey, fieldsText] = entryMatch;
    const result = {
      entryType: entryType.toLowerCase(),
      entryKey: entryKey.trim(),
      title: '',
      authors: '',
      year: '',
      venue: '',
      url: '',
      notes: ''
    };

    // Parse fields (handle both {value} and "value" formats)
    const fieldRegex = /(\w+)\s*=\s*\{([^}]*)\}|(\w+)\s*=\s*"([^"]*)"/g;
    let match;
    const fields = {};

    while ((match = fieldRegex.exec(fieldsText)) !== null) {
      const key = (match[1] || match[3]).toLowerCase();
      const value = (match[2] || match[4]).trim();
      fields[key] = value;
    }

    // Map BibTeX fields to our format
    result.title = fields.title || fields.booktitle || '';
    
    // Parse authors (handle "and" separators)
    if (fields.author) {
      result.authors = this.formatAuthors(fields.author);
    }

    result.year = fields.year || fields.date?.match(/\d{4}/)?.[0] || '';
    
    // Venue/Journal mapping based on entry type
    if (entryType === 'article') {
      result.venue = fields.journal || fields.journaltitle || '';
    } else if (entryType === 'inproceedings' || entryType === 'conference') {
      result.venue = fields.booktitle || fields.journal || '';
    } else if (entryType === 'book') {
      result.venue = fields.publisher || '';
    } else {
      result.venue = fields.journal || fields.booktitle || fields.venue || '';
    }

    result.url = fields.url || fields.link || '';
    
    // Store additional info in notes
    const notes = [];
    if (fields.abstract) notes.push(`Abstract: ${fields.abstract}`);
    if (fields.doi) notes.push(`DOI: ${fields.doi}`);
    if (fields.note) notes.push(fields.note);
    result.notes = notes.join('\n');

    return result;
  }

  formatAuthors(authorString) {
    // BibTeX authors are typically separated by "and"
    // Format: "Last, First and Last, First" or "First Last and First Last"
    const authors = authorString.split(/\s+and\s+/i).map(author => {
      author = author.trim();
      // Check if it's "Last, First" format
      if (author.includes(',')) {
        return author; // Keep as is
      } else {
        // "First Last" format - try to split on last space
        const parts = author.split(/\s+/);
        if (parts.length >= 2) {
          const last = parts[parts.length - 1];
          const first = parts.slice(0, -1).join(' ');
          return `${last}, ${first}`;
        }
        return author;
      }
    });
    
    return authors.join(' & ');
  }

  closeModalDialog() {
    this.modal.classList.remove('active');
    this.editingRefId = null;
    this.refForm.reset();
    this.bibtexText.value = '';
    this.switchToFormMode();
  }

  handleRefSubmit(e) {
    e.preventDefault();
    
    const refData = {
      title: this.refTitle.value.trim(),
      authors: this.refAuthors.value.trim(),
      year: this.refYear.value.trim(),
      venue: this.refVenue.value.trim(),
      url: this.refUrl.value.trim(),
      notes: this.refNotes.value.trim()
    };

    if (this.editingRefId) {
      // Update existing reference
      const index = this.references.findIndex(r => r.id === this.editingRefId);
      if (index !== -1) {
        this.references[index] = { ...this.references[index], ...refData };
      }
    } else {
      // Add new reference
      const newRef = {
        id: `ref${this.nextRefId++}`,
        ...refData
      };
      this.references.push(newRef);
    }

    this.renderReferences();
    this.closeModalDialog();
    this.saveToStorage();
  }

  deleteReference(refId) {
    if (confirm('Are you sure you want to delete this reference? This will also remove all citations of this reference from your thesis.')) {
      // Remove all citations of this reference from the thesis editor
      this.removeCitationsFromThesis(refId);
      
      // Remove the reference from the list
      this.references = this.references.filter(r => r.id !== refId);
      this.renderReferences();
      this.saveToStorage();
    }
  }

  // Remove all citations of a reference from the thesis editor
  removeCitationsFromThesis(refId) {
    const editor = this.thesisEditor;
    if (!editor) return;
    
    const citationText = `[@${refId}]`;
    let removedCount = 0;
    
    // First, try to find wrapped citations
    const citationSelector = `span.citation-wrapper[data-citation-ref="${refId}"]`;
    const citations = Array.from(editor.querySelectorAll(citationSelector));
    const parentsToNormalize = new Set();
    
    // Remove each citation wrapper and clean up surrounding whitespace
    citations.forEach(citation => {
      const parent = citation.parentNode;
      if (!parent) return;
      
      // Store parent for later normalization
      parentsToNormalize.add(parent);
      
      // Check for whitespace before and after the citation
      const prevSibling = citation.previousSibling;
      const nextSibling = citation.nextSibling;
      
      // Remove the citation span
      parent.removeChild(citation);
      removedCount++;
      
      // Clean up extra spaces: if previous sibling ends with space and next starts with space,
      // merge them to a single space
      if (prevSibling && nextSibling && 
          prevSibling.nodeType === Node.TEXT_NODE && 
          nextSibling.nodeType === Node.TEXT_NODE) {
        const prevText = prevSibling.textContent;
        const nextText = nextSibling.textContent;
        
        // If both end/start with space, clean up
        if (prevText.endsWith(' ') && nextText.startsWith(' ')) {
          nextSibling.textContent = nextText.substring(1); // Remove leading space from next
        }
      }
    });
    
    // Also check for unwrapped citations (in case they weren't wrapped yet)
    if (removedCount === 0) {
      const escapedCitation = citationText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const citationRegex = new RegExp(escapedCitation, 'g');
      
      // Find text nodes containing this citation that aren't already wrapped
      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip if parent is already a citation wrapper
            if (node.parentElement && 
                (node.parentElement.classList.contains('citation-wrapper') || 
                 node.parentElement.classList.contains('citation-highlight'))) {
              return NodeFilter.FILTER_REJECT;
            }
            // Only accept nodes that contain the citation
            if (node.textContent && node.textContent.includes(citationText)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        },
        false
      );
      
      let textNode;
      while (textNode = walker.nextNode()) {
        const text = textNode.textContent;
        if (text.includes(citationText)) {
          // Remove the citation from text, clean up extra spaces
          let newText = text.replace(citationRegex, '');
          // Replace multiple spaces with single space
          newText = newText.replace(/\s+/g, ' ').trim();
          textNode.textContent = newText;
          removedCount++;
        }
      }
    }
    
    // Normalize only the specific parent elements that contained citations
    // This is safer than normalizing the entire editor
    if (removedCount > 0 && parentsToNormalize.size > 0) {
      // Only normalize parents that actually had citations removed
      parentsToNormalize.forEach(parent => {
        if (editor.contains(parent)) {
          parent.normalize();
        }
      });
    }
    
    if (removedCount > 0) {
      console.log(`Removed ${removedCount} citation(s) of reference ${refId} from thesis`);
    }
  }

  insertCitation() {
    if (this.references.length === 0) {
      alert('Please add at least one reference first.');
      return;
    }

    // Create a simple selection dialog
    const refList = this.references.map((ref, index) => 
      `${index + 1}. ${ref.title || 'Untitled'}`
    ).join('\n');
    
    const selection = prompt(
      `Select a reference to cite:\n\n${refList}\n\nEnter the number:`
    );
    
    const refIndex = parseInt(selection) - 1;
    if (refIndex >= 0 && refIndex < this.references.length) {
      const ref = this.references[refIndex];
      this.insertTextAtCursor(`[@${ref.id}]`);
      this.saveToStorage();
    }
  }

  insertTextAtCursor(text) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Check if we're inside the thesis editor
      if (this.thesisEditor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Move cursor after the inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // If cursor is not in editor, append to end
        this.thesisEditor.appendChild(document.createTextNode(text));
      }
    } else {
      // No selection, append to end
      this.thesisEditor.appendChild(document.createTextNode(text));
    }
    this.thesisEditor.focus();
  }

  renderReferences() {
    if (this.references.length === 0) {
      this.referencesList.innerHTML = `
        <div class="empty-state">
          <p>No references yet.</p>
          <p>Click "Add Reference" to get started.</p>
        </div>
      `;
      return;
    }

    this.referencesList.innerHTML = this.references.map(ref => {
      const citation = `[@${ref.id}]`;
      const isHighlighted = this.highlightedRefId === ref.id;
      const highlightClass = isHighlighted ? 'highlighted' : '';
      return `
        <div class="reference-item ${highlightClass}" data-ref-id="${ref.id}">
          <div class="reference-header">
            <div>
              <div class="reference-id">${citation}</div>
              <div class="reference-title">${this.escapeHtml(ref.title || 'Untitled')}</div>
            </div>
          </div>
          <div class="reference-meta">
            ${ref.authors ? `<div><strong>Authors:</strong> ${this.escapeHtml(ref.authors)}</div>` : ''}
            ${ref.year ? `<div><strong>Year:</strong> ${ref.year}</div>` : ''}
            ${ref.venue ? `<div><strong>Venue:</strong> ${this.escapeHtml(ref.venue)}${ref.presentation ? ` (${this.escapeHtml(ref.presentation)})` : ''}</div>` : ''}
            ${ref.url ? `<div><strong>URL:</strong> <a href="${this.escapeHtml(ref.url)}" target="_blank">${this.escapeHtml(ref.url)}</a></div>` : ''}
            ${ref.notes ? `<div style="margin-top: 0.5rem; font-style: italic;">${this.escapeHtml(ref.notes)}</div>` : ''}
          </div>
          <div class="reference-actions">
            <button class="btn btn-edit" onclick="thesisApp.insertCitationForRef('${ref.id}')">Insert</button>
            <button class="btn btn-edit" onclick="thesisApp.openAddRefModal('${ref.id}')">Edit</button>
            <button class="btn btn-danger" onclick="thesisApp.deleteReference('${ref.id}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers for highlighting citations
    this.referencesList.querySelectorAll('.reference-item').forEach(item => {
      const refId = item.getAttribute('data-ref-id');
      
      // Add click handler to the entire reference item (but not buttons)
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons or links
        if (e.target.closest('.reference-actions') || e.target.closest('a')) {
          return;
        }
        
        e.stopPropagation();
        this.toggleCitationHighlight(refId);
      });
    });
  }

  insertCitationForRef(refId) {
    const ref = this.references.find(r => r.id === refId);
    if (!ref) return;
    
    // Insert citation and wrap it immediately
    this.insertTextAtCursor(`[@${refId}]`);
    // Wrap the newly inserted citation
    setTimeout(() => this.ensureCitationsWrapped(), 50);
    this.saveToStorage();
  }

  // Toggle citation highlighting in thesis editor
  toggleCitationHighlight(refId) {
    // If clicking the same reference, deselect
    if (this.highlightedRefId === refId) {
      this.clearCitationHighlight();
      return;
    }
    
    // Clear previous highlight
    this.clearCitationHighlight();
    
    // Highlight new reference
    this.highlightedRefId = refId;
    this.highlightCitations(refId);
    this.renderReferences(); // Update UI to show highlighted state
  }

  // Ensure all citations are wrapped in spans (call this once, idempotent)
  ensureCitationsWrapped() {
    const editor = this.thesisEditor;
    if (!editor) return;
    
    // Quick check: if all citations are already wrapped, skip
    const allText = editor.textContent || '';
    const citationMatches = allText.match(/\[@[^\]]+\]/g);
    if (!citationMatches || citationMatches.length === 0) {
      return; // No citations to wrap
    }
    
    // Check if citations are already wrapped (quick check)
    const existingWrappers = editor.querySelectorAll('.citation-wrapper');
    if (existingWrappers.length === citationMatches.length) {
      // All citations might already be wrapped, but verify
      let allWrapped = true;
      citationMatches.forEach(citationText => {
        const refId = citationText.match(/\[@([^\]]+)\]/)[1];
        const wrapper = editor.querySelector(`.citation-wrapper[data-citation-ref="${refId}"]`);
        if (!wrapper || wrapper.textContent !== citationText) {
          allWrapped = false;
        }
      });
      if (allWrapped) {
        return; // All citations are already wrapped
      }
    }
    
    let iterationCount = 0;
    const maxIterations = 1000;
    
    while (iterationCount < maxIterations) {
      iterationCount++;
      
      // Find text nodes containing citations that are NOT already wrapped
      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip if parent is already a citation wrapper
            const parent = node.parentElement;
            if (parent && 
                (parent.classList.contains('citation-wrapper') || 
                 parent.classList.contains('citation-highlight'))) {
              return NodeFilter.FILTER_REJECT;
            }
            // Only accept nodes that contain citations
            if (node.textContent && /\[@[^\]]+\]/.test(node.textContent)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        },
        false
      );
      
      const textNode = walker.nextNode();
      if (!textNode) break; // No more unwrapped citations
      
      const text = textNode.textContent;
      const match = text.match(/\[@[^\]]+\]/);
      
      if (!match) continue;
      
      const index = match.index;
      const citationText = match[0];
      const parent = textNode.parentNode;
      if (!parent) continue;
      
      // Split: before, citation, after
      const beforeText = text.substring(0, index);
      const afterText = text.substring(index + citationText.length);
      
      // Create fragment
      const fragment = document.createDocumentFragment();
      
      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }
      
      // Wrap citation in span with class 'citation-wrapper'
      const citationSpan = document.createElement('span');
      citationSpan.className = 'citation-wrapper';
      citationSpan.textContent = citationText;
      const refIdMatch = citationText.match(/\[@([^\]]+)\]/);
      if (refIdMatch) {
        citationSpan.setAttribute('data-citation-ref', refIdMatch[1]);
      }
      citationSpan.setAttribute('contenteditable', 'false');
      fragment.appendChild(citationSpan);
      
      if (afterText) {
        fragment.appendChild(document.createTextNode(afterText));
      }
      
      parent.replaceChild(fragment, textNode);
    }
    
    if (iterationCount >= maxIterations) {
      console.warn('Reached maximum iterations while wrapping citations');
    }
  }

  // Highlight all citations of a reference by toggling className
  highlightCitations(refId) {
    const editor = this.thesisEditor;
    if (!editor) return;
    
    // First, ensure all citations are wrapped in spans
    this.ensureCitationsWrapped();
    
    // Find all citation wrappers matching this refId
    const citationSelector = `span.citation-wrapper[data-citation-ref="${refId}"]`;
    const citations = editor.querySelectorAll(citationSelector);
    
    // Add highlight class to matching citations
    citations.forEach(citation => {
      citation.classList.add('citation-highlight');
    });
    
    // Scroll to first highlighted citation if it exists
    if (citations.length > 0) {
      citations[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }

  // Clear all citation highlights by removing className
  clearCitationHighlight() {
    if (!this.highlightedRefId) return;
    
    const editor = this.thesisEditor;
    if (!editor) return;
    
    // Find all highlighted citations and remove the highlight class
    // Keep the citation-wrapper span, just remove the highlight class
    const highlights = editor.querySelectorAll('.citation-highlight');
    
    highlights.forEach(highlight => {
      highlight.classList.remove('citation-highlight');
    });
    
    // Citations remain wrapped in citation-wrapper spans, just not highlighted
    // No DOM manipulation needed - just className changes
    
    this.highlightedRefId = null;
    this.renderReferences(); // Update UI to remove highlighted state
  }

  // Generate citation ID in format: first-author-year-a,b,c,d
  generateCitationId(authors, year) {
    // Extract first author's last name
    let firstAuthorLastName = 'Unknown';
    
    if (authors && authors.trim()) {
      // Handle different formats: "Last, First", "First Last", "Last et al."
      const authorsStr = authors.trim();
      
      // If comma-separated (Last, First format)
      if (authorsStr.includes(',')) {
        const firstAuthor = authorsStr.split(',')[0].trim();
        firstAuthorLastName = firstAuthor.split(/\s+/)[0]; // Take first word (last name)
      } else {
        // Space-separated (First Last format) - take last word
        const parts = authorsStr.split(/\s+/);
        if (parts.length > 0) {
          firstAuthorLastName = parts[parts.length - 1]; // Last word is usually last name
        }
      }
      
      // Clean up: remove special characters, lowercase
      firstAuthorLastName = firstAuthorLastName.replace(/[^a-zA-Z0-9]/g, '');
      if (firstAuthorLastName.length === 0) {
        firstAuthorLastName = 'Unknown';
      }
    }
    
    // Get year (use current year if not provided)
    const citationYear = year || new Date().getFullYear().toString();
    
    // Base citation ID
    const baseId = `${firstAuthorLastName}-${citationYear}`.toLowerCase();
    
    // Check for duplicates and add suffix if needed
    let citationId = baseId;
    let suffix = '';
    let suffixIndex = 0;
    
    // Find all existing references with same base ID
    // Check both direct ID match and citationId property
    const existingWithSameBase = this.references.filter(r => {
      const rId = this.extractCitationIdFromRefId(r.id);
      // Also check if the reference has a citationId property that matches
      const rCitationId = r.citationId ? r.citationId.toLowerCase() : null;
      
      return (rId && rId.startsWith(baseId)) || (rCitationId && rCitationId.startsWith(baseId));
    });
    
    if (existingWithSameBase.length > 0) {
      // Get existing suffixes from all matching references
      const existingSuffixes = new Set();
      existingWithSameBase.forEach(r => {
        const rId = this.extractCitationIdFromRefId(r.id);
        const rCitationId = r.citationId ? r.citationId.toLowerCase() : null;
        const checkId = rId || rCitationId;
        
        if (checkId && checkId.startsWith(baseId)) {
          const remaining = checkId.substring(baseId.length);
          // Extract letter suffix (e.g., "-a", "-b") or empty string for base
          if (remaining === '') {
            existingSuffixes.add(''); // Base ID is already used
          } else {
            const match = remaining.match(/^-([a-z])$/);
            if (match) {
              existingSuffixes.add(match[1]);
            }
          }
        }
      });
      
      // Find next available suffix (a, b, c, d, ...)
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      if (!existingSuffixes.has('')) {
        // Base ID is available
        citationId = baseId;
      } else {
        // Need to find next letter suffix
        for (let i = 0; i < letters.length; i++) {
          if (!existingSuffixes.has(letters[i])) {
            suffix = `-${letters[i]}`;
            citationId = baseId + suffix;
            break;
          }
        }
      }
    }
    
    return citationId;
  }
  
  // Extract citation ID from reference ID (handles both formats: "ref1" or "smith-2024-a")
  extractCitationIdFromRefId(refId) {
    if (!refId) return null;
    // If it's in citation format (contains dash and year-like pattern), return as is
    // Pattern: lowercase letters, dash, 4 digits, optional dash and letter suffix
    if (/^[a-z]+-\d{4}(-[a-z])?$/i.test(refId)) {
      return refId.toLowerCase();
    }
    // Otherwise, it's an old format ref (like "ref1"), check if it has citationId property
    const ref = this.references.find(r => r.id === refId);
    if (ref && ref.citationId) {
      return ref.citationId.toLowerCase();
    }
    // If no citationId, it's an old reference - return null so we don't match it
    return null;
  }

  // Create a reference from paper data (for automatic reference creation from LLM agent)
  createReferenceFromPaper(paperData) {
    console.log('createReferenceFromPaper called with:', paperData);
    
    if (!paperData || !paperData.title) {
      console.error('Invalid paperData:', paperData);
      return null;
    }
    
    // Check if reference already exists by title (case-insensitive)
    const existingRef = this.references.find(r => 
      r.title && paperData.title && r.title.toLowerCase().trim() === paperData.title.toLowerCase().trim()
    );
    
    if (existingRef) {
      console.log(`Reference already exists: ${existingRef.title} (${existingRef.id})`);
      return existingRef.id;
    }
    
    // Generate citation ID using first-author-year format
    const citationId = this.generateCitationId(paperData.authors, paperData.year);
    console.log(`Generated citation ID: ${citationId} for "${paperData.title}"`);
    
    // Create new reference with citation ID
    const newRef = {
      id: citationId, // Use citation ID as the reference ID
      citationId: citationId, // Store separately as well for backwards compatibility
      title: paperData.title || paperData.originalTitle || 'Untitled',
      authors: paperData.authors || paperData.originalAuthors || '',
      year: paperData.year || paperData.originalYear || '',
      venue: paperData.venue || paperData.originalVenue || '',
      presentation: paperData.presentation || paperData.originalPresentation || '',
      url: paperData.url || paperData.originalUrl || '',
      notes: paperData.notes || paperData.originalNotes || ''
    };
    
    this.references.push(newRef);
    this.renderReferences();
    this.saveToStorage();
    
    console.log(`✓ Created reference: ${newRef.id} (${citationId}) - ${newRef.title}`);
    console.log(`Total references now: ${this.references.length}`);
    
    // Force UI update by triggering a custom event
    window.dispatchEvent(new CustomEvent('references-updated', { detail: { count: this.references.length } }));
    
    return newRef.id;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  save() {
    this.saveToStorage();
    alert('Thesis and references saved!');
  }

  saveToStorage() {
    const data = {
      thesis: this.thesisEditor.innerHTML,
      references: this.references,
      nextRefId: this.nextRefId,
      nextImageId: this.nextImageId,
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('thesisData', JSON.stringify(data));
  }

  loadFromStorage() {
    const saved = localStorage.getItem('thesisData');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.thesisEditor.innerHTML = data.thesis || '';
        this.references = data.references || [];
        this.nextRefId = data.nextRefId || this.references.length + 1;
        this.nextImageId = data.nextImageId || 1;
        this.renderReferences();
        
        // Re-attach event listeners for images and figcaptions
        this.thesisEditor.querySelectorAll('figure').forEach(figure => {
          const img = figure.querySelector('img');
          const imageContainer = figure.querySelector('.image-container');
          const resizeHandle = figure.querySelector('.resize-handle');
          
          if (img && imageContainer && resizeHandle) {
            img.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.selectImage(figure);
              return false;
            });
            
            imageContainer.addEventListener('click', (e) => {
              if (e.target === resizeHandle) {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              this.selectImage(figure);
              return false;
            });
            
            this.setupImageResize(imageContainer, resizeHandle, img);
          }
        });
        
        this.thesisEditor.querySelectorAll('figcaption').forEach(caption => {
          caption.contentEditable = 'true';
          if (!caption.hasAttribute('data-placeholder')) {
            caption.setAttribute('data-placeholder', 'Enter caption...');
          }
          
          caption.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              document.execCommand('insertLineBreak', false, null);
            }
          });
          
          caption.addEventListener('blur', () => this.saveToStorage());
          caption.addEventListener('input', () => this.saveToStorage());
        });
        
        // Reattach event handlers to existing buttons in loaded content
        this.reattachButtonHandlers();
        
        // Attach approve buttons to any existing edit-added elements that aren't wrapped yet
        this.attachApproveButtonsToExistingEdits();
      } catch (e) {
        console.error('Error loading saved data:', e);
      }
    }
  }

  export() {
    // Get text content (strip HTML but keep structure)
    const thesis = this.getPlainTextContent();
    const references = this.references;
    
    // Format references as bibliography
    let bibliography = '\n\n## References\n\n';
    references.forEach((ref, index) => {
      bibliography += `${index + 1}. `;
      if (ref.authors) bibliography += `${ref.authors}. `;
      if (ref.title) bibliography += `"${ref.title}". `;
      if (ref.venue) {
        bibliography += `${ref.venue}`;
        if (ref.presentation) bibliography += ` (${ref.presentation})`;
        bibliography += '. ';
      }
      if (ref.year) bibliography += `(${ref.year}). `;
      if (ref.url) bibliography += `URL: ${ref.url}`;
      bibliography += '\n\n';
    });

    const fullText = thesis + bibliography;
    
    // Create download
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thesis_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportAsHTML() {
    const thesis = this.thesisEditor.innerHTML;
    const references = this.references;
    
    // Format references as HTML
    let bibliography = '<h2>References</h2><ol>';
    references.forEach((ref) => {
      bibliography += '<li>';
      if (ref.authors) bibliography += `${this.escapeHtml(ref.authors)}. `;
      if (ref.title) bibliography += `"${this.escapeHtml(ref.title)}". `;
      if (ref.venue) {
        bibliography += `${this.escapeHtml(ref.venue)}`;
        if (ref.presentation) bibliography += ` (${this.escapeHtml(ref.presentation)})`;
        bibliography += '. ';
      }
      if (ref.year) bibliography += `(${ref.year}). `;
      if (ref.url) bibliography += `<a href="${this.escapeHtml(ref.url)}">${this.escapeHtml(ref.url)}</a>`;
      bibliography += '</li>';
    });
    bibliography += '</ol>';

    const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Thesis Export</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 2rem auto; padding: 1rem; line-height: 1.8; }
    figure { margin: 1.5rem 0; text-align: center; }
    figcaption { font-size: 0.9rem; color: #666; font-style: italic; }
    img { max-width: 100%; }
    h2 { margin-top: 2rem; }
    ol { padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <article>${thesis}</article>
  ${bibliography}
</body>
</html>`;
    
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thesis_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getPlainTextContent() {
    // Clone the editor content
    const clone = this.thesisEditor.cloneNode(true);
    
    // Replace images with placeholder text
    clone.querySelectorAll('figure').forEach((figure, index) => {
      const caption = figure.querySelector('figcaption')?.textContent || `Image ${index + 1}`;
      figure.replaceWith(`[${caption}]`);
    });
    
    // Replace br with newlines
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    
    // Get text content
    return clone.textContent || clone.innerText || '';
  }

  getThesisHTML() {
    return {
      html: this.thesisEditor.innerHTML,
      plainText: this.thesisEditor.textContent || this.thesisEditor.innerText
    };
  }

  // Helper: Wrap text in a highlight span
  wrapInHighlight(text) {
    const escapedText = this.escapeHtml(text).replace(/\n/g, '<br>');
    return `<span class="edit-highlight" data-edit-timestamp="${Date.now()}">${escapedText}</span>`;
  }

  // Helper: Check if an element is already wrapped in an edit-wrapper
  isAlreadyWrapped(element) {
    let parent = element.parentNode;
    while (parent && parent !== this.thesisEditor) {
      if (parent.classList && parent.classList.contains('edit-wrapper')) {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  }

  // Helper: Reattach event handlers to existing buttons in loaded content
  reattachButtonHandlers() {
    // Find all edit-wrapper structures that were loaded from storage
    const editWrappers = this.thesisEditor.querySelectorAll('.edit-wrapper');
    
    editWrappers.forEach((editWrapper) => {
      // Find the diff container and buttons
      const diffContainer = editWrapper.querySelector('.edit-diff-container');
      const approveWrapper = editWrapper.querySelector('.edit-approve-wrapper');
      const approveBtn = approveWrapper?.querySelector('.edit-approve-btn');
      const rejectBtn = approveWrapper?.querySelector('.edit-reject-btn');
      
      if (!diffContainer || !approveBtn || !rejectBtn) {
        return; // Skip if structure is incomplete
      }
      
      // Restore references
      diffContainer._approveWrapper = approveWrapper;
      diffContainer._editWrapper = editWrapper;
      
      // Remove old event listeners by cloning and replacing (clears all listeners)
      const newApproveBtn = approveBtn.cloneNode(true);
      const newRejectBtn = rejectBtn.cloneNode(true);
      
      // Attach new event handlers
      newApproveBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.acceptEdit(diffContainer);
      };
      newApproveBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      newRejectBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.rejectEdit(diffContainer);
      };
      newRejectBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      // Replace old buttons with new ones that have handlers
      approveWrapper.replaceChild(newApproveBtn, approveBtn);
      approveWrapper.replaceChild(newRejectBtn, rejectBtn);
    });
  }

  // Helper: Scan for existing edit-added elements and attach approve buttons
  attachApproveButtonsToExistingEdits() {
    const editAddedElements = this.thesisEditor.querySelectorAll('ins.edit-added, .edit-added');
    
    editAddedElements.forEach((addedElement) => {
      // Skip if already wrapped in an edit-wrapper structure
      if (this.isAlreadyWrapped(addedElement)) {
        return;
      }
      
      // Wrap the element with approve button structure
      const parent = addedElement.parentNode;
      if (parent) {
        // Save reference to next sibling before moving the element
        const nextSibling = addedElement.nextSibling;
        
        // Create wrapper and move element (this removes element from parent)
        const editWrapper = this.wrapEditWithApproveButton(addedElement);
        
        // Insert wrapper where the element was
        if (nextSibling) {
          parent.insertBefore(editWrapper, nextSibling);
        } else {
          parent.appendChild(editWrapper);
        }
      }
    });
  }

  // Helper: Wrap an edit-added element with approve button structure
  wrapEditWithApproveButton(addedElement) {
    // Create edit wrapper
    const editWrapper = document.createElement('span');
    editWrapper.className = 'edit-wrapper';
    
    // Create diff container
    const diffContainer = document.createElement('span');
    diffContainer.className = 'edit-diff-container';
    
    // Move added element into diff container
    diffContainer.appendChild(addedElement);
    editWrapper.appendChild(diffContainer);
    
    // Add approve/reject button wrapper
    const approveWrapper = document.createElement('span');
    approveWrapper.className = 'edit-approve-wrapper';
    
    // Accept button
    const approveBtn = document.createElement('button');
    approveBtn.className = 'edit-approve-btn';
    approveBtn.textContent = '✓ Accept';
    approveBtn.title = 'Accept this edit';
    approveBtn.setAttribute('aria-label', 'Accept edit');
    approveBtn.type = 'button';
    approveBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.acceptEdit(diffContainer);
    };
    approveBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    // Reject button
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'edit-reject-btn';
    rejectBtn.textContent = '✗ Reject';
    rejectBtn.title = 'Reject this edit';
    rejectBtn.setAttribute('aria-label', 'Reject edit');
    rejectBtn.type = 'button';
    rejectBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.rejectEdit(diffContainer);
    };
    rejectBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    approveWrapper.appendChild(approveBtn);
    approveWrapper.appendChild(rejectBtn);
    editWrapper.appendChild(approveWrapper);
    
    // Store references
    diffContainer._approveWrapper = approveWrapper;
    diffContainer._editWrapper = editWrapper;
    
    return editWrapper;
  }

  // Helper: Create diff view showing deleted and added text
  createDiffView(oldText, newText) {
    console.log('=== Creating diff view ===');
    console.log('oldText:', oldText);
    console.log('newText:', newText);
    
    const diffContainer = document.createElement('span');
    diffContainer.className = 'edit-diff-container';
    diffContainer.style.display = 'inline';
    diffContainer.style.visibility = 'visible';
    
    // Show deleted text (strikethrough, red) - always show if oldText exists
    // Use span instead of del to avoid browser default styles that might hide it
    const hasOldText = oldText && oldText.length > 0;
    
    if (hasOldText) {
      const deletedSpan = document.createElement('span');
      deletedSpan.className = 'edit-deleted';
      deletedSpan.textContent = oldText;
      
      // Force visibility with inline styles - inline styles have high specificity
      deletedSpan.style.cssText = 
        'background-color: #ffebee; ' +
        'color: #c62828; ' +
        'text-decoration: line-through; ' +
        'text-decoration-color: #d32f2f; ' +
        'text-decoration-thickness: 2px; ' +
        'display: inline; ' +
        'margin-right: 4px; ' +
        'padding: 1px 2px; ' +
        'visibility: visible; ' +
        'opacity: 1; ' +
        'line-height: inherit; ' +
        'font-size: inherit; ' +
        'font-weight: normal;';
      
      diffContainer.appendChild(deletedSpan);
      
      console.log('✓ Created deleted text element with text:', oldText.substring(0, 50));
      console.log('✓ Deleted span element:', deletedSpan);
      console.log('✓ Deleted span textContent:', deletedSpan.textContent);
      console.log('✓ Deleted span innerHTML:', deletedSpan.innerHTML);
      console.log('✓ Deleted span style:', deletedSpan.style.cssText);
      console.log('✓ Deleted span parent:', deletedSpan.parentElement);
      console.log('✓ Deleted span is in DOM:', document.body.contains(deletedSpan));
    } else {
      console.warn('⚠ No oldText provided for diff view or oldText is empty. oldText value:', oldText);
    }
    
    // Show added text (red highlight)
    if (newText && newText.length > 0) {
      const addedSpan = document.createElement('ins');
      addedSpan.className = 'edit-added';
      addedSpan.textContent = newText;
      diffContainer.appendChild(addedSpan);
      console.log('✓ Created added text element:', newText.substring(0, 50));
    } else {
      console.warn('⚠ No newText provided for diff view or newText is empty');
    }
    
    console.log('✓ Diff container children:', diffContainer.children.length);
    console.log('✓ Diff container innerHTML:', diffContainer.innerHTML);
    
    // Wrap diff container and approve button in a parent container for hover detection
    const editWrapper = document.createElement('span');
    editWrapper.className = 'edit-wrapper';
    
    // Move diff container into wrapper
    editWrapper.appendChild(diffContainer);
    
    // Add approve/reject button wrapper that will appear after the diff container
    const approveWrapper = document.createElement('span');
    approveWrapper.className = 'edit-approve-wrapper';
    
    // Accept button
    const approveBtn = document.createElement('button');
    approveBtn.className = 'edit-approve-btn';
    approveBtn.textContent = '✓ Accept';
    approveBtn.title = 'Accept this edit';
    approveBtn.setAttribute('aria-label', 'Accept edit');
    approveBtn.type = 'button'; // Prevent form submission
    approveBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.acceptEdit(diffContainer);
    };
    approveBtn.onmousedown = (e) => {
      e.preventDefault(); // Prevent text selection
      e.stopPropagation();
    };
    
    // Reject button
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'edit-reject-btn';
    rejectBtn.textContent = '✗ Reject';
    rejectBtn.title = 'Reject this edit';
    rejectBtn.setAttribute('aria-label', 'Reject edit');
    rejectBtn.type = 'button';
    rejectBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.rejectEdit(diffContainer);
    };
    rejectBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    approveWrapper.appendChild(approveBtn);
    approveWrapper.appendChild(rejectBtn);
    editWrapper.appendChild(approveWrapper);
    
    // Store reference for acceptEdit
    diffContainer._approveWrapper = approveWrapper;
    diffContainer._editWrapper = editWrapper;
    
    console.log('✓ Added approve button wrapper (will appear after edit)');
    
    return editWrapper;
  }

  // Helper: Accept an edit - remove deleted text and normalize added text
  acceptEdit(diffContainer) {
    const deletedSpan = diffContainer.querySelector('.edit-deleted');
    const addedSpan = diffContainer.querySelector('.edit-added');
    
    // Get the edit wrapper (parent container that holds diff container and approve button)
    const editWrapper = diffContainer._editWrapper || 
      (diffContainer.parentNode && diffContainer.parentNode.classList.contains('edit-wrapper') 
        ? diffContainer.parentNode 
        : null);
    
    // Remove deleted text
    if (deletedSpan) {
      deletedSpan.remove();
    }
    
    // Normalize added text - remove highlighting, make it normal text
    let finalTextContent = '';
    if (addedSpan) {
      // Get the text content from added span
      finalTextContent = addedSpan.textContent;
      
      // Replace the added span with normal text node
      const textNode = document.createTextNode(finalTextContent);
      addedSpan.parentNode.replaceChild(textNode, addedSpan);
    }
    
    // If no added text, use the remaining text from diff container
    if (!finalTextContent && diffContainer.textContent) {
      finalTextContent = diffContainer.textContent;
    }
    
    // Remove the approve button wrapper
    const approveWrapper = diffContainer._approveWrapper || 
      (editWrapper && editWrapper.querySelector('.edit-approve-wrapper'));
    if (approveWrapper) {
      approveWrapper.remove();
    }
    
    // Replace the entire edit wrapper with just the normalized text
    if (editWrapper && editWrapper.parentNode) {
      const textNode = document.createTextNode(finalTextContent);
      editWrapper.parentNode.replaceChild(textNode, editWrapper);
    } else if (diffContainer && diffContainer.parentNode) {
      // Fallback: if editWrapper not found, just replace diffContainer
      const textNode = document.createTextNode(finalTextContent);
      diffContainer.parentNode.replaceChild(textNode, diffContainer);
    }
    
    // Save after accepting edit
    this.saveToStorage();
    
    console.log('✓ Edit accepted - deleted text removed, added text normalized');
  }

  // Helper: Reject an edit - remove the entire edit (both deleted and added text)
  rejectEdit(diffContainer) {
    // Get the edit wrapper (parent container that holds diff container and approve button)
    const editWrapper = diffContainer._editWrapper || 
      (diffContainer.parentNode && diffContainer.parentNode.classList.contains('edit-wrapper') 
        ? diffContainer.parentNode 
        : null);
    
    // Get deleted text if it exists - we want to restore it
    const deletedSpan = diffContainer.querySelector('.edit-deleted');
    let originalText = '';
    if (deletedSpan) {
      originalText = deletedSpan.textContent;
    }
    
    // Remove the entire edit wrapper
    if (editWrapper && editWrapper.parentNode) {
      if (originalText) {
        // Restore the original text that was deleted
        const textNode = document.createTextNode(originalText);
        editWrapper.parentNode.replaceChild(textNode, editWrapper);
      } else {
        // No original text to restore, just remove the edit
        editWrapper.remove();
      }
    } else if (diffContainer && diffContainer.parentNode) {
      // Fallback: if editWrapper not found, just replace diffContainer
      if (originalText) {
        const textNode = document.createTextNode(originalText);
        diffContainer.parentNode.replaceChild(textNode, diffContainer);
      } else {
        diffContainer.remove();
      }
    }
    
    // Save after rejecting edit
    this.saveToStorage();
    
    console.log('✓ Edit rejected - edit removed, original text restored if available');
  }

  // Helper: Split text into sentences
  splitIntoSentences(text) {
    // Split by sentence-ending punctuation followed by whitespace or end of string
    // Matches: . ! ? followed by space, newline, or end of string
    const sentenceRegex = /([.!?])\s+|([.!?])$/g;
    const sentences = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentenceEnd = match.index + match[0].length;
      const sentence = text.substring(lastIndex, sentenceEnd).trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          start: lastIndex,
          end: sentenceEnd
        });
      }
      lastIndex = sentenceEnd;
    }
    
    // Add remaining text as a sentence if any
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex).trim();
      if (remaining) {
        sentences.push({
          text: remaining,
          start: lastIndex,
          end: text.length
        });
      }
    }
    
    // If no sentence boundaries found, treat entire text as one sentence
    if (sentences.length === 0 && text.trim()) {
      sentences.push({
        text: text.trim(),
        start: 0,
        end: text.length
      });
    }
    
    return sentences;
  }

  // Helper: Find the sentence containing a given text snippet
  findSentenceContainingText(plainText, searchText) {
    const sentences = this.splitIntoSentences(plainText);
    
    for (const sentence of sentences) {
      // Check if searchText is contained within this sentence (case-insensitive, normalized)
      const normalizedSentence = sentence.text.replace(/\s+/g, ' ').toLowerCase();
      const normalizedSearch = searchText.replace(/\s+/g, ' ').toLowerCase();
      
      if (normalizedSentence.includes(normalizedSearch)) {
        return sentence;
      }
    }
    
    return null;
  }

  // Helper: Try to replace text using exact match (sentence-level)
  tryReplaceByExactMatch(searchText, newText) {
    // Get plain text to find sentence boundaries
    const plainText = this.thesisEditor.textContent || this.thesisEditor.innerText;
    
    // Find the sentence containing the searchText
    const containingSentence = this.findSentenceContainingText(plainText, searchText);
    if (!containingSentence) {
      console.warn('⚠ Could not find sentence containing searchText');
      return false;
    }
    
    console.log(`✓ Found sentence containing searchText: "${containingSentence.text.substring(0, 100)}..."`);
    
    // Replace the entire sentence, not just the searchText
    // The old text is the entire sentence, the new text is the replacement sentence
    const oldSentence = containingSentence.text;
    const newSentence = newText; // Assuming newText is a complete sentence
    
    // Now find and replace this sentence in the DOM
    const walker = document.createTreeWalker(
      this.thesisEditor,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let textNode;
    let cumulativeIndex = 0;
    let targetNodes = [];
    
    // Collect all text nodes that make up the sentence
    while (textNode = walker.nextNode()) {
      const nodeText = textNode.textContent || '';
      const nodeLength = nodeText.length;
      const nodeStart = cumulativeIndex;
      const nodeEnd = cumulativeIndex + nodeLength;
      
      // Check if this node overlaps with the sentence
      if (nodeStart < containingSentence.end && nodeEnd > containingSentence.start) {
        targetNodes.push({
          node: textNode,
          nodeStart: nodeStart,
          nodeEnd: nodeEnd,
          nodeText: nodeText
        });
      }
      
      if (nodeEnd >= containingSentence.end) {
        break;
      }
      
      cumulativeIndex += nodeLength;
    }
    
    if (targetNodes.length === 0) {
      console.warn('⚠ Could not find text nodes for sentence');
      return false;
    }
    
    // Replace the sentence: collect all text, then replace with new sentence
    const parent = targetNodes[0].node.parentNode;
    const firstNode = targetNodes[0].node;
    const lastNode = targetNodes[targetNodes.length - 1].node;
    
    // Create diff view with entire sentence
    const editWrapper = this.createDiffView(oldSentence, newSentence);
    
    // Find insertion point (before first node)
    parent.insertBefore(editWrapper, firstNode);
    
    // Remove all nodes that were part of the sentence
    targetNodes.forEach(target => {
      if (target.node.parentNode === parent) {
        parent.removeChild(target.node);
      }
    });
    
    console.log('✓ Replaced entire sentence using exact match');
    console.log(`  Old sentence: "${oldSentence.substring(0, 100)}..."`);
    console.log(`  New sentence: "${newSentence.substring(0, 100)}..."`);
    return true;
  }

  // Helper: Try to replace text using surroundingText to find location (sentence-level)
  tryReplaceBySurroundingText(surroundingText, searchText, newText) {
    // Get plain text to find sentence boundaries
    const plainText = this.thesisEditor.textContent || this.thesisEditor.innerText;
    
    // Find the sentence containing the searchText
    const containingSentence = this.findSentenceContainingText(plainText, searchText);
    if (!containingSentence) {
      console.warn('⚠ Could not find sentence containing searchText');
      return false;
    }
    
    console.log(`✓ Found sentence containing searchText: "${containingSentence.text.substring(0, 100)}..."`);
    
    // Replace the entire sentence, not just the searchText
    const oldSentence = containingSentence.text;
    const newSentence = newText; // Assuming newText is a complete sentence
    
    // Now find and replace this sentence in the DOM
    const walker = document.createTreeWalker(
      this.thesisEditor,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let textNode;
    let cumulativeIndex = 0;
    let targetNodes = [];
    
    // Collect all text nodes that make up the sentence
    while (textNode = walker.nextNode()) {
      const nodeText = textNode.textContent || '';
      const nodeLength = nodeText.length;
      const nodeStart = cumulativeIndex;
      const nodeEnd = cumulativeIndex + nodeLength;
      
      // Check if this node overlaps with the sentence
      if (nodeStart < containingSentence.end && nodeEnd > containingSentence.start) {
        targetNodes.push({
          node: textNode,
          nodeStart: nodeStart,
          nodeEnd: nodeEnd
        });
      }
      
      if (nodeEnd >= containingSentence.end) {
        break;
      }
      
      cumulativeIndex += nodeLength;
    }
    
    if (targetNodes.length === 0) {
      console.warn('⚠ Could not find text nodes for sentence');
      return false;
    }
    
    // Replace the sentence
    const parent = targetNodes[0].node.parentNode;
    const firstNode = targetNodes[0].node;
    
    // Create diff view with entire sentence
    const editWrapper = this.createDiffView(oldSentence, newSentence);
    
    // Insert before first node
    parent.insertBefore(editWrapper, firstNode);
    
    // Remove all nodes that were part of the sentence
    targetNodes.forEach(target => {
      if (target.node.parentNode === parent) {
        parent.removeChild(target.node);
      }
    });
    
    console.log('✓ Replaced entire sentence using surroundingText-based location');
    console.log(`  Old sentence: "${oldSentence.substring(0, 100)}..."`);
    console.log(`  New sentence: "${newSentence.substring(0, 100)}..."`);
    return true;
  }

  // Helper: Try to insert text using surroundingText to find insertion point (sentence-level)
  tryInsertBySurroundingText(surroundingText, newText, locationContext) {
    // Find the actual surrounding text in the DOM (without normalization)
    const plainText = this.thesisEditor.textContent || this.thesisEditor.innerText;
    
    // Try to find surroundingText in the actual document text
    let surroundingIndex = plainText.indexOf(surroundingText);
    if (surroundingIndex === -1) {
      // Try with normalized whitespace for matching
      const normalize = (text) => text.replace(/\s+/g, ' ').trim();
      const normalizedSurrounding = normalize(surroundingText);
      const normalizedPlainText = normalize(plainText);
      const normalizedIndex = normalizedPlainText.indexOf(normalizedSurrounding);
      
      if (normalizedIndex === -1) {
        // Try partial match
        const partialLength = Math.min(100, normalizedSurrounding.length);
        const partialSurrounding = normalizedSurrounding.substring(0, partialLength);
        const partialIndex = normalizedPlainText.indexOf(partialSurrounding);
        
        if (partialIndex === -1) {
          console.warn('⚠ Could not find surroundingText for insertion point');
          return false;
        }
        
        // Map normalized index back to actual text
        surroundingIndex = this.findActualTextPosition(plainText, normalizedPlainText, partialIndex + partialLength);
        console.log(`✓ Found partial match of surroundingText for insertion`);
      } else {
        // Map normalized index back to actual text
        surroundingIndex = this.findActualTextPosition(plainText, normalizedPlainText, normalizedIndex + normalizedSurrounding.length);
        console.log(`✓ Found surroundingText for insertion (normalized match)`);
      }
    } else {
      // Found exact match - insert after the end of surrounding text
      surroundingIndex = surroundingIndex + surroundingText.length;
      console.log(`✓ Found surroundingText for insertion at index ${surroundingIndex}`);
    }
    
    // Find the sentence that contains or follows this insertion point
    const sentences = this.splitIntoSentences(plainText);
    let targetSentenceIndex = -1;
    
    // Find which sentence the insertion point falls into or after
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (surroundingIndex <= sentence.end) {
        // Insert at the end of this sentence (sentence boundary)
        targetSentenceIndex = i;
        surroundingIndex = sentence.end; // Move to end of sentence
        break;
      }
    }
    
    // If insertion point is after all sentences, insert at the end
    if (targetSentenceIndex === -1) {
      targetSentenceIndex = sentences.length - 1;
      surroundingIndex = plainText.length;
    }
    
    console.log(`✓ Inserting at sentence boundary (end of sentence ${targetSentenceIndex + 1})`);
    
    // Use TreeWalker to find the text node and exact position
    const walker = document.createTreeWalker(
      this.thesisEditor,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let textNode;
    let cumulativeIndex = 0;
    let targetNode = null;
    let insertionOffset = 0;
    
    while (textNode = walker.nextNode()) {
      const nodeText = textNode.textContent || '';
      const nodeLength = nodeText.length;
      const nodeStart = cumulativeIndex;
      const nodeEnd = cumulativeIndex + nodeLength;
      
      // Check if insertion point is within this node
      if (nodeStart < surroundingIndex && surroundingIndex <= nodeEnd) {
        targetNode = textNode;
        // Calculate offset: where to insert in this node
        insertionOffset = surroundingIndex - nodeStart;
        break;
      }
      
      cumulativeIndex += nodeLength;
    }
    
    if (!targetNode) {
      // If we couldn't find exact position, try inserting after the last node before the index
      // This is a fallback
      const walker2 = document.createTreeWalker(
        this.thesisEditor,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let lastNode = null;
      cumulativeIndex = 0;
      
      while (textNode = walker2.nextNode()) {
        const nodeLength = textNode.textContent.length;
        if (cumulativeIndex + nodeLength < surroundingIndex) {
          lastNode = textNode;
        } else {
          break;
        }
        cumulativeIndex += nodeLength;
      }
      
      if (lastNode) {
        // Insert after the last node
        const parent = lastNode.parentNode;
        const addedSpan = document.createElement('ins');
        addedSpan.className = 'edit-added';
        const lines = newText.split('\n');
        lines.forEach((line, idx) => {
          if (idx > 0) addedSpan.appendChild(document.createElement('br'));
          addedSpan.appendChild(document.createTextNode(line));
        });
        
        // Wrap with approve button structure
        const editWrapper = this.wrapEditWithApproveButton(addedSpan);
        
        // Insert after lastNode (add space for readability)
        const spaceNode = document.createTextNode(' ');
        parent.insertBefore(spaceNode, lastNode.nextSibling);
        parent.insertBefore(editWrapper, spaceNode.nextSibling);
        
        console.log('✓ Inserted new text after last node (fallback)');
        return true;
      }
      
      console.warn('⚠ Could not find target node for insertion');
      return false;
    }
    
    // Insert the new text at sentence boundary (end of the sentence)
    // We already adjusted surroundingIndex to be at the end of a sentence
    const parent = targetNode.parentNode;
    const nodeText = targetNode.textContent;
    
    // Split the text at insertion point (which should be at sentence end)
    const beforeText = nodeText.substring(0, insertionOffset);
    const afterText = nodeText.substring(insertionOffset);
    
    // Create new text node for before part
    if (beforeText) {
      const beforeNode = document.createTextNode(beforeText);
      parent.insertBefore(beforeNode, targetNode);
    }
    
    // Add a space before the new sentence if needed
    const needsSpaceBefore = beforeText && 
      !/\s$/.test(beforeText) && // Not already ending with whitespace
      !newText.startsWith(' ') && // New text doesn't start with space
      beforeText.trim().length > 0; // Before text is not empty
    
    if (needsSpaceBefore) {
      const spaceNode = document.createTextNode(' ');
      parent.insertBefore(spaceNode, targetNode);
    }
    
    // Create diff view for inserted sentence (only "added", no "deleted")
    const addedSpan = document.createElement('ins');
    addedSpan.className = 'edit-added';
    const lines = newText.split('\n');
    lines.forEach((line, idx) => {
      if (idx > 0) addedSpan.appendChild(document.createElement('br'));
      addedSpan.appendChild(document.createTextNode(line));
    });
    
    // Wrap with approve button structure
    const editWrapper = this.wrapEditWithApproveButton(addedSpan);
    parent.insertBefore(editWrapper, targetNode);
    
    // Create new text node for after part
    if (afterText) {
      const afterNode = document.createTextNode(afterText);
      parent.insertBefore(afterNode, targetNode);
    }
    
    // Remove original node
    parent.removeChild(targetNode);
    
    console.log('✓ Inserted new sentence at sentence boundary');
    return true;
  }

  // Helper: Map normalized text index back to actual text position
  findActualTextPosition(actualText, normalizedText, normalizedIndex) {
    // This is an approximation - find the position in actual text that corresponds to normalized index
    let actualPos = 0;
    let normalizedPos = 0;
    
    for (let i = 0; i < actualText.length && normalizedPos < normalizedIndex; i++) {
      const char = actualText[i];
      if (/\s/.test(char)) {
        // Skip multiple spaces, count as one
        if (normalizedPos < normalizedIndex) {
          actualPos = i + 1;
          // Skip to next non-space
          while (i + 1 < actualText.length && /\s/.test(actualText[i + 1])) {
            i++;
            actualPos++;
          }
        }
        normalizedPos++;
      } else {
        actualPos++;
        normalizedPos++;
      }
    }
    
    return actualPos;
  }

  applyBasicEdit(proposal) {
    try {
      console.log('=== APPLYING EDIT PROPOSAL ===');
      console.log('Proposal:', JSON.stringify(proposal, null, 2));
      console.log('Thesis editor element:', this.thesisEditor);
      console.log('Thesis editor exists?', !!this.thesisEditor);
      
      if (!this.thesisEditor) {
        console.error('Thesis editor element not found!');
        return { success: false, error: 'Thesis editor element not found' };
      }
      
      if (!proposal) {
        console.error('No proposal provided');
        return { success: false, error: 'No proposal provided' };
      }

      // Get plain text for verification
      const plainText = this.thesisEditor.textContent || this.thesisEditor.innerText || '';
      console.log('Current thesis text length:', plainText.length);
      console.log('Current thesis preview:', plainText.substring(0, 200));
      
      // If editor is empty, we'll just append content
      const isEmpty = plainText.trim().length === 0;
      
      // Handle proposal structure variations
      let changes = [];
      if (proposal.changes && Array.isArray(proposal.changes)) {
        changes = proposal.changes;
      } else if (proposal.newText || proposal.newContent) {
        // If proposal doesn't have changes array, create one from top-level fields
        changes = [{
          action: proposal.action || 'insert',
          searchText: proposal.searchText || proposal.oldText || proposal.before,
          newText: proposal.newText || proposal.newContent || proposal.after
        }];
        console.log('Reconstructed changes from proposal:', changes);
      } else {
        console.error('Invalid proposal structure - no changes found:', proposal);
        return { success: false, error: 'Invalid proposal: no changes found' };
      }
      
      if (changes.length === 0) {
        console.error('No changes to apply');
        return { success: false, error: 'No changes to apply' };
      }
      
      let anyApplied = false;
      
      changes.forEach((change, index) => {
        console.log(`\n--- Processing change ${index + 1}/${changes.length} ---`);
        console.log('Change:', JSON.stringify(change, null, 2));
        
        const action = change.action || 'insert';
        const searchText = change.searchText || change.oldText || change.before || '';
        const newText = change.newText || change.newContent || change.after || '';
        const surroundingText = change.surroundingText || '';
        const locationContext = change.locationContext || '';
        
        console.log(`  Action: ${action}`);
        console.log(`  SearchText length: ${searchText.length}`);
        console.log(`  SearchText preview: "${searchText.substring(0, 100)}..."`);
        console.log(`  NewText length: ${newText.length}`);
        console.log(`  NewText preview: "${newText.substring(0, 100)}..."`);
        console.log(`  SurroundingText length: ${surroundingText.length}`);
        console.log(`  LocationContext: ${locationContext || 'none'}`);
        
        if (!newText) {
          console.warn(`⚠ Skipping change ${index + 1}: no newText provided`);
          return;
        }
        
        // If editor is empty, just set the content directly with diff view
        if (isEmpty && index === 0) {
          const addedSpan = document.createElement('ins');
          addedSpan.className = 'edit-added';
          const lines = newText.split('\n');
          lines.forEach((line, idx) => {
            if (idx > 0) addedSpan.appendChild(document.createElement('br'));
            addedSpan.appendChild(document.createTextNode(line));
          });
          
          // Wrap with approve button structure
          const editWrapper = this.wrapEditWithApproveButton(addedSpan);
          this.thesisEditor.appendChild(editWrapper);
          anyApplied = true;
          console.log('✓ Set content directly (editor was empty)');
        } else if (action === 'replace' && searchText) {
          // Strategy 1: Try exact searchText match
          let replaced = this.tryReplaceByExactMatch(searchText, newText);
          
          // Strategy 2: If exact match failed, try using surroundingText to find location
          if (!replaced && surroundingText) {
            console.log('⚠ Exact match failed, trying surroundingText-based location...');
            replaced = this.tryReplaceBySurroundingText(surroundingText, searchText, newText);
          }
          
          // Strategy 3: If still failed, try partial match on searchText
          if (!replaced && searchText.length > 20) {
            console.log('⚠ Trying partial match on searchText...');
            const partialMatch = searchText.substring(0, Math.min(50, searchText.length));
            replaced = this.tryReplaceByExactMatch(partialMatch, newText);
          }
          
          // Strategy 4: If all failed, append to end with a note
          if (!replaced) {
            console.warn('⚠ Could not find text match in thesis using any strategy');
            console.warn(`Search text: "${searchText.substring(0, 100)}..."`);
            if (surroundingText) {
              console.warn(`Surrounding text: "${surroundingText.substring(0, 100)}..."`);
            }
            console.warn('Current thesis content preview:', plainText.substring(0, 500));
            
            // Append to end so user can see the new text with diff view
            const separator = document.createElement('div');
            separator.style.borderLeft = '3px solid #3498db';
            separator.style.paddingLeft = '10px';
            separator.style.margin = '10px 0';
            separator.style.color = '#7f8c8d';
            separator.style.fontStyle = 'italic';
            separator.textContent = '[Edit: Original text not found, new content appended below]';
            
            const addedSpan = document.createElement('ins');
            addedSpan.className = 'edit-added';
            const lines = newText.split('\n');
            lines.forEach((line, idx) => {
              if (idx > 0) addedSpan.appendChild(document.createElement('br'));
              addedSpan.appendChild(document.createTextNode(line));
            });
            
            // Wrap with approve button structure
            const editWrapper = this.wrapEditWithApproveButton(addedSpan);
            
            this.thesisEditor.appendChild(document.createElement('br'));
            this.thesisEditor.appendChild(document.createElement('br'));
            this.thesisEditor.appendChild(separator);
            this.thesisEditor.appendChild(document.createElement('br'));
            this.thesisEditor.appendChild(editWrapper);
            anyApplied = true;
            console.log('✓ Appended new text to end (original not found)');
          } else {
            anyApplied = true;
          }
        } else if (action === 'insert') {
          // For insert actions, try to use surroundingText to find insertion point
          let inserted = false;
          
          if (surroundingText) {
            console.log('Attempting to insert using surroundingText...');
            inserted = this.tryInsertBySurroundingText(surroundingText, newText, locationContext);
          }
          
          // If surroundingText-based insertion failed, append to end with diff view
          if (!inserted) {
            console.log('⚠ Could not find insertion point, appending to end');
            const addedSpan = document.createElement('ins');
            addedSpan.className = 'edit-added';
            const lines = newText.split('\n');
            lines.forEach((line, idx) => {
              if (idx > 0) addedSpan.appendChild(document.createElement('br'));
              addedSpan.appendChild(document.createTextNode(line));
            });
            
            // Wrap with approve button structure
            const editWrapper = this.wrapEditWithApproveButton(addedSpan);
            
            this.thesisEditor.appendChild(document.createElement('br'));
            this.thesisEditor.appendChild(document.createElement('br'));
            this.thesisEditor.appendChild(editWrapper);
            anyApplied = true;
            console.log('✓ Inserted new text at end');
          } else {
            anyApplied = true;
          }
        } else {
          // Fallback: append to end with diff view
          const addedSpan = document.createElement('ins');
          addedSpan.className = 'edit-added';
          const lines = newText.split('\n');
          lines.forEach((line, idx) => {
            if (idx > 0) addedSpan.appendChild(document.createElement('br'));
            addedSpan.appendChild(document.createTextNode(line));
          });
          
          // Wrap with approve button structure
          const editWrapper = this.wrapEditWithApproveButton(addedSpan);
          
          this.thesisEditor.appendChild(document.createElement('br'));
          this.thesisEditor.appendChild(document.createElement('br'));
          this.thesisEditor.appendChild(editWrapper);
          anyApplied = true;
          console.log('✓ Inserted new text at end (fallback)');
        }
      });
      
      if (!anyApplied) {
        console.warn('⚠ No changes were applied');
        // At minimum, append the first newText if available with diff view
        const firstChange = changes[0];
        const newText = firstChange.newText || firstChange.newContent || firstChange.after;
        if (newText) {
          const markerDiv = document.createElement('div');
          markerDiv.style.borderLeft = '3px solid #27ae60';
          markerDiv.style.paddingLeft = '10px';
          markerDiv.style.margin = '10px 0';
          markerDiv.innerHTML = '<strong>New content:</strong>';
          
          const addedSpan = document.createElement('ins');
          addedSpan.className = 'edit-added';
          const lines = newText.split('\n');
          lines.forEach((line, idx) => {
            if (idx > 0) addedSpan.appendChild(document.createElement('br'));
            addedSpan.appendChild(document.createTextNode(line));
          });
          
          // Wrap with approve button structure
          const editWrapper = this.wrapEditWithApproveButton(addedSpan);
          
          this.thesisEditor.appendChild(document.createElement('br'));
          this.thesisEditor.appendChild(document.createElement('br'));
          this.thesisEditor.appendChild(markerDiv);
          this.thesisEditor.appendChild(document.createElement('br'));
          this.thesisEditor.appendChild(editWrapper);
          anyApplied = true;
          console.log('✓ Applied fallback: appended first newText');
        }
      }
      
      if (anyApplied) {
        // Save after all changes
        this.saveToStorage();
        console.log('✓ Saved to storage');
        
        // Ensure all edit-added elements have approve buttons attached
        this.attachApproveButtonsToExistingEdits();
        
        // Add visual highlight to show edit was applied
        this.thesisEditor.style.transition = 'background-color 0.3s ease';
        const originalBg = this.thesisEditor.style.backgroundColor;
        this.thesisEditor.style.backgroundColor = '#d4edda';
        setTimeout(() => {
          this.thesisEditor.style.backgroundColor = originalBg || '';
          setTimeout(() => {
            this.thesisEditor.style.transition = '';
          }, 300);
        }, 1000);
        
        // Focus the editor and scroll to bottom to show the changes
        this.thesisEditor.focus();
        // Wait a bit for DOM to update, then scroll
        setTimeout(() => {
          this.thesisEditor.scrollTop = this.thesisEditor.scrollHeight;
          // Scroll window if needed
          this.thesisEditor.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
        
        // Verify the edit was applied
        const newPlainText = this.thesisEditor.textContent || this.thesisEditor.innerText || '';
        const lengthDiff = newPlainText.length - plainText.length;
        console.log('✓ Edit applied. Text length change:', lengthDiff);
        console.log('New thesis length:', newPlainText.length);
        console.log('New thesis preview (last 300 chars):', newPlainText.substring(Math.max(0, newPlainText.length - 300)));
        
        // Show alert for user visibility
        if (lengthDiff > 0) {
          console.log(`✓ Edit successfully applied! Added ${lengthDiff} characters to thesis.`);
        }
        
        return { success: true };
      } else {
        return { success: false, error: 'No changes could be applied' };
      }
    } catch (error) {
      console.error('✗ Error applying edit:', error);
      console.error('Stack:', error.stack);
      return { success: false, error: error.message };
    }
  }
}

// Initialize app when DOM is ready
let thesisApp;
document.addEventListener('DOMContentLoaded', () => {
  console.log('Thesis Editor app loaded');
  thesisApp = new ThesisEditor();
  
  // Expose getThesisHTML globally for agent.js to access
  window.getThesisHTML = () => {
    if (thesisApp) {
      return thesisApp.getThesisHTML();
    }
    console.warn('thesisApp not available, trying direct access to editor');
    const editor = document.getElementById('thesis-editor');
    if (editor) {
      return {
        html: editor.innerHTML,
        plainText: editor.textContent || editor.innerText
      };
    }
    return null;
  };
  
  // Expose createReferenceFromPaper globally for agent.js to access
  window.createReferenceFromPaper = (paperData) => {
    if (thesisApp && typeof thesisApp.createReferenceFromPaper === 'function') {
      return thesisApp.createReferenceFromPaper(paperData);
    }
    console.warn('thesisApp.createReferenceFromPaper not available');
    return null;
  };
  
  // Expose applyBasicEdit globally for agent.js to access
  window.applyBasicEdit = (proposal) => {
    console.log('window.applyBasicEdit called with proposal:', proposal);
    if (thesisApp && typeof thesisApp.applyBasicEdit === 'function') {
      return thesisApp.applyBasicEdit(proposal);
    }
    console.warn('thesisApp.applyBasicEdit not available, trying direct DOM manipulation');
    
    // Fallback: direct DOM manipulation
    const editor = document.getElementById('thesis-editor');
    if (!editor) {
      return { success: false, error: 'Thesis editor element not found' };
    }
    
    try {
      // Extract new text from proposal
      let newText = '';
      if (proposal && proposal.changes && proposal.changes.length > 0) {
        const firstChange = proposal.changes[0];
        newText = firstChange.newText || firstChange.newContent || firstChange.after || '';
      } else if (proposal && (proposal.newText || proposal.newContent)) {
        newText = proposal.newText || proposal.newContent || '';
      }
      
      if (!newText) {
        return { success: false, error: 'No new text found in proposal' };
      }
      
      // Escape and format text
      const div = document.createElement('div');
      div.textContent = newText;
      const escapedText = div.innerHTML;
      const newTextHtml = escapedText.replace(/\n/g, '<br>');
      
      // Append to end
      editor.innerHTML += '<br><br><div style="border-left: 3px solid #27ae60; padding-left: 10px; margin: 10px 0;"><strong>[Edit Applied]</strong></div><br>' + newTextHtml;
      
      // Focus and scroll
      editor.focus();
      editor.scrollTop = editor.scrollHeight;
      
      // Try to save if thesisApp is available
      if (thesisApp && typeof thesisApp.saveToStorage === 'function') {
        thesisApp.saveToStorage();
      }
      
      console.log('✓ Edit applied via fallback DOM manipulation');
      return { success: true };
    } catch (error) {
      console.error('Error in fallback DOM manipulation:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Test function to verify editor is accessible
  window.testThesisEditor = () => {
    const editor = document.getElementById('thesis-editor');
    if (!editor) {
      console.error('✗ Thesis editor not found');
      return false;
    }
    console.log('✓ Thesis editor found');
    console.log('Current content length:', (editor.textContent || '').length);
    
    // Test: append a test string
    const testText = '\n\n[TEST] This is a test edit - if you see this, the editor is accessible!';
    editor.innerHTML += testText;
    editor.focus();
    editor.scrollTop = editor.scrollHeight;
    
    console.log('✓ Test text appended');
    return true;
  };
});
