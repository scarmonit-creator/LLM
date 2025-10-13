export function toEnvelope(input: {goal: string, data?: unknown}) {
  return {
    protocol: "multiagent-1.0",
    role: "agent",
    agent: { id: "gemini.generic", name: "Gemini", model: "gemini-1.5-pro" },
    timestamp: new Date().toISOString(),
    intent: "execute",
    task: input.goal,
    content: { type: "json", data: input.data ?? {} }
  };
}

export function fromEnvelope(e: any): string {
  // Gemini likes concise tool‑centric prompts
  return `Goal: ${e.task}\nIntent: ${e.intent}\nContext: ${e?.inputs?.context ?? "n/a"}\nData:${JSON.stringify(e?.content?.data ?? {}, null, 2)}`;
}
