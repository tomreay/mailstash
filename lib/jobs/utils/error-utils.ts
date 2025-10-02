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