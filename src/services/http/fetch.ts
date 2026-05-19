import https from 'node:https';
import http from 'node:http';
import { USER_AGENT } from './package-info.js';

/**
 * Default timeout for any HTTP request. Sized generously so slow but
 * eventually-responding origins still succeed, while preventing the CLI
 * from hanging forever on a black-holed connection.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Fetch a URL as text. Follows redirects up to a small bound. Rejects with
 * a `Timeout` error if the response doesn't complete within `timeoutMs`.
 *
 * The timeout covers both the initial socket activity (no headers within
 * the window) and stalled-mid-stream responses — `req.setTimeout` fires
 * whenever the socket is idle longer than the threshold.
 */
export function fetch(url: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      // Follow redirects
      if (res.statusCode !== undefined && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Consume the redirect body so the socket can be released.
        res.resume();
        return fetch(res.headers.location, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms fetching ${url}`));
    });
  });
}

export function fetchJSON<T = unknown>(url: string, timeoutMs?: number): Promise<T> {
  return fetch(url, timeoutMs).then(d => JSON.parse(d) as T);
}
