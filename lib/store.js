/**
 * The latest reading of the research tree. A reading older than `maxAgeSeconds`
 * is served while a fresh one loads in the background; `fresh` waits for one.
 * It owns nothing: dropping it costs a rescan.
 */

import { loadAtlas } from './atlas.js';

export function createStore(settings) {
  const cache = new Map();
  let atlas = null;
  let loadedAt = 0;
  let pending = null;

  const load = () => {
    if (!pending) {
      pending = loadAtlas(settings, cache)
        .then((next) => {
          atlas = next;
          loadedAt = Date.now();
          return next;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  };

  return {
    settings,
    /** After a save: the next request reads the tree again. */
    invalidate() {
      loadedAt = 0;
    },
    async get({ fresh = false } = {}) {
      if (atlas && !fresh) {
        if (Date.now() - loadedAt > settings.maxAgeSeconds * 1000) void load().catch(() => {});
        return atlas;
      }
      return load();
    },
  };
}
