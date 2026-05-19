import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/http/fetch', () => ({
  postJSON: vi.fn(),
}));
vi.mock('../../src/services/config/config-service', () => ({
  getApiBase: () => 'https://api.test',
}));
vi.mock('../../src/services/dns/dns-service', () => ({
  resolveAgentroot: vi.fn(),
}));

import { postJSON } from '../../src/services/http/fetch';
import { resolveAgentroot } from '../../src/services/dns/dns-service';
import { cmdSubmit } from '../../src/commands/submit';
import { setJsonModeForTest } from '../../src/cli/fatal';
import { EXIT } from '../../src/cli/exit-codes';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(postJSON).mockReset();
  vi.mocked(resolveAgentroot).mockReset();
  setJsonModeForTest(false);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('__exit__');
  }) as never);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('cmdSubmit', () => {
  it('fatals USAGE when no domain is provided', async () => {
    await expect(cmdSubmit([], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.USAGE);
  });

  it('uses --manifest-url flag verbatim without DNS probe', async () => {
    vi.mocked(postJSON).mockResolvedValue({
      status: 200,
      body: { success: true, message: 'ok', manifest: null, records_indexed: 0 },
    });
    await cmdSubmit(['x.com'], { manifestUrl: 'https://x.com/agentroot.json' });
    expect(resolveAgentroot).not.toHaveBeenCalled();
    const call = vi.mocked(postJSON).mock.calls[0]!;
    expect(call[1]).toMatchObject({ domain: 'x.com', manifest_url: 'https://x.com/agentroot.json' });
  });

  it('uses DNS-probed manifest URL when available', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({
      found: true, mode: 'manifest', manifestUrl: 'https://probed/agentroot.json', raw: 'x', txtRecords: ['x'],
    });
    vi.mocked(postJSON).mockResolvedValue({
      status: 200, body: { success: true, message: 'ok', records_indexed: 1 },
    });
    await cmdSubmit(['x.com'], {});
    const call = vi.mocked(postJSON).mock.calls[0]!;
    expect(call[1]).toMatchObject({ domain: 'x.com', manifest_url: 'https://probed/agentroot.json' });
  });

  it('continues without manifest_url when DNS probe yields not-found', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({ found: false, error: 'no record' });
    vi.mocked(postJSON).mockResolvedValue({
      status: 200, body: { success: true, message: 'ok' },
    });
    await cmdSubmit(['x.com'], {});
    const call = vi.mocked(postJSON).mock.calls[0]!;
    expect(call[1]).toEqual({ domain: 'x.com' });
  });

  it('continues without manifest_url when DNS probe throws', async () => {
    vi.mocked(resolveAgentroot).mockRejectedValue(new Error('ETIMEDOUT'));
    vi.mocked(postJSON).mockResolvedValue({
      status: 200, body: { success: true, message: 'ok' },
    });
    await cmdSubmit(['x.com'], {});
    const call = vi.mocked(postJSON).mock.calls[0]!;
    expect(call[1]).toEqual({ domain: 'x.com' });
  });

  it('fatals NOHOST on ENOTFOUND from postJSON', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({ found: false, error: 'no record' });
    const err = new Error('dns fail') as NodeJS.ErrnoException;
    err.code = 'ENOTFOUND';
    vi.mocked(postJSON).mockRejectedValue(err);
    await expect(cmdSubmit(['x.com'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOHOST);
  });

  it('fatals UNAVAILABLE on generic network error', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({ found: false, error: 'no record' });
    vi.mocked(postJSON).mockRejectedValue(new Error('refused'));
    await expect(cmdSubmit(['x.com'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.UNAVAILABLE);
  });

  it('exits PROTOCOL when response has validation errors', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({ found: false, error: 'x' });
    vi.mocked(postJSON).mockResolvedValue({
      status: 422,
      body: { success: false, validation_errors: ['no domain'], message: 'invalid' },
    });
    await expect(cmdSubmit(['x.com'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.PROTOCOL);
  });

  it('exits NOHOST when verification_required + txt_record present', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({ found: false, error: 'x' });
    vi.mocked(postJSON).mockResolvedValue({
      status: 200,
      body: { success: false, verification_required: true, txt_record: 'v=ar1 manifest=https://x' },
    });
    await expect(cmdSubmit(['x.com'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOHOST);
  });

  it('exits NOHOST when instructions block requests a TXT record', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({ found: false, error: 'x' });
    vi.mocked(postJSON).mockResolvedValue({
      status: 200,
      body: {
        success: false,
        instructions: { agentroot: { record: '_agentroot.x.com', type: 'TXT', value: 'v=ar1 manifest=https://x' } },
      },
    });
    await expect(cmdSubmit(['x.com'], {})).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.NOHOST);
  });

  it('--json emits the response JSON and exits accordingly on validation failure', async () => {
    vi.mocked(resolveAgentroot).mockResolvedValue({ found: false, error: 'x' });
    vi.mocked(postJSON).mockResolvedValue({
      status: 422,
      body: { success: false, validation_errors: ['oops'] },
    });
    await expect(cmdSubmit(['x.com'], { json: true })).rejects.toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(EXIT.PROTOCOL);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(payload.validation_errors).toEqual(['oops']);
  });
});
