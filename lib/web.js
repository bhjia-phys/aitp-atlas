/**
 * Outside requests: arXiv and INSPIRE metadata, arXiv PDFs and sources.
 *
 * They carry only paper identifiers and search words, never the researcher's
 * files. They go through the proxy the config names, or the one in
 * HTTPS_PROXY / HTTP_PROXY (NO_PROXY respected), since Node's own fetch does
 * not use a proxy. arXiv's API asks for a pause between calls; metadata is
 * kept for a few minutes so that reopening a page asks again only later.
 */

import http from 'node:http';
import https from 'node:https';

const USER_AGENT = 'AITP-Atlas (DeepSeek Harness plugin; research notes reader)';
const REDIRECTS = 5;

export function createWeb(settings = {}) {
  const enabled = settings.web !== false;
  const request = typeof settings.request === 'function' ? settings.request : async (url, options) => {
    const proxy = proxyFor(url, settings.proxy);
    try {
      return await nodeRequest(url, { ...options, proxy });
    } catch (error) {
      // A proxy that is not running refuses the connection: try the direct route once.
      if (proxy && error.proxyRefused) return nodeRequest(url, { ...options, proxy: '' });
      throw error;
    }
  };
  const cache = new Map();
  const spacing = new Map();

  /** One request at a time per host that asks for spacing, `gapMs` apart. */
  const paced = (host, gapMs, run) => {
    const prev = spacing.get(host) || Promise.resolve(0);
    const next = prev.then(async (last) => {
      const wait = last + gapMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        return { value: await run() };
      } catch (error) {
        return { error };
      }
    });
    spacing.set(host, next.then(() => Date.now()));
    return next.then((r) => {
      if (r.error) throw r.error;
      return r.value;
    });
  };

  async function get(url, { timeoutMs = 20000, maxBytes = 8 * 1024 * 1024, accept = '*/*', cacheMs = 0, gapMs = 0 } = {}) {
    if (!enabled) throw webError(403, 'Outside requests are off in the Atlas config (web: false).');
    const hit = cacheMs ? cache.get(url) : null;
    if (hit && Date.now() - hit.at < cacheMs) return hit.response;
    const host = new URL(url).host;
    // A reset before any answer (proxies and long routes do this now and then) is tried again, twice at most.
    const run = async (attempt = 0) => {
      try {
        return await request(url, { timeoutMs, maxBytes, headers: { 'user-agent': USER_AGENT, accept } });
      } catch (error) {
        if (!error.retryable || attempt >= 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        return run(attempt + 1);
      }
    };
    // Pacing protects the real servers; a substituted request function (tests) is not one.
    const response = gapMs && !settings.request ? await paced(host, gapMs, () => run()) : await run();
    if (cacheMs && response.status === 200) {
      cache.set(url, { at: Date.now(), response });
      if (cache.size > 300) cache.delete(cache.keys().next().value);
    }
    return response;
  }

  return {
    enabled,
    get,
    async text(url, options) {
      const response = await get(url, options);
      if (response.status !== 200) throw webError(502, `${new URL(url).host} answered ${response.status}.`);
      return response.body.toString('utf8');
    },
    async json(url, options) {
      const text = await this.text(url, { accept: 'application/json', ...options });
      try {
        return JSON.parse(text);
      } catch {
        throw webError(502, `${new URL(url).host} did not answer in JSON.`);
      }
    },
  };
}

export function webError(status, message) {
  return Object.assign(new Error(message), { statusCode: status });
}

/** The proxy for `url`: the configured one, else the environment's; none for NO_PROXY hosts. */
export function proxyFor(url, configured = '', env = process.env) {
  const target = new URL(url);
  const noProxy = String(env.NO_PROXY || env.no_proxy || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const host = target.hostname.toLowerCase();
  if (noProxy.some((rule) => rule === '*' || host === rule.replace(/^\./, '') || host.endsWith(rule.startsWith('.') ? rule : '.' + rule))) return '';
  if (configured) return String(configured);
  const fromEnv = target.protocol === 'https:'
    ? env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy
    : env.HTTP_PROXY || env.http_proxy;
  return fromEnv ? String(fromEnv) : '';
}

/** GET `url` with redirects, a timeout and a size cap; HTTPS through an HTTP proxy uses CONNECT. */
export async function nodeRequest(url, { headers = {}, timeoutMs = 20000, maxBytes = 8 * 1024 * 1024, proxy = '' } = {}) {
  let current = url;
  for (let hop = 0; hop <= REDIRECTS; hop += 1) {
    const response = await once(current, { headers, timeoutMs, maxBytes, proxy });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
      const next = new URL(response.headers.location, current);
      if (next.protocol !== 'https:' && next.protocol !== 'http:') throw webError(502, 'A redirect left the web.');
      current = next.toString();
      continue;
    }
    return { ...response, url: current };
  }
  throw webError(502, 'Too many redirects.');
}

function once(url, { headers, timeoutMs, maxBytes, proxy }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const secure = target.protocol === 'https:';
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      if (error.statusCode) return reject(error);
      const retryable = ['ECONNRESET', 'EPIPE', 'ECONNABORTED'].includes(error.code) || /socket hang up/i.test(String(error.message));
      reject(Object.assign(webError(502, `${target.host} could not be reached: ${error.code || error.message}`), { retryable, proxyRefused: Boolean(error.viaProxy && error.code === 'ECONNREFUSED') }));
    };
    const timer = setTimeout(() => fail(webError(504, `${target.host} did not answer in ${Math.round(timeoutMs / 1000)} s.`)), timeoutMs);
    const finish = (value) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const onResponse = (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy();
          fail(webError(413, `The file from ${target.host} is larger than ${Math.round(maxBytes / 1048576)} MB.`));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => finish({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', fail);
    };
    const options = { method: 'GET', headers: { host: target.host, ...headers } };
    let proxyUrl = null;
    try {
      proxyUrl = proxy ? new URL(/^[a-z]+:\/\//i.test(proxy) ? proxy : `http://${proxy}`) : null;
    } catch {
      proxyUrl = null;
    }
    if (proxyUrl && proxyUrl.protocol !== 'http:') proxyUrl = null;
    if (!proxyUrl) {
      const req = (secure ? https : http).request(target, options, onResponse);
      req.on('error', fail);
      req.end();
      return;
    }
    const auth = proxyUrl.username ? { 'proxy-authorization': 'Basic ' + Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString('base64') } : {};
    if (!secure) {
      const req = http.request({ host: proxyUrl.hostname, port: proxyUrl.port || 80, path: target.toString(), method: 'GET', headers: { ...options.headers, ...auth } }, onResponse);
      req.on('error', (error) => fail(Object.assign(error, { viaProxy: true })));
      req.end();
      return;
    }
    const port = target.port || 443;
    const connect = http.request({ host: proxyUrl.hostname, port: proxyUrl.port || 80, method: 'CONNECT', path: `${target.hostname}:${port}`, headers: { host: `${target.hostname}:${port}`, ...auth } });
    connect.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        fail(webError(502, `The proxy refused ${target.host} (${res.statusCode}).`));
        return;
      }
      const req = https.request({ host: target.hostname, port, path: target.pathname + target.search, method: 'GET', headers: options.headers, socket, agent: false, servername: target.hostname }, onResponse);
      req.on('error', fail);
      req.end();
    });
    connect.on('error', (error) => fail(Object.assign(error, { viaProxy: true })));
    connect.end();
  });
}
