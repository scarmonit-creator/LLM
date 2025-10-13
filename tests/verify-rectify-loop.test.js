import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VerifyRectifyLoop,
  verifyResponse,
  rectifyResponse,
  runVerificationLoop,
} from '../src/verify-rectify-loop.js';

describe('Verify-Rectify Loop Module', () => {
  describe('VerifyRectifyLoop class', () => {
    let loop;

    beforeEach(() => {
      loop = new VerifyRectifyLoop({
        maxIterations: 3,
        confidenceThreshold: 0.8,
      });
    });

    it('should create instance with default config', () => {
      expect(loop).toBeDefined();
      expect(loop.maxIterations).toBe(3);
      expect(loop.confidenceThreshold).toBe(0.8);
    });

    it('should verify and accept high-quality response', async () => {
      const response = 'Accurate and verifiable information';
      const context = 'Context supporting the response';
      const result = await loop.execute(response, context);

      expect(result).toBeDefined();
      expect(result.verified).toBe(true);
      expect(result.iterations).toBeLessThanOrEqual(3);
    });

    it('should rectify low-quality response', async () => {
      const response = 'Potentially incorrect information';
      const context = 'Context that contradicts the response';
      const result = await loop.execute(response, context);

      expect(result).toBeDefined();
      expect(result.rectified).toBe(true);
      expect(result.iterations).toBeGreaterThan(1);
    });

    it('should respect max iterations limit', async () => {
      const response = 'Consistently incorrect information';
      const context = 'Context';
      const result = await loop.execute(response, context);

      expect(result).toBeDefined();
      expect(result.iterations).toBeLessThanOrEqual(3);
    });
  });

  describe('verifyResponse', () => {
    it('should verify factually correct response', async () => {
      const response = 'Water boils at 100°C at standard pressure.';
      const context = 'Physical properties of water';
      const result = await verifyResponse(response, context);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect errors in incorrect response', async () => {
      const response = 'Water boils at 0°C.';
      const context = 'Physical properties of water';
      const result = await verifyResponse(response, context);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty response', async () => {
      const response = '';
      const context = 'Some context';
      const result = await verifyResponse(response, context);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
    });
  });

  describe('rectifyResponse', () => {
    it('should rectify response with identified errors', async () => {
      const response = 'Incorrect factual statement';
      const errors = ['Factual error: incorrect information'];
      const context = 'Correct context';
      const result = await rectifyResponse(response, errors, context);

      expect(result).toBeDefined();
      expect(result.corrected).toBe(true);
      expect(result.newResponse).toBeDefined();
      expect(result.newResponse).not.toBe(response);
    });

    it('should provide explanation for corrections', async () => {
      const response = 'Statement with error';
      const errors = ['Error detected'];
      const context = 'Context';
      const result = await rectifyResponse(response, errors, context);

      expect(result).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(result.explanation.length).toBeGreaterThan(0);
    });

    it('should handle multiple errors', async () => {
      const response = 'Multiple incorrect statements';
      const errors = ['Error 1', 'Error 2', 'Error 3'];
      const context = 'Context';
      const result = await rectifyResponse(response, errors, context);

      expect(result).toBeDefined();
      expect(result.corrected).toBe(true);
      expect(result.corrections.length).toBeGreaterThanOrEqual(errors.length);
    });
  });

  describe('runVerificationLoop', () => {
    it('should complete verification loop successfully', async () => {
      const initialResponse = 'Factual statement';
      const context = 'Supporting context';
      const options = { maxIterations: 3 };

      const result = await runVerificationLoop(initialResponse, context, options);

      expect(result).toBeDefined();
      expect(result.finalResponse).toBeDefined();
      expect(result.verified).toBe(true);
      expect(result.iterationCount).toBeGreaterThanOrEqual(1);
    });

    it('should provide iteration history', async () => {
      const initialResponse = 'Statement requiring verification';
      const context = 'Context';
      const result = await runVerificationLoop(initialResponse, context);

      expect(result).toBeDefined();
      expect(result.history).toBeDefined();
      expect(Array.isArray(result.history)).toBe(true);
      expect(result.history.length).toBeGreaterThan(0);
    });

    it('should track confidence scores across iterations', async () => {
      const initialResponse = 'Response';
      const context = 'Context';
      const result = await runVerificationLoop(initialResponse, context);

      expect(result).toBeDefined();
      expect(result.confidenceScores).toBeDefined();
      expect(Array.isArray(result.confidenceScores)).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should handle end-to-end verification workflow', async () => {
      const loop = new VerifyRectifyLoop({
        maxIterations: 5,
        confidenceThreshold: 0.85,
      });

      const response = 'The Great Wall of China is visible from space.';
      const context = 'Common misconceptions about the Great Wall';

      const result = await loop.execute(response, context);

      expect(result).toBeDefined();
      expect(result.finalResponse).toBeDefined();
      expect(result.verified).toBeDefined();
    });

    it('should provide detailed verification report', async () => {
      const loop = new VerifyRectifyLoop();
      const response = 'Scientific claim';
      const context = 'Scientific context';

      const result = await loop.execute(response, context);

      expect(result.report).toBeDefined();
      expect(result.report.iterations).toBeDefined();
      expect(result.report.finalConfidence).toBeDefined();
    });
  });
});
