export function toEnvelope(prompt: string) {
  return {
    protocol: "multiagent-1.0",
    role: "agent",
    agent: { id: "claude.generic", name: "Claude", model: "claude-3.7-sonnet" },
    timestamp: new Date().toISOString(),
    intent: "analyze",
    task: prompt.slice(0, 160),
    content: { type: "text", text: prompt }
  };
}

export function fromEnvelope(e: any): string {
  // Claude wants a compact, role‑labeled prompt
  return `[INTENT:${e.intent}] [TASK:${e.task}]\nCONTEXT:\n${e?.inputs?.context ?? ""}\nCONTENT:\n${e?.content?.text ?? JSON.stringify(e?.content?.data ?? {})}`;
}