/**
 * Ollama adapter for multi-agent protocol
 * Supports both local Ollama server and Ollama Cloud models
 */

export function toEnvelope(prompt: string, model: string = "llama3.2") {
  return {
    protocol: "multiagent-1.0",
    role: "agent",
    agent: {
      id: "ollama.generic",
      name: "Ollama",
      model: model,
      version: "2025-10"
    },
    timestamp: new Date().toISOString(),
    intent: "execute",
    task: prompt.slice(0, 160),
    content: { type: "text", text: prompt }
  };
}

export function fromEnvelope(e: any): string {
  // Ollama expects a simple prompt format
  const intent = e.intent || "execute";
  const task = e.task || "";
  const context = e?.inputs?.context || "";
  const content = e?.content?.text || JSON.stringify(e?.content?.data || {});

  let prompt = "";
  if (intent !== "execute") {
    prompt += `Task: ${intent}\n`;
  }
  if (task) {
    prompt += `${task}\n\n`;
  }
  if (context) {
    prompt += `Context: ${context}\n\n`;
  }
  prompt += content;

  return prompt;
}
