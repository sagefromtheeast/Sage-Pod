/**
 * Strict TypeScript type contracts for the episode download system.
 */

export type DownloadErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'CAPTIVE_PORTAL'
  | 'INSUFFICIENT_SPACE'
  | 'CORRUPTED_STREAM'
  | 'NETWORK_TIMEOUT'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface DownloadFailure {
  code: DownloadErrorCode;
  message: string;
  httpStatus?: number;
  isRetryable: boolean;
}

export interface DownloadLogEntry {
  id: string;
  episodeId: number;
  episodeTitle: string;
  url: string;
  status: 'success' | 'failed';
  errorCode?: DownloadErrorCode;
  errorMessage?: string;
  timestamp: number;
}

/** Helper for compile-time exhaustive switch checks. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled download state: ${JSON.stringify(x)}`);
}

/**
 * Classifies runtime errors into structured failure objects.
 * Identifies fatal (401/403/404/captive portal) vs retryable errors (timeouts, glitches).
 */
export function classifyDownloadError(error: unknown): DownloadFailure {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('404') || lower.includes('not found') || lower.includes('410') || lower.includes('gone')) {
    return {
      code: 'NOT_FOUND',
      message: 'The podcast file was not found on the server (404/410).',
      httpStatus: 404,
      isRetryable: false,
    };
  }

  if (lower.includes('403') || lower.includes('forbidden')) {
    return {
      code: 'FORBIDDEN',
      message: 'Access to this audio stream is forbidden (403).',
      httpStatus: 403,
      isRetryable: false,
    };
  }

  if (lower.includes('401') || lower.includes('unauthorized')) {
    return {
      code: 'UNAUTHORIZED',
      message: 'This episode requires authentication or private subscription credentials (401).',
      httpStatus: 401,
      isRetryable: false,
    };
  }

  if (lower.includes('captive') || lower.includes('html page') || lower.includes('text/html')) {
    return {
      code: 'CAPTIVE_PORTAL',
      message: 'A captive Wi-Fi login portal or HTML page was returned instead of audio.',
      isRetryable: false,
    };
  }

  if (lower.includes('space') || lower.includes('enospc') || lower.includes('storage full')) {
    return {
      code: 'INSUFFICIENT_SPACE',
      message: 'Device storage is full. Please free up space to download.',
      isRetryable: false,
    };
  }

  if (lower.includes('truncated') || lower.includes('premature') || lower.includes('size mismatch')) {
    return {
      code: 'CORRUPTED_STREAM',
      message: 'The download stream ended prematurely before all bytes were received.',
      isRetryable: true,
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('network request failed') ||
    lower.includes('connection reset') ||
    lower.includes('econnrefused') ||
    lower.includes('socket')
  ) {
    return {
      code: 'NETWORK_TIMEOUT',
      message: 'Network connection was interrupted or timed out.',
      isRetryable: true,
    };
  }

  return {
    code: 'UNKNOWN',
    message: message || 'An unexpected error occurred during download.',
    isRetryable: false,
  };
}
