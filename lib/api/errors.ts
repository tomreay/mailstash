/**
 * Typed domain errors for the API layer.
 *
 * Services throw these instead of bare `Error`s with magic-string messages, so
 * routes can map them to HTTP status codes by type (via `handleApiError`)
 * rather than by comparing `error.message` strings.
 */

export class ApiError extends Error {
  /** HTTP status code this error maps to. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

/** 400 — the request was malformed or failed validation. */
export class ValidationError extends ApiError {
  constructor(message = 'Invalid request') {
    super(message, 400);
  }
}

/** 401 — no valid credentials were supplied. */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/** 403 — authenticated, but not allowed to access this resource. */
export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/** 404 — the requested resource does not exist (or isn't visible to this user). */
export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}
