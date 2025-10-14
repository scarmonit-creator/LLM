// Agent Registry and Capability Service
// Provides registration, capability lookup, and simple load-based routing

export class AgentRegistry {
  constructor() {
    this.agents = new Map(); // id -> meta { id, role, skills:Set, intents:Set, load }
    this.roles = new Map(); // role -> Set(agentId)
  }

  register(meta) {
    const id = meta.id;
    const role = meta.role || 'agent';
    const skills = new Set(meta.skills || []);
    const intents = new Set(meta.intents || []);
    const load = 0;

    this.agents.set(id, { id, role, skills, intents, load });
    if (!this.roles.has(role)) this.roles.set(role, new Set());
    this.roles.get(role).add(id);
    return this.agents.get(id);
  }

  unregister(id) {
    const meta = this.agents.get(id);
    if (!meta) return false;
    this.agents.delete(id);
    const set = this.roles.get(meta.role);
    if (set) set.delete(id);
    return true;
  }

  setLoad(id, load) {
    const meta = this.agents.get(id);
    if (meta) meta.load = load;
  }

  get(id) {
    return this.agents.get(id) || null;
  }

  list() {
    return Array.from(this.agents.values()).map(a => ({
      id: a.id,
      role: a.role,
      skills: Array.from(a.skills),
      intents: Array.from(a.intents),
      load: a.load
    }));
  }

  findByRole(role) {
    const ids = this.roles.get(role);
    if (!ids || ids.size === 0) return [];
    return Array.from(ids).map(id => this.agents.get(id)).filter(Boolean);
  }

  // Choose best agent by skill overlap and lowest load
  choose(roleOrIds, requiredSkills = []) {
    const pool = Array.isArray(roleOrIds)
      ? roleOrIds.map(id => this.agents.get(id)).filter(Boolean)
      : this.findByRole(roleOrIds);

    if (pool.length === 0) return null;

    const skills = new Set(requiredSkills);
    let best = null;
    let bestScore = -Infinity;

    for (const agent of pool) {
      let score = 0;
      for (const s of skills) if (agent.skills.has(s)) score += 10;
      score -= agent.load; // prefer lower load
      if (score > bestScore) {
        best = agent;
        bestScore = score;
      }
    }
    return best;
  }
}

// Loop prevention and deduplication helper
export class TaskGuard {
  constructor({ maxHops = 5, windowSize = 1000 } = {}) {
    this.maxHops = maxHops;
    this.windowSize = windowSize;
    this.seen = new Set(); // key: taskId:round:from:to
    this.queue = [];
  }

  makeKey({ taskId, round = 0, from, to }) {
    return `${taskId || 'na'}:${round}:${from || 'na'}:${to || 'na'}`;
  }

  allow(envelope) {
    const hop = Number(envelope.trace?.hop || 0);
    if (hop > this.maxHops) return false;

    const key = this.makeKey({
      taskId: envelope.taskId,
      round: envelope.trace?.round || 0,
      from: envelope.from,
      to: envelope.to
    });

    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.queue.push(key);
    if (this.queue.length > this.windowSize) {
      const old = this.queue.shift();
      this.seen.delete(old);
    }
    return true;
  }
}
