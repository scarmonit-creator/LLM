import { describe, it, expect } from 'vitest';
import {
  detectHallucination,
  calculateSemanticEntropy,
  performSelfCheckGPT,
  getHallucinationScore,
} from '../src/hallucination-detection.js';

describe('Hallucination Detection Module', () => {
  describe('detectHallucination', () => {
    it('should detect high confidence responses as non-hallucination', async () => {
      const response = 'The capital of France is Paris.';
      const context = 'France is a country in Europe.';

      const result = await detectHallucination(response, context);

      expect(result).toBeDefined();
      expect(result.isHallucination).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect low confidence responses as potential hallucination', async () => {
      const response = 'The capital of Mars is New York.';
      const context = 'Mars is a planet.';

      const result = await detectHallucination(response, context);

      expect(result).toBeDefined();
      expect(result.isHallucination).toBe(true);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle empty responses gracefully', async () => {
      const response = '';
      const context = 'Some context';

      const result = await detectHallucination(response, context);

      expect(result).toBeDefined();
      expect(result.isHallucination).toBe(true);
    });
  });

  describe('calculateSemanticEntropy', () => {
    it('should calculate entropy for consistent responses', async () => {
      const responses = [
        'Paris is the capital of France',
        'The capital of France is Paris',
        'Paris, the capital city of France',
      ];

      const entropy = await calculateSemanticEntropy(responses);

      expect(entropy).toBeDefined();
      expect(entropy).toBeGreaterThanOrEqual(0);
      expect(entropy).toBeLessThan(1);
    });

    it('should calculate higher entropy for inconsistent responses', async () => {
      const responses = ['Paris is the capital', 'London is the capital', 'Berlin is the capital'];

      const entropy = await calculateSemanticEntropy(responses);

      expect(entropy).toBeDefined();
      expect(entropy).toBeGreaterThan(0.5);
    });

    it('should handle single response', async () => {
      const responses = ['Single response'];

      const entropy = await calculateSemanticEntropy(responses);

      expect(entropy).toBeDefined();
      expect(entropy).toBe(0);
    });
  });

  describe('performSelfCheckGPT', () => {
    it('should perform self-check on generated response', async () => {
      const response = 'The Earth orbits around the Sun.';
      const samples = [
        'Earth revolves around the Sun',
        'The Sun is at the center with Earth orbiting it',
        'Earth has an orbital path around the Sun',
      ];

      const result = await performSelfCheckGPT(response, samples);

      expect(result).toBeDefined();
      expect(result.consistency).toBeGreaterThan(0.7);
      expect(result.isReliable).toBe(true);
    });

    it('should detect inconsistent samples', async () => {
      const response = 'The Earth is flat.';
      const samples = [
        'The Earth is spherical',
        'Earth is round like a ball',
        'The planet Earth has a spherical shape',
      ];

      const result = await performSelfCheckGPT(response, samples);

      expect(result).toBeDefined();
      expect(result.consistency).toBeLessThan(0.5);
      expect(result.isReliable).toBe(false);
    });
  });

  describe('getHallucinationScore', () => {
    it('should return a valid hallucination score', async () => {
      const response = 'Test response';
      const context = 'Test context';

      const score = await getHallucinationScore(response, context);

      expect(score).toBeDefined();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return high score for likely hallucinations', async () => {
      const response = 'Completely made up information';
      const context = 'Real factual context';

      const score = await getHallucinationScore(response, context);

      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe('Integration tests', () => {
    it('should handle complete hallucination detection workflow', async () => {
      const response = 'The Eiffel Tower is in Paris, France.';
      const context = 'Paris is the capital of France and home to many landmarks.';

      const detection = await detectHallucination(response, context);
      const score = await getHallucinationScore(response, context);

      expect(detection.isHallucination).toBe(false);
      expect(score).toBeLessThan(0.5);
    });
  });
});
