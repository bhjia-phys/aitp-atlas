/**
 * AITP Atlas — host half.
 *
 * The researcher's workspace over the research that AITP keeps in ordinary
 * files: the root note's directions, each topic with what it cites, documents
 * read inside DSH, the knowledge index and the papers library. It gives the
 * agent nothing (no tools, prompt or context): AITP's own Skills do that. It
 * writes only when the researcher saves, creates or adds something; it asks
 * arXiv and INSPIRE only for what the researcher looks up (`web: false` stops it).
 */

import path from 'node:path';
import { createStore } from './lib/store.js';
import { handlerFor, routeTable } from './lib/routes.js';

export const name = 'aitp-atlas';
// Only the web server is used, and only where the profile has one.
export const inject = [];

export function normalizeConfig(raw = {}) {
  const list = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  const root = String(raw.root || '').trim();
  return {
    root: root ? path.resolve(root) : '',
    knowledge: raw.knowledge ? path.resolve(String(raw.knowledge)) : '',
    library: raw.library ? path.resolve(String(raw.library)) : '',
    excludePaths: list(raw.excludePaths),
    exclude: raw.exclude ? list(raw.exclude) : undefined,
    maxAgeSeconds: Number(raw.maxAgeSeconds) >= 5 ? Number(raw.maxAgeSeconds) : 30,
    // How long Atlas waits for DSH's sign-in service before falling back to answering this computer only.
    authGraceMs: Number.isFinite(Number(raw.authGraceMs)) && Number(raw.authGraceMs) >= 0 ? Number(raw.authGraceMs) : 30000,
    web: raw.web !== false,
    // Where Atlas keeps its own state (copies of notes for reviewing a discussion's edits); never the research.
    stateDir: raw.stateDir ? path.resolve(String(raw.stateDir)) : '',
    proxy: raw.proxy ? String(raw.proxy) : '',
    // Appearance: the default theme (auto follows DSH; day, night, or a name below) and themes of
    // one's own, each a base theme with token overrides. The client keeps only safe CSS values.
    theme: typeof raw.theme === 'string' && /^[a-z][a-z0-9-]{0,30}$/i.test(raw.theme.trim()) ? raw.theme.trim() : 'auto',
    themes: raw.themes && typeof raw.themes === 'object' && !Array.isArray(raw.themes) ? raw.themes : {},
    // Tests replace the network; a YAML config cannot.
    request: typeof raw.request === 'function' ? raw.request : undefined,
  };
}

export function apply(ctx, rawConfig) {
  const settings = normalizeConfig(rawConfig);
  const store = createStore(settings);
  const routes = routeTable(store);
  const register = (web) => {
    const startedAt = Date.now();
    // DSH's browser authentication, looked up per request: the connection service may mount after the web server.
    const connectionOf = () => {
      try {
        return typeof web.get === 'function' ? web.get('connection') : undefined;
      } catch {
        return undefined;
      }
    };
    for (const route of routes) {
      try {
        web.effect(() => web.webServer.register({ kind: 'exact', path: route.path, handler: handlerFor(route, connectionOf, { startedAt, graceMs: settings.authGraceMs }) }));
      } catch (error) {
        console.error('[aitp-atlas] route registration failed:', route.path, error);
      }
    }
    // Read the tree in the background so the first view opens quickly.
    if (settings.root) void store.get().catch((error) => {
      if (!error.setup) console.error('[aitp-atlas] could not read the research root:', error.message);
    });
  };
  if (typeof ctx.inject === 'function') ctx.inject(['webServer'], register);
}
