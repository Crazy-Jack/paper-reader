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

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

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

