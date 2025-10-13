// EVER-style Verify-Then-Rectify Loop
// Addresses Issue #17: Implement verify-then-rectify loop for real-time error correction

class VerifyRectifyLoop {
  constructor({ verifier, generator, maxIterations = 3, confidenceTarget = 0.9 }) {
    this.verifier = verifier; // function(output) => {valid: boolean, issues: [], confidence: 0-1}
    this.generator = generator; // function(prompt, context) => output
    this.maxIterations = maxIterations;
    this.confidenceTarget = confidenceTarget;
  }

  async run(prompt, context = {}) {
    let attempt = 0;
    let output = await this.generator(prompt, context);

    while (attempt < this.maxIterations) {
      const verdict = await this.verifier(output, context);

      if (verdict.valid && verdict.confidence >= this.confidenceTarget) {
        return { output, verdict, iterations: attempt + 1, rectified: attempt > 0 };
      }

      // Build rectification instructions
      const rectifyInstructions = this.buildRectifyInstructions(verdict);

      // Generate rectified output
      output = await this.generator(`${prompt}\n\nRevise to address: ${rectifyInstructions}`, {
        ...context,
        lastVerdict: verdict,
      });

      attempt++;
    }

    // Final verification
    const finalVerdict = await this.verifier(output, context);
    return { output, verdict: finalVerdict, iterations: attempt, rectified: attempt > 0 };
  }

  buildRectifyInstructions(verdict) {
    const parts = [];

    if (verdict.issues?.length) {
      parts.push(
        'Fix the following issues: ' + verdict.issues.map((i, idx) => `${idx + 1}. ${i}`).join(' ')
      );
    }

    if (verdict.missing?.length) {
      parts.push('Add missing elements: ' + verdict.missing.join(', '));
    }

    if (typeof verdict.confidence === 'number') {
      parts.push(`Increase confidence to at least ${this.confidenceTarget}.`);
    }

    return parts.join(' ');
  }
}

module.exports = VerifyRectifyLoop;
