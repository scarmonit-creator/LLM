// EVER-style Verify-Then-Rectify Loop
// Addresses Issue #17: Implement verify-then-rectify loop for real-time error correction

/**
 * Verification module that checks claims against retrieved evidence
 */
class ClaimVerifier {
  constructor({ ragPipeline, hallucinationDetector }) {
    this.ragPipeline = ragPipeline;
    this.hallucinationDetector = hallucinationDetector;
  }

  /**
   * Verify output against retrieved evidence
   * Detects both intrinsic (contradictions) and extrinsic (unsupported) errors
   */
  async verify(output, context) {
    const issues = [];
    let confidence = 1.0;

    // Extract claims from the output
    const claims = this.extractClaims(output);

    // Retrieve relevant evidence for each claim
    const evidence = context.evidence || [];
    if (this.ragPipeline && claims.length > 0) {
      try {
        // Retrieve evidence for verification
        const query = claims.join(' ');
        const retrieved = await this.ragPipeline.retrieve(query, { topK: 5 });
        evidence.push(...retrieved);
      } catch (error) {
        issues.push(`Failed to retrieve evidence: ${error.message}`);
        confidence *= 0.8;
      }
    }

    // Check for intrinsic errors (contradictions with sources)
    const intrinsicErrors = await this.detectIntrinsicErrors(claims, evidence);
    if (intrinsicErrors.length > 0) {
      issues.push(...intrinsicErrors.map((e) => `Intrinsic error: ${e}`));
      confidence *= 0.5;
    }

    // Check for extrinsic errors (unsupported claims)
    const extrinsicErrors = await this.detectExtrinsicErrors(claims, evidence);
    if (extrinsicErrors.length > 0) {
      issues.push(...extrinsicErrors.map((e) => `Extrinsic error: ${e}`));
      confidence *= 0.6;
    }

    // Use hallucination detector for additional validation
    if (this.hallucinationDetector) {
      try {
        const hallucinationResult = await this.hallucinationDetector.detect(output, {
          samples: 3,
          threshold: 0.7,
        });
        if (hallucinationResult.isHallucination) {
          issues.push('Potential hallucination detected');
          confidence *= hallucinationResult.confidence;
        }
      } catch (_error) {
        // Continue without hallucination detection if it fails
      }
    }

    // Check if content is verifiable, trigger abstention if not
    const isVerifiable = evidence.length > 0 && issues.length === 0;
    if (!isVerifiable && evidence.length === 0) {
      issues.push('Unverifiable content: no evidence available');
      confidence *= 0.3;
    }

    const valid = issues.length === 0 && confidence >= 0.7;

    return {
      valid,
      issues,
      confidence,
      shouldAbstain: !isVerifiable && confidence < 0.5,
      evidence: evidence.slice(0, 3), // Include top evidence
    };
  }

  /**
   * Extract factual claims from output text
   */
  extractClaims(text) {
    // Simple extraction: split into sentences
    // In production, use NLP to extract actual factual claims
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    return sentences;
  }

  /**
   * Detect intrinsic errors: contradictions with retrieved sources
   */
  async detectIntrinsicErrors(claims, evidence) {
    const errors = [];
    if (evidence.length === 0) return errors;

    for (const claim of claims) {
      // Check if claim contradicts any evidence
      for (const doc of evidence) {
        const docText = doc.content || doc.text || String(doc);
        if (this.isContradiction(claim, docText)) {
          errors.push(`Claim "${claim.substring(0, 50)}..." contradicts source`);
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Detect extrinsic errors: unsupported claims (not backed by evidence)
   */
  async detectExtrinsicErrors(claims, evidence) {
    const errors = [];
    if (evidence.length === 0) {
      // All claims are unsupported if no evidence
      return claims.map((c) => `Unsupported claim: "${c.substring(0, 50)}..."`);
    }

    for (const claim of claims) {
      let isSupported = false;
      for (const doc of evidence) {
        const docText = doc.content || doc.text || String(doc);
        if (this.isSupported(claim, docText)) {
          isSupported = true;
          break;
        }
      }
      if (!isSupported) {
        errors.push(`Unsupported claim: "${claim.substring(0, 50)}..."`);
      }
    }

    return errors;
  }

  /**
   * Check if claim contradicts source text
   * Simple keyword-based check (in production, use semantic similarity)
   */
  isContradiction(claim, sourceText) {
    const negationWords = ['not', 'never', 'no', 'none', 'neither', 'cannot'];
    const claimLower = claim.toLowerCase();
    const sourceLower = sourceText.toLowerCase();

    // Check for opposite claims
    for (const word of negationWords) {
      if (claimLower.includes(word) && !sourceLower.includes(word)) {
        // Claim is negative but source is not
        const commonWords = this.findCommonKeywords(claim, sourceText);
        if (commonWords.length > 2) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if claim is supported by source text
   */
  isSupported(claim, sourceText) {
    const keywords = this.extractKeywords(claim);
    const sourceLower = sourceText.toLowerCase();

    // Check if significant keywords from claim appear in source
    let matchCount = 0;
    for (const keyword of keywords) {
      if (sourceLower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    // Consider supported if majority of keywords are found
    return matchCount >= Math.ceil(keywords.length * 0.6);
  }

  /**
   * Extract keywords from text (simple implementation)
   */
  extractKeywords(text) {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'can',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 10); // Top 10 keywords
  }

  /**
   * Find common keywords between two texts
   */
  findCommonKeywords(text1, text2) {
    const keywords1 = new Set(this.extractKeywords(text1));
    const keywords2 = new Set(this.extractKeywords(text2));
    return [...keywords1].filter((k) => keywords2.has(k));
  }
}

/**
 * EVER-style Verify-Then-Rectify Loop
 * Implements iterative verification and correction with convergence criteria
 */
class VerifyRectifyLoop {
  constructor({
    verifier,
    generator,
    maxIterations = 3,
    confidenceTarget = 0.9,
    ragPipeline = null,
    hallucinationDetector = null,
  }) {
    // Use provided verifier or create default ClaimVerifier
    if (verifier) {
      this.verifier = verifier;
    } else {
      this.verifier = new ClaimVerifier({
        ragPipeline,
        hallucinationDetector,
      });
    }

    this.generator = generator; // function(prompt, context) => output
    this.maxIterations = maxIterations;
    this.confidenceTarget = confidenceTarget;
  }

  async run(prompt, context = {}) {
    let attempt = 0;
    let output = await this.generator(prompt, context);
    const history = [];

    while (attempt < this.maxIterations) {
      const verdict = await this.verifier.verify(output, context);
      history.push({ attempt, output, verdict });

      // Check for abstention trigger
      if (verdict.shouldAbstain) {
        return {
          output: null,
          abstained: true,
          reason: 'Content cannot be verified with sufficient confidence',
          verdict,
          iterations: attempt + 1,
          history,
        };
      }

      // Check convergence criteria
      if (verdict.valid && verdict.confidence >= this.confidenceTarget) {
        return {
          output,
          abstained: false,
          verdict,
          iterations: attempt + 1,
          rectified: attempt > 0,
          history,
        };
      }

      // Build rectification instructions
      const rectifyInstructions = this.buildRectifyInstructions(verdict);

      // Generate rectified output
      output = await this.generator(
        `${prompt}\n\nRevise the previous response to address these issues:\n${rectifyInstructions}\n\nProvide a corrected response that is accurate and well-supported.`,
        {
          ...context,
          previousOutput: output,
          lastVerdict: verdict,
          evidence: verdict.evidence,
        }
      );

      attempt++;
    }

    // Final verification after max iterations
    const finalVerdict = await this.verifier.verify(output, context);

    // If still not valid after max iterations, consider abstaining
    if (!finalVerdict.valid && finalVerdict.confidence < 0.5) {
      return {
        output: null,
        abstained: true,
        reason: 'Unable to generate verified output within iteration limit',
        verdict: finalVerdict,
        iterations: attempt,
        history,
      };
    }

    return {
      output,
      abstained: false,
      verdict: finalVerdict,
      iterations: attempt,
      rectified: attempt > 0,
      maxIterationsReached: true,
      history,
    };
  }

  buildRectifyInstructions(verdict) {
    const parts = [];

    if (verdict.issues?.length) {
      parts.push(
        'Fix the following issues:\n' +
          verdict.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')
      );
    }

    if (verdict.evidence?.length) {
      parts.push(
        'Use these verified sources:\n' +
          verdict.evidence
            .map((e, idx) => {
              const text = e.content || e.text || String(e);
              return `${idx + 1}. ${text.substring(0, 100)}...`;
            })
            .join('\n')
      );
    }

    if (verdict.missing?.length) {
      parts.push('Add missing elements: ' + verdict.missing.join(', '));
    }

    if (typeof verdict.confidence === 'number' && verdict.confidence < this.confidenceTarget) {
      parts.push(
        `Increase factual accuracy and confidence to at least ${this.confidenceTarget}. ` +
          `Current confidence: ${verdict.confidence.toFixed(2)}`
      );
    }

    return parts.join('\n\n');
  }
}

export { VerifyRectifyLoop, ClaimVerifier };
export default VerifyRectifyLoop;

// Helper functions for backwards compatibility
export const verifyResponse = async (output, context, verifier) => {
  return await verifier.verify(output, context);
};

export const rectifyResponse = async (prompt, context, generator, instructions) => {
  return await generator(
    `${prompt}\n\nRevise the previous response to address these issues:\n${instructions}\n\nProvide a corrected response that is accurate and well-supported.`,
    context
  );
};

export const runVerificationLoop = async (prompt, context, config) => {
  const loop = new VerifyRectifyLoop(config);
  return await loop.run(prompt, context);
};
