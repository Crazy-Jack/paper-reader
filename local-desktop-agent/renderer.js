// Renderer process script
class ThesisEditor {
  constructor() {
    this.references = [];
    this.editingRefId = null;
    this.nextRefId = 1;
    this.nextImageId = 1;
    
    this.init();
    this.loadFromStorage();
  }

  init() {
    // DOM elements
    this.thesisEditor = document.getElementById('thesis-editor');
    this.referencesList = document.getElementById('references-list');
    this.addRefBtn = document.getElementById('add-ref-btn');
    this.insertCitationBtn = document.getElementById('insert-citation-btn');
    this.insertImageBtn = document.getElementById('insert-image-btn');
    this.insertSideBySideBtn = document.getElementById('insert-sidebyside-btn');
    this.saveBtn = document.getElementById('save-btn');
    this.exportBtn = document.getElementById('export-btn');
    this.exportHtmlBtn = document.getElementById('export-html-btn');
    
    // Check if elements exist
    if (!this.insertImageBtn) {
      console.error('Insert Image button not found!');
      return;
    }
    if (!this.insertSideBySideBtn) {
      console.error('Insert Side by Side button not found!');
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
    this.insertCitationBtn.addEventListener('click', () => this.insertCitation());
    
    // Add event listener for insert image button with error handling
    if (this.insertImageBtn) {
    this.insertImageBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Insert Image button clicked');
      this.insertImage(false).catch(err => {
        console.error('Error inserting image:', err);
        alert('Error inserting image: ' + err.message);
      });
    });
    
    this.insertSideBySideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Insert Side by Side button clicked');
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
    // Store reference to next sibling before removal
    const nextSibling = figure.nextSibling;
    
    // Check if figure is in a side-by-side container
    const sideBySideContainer = figure.closest('.images-side-by-side');
    
    if (sideBySideContainer) {
      // Remove the figure from side-by-side container
      figure.remove();
      
      // If only one figure left, remove side-by-side wrapper and restore normal layout
      const remainingFigures = sideBySideContainer.querySelectorAll('figure');
      if (remainingFigures.length === 1) {
        const singleFigure = remainingFigures[0];
        const parent = sideBySideContainer.parentNode;
        parent.insertBefore(singleFigure, sideBySideContainer);
        sideBySideContainer.remove();
      } else if (remainingFigures.length === 0) {
        // No figures left, remove the empty container and any trailing BR
        if (sideBySideContainer.nextSibling && 
            sideBySideContainer.nextSibling.nodeType === Node.ELEMENT_NODE && 
            sideBySideContainer.nextSibling.tagName === 'BR') {
          sideBySideContainer.nextSibling.remove();
        }
        sideBySideContainer.remove();
      }
    } else {
      // Regular figure, remove it and clean up trailing BR if exists
      if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.tagName === 'BR') {
        nextSibling.remove();
      }
      figure.remove();
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
    if (confirm('Are you sure you want to delete this reference?')) {
      this.references = this.references.filter(r => r.id !== refId);
      this.renderReferences();
      this.saveToStorage();
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
      return `
        <div class="reference-item" data-ref-id="${ref.id}">
          <div class="reference-header">
            <div>
              <div class="reference-id">${citation}</div>
              <div class="reference-title">${this.escapeHtml(ref.title || 'Untitled')}</div>
            </div>
          </div>
          <div class="reference-meta">
            ${ref.authors ? `<div><strong>Authors:</strong> ${this.escapeHtml(ref.authors)}</div>` : ''}
            ${ref.year ? `<div><strong>Year:</strong> ${ref.year}</div>` : ''}
            ${ref.venue ? `<div><strong>Venue:</strong> ${this.escapeHtml(ref.venue)}</div>` : ''}
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
  }

  insertCitationForRef(refId) {
    const ref = this.references.find(r => r.id === refId);
    if (!ref) return;

    this.insertTextAtCursor(`[@${refId}]`);
    this.saveToStorage();
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
      if (ref.venue) bibliography += `${ref.venue}. `;
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
      if (ref.venue) bibliography += `${this.escapeHtml(ref.venue)}. `;
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
}

// Initialize app when DOM is ready
let thesisApp;
document.addEventListener('DOMContentLoaded', () => {
  console.log('Thesis Editor app loaded');
  thesisApp = new ThesisEditor();
});
