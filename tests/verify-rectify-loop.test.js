import test from 'node:test';
import assert from 'node:assert/strict';
import VerifyRectifyLoop, {
  ClaimVerifier,
  verifyResponse,
  rectifyResponse,
  runVerificationLoop,
} from '../../src/verify-rectify-loop.js';

test('ClaimVerifier basic verification flow', async () => {
  const verifier = new ClaimVerifier();
  const verdict = await verifier.verify('Paris is the capital of France.', {
    evidence: [{ content: 'Paris is the capital of France.' }],
  });
  assert.ok(verdict);
  assert.ok(typeof verdict.valid === 'boolean');
  assert.ok(Array.isArray(verdict.issues));
});

test('VerifyRectifyLoop.run iterates with generator fallback', async () => {
  let generated = 0;
  const loop = new VerifyRectifyLoop({
    generator: async () => {
      generated += 1;
      return generated === 1 ? 'Initial claim' : 'Corrected claim with citation [1]';
    },
    confidenceTarget: 0.5,
    maxIterations: 2,
  });
  const result = await loop.run('Explain a fact', { evidence: [{ content: 'Supporting fact' }] });
  assert.ok(result);
  assert.ok('output' in result);
  assert.ok(Array.isArray(result.history));
  assert.ok(result.history.length >= 1);
});

test('verifyResponse helper delegates to verifier', async () => {
  const verifier = new ClaimVerifier();
  const verdict = await verifyResponse('Test statement', { evidence: [] }, verifier);
  assert.ok(verdict);
  assert.ok('issues' in verdict);
});

test('rectifyResponse helper composes new prompt', async () => {
  const generator = async (_prompt, _context) => 'Rectified output';
  const response = await rectifyResponse('Prompt', {}, generator, 'Fix issues');
  assert.equal(response, 'Rectified output');
});

test('runVerificationLoop helper wraps VerifyRectifyLoop', async () => {
  const result = await runVerificationLoop(
    'Prompt',
    {},
    {
      generator: async () => 'Initial output',
      confidenceTarget: 0.4,
      maxIterations: 1,
    }
  );
  assert.ok(result);
  assert.ok('output' in result);
});
