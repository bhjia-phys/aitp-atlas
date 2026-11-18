// Local Messages fixture. Never persist prompts, echo user input, emit tool calls or fetch links.
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const reply = ['This is the Atlas fixture. ', 'Open the [worm note](mc/worm/research.md)',
  ' or compare [arXiv:1510.07698](https://arxiv.org/abs/1510.07698).'];

export async function startModel() {
  const key = randomUUID();
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || !/^\/(?:v1\/)?messages(?:\?|$)/.test(req.url)) return res.writeHead(404).end();
    if (req.headers['x-api-key'] !== key && req.headers.authorization !== `Bearer ${key}`) return res.writeHead(401).end();
    req.resume(); // Discard, rather than buffering or logging, the request body.
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
    const send = (type, fields = {}) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`);
    send('message_start', { message: { id: `msg_${randomUUID()}`, type: 'message', role: 'assistant', model: 'deepseek-flash', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } });
    send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    for (const text of reply) {
      await delay(180);
      if (res.destroyed) return;
      send('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
    }
    send('content_block_stop', { index: 0 });
    send('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 42 } });
    send('message_stop');
    res.end();
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  return {
    url: `http://127.0.0.1:${server.address().port}`, key,
    close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }),
  };
}
