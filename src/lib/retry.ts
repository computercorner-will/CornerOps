/** An HTTP failure from an integration. Never put secrets (keys, tokens) in the message. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface RetryOptions {
  /** Number of retries after the first attempt. */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Retry on rate limits (429) and transient server errors (5xx). */
export function isRetryable(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 429 || error.status >= 500);
}

export function backoffDelayMs(
  attempt: number,
  error: unknown,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  if (error instanceof HttpError && error.retryAfterSeconds !== undefined) {
    return Math.min(error.retryAfterSeconds * 1000, maxDelayMs);
  }
  return Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `fn`, retrying with exponential backoff (honouring Retry-After) on retryable errors. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 4,
    baseDelayMs = 500,
    maxDelayMs = 30_000,
    shouldRetry = isRetryable,
    sleep = defaultSleep,
  } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;
      await sleep(backoffDelayMs(attempt, error, baseDelayMs, maxDelayMs));
    }
  }
}
