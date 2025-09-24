export function isTransientError(error: Error): boolean {
  const transientPatterns = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ECONNRESET',
    'rate limit',
    'quota exceeded',
    '429',
    '503',
    '504',
  ];

  const message = error.message.toLowerCase();
  return transientPatterns.some(pattern => message.includes(pattern.toLowerCase()));
}

export function isHistoryGapError(error: Error): boolean {
  return (
    error.message.includes('Invalid history id') ||
    error.message.includes('historyId') ||
    ('code' in error && (error as Error & { code: number }).code === 404)
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options = { maxAttempts: 3, delay: 1000 }
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < options.maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (!isTransientError(lastError)) {
        throw error;
      }

      // Exponential backoff
      const backoffDelay = options.delay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError!;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}