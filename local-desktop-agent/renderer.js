// Renderer process script
class ThesisEditor {
  constructor() {
    this.references = [];
    this.editingRefId = null;
    this.nextRefId = 1;
    
    this.init();
    this.loadFromStorage();
  }

  init() {
    // DOM elements
    this.thesisEditor = document.getElementById('thesis-editor');
    this.referencesList = document.getElementById('references-list');
    this.addRefBtn = document.getElementById('add-ref-btn');
    this.insertCitationBtn = document.getElementById('insert-citation-btn');
    this.saveBtn = document.getElementById('save-btn');
    this.exportBtn = document.getElementById('export-btn');
    
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
    this.saveBtn.addEventListener('click', () => this.save());
    this.exportBtn.addEventListener('click', () => this.export());
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

    // Close modal on outside click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModalDialog();
      }
    });
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
      const citation = `[@${ref.id}]`;
      
      const cursorPos = this.thesisEditor.selectionStart;
      const textBefore = this.thesisEditor.value.substring(0, cursorPos);
      const textAfter = this.thesisEditor.value.substring(cursorPos);
      
      this.thesisEditor.value = textBefore + citation + textAfter;
      this.thesisEditor.focus();
      this.thesisEditor.setSelectionRange(
        cursorPos + citation.length,
        cursorPos + citation.length
      );
      
      this.saveToStorage();
    }
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

    const citation = `[@${refId}]`;
    const cursorPos = this.thesisEditor.selectionStart;
    const textBefore = this.thesisEditor.value.substring(0, cursorPos);
    const textAfter = this.thesisEditor.value.substring(cursorPos);
    
    this.thesisEditor.value = textBefore + citation + textAfter;
    this.thesisEditor.focus();
    this.thesisEditor.setSelectionRange(
      cursorPos + citation.length,
      cursorPos + citation.length
    );
    
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
      thesis: this.thesisEditor.value,
      references: this.references,
      nextRefId: this.nextRefId,
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('thesisData', JSON.stringify(data));
  }

  loadFromStorage() {
    const saved = localStorage.getItem('thesisData');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.thesisEditor.value = data.thesis || '';
        this.references = data.references || [];
        this.nextRefId = data.nextRefId || this.references.length + 1;
        this.renderReferences();
      } catch (e) {
        console.error('Error loading saved data:', e);
      }
    }
  }

  export() {
    const thesis = this.thesisEditor.value;
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
}

// Initialize app when DOM is ready
let thesisApp;
document.addEventListener('DOMContentLoaded', () => {
  console.log('Thesis Editor app loaded');
  thesisApp = new ThesisEditor();
});
