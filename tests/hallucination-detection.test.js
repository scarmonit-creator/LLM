import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectHallucination,
  calculateSemanticEntropy,
  performSelfCheckGPT,
  getHallucinationScore,
} from '../../src/hallucination-detection.js';

test('detectHallucination identifies high confidence responses', async () => {
  const response = 'The capital of France is Paris.';
  const context = 'France is a country in Europe.';

  const result = await detectHallucination(response, context);

  assert.ok(result);
  assert.equal(result.isHallucination, false);
  assert.ok(result.confidence > 0.7);
});

test('detectHallucination flags low confidence responses', async () => {
  const response = 'The capital of Mars is New York.';
  const context = 'Mars is a planet.';

  const result = await detectHallucination(response, context);

  assert.ok(result);
  assert.equal(result.isHallucination, true);
  assert.ok(result.confidence < 0.5);
});

test('detectHallucination handles empty responses', async () => {
  const response = '';
  const context = 'Some context';

  const result = await detectHallucination(response, context);

  assert.ok(result);
  assert.equal(result.isHallucination, true);
});

test('calculateSemanticEntropy returns low entropy for consistent responses', async () => {
  const responses = [
    'Paris is the capital of France',
    'The capital of France is Paris',
    'Paris, the capital city of France',
  ];

  const entropy = await calculateSemanticEntropy(responses);

  assert.ok(entropy >= 0);
  assert.ok(entropy < 1);
});

test('calculateSemanticEntropy returns high entropy for inconsistent responses', async () => {
  const responses = ['Paris is the capital', 'London is the capital', 'Berlin is the capital'];

  const entropy = await calculateSemanticEntropy(responses);

  assert.ok(entropy);
  assert.ok(entropy > 0.5);
});

test('calculateSemanticEntropy handles single response', async () => {
  const responses = ['Single response'];

  const entropy = await calculateSemanticEntropy(responses);

  assert.ok(typeof entropy === 'number');
  assert.equal(entropy, 0);
});

test('performSelfCheckGPT validates consistent samples', async () => {
  const response = 'The Earth orbits around the Sun.';
  const samples = [
    'Earth revolves around the Sun',
    'The Sun is at the center with Earth orbiting it',
    'Earth has an orbital path around the Sun',
  ];

  const result = await performSelfCheckGPT(response, samples);

  assert.ok(result);
  assert.ok(result.consistency > 0.7);
  assert.equal(result.isReliable, true);
});

test('performSelfCheckGPT detects inconsistent samples', async () => {
  const response = 'The Earth is flat.';
  const samples = [
    'The Earth is spherical',
    'Earth is round like a ball',
    'The planet Earth has a spherical shape',
  ];

  const result = await performSelfCheckGPT(response, samples);

  assert.ok(result);
  assert.ok(result.consistency < 0.5);
  assert.equal(result.isReliable, false);
});

test('getHallucinationScore returns valid score', async () => {
  const response = 'Test response';
  const context = 'Test context';

  const score = await getHallucinationScore(response, context);

  assert.ok(typeof score === 'number');
  assert.ok(score >= 0);
  assert.ok(score <= 1);
});

test('getHallucinationScore returns high score for likely hallucinations', async () => {
  const response = 'Completely made up information';
  const context = 'Real factual context';

  const score = await getHallucinationScore(response, context);

  assert.ok(score > 0.5);
});

test('hallucination detection workflow integrates all functions', async () => {
  const response = 'The Eiffel Tower is in Paris, France.';
  const context = 'Paris is the capital of France and home to many landmarks.';

  const detection = await detectHallucination(response, context);
  const score = await getHallucinationScore(response, context);

  assert.equal(detection.isHallucination, false);
  assert.ok(score < 0.5);
});
