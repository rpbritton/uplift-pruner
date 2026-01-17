/**
 * Error handling utilities
 * Common error handling patterns and utilities
 */

import { toasts } from '$lib/stores/toast';

export interface ApiError {
	message: string;
	status?: number;
	code?: string;
	suggestion?: string;
}

/**
 * Parse error from API response or exception
 */
export async function parseError(error: any): Promise<ApiError> {
	// Handle Response objects
	if (error instanceof Response) {
		const status = error.status;
		let message = 'An error occurred';
		let code = undefined;
		let suggestion = undefined;

		try {
			const data = await error.json();
			message = data.error || data.message || message;
			code = data.code;
			suggestion = data.suggestion;
		} catch {
			message = error.statusText || message;
		}

		// Add suggestions based on status code
		if (!suggestion) {
			suggestion = getSuggestionForStatus(status);
		}

		return { message, status, code, suggestion };
	}

	// Handle Error objects
	if (error instanceof Error) {
		return {
			message: error.message,
			suggestion: 'Please try again or contact support if the problem persists.'
		};
	}

	// Handle string errors
	if (typeof error === 'string') {
		return { message: error };
	}

	// Unknown error type
	return {
		message: 'An unexpected error occurred',
		suggestion: 'Please refresh the page and try again.'
	};
}

/**
 * Get user-friendly suggestion based on HTTP status code
 */
function getSuggestionForStatus(status: number): string | undefined {
	switch (status) {
		case 400:
			return 'Please check your input and try again.';
		case 401:
			return 'Please log in again.';
		case 403:
			return 'You do not have permission to perform this action.';
		case 404:
			return 'The requested resource was not found.';
		case 429:
			return 'Too many requests. Please wait a moment and try again.';
		case 500:
		case 502:
		case 503:
			return 'The server is experiencing issues. Please try again later.';
		default:
			return undefined;
	}
}

/**
 * Handle API error with toast notification
 */
export async function handleApiError(error: any, fallbackMessage?: string): Promise<void> {
	const parsed = await parseError(error);
	const message = fallbackMessage || parsed.message;
	const fullMessage = parsed.suggestion ? `${message}. ${parsed.suggestion}` : message;

	toasts.show(fullMessage, 'error', 7000);
	console.error('API Error:', parsed);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxRetries: number = 3,
	initialDelay: number = 1000
): Promise<T> {
	let lastError: any;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			// Don't retry on 4xx errors (except 429)
			if (error instanceof Response) {
				if (error.status >= 400 && error.status < 500 && error.status !== 429) {
					throw error;
				}
			}

			// Don't retry on last attempt
			if (attempt === maxRetries - 1) {
				throw error;
			}

			// Exponential backoff
			const delay = initialDelay * Math.pow(2, attempt);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError;
}

/**
 * Check if error is due to expired token
 */
export function isTokenExpired(error: any): boolean {
	if (error instanceof Response && error.status === 401) {
		return true;
	}
	if (error?.status === 401 || error?.statusCode === 401) {
		return true;
	}
	return false;
}

/**
 * Fetch with timeout
 */
export async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeout: number = 30000
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...options,
			credentials: 'include',
			signal: controller.signal
		});
		clearTimeout(timeoutId);
		return response;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error('Request timed out. Please check your connection and try again.');
		}
		throw error;
	}
}
