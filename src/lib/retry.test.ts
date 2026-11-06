import { describe, expect, it, vi } from 'vitest';
import { backoffDelayMs, HttpError, isRetryable, withRetry } from './retry';

const noSleep = vi.fn(async () => {});

describe('withRetry', () => {
  it('returns the first successful result', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries rate-limited calls and then succeeds', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new HttpError(429, 'rate limited'))
      .mockRejectedValueOnce(new HttpError(503, 'unavailable'))
      .mockResolvedValue('ok');
    const sleep = vi.fn(async () => {});

    await expect(withRetry(fn, { sleep, baseDelayMs: 100 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('does not retry client errors', async () => {
    const fn = vi.fn(async () => {
      throw new HttpError(401, 'unauthorized');
    });
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toThrow('unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the configured number of retries', async () => {
    const fn = vi.fn(async () => {
      throw new HttpError(429, 'still limited');
    });
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toThrow('still limited');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('backoffDelayMs', () => {
  it('grows exponentially up to the cap', () => {
    expect(backoffDelayMs(0, new Error('x'), 500, 4000)).toBe(500);
    expect(backoffDelayMs(2, new Error('x'), 500, 4000)).toBe(2000);
    expect(backoffDelayMs(5, new Error('x'), 500, 4000)).toBe(4000);
  });

  it('honours Retry-After when present', () => {
    expect(backoffDelayMs(0, new HttpError(429, 'x', 3), 500, 30_000)).toBe(3000);
  });
});

describe('isRetryable', () => {
  it('only retries 429 and 5xx HTTP errors', () => {
    expect(isRetryable(new HttpError(429, 'x'))).toBe(true);
    expect(isRetryable(new HttpError(500, 'x'))).toBe(true);
    expect(isRetryable(new HttpError(404, 'x'))).toBe(false);
    expect(isRetryable(new Error('network'))).toBe(false);
  });
});
