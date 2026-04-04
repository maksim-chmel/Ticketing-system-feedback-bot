import axios from 'axios';

type ErrorSource = 'backend' | 'telegram' | 'internal';

export class AppError extends Error {
    constructor(
        public readonly source: ErrorSource,
        public readonly operation: string,
        public readonly userMessage: string,
        public readonly details: string,
        public readonly code?: string,
        public readonly statusCode?: number,
        public readonly retryAfterSeconds?: number,
        public readonly expected: boolean = false
    ) {
        super(details);
        this.name = 'AppError';
    }
}

function stringifyUnknown(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

export function normalizeBackendError(error: unknown, operation: string): AppError {
    if (error instanceof AppError) {
        return error;
    }

    if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const code = error.code;
        const details = error.message;

        if (code === 'ECONNABORTED') {
            return new AppError(
                'backend',
                operation,
                'The service is taking too long to respond. Please try again.',
                details,
                code,
                statusCode
            );
        }

        if (!error.response) {
            return new AppError(
                'backend',
                operation,
                'Could not reach the backend API. Please try again later.',
                details,
                code
            );
        }

        if (statusCode && statusCode >= 500) {
            return new AppError(
                'backend',
                operation,
                'The backend API is temporarily unavailable. Please try again later.',
                details,
                code,
                statusCode
            );
        }

        if (statusCode && statusCode >= 400) {
            return new AppError(
                'backend',
                operation,
                'The backend API rejected the request.',
                details,
                code,
                statusCode
            );
        }
    }

    return new AppError(
        'internal',
        operation,
        'An internal error occurred. Please try again later.',
        stringifyUnknown(error)
    );
}

export function normalizeTelegramError(error: unknown, operation: string): AppError {
    if (error instanceof AppError) {
        return error;
    }

    const response = (error as { response?: { error_code?: number; description?: string; parameters?: { retry_after?: number } } })?.response;
    const description = response?.description ?? stringifyUnknown(error);
    const retryAfterSeconds = response?.parameters?.retry_after;
    const statusCode = response?.error_code;
    const normalizedDescription = description.toLowerCase();

    if (normalizedDescription.includes('message is not modified')) {
        return new AppError(
            'telegram',
            operation,
            '',
            description,
            undefined,
            statusCode,
            retryAfterSeconds,
            true
        );
    }

    if (normalizedDescription.includes('too many requests')) {
        return new AppError(
            'telegram',
            operation,
            'Telegram is temporarily rate-limiting requests. Please try again a bit later.',
            description,
            undefined,
            statusCode,
            retryAfterSeconds
        );
    }

    if (normalizedDescription.includes('bot was blocked by the user')) {
        return new AppError(
            'telegram',
            operation,
            'The user has blocked the bot.',
            description,
            undefined,
            statusCode,
            retryAfterSeconds,
            true
        );
    }

    return new AppError(
        'telegram',
        operation,
        'Failed to send a message through Telegram.',
        description,
        undefined,
        statusCode,
        retryAfterSeconds
    );
}

export function getErrorLogProps(error: AppError): Record<string, string | number | boolean | undefined> {
    return {
        Source: error.source,
        Operation: error.operation,
        Details: error.details,
        Code: error.code,
        StatusCode: error.statusCode,
        RetryAfterSeconds: error.retryAfterSeconds,
        Expected: error.expected
    };
}
