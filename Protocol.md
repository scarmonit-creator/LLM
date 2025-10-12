# Protocol.md — Unified Multi‑Agent Message Schema

## Goal
Standardize how agents exchange messages so you can swap models (Claude, GPT‑5, Gemini, DeepSeek, etc.) without glue code. One JSON envelope, always.

## Message Envelope (v1)

```json
{
  "protocol": "multiagent-1.0",
  "role": "agent|user|system|tool",
  "agent": {
    "id": "gpt5.plan",
    "name": "Planner",
    "model": "gpt-5",
    "version": "2025-10"
  },
  "timestamp": "2025-10-10T12:34:56Z",

  "intent": "plan|decompose|execute|route|retrieve|analyze|summarize|reflect|finalize|tool.call",
  "task": "Plain‑English description of what this message tries to do",
  "inputs": {
    "context": "Short, relevant context",
    "resources": [
      {"type": "url|file|db|tool", "id": "customers_db", "hint": "readonly"}
    ],
    "parameters": { "temperature": 0.2, "max_tokens": 8000 }
  },
  "content": {
    "type": "text|code|json|tool_result|error",
    "text": "Primary message content OR summary if type != text",
    "data": {}
  },

  "outputs": {
    "artifacts": [
      {"kind": "plan|code|query|patch|report|dataset", "name": "plan_v1", "uri": null, "inline": "optional payload"}
    ],
    "next_actions": [
      {"intent": "execute", "task": "Run step 1 with Tool.X", "args": {"selector": "#btn"}}
    ]
  },

  "confidence": {
    "score": 0.0,
    "rationale": "Why this is likely correct",
    "risks": ["ambiguous requirements", "insufficient permissions"]
  },

  "trace": {
    "parents": ["msg_001"],
    "id": "msg_002",
    "tags": ["checkout-flow", "hotfix"],
    "cost": {"input_tokens": 1234, "output_tokens": 456}
  }
}
```

### Field notes
- **intent**: the action this message advances (keep verbs consistent).
- **task**: one‑sentence purpose.
- **content**: normalized payload (even when returning code or tool results).
- **outputs.next_actions**: zero or more proposed next steps; another agent can pick these up.
- **confidence.score**: `0.0–1.0`.
- **trace**: lightweight lineage + accounting.

---

## Minimal TypeScript types (optional)

```ts
export type Intent =
  | "plan" | "decompose" | "execute" | "route"
  | "retrieve" | "analyze" | "summarize" | "reflect"
  | "finalize" | "tool.call";

export interface AgentRef { id: string; name: string; model: string; version?: string; }
export interface ResourceRef { type: "url"|"file"|"db"|"tool"; id: string; hint?: string; }

export interface Envelope {
  protocol: "multiagent-1.0";
  role: "agent"|"user"|"system"|"tool";
  agent?: AgentRef;
  timestamp: string;

  intent: Intent;
  task: string;
  inputs?: { context?: string; resources?: ResourceRef[]; parameters?: Record<string, unknown>; };

  content: { type: "text"|"code"|"json"|"tool_result"|"error"; text?: string; data?: unknown; };

  outputs?: {
    artifacts?: { kind: string; name: string; uri?: string|null; inline?: string; }[];
    next_actions?: { intent: Intent; task: string; args?: Record<string, unknown>; }[];
  };

  confidence?: { score: number; rationale?: string; risks?: string[]; };

  trace?: { parents?: string[]; id?: string; tags?: string[]; cost?: { input_tokens?: number; output_tokens?: number; }; };
}
```

---

## Canonical examples

### 1) Planner (GPT‑5) proposes steps
```json
{
  "protocol":"multiagent-1.0",
  "role":"agent",
  "agent":{"id":"gpt5.plan","name":"Planner","model":"gpt-5"},
  "timestamp":"2025-10-10T12:40:00Z",
  "intent":"plan",
  "task":"Outline steps to scrape prices and store in CSV",
  "inputs":{"context":"User sells items; wants daily price tracker"},
  "content":{"type":"text","text":"I propose a 3‑step plan."},
  "outputs":{
    "artifacts":[{"kind":"plan","name":"price_tracker_plan","inline":"1) Collect URLs 2) Scrape daily 3) Save CSV + notify"}],
    "next_actions":[
      {"intent":"decompose","task":"Turn plan into executable tasks"},
      {"intent":"retrieve","task":"Load target URL list from drive"}
    ]
  },
  "confidence":{"score":0.78,"rationale":"Common workflow; low complexity"}
}
```

### 2) Decomposer (Claude) emits granular tasks
```json
{
  "protocol":"multiagent-1.0",
  "role":"agent",
  "agent":{"id":"claude.decompose","name":"Decomposer","model":"claude-3.7-sonnet"},
  "timestamp":"2025-10-10T12:41:30Z",
  "intent":"decompose",
  "task":"Break plan into atomic steps",
  "content":{"type":"json","data":{
    "tasks":[
      {"id":"t1","desc":"Read urls.csv"},
      {"id":"t2","desc":"Fetch HTML per URL"},
      {"id":"t3","desc":"Parse price with selector"},
      {"id":"t4","desc":"Append to prices.csv"},
      {"id":"t5","desc":"Emit summary"}
    ]}},
  "outputs":{"next_actions":[{"intent":"execute","task":"Run t1..t5 via Tool.Scraper","args":{"batch":50}}]},
  "confidence":{"score":0.74}
}
```

### 3) Executor (Gemini) runs a tool and returns results
```json
{
  "protocol":"multiagent-1.0",
  "role":"tool",
  "agent":{"id":"gemini.exec","name":"Executor","model":"gemini-2.5-pro"},
  "timestamp":"2025-10-10T12:43:10Z",
  "intent":"tool.call",
  "task":"Scrape pages and extract prices",
  "content":{"type":"tool_result","data":{
    "ok": true,
    "rows_appended": 147,
    "csv_path": "data/prices.csv"
  }},
  "outputs":{"artifacts":[{"kind":"dataset","name":"prices_csv","uri":"data/prices.csv"}],
    "next_actions":[{"intent":"summarize","task":"Produce daily change summary"}]},
  "confidence":{"score":0.86,"rationale":"Selectors matched 93% of pages","risks":["anti‑bot on 7%"]},
  "trace":{"parents":["msg_002"],"id":"msg_003","cost":{"input_tokens":2100,"output_tokens":380}}
}
```

---

## Adapters (one file per model)

> These convert raw model I/O to/from the envelope. Keep them tiny and dumb.

### `adapters/claude.ts`
```ts
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
```

### `adapters/gpt5.ts`
```ts
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
```

### `adapters/gemini.ts`
```ts
export function toEnvelope(input: {goal: string, data?: unknown}) {
  return {
    protocol: "multiagent-1.0",
    role: "agent",
    agent: { id: "gemini.generic", name: "Gemini", model: "gemini-2.5-pro" },
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
```

---

## Routing rules (simple, works well)

- `plan|reflect|finalize` → GPT‑5 (planner/controller)
- `decompose|summarize|analyze` → Claude (structure + clarity)
- `execute|tool.call|retrieve` → Gemini (fast tools/search/code exec)
- If `confidence.score < 0.5` → auto‑route to `reflect` (different model) with `parents=[msg_id]`.

---

## Handshake / health message

```json
{
  "protocol":"multiagent-1.0",
  "role":"system",
  "agent":{"id":"orchestrator","name":"Mux","model":"n/a"},
  "timestamp":"2025-10-10T12:00:00Z",
  "intent":"reflect",
  "task":"Announce envelope support and capabilities",
  "content":{"type":"json","data":{"supports":["text","json","tool_result"],"max_tokens":16000}},
  "confidence":{"score":0.9}
}
```

---

## Drop‑in Orchestrator (Node, ~20 lines)

```ts
import { v4 as uuid } from "uuid";

type Agent = (env: any) => Promise<any>;
export function mux(rules: Record<string, Agent>) {
  return async function route(env: any) {
    const agentKey = env.intent in rules ? env.intent : "reflect";
    const agent = rules[agentKey];
    const out = await agent(env);
    return {
      ...out,
      protocol: "multiagent-1.0",
      trace: { ...(out.trace ?? {}), parents: [...(env.trace?.parents ?? []), env.trace?.id ?? env.trace ?? env.id ?? "unknown"], id: uuid() }
    };
  };
}
```

---

## Working tips
- Keep **intent verbs stable**. Your adapters stay trivial.
- Always set a **confidence score**; auto‑trigger a reflect pass when low.
- Use **outputs.next_actions** instead of long monologues—lets other agents pick up work.
- Log the **envelope** as your only audit format; it doubles as a replay record.

---

If you want, I can generate this as ready‑to‑use files (`Protocol.md` + `adapters/*.ts` + a tiny `orchestrator.ts`) in a zip or a repo‑ready folder.