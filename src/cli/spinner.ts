import { createSpinner } from 'nanospinner';

export interface SpinnerLike {
  start(): SpinnerLike;
  stop(): SpinnerLike;
  success(opts?: { text?: string }): SpinnerLike;
  error(opts?: { text?: string }): SpinnerLike;
  update(opts?: { text?: string }): SpinnerLike;
  warn(opts?: { text?: string }): SpinnerLike;
  info(opts?: { text?: string }): SpinnerLike;
}

const _noop: SpinnerLike = {
  start() { return _noop; },
  stop() { return _noop; },
  success() { return _noop; },
  error() { return _noop; },
  update() { return _noop; },
  warn() { return _noop; },
  info() { return _noop; },
};

export function maybeSpinner(text: string, flags: Record<string, unknown>): SpinnerLike {
  if (flags && flags.json) return _noop;
  return createSpinner(text) as unknown as SpinnerLike;
}
