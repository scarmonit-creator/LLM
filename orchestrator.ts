import { randomUUID } from "crypto";

/**
 * Mux takes a map of intent names to agent functions and returns a router.
 * Each agent function should accept an envelope and return a Promise of a response envelope.
 * If no matching intent exists in the rules map, the router will fallback to the
 * `reflect` intent.
 */
type Agent = (env: any) => Promise<any>;

export function mux(rules: Record<string, Agent>) {
  return async function route(env: any) {
    const agentKey = env.intent in rules ? env.intent : "reflect";
    const agent = rules[agentKey];
    const out = await agent(env);
    return {
      ...out,
      protocol: "multiagent-1.0",
      trace: {
        ...(out.trace ?? {}),
        parents: [
          ...(env.trace?.parents ?? []),
          env.trace?.id ?? env.trace ?? env.id ?? "unknown"
        ],
        id: randomUUID()
      }
    };
  };
}