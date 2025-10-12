export function toEnvelope(system: string, user: string) {
  return {
    protocol: "multiagent-1.0",
    role: "agent",
    agent: { id: "gpt5.generic", name: "GPT‑5", model: "gpt-5" },
    timestamp: new Date().toISOString(),
    intent: "plan",
    task: user.slice(0, 160),
    inputs: { context: system },
    content: { type: "text", text: user }
  };
}

export function fromEnvelope(e: any) {
  return {
    system: `You speak Envelope v1. Intent=${e.intent}. Return JSON only.`,
    user: JSON.stringify({ task: e.task, context: e?.inputs?.context ?? null })
  };
}