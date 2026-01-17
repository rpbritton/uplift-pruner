/**
 * Frontend cache for API responses
 * Uses in-memory cache with TTL support
 */

interface CacheEntry {
	data: any;
	timestamp: number;
	ttl: number; // Time to live in milliseconds
}

class APICache {
	private cache = new Map<string, CacheEntry>();

	/**
	 * Get cached data if it exists and is not expired
	 */
	get(key: string): any | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		const now = Date.now();
		const age = now - entry.timestamp;

		if (age > entry.ttl) {
			// Expired, remove from cache
			this.cache.delete(key);
			return null;
		}

		return entry.data;
	}

	/**
	 * Set cache entry with TTL
	 */
	set(key: string, data: any, ttl: number): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl
		});
	}

	/**
	 * Clear specific cache entry
	 */
	clear(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * Clear all cache entries matching a pattern
	 */
	clearPattern(pattern: string): void {
		const regex = new RegExp(pattern);
		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear all cache
	 */
	clearAll(): void {
		this.cache.clear();
	}
}

// Singleton instance
export const apiCache = new APICache();

// TTL constants (in milliseconds)
export const CACHE_TTL = {
	STREAMS: 30 * 24 * 60 * 60 * 1000, // 30 days
	ACTIVITY: 10 * 60 * 1000, // 10 minutes
	ACTIVITIES_LIST: 5 * 60 * 1000 // 5 minutes
};

/**
 * Fetch with caching support
 */
export async function cachedFetch(
	url: string,
	options: RequestInit & { bypassCache?: boolean; ttl?: number } = {}
): Promise<Response> {
	const { bypassCache = false, ttl = 0, ...fetchOptions } = options;

	// Only cache GET requests
	if (fetchOptions.method && fetchOptions.method !== 'GET') {
		return fetch(url, fetchOptions);
	}

	// Check cache first (unless bypassing)
	if (!bypassCache) {
		const cached = apiCache.get(url);
		if (cached) {
			// Return cached response
			return new Response(JSON.stringify(cached), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	// Fetch from network
	const response = await fetch(url, fetchOptions);

	// Cache successful responses
	if (response.ok && ttl > 0) {
		const data = await response.clone().json();
		apiCache.set(url, data, ttl);
	}

	return response;
}
