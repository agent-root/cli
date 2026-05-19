import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION, USER_AGENT } from '../../../src/services/http/package-info';

// The module reads from this CLI's package.json at load time. The test
// verifies the contract (name, version, UA string), not the exact version
// (which advances with each release).

describe('package-info', () => {
  it('exposes PACKAGE_NAME as "agent-root"', () => {
    expect(PACKAGE_NAME).toBe('agent-root');
  });

  it('exposes PACKAGE_VERSION as a non-empty semver-ish string', () => {
    expect(typeof PACKAGE_VERSION).toBe('string');
    expect(PACKAGE_VERSION.length).toBeGreaterThan(0);
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('exposes USER_AGENT as `<name>/<version>`', () => {
    expect(USER_AGENT).toBe(`${PACKAGE_NAME}/${PACKAGE_VERSION}`);
    expect(USER_AGENT).toMatch(/^agent-root\//);
  });
});
