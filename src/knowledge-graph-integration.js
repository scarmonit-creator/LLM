/**
 * Knowledge Graph Integration for Structured Fact Grounding
 * Implements Issue #21: Integrate knowledge graphs for structured fact grounding
 *
 * Features:
 * - Entity linking and recognition
 * - Knowledge graph retrieval (Wikidata, ConceptNet support)
 * - Graph-to-text templates for different relation types
 * - Integration with generation pipeline
 * - Post-generation fact checking against KG
 */

// Entity types for knowledge graph
const ENTITY_TYPES = {
  PERSON: 'person',
  ORGANIZATION: 'organization',
  LOCATION: 'location',
  DATE: 'date',
  CONCEPT: 'concept',
  EVENT: 'event',
};

// Knowledge graph sources
const KG_SOURCES = {
  WIKIDATA: 'wikidata',
  CONCEPTNET: 'conceptnet',
  CUSTOM: 'custom',
};

/**
 * Entity Linker - Identifies entities in text for KG lookup
 */
class EntityLinker {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.7;
    this.entityPatterns = this._buildEntityPatterns();
  }

  _buildEntityPatterns() {
    return {
      [ENTITY_TYPES.PERSON]: /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g,
      [ENTITY_TYPES.ORGANIZATION]:
        /\b([A-Z][A-Za-z]+ (?:Inc|Corp|Ltd|LLC|Foundation|University))\b/g,
      [ENTITY_TYPES.LOCATION]: /\b([A-Z][a-z]+(?:, [A-Z][a-z]+)*)\b/g,
      [ENTITY_TYPES.DATE]:
        /\b(\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4})\b/g,
    };
  }

  /**
   * Extract entities from text
   * @param {string} text - Input text
   * @returns {Array} Array of {text, type, confidence}
   */
  extractEntities(text) {
    const entities = [];

    for (const [type, pattern] of Object.entries(this.entityPatterns)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          text: match[1] || match[0],
          type,
          confidence: 0.8,
          position: match.index,
        });
      }
    }

    return entities.filter((e) => e.confidence >= this.threshold);
  }

  /**
   * Link entity to KG identifier
   * @param {Object} entity - Entity object
   * @param {string} source - KG source
   * @returns {Promise<Object>} Entity with KG ID
   */
  async linkToKG(entity, source = KG_SOURCES.WIKIDATA) {
    // Simulate entity linking (in production, call actual KG API)
    return {
      ...entity,
      kgId: `${source}:${entity.text.replace(/\s+/g, '_')}`,
      kgSource: source,
    };
  }
}

/**
 * Knowledge Graph Retriever - Fetches information from knowledge graphs
 */
class KGRetriever {
  constructor(options = {}) {
    this.source = options.source || KG_SOURCES.WIKIDATA;
    this.maxHops = options.maxHops || 2;
    this.cache = new Map();
  }

  /**
   * Retrieve entity information from KG
   * @param {string} entityId - KG entity identifier
   * @returns {Promise<Object>} Entity facts and relations
   */
  async retrieve(entityId) {
    // Check cache first
    if (this.cache.has(entityId)) {
      return this.cache.get(entityId);
    }

    // Simulate KG retrieval (in production, use SPARQL or API)
    const result = await this._queryKG(entityId);
    this.cache.set(entityId, result);
    return result;
  }

  async _queryKG(entityId) {
    // Placeholder for actual KG query
    // In production: execute SPARQL query or API call
    return {
      id: entityId,
      label: entityId.split(':')[1],
      description: 'Entity from knowledge graph',
      properties: {
        type: 'Q5', // Wikidata human
        instanceOf: ['person'],
        relations: [],
      },
      facts: [],
      neighbors: [],
    };
  }

  /**
   * Retrieve multi-hop relationships
   * @param {string} entityId - Starting entity
   * @param {number} hops - Number of hops
   * @returns {Promise<Array>} Related entities and relations
   */
  async retrieveNeighborhood(entityId, hops = 1) {
    if (hops > this.maxHops) hops = this.maxHops;

    const visited = new Set();
    const results = [];

    await this._exploreNeighbors(entityId, hops, visited, results);
    return results;
  }

  async _exploreNeighbors(entityId, remainingHops, visited, results) {
    if (remainingHops <= 0 || visited.has(entityId)) return;

    visited.add(entityId);
    const entity = await this.retrieve(entityId);
    results.push(entity);

    if (remainingHops > 1 && entity.neighbors) {
      for (const neighbor of entity.neighbors.slice(0, 5)) {
        await this._exploreNeighbors(neighbor.id, remainingHops - 1, visited, results);
      }
    }
  }
}

/**
 * Graph-to-Text Converter - Converts KG facts to natural language
 */
class GraphToTextConverter {
  constructor() {
    this.templates = this._buildTemplates();
  }

  _buildTemplates() {
    return {
      instanceOf: (subject, object) => `${subject} is a ${object}`,
      birthDate: (subject, date) => `${subject} was born on ${date}`,
      birthPlace: (subject, place) => `${subject} was born in ${place}`,
      occupation: (subject, job) => `${subject} works as a ${job}`,
      founder: (org, person) => `${org} was founded by ${person}`,
      headquarters: (org, location) => `${org} is headquartered in ${location}`,
      partOf: (part, whole) => `${part} is part of ${whole}`,
      locatedIn: (entity, location) => `${entity} is located in ${location}`,
      default: (subject, relation, object) => `${subject} ${relation} ${object}`,
    };
  }

  /**
   * Convert KG triple to natural language
   * @param {Object} triple - {subject, predicate, object}
   * @returns {string} Natural language sentence
   */
  convert(triple) {
    const { subject, predicate, object } = triple;
    const template = this.templates[predicate] || this.templates.default;
    return template(subject, object, predicate);
  }

  /**
   * Convert multiple facts to paragraph
   * @param {Array} facts - Array of KG triples
   * @returns {string} Natural language paragraph
   */
  convertToText(facts) {
    if (!facts || facts.length === 0) return '';

    const sentences = facts.map((fact) => this.convert(fact));
    return sentences.join('. ') + '.';
  }
}

/**
 * Fact Checker - Verifies claims against knowledge graph
 */
class KGFactChecker {
  constructor(retriever, options = {}) {
    this.retriever = retriever;
    this.strictness = options.strictness || 0.8;
  }

  /**
   * Check if a claim is supported by KG
   * @param {string} claim - Claim to verify
   * @param {Array} entities - Linked entities in claim
   * @returns {Promise<Object>} Verification result
   */
  async checkClaim(claim, entities) {
    const results = [];

    for (const entity of entities) {
      const kgFacts = await this.retriever.retrieve(entity.kgId);
      const match = this._matchClaimToFacts(claim, kgFacts);
      results.push(match);
    }

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      supported: avgConfidence >= this.strictness,
      confidence: avgConfidence,
      evidence: results,
      contradictions: results.filter((r) => r.confidence < 0.3),
    };
  }

  _matchClaimToFacts(claim, kgFacts) {
    // Simplified matching (in production: use semantic similarity)
    const claimLower = claim.toLowerCase();
    for (const fact of kgFacts.facts || []) {
      const factText = fact.text ? fact.text.toLowerCase() : '';
      if (claimLower.includes(factText) || factText.includes(claimLower)) {
        return { confidence: 0.9, fact };
      }
    }
    return { confidence: 0.5, fact: null };
  }
}

/**
 * Main Knowledge Graph Integration Class
 */
class KnowledgeGraphIntegration {
  constructor(options = {}) {
    this.entityLinker = new EntityLinker(options.linker);
    this.retriever = new KGRetriever(options.retriever);
    this.converter = new GraphToTextConverter();
    this.factChecker = new KGFactChecker(this.retriever, options.factChecker);
  }

  /**
   * Augment query with KG context
   * @param {string} query - User query
   * @returns {Promise<Object>} Query with KG context
   */
  async augmentQuery(query) {
    // Extract entities
    const entities = this.entityLinker.extractEntities(query);

    // Link to KG
    const linkedEntities = await Promise.all(entities.map((e) => this.entityLinker.linkToKG(e)));

    // Retrieve KG context
    const kgContext = await Promise.all(linkedEntities.map((e) => this.retriever.retrieve(e.kgId)));

    // Convert to text
    const contextText = kgContext
      .map((ctx) => this.converter.convertToText(ctx.facts))
      .join('\n\n');

    return {
      originalQuery: query,
      entities: linkedEntities,
      kgContext,
      contextText,
      augmentedQuery: `${query}\n\nContext from knowledge graph:\n${contextText}`,
    };
  }

  /**
   * Verify generated response against KG
   * @param {string} response - Generated response
   * @param {string} query - Original query
   * @returns {Promise<Object>} Verification result
   */
  async verifyResponse(response, _query) {
    // Extract entities from response
    const entities = this.entityLinker.extractEntities(response);
    const linkedEntities = await Promise.all(entities.map((e) => this.entityLinker.linkToKG(e)));

    // Check each claim
    const sentences = response.split(/[.!?]/).filter((s) => s.trim());
    const verifications = await Promise.all(
      sentences.map((claim) => this.factChecker.checkClaim(claim, linkedEntities))
    );

    const overallSupport = verifications.filter((v) => v.supported).length / verifications.length;

    return {
      verified: overallSupport >= 0.7,
      overallSupport,
      claimVerifications: verifications,
      unsupportedClaims: sentences.filter((_, i) => !verifications[i].supported),
      contradictions: verifications.flatMap((v) => v.contradictions),
    };
  }

  /**
   * Full pipeline: augment query, generate, verify
   * @param {string} query - User query
   * @param {Function} generateFn - Generation function
   * @returns {Promise<Object>} Full result with verification
   */
  async runPipeline(query, generateFn) {
    // Augment query with KG
    const augmented = await this.augmentQuery(query);

    // Generate response (using external LLM)
    const response = await generateFn(augmented.augmentedQuery);

    // Verify response
    const verification = await this.verifyResponse(response, query);

    return {
      query,
      augmentedQuery: augmented.augmentedQuery,
      entities: augmented.entities,
      kgContext: augmented.kgContext,
      response,
      verification,
      trustworthy: verification.verified,
    };
  }
}

// Export classes and constants
module.exports = {
  KnowledgeGraphIntegration,
  EntityLinker,
  KGRetriever,
  GraphToTextConverter,
  KGFactChecker,
  ENTITY_TYPES,
  KG_SOURCES,
};
