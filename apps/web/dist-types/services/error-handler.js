/** Thrown when the API returns 422 with field-level validation errors */
export class ValidationError extends Error {
    fieldErrors;
    constructor(message, fieldErrors) {
        super(message);
        this.name = 'ValidationError';
        this.fieldErrors = fieldErrors;
    }
}
/** Thrown when the API returns 429 Too Many Requests */
export class RateLimitError extends Error {
    /** Number of seconds to wait before retrying, parsed from Retry-After header */
    retryAfterSeconds;
    constructor(retryAfterSeconds) {
        super('Too many requests. Please try again later.');
        this.name = 'RateLimitError';
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
/** Thrown on 5xx responses — generic message, no technical details */
export class ServerError extends Error {
    status;
    constructor(status) {
        super('A server error occurred. Please try again.');
        this.name = 'ServerError';
        this.status = status;
    }
}
/** Maps error instances to user-friendly display messages */
export function getErrorMessage(error) {
    if (error instanceof ValidationError) {
        if (error.fieldErrors.length > 0) {
            return error.fieldErrors.map((fe) => `${fe.field}: ${fe.rule}`).join(', ');
        }
        return error.message;
    }
    if (error instanceof RateLimitError) {
        if (error.retryAfterSeconds !== null) {
            return `Too many requests. Please wait ${error.retryAfterSeconds}s before trying again.`;
        }
        return error.message;
    }
    if (error instanceof ServerError)
        return error.message;
    if (error instanceof Error)
        return error.message;
    return 'An unexpected error occurred.';
}
