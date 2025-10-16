// Selection Text Optimizer Server
// Comprehensive autonomous processing system for browser text selections

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Performance metrics storage
const metrics = {
  totalRequests: 0,
  successfulProcessing: 0,
  failedProcessing: 0,
  avgProcessingTime: 0,
  processingTimes: [],
  topDomains: new Map(),
  textStats: {
    totalCharacters: 0,
    totalWords: 0,
    avgLength: 0,
    minLength: Infinity,
    maxLength: 0
  },
  classifications: new Map(),
  startTime: new Date().toISOString()
};

// Main selection processing endpoint
app.post('/api/ingest/selection', async (req, res) => {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  try {
    metrics.totalRequests++;
    
    const {
      text,
      selectedHtml,
      url,
      title,
      domain,
      wordCount,
      characterCount,
      context,
      optimization
    } = req.body || {};

    // Validate input
    if (!text || !text.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'No selection text provided',
        requestId
      });
    }

    console.log(`🔍 Processing selection [${requestId}]:`, {
      textLength: text.length,
      wordCount: wordCount || text.split(/\s+/).length,
      domain: domain || 'unknown',
      url: url?.substring(0, 50) + '...'
    });

    // Process the selection
    const result = await processSelection({
      requestId,
      text,
      selectedHtml,
      url,
      title,
      domain,
      wordCount,
      characterCount,
      context
    });

    // Update metrics
    const processingTime = Date.now() - startTime;
    updateMetrics(text, domain, processingTime, true);

    console.log(`✅ Selection processed successfully [${requestId}]:`, {
      processingTime: `${processingTime}ms`,
      optimizations: result.optimizations?.length || 0,
      recommendations: result.recommendations?.length || 0
    });

    res.json({
      ok: true,
      requestId,
      result,
      processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    updateMetrics('', '', processingTime, false);
    
    console.error(`❌ Selection processing failed [${requestId}]:`, error.message);

    res.status(500).json({
      ok: false,
      error: 'Processing failed',
      requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Main selection processing function
async function processSelection(data) {
  const { requestId, text, selectedHtml, url, title, domain, context } = data;
  
  const result = {
    requestId,
    originalText: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
    processedAt: new Date().toISOString(),
    optimizations: [],
    analysis: {},
    recommendations: [],
    metadata: {
      source: 'browser-extension',
      url,
      domain,
      title: title?.substring(0, 100)
    }
  };

  try {
    // 1. Text cleaning and normalization
    const cleanedText = cleanText(text);
    if (cleanedText !== text) {
      result.optimizations.push({
        type: 'text-cleaning',
        description: 'Normalized whitespace and removed unwanted characters',
        improvement: `${text.length - cleanedText.length} characters optimized`
      });
    }

    // 2. Content classification
    const classification = classifyContent(cleanedText, context);
    result.analysis.classification = classification;
    
    // Update classification metrics
    const classCount = metrics.classifications.get(classification.type) || 0;
    metrics.classifications.set(classification.type, classCount + 1);

    // 3. Text analysis
    const textAnalysis = analyzeText(cleanedText);
    result.analysis.text = textAnalysis;

    // 4. Context analysis
    if (context) {
      const contextAnalysis = analyzeContext(context, cleanedText);
      result.analysis.context = contextAnalysis;
    }

    // 5. Generate recommendations
    const recommendations = generateRecommendations(cleanedText, classification, context, domain);
    result.recommendations = recommendations;

    // 6. Identify optimization opportunities
    const opportunities = identifyOptimizations(cleanedText, classification, domain, url);
    result.optimizations.push(...opportunities);

    // 7. Calculate metrics
    result.metrics = calculateTextMetrics(text, cleanedText);

    // 8. Integration suggestions
    result.integrations = suggestIntegrations(cleanedText, classification, domain);

    return result;

  } catch (error) {
    console.error(`Processing error for ${requestId}:`, error.message);
    result.error = error.message;
    result.partial = true;
    return result;
  }
}

// Helper functions
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Remove zero-width characters
    .replace(/[^\S ]/g, ' ')  // Replace non-space whitespace
    .trim();
}

function classifyContent(text, context) {
  const classification = {
    type: 'general',
    confidence: 0.5,
    indicators: []
  };

  // Pattern-based classification
  const patterns = {
    code: {
      regex: /(?:function|class|import|export|const|let|var|if|for|while|return)\s*[({]/i,
      confidence: 0.9
    },
    technical: {
      regex: /(?:API|HTTP|JSON|XML|CSS|HTML|JavaScript|Python|SQL|database)/i,
      confidence: 0.8
    },
    documentation: {
      regex: /(?:readme|docs|documentation|guide|tutorial|installation|setup)/i,
      confidence: 0.7
    },
    article: {
      regex: /[.!?]\s+[A-Z][a-z]/,
      confidence: text.length > 300 ? 0.8 : 0.6
    }
  };

  let maxConfidence = 0;
  for (const [type, { regex, confidence }] of Object.entries(patterns)) {
    if (regex.test(text)) {
      classification.indicators.push(type);
      if (confidence > maxConfidence) {
        classification.type = type;
        classification.confidence = confidence;
        maxConfidence = confidence;
      }
    }
  }

  return classification;
}

function analyzeText(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  return {
    characterCount: text.length,
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence: sentences.length > 0 ? (words.length / sentences.length).toFixed(2) : 0,
    readabilityScore: calculateReadability(words, sentences),
    keyTerms: extractKeyTerms(words)
  };
}

function analyzeContext(context, text) {
  return {
    element: context.tagName || 'unknown',
    hasStructure: !!(context.id || context.className),
    parentContext: context.parentTag || 'unknown'
  };
}

function generateRecommendations(text, classification, context, domain) {
  const recommendations = [];

  if (text.length < 30) {
    recommendations.push({
      type: 'selection-length',
      priority: 'medium',
      message: 'Selection is quite short. Consider selecting more context for better analysis.',
      action: 'Expand selection to include surrounding text'
    });
  }

  if (classification.type === 'code') {
    recommendations.push({
      type: 'content-type',
      priority: 'high',
      message: 'Code content detected. Recommend syntax analysis and documentation generation.',
      action: 'Process through code analysis pipeline'
    });
  }

  return recommendations;
}

function identifyOptimizations(text, classification, domain, url) {
  const optimizations = [];

  if (text.includes('\n\n\n')) {
    optimizations.push({
      type: 'formatting',
      description: 'Multiple consecutive line breaks can be optimized',
      improvement: 'Normalize paragraph spacing'
    });
  }

  return optimizations;
}

function calculateTextMetrics(originalText, cleanedText) {
  return {
    originalLength: originalText.length,
    cleanedLength: cleanedText.length,
    compressionRatio: ((originalText.length - cleanedText.length) / originalText.length * 100).toFixed(2) + '%',
    efficiency: (cleanedText.length / originalText.length * 100).toFixed(2) + '%'
  };
}

function suggestIntegrations(text, classification, domain) {
  const integrations = [];

  if (text.length > 100) {
    integrations.push({
      type: 'llm-processing',
      provider: 'Claude/GPT',
      description: 'Suitable for advanced language model analysis and summarization',
      confidence: 0.9
    });
  }

  if (classification.type === 'code') {
    integrations.push({
      type: 'code-analysis',
      provider: 'GitHub Copilot',
      description: 'Enhanced code understanding and improvement suggestions',
      confidence: 0.95
    });
  }

  return integrations;
}

function calculateReadability(words, sentences) {
  if (sentences.length === 0) return 0;
  const avgWordsPerSentence = words.length / sentences.length;
  return Math.max(0, 100 - (avgWordsPerSentence - 15) * 2);
}

function extractKeyTerms(words) {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  const termFreq = new Map();
  
  words.forEach(word => {
    const cleaned = word.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    if (cleaned.length > 2 && !stopWords.has(cleaned)) {
      termFreq.set(cleaned, (termFreq.get(cleaned) || 0) + 1);
    }
  });

  return Array.from(termFreq.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([term, freq]) => ({ term, frequency: freq }));
}

function updateMetrics(text, domain, processingTime, success) {
  metrics.processingTimes.push(processingTime);
  if (metrics.processingTimes.length > 100) {
    metrics.processingTimes.shift();
  }
  
  metrics.avgProcessingTime = metrics.processingTimes.reduce((sum, time) => sum + time, 0) / metrics.processingTimes.length;
  
  if (success) {
    metrics.successfulProcessing++;
  } else {
    metrics.failedProcessing++;
  }
  
  if (text) {
    metrics.textStats.totalCharacters += text.length;
    metrics.textStats.avgLength = metrics.textStats.totalCharacters / metrics.totalRequests;
    metrics.textStats.minLength = Math.min(metrics.textStats.minLength, text.length);
    metrics.textStats.maxLength = Math.max(metrics.textStats.maxLength, text.length);
  }
  
  if (domain) {
    const count = metrics.topDomains.get(domain) || 0;
    metrics.topDomains.set(domain, count + 1);
  }
}

// API Endpoints
app.get('/api/metrics/selection', (req, res) => {
  const topDomainsArray = Array.from(metrics.topDomains.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
    
  const classificationsArray = Array.from(metrics.classifications.entries())
    .sort(([,a], [,b]) => b - a);

  res.json({
    ...metrics,
    topDomains: topDomainsArray,
    classifications: classificationsArray,
    successRate: metrics.totalRequests > 0 
      ? ((metrics.successfulProcessing / metrics.totalRequests) * 100).toFixed(2) + '%'
      : '0%',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/selection', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'selection-optimizer',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'Text Selection Optimizer',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      main: 'POST /api/ingest/selection',
      metrics: 'GET /api/metrics/selection', 
      health: 'GET /api/health/selection'
    },
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Text Selection Optimizer Server running on http://localhost:${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/api/metrics/selection`);
  console.log(`🔍 Health check at http://localhost:${PORT}/api/health/selection`);
});

export default app;