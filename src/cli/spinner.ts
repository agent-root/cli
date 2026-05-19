import { createSpinner } from 'nanospinner';
import { isQuiet } from './streams';

export interface SpinnerLike {
  start(): SpinnerLike;
  stop(): SpinnerLike;
  success(opts?: { text?: string }): SpinnerLike;
  error(opts?: { text?: string }): SpinnerLike;
  update(opts?: { text?: string }): SpinnerLike;
  warn(opts?: { text?: string }): SpinnerLike;
  info(opts?: { text?: string }): SpinnerLike;
}

/**
 * Drop-in `SpinnerLike` that swallows every call. Used in `--json` mode so
 * we can write `maybeSpinner(...).start().success(...)` chains unconditionally
 * without polluting machine-readable output. Per Google TS Style "Naming style"
 * the underscore prefix is avoided.
 */
const noopSpinner: SpinnerLike = {
  start() { return noopSpinner; },
  stop() { return noopSpinner; },
  success() { return noopSpinner; },
  error() { return noopSpinner; },
  update() { return noopSpinner; },
  warn() { return noopSpinner; },
  info() { return noopSpinner; },
};

export function maybeSpinner(text: string, flags: Record<string, unknown>): SpinnerLike {
  // No spinner in machine-readable mode (would corrupt JSON pipes via
  // mis-timed redraws even though nanospinner writes to stderr).
  if (flags && flags.json) return noopSpinner;
  // No spinner in quiet mode (suppress all chatter, keep data + errors).
  if ((flags && flags.quiet) || isQuiet()) return noopSpinner;
  return createSpinner(text) as unknown as SpinnerLike;
}
