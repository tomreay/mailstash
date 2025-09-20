import pRetry, {Options, RetryContext} from 'p-retry';

export interface RetryConfig {
  maxAttempts?: number;
  onFailedAttempt?: (context: RetryContext) => void | Promise<void>;
}

interface GoogleApiError extends Error {
  code?: number;
  message: string;
}

function isGoogleApiError(error: unknown): error is GoogleApiError {
  return error instanceof Error && 'code' in error;
}

function shouldRetry(error: unknown): boolean {
  if (!isGoogleApiError(error)) {
    // Retry on network errors
    return true;
  }

  const retryableCodes = [
    429, // Too Many Requests
    403, // Forbidden (often quota)
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ];

  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  // Check for quota errors in message
  if (error.message?.toLowerCase().includes('quota')) {
    return true;
  }

  if (error.message?.toLowerCase().includes('rate limit')) {
    return true;
  }

  // Don't retry on auth errors (401) or not found (404)
  if (error.code === 401 || error.code === 404) {
    return false;
  }

  return false;
}

function getRetryDelay(error: unknown, attemptNumber: number): number {
  if (!isGoogleApiError(error)) {
    // Network errors: exponential backoff starting at 1s
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 60000);
  }

  // Quota errors: longer delays
  if (error.code === 403 || error.message?.toLowerCase().includes('quota')) {
    // Start at 30s, exponential up to 5 minutes
    return Math.min(30000 * Math.pow(1.5, attemptNumber - 1), 300000);
  }

  // Rate limit errors: exponential backoff starting at 2s
  if (error.code === 429) {
    return Math.min(2000 * Math.pow(2, attemptNumber - 1), 120000);
  }

  // Other errors: standard exponential backoff
  return Math.min(1000 * Math.pow(2, attemptNumber - 1), 60000);
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxAttempts = 5, onFailedAttempt } = config;

  const options: Options = {
    retries: maxAttempts - 1, // p-retry counts retries, not attempts
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 300000,
    onFailedAttempt: async (context: RetryContext) => {
      console.log(
        `[Retry] Attempt ${context.attemptNumber} failed:`,
          context.error.message,
        `(${context.retriesLeft} retries left)`
      );

      // Call custom handler if provided
      if (onFailedAttempt) {
        await onFailedAttempt(context);
      }

      // Check if we should retry this error
      if (!shouldRetry(context.error)) {
        console.log('[Retry] Error is not retryable, aborting');
        throw context.error; // This will stop retrying
      }

      // Calculate custom delay based on error type
      const delay = getRetryDelay(context.error, context.attemptNumber);
      console.log(`[Retry] Waiting ${delay}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, delay));
    },
  };

  try {
    return await pRetry(operation, options);
  } catch (error) {
    console.error('[Retry] All retry attempts failed:', error);
    throw error;
  }
}

// Specialized retry for Gmail API operations
export async function retryGmailOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  metadata?: Record<string, unknown>
): Promise<T> {
  return retryWithBackoff(operation, {
    maxAttempts: 5,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onFailedAttempt: async (error: any) => {
      console.log(
        `[Gmail Retry] ${operationName} failed:`,
        {
          attempt: error.attemptNumber,
          retriesLeft: error.retriesLeft,
          error: error.message,
          metadata,
        }
      );

      // Log specific Gmail error details
      if (isGoogleApiError(error)) {
        console.log(`[Gmail Retry] Error code: ${error.code}`);
        if (error.code === 403) {
          console.log('[Gmail Retry] Quota exceeded - using extended backoff');
        } else if (error.code === 429) {
          console.log('[Gmail Retry] Rate limited - using standard backoff');
        }
      }
    },
  });
}