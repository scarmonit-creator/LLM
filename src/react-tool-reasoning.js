// ReAct-style reasoning with tool use capabilities
// Addresses Issue #18

class ReActAgent {
  constructor({ tools = {}, llm }) {
    this.tools = tools; // { name: async (input)=>string }
    this.llm = llm; // must support .generate(prompt, opts)
    this.maxSteps = 8;
  }

  async run(task) {
    let scratchpad = '';
    let observation = '';

    for (let step = 1; step <= this.maxSteps; step++) {
      const prompt = this.buildPrompt(task, scratchpad, observation);
      const action = await this.llm.generate(prompt, { temperature: 0.2, max_tokens: 256 });

      const parsed = this.parseAction(action);
      if (parsed.finish) {
        return { answer: parsed.finish, steps: step - 1, scratchpad };
      }

      if (!parsed.tool || !this.tools[parsed.tool]) {
        observation = `Unknown tool: ${parsed.tool || 'none'}`;
        scratchpad += `\nObservation: ${observation}`;
        continue;
      }

      try {
        const result = await this.tools[parsed.tool](parsed.input || '');
        observation = result?.toString() || '';
      } catch (e) {
        observation = `Tool error: ${e.message}`;
      }

      scratchpad += `\nThought: ${parsed.thought || ''}\nAction: ${parsed.tool}[${parsed.input}]\nObservation: ${observation}`;
    }

    return { answer: observation || 'Max steps reached', steps: this.maxSteps, scratchpad };
  }

  buildPrompt(task, scratchpad, observation) {
    return (
      'You are a ReAct agent. Use Thought/Action/Observation steps.\n' +
      `Available tools: ${Object.keys(this.tools).join(', ')}\n` +
      `Task: ${task}\n` +
      `${scratchpad}\n` +
      (observation ? `Latest observation: ${observation}\n` : '') +
      'Respond strictly in one of two formats:\n' +
      '1) Thought: ...\nAction: <tool>\nAction Input: <input>\n' +
      '2) Final Answer: <answer>'
    );
  }

  parseAction(text) {
    const finishMatch = text.match(/Final Answer:\s*([\s\S]*)$/i);
    if (finishMatch) {
      return { finish: finishMatch[1].trim() };
    }

    const toolMatch = text.match(/Action:\s*(.*)\nAction Input:\s*([\s\S]*)$/i);
    const thoughtMatch = text.match(/Thought:\s*([\s\S]*?)\nAction:/i);

    if (toolMatch) {
      return {
        tool: toolMatch[1].trim(),
        input: toolMatch[2].trim(),
        thought: thoughtMatch?.[1]?.trim(),
      };
    }

    return {};
  }
}

module.exports = ReActAgent;
