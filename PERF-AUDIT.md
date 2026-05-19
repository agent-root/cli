# agent-root CLI — Performance Audit

Date: 2026-05-19
Branch: `main`
Auditor: one-shot static review of `src/` after restructure.

This document records every finding from a focused pass over the CLI source.
Findings marked **Critical** and **Worth fixing** are applied in this commit;
others are deferred with rationale.

## Findings

| # | Location | Symptom | Impact | Fix | Verdict |
|---|----------|---------|--------|-----|---------|
| 1 | `src/services/http/fetch.ts:5` | `http(s).get` with no timeout. A black-holed server hangs the CLI forever. | Every API/manifest/skill fetch. User-visible: an unresponsive `agentroot install` or `update` with no way to recover except Ctrl-C. | Add `req.setTimeout(30_000, …)` with `req.destroy(Error)` so the promise rejects deterministically. Default 30s, override per call. | **Critical** — applied |
| 2 | `src/services/install/install-one-skill.ts:42-52` | `for…of supportingPaths { await fetch(…) }` — N HTTP calls executed serially. | A skill with 5–10 supporting files (e.g. references, examples) pays 5–10× the round-trip latency. On a 200ms RTT origin: ~2s instead of ~200ms. | `Promise.all(supportingPaths.map(...))`; preserve "fail individual file silently" semantics by returning null on error. | **Critical** — applied |
| 3 | `src/commands/resolve.ts:173 + 192` | `resolveAgentroot(domain)` does `dnsLookupTxt(_agentroot.X)`; then resolve.ts immediately re-runs `dnsLookupTxt(_agentroot.X)` for the multi-record code path. Two identical DNS lookups per non-manifest resolve. | Every `agentroot resolve <domain>` that isn't manifest-mode (i.e. skill / inline / multi-record TXT) pays one extra DNS round-trip. ~20-50ms typical, more on cold DNS resolvers. | Extend `ResolveResult` to carry the original `txtRecords: string[]`; reuse them from resolve.ts. Drop the second `dnsLookupTxt`. | **Worth fixing** — applied |
| 4 | `src/services/config/defaults.ts:42 + 54` | `DEFAULT_SKILLS.filter(s => !hasSkillInstalled(s.id))` calls `scanInstalled()` (filesystem walk) once per default skill. | O(N×M) fs work for N default skills × M installed records. Only fires before the defaults marker exists (first-run/cleared state). Today N=1, so it doesn't bite, but it scales poorly as defaults grow. | Call `scanInstalled()` once, build a `Set<record_id>`, then filter against it. | **Worth fixing** — applied |
| 5 | `src/commands/update.ts:26-63` | `update` (no args) loops over every installed record and `await fetch(…)` sequentially. | With 10 installed skills, a re-check pays 10× the round-trip time. On 200ms RTT: ~2s instead of ~200ms. | `Promise.all(allKeys.map(…))` to fetch all sources in parallel, then iterate the outcomes in original key order so the printed log is deterministic. | **Worth fixing** — applied |
| 6 | `src/commands/search.ts:70-100` | The manifests-API fallback tries `<q>.io` then `<q>.com` sequentially. On a miss, that's two cold HTTP round-trips back to back. | Hit only when discover+find-skills both return zero. Mostly cold-miss path, but it's user-visible delay on a bad search term. | `Promise.all(domains.map(…))` to race both, iterate the results in priority order. | **Worth fixing** — applied |
| 7 | `src/index.ts:2-10` | All command modules imported eagerly at top of `index.ts`. Running `agentroot help` still pulls in inquirer, drizzle types via `@agent-root/core`, etc. | Cold-start cost on `help` and on simple commands. ~50-150ms on most laptops. Probably dwarfed by node startup itself. | Lazy-load command modules via `await import('./commands/X.js')` inside the switch. Cleaner but adds boilerplate for marginal gain on a CLI that's already starting node. | Nice-to-have — **deferred** |
| 8 | `src/services/install/install-skill.ts:29` | When `--all` is used, `installOneSkill` is awaited sequentially. With N skills this is N× the cost. | Hot path for `agentroot install <domain> --all`. But each call writes to the filesystem and prints progress; parallelising would interleave output unpredictably and risk concurrent fs.mkdir/symlink races on adjacent paths. | Could be parallelised with care (collect output, replay in order, partition fs ops). | Nice-to-have — **deferred** as the safety bar is high for one-shot. |
| 9 | `src/commands/install-interactive.ts:96` | `fs.readFileSync(configPath)` inside a confirm loop. | Sync fs in a TTY flow — user is already blocked by `confirm()`. Cost is negligible. | Switching to async fs adds noise with no perceived speedup. | Nice-to-have — **deferred** |
| 10 | `src/services/http/package-info.ts:18-33` | `findPackageJson` walks fs synchronously at module load to populate `USER_AGENT`. | Runs once per CLI invocation. Bounded to a few stat calls. | Could pre-build at compile time, but that re-creates the same problem the pre-existing change here was trying to fix (works in dev & dist). | Nice-to-have — **deferred** |
| 11 | `src/services/http/fetch.ts:24` | `JSON.parse(d)` happens once per fetch. No re-parsing across calls. | None — manifests aren't fetched twice in a single command run after fix #3. | n/a — checked, not an issue. | n/a |
| 12 | `console.log` paginate | Largest output is `search` (~10-20 rows) and manifest dump (~tens of records). Output is bounded by upstream API behavior. | None observed. | n/a | n/a |
| 13 | Spinner overhead (`nanospinner`) | Pure stdout writes (ANSI escapes), no child process. Suppressed by `--json` via `maybeSpinner`. | None. | n/a | n/a |

## Summary

- **Critical applied**: 2 — fetch timeout, parallel supporting-file fetches.
- **Worth fixing applied**: 4 — duplicate DNS lookup, cached `scanInstalled`, parallel update fetches, parallel search-manifest fallbacks.
- **Nice-to-have deferred**: 4 — lazy command imports, parallel `--all` install, async fs in interactive picker, compile-time package-info.

## Verification after fixes

```
pnpm build                                        # ok
pnpm test                                         # 25/25 pass
node dist/bin/agentroot.js help                   # byte-identical to baseline
node dist/bin/agentroot.js resolve agentroot.io   # byte-identical
node dist/bin/agentroot.js search payments --json # byte-identical
node dist/bin/agentroot.js validate <bad-path>    # byte-identical
```
