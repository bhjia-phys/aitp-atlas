// Local Messages fixture. Never persist prompts, echo user input, emit tool calls or fetch links.
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const reply = ['This is the Atlas fixture. ', 'Open the [worm note](mc/worm/research.md)',
  ' or compare [arXiv:1510.07698](https://arxiv.org/abs/1510.07698).'];

export async function startModel() {
  const key = randomUUID();
  // Only the in-process smoke driver can schedule a gated turn. No HTTP control endpoint;
  // no prompt/body inspection. The ordinary CLI continues streaming its short fixture.
  const plans = [], stop = new AbortController();
  const holdNext = label => {
    if (!['A', 'B'].includes(label)) throw new Error('Unknown fixture stream');
    let start, release, finish;
    const started = new Promise(resolve => { start = resolve; });
    const released = new Promise(resolve => { release = resolve; });
    const finished = new Promise(resolve => { finish = resolve; });
    plans.push({ label, start, released, finish });
    return { started, release, finished };
  };
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || !/^\/(?:v1\/)?messages(?:\?|$)/.test(req.url)) return res.writeHead(404).end();
    if (req.headers['x-api-key'] !== key && req.headers.authorization !== `Bearer ${key}`) return res.writeHead(401).end();
    req.resume(); // Discard, rather than buffering or logging, the request body.
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
    const send = (type, fields = {}) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`);
    send('message_start', { message: { id: `msg_${randomUUID()}`, type: 'message', role: 'assistant', model: 'deepseek-flash', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } });
    send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    const plan = plans.shift();
    const delta = text => send('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
    if (plan) {
      delta(`Fixture stream ${plan.label} begins. `);
      plan.start();
      // Cancellation or an early failed test must never leave a request/timer running.
      const timeout = AbortSignal.timeout(45000), cancel = AbortSignal.any([timeout, stop.signal]);
      const abort = new Promise(resolve => cancel.addEventListener('abort', resolve, { once: true }));
      await Promise.race([plan.released, abort]);
      if (res.destroyed || stop.signal.aborted) return;
    }
    for (const text of plan ? [...reply, ` Stream ${plan.label} complete.`] : reply) {
      await delay(180);
      if (res.destroyed) return;
      send('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
    }
    send('content_block_stop', { index: 0 });
    send('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 42 } });
    send('message_stop');
    res.end();
    plan?.finish();
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  return {
    url: `http://127.0.0.1:${server.address().port}`, key, holdNext,
    close: () => new Promise((resolve) => { stop.abort(); server.close(resolve); server.closeAllConnections(); }),
  };
}
