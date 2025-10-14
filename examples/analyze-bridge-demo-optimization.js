#!/usr/bin/env node
/*
 analyze-bridge-demo-optimization.js

 Automated optimization analysis for examples/bridge-demo.js vs examples/bridge-demo-optimized.js
 Outputs: markdown report with findings and recommendations
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const EXAMPLES_DIR = path.join(ROOT, 'examples');
const FILE_ORIG = path.join(EXAMPLES_DIR, 'bridge-demo.js');
const FILE_OPT = path.join(EXAMPLES_DIR, 'bridge-demo-optimized.js');
const REPORT_PATH = path.join(EXAMPLES_DIR, 'bridge-demo-optimization-report.md');

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return '';
  }
}

function lines(s){return s.split(/\r?\n/);}

function simpleStats(code){
  const l = lines(code);
  const size = Buffer.byteLength(code, 'utf8');
  const comments = l.filter(x=>x.trim().startsWith('//') || x.trim().startsWith('/*')).length;
  const functions = (code.match(/function\s+|=>/g)||[]).length;
  const awaits = (code.match(/\bawait\b/g)||[]).length;
  const news = (code.match(/\bnew\s+[A-Za-z_]/g)||[]).length;
  const timers = (code.match(/setTimeout|setInterval|requestAnimationFrame/g)||[]).length;
  const eventListeners = (code.match(/addEventListener\(|on\w+\s*=\s*function|on\w+\s*=\s*\(/g)||[]).length;
  const tryCatch = (code.match(/try\s*{[\s\S]*?}\s*catch/g)||[]).length;
  const finallyBlocks = (code.match(/}\s*finally\s*{/g)||[]).length;
  const abortController = (code.match(/AbortController|AbortSignal/g)||[]).length;
  const fetches = (code.match(/\bfetch\(|axios\(|XMLHttpRequest\(/g)||[]).length;
  const workers = (code.match(/new\s+Worker\(|SharedWorker\(/g)||[]).length;
  const intervals = (code.match(/setInterval\(/g)||[]).length;
  const timeouts = (code.match(/setTimeout\(/g)||[]).length;
  const rafs = (code.match(/requestAnimationFrame\(/g)||[]).length;
  const mapSet = (code.match(/new\s+(Map|Set)\(/g)||[]).length;
  const largeArrays = (code.match(/new\s+(Array|Uint\w*Array)\(/g)||[]).length;
  const consoleCalls = (code.match(/console\.(log|error|warn|debug|info)\(/g)||[]).length;
  return {lines:l.length,size,comments,functions,awaits,news,timers,eventListeners,tryCatch,finallyBlocks,abortController,fetches,workers,intervals,timeouts,rafs,mapSet,largeArrays,consoleCalls};
}

function findPatterns(code){
  const issues = [];
  // Resource cleanup: intervals without clearInterval
  const intervalIds = [...code.matchAll(/const\s+(\w+)\s*=\s*setInterval\(/g)].map(m=>m[1]);
  for (const id of intervalIds){
    if (!new RegExp(`clearInterval\\s*\\(\\s*${id}\\s*\\)`).test(code)){
      issues.push({type:'resource', severity:'high', msg:`Interval ${id} set without clearInterval`});
    }
  }
  // Timeouts without clearTimeout reference (best-effort)
  const timeoutIds = [...code.matchAll(/const\s+(\w+)\s*=\s*setTimeout\(/g)].map(m=>m[1]);
  for (const id of timeoutIds){
    if (!new RegExp(`clearTimeout\\s*\\(\\s*${id}\\s*\\)`).test(code)){
      issues.push({type:'resource', severity:'medium', msg:`Timeout ${id} set without clearTimeout`});
    }
  }
  // addEventListener without removeEventListener
  const addEvts = [...code.matchAll(/(\w+)\.addEventListener\(\s*['"](\w+)['"]/g)];
  for (const m of addEvts){
    const obj = m[1]; const evt = m[2];
    if (!new RegExp(`${obj}\\.removeEventListener\\(\\s*['\"]${evt}['\"]`).test(code)){
      issues.push({type:'resource', severity:'medium', msg:`${obj}.addEventListener('${evt}') without matching removeEventListener`});
    }
  }
  // Fetch without abort or timeout
  const fetches = [...code.matchAll(/fetch\(/g)];
  if (fetches.length && !/AbortController|signal\s*:/.test(code)){
    issues.push({type:'network', severity:'medium', msg:'fetch used without AbortController/timeout'});
  }
  // Error handling
  if (/await\s+fetch\(/.test(code) && !/try\s*{[\s\S]*?await\s+fetch\([\s\S]*?}\s*catch/.test(code)){
    issues.push({type:'error', severity:'medium', msg:'await fetch without try/catch'});
  }
  // Console noise in production
  if (/console\.(log|debug)\(/.test(code)){
    issues.push({type:'production', severity:'low', msg:'Console logging present; consider gating for production'});
  }
  // Unhandled promise rejections
  const thenWithoutCatch = [...code.matchAll(/\.then\(/g)].length && !/\.catch\(/.test(code);
  if (thenWithoutCatch){
    issues.push({type:'error', severity:'high', msg:'Promises with .then() but no .catch() detected'});
  }
  // Global variables
  if (/\bvar\s+/.test(code)){
    issues.push({type:'quality', severity:'low', msg:'Use let/const instead of var'});
  }
  return issues;
}

function diffStats(a, b){
  const out = {};
  for (const k of Object.keys(a)){
    out[k] = {orig:a[k], opt:b[k], delta:(b[k]-a[k])};
  }
  return out;
}

function recommendFromIssues(issues){
  const recs = [];
  for (const it of issues){
    if (it.type==='resource' && /Interval/.test(it.msg)){
      recs.push('Track interval IDs and clear them on teardown/unload.');
    } else if (it.type==='resource' && /addEventListener/.test(it.msg)){
      recs.push('Store event listener refs and remove them during cleanup.');
    } else if (it.type==='network'){
      recs.push('Wrap fetch with AbortController and set a timeout.');
    } else if (it.type==='error'){
      recs.push('Use try/catch around async calls and .catch() on Promises.');
    } else if (it.type==='production'){
      recs.push('Gate console logs with env checks or a debug flag.');
    } else if (it.type==='quality'){
      recs.push('Replace var with let/const and enable strict linting.');
    }
  }
  return [...new Set(recs)];
}

function generateReport(orig, opt){
  const statsOrig = simpleStats(orig);
  const statsOpt = simpleStats(opt);
  const issuesOrig = findPatterns(orig);
  const issuesOpt = findPatterns(opt);
  const diff = diffStats(statsOrig, statsOpt);
  const recs = [...new Set([...recommendFromIssues(issuesOrig), ...recommendFromIssues(issuesOpt)])];

  function sec(title){return `\n\n## ${title}\n`;}
  let md = `# Bridge Demo Optimization Analysis\n\nCompared files: examples/bridge-demo.js (orig) vs examples/bridge-demo-optimized.js (opt)\nGenerated: ${new Date().toISOString()}\n`;

  md += sec('Summary stats') + '``' + '`
' + JSON.stringify({orig:statsOrig,opt:statsOpt,diff}, null, 2) + '
' + '``' + '`
';
  md += sec('Detected issues (original)') + (issuesOrig.length? issuesOrig.map(i=>`- [${i.severity}] ${i.type}: ${i.msg}`).join('\n'):'- None');
  md += sec('Detected issues (optimized)') + (issuesOpt.length? issuesOpt.map(i=>`- [${i.severity}] ${i.type}: ${i.msg}`).join('\n'):'- None');
  md += sec('Recommendations') + (recs.length? recs.map(r=>`- ${r}`).join('\n'):'- None');
  md += sec('Production readiness checklist') + [
    '- Add AbortController to network calls with timeouts and retries',
    '- Centralize error handling and user-safe messages',
    '- Ensure cleanup on unload: clear timers, remove listeners, abort in-flight work',
    '- Minimize console noise; use structured logger',
    '- Add ESLint/Prettier and CI checks',
    '- Add performance marks/measures for critical paths'
  ].join('\n');

  return md;
}

function writeReport(md){
  fs.writeFileSync(REPORT_PATH, md, 'utf8');
}

function main(){
  const orig = readFileSafe(FILE_ORIG);
  const opt = readFileSafe(FILE_OPT);
  if (!orig || !opt){
    console.error('Unable to read both files. Ensure paths are correct.');
  }
  const md = generateReport(orig, opt);
  try { writeReport(md); console.log('Report written to', REPORT_PATH); } catch(e){ console.error('Failed to write report', e); }
}

if (require.main === module) main();
