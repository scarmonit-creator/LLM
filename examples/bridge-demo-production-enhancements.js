"use strict";
/* bridge-demo-production-enhancements.js
   Production enhancement helpers for bridge demos:
   - Resource tracking/cleanup (timers, listeners)
   - Safe fetch with AbortController + timeout
   - Retry with backoff + jitter
   - Circuit breaker utility
   - Structured logger with levels
   - Wrap run loop with lifecycle management
*/

const DEFAULT_TIMEOUT_MS = Number(process.env.GLOBAL_TIMEOUT_MS || 30000);

const active = {
  intervals: new Set(),
  timeouts: new Set(),
  listeners: [],
};

const _setInterval = global.setInterval.bind(global);
const _clearInterval = global.clearInterval.bind(global);
const _setTimeout = global.setTimeout.bind(global);
const _clearTimeout = global.clearTimeout.bind(global);

function trackInterval(fn, ms, ...args){
  const id = _setInterval(fn, ms, ...args);
  active.intervals.add(id);
  return id;
}
function clearTrackedInterval(id){ active.intervals.delete(id); return _clearInterval(id); }

function trackTimeout(fn, ms, ...args){
  const id = _setTimeout(fn, ms, ...args);
  active.timeouts.add(id);
  return id;
}
function clearTrackedTimeout(id){ active.timeouts.delete(id); return _clearTimeout(id); }

function trackListener(target, event, handler, opts){
  target.addEventListener(event, handler, opts);
  active.listeners.push({target, event, handler, opts});
}

function cleanup(){
  for (const id of Array.from(active.intervals)) try { _clearInterval(id); } catch {}
  active.intervals.clear();
  for (const id of Array.from(active.timeouts)) try { _clearTimeout(id); } catch {}
  active.timeouts.clear();
  for (const it of active.listeners.splice(0)) try { it.target.removeEventListener?.(it.event, it.handler, it.opts); } catch {}
}

async function safeFetch(input, init={}, timeoutMs=DEFAULT_TIMEOUT_MS){
  const controller = new AbortController();
  const t = trackTimeout(()=>controller.abort('timeout'), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTrackedTimeout(t);
  }
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function jitter(base){ return Math.random() * base; }

async function withRetries(fn, {
  retries = 3,
  baseDelayMs = 250,
  factor = 2,
  maxDelayMs = 5000,
  onRetry = ()=>{},
}={}){
  let attempt = 0;
  let delay = baseDelayMs;
  for(;;){
    try { return await fn(); }
    catch (err){
      if (attempt >= retries) throw err;
      onRetry({attempt, err, delay});
      await sleep(delay + jitter(delay));
      delay = Math.min(maxDelayMs, delay * factor);
      attempt++;
    }
  }
}

function createCircuitBreaker({
  failureThreshold = 5,
  cooldownMs = 10000,
  halfOpenAttempts = 1,
}={}){
  let failures = 0;
  let state = 'CLOSED';
  let nextTry = 0;
  async function exec(fn){
    const now = Date.now();
    if (state === 'OPEN'){
      if (now < nextTry) throw new Error('Circuit open');
      state = 'HALF_OPEN';
    }
    try {
      const result = await fn();
      failures = 0;
      state = 'CLOSED';
      return result;
    } catch (e){
      failures++;
      if (state === 'HALF_OPEN' || failures >= failureThreshold){
        state = 'OPEN';
        nextTry = now + cooldownMs;
      }
      throw e;
    }
  }
  return { exec, get state(){ return state; }, get failures(){ return failures; } };
}

function logger(level = process.env.LOG_LEVEL || 'info'){
  const levels = ['debug','info','warn','error'];
  const idx = levels.indexOf(level);
  function isEnabled(l){ return levels.indexOf(l) >= idx; }
  return {
    debug: (...a)=> isEnabled('debug') && console.debug('[DEBUG]', ...a),
    info:  (...a)=> isEnabled('info')  && console.info('[INFO]', ...a),
    warn:  (...a)=> isEnabled('warn')  && console.warn('[WARN]', ...a),
    error: (...a)=> isEnabled('error') && console.error('[ERROR]', ...a),
  };
}

function installProcessGuards(){
  for (const sig of ['SIGINT','SIGTERM','SIGHUP']){
    try { process.on(sig, ()=>{ cleanup(); process.exit(0); }); } catch {}
  }
  process.on('uncaughtException', (e)=>{ console.error('uncaughtException', e); });
  process.on('unhandledRejection', (e)=>{ console.error('unhandledRejection', e); });
}

module.exports = {
  trackInterval, clearTrackedInterval,
  trackTimeout, clearTrackedTimeout,
  trackListener, cleanup,
  safeFetch, withRetries, createCircuitBreaker, logger, installProcessGuards,
};
