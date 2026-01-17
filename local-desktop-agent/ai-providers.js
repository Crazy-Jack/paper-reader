const https = require('https');
const { RecursiveCharacterTextSplitter } = require('./text-splitter');

// Simple token approximation (roughly 4 characters per token for English text)
function approximateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Trim prompt to maximum context size
function trimPrompt(prompt, contextSize = 128000) {
  if (!prompt) {
    return '';
  }

  const length = approximateTokens(prompt);
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // On average it's 4 characters per token, so multiply by 4 to get a rough estimate
  const chunkSize = prompt.length - overflowTokens * 4;
  const minChunkSize = 140;
  if (chunkSize < minChunkSize) {
    return prompt.slice(0, minChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] || '';

  // Last catch, there's a chance that the trimmed prompt is same length as the original prompt
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // Recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
}

// Make HTTP request to OpenAI-compatible API
function makeAPIRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = https.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        reject(new Error('Network error: Could not connect to the API server. Please check your internet connection.'));
      } else if (error.code === 'ETIMEDOUT') {
        reject(new Error('Connection timeout. Please try again.'));
      } else {
        reject(new Error(`Network error: ${error.message}`));
      }
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout. The API may be slow or unresponsive.'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Generate structured object using OpenAI-compatible API
async function generateObject({ model, system, prompt, schema }) {
  const apiKey = model.apiKey;
  const baseURL = model.baseURL || 'https://api.openai.com/v1';
  const modelName = model.modelName;
  const endpoint = `${baseURL}/chat/completions`;

  // Convert schema to function calling format (simplified)
  const tools = [{
    type: 'function',
    function: {
      name: 'extract_data',
      description: 'Extract structured data',
      parameters: {
        type: 'object',
        properties: schema.properties || {},
        required: schema.required || [],
      },
    },
  }];

  const messages = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: prompt });

  const requestData = {
    model: modelName,
    messages,
    tools,
    tool_choice: { type: 'function', function: { name: 'extract_data' } },
    temperature: 0.7,
  };

  try {
    const response = await makeAPIRequest(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }, requestData);

      // Handle rate limiting
      if (response.error) {
        if (response.error.code === 'rate_limit_exceeded' || response.error.type === 'insufficient_quota') {
          throw new Error('Rate limit exceeded. Please wait a moment and try again, or check your API quota.');
        }
        throw new Error(response.error.message || 'API error: ' + JSON.stringify(response.error));
      }

      // Extract the function call result
      if (response.choices && response.choices[0] && response.choices[0].message) {
        const message = response.choices[0].message;
        
        // Check for tool calls (function calling)
        if (message.tool_calls && message.tool_calls[0]) {
          const toolCall = message.tool_calls[0];
          if (toolCall.function && toolCall.function.arguments) {
            try {
              return {
                object: JSON.parse(toolCall.function.arguments),
              };
            } catch (e) {
              throw new Error('Failed to parse API response: ' + e.message);
            }
          }
        }
        
        // Fallback: try to extract content directly
        if (message.content) {
          try {
            return {
              object: JSON.parse(message.content),
            };
          } catch (e) {
            // If content is not JSON, return as string
            return {
              object: { content: message.content },
            };
          }
        }
      }

      throw new Error('Unexpected response format from API. Please check your API configuration.');
    } catch (error) {
      if (abortSignal && abortSignal.aborted) {
        throw new Error('Request aborted');
      }
      // Re-throw with better context if it's not already a formatted error
      if (error.message && !error.message.includes('Network error') && !error.message.includes('Rate limit')) {
      throw new Error(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  // Note: abortSignal parameter removed as we use request timeout instead

// Get model configuration based on available API keys
function getModel(apiKeys) {
  const { openaiKey, fireworksKey, openaiEndpoint, customModel } = apiKeys;

  // Prefer custom model if specified
  if (customModel && openaiKey) {
    return {
      apiKey: openaiKey,
      baseURL: openaiEndpoint || 'https://api.openai.com/v1',
      modelName: customModel,
    };
  }

  // Prefer DeepSeek R1 via Fireworks if available
  if (fireworksKey) {
    return {
      apiKey: fireworksKey,
      baseURL: 'https://api.fireworks.ai/inference/v1',
      modelName: 'accounts/fireworks/models/deepseek-r1',
    };
  }

  // Fall back to o3-mini via OpenAI
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseURL: openaiEndpoint || 'https://api.openai.com/v1',
      modelName: 'o3-mini',
    };
  }

  throw new Error('No API key available. Please configure OpenAI or Fireworks API key in Settings.');
}

module.exports = {
  getModel,
  generateObject,
  trimPrompt,
};
