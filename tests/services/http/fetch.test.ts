import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';

// Both https and http are mocked at the boundary so the test never opens a
// real socket. The `get` factory returns a stub req with .on/.setTimeout and
// fires its callback with a stub IncomingMessage that emits data/end.

function makeRes(opts: {
  statusCode?: number;
  body?: string;
  headers?: Record<string, string>;
} = {}): EventEmitter & Partial<IncomingMessage> {
  const res = new EventEmitter() as EventEmitter & Partial<IncomingMessage>;
  res.statusCode = opts.statusCode ?? 200;
  res.headers = opts.headers ?? {};
  res.resume = vi.fn();
  // emit body then end on next tick so the caller has time to subscribe.
  setImmediate(() => {
    if (opts.body !== undefined) res.emit('data', opts.body);
    res.emit('end');
  });
  return res;
}

function makeReq() {
  const req = new EventEmitter() as EventEmitter & {
    setTimeout: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  req.setTimeout = vi.fn();
  req.destroy = vi.fn();
  req.write = vi.fn();
  req.end = vi.fn();
  return req;
}

let lastGetUrl: string | undefined;
let lastGetOpts: Record<string, unknown> | undefined;
let lastRequestOpts: Record<string, unknown> | undefined;
let lastReq: ReturnType<typeof makeReq> | undefined;
type GetCb = (res: ReturnType<typeof makeRes>) => void;
type RequestCb = (res: ReturnType<typeof makeRes>) => void;

const httpsGet = vi.fn();
const httpGet = vi.fn();
const httpsRequest = vi.fn();
const httpRequest = vi.fn();

vi.mock('node:https', () => ({
  default: {
    get: (...args: unknown[]) => httpsGet(...args),
    request: (...args: unknown[]) => httpsRequest(...args),
  },
}));
vi.mock('node:http', () => ({
  default: {
    get: (...args: unknown[]) => httpGet(...args),
    request: (...args: unknown[]) => httpRequest(...args),
  },
}));

import { fetch, fetchJSON, postJSON } from '../../../src/services/http/fetch';

function setHttpsGet(res: ReturnType<typeof makeRes>): void {
  httpsGet.mockImplementation((url: string, opts: Record<string, unknown>, cb: GetCb) => {
    lastGetUrl = url;
    lastGetOpts = opts;
    lastReq = makeReq();
    cb(res);
    return lastReq;
  });
}

function setHttpsGetError(err: Error): void {
  httpsGet.mockImplementation(() => {
    const req = makeReq();
    setImmediate(() => req.emit('error', err));
    return req;
  });
}

beforeEach(() => {
  httpsGet.mockReset();
  httpGet.mockReset();
  httpsRequest.mockReset();
  httpRequest.mockReset();
  lastGetUrl = undefined;
  lastGetOpts = undefined;
  lastRequestOpts = undefined;
  lastReq = undefined;
});

describe('fetch', () => {
  it('resolves with the body on 200', async () => {
    setHttpsGet(makeRes({ statusCode: 200, body: 'ok-body' }));
    await expect(fetch('https://example.com/x')).resolves.toBe('ok-body');
  });

  it('sets a User-Agent header on outgoing requests', async () => {
    setHttpsGet(makeRes({ statusCode: 200, body: '' }));
    await fetch('https://example.com');
    expect((lastGetOpts as Record<string, Record<string, string>>)['headers']!['User-Agent'])
      .toMatch(/agent-root\//);
  });

  it('uses node:http for http:// URLs', async () => {
    httpGet.mockImplementation((_url: string, _opts: Record<string, unknown>, cb: GetCb) => {
      const req = makeReq();
      cb(makeRes({ statusCode: 200, body: 'plain' }));
      return req;
    });
    await expect(fetch('http://example.com')).resolves.toBe('plain');
    expect(httpGet).toHaveBeenCalled();
    expect(httpsGet).not.toHaveBeenCalled();
  });

  it('follows a 301 redirect', async () => {
    let call = 0;
    httpsGet.mockImplementation((_url: string, _opts: Record<string, unknown>, cb: GetCb) => {
      const req = makeReq();
      if (call === 0) {
        call++;
        cb(makeRes({ statusCode: 301, headers: { location: 'https://b.example.com/x' } }));
      } else {
        cb(makeRes({ statusCode: 200, body: 'redirected' }));
      }
      return req;
    });
    await expect(fetch('https://example.com')).resolves.toBe('redirected');
  });

  it('rejects with HTTP code when non-200 and no location', async () => {
    setHttpsGet(makeRes({ statusCode: 404 }));
    await expect(fetch('https://example.com')).rejects.toThrow(/HTTP 404/);
  });

  it('rejects with the network error when req.on(error) fires', async () => {
    setHttpsGetError(new Error('socket hang up'));
    await expect(fetch('https://example.com')).rejects.toThrow('socket hang up');
  });

  it('calls req.setTimeout with the configured timeout', async () => {
    setHttpsGet(makeRes({ statusCode: 200, body: '' }));
    await fetch('https://example.com', 5000);
    expect(lastReq!.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
  });
});

describe('fetchJSON', () => {
  it('parses the JSON body of a 200 response', async () => {
    setHttpsGet(makeRes({ statusCode: 200, body: '{"ok":true}' }));
    const out = await fetchJSON<{ ok: boolean }>('https://example.com/x');
    expect(out).toEqual({ ok: true });
  });

  it('rejects when the body is not parseable JSON', async () => {
    setHttpsGet(makeRes({ statusCode: 200, body: 'not json' }));
    await expect(fetchJSON('https://example.com/x')).rejects.toThrow();
  });
});

describe('postJSON', () => {
  function setHttpsRequest(res: ReturnType<typeof makeRes>): void {
    httpsRequest.mockImplementation((opts: Record<string, unknown>, cb: RequestCb) => {
      lastRequestOpts = opts;
      lastReq = makeReq();
      cb(res);
      return lastReq;
    });
  }

  it('serializes the body, sets Content-Type/Length, and parses the response', async () => {
    setHttpsRequest(makeRes({ statusCode: 200, body: '{"echo":1}' }));
    const out = await postJSON<{ echo: number }>('https://example.com/submit', { domain: 'a.com' });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ echo: 1 });
    const opts = lastRequestOpts as { method?: string; headers?: Record<string, string | number> };
    expect(opts.method).toBe('POST');
    expect(opts.headers!['Content-Type']).toBe('application/json');
    expect(typeof opts.headers!['Content-Length']).toBe('number');
  });

  it('sets the User-Agent and Accept headers', async () => {
    setHttpsRequest(makeRes({ statusCode: 200, body: '{}' }));
    await postJSON('https://example.com/submit', {});
    const opts = lastRequestOpts as { headers?: Record<string, string> };
    expect(opts.headers!['User-Agent']).toMatch(/agent-root\//);
    expect(opts.headers!['Accept']).toBe('application/json');
  });

  it('returns 4xx body without throwing', async () => {
    setHttpsRequest(makeRes({ statusCode: 422, body: '{"errors":["bad"]}' }));
    const out = await postJSON<{ errors: string[] }>('https://example.com/submit', {});
    expect(out.status).toBe(422);
    expect(out.body.errors).toEqual(['bad']);
  });

  it('returns empty object when body is empty', async () => {
    setHttpsRequest(makeRes({ statusCode: 200, body: '' }));
    const out = await postJSON('https://example.com/submit', {});
    expect(out.body).toEqual({});
  });

  it('rejects when the response is not valid JSON', async () => {
    setHttpsRequest(makeRes({ statusCode: 200, body: 'oops' }));
    await expect(postJSON('https://example.com/submit', {})).rejects.toThrow(/Invalid JSON/);
  });

  it('rejects on network error', async () => {
    httpsRequest.mockImplementation(() => {
      const req = makeReq();
      setImmediate(() => req.emit('error', new Error('socket')));
      return req;
    });
    await expect(postJSON('https://example.com/submit', {})).rejects.toThrow('socket');
  });

  it('follows a 302 redirect re-issuing the POST', async () => {
    let call = 0;
    httpsRequest.mockImplementation((opts: Record<string, unknown>, cb: RequestCb) => {
      lastRequestOpts = opts;
      const req = makeReq();
      if (call === 0) {
        call++;
        cb(makeRes({ statusCode: 302, headers: { location: 'https://www.example.com/submit' } }));
      } else {
        cb(makeRes({ statusCode: 200, body: '{"echo":1}' }));
      }
      return req;
    });
    const out = await postJSON('https://example.com/submit', {});
    expect(out.status).toBe(200);
  });
});
