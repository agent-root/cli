import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
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
 * the window) and stalled-mid-stream responses, `req.setTimeout` fires
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

export interface PostJsonResponse<T> {
  status: number;
  body: T;
}

/**
 * Issue a POST with a JSON body and parse the JSON response. Unlike `fetch`,
 * we do NOT throw on non-2xx because POST endpoints commonly return useful
 * 4xx bodies (validation errors, "already exists", etc.). Callers inspect
 * `status` themselves. Follows up to 3 redirects to match `fetch`'s tolerance.
 */
export function postJSON<T = unknown>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<PostJsonResponse<T>> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body));
    const req = mod.request({
      method: 'POST',
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        Accept: 'application/json',
      },
    }, (res) => {
      const status = res.statusCode ?? 0;
      // Follow redirects on POST conservatively, re-issue the POST against the
      // new location. The registry rewrites apex -> www, this avoids surfacing
      // that as a confusing 307 to callers.
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        postJSON<T>(res.headers.location, body, timeoutMs).then(resolve, reject);
        return;
      }
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data.length === 0 ? ({} as T) : (JSON.parse(data) as T);
          resolve({ status, body: parsed });
        } catch (err) {
          reject(new Error(`Invalid JSON response from ${url}: ${(err as Error).message}`));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms posting to ${url}`));
    });
    req.write(payload);
    req.end();
  });
}
