#!/usr/bin/env node

import { setTimeout as sleep } from 'timers/promises';
import crypto from 'crypto';
import WebSocket from 'ws';

const CONFIG = Object.freeze({
  WS_ENDPOINT: process.env.WS_ENDPOINT || 'ws://localhost:8070/ws',
  GLOBAL_TIMEOUT_MS: Number(process.env.GLOBAL_TIMEOUT_MS || 30000),
  MAX_CONCURRENCY: Number(process.env.MAX_CONCURRENCY || 4),
  METRICS_BUFFER: Number(process.env.METRICS_BUFFER || 256),
  HEARTBEAT_INTERVAL_MS: Number(process.env.HEARTBEAT_INTERVAL_MS || 10000),
  HEARTBEAT_TIMEOUT_MS: Number(process.env.HEARTBEAT_TIMEOUT_MS || 15000),
});

// Circular metrics buffer
class Circular {
  constructor(cap) { this.cap = cap; this.buf = new Array(cap); this.i = 0; this.n = 0; }
  push(v){ this.buf[this.i] = v; this.i = (this.i+1)%this.cap; this.n = Math.min(this.n+1,this.cap); }
  values(){ const out=[]; for(let k=0;k<this.n;k++){ out.push(this.buf[(this.i-this.n+k+this.cap)%this.cap]); } return out; }
}

const metrics = { start: Date.now(), req: 0, err: 0, dur: new Circular(CONFIG.METRICS_BUFFER) };

function record(ms){ metrics.dur.push(ms); }
function p95(a){ if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length*0.95)]; }

// WS client with heartbeat and auto-reconnect
class WSClient {
  constructor(url){ this.url=url; this.ws=null; this.closed=false; this.lastPong=Date.now(); this.hb=null; }
  async connect(){
    await new Promise((res,rej)=>{ const ws=new WebSocket(this.url); ws.once('open',()=>{ this.ws=ws; res(); }); ws.once('error',rej); });
    this.ws.on('pong',()=>{ this.lastPong=Date.now(); });
    this.ws.on('close',()=>{ this.closed=true; clearInterval(this.hb); });
    this.hb=setInterval(()=>{
      try{ this.ws.ping(); }catch{}
      if(Date.now()-this.lastPong>CONFIG.HEARTBEAT_TIMEOUT_MS){ try{ this.ws.terminate(); }catch{} this.closed=true; }
    }, CONFIG.HEARTBEAT_INTERVAL_MS);
  }
  async ensure(){ if(this.closed || !this.ws || this.ws.readyState!==WebSocket.OPEN){ await this.connect(); this.closed=false; } }
  send(obj){ if(!this.ws || this.ws.readyState!==WebSocket.OPEN) throw new Error('ws_not_open'); this.ws.send(JSON.stringify(obj)); }
  close(){ try{ clearInterval(this.hb); this.ws?.close(); }catch{} }
}

// Simple request queue with concurrency
class Queue {
  constructor(n){ this.n=n; this.q=[]; this.active=0; }
  push(task){ return new Promise((resolve,reject)=>{ this.q.push({task,resolve,reject}); this._drain(); }); }
  async _drain(){
    while(this.active<this.n && this.q.length){ const it=this.q.shift(); this.active++; try{ const v=await it.task(); it.resolve(v); }catch(e){ it.reject(e); } finally{ this.active--; }}
  }
}

async function main(){
  const ws = new WSClient(CONFIG.WS_ENDPOINT);
  await ws.connect();
  const queue = new Queue(CONFIG.MAX_CONCURRENCY);
  async function runOnce(prompt){
    const cid = crypto.randomBytes(4).toString('hex');
    const started = Date.now();
    await ws.ensure();
    ws.send({type:'prompt', cid, prompt});
    // simulate LLM calls
    const jobs = [150,220,90,310].map(ms=>sleep(ms).then(()=>`done_${ms}`));
    const out = await Promise.allSettled(jobs);
    const ok = out.filter(x=>x.status==='fulfilled').length;
    const err = out.length-ok;
    const dur = Date.now()-started; record(dur);
    ws.send({type:'result', cid, ok, err, dur});
    return {ok, err, dur};
  }
  const prompts = [
    'Resilient orchestration benefits',
    'Fallback design for multi-agent systems',
    'Circuit breaker vs retry patterns',
    'Queue-based backpressure in Node.js'
  ];
  const results = await Promise.all(prompts.map(p=> queue.push(()=>runOnce(p)) ));
  const vals = metrics.dur.values();
  const avg = vals.length? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;
  console.log(JSON.stringify({ ok: results.reduce((a,b)=>a+b.ok,0), err: results.reduce((a,b)=>a+b.err,0), avg_ms: avg, p95_ms: p95(vals) }));
  ws.close();
}

main().catch(e=>{ console.error('fatal', e.message); process.exit(1); });
