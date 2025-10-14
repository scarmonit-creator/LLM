#!/usr/bin/env node
"use strict";
/**
 * generate-deployment-report.js
 *
 * Comprehensive deployment reporting for the A2A Self-Test Framework.
 * - Aggregates system health, performance metrics, deployment status, and A2A agent connectivity
 * - Designed for CI/CD usage and local runs
 * - Outputs JSON and Markdown, with optional GitHub Actions summary and JUnit XML
 *
 * Usage:
 *   node scripts/generate-deployment-report.js \
 *     --out ./reports \
 *     --format json,md \
 *     --from-ci $GITHUB_ACTIONS \
 *     --server-url http://localhost:8080 \
 *     --agents registry://local or comma list of agents
 *
 * Exit codes:
 *   0 = success (report generated)
 *   1 = partial (report generated with warnings)
 *   2 = failure (critical checks failed or unable to generate report)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");

// Attempt optional deps only if available
let fetchFn = null;
try {
  fetchFn = global.fetch || require("node-fetch");
} catch (_) {
  // Will fallback to curl if needed
}

function parseArgs(argv) {
  const args = {
    out: process.env.REPORT_OUT || "./reports",
    format: (process.env.REPORT_FORMAT || "json,md").split(",").map(s => s.trim()).filter(Boolean),
    fromCi: String(process.env.GITHUB_ACTIONS || "false").toLowerCase() === "true",
    serverUrl: process.env.A2A_SERVER_URL || "http://localhost:8080",
    agents: (process.env.A2A_AGENTS || "").split(",").map(s => s.trim()).filter(Boolean),
    junit: String(process.env.REPORT_JUNIT || "false").toLowerCase() === "true",
    summary: String(process.env.GITHUB_STEP_SUMMARY || ""),
    timeoutMs: Number(process.env.REPORT_TIMEOUT_MS || 10000),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--format") args.format = argv[++i].split(",").map(s => s.trim()).filter(Boolean);
    else if (a === "--from-ci") args.fromCi = ["1","true","yes"].includes(String(argv[++i]).toLowerCase());
    else if (a === "--server-url") args.serverUrl = argv[++i];
    else if (a === "--agents") args.agents = argv[++i].split(",").map(s => s.trim()).filter(Boolean);
    else if (a === "--junit") args.junit = ["1","true","yes"].includes(String(argv[++i]).toLowerCase());
    else if (a === "--timeout") args.timeoutMs = Number(argv[++i]);
  }
  return args;
}

function safeMkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function nowIso() { return new Date().toISOString(); }

function tryExec(cmd) {
  try {
    const out = execSync(cmd, { stdio: ["ignore","pipe","pipe"], encoding: "utf8" });
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, error: e.message.trim() };
  }
}

async function httpGetJson(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (fetchFn) {
      const res = await fetchFn(url, { signal: controller.signal, headers: { "accept": "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }
    // Fallback to curl
    const { ok, out, error } = tryExec(`curl -fsSL --max-time ${Math.ceil(timeoutMs/1000)} ${JSON.stringify(url)}`);
    if (!ok) throw new Error(error || "curl failed");
    return JSON.parse(out);
  } finally {
    clearTimeout(t);
  }
}

function collectSystemInfo() {
  const mem = process.memoryUsage();
  const load = os.loadavg();
  const cpus = os.cpus() || [];
  return {
    timestamp: nowIso(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    node: process.version,
    cpu: {
      count: cpus.length,
      model: cpus[0] && cpus[0].model,
    },
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
    },
    loadavg: { "1m": load[0], "5m": load[1], "15m": load[2] },
    uptimeSec: os.uptime(),
    ci: {
      isCI: !!process.env.CI || !!process.env.GITHUB_ACTIONS,
      provider: process.env.GITHUB_ACTIONS ? "github" : (process.env.CI ? "generic" : "local"),
      github: {
        runId: process.env.GITHUB_RUN_ID || null,
        runNumber: process.env.GITHUB_RUN_NUMBER || null,
        ref: process.env.GITHUB_REF || null,
        sha: process.env.GITHUB_SHA || null,
        actor: process.env.GITHUB_ACTOR || null,
        workflow: process.env.GITHUB_WORKFLOW || null,
        job: process.env.GITHUB_JOB || null,
      }
    }
  };
}

function collectGitInfo() {
  const branch = tryExec("git rev-parse --abbrev-ref HEAD");
  const sha = tryExec("git rev-parse HEAD");
  const status = tryExec("git status --porcelain");
  const remote = tryExec("git remote -v");
  return {
    branch: branch.ok ? branch.out : null,
    sha: sha.ok ? sha.out : null,
    dirty: status.ok ? status.out.length > 0 : null,
    remote: remote.ok ? remote.out : null,
  };
}

async function collectA2AStatus({ serverUrl, timeoutMs }) {
  const endpoints = [
    "/health",
    "/status",
    "/metrics",
    "/agents",
    "/connectivity",
  ];
  const results = {};
  for (const ep of endpoints) {
    const url = serverUrl.replace(/\/$/, "") + ep;
    try {
      results[ep] = await httpGetJson(url, timeoutMs);
    } catch (e) {
      results[ep] = { error: true, message: e.message };
    }
  }
  return results;
}

function deriveSummary(report) {
  const issues = [];
  const { system, git, a2a } = report;

  // Simple heuristics
  if (system.loadavg["1m"] > Math.max(1, system.cpu.count - 0.5)) {
    issues.push({ level: "warn", area: "system", message: `High CPU load: ${system.loadavg["1m"].toFixed(2)}` });
  }
  const memFreePct = system.memory.free / system.memory.total;
  if (memFreePct < 0.1) {
    issues.push({ level: "warn", area: "system", message: `Low free memory: ${(memFreePct*100).toFixed(1)}%` });
  }

  if (a2a["/health"] && a2a["/health"].status && a2a["/health"].status !== "ok") {
    issues.push({ level: "error", area: "a2a", message: `Health endpoint not ok: ${a2a["/health"].status}` });
  }

  if (a2a["/connectivity"] && a2a["/connectivity"].agents) {
    const down = (a2a["/connectivity"].agents || []).filter(a => a.status !== "online");
    if (down.length) {
      issues.push({ level: "error", area: "agents", message: `${down.length} agents offline: ${down.map(d=>d.name).join(", ")}` });
    }
  }

  return {
    errors: issues.filter(i => i.level === "error"),
    warnings: issues.filter(i => i.level === "warn"),
    ok: issues.filter(i => i.level === "error").length === 0,
  };
}

function toMarkdown(report) {
  const { system, git, a2a, summary } = report;
  const md = [];
  md.push(`# Deployment Report`);
  md.push(`Generated: ${report.generated}`);
  md.push(``);
  md.push(`## Git`);
  md.push(`- Branch: ${git.branch}`);
  md.push(`- SHA: ${git.sha}`);
  md.push(`- Dirty: ${git.dirty}`);
  md.push(``);
  md.push(`## System`);
  md.push(`- Node: ${system.node}`);
  md.push(`- Platform: ${system.platform} ${system.release} (${system.arch})`);
  md.push(`- CPU: ${system.cpu.count} x ${system.cpu.model}`);
  md.push(`- Loadavg: 1m=${system.loadavg["1m"].toFixed(2)} 5m=${system.loadavg["5m"].toFixed(2)} 15m=${system.loadavg["15m"].toFixed(2)}`);
  md.push(`- Memory: rss=${system.memory.rss} heapUsed=${system.memory.heapUsed} free=${system.memory.free}/${system.memory.total}`);
  md.push(``);
  md.push(`## A2A Endpoints`);
  for (const [k, v] of Object.entries(a2a)) {
    md.push(`- ${k}: ${v && v.error ? `ERROR: ${v.message}` : "ok"}`);
  }
  md.push(``);
  md.push(`## Summary`);
  md.push(`- OK: ${summary.ok}`);
  if (summary.warnings.length) md.push(`- Warnings: ${summary.warnings.map(w=>w.message).join("; ")}`);
  if (summary.errors.length) md.push(`- Errors: ${summary.errors.map(e=>e.message).join("; ")}`);
  md.push("");
  return md.join("\n");
}

function toJUnit(report) {
  const testcases = [];
  const suiteName = "deployment-report";

  // Health as testcase
  const health = report.a2a["/health"];
  if (health && !health.error) {
    const ok = health.status === "ok" || health.ok === true;
    testcases.push({ name: "a2a-health", ok, message: ok ? "" : `status: ${health.status}` });
  } else {
    testcases.push({ name: "a2a-health", ok: false, message: health ? health.message : "no response" });
  }

  // Connectivity
  const conn = report.a2a["/connectivity"];
  if (conn && !conn.error) {
    const down = (conn.agents || []).filter(a => a.status !== "online");
    testcases.push({ name: "a2a-connectivity", ok: down.length === 0, message: down.length ? `${down.length} offline` : "" });
  } else {
    testcases.push({ name: "a2a-connectivity", ok: false, message: conn ? conn.message : "no response" });
  }

  const failures = testcases.filter(t => !t.ok).length;
  const xml = [];
  xml.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  xml.push(`<testsuite name="${suiteName}" tests="${testcases.length}" failures="${failures}">`);
  for (const tc of testcases) {
    xml.push(`  <testcase name="${tc.name}">`);
    if (!tc.ok) xml.push(`    <failure message=${JSON.stringify(tc.message)}/>\n`);
    xml.push(`  </testcase>`);
  }
  xml.push(`</testsuite>`);
  return xml.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  const started = Date.now();
  let exitCode = 0;

  try {
    safeMkdirp(args.out);

    const system = collectSystemInfo();
    const git = collectGitInfo();
    const a2a = await collectA2AStatus({ serverUrl: args.serverUrl, timeoutMs: args.timeoutMs });

    const report = {
      generated: nowIso(),
      durationMs: null,
      system,
      git,
      a2a,
    };

    const summary = deriveSummary(report);
    report.summary = summary;
    report.durationMs = Date.now() - started;

    // Write JSON
    if (args.format.includes("json")) {
      const jsonPath = path.join(args.out, "deployment-report.json");
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
      console.log(`Wrote ${jsonPath}`);
    }

    // Write Markdown
    if (args.format.includes("md")) {
      const mdPath = path.join(args.out, "deployment-report.md");
      fs.writeFileSync(mdPath, toMarkdown(report));
      console.log(`Wrote ${mdPath}`);
    }

    // JUnit if requested
    if (args.junit) {
      const junitPath = path.join(args.out, "deployment-report.junit.xml");
      fs.writeFileSync(junitPath, toJUnit(report));
      console.log(`Wrote ${junitPath}`);
    }

    // GitHub Actions summary if available
    if (args.summary) {
      try {
        fs.appendFileSync(args.summary, `\n## Deployment Report\n\n${toMarkdown(report)}\n`);
      } catch (e) {
        console.warn("Could not append to GITHUB_STEP_SUMMARY:", e.message);
      }
    }

    if (!summary.ok) {
      // errors present
      exitCode = 1; // partial success to not hard fail by default
      if (args.fromCi) {
        // In CI, we prefer non-zero if errors
        exitCode = 2;
      }
    }

  } catch (e) {
    console.error("Failed to generate deployment report:", e.stack || e.message);
    exitCode = 2;
  } finally {
    const elapsed = Date.now() - started;
    console.log(`Report generation finished in ${elapsed}ms`);
    process.exitCode = exitCode;
  }
}

if (require.main === module) {
  main();
}
