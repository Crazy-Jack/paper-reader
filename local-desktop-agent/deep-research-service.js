const https = require('https');
const { getModel, generateObject, trimPrompt } = require('./ai-providers');
const { systemPrompt } = require('./prompt');

function log(...args) {
  console.log(...args);
}

// Simple concurrency limiter
function createConcurrencyLimit(limit) {
  let running = 0;
  const queue = [];

  const run = async (fn) => {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          running--;
          if (queue.length > 0) {
            queue.shift()();
          }
        }
      };

      if (running < limit) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };

  return run;
}

// Make HTTP request
function makeRequest(url, options, data) {
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
            resolve(body); // Return as string if not JSON
          }
        } else {
          // Handle specific error codes
          let errorMessage = `Request failed with status ${res.statusCode}`;
          if (res.statusCode === 401) {
            errorMessage = 'Authentication failed. Please check your API key.';
          } else if (res.statusCode === 429) {
            errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          } else if (res.statusCode === 500 || res.statusCode === 502 || res.statusCode === 503) {
            errorMessage = 'Server error. Please try again later.';
          } else if (body) {
            try {
              const errorBody = JSON.parse(body);
              if (errorBody.error && errorBody.error.message) {
                errorMessage = errorBody.error.message;
              } else if (errorBody.message) {
                errorMessage = errorBody.message;
              }
            } catch (e) {
              // Use default error message
            }
          }
          reject(new Error(errorMessage));
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

    const timeout = options.timeout || 30000;
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms. The server may be slow or unresponsive.`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Firecrawl search
async function firecrawlSearch(query, apiKey, baseUrl, options = {}) {
  const url = baseUrl 
    ? `${baseUrl}/v1/search`
    : 'https://api.firecrawl.dev/v1/search';
  
  const requestData = {
    query,
    limit: options.limit || 5,
    scrapeOptions: options.scrapeOptions || { formats: ['markdown'] },
  };

  try {
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: options.timeout || 15000,
    }, requestData);

    return {
      data: response.data || [],
    };
  } catch (error) {
    throw new Error(`Firecrawl search failed: ${error.message}`);
  }
}

// Generate SERP queries
async function generateSerpQueries({
  query,
  numQueries = 3,
  learnings = [],
  apiKeys,
}) {
  const model = getModel(apiKeys);
  const learningsText = learnings.length > 0
    ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join('\n')}`
    : '';

  const prompt = `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${learningsText}`;

  const schema = {
    type: 'object',
    properties: {
      queries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The SERP query' },
            researchGoal: {
              type: 'string',
              description: 'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
            },
          },
          required: ['query', 'researchGoal'],
        },
      },
    },
    required: ['queries'],
  };

  const res = await generateObject({
    model,
    system: systemPrompt(),
    prompt,
    schema,
  });

  log(`Created ${res.object.queries.length} queries`, res.object.queries);
  return res.object.queries.slice(0, numQueries);
}

// Process SERP result
async function processSerpResult({
  query,
  result,
  numLearnings = 3,
  numFollowUpQuestions = 3,
  apiKeys,
}) {
  const contents = (result.data || [])
    .map(item => item.markdown)
    .filter(Boolean)
    .map(content => trimPrompt(content, 25000));

  log(`Ran ${query}, found ${contents.length} contents`);

  const contentsText = contents
    .map(content => `<content>\n${content}\n</content>`)
    .join('\n');

  const prompt = trimPrompt(
    `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contentsText}</contents>`
  );

  const schema = {
    type: 'object',
    properties: {
      learnings: {
        type: 'array',
        items: { type: 'string' },
        description: `List of learnings, max of ${numLearnings}`,
      },
      followUpQuestions: {
        type: 'array',
        items: { type: 'string' },
        description: `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
      },
    },
    required: ['learnings', 'followUpQuestions'],
  };

  const model = getModel(apiKeys);
  const res = await generateObject({
    model,
    system: systemPrompt(),
    prompt,
    schema,
  });

  log(`Created ${res.object.learnings.length} learnings`, res.object.learnings);
  return res.object;
}

// Write final report
async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
  apiKeys,
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const fullPrompt = trimPrompt(
    `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 3 or more pages, include ALL the learnings from research:\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`
  );

  const schema = {
    type: 'object',
    properties: {
      reportMarkdown: {
        type: 'string',
        description: 'Final report on the topic in Markdown',
      },
    },
    required: ['reportMarkdown'],
  };

  const model = getModel(apiKeys);
  const res = await generateObject({
    model,
    system: systemPrompt(),
    prompt: fullPrompt,
    schema,
  });

  const urlsSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`;
  return res.object.reportMarkdown + urlsSection;
}

// Write final answer
async function writeFinalAnswer({
  prompt,
  learnings,
  apiKeys,
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const fullPrompt = trimPrompt(
    `Given the following prompt from the user, write a final answer on the topic using the learnings from research. Follow the format specified in the prompt. Do not yap or babble or include any other text than the answer besides the format specified in the prompt. Keep the answer as concise as possible - usually it should be just a few words or maximum a sentence. Try to follow the format specified in the prompt (for example, if the prompt is using Latex, the answer should be in Latex. If the prompt gives multiple answer choices, the answer should be one of the choices).\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from research on the topic that you can use to help answer the prompt:\n\n<learnings>\n${learningsString}\n</learnings>`
  );

  const schema = {
    type: 'object',
    properties: {
      exactAnswer: {
        type: 'string',
        description: 'The final answer, make it short and concise, just the answer, no other text',
      },
    },
    required: ['exactAnswer'],
  };

  const model = getModel(apiKeys);
  const res = await generateObject({
    model,
    system: systemPrompt(),
    prompt: fullPrompt,
    schema,
  });

  return res.object.exactAnswer;
}

// Main deep research function
async function deepResearch({
  query,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
  onProgress,
  apiKeys,
  firecrawlApiKey,
  firecrawlBaseUrl,
  concurrencyLimit = 2,
}) {
  const progress = {
    currentDepth: depth,
    totalDepth: depth,
    currentBreadth: breadth,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
  };

  const reportProgress = (update) => {
    Object.assign(progress, update);
    if (onProgress) {
      onProgress(progress);
    }
  };

  const serpQueries = await generateSerpQueries({
    query,
    learnings,
    numQueries: breadth,
    apiKeys,
  });

  reportProgress({
    totalQueries: serpQueries.length,
    currentQuery: serpQueries[0]?.query,
  });

  const limit = createConcurrencyLimit(concurrencyLimit);

  const results = await Promise.all(
    serpQueries.map(serpQuery =>
      limit(async () => {
        try {
          const result = await firecrawlSearch(serpQuery.query, firecrawlApiKey, firecrawlBaseUrl, {
            timeout: 15000,
            limit: 5,
            scrapeOptions: { formats: ['markdown'] },
          });

          // Collect URLs from this search
          const newUrls = (result.data || [])
            .map(item => item.url)
            .filter(Boolean);
          const newBreadth = Math.ceil(breadth / 2);
          const newDepth = depth - 1;

          const newLearnings = await processSerpResult({
            query: serpQuery.query,
            result,
            numFollowUpQuestions: newBreadth,
            apiKeys,
          });
          const allLearnings = [...learnings, ...newLearnings.learnings];
          const allUrls = [...visitedUrls, ...newUrls];

          if (newDepth > 0) {
            log(`Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`);

            reportProgress({
              currentDepth: newDepth,
              currentBreadth: newBreadth,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });

            const nextQuery = `
            Previous research goal: ${serpQuery.researchGoal}
            Follow-up research directions: ${newLearnings.followUpQuestions.map(q => `\n${q}`).join('')}
          `.trim();

            return deepResearch({
              query: nextQuery,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allLearnings,
              visitedUrls: allUrls,
              onProgress,
              apiKeys,
              firecrawlApiKey,
              firecrawlBaseUrl,
              concurrencyLimit,
            });
          } else {
            reportProgress({
              currentDepth: 0,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });
            return {
              learnings: allLearnings,
              visitedUrls: allUrls,
            };
          }
        } catch (e) {
          let errorMsg = e.message || 'Unknown error';
          if (errorMsg.includes('Timeout') || errorMsg.includes('timeout')) {
            log(`Timeout error running query: ${serpQuery.query}: `, e);
          } else if (errorMsg.includes('Rate limit') || errorMsg.includes('rate_limit')) {
            log(`Rate limit error running query: ${serpQuery.query}: `, e);
            // Don't silently fail on rate limits - propagate the error
            throw new Error(`Rate limit exceeded while processing query "${serpQuery.query}". Please wait and try again.`);
          } else if (errorMsg.includes('Authentication') || errorMsg.includes('401')) {
            log(`Authentication error running query: ${serpQuery.query}: `, e);
            throw new Error('Authentication failed. Please check your API keys in Settings.');
          } else {
            log(`Error running query: ${serpQuery.query}: `, e);
          }
          // For non-critical errors, return empty results to continue with other queries
          return {
            learnings: [],
            visitedUrls: [],
          };
        }
      })
    )
  );

  // Deduplicate learnings and URLs
  const uniqueLearnings = [...new Set(results.flatMap(r => r.learnings))];
  const uniqueUrls = [...new Set(results.flatMap(r => r.visitedUrls))];

  return {
    learnings: uniqueLearnings,
    visitedUrls: uniqueUrls,
  };
}

module.exports = {
  deepResearch,
  writeFinalReport,
  writeFinalAnswer,
};
