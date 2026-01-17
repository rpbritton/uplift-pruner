<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { Link, TrendingUp, RefreshCw, ExternalLink, Lock } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import { handleApiError, retryWithBackoff, fetchWithTimeout, isTokenExpired } from '$lib/utils/errors';
	import { cachedFetch, CACHE_TTL } from '$lib/utils/cache';
	import { goto } from '$app/navigation';

	const dispatch = createEventDispatcher<{ 
		activitySelected: string;
		athleteLoaded: any;
	}>();

	let activityUrl = $state('');
	let loading = $state(false);
	let recentActivities = $state<any[]>([]);
	let athlete = $state<any>(null);
	let currentPage = $state(1);
	let perPage = 10;
	
	let paginatedActivities = $derived(() => {
		const start = (currentPage - 1) * perPage;
		const end = start + perPage;
		return recentActivities.slice(start, end);
	});
	
	let totalPages = $derived(Math.ceil(recentActivities.length / perPage));

	async function loadRecentActivities() {
		loading = true;
		try {
			const response = await retryWithBackoff(
				() => cachedFetch('/api/activities/recent?limit=30', { ttl: CACHE_TTL.ACTIVITIES_LIST })
			);
			
			if (!response.ok) {
				if (isTokenExpired(response)) {
					toasts.show('Your session has expired. Please log in again.', 'error');
					goto('/');
					return;
				}
				throw response;
			}
			
			const data = await response.json();
			recentActivities = data.activities;
			athlete = data.athlete;
			dispatch('athleteLoaded', athlete);
		} catch (err) {
			console.error('Failed to load recent activities:', err);
			await handleApiError(err, 'Failed to load recent activities');
		} finally {
			loading = false;
		}
	}

	async function refreshActivities() {
		loading = true;
		try {
			const response = await retryWithBackoff(
				() => cachedFetch('/api/activities/recent?limit=30', { bypassCache: true, ttl: CACHE_TTL.ACTIVITIES_LIST })
			);
			
			if (!response.ok) {
				if (isTokenExpired(response)) {
					toasts.show('Your session has expired. Please log in again.', 'error');
					goto('/');
					return;
				}
				throw response;
			}
			
			const data = await response.json();
			recentActivities = data.activities;
			athlete = data.athlete;
			dispatch('athleteLoaded', athlete);
			toasts.show('Activities refreshed successfully', 'success', 3000);
		} catch (err) {
			console.error('Failed to load recent activities:', err);
			await handleApiError(err, 'Failed to refresh activities');
		} finally {
			loading = false;
		}
	}

	function formatDistance(meters: number): string {
		// Default to metric if preference not available
		const useImperial = athlete?.measurement_preference === 'feet';
		if (useImperial) {
			const miles = meters / 1609.34;
			return miles.toFixed(1) + ' mi';
		}
		return (meters / 1000).toFixed(1) + ' km';
	}

	function formatElevation(meters: number): string {
		const useImperial = athlete?.measurement_preference === 'feet';
		if (useImperial) {
			const feet = meters * 3.28084;
			return Math.round(feet).toLocaleString() + ' ft';
		}
		return Math.round(meters).toLocaleString() + ' m';
	}

	function formatActivityType(type: string, sport_type?: string): string {
		// sport_type is more specific (e.g., "MountainBikeRide"), type is general (e.g., "Ride")
		if (sport_type) {
			// Convert from camelCase to space-separated
			return sport_type.replace(/([A-Z])/g, ' $1').trim();
		}
		return type;
	}

	function extractActivityId(url: string): string | null {
		// Extract ID from Strava URL: https://www.strava.com/activities/123456789
		const match = url.match(/activities\/(\d+)/);
		return match ? match[1] : null;
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		const activityId = extractActivityId(activityUrl);
		if (activityId) {
			dispatch('activitySelected', activityId);
		}
	}

	function handleActivityClick(id: number) {
		dispatch('activitySelected', id.toString());
	}

	// Load recent activities on mount
	onMount(() => {
		loadRecentActivities();
	});
</script>

<div class="space-y-6">
	<!-- URL Input -->
	<div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
		<h2 class="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">Paste Activity URL</h2>
		<form onsubmit={handleSubmit} class="flex flex-col sm:flex-row gap-2 sm:gap-2">
			<div class="flex-1">
				<input
					type="text"
					bind:value={activityUrl}
					placeholder="https://www.strava.com/activities/123456789"
					class="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-sm sm:text-base border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
				/>
			</div>
			<button
				type="submit"
				class="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 sm:px-6 py-2.5 sm:py-2 text-sm sm:text-base rounded-lg transition-colors"
			>
				Load Activity
			</button>
		</form>
	</div>

	<!-- Divider -->
	<div class="relative">
		<div class="absolute inset-0 flex items-center">
			<div class="w-full border-t border-slate-300 dark:border-slate-700"></div>
		</div>
		<div class="relative flex justify-center text-sm">
			<span class="px-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-500">or select from recent</span>
		</div>
	</div>

	<!-- Recent Activities -->
	<div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
		<div class="flex items-center justify-between mb-3 sm:mb-4">
			<h2 class="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Activities</h2>
			<button
				onclick={refreshActivities}
				class="flex items-center gap-1 text-xs sm:text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
				title="Refresh activities"
				disabled={loading}
			>
				<RefreshCw class="w-3.5 h-3.5 sm:w-4 sm:h-4 {loading ? 'animate-spin' : ''}" />
				Refresh
			</button>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
				<p class="text-slate-600 dark:text-slate-400">Loading activities...</p>
			</div>
		{:else if recentActivities.length > 0}
			<div class="space-y-3">
				{#each paginatedActivities() as activity}
					<div class="relative group">
						<button
							onclick={() => handleActivityClick(activity.id)}
						class="w-full text-left p-4 sm:p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
					>
						<div class="flex items-start justify-between">
							<div class="flex-1 min-w-0 pr-2">
				<div class="mb-2">
					<div class="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1.5">
						<h3 class="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate min-w-0 basis-full sm:basis-auto sm:max-w-[70%]">{activity.name}</h3>
						<div class="flex items-center gap-1.5 flex-shrink-0">
							<span class="inline-block text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
								{formatActivityType(activity.type, activity.sport_type)}
							</span>
							{#if activity.private}
								<span class="inline-block" title="Private activity - Only you can see this activity">
									<Lock class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
								</span>
							{/if}
						</div>
					</div>
				</div>
								<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
										<span>{formatDistance(activity.distance)}</span>
										<span class="flex items-center gap-1">
											<TrendingUp class="w-3.5 h-3.5" />
											{formatElevation(activity.total_elevation_gain)}
										</span>
										<span>{new Date(activity.start_date).toLocaleDateString()}</span>
									</div>
								</div>
							</div>
						</button>
						<a
							href="https://www.strava.com/activities/{activity.id}"
							target="_blank"
							rel="noopener noreferrer"
							onclick={(e) => e.stopPropagation()}
						class="absolute top-2 right-2 p-2 text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
							title="View on Strava"
						>
							<ExternalLink class="w-4 h-4" />
						</a>
					</div>
				{/each}
			</div>			
			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
					<button
						onclick={() => currentPage = Math.max(1, currentPage - 1)}
						disabled={currentPage === 1}
						class="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300"
					>
						Previous
					</button>
					<span class="text-sm text-slate-600 dark:text-slate-400">
						Page {currentPage} of {totalPages}
					</span>
					<button
						onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
						disabled={currentPage === totalPages}
						class="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300"
					>
						Next
					</button>
				</div>
			{/if}		{:else}
			<p class="text-slate-600 dark:text-slate-400 text-center py-8">No recent activities found</p>
		{/if}
	</div>
</div>
