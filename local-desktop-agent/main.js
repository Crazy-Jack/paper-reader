const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png') // Optional: add icon later
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development or with keyboard shortcut
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Add keyboard shortcut to toggle DevTools (F12 or Cmd+Option+I on Mac, Ctrl+Shift+I on Windows/Linux)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 key
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    // Cmd+Option+I on Mac, Ctrl+Shift+I on Windows/Linux
    if ((input.control || input.meta) && input.shift && input.key === 'I') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Suppress SSL certificate errors - these are typically harmless warnings
// from DevTools, auto-update checks, or internal Chromium processes
// Error messages like "handshake failed" or "CertVerifyProcBuiltin failed"
// are safe to ignore for a local desktop app that doesn't make external network requests
// The errors are often caused by:
// - DNS over HTTPS (dns.google) certificate chain issues
// - Corporate proxy/certificate interceptions
// - DevTools trying to connect to remote services
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('ignore-ssl-errors');

app.whenReady().then(() => {
  createWindow();

  console.log('Registering IPC handlers...');

  // IPC handler for loading papers from JSON files
  ipcMain.handle('load-papers', async (event, dataset) => {
    console.log('load-papers handler called with dataset:', dataset);
    try {
      const dataDir = path.join(__dirname, 'data');
      const jsonPath = path.join(dataDir, `${dataset}.json`);
      console.log('Looking for JSON file at:', jsonPath);
      
      // Check if data directory exists
      if (!fs.existsSync(dataDir)) {
        return {
          error: `Data directory not found: ${dataDir}. Please run convert_papers_to_json.py first.`
        };
      }
      
      // Check if JSON file exists
      if (!fs.existsSync(jsonPath)) {
        return {
          error: `Dataset file not found: ${jsonPath}. Please convert ${dataset}.pkl to JSON first.`
        };
      }
      
      // Read and parse JSON file
      const jsonData = fs.readFileSync(jsonPath, 'utf-8');
      const result = JSON.parse(jsonData);
      
      console.log(`Loaded ${result.count || result.papers?.length || 0} papers from ${dataset}`);
      
      return {
        success: true,
        dataset: result.dataset || dataset,
        count: result.count || result.papers?.length || 0,
        papers: result.papers || []
      };
    } catch (error) {
      console.error('Error loading papers:', error);
      return {
        error: `Failed to load papers: ${error.message}`
      };
    }
  });

  // IPC handler for downloading PDF from OpenReview URL
  ipcMain.handle('download-pdf', async (event, forumId) => {
    console.log('download-pdf handler called with forumId:', forumId);
    try {
      const pdfsDir = path.join(__dirname, 'data', 'pdfs');
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }
      
      const pdfPath = path.join(pdfsDir, `${forumId}.pdf`);
      
      // Check if PDF already exists
      if (fs.existsSync(pdfPath)) {
        return {
          success: true,
          path: pdfPath,
          cached: true,
          message: 'PDF already exists locally'
        };
      }
      
      // OpenReview PDF URL format: https://openreview.net/pdf/{forumId}.pdf
      const url = `https://openreview.net/pdf/${forumId}.pdf`;
      
      return new Promise((resolve, reject) => {
        const downloadFile = (downloadUrl) => {
          const file = fs.createWriteStream(pdfPath);
          
          https.get(downloadUrl, (response) => {
            if (response.statusCode === 200) {
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                resolve({
                  success: true,
                  path: pdfPath,
                  cached: false,
                  message: 'PDF downloaded successfully'
                });
              });
            } else if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 303 || response.statusCode === 307 || response.statusCode === 308) {
              // Follow redirect
              file.close();
              if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath);
              }
              
              const redirectUrl = response.headers.location;
              if (!redirectUrl) {
                reject(new Error('Redirect location not found'));
                return;
              }
              
              // Handle relative redirects
              const absoluteUrl = redirectUrl.startsWith('http') 
                ? redirectUrl 
                : `https://openreview.net${redirectUrl}`;
              
              // Retry with redirect URL
              downloadFile(absoluteUrl);
            } else {
              file.close();
              if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath);
              }
              
              // Try alternative URL format
              if (downloadUrl.includes('/pdf/')) {
                const altUrl = `https://openreview.net/pdf?id=${forumId}`;
                console.log(`Trying alternative URL format: ${altUrl}`);
                downloadFile(altUrl);
              } else {
                reject(new Error(`Failed to download PDF: HTTP ${response.statusCode}`));
              }
            }
          }).on('error', (err) => {
            file.close();
            if (fs.existsSync(pdfPath)) {
              fs.unlinkSync(pdfPath);
            }
            reject(new Error(`Failed to download PDF: ${err.message}`));
          });
        };
        
        downloadFile(url);
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      return {
        error: `Failed to download PDF: ${error.message}`
      };
    }
  });

  // IPC handler for loading PDF text content
  ipcMain.handle('load-pdf-text', async (event, forumId) => {
    console.log('load-pdf-text handler called with forumId:', forumId);
    
    // Suppress harmless warnings about canvas/DOMMatrix/Path2D polyfills
    // These are only needed for PDF rendering, not text extraction
    const originalWarn = console.warn;
    const suppressPolyfillWarnings = function(...args) {
      const message = String(args[0] || '');
      if (message.includes('Cannot polyfill') && 
          (message.includes('DOMMatrix') || message.includes('Path2D'))) {
        // Suppress these warnings - they don't affect text extraction functionality
        return;
      }
      originalWarn.apply(console, args);
    };
    console.warn = suppressPolyfillWarnings;
    
    try {
      
      // Use pdfjs-dist legacy build which exists and works in Node.js
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      
      const pdfPath = path.join(__dirname, 'data', 'pdfs', `${forumId}.pdf`);
      
      if (!fs.existsSync(pdfPath)) {
        return {
          error: `PDF not found locally. Please download it first.`
        };
      }
      
      // Read file as binary
      const dataBuffer = fs.readFileSync(pdfPath);
      
      // Convert Buffer to Uint8Array properly
      // Buffer extends Uint8Array, but pdfjs-dist might check instanceof Uint8Array
      // Create a new Uint8Array from the buffer data
      const uint8Array = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
      
      console.log('Loading PDF - Buffer length:', dataBuffer.length, 'Uint8Array length:', uint8Array.length);
      
      // Load the PDF document - pdfjs-dist expects Uint8Array, not Buffer
      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        verbosity: 0 // Reduce logging
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      
      // Extract text from all pages
      let fullText = '';
      const metadata = await pdfDocument.getMetadata();
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }
      
      return {
        success: true,
        text: fullText.trim(),
        numPages: numPages,
        info: metadata.info || {},
        metadata: metadata.metadata || {}
      };
    } catch (error) {
      console.error('Error loading PDF text:', error);
      return {
        error: `Failed to load PDF text: ${error.message}`
      };
    } finally {
      // Always restore original console.warn after PDF processing
      console.warn = originalWarn;
    }
  });

  console.log('All IPC handlers registered successfully');

  // IPC handler for saving Gemini API key
  ipcMain.handle('save-api-key', async (event, apiKey) => {
    try {
      // Store API key securely (in production, use electron-store or encrypt)
      // For now, save in app data directory
      const appDataPath = app.getPath('userData');
      const configPath = path.join(appDataPath, 'config.json');
      
      let config = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
      
      config.geminiApiKey = apiKey;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      return { success: true };
    } catch (error) {
      console.error('Error saving API key:', error);
      return { error: error.message };
    }
  });

  // IPC handler for loading Gemini API key
  ipcMain.handle('load-api-key', async () => {
    try {
      const appDataPath = app.getPath('userData');
      const configPath = path.join(appDataPath, 'config.json');
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { apiKey: config.geminiApiKey || null };
      }
      
      return { apiKey: null };
    } catch (error) {
      console.error('Error loading API key:', error);
      return { apiKey: null };
    }
  });

  // IPC handler for getting embeddings from Google API
  ipcMain.handle('get-embeddings', async (event, { apiKey, texts }) => {
    try {
      if (!apiKey) {
        return { error: 'API key not provided' };
      }
      
      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return { error: 'Texts array is required' };
      }
      
      // Use REST API directly for embeddings (more reliable)
      const embeddings = [];
      
      for (const text of texts) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
          
          const requestData = JSON.stringify({
            content: {
              parts: [{
                text: text
              }]
            }
          });
          
          const embedding = await new Promise((resolve, reject) => {
            const req = https.request(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            }, (res) => {
              let data = '';
              
              res.on('data', (chunk) => {
                data += chunk;
              });
              
              res.on('end', () => {
                try {
                  const result = JSON.parse(data);
                  if (result.error) {
                    reject(new Error(result.error.message || 'API error'));
                  } else if (result.embedding && result.embedding.values) {
                    resolve(result.embedding.values);
                  } else {
                    reject(new Error('Unexpected response format'));
                  }
                } catch (err) {
                  reject(new Error(`Failed to parse response: ${err.message}`));
                }
              });
            });
            
            req.on('error', (err) => {
              reject(new Error(`Request failed: ${err.message}`));
            });
            
            req.write(requestData);
            req.end();
          });
          
          embeddings.push(embedding);
          
          // Small delay to avoid rate limiting
          if (texts.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (err) {
          console.error('Error embedding text:', err);
          return { error: `Failed to get embedding: ${err.message}` };
        }
      }
      
      return { success: true, embeddings };
    } catch (error) {
      console.error('Error getting embeddings:', error);
      return { error: error.message || 'Failed to get embeddings' };
    }
  });

  // IPC handler for saving embeddings cache
  ipcMain.handle('save-embeddings', async (event, { dataset, embeddings, type }) => {
    try {
      const embeddingsDir = path.join(__dirname, 'data', 'embeddings');
      if (!fs.existsSync(embeddingsDir)) {
        fs.mkdirSync(embeddingsDir, { recursive: true });
      }
      
      const filename = type === 'thesis' ? 'thesis_embeddings.json' : `${dataset}_embeddings.json`;
      const filePath = path.join(embeddingsDir, filename);
      
      const data = {
        dataset: dataset || 'thesis',
        type: type || 'papers',
        embeddings: embeddings,
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      return { success: true, path: filePath };
    } catch (error) {
      console.error('Error saving embeddings:', error);
      return { error: error.message || 'Failed to save embeddings' };
    }
  });

  // IPC handler for loading embeddings cache
  ipcMain.handle('load-embeddings', async (event, { dataset, type }) => {
    try {
      const embeddingsDir = path.join(__dirname, 'data', 'embeddings');
      const filename = type === 'thesis' ? 'thesis_embeddings.json' : `${dataset}_embeddings.json`;
      const filePath = path.join(embeddingsDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return { success: false, embeddings: null };
      }
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      return { success: true, embeddings: data.embeddings, timestamp: data.timestamp };
    } catch (error) {
      console.error('Error loading embeddings:', error);
      return { error: error.message || 'Failed to load embeddings' };
    }
  });

  // Helper function to compute content hash
  function computeContentHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  // ============================================================================
  // PARAGRAPH DETECTION AND ANALYSIS MODULE
  // ============================================================================

  /**
   * Detect paragraphs in thesis content (handles both HTML and plain text)
   * @param {string} thesisContent - The thesis content (HTML or plain text)
   * @param {string} plainText - Plain text version for position tracking
   * @returns {Array} Array of paragraph objects with metadata
   */
  function detectParagraphs(thesisContent, plainText) {
    const paragraphs = [];
    
    if (!thesisContent || !plainText) {
      return paragraphs;
    }
    
    // Debug: Log content structure
    console.log('Paragraph detection - Content length:', plainText.length);
    console.log('Paragraph detection - HTML length:', thesisContent.length);
    console.log('Paragraph detection - Has HTML tags:', /<[^>]+>/.test(thesisContent));
    console.log('Paragraph detection - Double line breaks:', (plainText.match(/\n\s*\n/g) || []).length);
    console.log('Paragraph detection - Single line breaks:', (plainText.match(/\n/g) || []).length);
    console.log('Paragraph detection - Has <p> tags:', /<p[^>]*>/i.test(thesisContent));
    console.log('Paragraph detection - Has <br> tags:', /<br\s*\/?>/i.test(thesisContent));
    console.log('Paragraph detection - Has <div> tags:', /<div[^>]*>/i.test(thesisContent));
    console.log('Paragraph detection - HTML preview (first 300 chars):', thesisContent.substring(0, 300));

    // Strategy 1: Try to parse as HTML first
    // Look for paragraph tags, divs, or block-level elements that might be paragraphs
    const htmlParagraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    const htmlDivPattern = /<div[^>]*>([\s\S]*?)<\/div>/gi;
    const htmlBrPattern = /<br\s*\/?>/gi;
    
    let match;
    let htmlMatches = [];
    
    // Collect HTML paragraph matches from <p> tags
    while ((match = htmlParagraphPattern.exec(thesisContent)) !== null) {
      const htmlText = match[1].replace(/<[^>]+>/g, '').trim(); // Strip HTML tags
      if (htmlText.length > 10) { // Only consider substantial paragraphs
        htmlMatches.push({
          html: match[0],
          text: htmlText,
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });
      }
    }
    
    // If no <p> tags, try to split by <br> tags or <div> tags
    if (htmlMatches.length === 0) {
      // Try splitting by multiple <br> tags (which often indicate paragraph breaks)
      const brMatches = [...thesisContent.matchAll(/<br\s*\/?>/gi)];
      if (brMatches.length > 1) {
        // Split content by <br> tags and treat each segment as a potential paragraph
        let lastIndex = 0;
        brMatches.forEach((brMatch, idx) => {
          const segment = thesisContent.substring(lastIndex, brMatch.index);
          const segmentText = segment.replace(/<[^>]+>/g, '').trim();
          if (segmentText.length > 20) {
            htmlMatches.push({
              html: segment,
              text: segmentText,
              startIndex: lastIndex,
              endIndex: brMatch.index
            });
          }
          lastIndex = brMatch.index + brMatch[0].length;
        });
        
        // Add last segment
        const lastSegment = thesisContent.substring(lastIndex);
        const lastSegmentText = lastSegment.replace(/<[^>]+>/g, '').trim();
        if (lastSegmentText.length > 20) {
          htmlMatches.push({
            html: lastSegment,
            text: lastSegmentText,
            startIndex: lastIndex,
            endIndex: thesisContent.length
          });
        }
      }
      
      // If still no matches, try <div> tags
      if (htmlMatches.length === 0) {
        while ((match = htmlDivPattern.exec(thesisContent)) !== null) {
          const htmlText = match[1].replace(/<[^>]+>/g, '').trim();
          if (htmlText.length > 20) {
            htmlMatches.push({
              html: match[0],
              text: htmlText,
              startIndex: match.index,
              endIndex: match.index + match[0].length
            });
          }
        }
      }
    }
    
    // If we found HTML paragraphs, use them
    if (htmlMatches.length > 0) {
      htmlMatches.forEach((match, index) => {
        // Find position in plain text
        const textStart = plainText.indexOf(match.text);
        const textEnd = textStart + match.text.length;
        
        paragraphs.push({
          index: index,
          text: match.text,
          html: match.html,
          startPos: textStart >= 0 ? textStart : index * 100, // Fallback position
          endPos: textEnd >= 0 ? textEnd : (index + 1) * 100,
          type: 'html'
        });
      });
      
      return paragraphs;
    }
    
    // Strategy 2: Parse plain text by double line breaks
    let textParagraphs = plainText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Strategy 2b: If no double line breaks, try single line breaks with substantial content
    if (textParagraphs.length <= 1 && plainText.includes('\n')) {
      // Split by single line breaks and group into paragraphs
      const lines = plainText.split(/\n/);
      textParagraphs = [];
      let currentPara = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length === 0) {
          // Empty line - end current paragraph if it has content
          if (currentPara.trim().length > 20) {
            textParagraphs.push(currentPara.trim());
            currentPara = '';
          }
        } else {
          // Add line to current paragraph
          currentPara += (currentPara ? ' ' : '') + line;
          
          // If current paragraph is getting long (>300 chars), consider ending it at sentence boundary
          if (currentPara.length > 300) {
            // Try to find sentence boundary
            const lastSentenceEnd = currentPara.search(/[.!?]\s+[A-Z]/);
            if (lastSentenceEnd > 100) {
              // Split at sentence boundary
              const paraPart = currentPara.substring(0, lastSentenceEnd + 1).trim();
              const remaining = currentPara.substring(lastSentenceEnd + 1).trim();
              if (paraPart.length > 20) {
                textParagraphs.push(paraPart);
              }
              currentPara = remaining;
            }
          }
        }
      }
      
      // Add last paragraph if it has content
      if (currentPara.trim().length > 20) {
        textParagraphs.push(currentPara.trim());
      }
    }
    
    // Strategy 2c: If still only one paragraph, ALWAYS try splitting by sentence boundaries
    // This is more aggressive - we'll split even short text if it has multiple sentences
    if (textParagraphs.length === 1) {
      const longText = textParagraphs[0];
      const sentenceCount = (longText.match(/[.!?]+\s+/g) || []).length;
      
      // If we have multiple sentences, try to split into paragraphs
      if (sentenceCount > 1) {
        console.log(`Attempting sentence-based paragraph splitting (${sentenceCount} sentences found)`);
        
        // Split by sentence boundaries
        const sentences = longText.split(/([.!?]+\s+)/);
        const newParagraphs = [];
        let currentPara = '';
        
        // Calculate target: aim for 2-5 paragraphs depending on content length
        const minParaLength = Math.max(100, Math.floor(longText.length / 5)); // At most 5 paragraphs
        const maxParaLength = Math.max(200, Math.floor(longText.length / 2)); // At least 2 paragraphs
        const targetLength = Math.min(maxParaLength, Math.max(minParaLength, 150));
        
        for (let i = 0; i < sentences.length; i += 2) {
          const sentence = sentences[i] + (sentences[i + 1] || '');
          currentPara += sentence;
          
          // If we have a substantial paragraph and more sentences, start a new paragraph
          // Be more aggressive: split if we have at least 2 sentences and meet length threshold
          const sentencesInPara = (currentPara.match(/[.!?]+\s+/g) || []).length;
          if (currentPara.length >= targetLength && sentencesInPara >= 2 && i + 2 < sentences.length) {
            newParagraphs.push(currentPara.trim());
            currentPara = '';
          }
        }
        
        // Add remaining content as last paragraph
        if (currentPara.trim().length > 20) {
          newParagraphs.push(currentPara.trim());
        }
        
        // Use new paragraphs if we created meaningful splits (at least 2 paragraphs)
        if (newParagraphs.length > 1) {
          console.log(`✓ Sentence-based splitting created ${newParagraphs.length} paragraphs`);
          textParagraphs = newParagraphs;
        } else if (sentenceCount >= 3) {
          // If we have 3+ sentences but splitting didn't work, force split every 2-3 sentences
          console.log(`Force-splitting ${sentenceCount} sentences into paragraphs`);
          const forcedParagraphs = [];
          let forcedPara = '';
          let sentenceIndex = 0;
          
          for (let i = 0; i < sentences.length; i += 2) {
            const sentence = sentences[i] + (sentences[i + 1] || '');
            forcedPara += sentence;
            sentenceIndex++;
            
            // Force split every 2-3 sentences
            if (sentenceIndex >= 2 && i + 2 < sentences.length) {
              forcedParagraphs.push(forcedPara.trim());
              forcedPara = '';
              sentenceIndex = 0;
            }
          }
          
          if (forcedPara.trim().length > 0) {
            forcedParagraphs.push(forcedPara.trim());
          }
          
          if (forcedParagraphs.length > 1) {
            console.log(`✓ Force-splitting created ${forcedParagraphs.length} paragraphs`);
            textParagraphs = forcedParagraphs;
          }
        }
      }
    }
    
    let currentPos = 0;
    textParagraphs.forEach((paraText, index) => {
      const trimmed = paraText.trim();
      if (trimmed.length > 10) { // Only consider substantial paragraphs
        const startPos = plainText.indexOf(trimmed, currentPos);
        const endPos = startPos + trimmed.length;
        
        paragraphs.push({
          index: index,
          text: trimmed,
          startPos: startPos >= 0 ? startPos : currentPos,
          endPos: endPos >= 0 ? endPos : currentPos + trimmed.length,
          type: 'text'
        });
        
        currentPos = endPos;
      }
    });
    
    // Strategy 3: If no paragraphs found, treat entire content as one paragraph
    if (paragraphs.length === 0 && plainText.trim().length > 0) {
      paragraphs.push({
        index: 0,
        text: plainText.trim(),
        startPos: 0,
        endPos: plainText.length,
        type: 'single'
      });
    }
    
    // Final check: If we still only have 1 paragraph but content is substantial, 
    // try one more aggressive split by looking for topic shifts
    if (paragraphs.length === 1 && plainText.length > 300) {
      console.log('⚠ Only 1 paragraph detected for substantial content, attempting topic-based splitting...');
      
      // Look for topic shift indicators (sentence starts that might indicate new paragraph)
      // Common indicators: "However", "Furthermore", "In addition", "Moreover", "Additionally", "Similarly", "Conversely", etc.
      const topicShiftPattern = /\s+(However|Furthermore|In addition|Moreover|Additionally|Similarly|Conversely|On the other hand|In contrast|Therefore|Thus|Hence|Consequently|As a result|For example|For instance|Specifically|In particular|First|Second|Third|Finally|In conclusion|To summarize|In summary)[\s,]/gi;
      
      const shifts = [...plainText.matchAll(topicShiftPattern)];
      if (shifts.length > 0) {
        console.log(`Found ${shifts.length} potential topic shifts`);
        const newParagraphs = [];
        let lastIndex = 0;
        
        // Split at topic shifts, but ensure each paragraph is substantial
        shifts.forEach((shift, idx) => {
          const shiftPos = shift.index;
          const segment = plainText.substring(lastIndex, shiftPos).trim();
          
          if (segment.length > 50) {
            newParagraphs.push({
              index: newParagraphs.length,
              text: segment,
              startPos: lastIndex,
              endPos: shiftPos,
              type: 'topic-split'
            });
          }
          
          lastIndex = shiftPos;
        });
        
        // Add final segment
        const finalSegment = plainText.substring(lastIndex).trim();
        if (finalSegment.length > 50) {
          newParagraphs.push({
            index: newParagraphs.length,
            text: finalSegment,
            startPos: lastIndex,
            endPos: plainText.length,
            type: 'topic-split'
          });
        }
        
        if (newParagraphs.length > 1) {
          console.log(`✓ Topic-based splitting created ${newParagraphs.length} paragraphs`);
          return newParagraphs;
        }
      }
    }
    
    console.log(`Final paragraph count: ${paragraphs.length}`);
    if (paragraphs.length === 1) {
      console.log('⚠ WARNING: Only 1 paragraph detected. Content may need manual paragraph breaks.');
      console.log('Content preview:', plainText.substring(0, 200));
    }
    
    return paragraphs;
  }

  /**
   * Extract summaries for paragraphs using LLM
   * @param {Array} paragraphs - Array of paragraph objects
   * @param {string} apiKey - Gemini API key
   * @param {string} thesisContentHash - Hash of thesis content for caching
   * @returns {Promise<Array>} Array of paragraphs with summaries added
   */
  async function extractParagraphSummaries(paragraphs, apiKey, thesisContentHash) {
    if (!paragraphs || paragraphs.length === 0) {
      return paragraphs;
    }

    // Check cache first
    const cacheDir = path.join(__dirname, 'data', 'paragraph_cache');
    const cacheFile = path.join(cacheDir, `${thesisContentHash}.json`);
    
    if (fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        // Verify cache matches current paragraphs
        if (cached.paragraphs && cached.paragraphs.length === paragraphs.length) {
          const cacheValid = cached.paragraphs.every((cachedPara, idx) => {
            const currentPara = paragraphs[idx];
            return cachedPara.text === currentPara.text;
          });
          
          if (cacheValid) {
            console.log(`✓ Using cached paragraph summaries (${paragraphs.length} paragraphs)`);
            return cached.paragraphs;
          }
        }
      } catch (error) {
        console.warn('Error reading paragraph cache:', error);
      }
    }

    // Extract summaries using LLM (batch process for efficiency)
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const paragraphsWithSummaries = [];
    
    // Process in batches of 5 to avoid token limits
    const batchSize = 5;
    for (let i = 0; i < paragraphs.length; i += batchSize) {
      const batch = paragraphs.slice(i, i + batchSize);
      
      const batchPrompt = `Extract a concise one-sentence summary for each of the following paragraphs. Return a JSON array with one summary per paragraph in order.

Paragraphs:
${batch.map((p, idx) => `${idx + 1}. ${p.text.substring(0, 500)}${p.text.length > 500 ? '...' : ''}`).join('\n\n')}

Return JSON array: ["summary1", "summary2", ...]`;

      try {
        const result = await model.generateContent(batchPrompt);
        const response = await result.response;
        const text = response.text();
        
        // Parse summaries
        let summaries = [];
        try {
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            summaries = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          // Fallback: extract summaries line by line
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          summaries = lines.slice(0, batch.length).map(l => l.replace(/^\d+\.\s*/, '').trim());
        }
        
        // Add summaries to paragraphs
        batch.forEach((para, idx) => {
          paragraphsWithSummaries.push({
            ...para,
            summary: summaries[idx] || para.text.substring(0, 100) + '...'
          });
        });
        
        // Small delay to avoid rate limiting
        if (i + batchSize < paragraphs.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`Error extracting summaries for batch ${i}-${i + batchSize}:`, error);
        // Fallback: use first 100 chars as summary
        batch.forEach(para => {
          paragraphsWithSummaries.push({
            ...para,
            summary: para.text.substring(0, 100) + '...'
          });
        });
      }
    }

    // Cache the results
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cacheFile, JSON.stringify({
        paragraphs: paragraphsWithSummaries,
        timestamp: new Date().toISOString()
      }, null, 2));
      console.log(`✓ Cached paragraph summaries for ${paragraphs.length} paragraphs`);
    } catch (error) {
      console.warn('Error caching paragraph summaries:', error);
    }

    return paragraphsWithSummaries;
  }

  /**
   * Find relevant paragraphs using semantic similarity (embeddings)
   * @param {string} userRequest - User's edit request
   * @param {Array} paragraphs - Array of paragraphs with summaries
   * @param {string} apiKey - Gemini API key
   * @returns {Promise<Array>} Array of relevant paragraph indices with scores
   */
  async function findRelevantParagraphs(userRequest, paragraphs, apiKey) {
    if (!paragraphs || paragraphs.length === 0) {
      return [];
    }

    // Get embedding for user request
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    try {
      // Get embeddings for user request and paragraph summaries
      const textsToEmbed = [
        userRequest,
        ...paragraphs.map(p => p.summary || p.text.substring(0, 200))
      ];

      const embeddingsResult = await genAI.getGenerativeModel({ model: 'text-embedding-004' }).embedContent({
        content: { parts: [{ text: textsToEmbed.join('\n\n') }] }
      });

      // Note: Gemini embedding API might work differently, this is a placeholder
      // For now, use simple keyword matching as fallback
      const userRequestLower = userRequest.toLowerCase();
      const keywords = userRequestLower.split(/\s+/).filter(w => w.length > 3);
      
      const relevant = paragraphs.map((para, index) => {
        const paraText = (para.summary || para.text).toLowerCase();
        let score = 0;
        
        keywords.forEach(keyword => {
          if (paraText.includes(keyword)) {
            score += 1;
          }
        });
        
        return { index, score, paragraph: para };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 relevant paragraphs
      
      return relevant;
    } catch (error) {
      console.warn('Error finding relevant paragraphs with embeddings, using keyword matching:', error);
      
      // Fallback: simple keyword matching
      const userRequestLower = userRequest.toLowerCase();
      const keywords = userRequestLower.split(/\s+/).filter(w => w.length > 3);
      
      const relevant = paragraphs.map((para, index) => {
        const paraText = (para.summary || para.text).toLowerCase();
        let score = 0;
        
        keywords.forEach(keyword => {
          if (paraText.includes(keyword)) {
            score += 1;
          }
        });
        
        return { index, score, paragraph: para };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
      
      return relevant;
    }
  }

  // ============================================================================
  // END PARAGRAPH DETECTION AND ANALYSIS MODULE
  // ============================================================================

  // IPC handler for calling Gemini API
  ipcMain.handle('call-gemini', async (event, { apiKey, prompt, context }) => {
    try {
      // Lazy load to avoid DOM API issues
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      
      if (!apiKey) {
        return { error: 'API key not provided' };
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      // Use gemini-2.5-flash (latest and fastest model)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      // Format the prompt with context - natural conversational style
      let fullPrompt = '';
      
      if (context && context.length > 0) {
        // Build context section naturally - include full text of all papers
        fullPrompt = `I have loaded the following research papers as context:\n\n`;
        context.forEach((ctx, idx) => {
          fullPrompt += `Paper ${idx + 1}: "${ctx.title}" (${ctx.numPages} pages)\n`;
          // Include full context - no character limit
          fullPrompt += `Content:\n${ctx.text}\n\n`;
        });
        fullPrompt += `\nBased on these papers, please answer the following question in a natural, conversational way:\n\n${prompt}`;
      } else {
        // No context, just answer normally
        fullPrompt = prompt;
      }
      
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
      
      return { success: true, text };
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return { error: error.message || 'Failed to call Gemini API' };
    }
  });

  // Helper function to parse JSON from LLM response (basic version - kept for compatibility)
  function parseBasicJSON(rawResponse) {
    // Try extracting from markdown code block
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        // Fall through to try direct parse
      }
    }
    
    // Try direct parse
    try {
      return JSON.parse(rawResponse);
    } catch (e) {
      // Find JSON boundaries
      const firstBrace = rawResponse.indexOf('{');
      const lastBrace = rawResponse.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(rawResponse.substring(firstBrace, lastBrace + 1));
        } catch (e) {
          throw new Error('Failed to parse JSON response');
        }
      }
      throw new Error('No JSON found in response');
    }
  }

  // Enhanced parser for edit proposals with multiple fallback strategies
  function parseEditProposalJSON(rawResponse) {
    console.log('Parsing edit proposal response...');
    console.log('Response length:', rawResponse.length);
    console.log('Response preview:', rawResponse.substring(0, 500));
    
    // Strategy 1: Direct JSON parse (should work with structured output mode)
    try {
      const parsed = JSON.parse(rawResponse);
      console.log('✓ Parsed successfully with direct JSON.parse');
      return parsed;
    } catch (e) {
      console.log('Direct parse failed:', e.message);
    }
    
    // Strategy 2: Extract from markdown code blocks
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        console.log('✓ Parsed successfully from markdown code block');
        return parsed;
      } catch (e) {
        console.log('Markdown extraction parse failed:', e.message);
      }
    }
    
    // Strategy 3: Find JSON object boundaries (first { to last })
    const firstBrace = rawResponse.indexOf('{');
    const lastBrace = rawResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const jsonStr = rawResponse.substring(firstBrace, lastBrace + 1);
        // Try to clean up common issues
        let cleaned = jsonStr
          .replace(/,\s*}/g, '}')  // Remove trailing commas before }
          .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Add quotes to unquoted keys
          .replace(/:\s*([^",\[\]{}]+)([,}\]])/g, (match, value, punctuation) => {
            // Add quotes to unquoted string values
            if (!/^(true|false|null|\d+)$/.test(value.trim())) {
              return `: "${value.trim()}"${punctuation}`;
            }
            return match;
          });
        
        const parsed = JSON.parse(cleaned);
        console.log('✓ Parsed successfully from JSON boundaries with cleanup');
        return parsed;
      } catch (e) {
        console.log('Boundary extraction parse failed:', e.message);
      }
    }
    
    // Strategy 4: Try to extract valid JSON from mixed content
    // Find all potential JSON objects
    const jsonCandidates = [];
    let depth = 0;
    let start = -1;
    
    for (let i = 0; i < rawResponse.length; i++) {
      if (rawResponse[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (rawResponse[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          jsonCandidates.push(rawResponse.substring(start, i + 1));
          start = -1;
        }
      }
    }
    
    // Try parsing each candidate
    for (const candidate of jsonCandidates) {
      try {
        const parsed = JSON.parse(candidate);
        // Check if it looks like a valid proposal
        if (parsed.changes && Array.isArray(parsed.changes)) {
          console.log('✓ Parsed successfully from JSON candidate');
          return parsed;
        }
      } catch (e) {
        // Continue to next candidate
      }
    }
    
    // All strategies failed
    throw new Error('Failed to parse JSON response with all strategies');
  }

  // Helper function to format papers using LLM for structured citation format
  async function formatPapersForCitation(genAI, papers) {
    // Define schema for citation format
    const citationSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Full title of the paper'
          },
          authors: {
            type: 'string',
            description: 'Comma-separated list of authors (Last, First Middle format)'
          },
          year: {
            type: 'string',
            description: 'Publication year (YYYY format)'
          },
          venue: {
            type: 'string',
            description: 'Conference or journal name (e.g., "NeurIPS", "ICLR", "Journal of Machine Learning")'
          },
          presentation: {
            type: 'string',
            description: 'Presentation type at the conference (e.g., "Oral", "Spotlight", "Poster", or empty if not applicable)'
          },
          url: {
            type: 'string',
            description: 'URL to the paper'
          },
          notes: {
            type: 'string',
            description: 'Abstract or additional notes about the paper'
          },
          paperIndex: {
            type: 'number',
            description: 'Original paper index for mapping back to citations'
          }
        },
        required: ['title', 'authors', 'year']
      }
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: citationSchema
      }
    });

    // Create prompt for formatting papers
    const papersPrompt = papers.map((p, idx) => {
      return `Paper ${idx + 1}:
Title: ${p.title || 'N/A'}
Authors: ${p.authors || 'N/A'}
Year: ${p.year || 'N/A'}
Venue: ${p.venue || 'N/A'}
Presentation Type: ${p.presentation || 'N/A'}
URL: ${p.url || 'N/A'}
Abstract/Notes: ${(p.notes || '').substring(0, 500)}`;
    }).join('\n\n');

    const prompt = `Format the following papers into structured citation references. For each paper:
1. Extract and clean the title
2. Format authors as "Last, First Middle" (comma-separated, use "et al." if more than 10 authors)
3. Extract the publication year (use current year if not available: ${new Date().getFullYear()})
4. Identify the venue (conference or journal name) - keep this as the venue name only (e.g., "NeurIPS", "ICLR", "Journal of Machine Learning")
5. Include the presentation type as a SEPARATE field if available (e.g., "Oral", "Spotlight", "Poster" - only for conference papers, leave empty string "" for journal papers or if not applicable)
6. Include the URL if available
7. Include abstract/notes (truncate to 500 characters if longer)

IMPORTANT: For the presentation type:
- Return it as a SEPARATE field, not merged with venue
- Include it only if the paper was presented at a conference with a specific presentation type (Oral, Spotlight, Poster)
- Leave it as an empty string "" if it's a journal paper, or if presentation type is "N/A" or not applicable
- Do NOT include presentation type in the venue field - keep venue and presentation as separate fields

Papers to format:
${papersPrompt}

Return a JSON array with formatted citation information for each paper in the same order.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      let formattedPapers = [];
      try {
        formattedPapers = JSON.parse(text);
        
        // Ensure paperIndex is preserved
        formattedPapers = formattedPapers.map((formatted, idx) => ({
          ...formatted,
          paperIndex: papers[idx].paperIndex,
          // Preserve original data as fallback
          originalTitle: papers[idx].title,
          originalAuthors: papers[idx].authors,
          originalYear: papers[idx].year,
          originalVenue: papers[idx].venue,
          originalPresentation: papers[idx].presentation || '',
          originalUrl: papers[idx].url,
          originalNotes: papers[idx].notes
        }));
      } catch (parseError) {
        console.error('Error parsing LLM citation response:', parseError);
        console.error('Raw response:', text);
        // Fallback to original papers
        return papers;
      }

      return formattedPapers;
    } catch (error) {
      console.error('Error formatting papers with LLM:', error);
      throw error;
    }
  }

  // ============================================================================
  // ITERATIVE REASONING MODULE
  // ============================================================================

  /**
   * Generate a reading plan for understanding the edit request
   * @param {string} userRequest - User's edit request
   * @param {Array} paragraphs - Array of paragraphs with summaries
   * @param {Array} relevantParagraphs - Relevant paragraphs identified
   * @param {string} apiKey - Gemini API key
   * @returns {Promise<Object>} Reading plan with steps and next action
   */
  async function generateReadingPlan(userRequest, paragraphs, relevantParagraphs, apiKey) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const readingPlanSchema = {
      type: 'object',
      properties: {
        reasoning: {
          type: 'string',
          description: 'Explanation of what needs to be understood before editing'
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              target: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['paragraph', 'sentence', 'section'] },
                  index: { type: 'number' },
                  paragraphIndex: { type: 'number' },
                  sentenceIndex: { type: 'number' }
                }
              },
              reason: { type: 'string' }
            },
            required: ['target', 'reason']
          }
        },
        nextAction: {
          type: 'string',
          enum: ['read', 'edit', 'clarify'],
          description: 'What to do next: read more, proceed to edit, or ask for clarification'
        },
        confidence: {
          type: 'number',
          description: 'Confidence level 0-1 that enough context has been gathered'
        }
      },
      required: ['reasoning', 'steps', 'nextAction', 'confidence']
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: readingPlanSchema
      }
    });

    const paragraphContext = relevantParagraphs.slice(0, 5).map((item, idx) => {
      return `Paragraph ${item.index}: "${item.paragraph.summary || item.paragraph.text.substring(0, 100)}..."`;
    }).join('\n');

    const prompt = `You are analyzing a thesis editing request to determine what context needs to be read before making the edit.

User Request: ${userRequest}

Available Paragraphs (${paragraphs.length} total):
${paragraphContext}

Relevant paragraphs identified: ${relevantParagraphs.map(r => r.index).join(', ')}

Generate a reading plan that specifies:
1. What reasoning is needed to understand the edit request
2. Which paragraphs/sentences should be read to gather context
3. Whether more reading is needed or if we can proceed to editing
4. Confidence level (0-1) that enough context has been gathered

Keep the reading plan focused - only read what's necessary. If the edit is simple (e.g., fix typo, add citation), you may not need to read anything.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return parseEditProposalJSON(text); // Reuse the JSON parser
    } catch (error) {
      console.error('Error generating reading plan:', error);
      // Fallback: simple plan
      return {
        reasoning: 'Simple edit request, proceeding directly to edit',
        steps: [],
        nextAction: 'edit',
        confidence: 0.8
      };
    }
  }

  /**
   * Execute a read command to extract text from specified location
   * @param {Object} readCommand - Read command with target specification
   * @param {Array} paragraphs - Array of paragraphs
   * @param {string} thesisContent - Full thesis content
   * @returns {string} Extracted text from the location
   */
  function executeReadCommand(readCommand, paragraphs, thesisContent) {
    const target = readCommand.target;
    
    if (target.type === 'paragraph' && target.index !== undefined) {
      const para = paragraphs[target.index];
      if (para) {
        return para.text;
      }
    } else if (target.type === 'sentence' && target.paragraphIndex !== undefined) {
      const para = paragraphs[target.paragraphIndex];
      if (para) {
        const sentences = para.text.split(/[.!?]+\s+/);
        const sentenceIndex = target.sentenceIndex || 0;
        if (sentenceIndex < sentences.length) {
          return sentences[sentenceIndex];
        }
        return para.text; // Fallback to full paragraph
      }
    }
    
    return ''; // Return empty if location not found
  }

  /**
   * Main reasoning loop - iteratively read and understand context
   * @param {string} userRequest - User's edit request
   * @param {string} thesisContent - Full thesis content
   * @param {Array} paragraphs - Array of paragraphs with summaries
   * @param {Array} loadedContexts - Loaded paper contexts
   * @param {string} apiKey - Gemini API key
   * @returns {Promise<Object>} Accumulated context and reasoning
   */
  async function reasonAboutEdit(userRequest, thesisContent, paragraphs, loadedContexts, apiKey) {
    const MAX_ITERATIONS = 3;
    const MIN_CONFIDENCE = 0.7;
    
    // Heuristic: skip reasoning for simple edits
    const simpleEditPatterns = [
      /fix typo/i,
      /correct spelling/i,
      /add citation/i,
      /change word/i
    ];
    
    const isSimpleEdit = simpleEditPatterns.some(pattern => pattern.test(userRequest));
    if (isSimpleEdit && userRequest.length < 50) {
      console.log('Skipping reasoning for simple edit');
      return {
        reasoning: 'Simple edit detected, proceeding directly',
        accumulatedContext: [],
        iterations: 0
      };
    }

    // Find relevant paragraphs first
    const relevantParagraphs = await findRelevantParagraphs(userRequest, paragraphs, apiKey);
    
    let accumulatedContext = [];
    let currentReasoning = '';
    let iteration = 0;
    
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`Reasoning iteration ${iteration}/${MAX_ITERATIONS}`);
      
      // Generate reading plan
      const readingPlan = await generateReadingPlan(
        userRequest,
        paragraphs,
        relevantParagraphs,
        apiKey
      );
      
      currentReasoning = readingPlan.reasoning || currentReasoning;
      
      // Execute read commands
      if (readingPlan.steps && readingPlan.steps.length > 0) {
        readingPlan.steps.forEach(step => {
          const extractedText = executeReadCommand(step, paragraphs, thesisContent);
          if (extractedText) {
            accumulatedContext.push({
              location: step.target,
              reason: step.reason,
              text: extractedText
            });
          }
        });
      }
      
      // Check if we should continue
      const shouldContinue = readingPlan.nextAction === 'read' && 
                             readingPlan.confidence < MIN_CONFIDENCE &&
                             iteration < MAX_ITERATIONS;
      
      if (!shouldContinue) {
        console.log(`Reasoning complete after ${iteration} iterations (confidence: ${readingPlan.confidence})`);
        break;
      }
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return {
      reasoning: currentReasoning,
      accumulatedContext: accumulatedContext,
      iterations: iteration,
      relevantParagraphs: relevantParagraphs.map(r => r.index)
    };
  }

  // ============================================================================
  // END ITERATIVE REASONING MODULE
  // ============================================================================

  // ============================================================================
  // REVIEW AGENT MODULE
  // ============================================================================

  /**
   * Review edit proposal for coherence, consistency, and style
   * @param {Object} proposal - Edit proposal to review
   * @param {string} thesisContent - Full thesis content
   * @param {Array} paragraphs - Array of paragraphs
   * @param {string} apiKey - Gemini API key
   * @returns {Promise<Object>} Review results with verdict and issues
   */
  async function reviewEditProposal(proposal, thesisContent, paragraphs, apiKey) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const reviewSchema = {
      type: 'object',
      properties: {
        approved: {
          type: 'boolean',
          description: 'Whether the edit should be approved'
        },
        confidence: {
          type: 'number',
          description: 'Confidence level 0-1 in the review'
        },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['coherence', 'consistency', 'style', 'scope', 'grammar', 'completeness']
              },
              severity: {
                type: 'string',
                enum: ['blocker', 'warning', 'nit']
              },
              description: { type: 'string' },
              suggestion: { type: 'string' }
            },
            required: ['type', 'severity', 'description']
          }
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' }
        },
        overallVerdict: {
          type: 'string',
          enum: ['approve', 'reject', 'approve_with_suggestions']
        }
      },
      required: ['approved', 'confidence', 'issues', 'overallVerdict']
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: reviewSchema
      }
    });

    // Prepare proposal summary for review
    const proposalSummary = proposal.changes.map((change, idx) => {
      return `Change ${idx + 1}: ${change.action} - "${change.newText.substring(0, 100)}${change.newText.length > 100 ? '...' : ''}"`;
    }).join('\n');

    const prompt = `You are a STRICT quality reviewer for thesis edit proposals. You have HIGH standards - only approve proposals that are excellent.

Review this edit proposal with STRICT criteria:

1. **Coherence** (STRICT): 
   - Does the edit maintain perfect logical flow?
   - Are transitions smooth and natural?
   - Does it fit seamlessly into the document?
   - REJECT if flow is disrupted or transitions are awkward

2. **Consistency** (STRICT):
   - Does the edit contradict ANY earlier statements?
   - Are terms used consistently throughout?
   - Does it maintain the document's voice?
   - REJECT if there are contradictions or inconsistencies

3. **Style** (STRICT):
   - Does the edit match the writing style EXACTLY?
   - Is the tone consistent?
   - Are sentence structures appropriate?
   - REJECT if style doesn't match (even minor mismatches)

4. **Scope** (STRICT):
   - Does the edit stay on-topic?
   - Is all content relevant?
   - Does it add value without redundancy?
   - REJECT if content is off-topic or redundant

5. **Grammar and Completeness** (STRICT):
   - Are ALL sentences complete and grammatically correct?
   - Are there any sentence fragments?
   - Is punctuation correct?
   - REJECT if there are fragments or grammar issues

6. **Quality** (STRICT):
   - Is the edit well-written?
   - Does it enhance the document?
   - Would a reader find it natural?
   - REJECT if quality is questionable

Edit Proposal:
${proposal.description || 'No description'}
Reasoning: ${proposal.reasoning || 'No reasoning provided'}

Proposed Changes:
${proposalSummary}

Thesis Context (first 1500 chars):
${thesisContent.substring(0, 1500)}...

STRICT REVIEW GUIDELINES:
- Only approve if confidence >= 0.8 AND no significant issues
- Classify issues as:
  * "blocker": Prevents edit (contradictions, fragments, major coherence/style issues) - MUST reject
  * "warning": Significant concern (style mismatch, minor coherence, quality issues) - REJECT if 2+ warnings
  * "nit": Minor suggestion (word choice, formatting) - Can approve with nits
- Be thorough - identify ALL issues, not just major ones
- Provide SPECIFIC suggestions for how to fix each issue
- If unsure, err on the side of rejection with detailed feedback

Return your review with strict verdict and comprehensive issues list.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const review = parseEditProposalJSON(text);
      
      // Ensure defaults
      if (!review.issues) review.issues = [];
      if (!review.suggestions) review.suggestions = [];
      if (!review.overallVerdict) {
        review.overallVerdict = review.approved ? 'approve' : 'reject';
      }
      if (review.overallVerdict === 'approve' && review.issues.some(i => i.severity === 'warning')) {
        review.overallVerdict = 'approve_with_suggestions';
      }
      
      return review;
    } catch (error) {
      console.error('Error reviewing edit proposal:', error);
      // Fallback: approve with no issues
      return {
        approved: true,
        confidence: 0.5,
        issues: [],
        suggestions: [],
        overallVerdict: 'approve'
      };
    }
  }

  // ============================================================================
  // END REVIEW AGENT MODULE
  // ============================================================================

  // IPC handler for proposing thesis edits
  ipcMain.handle('propose-thesis-edit', async (event, { apiKey, userIntention, thesisContent, thesisHTML, loadedContexts, previousRejectionCount }) => {
    try {
      // Lazy load to avoid DOM API issues
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      
      if (!apiKey) {
        return { error: 'API key not provided' };
      }
      
      if (!userIntention) {
        return { error: 'User intention not provided' };
      }
      
      if (!thesisContent) {
        return { error: 'Thesis content not provided' };
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // ============================================================================
      // PHASE 1: PARAGRAPH DETECTION AND ANALYSIS
      // ============================================================================
      console.log('Phase 1: Detecting paragraphs and extracting summaries...');
      
      // Use provided HTML if available, otherwise use thesisContent
      const htmlContent = thesisHTML || thesisContent;
      
      // Get plain text version (strip HTML tags for analysis)
      const plainText = thesisContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const thesisContentHash = computeContentHash(plainText);
      
      // Detect paragraphs - pass HTML for better detection
      let paragraphs = detectParagraphs(htmlContent, plainText);
      console.log(`✓ Detected ${paragraphs.length} paragraphs`);
      
      // If only 1 paragraph detected but content has multiple sentences, use LLM to detect paragraphs
      if (paragraphs.length === 1 && plainText.length > 200) {
        const sentenceCount = (plainText.match(/[.!?]+\s+/g) || []).length;
        if (sentenceCount > 2) {
          console.log(`⚠ Only 1 paragraph detected but ${sentenceCount} sentences found, using LLM to detect paragraph boundaries...`);
          
          try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            
            const llmPrompt = `Analyze the following text and identify where paragraph breaks should occur. Return a JSON array with the paragraph boundaries as character positions.

Text:
${plainText.substring(0, 3000)}${plainText.length > 3000 ? '...' : ''}

Return JSON format: {"paragraphs": [{"start": 0, "end": 150, "text": "first paragraph..."}, {"start": 151, "end": 300, "text": "second paragraph..."}]}

Identify natural paragraph breaks based on:
- Topic shifts
- Logical groupings of sentences
- Natural reading flow
- At least 2-3 sentences per paragraph

Return only the JSON, no other text.`;

            const result = await model.generateContent(llmPrompt);
            const response = await result.response;
            const text = response.text();
            
            // Try to parse LLM response
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.paragraphs && Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 1) {
                  console.log(`✓ LLM detected ${parsed.paragraphs.length} paragraphs`);
                  paragraphs = parsed.paragraphs.map((p, idx) => ({
                    index: idx,
                    text: p.text || plainText.substring(p.start || 0, p.end || plainText.length),
                    startPos: p.start || 0,
                    endPos: p.end || plainText.length,
                    type: 'llm-detected'
                  }));
                }
              }
            } catch (e) {
              console.warn('Failed to parse LLM paragraph detection response:', e);
            }
          } catch (error) {
            console.warn('LLM paragraph detection failed, using fallback:', error);
          }
        }
      }
      
      // Extract summaries (with caching)
      const paragraphsWithSummaries = await extractParagraphSummaries(paragraphs, apiKey, thesisContentHash);
      console.log(`✓ Extracted summaries for ${paragraphsWithSummaries.length} paragraphs`);
      
      // ============================================================================
      // PHASE 2: ITERATIVE REASONING
      // ============================================================================
      console.log('Phase 2: Running iterative reasoning...');
      const reasoningResult = await reasonAboutEdit(
        userIntention,
        plainText,
        paragraphsWithSummaries,
        loadedContexts,
        apiKey
      );
      console.log(`✓ Reasoning complete (${reasoningResult.iterations} iterations)`);
      
      // ============================================================================
      // PHASE 3 & 4: AUTOMATED PROPOSAL GENERATION AND REVIEW LOOP
      // ============================================================================
      const MAX_PROPOSAL_RETRIES = 3;
      let proposal = null;
      let review = null;
      let proposalAttempt = 0;
      let previousReviewFeedback = '';
      
      // Loop until we get an approved proposal or hit max retries
      while (proposalAttempt < MAX_PROPOSAL_RETRIES) {
        proposalAttempt++;
        console.log(`\n=== Proposal Generation Attempt ${proposalAttempt}/${MAX_PROPOSAL_RETRIES} ===`);
        
        // ============================================================================
        // PHASE 3: ENHANCED EDIT PROPOSAL GENERATION
        // ============================================================================
        console.log('Phase 3: Generating edit proposal with paragraph context...');
        
        // Define JSON schema for structured output (enhanced with paragraph context)
      const editProposalSchema = {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['edit', 'clarification', 'error'],
            description: 'Type of response'
          },
          description: {
            type: 'string',
            description: 'Human-readable explanation of the proposed changes'
          },
          reasoning: {
            type: 'string',
            description: 'Why these edits help achieve the user\'s intention'
          },
          changes: {
            type: 'array',
            description: 'Array of edit operations to apply',
            items: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['replace', 'insert', 'delete'],
                  description: 'Type of edit operation'
                },
                searchText: {
                  type: 'string',
                  description: 'Exact text to find in the thesis (for replace/delete) or location description (for insert). Must match text exactly as it appears in the thesis content.'
                },
                newText: {
                  type: 'string',
                  description: 'New text to insert or replace with. CRITICAL: For "replace" actions, this MUST be the COMPLETE, FULL text that will replace searchText - not a fragment. For "insert" actions, this MUST be a complete, grammatically correct sentence or paragraph. Cannot be a sentence fragment. Should be self-contained and make sense when read independently.'
                },
                locationContext: {
                  type: 'string',
                  description: 'Context around where this edit should be applied (e.g., "after the introduction paragraph", "in the methods section"). This helps the user understand where the edit goes.'
                },
                surroundingText: {
                  type: 'string',
                  description: 'Text that appears before and after the target location (for replace) or insertion point (for insert). Include enough context to uniquely identify the location.'
                },
                paragraphIndex: {
                  type: 'number',
                  description: 'Index of the paragraph where this edit should be applied (0-based)'
                },
                editScope: {
                  type: 'string',
                  enum: ['single_paragraph', 'multi_paragraph', 'sentence'],
                  description: 'Scope of the edit: single paragraph, multiple paragraphs, or sentence-level'
                },
                reasoning: {
                  type: 'string',
                  description: 'Reasoning for this specific change'
                }
              },
              required: ['action', 'newText']
            }
          },
          editScope: {
            type: 'string',
            enum: ['single_paragraph', 'multi_paragraph', 'sentence'],
            description: 'Overall scope of the edit proposal'
          }
        },
        required: ['type', 'changes']
      };
      
      // Use gemini-2.5-flash with structured output
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: editProposalSchema
        }
      });
      
      // Format the prompt for edit proposal with paragraph context
      const paragraphContext = paragraphsWithSummaries.slice(0, 10).map((para, idx) => {
        return `Paragraph ${idx}: "${para.summary || para.text.substring(0, 100)}..."`;
      }).join('\n');
      
      const relevantParaContext = reasoningResult.relevantParagraphs && reasoningResult.relevantParagraphs.length > 0
        ? `\nRelevant paragraphs identified: ${reasoningResult.relevantParagraphs.join(', ')}`
        : '';
      
      // Add note about previous rejection if applicable (from user rejection)
      const userRejectionNote = previousRejectionCount && previousRejectionCount > 0
        ? `\nIMPORTANT: This is attempt ${previousRejectionCount + 1} to generate a proposal for this request. The previous proposal(s) were rejected by the user. Please try a DIFFERENT approach - consider different locations, different writing style, different content focus, or breaking the edit into smaller parts.\n`
        : '';

      // Add note about review agent rejection if applicable (from automated review)
      const reviewRejectionNote = previousReviewFeedback
        ? `\n\n═══════════════════════════════════════════════════════════════
CRITICAL: Previous Proposal Rejected (Attempt ${proposalAttempt}/${MAX_PROPOSAL_RETRIES})

The review agent REJECTED the previous proposal. You MUST address ALL issues below and incorporate ALL suggestions into your new proposal.

${previousReviewFeedback}

REQUIREMENTS FOR NEW PROPOSAL:
1. Fix ALL blocker issues identified above
2. Address ALL warning issues (especially if 2+ warnings)
3. Incorporate ALL suggestions from the review agent
4. Ensure confidence level will be >= 0.8
5. Take a different approach if previous approach was fundamentally flawed
6. Ensure the edit maintains document flow, coherence, and quality
7. Write complete, grammatically correct sentences (no fragments)

Do not just acknowledge the issues - actually fix them in your proposal.
═══════════════════════════════════════════════════════════════\n`
        : '';

      let fullPrompt = `You are a thesis editing assistant. The user wants to make the following change to their thesis:

User Request: ${userIntention}${userRejectionNote}${reviewRejectionNote}

Reasoning from analysis:
${reasoningResult.reasoning || 'No specific reasoning provided'}

Thesis Structure (${paragraphsWithSummaries.length} paragraphs):
${paragraphContext}${relevantParaContext}

Current Thesis Content (full text):
${plainText.substring(0, 5000)}${plainText.length > 5000 ? '...' : ''}

`;
      
      if (loadedContexts && loadedContexts.length > 0) {
        fullPrompt += `Loaded Research Context:\n`;
        loadedContexts.forEach((ctx, idx) => {
          fullPrompt += `Paper ${idx + 1}: "${ctx.title}" (${ctx.numPages || 'N/A'} pages)\n`;
          // Include full context - truncate if too long for now
          const contextText = ctx.text ? ctx.text.substring(0, 2000) : '';
          fullPrompt += `Content: ${contextText}\n\n`;
        });
        fullPrompt += `\n`;
        fullPrompt += `IMPORTANT: When referencing these loaded papers in your edits, use the format "Paper1", "Paper2", etc. (where the number corresponds to the order listed above). The system will automatically convert these to proper citations.\n\n`;
      }
      
      fullPrompt += `Based on the user's request and the current thesis content, propose specific edits.

IMPORTANT: You should ALWAYS propose edits (type="edit") rather than asking for clarification (type="clarification"). 
Even if the request seems ambiguous, make reasonable assumptions based on:
- The context of the loaded papers
- The structure and content of the thesis
- Common academic writing practices
- The paragraph summaries and reasoning provided

For example:
- "Add supporting materials" → Add relevant findings, key points, or explanations from the referenced papers
- "Improve this section" → Enhance clarity, add details, or strengthen arguments
- "Add information about X" → Insert relevant content about X in an appropriate location

Proceed with proposing concrete edits rather than asking for more details.

CRITICAL REQUIREMENTS FOR EACH CHANGE:
1. For "replace" actions: 
   - searchText MUST exactly match text that exists in the thesis content (including punctuation and whitespace)
   - CRITICAL: newText MUST be the COMPLETE, FULL text that will replace searchText. It cannot be a fragment or incomplete sentence.
   - newText must be a complete, grammatically correct sentence or paragraph that makes sense on its own
   - If searchText is an incomplete sentence, newText must be the COMPLETE version of that sentence
   - If searchText is part of a sentence, newText must be the COMPLETE sentence or paragraph that will replace it
   - Include surroundingText showing text before and after the searchText (at least 50 characters before and after)
   - Include locationContext describing where in the thesis this appears (e.g., "in the introduction paragraph", "in the methods section")
   - EXAMPLE: If searchText is "A further limitation, as highlighted by work such as", newText must be the COMPLETE sentence like "A further limitation, as highlighted by work such as [Paper1], is that VLMs struggle with complex reasoning tasks."
   
2. For "insert" actions:
   - CRITICAL: newText MUST be a complete, grammatically correct sentence or paragraph. It cannot be a sentence fragment.
   - newText should be self-contained and make sense when read independently
   - If inserting into the middle of a sentence, newText should be a complete sentence that can replace or be integrated with the existing text
   - Provide clear locationContext describing where to insert (e.g., "after the introduction paragraph", "at the beginning of the results section")
   - Include surroundingText showing the text that will appear before and after the insertion point (at least 50 characters before and after)
   - searchText can be empty or describe the insertion location

3. IMPORTANT: Always include both locationContext and surroundingText for every change so the user can see WHERE the edit will be applied in the thesis.

4. Break complex edits into multiple smaller changes if needed.

5. Ensure searchText includes enough unique context to reliably find the location (at least 20-30 characters, preferably a full sentence).

6. The surroundingText should help the user identify exactly where in their thesis the edit will be applied.

7. NEW: Include paragraphIndex for each change to indicate which paragraph it affects (use paragraph index from the structure above).

8. NEW: Include editScope to indicate if this is a single-paragraph edit, multi-paragraph edit, or sentence-level edit.

9. NEW: Include reasoning for each change explaining why it's needed.

Return a JSON object following the schema with type="edit", a clear description, changes array with paragraphIndex, editScope, locationContext, surroundingText, and reasoning for each change.`;
      
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON from response - with enhanced parser
      try {
        proposal = parseEditProposalJSON(text);
        
        // Validate proposal structure
        if (!proposal) {
          return { error: 'Failed to parse proposal: returned null or undefined' };
        }
        
        if (proposal.type === 'clarification') {
          // Instead of failing, try to generate a proposal anyway with the clarification as context
          console.warn('LLM requested clarification, but proceeding with reasonable assumptions...');
          // Convert clarification to a warning but still try to proceed
          // The reasoning phase should have gathered enough context to make reasonable edits
          // We'll treat this as an edit proposal with a note about assumptions made
          if (!proposal.changes || proposal.changes.length === 0) {
            // If no changes were proposed, we need to ask for clarification
            return { 
              error: `Need clarification: ${proposal.description || 'Please provide more details about your edit request.'}\n\nTip: Be more specific about what you want to add, where you want it, or what you want to change.` 
            };
          }
          // If changes were proposed despite clarification request, use them but add a note
          proposal.description = `Note: ${proposal.description || 'Some assumptions were made'}\n\n${proposal.description || ''}`;
          proposal.type = 'edit'; // Convert to edit type
        }
        
        if (proposal.type === 'error') {
          return { error: proposal.description || 'LLM returned an error response' };
        }
        
        if (!proposal.changes || !Array.isArray(proposal.changes)) {
          return { error: 'Invalid proposal format: missing changes array' };
        }
        
        if (proposal.changes.length === 0) {
          return { error: 'Invalid proposal format: changes array is empty' };
        }
        
        // Validate each change
        const validatedChanges = [];
        for (const change of proposal.changes) {
          if (!change.action || !change.newText) {
            console.warn('Skipping invalid change:', change);
            continue;
          }
          
          // If replace action, ensure searchText is provided
          if (change.action === 'replace' && !change.searchText) {
            console.warn('Replace action missing searchText, skipping:', change);
            continue;
          }
          
          validatedChanges.push(change);
        }
        
        if (validatedChanges.length === 0) {
          return { error: 'All changes in proposal were invalid' };
        }
        
        proposal.changes = validatedChanges;
        
        // Validate that insert and replace actions have complete sentences (not fragments)
        for (const change of proposal.changes) {
          if ((change.action === 'insert' || change.action === 'replace') && change.newText) {
            const text = change.newText.trim();
            const searchText = change.searchText ? change.searchText.trim() : '';
            
            // Check if it's a sentence fragment
            const startsWithLowercase = /^[a-z]/.test(text);
            const endsWithPunctuation = /[.!?]$/.test(text);
            const isVeryShort = text.length < 20;
            
            // For replace actions, check if newText is incomplete compared to searchText
            // If searchText appears to be an incomplete sentence, newText should complete it
            const searchTextEndsWithPunctuation = searchText && /[.!?]$/.test(searchText);
            const searchTextIsIncomplete = searchText && !searchTextEndsWithPunctuation && searchText.length > 10;
            
            // If it looks like a fragment or incomplete replacement
            if (startsWithLowercase || (!endsWithPunctuation && !isVeryShort) || (change.action === 'replace' && searchTextIsIncomplete && !endsWithPunctuation)) {
              const actionType = change.action === 'replace' ? 'replacement' : 'insertion';
              console.warn(`⚠ Detected potential incomplete text in ${actionType} action.`);
              console.warn(`  SearchText: "${searchText.substring(0, 100)}${searchText.length > 100 ? '...' : ''}"`);
              console.warn(`  NewText: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
              
              // Add a note to the reasoning to help the LLM fix it in next iteration
              if (!previousReviewFeedback) {
                previousReviewFeedback = '';
              }
              
              if (change.action === 'replace') {
                previousReviewFeedback += `CRITICAL: The previous proposal had an INCOMPLETE replacement text.\n`;
                previousReviewFeedback += `- SearchText: "${searchText.substring(0, 150)}${searchText.length > 150 ? '...' : ''}"\n`;
                previousReviewFeedback += `- NewText provided: "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"\n`;
                previousReviewFeedback += `- Problem: newText must be the COMPLETE, FULL text that will replace searchText. If searchText is an incomplete sentence, newText must be the complete version.\n`;
                previousReviewFeedback += `- Fix: Provide the full, complete sentence or paragraph in newText that will replace the searchText.\n\n`;
              } else {
                previousReviewFeedback += `IMPORTANT: The previous proposal contained a sentence fragment for insertion. Ensure all insertions are complete, grammatically correct sentences that end with proper punctuation.\n`;
              }
            }
          }
        }
        
        // Add reasoning from iterative phase to proposal
        if (reasoningResult.reasoning) {
          proposal.reasoning = `${reasoningResult.reasoning}\n\n${proposal.reasoning || ''}`.trim();
        }
        
        // ============================================================================
        // PHASE 4: REVIEW AGENT
        // ============================================================================
        console.log('Phase 4: Reviewing edit proposal...');
        review = await reviewEditProposal(proposal, plainText, paragraphsWithSummaries, apiKey);
        console.log(`✓ Review complete: ${review.overallVerdict} (${review.issues.length} issues)`);
        
        // Attach review to proposal
        proposal.review = review;
        
        // Check if review approves the proposal
        const hasBlockers = review.issues && review.issues.some(issue => issue.severity === 'blocker');
        const isRejected = review.overallVerdict === 'reject' || !review.approved || hasBlockers;
        
        if (!isRejected) {
          // Proposal approved! Break out of loop
          console.log(`✓ Proposal approved by review agent after ${proposalAttempt} attempt(s)`);
          break;
        } else {
          // Proposal rejected - prepare feedback for next iteration
          console.log(`⚠ Proposal rejected by review agent (attempt ${proposalAttempt}/${MAX_PROPOSAL_RETRIES})`);
          
          const blockerIssues = review.issues.filter(i => i.severity === 'blocker');
          const warningIssues = review.issues.filter(i => i.severity === 'warning');
          const nitIssues = review.issues.filter(i => i.severity === 'nit');
          
          // Build comprehensive feedback incorporating ALL suggestions
          previousReviewFeedback = '';
          
          // Add rejection reason summary
          const rejectionReasons = [];
          if (hasBlockers) rejectionReasons.push('blocker issues');
          if (hasWarnings && warningIssues.length >= 2) rejectionReasons.push(`${warningIssues.length} warning issues`);
          if (hasMultipleIssues) rejectionReasons.push(`${review.issues.length} total issues`);
          if (lowConfidence) rejectionReasons.push(`low confidence (${review.confidence})`);
          
          previousReviewFeedback += `REJECTION REASON: ${rejectionReasons.join(', ')}\n\n`;
          
          // Include ALL issues with their suggestions
          if (blockerIssues.length > 0) {
            previousReviewFeedback += `BLOCKER ISSUES (must fix):\n${blockerIssues.map(i => {
              let issueText = `- ${i.type}: ${i.description}`;
              if (i.suggestion) {
                issueText += `\n  → FIX: ${i.suggestion}`;
              }
              return issueText;
            }).join('\n')}\n\n`;
          }
          
          if (warningIssues.length > 0) {
            previousReviewFeedback += `WARNING ISSUES (should fix):\n${warningIssues.map(i => {
              let issueText = `- ${i.type}: ${i.description}`;
              if (i.suggestion) {
                issueText += `\n  → FIX: ${i.suggestion}`;
              }
              return issueText;
            }).join('\n')}\n\n`;
          }
          
          // Include nits if there are many issues
          if (nitIssues.length > 0 && review.issues.length > 2) {
            previousReviewFeedback += `MINOR ISSUES:\n${nitIssues.map(i => {
              let issueText = `- ${i.type}: ${i.description}`;
              if (i.suggestion) {
                issueText += `\n  → SUGGESTION: ${i.suggestion}`;
              }
              return issueText;
            }).join('\n')}\n\n`;
          }
          
          // Incorporate ALL suggestions from review
          if (review.suggestions && review.suggestions.length > 0) {
            previousReviewFeedback += `REVIEW SUGGESTIONS (incorporate these):\n${review.suggestions.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}\n\n`;
          }
          
          // Special handling for sentence fragment and incomplete text issues
          const fragmentIssues = review.issues.filter(i => 
            i.description && (
              i.description.toLowerCase().includes('sentence fragment') ||
              i.description.toLowerCase().includes('incomplete sentence') ||
              i.description.toLowerCase().includes('grammatically complete') ||
              i.description.toLowerCase().includes('incomplete text') ||
              i.description.toLowerCase().includes('does not provide the full') ||
              i.description.toLowerCase().includes('does not provide the complete')
            )
          );
          if (fragmentIssues.length > 0) {
            previousReviewFeedback = `CRITICAL: Incomplete Text Issue\n\nThe previous proposal contained incomplete text (fragments or incomplete replacements).\n\nFOR REPLACE ACTIONS:\n- newText MUST be the COMPLETE, FULL text that will replace searchText\n- If searchText is an incomplete sentence, newText must be the complete version\n- newText must be a complete, grammatically correct sentence or paragraph\n- Example: If searchText is "A further limitation, as highlighted by", newText must be "A further limitation, as highlighted by [Paper1], is that VLMs struggle with complex reasoning tasks."\n\nFOR INSERT ACTIONS:\n- newText MUST be a complete, grammatically correct sentence or paragraph\n- End with proper punctuation (. ! ?)\n- Make sense when read independently\n- Be self-contained and coherent\n\n${previousReviewFeedback}`;
          }
          
          // Add instruction to incorporate suggestions
          if (review.suggestions && review.suggestions.length > 0) {
            previousReviewFeedback += `\nIMPORTANT: You MUST incorporate the suggestions above into your new proposal. Do not just acknowledge them - actually apply them to improve the edit.`;
          }
          
          // If we've hit max retries, break and return the last proposal anyway
          if (proposalAttempt >= MAX_PROPOSAL_RETRIES) {
            console.log(`⚠ Maximum retry limit reached. Returning proposal despite review rejection.`);
            break;
          }
          
          // Continue to next iteration
          console.log(`🔄 Regenerating proposal with review feedback...`);
          continue;
        }
      } catch (parseError) {
        console.error('Error parsing edit proposal in attempt', proposalAttempt, ':', parseError);
        console.error('Raw response:', text);
        
        // If this is not the last attempt, continue to next iteration
        if (proposalAttempt < MAX_PROPOSAL_RETRIES) {
          previousReviewFeedback = `Previous attempt failed to parse proposal. Please ensure valid JSON format.`;
          continue;
        }
        
        // Last attempt failed - return error
        return { error: `Failed to parse proposal after ${MAX_PROPOSAL_RETRIES} attempts: ${parseError.message}`, rawResponse: text };
      }
    } // End of while loop
    
    // After loop: proposal and review are set (either approved or max retries reached)
    // If we exited the loop without a proposal, return error
    if (!proposal) {
      return { error: 'Failed to generate a valid proposal after maximum retries' };
    }
    
    // Parse paper citations (Paper1, Paper2, etc.) and extract paper information
    const papersToAdd = new Map(); // Map of paper index -> paper info
    // More flexible pattern: matches "Paper1", "Paper 1", "(Paper1)", "[Paper1]", etc.
    const citationPattern = /(?:\(|\[)?Paper\s*(\d+)(?:\)|\])?/gi;
    
    // Helper function to extract papers from text
    const extractPapersFromText = (text) => {
      if (!text) return;
      let match;
      while ((match = citationPattern.exec(text)) !== null) {
        const paperIndex = parseInt(match[1]) - 1; // Convert to 0-based index
        if (loadedContexts && paperIndex >= 0 && paperIndex < loadedContexts.length) {
          const ctx = loadedContexts[paperIndex];
          if (ctx.paper && !papersToAdd.has(paperIndex)) {
            // Extract paper information
            const paper = ctx.paper;
            papersToAdd.set(paperIndex, {
              title: paper.title || ctx.title || 'Untitled',
              authors: Array.isArray(paper.authors) ? paper.authors.join(', ') : (paper.authors || ''),
              year: paper.year || '',
              venue: paper.venue || '',
              presentation: paper.presentation || '', // Oral, Spotlight, Poster, etc.
              url: paper.forum ? `https://openreview.net/forum?id=${paper.forum}` : (paper.url || ''),
              notes: paper.abstract ? (typeof paper.abstract === 'string' ? paper.abstract : (paper.abstract.value || '')) : '',
              paperIndex: paperIndex + 1 // Keep 1-based for display
            });
          }
        }
      }
      // Reset regex lastIndex after each text processing
      citationPattern.lastIndex = 0;
    };
    
    // Find all paper citations in the proposal (check all relevant fields)
    proposal.changes.forEach(change => {
      extractPapersFromText(change.newText);
      extractPapersFromText(change.searchText);
      extractPapersFromText(change.surroundingText);
    });
    
    // Also check description and reasoning fields
    if (proposal.description) {
      extractPapersFromText(proposal.description);
    }
    if (proposal.reasoning) {
      extractPapersFromText(proposal.reasoning);
    }
    
    // Convert map to array - we'll format these with LLM next
    const papersToFormat = Array.from(papersToAdd.values());
    
    console.log('Successfully parsed and validated proposal:', JSON.stringify(proposal, null, 2));
    
    // Format papers using LLM to get structured citation format
    let referencesToCreate = [];
    if (papersToFormat.length > 0 && apiKey) {
      console.log(`Formatting ${papersToFormat.length} papers with LLM for citation structure...`);
      try {
        referencesToCreate = await formatPapersForCitation(genAI, papersToFormat);
        console.log(`Successfully formatted ${referencesToCreate.length} papers for citation`);
      } catch (error) {
        console.error('Error formatting papers with LLM, using direct extraction:', error);
        // Fallback to direct extraction if LLM fails
        referencesToCreate = papersToFormat.map(p => ({
          title: p.title,
          authors: p.authors,
          year: p.year,
          venue: p.venue,
          presentation: p.presentation || '',
          url: p.url,
          notes: p.notes,
          paperIndex: p.paperIndex
        }));
      }
    } else {
      referencesToCreate = papersToFormat;
    }
    
    if (referencesToCreate.length > 0) {
      console.log(`Found ${referencesToCreate.length} papers to add to reference bank:`, referencesToCreate.map(r => r.title));
    }
    
    return { 
      success: true, 
      proposal,
      referencesToCreate: referencesToCreate // Papers that need to be added to reference bank
    };
    
    } catch (error) {
      console.error('Error proposing thesis edit:', error);
      return { error: error.message || 'Failed to propose thesis edit' };
    }
  });

  // IPC handler for opening image file dialog - register after window is created
  ipcMain.handle('select-image', async () => {
    const window = BrowserWindow.getFocusedWindow() || mainWindow;
    
    const result = await dialog.showOpenDialog(window || BrowserWindow.getAllWindows()[0], {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    };

    try {
      const data = fs.readFileSync(filePath);
      const base64 = data.toString('base64');
      const mimeType = mimeTypes[ext] || 'image/png';
      return {
        dataUrl: `data:${mimeType};base64,${base64}`,
        fileName: path.basename(filePath)
      };
    } catch (error) {
      console.error('Error reading image file:', error);
      return null;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

