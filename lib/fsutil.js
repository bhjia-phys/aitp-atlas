import path from 'node:path';
import { promises as fsp } from 'node:fs';

/** Posix-style path of `abs` relative to `root`; '' for the root itself or outside it. */
export function relPosix(root, abs) {
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return '';
  return rel.split(path.sep).join('/');
}

/** Whether `child` is `parent` or inside it (case-insensitive on Windows). */
export function isWithin(parent, child) {
  if (!parent || !child) return false;
  const a = fileKey(parent);
  const b = fileKey(child);
  if (a === b) return true;
  const rel = path.relative(a, b);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** A path normalized for comparison: resolved, and lower-cased on Windows. */
export function fileKey(p) {
  const resolved = path.resolve(String(p));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export async function statSafe(p) {
  try {
    return await fsp.stat(p);
  } catch {
    return undefined;
  }
}

export async function listDir(dir) {
  try {
    return await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** UTF-8 text up to `limit` bytes; '' when unreadable. */
export async function readText(file, limit = 4 * 1024 * 1024) {
  let handle;
  try {
    handle = await fsp.open(file, 'r');
    const stat = await handle.stat();
    const size = Math.min(stat.size, limit);
    const buffer = Buffer.alloc(size);
    await handle.read(buffer, 0, size, 0);
    return buffer.toString('utf8');
  } catch {
    return '';
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

/** Run `worker` over `items` with at most `limit` in flight; a failure yields undefined. */
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch {
        results[index] = undefined;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, run));
  return results;
}
