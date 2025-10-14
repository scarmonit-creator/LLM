#!/usr/bin/env node
/*
  perry-jest.js — Flaky interaction detector for Jest tests (inspired by Chromium's perry.py)

  Strategy:
  1) Discover test names via `jest --listTests --json` (or via --json + testResults) and optional grep filters
  2) Generate bounded pairs (A,B) and run them in alternating orders A→B and B→A
  3) Repeat N times with shuffling to expose order-dependent flakes
  4) Mark a pair as flaky if any combined run fails or produces inconsistent results
  5) Output a JSON report and a human summary for CI artifacts

  Usage:
  node scripts/perry-jest.js \
    --pattern "tests/**/*.test.(js|ts)" \
    --maxPairs 200 \
    --repeats 3 \
    --shards 4 --shardIndex 0 \
    --grep "a2a|bridge" \
    --timeout 300000

  Exit codes:
  0: no flaky interactions detected
  1: flaky interactions detected
  2: execution error
*/

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    pattern: 'tests/**/*.test.*',
    grep: '',
    maxPairs: 200,
    repeats: 3,
    shards: 1,
    shardIndex: 0,
    timeout: 300000,
    outDir: 'perry-results',
    jestBin: 'npx',
    jestArgs: ['jest'],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i];
    if (a === '--pattern') opts.pattern = next();
    else if (a === '--grep') opts.grep = next();
    else if (a === '--maxPairs') opts.maxPairs = Number(next());
    else if (a === '--repeats') opts.repeats = Number(next());
    else if (a === '--shards') opts.shards = Number(next());
    else if (a === '--shardIndex') opts.shardIndex = Number(next());
    else if (a === '--timeout') opts.timeout = Number(next());
    else if (a === '--outDir') opts.outDir = next();
    else if (a === '--jestBin') opts.jestBin = next();
  }
  return opts;
}

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', timeout: opts.timeout || 0 });
  return { code: res.status ?? 0, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function discoverTests(opts) {
  // Try JSON results for richer names; fallback to listTests
  const list = run(opts.jestBin, [...opts.jestArgs, '--listTests', '--json', opts.pattern]);
  if (list.code !== 0) throw new Error('Failed to list tests: ' + list.stderr);
  let files = [];
  try { files = JSON.parse(list.stdout); } catch { files = list.stdout.trim().split('\n').filter(Boolean); }
  // Optionally filter by grep on path
  if (opts.grep) files = files.filter(f => f.match(new RegExp(opts.grep, 'i')));
  return files;
}

function cartesianPairs(items) {
  const pairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

function shard(items, shards, shardIndex) {
  if (shards <= 1) return items;
  return items.filter((_, idx) => idx % shards === shardIndex);
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function runPair(opts, a, b) {
  // Execute A then B, then B then A; any failure => flaky
  const orders = shuffle([[a, b], [b, a]]);
  for (const order of orders) {
    const name = order.map(x => path.basename(x)).join('→');
    const res = run(opts.jestBin, [...opts.jestArgs, '--runTestsByPath', ...order], { timeout: opts.timeout });
    const ok = res.code === 0;
    if (!ok) {
      return { ok: false, name, logs: res.stdout.slice(-10000), err: res.stderr.slice(-10000) };
    }
  }
  return { ok: true };
}

function main() {
  try {
    const opts = parseArgs();
    ensureDir(opts.outDir);
    const id = randomUUID();
    const files = discoverTests(opts);
    if (files.length < 2) {
      console.log('Not enough tests to analyze.');
      process.exit(0);
    }
    let pairs = cartesianPairs(files);
    shuffle(pairs);
    if (opts.maxPairs && pairs.length > opts.maxPairs) pairs = pairs.slice(0, opts.maxPairs);
    pairs = shard(pairs, opts.shards, opts.shardIndex);

    const failures = [];
    for (const [a, b] of pairs) {
      for (let r = 0; r < opts.repeats; r++) {
        const res = runPair(opts, a, b);
        if (!res.ok) {
          failures.push({ a, b, attempt: r + 1, name: res.name, logs: res.logs, err: res.err });
          break;
        }
      }
    }

    const report = { id, timestamp: new Date().toISOString(), opts, totalPairs: pairs.length, failuresCount: failures.length, failures };
    const outJson = path.join(opts.outDir, `perry-jest-report-${id}.json`);
    writeFileSync(outJson, JSON.stringify(report, null, 2));

    const summary = [
      `Perry-Jest Report ${id}`,
      `Pairs tested: ${pairs.length}`,
      `Failures: ${failures.length}`,
      failures.slice(0, 10).map(f => `- ${path.basename(f.a)} ↔ ${path.basename(f.b)} (attempt ${f.attempt})`).join('\n')
    ].join('\n');
    writeFileSync(path.join(opts.outDir, `perry-jest-summary-${id}.txt`), summary);

    console.log(summary);
    process.exit(failures.length ? 1 : 0);
  } catch (e) {
    console.error('perry-jest error:', e?.message || e);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}
