import https from 'node:https';
import http from 'node:http';
import { USER_AGENT } from './package-info.js';

export function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      // Follow redirects
      if (res.statusCode !== undefined && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

export function fetchJSON<T = unknown>(url: string): Promise<T> {
  return fetch(url).then(d => JSON.parse(d) as T);
}
