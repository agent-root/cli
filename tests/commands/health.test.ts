import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/http/fetch', () => ({
  fetchJSON: vi.fn(),
}));

vi.mock('../../src/services/config/config-service', () => ({
  getApiBase: () => 'https://api.test',
}));

import { fetchJSON } from '../../src/services/http/fetch';
import { cmdHealth } from '../../src/commands/health';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(fetchJSON).mockReset();
  setJsonModeForTest(false);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as never);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  exitSpy.mockRestore();
  logSpy.mockRestore();
});

describe('cmdHealth', () => {
  it('happy path: prints status + db lines for status:ok, db:connected', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ status: 'ok', db: 'connected', ts: '2026-01-01T00:00:00Z' });
    await cmdHealth([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/status:/);
    expect(joined).toMatch(/db:/);
    expect(joined).toMatch(/ts:/);
  });

  it('exits UNAVAILABLE when health response is degraded', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ status: 'ok', db: 'disconnected' });
    await expect(cmdHealth([], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.UNAVAILABLE);
  });

  it('fatals NOHOST on ENOTFOUND', async () => {
    const err = new Error('lookup failed') as NodeJS.ErrnoException;
    err.code = 'ENOTFOUND';
    vi.mocked(fetchJSON).mockRejectedValue(err);
    await expect(cmdHealth([], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOHOST);
  });

  it('fatals UNAVAILABLE on other network errors', async () => {
    vi.mocked(fetchJSON).mockRejectedValue(new Error('timeout'));
    await expect(cmdHealth([], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.UNAVAILABLE);
  });

  it('--json: emits the response JSON and exits 0 on ok', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ status: 'ok', db: 'connected' });
    await cmdHealth([], { json: true });
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(payload.status).toBe('ok');
    expect(payload.db).toBe('connected');
  });

  it('--json: exits UNAVAILABLE on degraded', async () => {
    vi.mocked(fetchJSON).mockResolvedValue({ status: 'ok', db: 'disconnected' });
    await expect(cmdHealth([], { json: true })).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.UNAVAILABLE);
  });
});
