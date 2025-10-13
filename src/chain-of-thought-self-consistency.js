// Chain-of-Thought with Self-Consistency
// Addresses Issue #19

class SelfConsistencyReasoner {
  constructor({ llm, samples = 8 }) {
    this.llm = llm; // .generate(prompt, opts)
    this.samples = samples;
  }

  async solve(problem, { delimiter = '---', temperature = 0.7 } = {}) {
    const cotPrompt = `${problem}\n\nThink step by step. Show your reasoning and final answer after ${delimiter}.`;
    const paths = [];

    for (let i = 0; i < this.samples; i++) {
      const out = await this.llm.generate(cotPrompt, { temperature, max_tokens: 512 });
      const { reasoning, answer } = this.split(out, delimiter);
      paths.push({ reasoning, answer, raw: out });
    }

    const majority = this.majorityAnswer(paths.map((p) => p.answer));
    const support = paths.filter((p) => p.answer === majority);
    return {
      answer: majority,
      confidence: support.length / this.samples,
      supportPaths: support,
      allPaths: paths,
    };
  }

  split(text, delimiter) {
    const idx = text.lastIndexOf(delimiter);
    if (idx === -1) return { reasoning: text.trim(), answer: text.trim() };
    const reasoning = text.slice(0, idx).trim();
    const answer = text.slice(idx + delimiter.length).trim();
    return { reasoning, answer };
  }

  majorityAnswer(answers) {
    const counts = new Map();
    for (const a of answers) counts.set(a, (counts.get(a) || 0) + 1);
    let best = null,
      bestN = -1;
    for (const [a, n] of counts)
      if (n > bestN) {
        best = a;
        bestN = n;
      }
    return best;
  }
}

module.exports = SelfConsistencyReasoner;
