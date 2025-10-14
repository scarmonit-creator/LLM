// Ultra-Optimized Text Analyzer with AI-Powered Analysis
// Combines semantic analysis, sentiment detection, and intelligent content understanding

class UltraOptimizedTextAnalyzer {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 500;
    this.aiModels = {
      sentiment: new SimpleSentimentAnalyzer(),
      keywords: new AdvancedKeywordExtractor(),
      summarizer: new IntelligentSummarizer(),
      detector: new ContentDetector()
    };
    
    console.log('🧠 Ultra-Optimized Text Analyzer initialized');
  }

  /**
   * Comprehensive text analysis with caching and AI features
   */
  analyze(text, options = {}) {
    if (!text || text.trim().length === 0) {
      return { error: 'No text provided for analysis' };
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(text, options);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log('📋 Cache hit for text analysis');
      return { ...this.cache.get(cacheKey), fromCache: true };
    }

    const startTime = performance.now();
    
    // Basic metrics
    const basic = this.getBasicMetrics(text);
    
    // Advanced metrics
    const advanced = this.getAdvancedMetrics(text);
    
    // AI-powered analysis
    const ai = this.getAIAnalysis(text, options);
    
    // Content detection
    const content = this.detectContentType(text);
    
    // Readability analysis
    const readability = this.analyzeReadability(text);
    
    // Language and structure analysis
    const structure = this.analyzeStructure(text);
    
    const analysis = {
      timestamp: Date.now(),
      processingTime: Math.round((performance.now() - startTime) * 100) / 100,
      
      // Core metrics
      basic,
      advanced,
      readability,
      structure,
      content,
      ai,
      
      // Meta information
      meta: {
        textHash: this.hashText(text),
        analysisVersion: '3.0.0',
        cacheKey,
        options
      }
    };
    
    // Cache the result
    this.cacheResult(cacheKey, analysis);
    
    return analysis;
  }

  /**
   * Get basic text metrics with optimized counting
   */
  getBasicMetrics(text) {
    const length = text.length;
    
    // Optimized word counting using regex
    const words = text.trim().match(/\S+/g) || [];
    const wordCount = words.length;
    
    // Character count without spaces
    const charNoSpaces = text.replace(/\s/g, '').length;
    
    // Line counting
    const lines = text.split(/\r?\n/);
    const lineCount = lines.length;
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;
    
    // Sentence counting (improved regex)
    const sentences = text.match(/[.!?]+(?=\s+[A-Z]|\s*$)/g) || [];
    const sentenceCount = sentences.length;
    
    // Paragraph counting
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length;
    
    // Average calculations
    const avgWordsPerSentence = sentenceCount > 0 ? Math.round((wordCount / sentenceCount) * 10) / 10 : 0;
    const avgCharsPerWord = wordCount > 0 ? Math.round((charNoSpaces / wordCount) * 10) / 10 : 0;
    const avgSentencesPerParagraph = paragraphCount > 0 ? Math.round((sentenceCount / paragraphCount) * 10) / 10 : 0;
    
    // Reading time (words per minute: 200 for average, 250 for fast)
    const readingTimeAverage = Math.ceil(wordCount / 200);
    const readingTimeFast = Math.ceil(wordCount / 250);
    
    return {
      characters: {
        total: length,
        noSpaces: charNoSpaces,
        spaces: length - charNoSpaces
      },
      words: {
        total: wordCount,
        unique: new Set(words.map(w => w.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''))).size,
        averageLength: avgCharsPerWord
      },
      sentences: {
        total: sentenceCount,
        averageWords: avgWordsPerSentence
      },
      paragraphs: {
        total: paragraphCount,
        averageSentences: avgSentencesPerParagraph
      },
      lines: {
        total: lineCount,
        nonEmpty: nonEmptyLines,
        empty: lineCount - nonEmptyLines
      },
      readingTime: {
        average: `${readingTimeAverage} min`,
        fast: `${readingTimeFast} min`,
        seconds: Math.round(wordCount / 3.33) // 200 WPM = 3.33 WPS
      }
    };
  }

  /**
   * Get advanced linguistic metrics
   */
  getAdvancedMetrics(text) {
    const words = text.toLowerCase().match(/\b[a-zA-Z]+\b/g) || [];
    
    // Word frequency analysis
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // Most common words (excluding stop words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those']);
    
    const meaningfulWords = Object.entries(wordFreq)
      .filter(([word]) => !stopWords.has(word) && word.length > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count, frequency: Math.round((count / words.length) * 10000) / 100 }));
    
    // Vocabulary diversity (Type-Token Ratio)
    const uniqueWords = Object.keys(wordFreq).length;
    const vocabularyDiversity = words.length > 0 ? Math.round((uniqueWords / words.length) * 10000) / 100 : 0;
    
    // Text complexity indicators
    const longWords = words.filter(word => word.length > 6).length;
    const longWordPercentage = words.length > 0 ? Math.round((longWords / words.length) * 10000) / 100 : 0;
    
    // Punctuation analysis
    const punctuation = text.match(/[.!?;:,-]/g) || [];
    const punctuationDensity = Math.round((punctuation.length / text.length) * 10000) / 100;
    
    return {
      vocabulary: {
        total: words.length,
        unique: uniqueWords,
        diversity: vocabularyDiversity,
        topWords: meaningfulWords
      },
      complexity: {
        longWords,
        longWordPercentage,
        avgWordLength: Math.round((words.join('').length / words.length) * 100) / 100
      },
      punctuation: {
        total: punctuation.length,
        density: punctuationDensity,
        types: this.categorizePunctuation(punctuation)
      }
    };
  }

  /**
   * Analyze text readability using multiple metrics
   */
  analyzeReadability(text) {
    const words = text.match(/\S+/g) || [];
    const sentences = text.match(/[.!?]+/g) || [];
    const syllables = this.countSyllables(text);
    
    if (words.length === 0 || sentences.length === 0) {
      return { error: 'Insufficient text for readability analysis' };
    }
    
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    // Flesch Reading Ease Score
    const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    const fleschLevel = this.getFleschLevel(fleschScore);
    
    // Flesch-Kincaid Grade Level
    const gradeLevel = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
    
    // Automated Readability Index
    const characters = text.replace(/\s/g, '').length;
    const ariScore = (4.71 * (characters / words.length)) + (0.5 * avgWordsPerSentence) - 21.43;
    
    return {
      flesch: {
        score: Math.round(fleschScore * 10) / 10,
        level: fleschLevel,
        description: this.getFleschDescription(fleschScore)
      },
      gradeLevel: {
        fleschKincaid: Math.round(gradeLevel * 10) / 10,
        ari: Math.round(ariScore * 10) / 10,
        average: Math.round(((gradeLevel + ariScore) / 2) * 10) / 10
      },
      metrics: {
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
        avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100
      }
    };
  }

  /**
   * Analyze text structure and organization
   */
  analyzeStructure(text) {
    // Detect headings (markdown-style or numbered)
    const headings = text.match(/^#{1,6}\s+.+|^\d+\.\s+.+/gm) || [];
    
    // Detect lists
    const bulletLists = text.match(/^[-*+]\s+.+/gm) || [];
    const numberedLists = text.match(/^\d+\.\s+.+/gm) || [];
    
    // Detect URLs and email addresses
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
    
    // Detect code blocks (markdown-style)
    const codeBlocks = text.match(/```[\s\S]*?```|`[^`]+`/g) || [];
    
    // Detect quotes
    const quotes = text.match(/^>\s+.+/gm) || text.match(/["'][^"']{10,}["']/g) || [];
    
    return {
      headings: {
        total: headings.length,
        list: headings.map(h => h.trim())
      },
      lists: {
        bullet: bulletLists.length,
        numbered: numberedLists.length,
        total: bulletLists.length + numberedLists.length
      },
      links: {
        urls: urls.length,
        emails: emails.length,
        urlList: urls.slice(0, 5), // First 5 URLs
        emailList: emails.slice(0, 5) // First 5 emails
      },
      formatting: {
        codeBlocks: codeBlocks.length,
        quotes: quotes.length,
        emphasis: (text.match(/\*\*[^*]+\*\*|__[^_]+__/g) || []).length,
        italic: (text.match(/\*[^*]+\*|_[^_]+_/g) || []).length
      }
    };
  }

  /**
   * Detect content type and characteristics
   */
  detectContentType(text) {
    const indicators = {
      technical: ['function', 'class', 'import', 'export', 'const', 'var', 'let', 'API', 'HTTP', 'JSON', 'SQL'],
      academic: ['research', 'study', 'analysis', 'hypothesis', 'methodology', 'conclusion', 'reference', 'citation'],
      business: ['revenue', 'profit', 'customer', 'market', 'strategy', 'ROI', 'KPI', 'stakeholder'],
      creative: ['story', 'character', 'plot', 'scene', 'metaphor', 'imagery', 'narrative'],
      legal: ['contract', 'agreement', 'clause', 'terms', 'liability', 'jurisdiction', 'whereas'],
      medical: ['patient', 'treatment', 'diagnosis', 'symptom', 'medical', 'clinical', 'therapy']
    };
    
    const lowerText = text.toLowerCase();
    const scores = {};
    
    // Calculate scores for each content type
    for (const [type, keywords] of Object.entries(indicators)) {
      scores[type] = keywords.reduce((score, keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = (lowerText.match(regex) || []).length;
        return score + matches;
      }, 0);
    }
    
    // Determine primary content type
    const maxScore = Math.max(...Object.values(scores));
    const primaryType = maxScore > 0 ? Object.keys(scores).find(key => scores[key] === maxScore) : 'general';
    
    // Additional content characteristics
    const characteristics = {
      hasCode: /```|`|function\s*\(|class\s+\w+|import\s+\w+/.test(text),
      hasMarkdown: /#{1,6}\s|\*\*|__|\[.*\]\(.*\)/.test(text),
      hasHTML: /<\/?[a-z][\s\S]*>/i.test(text),
      hasNumbers: /\d+/.test(text),
      hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(text),
      hasDates: /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(text)
    };
    
    return {
      primaryType,
      confidence: maxScore > 3 ? 'high' : maxScore > 1 ? 'medium' : 'low',
      scores,
      characteristics
    };
  }

  /**
   * AI-powered analysis using built-in models
   */
  getAIAnalysis(text, options) {
    const analysis = {
      sentiment: this.aiModels.sentiment.analyze(text),
      keywords: this.aiModels.keywords.extract(text, { limit: options.keywordLimit || 10 }),
      summary: options.includeSummary ? this.aiModels.summarizer.summarize(text, { sentences: 3 }) : null,
      topics: this.extractTopics(text),
      language: this.detectLanguage(text)
    };
    
    return analysis;
  }

  /**
   * Extract main topics from text
   */
  extractTopics(text) {
    const topics = [];
    const lowerText = text.toLowerCase();
    
    // Technology topics
    if (/\b(javascript|python|react|node|api|database|server|code|programming)\b/.test(lowerText)) {
      topics.push('Technology');
    }
    
    // Business topics
    if (/\b(business|market|sales|revenue|customer|strategy|profit)\b/.test(lowerText)) {
      topics.push('Business');
    }
    
    // Science topics
    if (/\b(research|study|experiment|data|analysis|hypothesis|method)\b/.test(lowerText)) {
      topics.push('Science/Research');
    }
    
    // Education topics
    if (/\b(learn|education|student|teacher|course|lesson|study)\b/.test(lowerText)) {
      topics.push('Education');
    }
    
    return topics.length > 0 ? topics : ['General'];
  }

  /**
   * Detect primary language (basic detection)
   */
  detectLanguage(text) {
    const patterns = {
      english: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/g,
      spanish: /\b(el|la|y|o|pero|en|con|de|para|por)\b/g,
      french: /\b(le|la|et|ou|mais|dans|avec|de|pour|par)\b/g,
      german: /\b(der|die|das|und|oder|aber|in|mit|von|für)\b/g
    };
    
    const lowerText = text.toLowerCase();
    let maxMatches = 0;
    let detectedLang = 'unknown';
    
    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = (lowerText.match(pattern) || []).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLang = lang;
      }
    }
    
    return {
      primary: detectedLang,
      confidence: maxMatches > 5 ? 'high' : maxMatches > 2 ? 'medium' : 'low'
    };
  }

  // Helper methods
  generateCacheKey(text, options) {
    const hash = this.hashText(text);
    const optionsHash = this.hashText(JSON.stringify(options));
    return `${hash}_${optionsHash}`;
  }

  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  cacheResult(key, result) {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      ...result,
      cachedAt: Date.now()
    });
  }

  countSyllables(text) {
    const words = text.toLowerCase().match(/\b[a-zA-Z]+\b/g) || [];
    return words.reduce((total, word) => {
      // Simple syllable counting heuristic
      let syllables = word.match(/[aeiouy]+/g) || [];
      if (word.endsWith('e')) syllables.pop();
      return total + Math.max(1, syllables.length);
    }, 0);
  }

  categorizePunctuation(punctuation) {
    const categories = {
      periods: punctuation.filter(p => p === '.').length,
      commas: punctuation.filter(p => p === ',').length,
      questions: punctuation.filter(p => p === '?').length,
      exclamations: punctuation.filter(p => p === '!').length,
      semicolons: punctuation.filter(p => p === ';').length,
      colons: punctuation.filter(p => p === ':').length,
      dashes: punctuation.filter(p => p === '-').length
    };
    
    return categories;
  }

  getFleschLevel(score) {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
  }

  getFleschDescription(score) {
    if (score >= 90) return '5th grade level. Very easy to read.';
    if (score >= 80) return '6th grade level. Easy to read.';
    if (score >= 70) return '7th grade level. Fairly easy to read.';
    if (score >= 60) return '8th & 9th grade level. Plain English.';
    if (score >= 50) return '10th to 12th grade level. Fairly difficult.';
    if (score >= 30) return 'College level. Difficult to read.';
    return 'Graduate level. Very difficult to read.';
  }

  // Clear cache method
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Text analysis cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      utilization: Math.round((this.cache.size / this.maxCacheSize) * 100)
    };
  }
}

// Simple AI Models (lightweight implementations)
class SimpleSentimentAnalyzer {
  constructor() {
    this.positiveWords = new Set([
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'love', 'like',
      'happy', 'joy', 'pleased', 'satisfied', 'perfect', 'brilliant', 'outstanding', 'superb'
    ]);
    
    this.negativeWords = new Set([
      'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'angry', 'disappointed',
      'frustrated', 'annoyed', 'upset', 'worried', 'concerned', 'problem', 'issue', 'error'
    ]);
  }

  analyze(text) {
    const words = text.toLowerCase().match(/\b[a-zA-Z]+\b/g) || [];
    let positiveScore = 0;
    let negativeScore = 0;
    
    words.forEach(word => {
      if (this.positiveWords.has(word)) positiveScore++;
      if (this.negativeWords.has(word)) negativeScore++;
    });
    
    const totalSentimentWords = positiveScore + negativeScore;
    let sentiment = 'neutral';
    let confidence = 0;
    
    if (totalSentimentWords > 0) {
      const ratio = positiveScore / totalSentimentWords;
      confidence = Math.round((totalSentimentWords / words.length) * 1000) / 10;
      
      if (ratio > 0.6) sentiment = 'positive';
      else if (ratio < 0.4) sentiment = 'negative';
    }
    
    return {
      sentiment,
      confidence,
      scores: { positive: positiveScore, negative: negativeScore, neutral: words.length - totalSentimentWords }
    };
  }
}

class AdvancedKeywordExtractor {
  extract(text, options = {}) {
    const limit = options.limit || 10;
    const words = text.toLowerCase().match(/\b[a-zA-Z]{3,}\b/g) || [];
    
    // Stop words to filter out
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that'
    ]);
    
    // Count word frequencies
    const frequencies = {};
    words.forEach(word => {
      if (!stopWords.has(word)) {
        frequencies[word] = (frequencies[word] || 0) + 1;
      }
    });
    
    // Sort by frequency and return top keywords
    return Object.entries(frequencies)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([word, count]) => ({
        word,
        frequency: count,
        relevance: Math.round((count / words.length) * 10000) / 100
      }));
  }
}

class IntelligentSummarizer {
  summarize(text, options = {}) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const targetSentences = options.sentences || Math.min(3, Math.ceil(sentences.length * 0.3));
    
    if (sentences.length <= targetSentences) {
      return { summary: text.trim(), method: 'full-text', sentences: sentences.length };
    }
    
    // Score sentences based on word frequency and position
    const wordFreq = this.getWordFrequencies(text);
    
    const scoredSentences = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().match(/\b[a-zA-Z]+\b/g) || [];
      let score = 0;
      
      // Word frequency score
      words.forEach(word => {
        score += wordFreq[word] || 0;
      });
      
      // Position bonus (first and last sentences often important)
      if (index === 0 || index === sentences.length - 1) {
        score *= 1.2;
      }
      
      // Length penalty for very short or very long sentences
      if (words.length < 5 || words.length > 30) {
        score *= 0.8;
      }
      
      return { sentence: sentence.trim(), score, index };
    });
    
    // Select top sentences and sort by original order
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, targetSentences)
      .sort((a, b) => a.index - b.index)
      .map(item => item.sentence);
    
    return {
      summary: topSentences.join(' '),
      method: 'extractive',
      sentences: topSentences.length,
      originalSentences: sentences.length
    };
  }

  getWordFrequencies(text) {
    const words = text.toLowerCase().match(/\b[a-zA-Z]+\b/g) || [];
    const frequencies = {};
    
    words.forEach(word => {
      if (word.length > 2) {
        frequencies[word] = (frequencies[word] || 0) + 1;
      }
    });
    
    return frequencies;
  }
}

class ContentDetector {
  detect(text) {
    const detections = {
      hasPersonalInfo: /\b\d{3}-\d{2}-\d{4}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text),
      hasPhoneNumbers: /\b\d{3}[.-]?\d{3}[.-]?\d{4}\b/.test(text),
      hasCreditCards: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(text),
      hasUrls: /https?:\/\/[^\s]+/.test(text),
      hasPasswords: /password|pwd|pass/i.test(text),
      hasApiKeys: /[A-Za-z0-9]{32,}/.test(text)
    };
    
    const riskLevel = Object.values(detections).filter(Boolean).length;
    
    return {
      ...detections,
      riskLevel: riskLevel === 0 ? 'low' : riskLevel <= 2 ? 'medium' : 'high'
    };
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.UltraOptimizedTextAnalyzer = UltraOptimizedTextAnalyzer;
}