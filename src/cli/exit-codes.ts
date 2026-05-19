/**
 * Sysexits-style exit codes. Subset that maps cleanly to our failure modes.
 * Scripts can branch on these: e.g. retry on 69 (unavailable) but not 78
 * (config).
 *
 * Source: man 3 sysexits, https://man.freebsd.org/cgi/man.cgi?query=sysexits
 *
 * We pick 2 (not 64) for USAGE to match `git`, `gh`, and most modern CLIs,
 * even though BSD sysexits.h reserves 64 for the same meaning. The other
 * codes follow sysexits exactly so old shell idioms (e.g. retry on 75 -
 * we do not use, but adjacent 69 EX_UNAVAILABLE) keep working as expected.
 */
export const EXIT = {
  OK: 0,
  GENERIC: 1,
  USAGE: 2,
  NOINPUT: 66,
  NOHOST: 68,
  UNAVAILABLE: 69,
  PROTOCOL: 76,
  NOPERM: 77,
  CONFIG: 78,
} as const;

export type ExitCode = typeof EXIT[keyof typeof EXIT];

/**
 * Reverse-lookup: numeric exit code -> symbolic name. Returns "GENERIC"
 * for an unknown numeric code so JSON envelopes always have a string
 * `code` field, never a stringified number.
 */
export function exitCodeName(code: number): string {
  for (const [name, value] of Object.entries(EXIT)) {
    if (value === code) return name;
  }
  return 'GENERIC';
}
