import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  VerifyRectifyLoop,
  ClaimVerifier,
  verifyResponse,
  rectifyResponse,
  runVerificationLoop,
} from '../src/verify-rectify-loop.js';

describe('Verify-Rectify Loop Module', () => {
  describe('ClaimVerifier class', () => {
    let verifier;

    beforeEach(() => {
      verifier = new ClaimVerifier({});
    });

    it('should create verifier instance', () => {
      assert.ok(verifier);
    });

    it('should extract claims from text', () => {
      const text = 'The sky is blue. Water is wet. The earth is round.';
      const claims = verifier.extractClaims(text);

      assert.ok(Array.isArray(claims));
      assert.ok(claims.length > 0);
    });

    it('should extract keywords from text', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const keywords = verifier.extractKeywords(text);

      assert.ok(Array.isArray(keywords));
      assert.ok(keywords.length > 0);
      assert.ok(!keywords.includes('the'));
      assert.ok(!keywords.includes('a'));
    });

    it('should verify output with no evidence', async () => {
      const output = 'Some factual claim';
      const context = { evidence: [] };
      const result = await verifier.verify(output, context);

      assert.ok(result);
      assert.ok(typeof result.valid === 'boolean');
      assert.ok(typeof result.confidence === 'number');
      assert.ok(Array.isArray(result.issues));
    });

    it('should verify output with evidence', async () => {
      const output = 'The sky is blue';
      const context = {
        evidence: [{ content: 'The sky appears blue due to Rayleigh scattering' }],
      };
      const result = await verifier.verify(output, context);

      assert.ok(result);
      assert.ok(typeof result.valid === 'boolean');
      assert.ok(typeof result.confidence === 'number');
    });
  });

  describe('VerifyRectifyLoop class', () => {
    let loop;
    let mockGenerator;

    beforeEach(() => {
      let callCount = 0;
      mockGenerator = async (prompt) => {
        callCount++;
        if (callCount === 1) {
          return 'Initial response with potential issues';
        }
        return 'Corrected response';
      };

      loop = new VerifyRectifyLoop({
        generator: mockGenerator,
        maxIterations: 3,
        confidenceTarget: 0.8,
      });
    });

    it('should create loop instance', () => {
      assert.ok(loop);
      assert.equal(loop.maxIterations, 3);
      assert.equal(loop.confidenceTarget, 0.8);
      assert.ok(loop.verifier);
    });

    it('should run verification loop', async () => {
      const prompt = 'Test prompt';
      const result = await loop.run(prompt, {});

      assert.ok(result);
      assert.ok('output' in result);
      assert.ok('abstained' in result);
      assert.ok('iterations' in result);
    });

    it('should build rectify instructions', () => {
      const verdict = {
        issues: ['Issue 1', 'Issue 2'],
        confidence: 0.5,
      };
      const instructions = loop.buildRectifyInstructions(verdict);

      assert.ok(typeof instructions === 'string');
      assert.ok(instructions.includes('Issue 1'));
      assert.ok(instructions.includes('Issue 2'));
    });
  });

  describe('Helper functions', () => {
    it('should export verifyResponse', () => {
      assert.ok(typeof verifyResponse === 'function');
    });

    it('should export rectifyResponse', () => {
      assert.ok(typeof rectifyResponse === 'function');
    });

    it('should export runVerificationLoop', () => {
      assert.ok(typeof runVerificationLoop === 'function');
    });

    it('should run verification loop via helper', async () => {
      const mockGenerator = async () => 'Test output';
      const config = {
        generator: mockGenerator,
        maxIterations: 2,
      };
      const result = await runVerificationLoop('Test prompt', {}, config);

      assert.ok(result);
      assert.ok('output' in result);
    });
  });
});
