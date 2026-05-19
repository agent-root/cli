import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cmdVersion, printShortVersion } from '../../src/commands/version';
import { PACKAGE_VERSION } from '../../src/services/http/package-info';

describe('cmdVersion', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('prints a 5-line block in human mode', () => {
    cmdVersion([], {});
    expect(logSpy).toHaveBeenCalledTimes(5);
    const first = logSpy.mock.calls[0]?.[0] as string;
    expect(first).toMatch(/^agent-root /);
    expect(first).toContain(PACKAGE_VERSION);
  });

  it('includes node, os, api, config lines', () => {
    cmdVersion([], {});
    const joined = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(joined).toMatch(/node v?\d/);
    expect(joined).toMatch(/^os\s+/m);
    expect(joined).toMatch(/^api\s+/m);
    expect(joined).toMatch(/^config /m);
  });

  it('outputs a single-line JSON envelope under --json', () => {
    cmdVersion([], { json: true });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(payload.agentRoot).toBe(PACKAGE_VERSION);
    expect(typeof payload.node).toBe('string');
    expect(typeof payload.os).toBe('string');
    expect(typeof payload.api).toBe('string');
    expect(typeof payload.config).toBe('string');
  });
});

describe('printShortVersion', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('prints a single line "agent-root <version>"', () => {
    printShortVersion();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toBe(`agent-root ${PACKAGE_VERSION}`);
  });
});
