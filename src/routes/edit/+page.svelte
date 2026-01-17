<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { ArrowLeft, Download, Upload, X, RefreshCw, Plus, Activity, TrendingUp, Clock } from 'lucide-svelte';
	import MapView from '$lib/components/MapView.svelte';
	import SegmentList from '$lib/components/SegmentList.svelte';
	import StatsComparison from '$lib/components/StatsComparison.svelte';
	import ElevationChart from '$lib/components/ElevationChart.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import { browser } from '$app/environment';
	import { toasts } from '$lib/stores/toast';
	import { handleApiError, isTokenExpired, retryWithBackoff, fetchWithTimeout } from '$lib/utils/errors';
	import { cachedFetch, CACHE_TTL } from '$lib/utils/cache';
	import { runUploadWorkflow, type UploadStep } from '$lib/upload-workflow';
	import { generateFitFromStrava } from '$lib/fit-from-strava';
	import { removeFitIntervals } from '$lib/fit-editor';
	import { extractIntervals } from '$lib/intervals';

	// Helper function to calculate net elevation change from altitude stream
	function calculateNetElevation(altitudeData: number[], startIndex: number, endIndex: number): number {
		if (!altitudeData || startIndex >= endIndex) return 0;
		return altitudeData[endIndex] - altitudeData[startIndex];
	}

	// Helper function to calculate elevation gain (sum of positive changes only)
	function calculateElevationGain(altitudeData: number[], startIndex: number, endIndex: number): number {
		if (!altitudeData || startIndex >= endIndex) return 0;
		
		let gain = 0;
		for (let i = startIndex; i < endIndex; i++) {
			const diff = altitudeData[i + 1] - altitudeData[i];
			if (diff > 0) {
				gain += diff;
			}
		}
		return gain;
	}

	let activity = $state<any>(null);
	let selectedSegments = $state<number[]>([]);
	let hoveredSegment = $state<number[] | null>(null);
	let loading = $state(true);
	let processing = $state(false);
	let showUploadModal = $state(false);
	let uploadStep: UploadStep = $state('idle');
	let uploadProgress = $state(0);
	let uploadMessage = $state('');
	let uploadError = $state<{ message: string; recoveryUrl?: string } | null>(null);
	let newActivityUrl = $state<string | null>(null);
	let attemptNumber = $state(0);
	let secondsRemaining = $state(0);
	let confirmDeletionResolver: (() => void) | null = null;
	let urlUpdateScheduled = false;
	let componentsReady = $state(false);
	let hoverPoint = $state<{ lat: number; lng: number } | null>(null);
	let refreshingSegments = $state(false);

	// Pre-calculated net elevation for each segment (for display)
	let segmentElevationGains = $state<number[]>([]);
	// Pre-calculated elevation gain for each segment (for stats - positive changes only)
	let segmentElevationGainsForStats = $state<number[]>([]);

	// Calculate stats for removed segments
	let removedStats = $derived((() => {
		if (!activity?.segment_efforts) {
			return { distance: 0, elevation: 0, time: 0 };
		}

		let totalDistance = 0;
		let totalElevation = 0;
		let totalTime = 0;

		selectedSegments.forEach((index) => {
			const segment = activity.segment_efforts[index];
			if (segment) {
				totalDistance += segment.distance;
				// Use pre-calculated elevation gain (positive changes only)
				totalElevation += segmentElevationGainsForStats[index] || 0;
				totalTime += segment.elapsed_time;
			}
		});

		return {
			distance: totalDistance,
			elevation: totalElevation,
			time: totalTime
		};
	})());

	async function refreshActivity() {
		const activityId = $page.url.searchParams.get('id');
		if (!activityId) return;

		refreshingSegments = true;
		selectedSegments = []; // Clear selections when refreshing
		
		try {
			// Fetch fresh data
			const response = await retryWithBackoff(
				() => cachedFetch(`/api/activity?id=${activityId}`, { bypassCache: true, ttl: CACHE_TTL.ACTIVITY })
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
			activity = data;
			
			// Calculate both net elevation (for display) and elevation gain (for stats)
			if (data?.segment_efforts && data?.streams?.altitude?.data) {
				const altitudeData = data.streams.altitude.data;
				segmentElevationGains = data.segment_efforts.map((segment: any) => 
					calculateNetElevation(altitudeData, segment.start_index, segment.end_index)
				);
				segmentElevationGainsForStats = data.segment_efforts.map((segment: any) => 
					calculateElevationGain(altitudeData, segment.start_index, segment.end_index)
				);
			} else if (data?.segment_efforts) {
				segmentElevationGains = data.segment_efforts.map((segment: any) => 
					segment.segment.elevation_high - segment.segment.elevation_low
				);
				segmentElevationGainsForStats = data.segment_efforts.map((segment: any) => 
					Math.max(0, segment.segment.elevation_high - segment.segment.elevation_low)
				);
			}
			
			toasts.show('Activity refreshed successfully', 'success', 3000);
		} catch (err) {
			console.error('Failed to refresh activity:', err);
			await handleApiError(err, 'Failed to refresh activity');
		} finally {
			refreshingSegments = false;
		}
	}

	onMount(async () => {
		if (!browser) return;

		// Get activity ID from URL
		const activityId = $page.url.searchParams.get('id');
		if (!activityId) {
			goto('/select?error=' + encodeURIComponent('No activity ID provided'));
			return;
		}

		// Fetch activity from server (uses server-side caching)
		try {
			const response = await retryWithBackoff(
				() => cachedFetch(`/api/activity?id=${activityId}`, { ttl: CACHE_TTL.ACTIVITY })
			);
			
			if (!response.ok) {
				// Check for token expiration
				if (isTokenExpired(response)) {
					toasts.show('Your session has expired. Please log in again.', 'error');
					goto('/');
					return;
				}
				
				await handleApiError(response);
				goto('/select');
				return;
			}
			
			activity = await response.json();
		} catch (error) {
			console.error('Failed to load activity:', error);
			await handleApiError(error, 'Failed to load activity');
			goto('/select');
			return;
		}

		// Load selected segments from URL query params
		const segmentsParam = $page.url.searchParams.get('segments');
		if (segmentsParam) {
			const indices = segmentsParam.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
			selectedSegments = indices;
		}

		loading = false;
		
		// Pre-calculate both net elevation (for display) and elevation gain (for stats)
		if (activity?.segment_efforts && activity?.streams?.altitude?.data) {
			const altitudeData = activity.streams.altitude.data;
			segmentElevationGains = activity.segment_efforts.map((segment: any) => 
				calculateNetElevation(altitudeData, segment.start_index, segment.end_index)
			);
			segmentElevationGainsForStats = activity.segment_efforts.map((segment: any) => 
				calculateElevationGain(altitudeData, segment.start_index, segment.end_index)
			);
		} else if (activity?.segment_efforts) {
			// Fallback to elevation difference if no altitude stream
			segmentElevationGains = activity.segment_efforts.map((segment: any) => 
				segment.segment.elevation_high - segment.segment.elevation_low
			);
			segmentElevationGainsForStats = activity.segment_efforts.map((segment: any) => 
				Math.max(0, segment.segment.elevation_high - segment.segment.elevation_low)
			);
		}
		
		// Give components time to mount and render
		setTimeout(() => {
			componentsReady = true;
		}, 100);
	});

	// Update URL when selections change (throttled to next animation frame)
	$effect(() => {
		if (!browser || !activity) return;
		
		// Read selectedSegments to track changes
		const currentSelection = selectedSegments;
		
		// Schedule update if not already scheduled
		if (!urlUpdateScheduled) {
			urlUpdateScheduled = true;
			requestAnimationFrame(() => {
				const params = new URLSearchParams($page.url.searchParams);
				
				if (currentSelection.length > 0) {
					params.set('segments', currentSelection.join(','));
				} else {
					params.delete('segments');
				}
				
				replaceState(`?${params.toString()}`, {});
				urlUpdateScheduled = false;
			});
		}
	});

	function handleSegmentToggle(event: CustomEvent<{ index: number; selected: boolean }>) {
		const { index, selected } = event.detail;
		if (selected) {
			selectedSegments = [...selectedSegments, index];
		} else {
			selectedSegments = selectedSegments.filter(i => i !== index);
		}
	}

	function handleSelectAllInstances(event: CustomEvent<{ segmentId: number }>) {
		const { segmentId } = event.detail;
		
		// Find all matching segment indices
		const indices: number[] = [];
		activity.segment_efforts.forEach((segment: any, index: number) => {
			if (segment.segment.id === segmentId && !selectedSegments.includes(index)) {
				indices.push(index);
			}
		});
		
		selectedSegments = [...selectedSegments, ...indices];
	}

	function handleDeselectAll() {
		selectedSegments = [];
	}

	function handleSegmentHover(event: CustomEvent<number[] | null>) {
		hoveredSegment = event.detail;
	}

	async function handleDownload(format: string) {
		processing = true;
		try {
			// Fetch streams from backend
			const streamsResponse = await retryWithBackoff(
				() => cachedFetch(`/api/activity/${activity.id}/streams`, { ttl: CACHE_TTL.STREAMS }),
				60000
			);

			if (!streamsResponse.ok) {
				if (isTokenExpired(streamsResponse)) {
					toasts.show('Your session has expired. Please log in again.', 'error');
					goto('/');
					return;
				}
				throw streamsResponse;
			}

			const { streams } = await streamsResponse.json();

			// Generate FIT file from streams
			let fitFile: Uint8Array;
			try {
				fitFile = generateFitFromStrava(activity, streams);
			} catch (error) {
				console.error('FIT generation error:', error);
				throw new Error('Unable to generate activity file');
			}

			// Remove selected segments
			if (selectedSegments.length > 0) {
				try {
					const intervals = extractIntervals(activity.segment_efforts || [], Array.from(selectedSegments));
					
					// Get sport/sub_sport from activity type
					const sportType = activity.sport_type || activity.type;
					const { sport, sub_sport } = getSportInfo(sportType);
					
					const result = removeFitIntervals(fitFile, intervals, sport, sub_sport);
					fitFile = result.fitFile;
				} catch (error) {
					console.error('FIT editing error:', error);
					throw new Error('Unable to process activity intervals');
				}
			}

			// Download the file
			const blob = new Blob([fitFile as BlobPart], { type: 'application/octet-stream' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${activity.name.replace(/[^a-z0-9]/gi, '_')}_cleaned.${format}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			
			toasts.show(`Activity downloaded as ${format.toUpperCase()}`, 'success', 3000);
		} catch (error) {
			console.error('Download failed:', error);
			await handleApiError(error, `Failed to download cleaned ${format.toUpperCase()} file`);
		} finally {
			processing = false;
		}
	}

	function getSportInfo(sportType: string): { sport: number; sub_sport: number } {
		const type = sportType?.toLowerCase() || '';
		const mapping: { [key: string]: { sport: number; sub_sport: number } } = {
			'ride': { sport: 2, sub_sport: 0 },
			'mountainbikeride': { sport: 2, sub_sport: 8 },
			'gravelride': { sport: 2, sub_sport: 46 },
			'alpineski': { sport: 13, sub_sport: 0 },
			'backcountryski': { sport: 13, sub_sport: 2 },
			'snowboard': { sport: 14, sub_sport: 0 },
			'nordicski': { sport: 12, sub_sport: 0 },
			'run': { sport: 1, sub_sport: 0 },
			'trailrun': { sport: 1, sub_sport: 3 },
			'hike': { sport: 17, sub_sport: 0 },
			'walk': { sport: 11, sub_sport: 0 }
		};
		return mapping[type] || { sport: 0, sub_sport: 0 };
	}

	async function handleUpload() {
		showUploadModal = true;
		uploadStep = 'saving';
		uploadProgress = 10;
		uploadMessage = 'Generating modified FIT file...';
		uploadError = null;
		newActivityUrl = null;
		attemptNumber = 0;
		secondsRemaining = 0;
		
		try {
			// Fetch activity streams
			const streamsResponse = await cachedFetch(`/api/activity/${activity.id}/streams`, { ttl: CACHE_TTL.STREAMS });
			if (!streamsResponse.ok) {
				throw new Error('Failed to fetch activity streams');
			}
			const { streams } = await streamsResponse.json();

			// Generate FIT file from activity and streams
			let fitFile = generateFitFromStrava(activity, streams);
			let activityStats = undefined;

			// Remove selected segments if any
			if (selectedSegments.length > 0) {
				const intervals = extractIntervals(activity.segment_efforts || [], selectedSegments);
				const { sport, sub_sport } = getSportInfo(activity.sport_type);
				const result = removeFitIntervals(fitFile, intervals, sport, sub_sport);
				fitFile = result.fitFile;
				activityStats = result.stats;
			}
			
			await runUploadWorkflow(
				{
					activityId: activity.id,
					selectedSegments: new Set(selectedSegments),
					fitFile,
					stats: activityStats,
					useImperial: activity.athlete?.measurement_preference === 'feet',
					metadata: {
						name: activity.name,
						description: activity.description,
						gear_id: activity.gear_id,
						trainer: activity.trainer,
						commute: activity.commute,
						hide_from_home: activity.hide_from_home
					}
				},
				{
					onStateChange: (state) => {
					if (state.step !== undefined) uploadStep = state.step;
					if (state.progress !== undefined) uploadProgress = state.progress;
					if (state.message !== undefined) uploadMessage = state.message;
					if (state.error !== undefined) uploadError = state.error;
					if (state.newActivityUrl !== undefined) newActivityUrl = state.newActivityUrl;
					if (state.attemptNumber !== undefined) attemptNumber = state.attemptNumber;
					if (state.secondsRemaining !== undefined) secondsRemaining = state.secondsRemaining;
					},
					onWaitForConfirmation: () => {
						return new Promise<void>((resolve) => {
							confirmDeletionResolver = resolve;
						});
					}
				}
			);
		} catch (error) {
			// Error already handled by workflow
		} finally {
			confirmDeletionResolver = null;
		}
	}

	function closeUploadModal(confirmed: boolean = false) {
		if (uploadStep === 'ready' && confirmDeletionResolver) {
			if (confirmed) {
				// User confirmed deletion, continue workflow
				confirmDeletionResolver();
			} else {
				// User cancelled - reset state
				showUploadModal = false;
				uploadStep = 'idle';
				uploadProgress = 0;
				uploadMessage = '';
				uploadError = null;
				newActivityUrl = null;
				attemptNumber = 0;
				secondsRemaining = 0;
				confirmDeletionResolver = null;
			}
		} else {
			// Normal close - reset all state
			const wasComplete = uploadStep === 'complete';
			showUploadModal = false;
			uploadStep = 'idle';
			uploadProgress = 0;
			uploadMessage = '';
			uploadError = null;
			newActivityUrl = null;
			attemptNumber = 0;
			secondsRemaining = 0;
			confirmDeletionResolver = null;
			
			if (wasComplete) {
				// Redirect to select page after successful upload
				setTimeout(() => goto('/select'), 500);
			}
		}
	}


</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
	{#if loading || !componentsReady}
		<div class="flex items-center justify-center h-screen absolute inset-0 bg-slate-50 dark:bg-slate-900 z-[9999]">
			<div class="text-center">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
				<p class="text-sm sm:text-base text-slate-600 dark:text-slate-400">Loading activity...</p>
			</div>
		</div>
	{/if}
	
	{#if activity}
		<!-- Mobile Layout (< lg) -->
		<div class="lg:hidden flex flex-col h-screen max-h-screen overflow-hidden">
			<!-- Back Button - Top Left -->
			<button
				onclick={() => goto('/select')}
				class="absolute top-4 left-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-lg p-2 transition-colors z-[1000]"
				title="Back to activities"
			>
				<ArrowLeft class="w-5 h-5" />
			</button>
			
			<!-- Sticky Map & Chart -->
			<div class="flex-shrink-0 relative z-10">
				<!-- Map -->
				<div class="h-48">
					{#if browser && activity}
						<MapView {activity} {selectedSegments} {hoveredSegment} {hoverPoint} />
					{:else}
						<div class="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
							<p class="text-sm text-slate-500 dark:text-slate-400">Loading map...</p>
						</div>
					{/if}
				</div>

				<!-- Elevation Chart -->
				{#if browser && activity?.streams?.altitude}
				<div class="h-32 bg-white dark:bg-slate-800 border-t border-b border-slate-200 dark:border-slate-700 py-0.5">
						<ElevationChart 
							{activity} 
							{selectedSegments}
							{hoveredSegment}						layout="mobile"							on:hoverPoint={(e) => hoverPoint = e.detail}
						/>
					</div>
				{/if}
			</div>

			<!-- Scrollable Segment List -->
			<div class="flex-1 overflow-y-auto bg-white dark:bg-slate-800">
				<div class="p-4">
					<div class="flex items-center justify-between mb-3">
						<div class="flex gap-1.5">
							<a
								href="https://www.strava.com/segments/new?id={activity.id}"
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-primary-200 dark:border-primary-700"
								title="Create new segment on Strava"
							>
								<Plus class="w-3.5 h-3.5" />
								Create
							</a>
							<button
								onclick={refreshActivity}
								class="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-primary-200 dark:border-primary-700"
								disabled={refreshingSegments}
								title="Refresh segments"
							>
								<RefreshCw class="w-3.5 h-3.5 {refreshingSegments ? 'animate-spin' : ''}" />
								Refresh
							</button>
							{#if selectedSegments.length > 0}
								<button
									onclick={handleDeselectAll}
									class="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-600"
									title="Clear all {selectedSegments.length} selected segments"
								>
									<X class="w-3.5 h-3.5" />
									Clear
								</button>
							{/if}
						</div>
					</div>

					{#if refreshingSegments}
						<div class="flex flex-col items-center justify-center py-12">
							<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3"></div>
							<p class="text-sm text-slate-600 dark:text-slate-400">Refreshing segments...</p>
						</div>
					{:else if activity}
						<SegmentList
							segments={activity.segment_efforts || []}
							{selectedSegments}
							{segmentElevationGains}
							useImperial={activity.athlete?.measurement_preference === 'feet'}
							on:segmentToggle={handleSegmentToggle}
							on:selectAllInstances={handleSelectAllInstances}
							on:segmentHover={handleSegmentHover}
						/>
					{/if}
				</div>
			</div>

			<!-- Bottom Actions - Sticky -->
			<div class="sticky bottom-0 flex-shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-3 shadow-lg">
				<!-- Stats - Grid layout with before/after columns -->
				<div class="mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
					<div class="grid grid-cols-2 gap-3 text-xs">
						<!-- Before Column -->
						<div class="space-y-2">
							<div class="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Before</div>
							<!-- Distance -->
							<div class="flex items-center gap-1.5">
								<Activity class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
								<span class="font-semibold text-slate-900 dark:text-slate-100">
									{activity.athlete?.measurement_preference === 'feet' 
										? (activity.distance / 1609.34).toFixed(1)
										: (activity.distance / 1000).toFixed(1)}
								</span>
								<span class="text-slate-500 dark:text-slate-400">
									{activity.athlete?.measurement_preference === 'feet' ? 'mi' : 'km'}
								</span>
							</div>
							<!-- Elevation -->
							<div class="flex items-center gap-1.5">
								<TrendingUp class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
								<span class="font-semibold text-slate-900 dark:text-slate-100">
									{activity.athlete?.measurement_preference === 'feet'
										? Math.round(activity.total_elevation_gain * 3.28084)
										: Math.round(activity.total_elevation_gain)}
								</span>
								<span class="text-slate-500 dark:text-slate-400">
									{activity.athlete?.measurement_preference === 'feet' ? 'ft' : 'm'}
								</span>
							</div>
							<!-- Moving Time -->
							<div class="flex items-center gap-1.5">
								<Clock class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
								<span class="font-semibold text-slate-900 dark:text-slate-100">
									{(() => {
										const hours = Math.floor(activity.moving_time / 3600);
										const mins = Math.floor((activity.moving_time % 3600) / 60);
										return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${mins}`;
									})()}
								</span>
								<span class="text-slate-500 dark:text-slate-400">
								{activity.moving_time >= 3600 ? 'h:m' : 'min'}
							</span>
						</div>
					</div>
					<!-- After Column -->
					<div class="space-y-2">
						<div class="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">After</div>
						<!-- Distance -->
						<div class="flex items-center gap-1.5">
							<Activity class="w-3.5 h-3.5 {selectedSegments.length > 0 ? 'text-primary-500 dark:text-primary-400' : 'text-slate-300 dark:text-slate-600'} flex-shrink-0" />
							{#if selectedSegments.length > 0}
								<span class="font-semibold text-primary-600 dark:text-primary-500">
									{activity.athlete?.measurement_preference === 'feet'
									? ((activity.distance - removedStats.distance) / 1609.34).toFixed(1)
									: ((activity.distance - removedStats.distance) / 1000).toFixed(1)}
								</span>
								<span class="text-slate-500 dark:text-slate-400">
									{activity.athlete?.measurement_preference === 'feet' ? 'mi' : 'km'}
								</span>
							{:else}
								<span class="font-semibold text-slate-400 dark:text-slate-500">—</span>
							{/if}
						</div>
						<!-- Elevation -->
						<div class="flex items-center gap-1.5">
							<TrendingUp class="w-3.5 h-3.5 {selectedSegments.length > 0 ? 'text-primary-500 dark:text-primary-400' : 'text-slate-300 dark:text-slate-600'} flex-shrink-0" />
							{#if selectedSegments.length > 0}
								<span class="font-semibold text-primary-600 dark:text-primary-500">
									{(() => {
										const newElevation = activity.total_elevation_gain - removedStats.elevation;
										return activity.athlete?.measurement_preference === 'feet'
											? Math.round(newElevation * 3.28084)
											: Math.round(newElevation);
									})()}
								</span>
								<span class="text-slate-500 dark:text-slate-400">
									{activity.athlete?.measurement_preference === 'feet' ? 'ft' : 'm'}
								</span>
							{:else}
								<span class="font-semibold text-slate-400 dark:text-slate-500">—</span>
							{/if}
						</div>
						<!-- Moving Time -->
						<div class="flex items-center gap-1.5">
							<Clock class="w-3.5 h-3.5 {selectedSegments.length > 0 ? 'text-primary-500 dark:text-primary-400' : 'text-slate-300 dark:text-slate-600'} flex-shrink-0" />
							{#if selectedSegments.length > 0}
								<span class="font-semibold text-primary-600 dark:text-primary-500">
									{(() => {
									const newTime = activity.moving_time - removedStats.time;
										const hours = Math.floor(newTime / 3600);
										const mins = Math.floor((newTime % 3600) / 60);
										return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${mins}`;
									})()}
								</span>
								<span class="text-slate-500 dark:text-slate-400">
									{activity.moving_time >= 3600 ? 'h:m' : 'min'}
								</span>
							{:else}
								<span class="font-semibold text-slate-400 dark:text-slate-500">—</span>
							{/if}
						</div>
					</div>
				</div>
			</div>

				<!-- Action Buttons -->
				<div class="flex gap-2 mb-2">
					<button
					onclick={() => handleDownload('fit')}
					disabled={processing || selectedSegments.length === 0}
					class="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 text-sm rounded-lg transition-colors"
				>
					<Download class="w-4 h-4" />
					Download FIT
				</button>
				<button
					onclick={handleUpload}
					disabled={processing || selectedSegments.length === 0}
					class="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 text-sm rounded-lg transition-colors"
				>
					<Upload class="w-4 h-4" />
					Upload
				</button>
			</div>
		</div>
	</div>

	<!-- Desktop Layout (>= lg) -->
	<div class="hidden lg:flex h-screen max-h-screen overflow-hidden">
		<!-- Sidebar -->
			<div class="w-96 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
				<div class="p-6 border-b border-slate-200 dark:border-slate-700">
					<button
						onclick={() => goto('/select')}
						class="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-4 transition-colors"
					>
						<ArrowLeft class="w-4 h-4" />
						Back to activities
					</button>
					<h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Select Segments</h1>
					<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">Choose which uplift segments to remove</p>
					<div class="flex gap-2">
						<a
							href="https://www.strava.com/segments/new?id={activity.id}"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-3 py-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-primary-200 dark:border-primary-700"
						>
							<Plus class="w-4 h-4" />
							Create
						</a>
						<button
							onclick={refreshActivity}
							class="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-3 py-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-primary-200 dark:border-primary-700"
							disabled={refreshingSegments}
						>
							<RefreshCw class="w-4 h-4 {refreshingSegments ? 'animate-spin' : ''}" />
							Refresh
						</button>
						{#if selectedSegments.length > 0}
							<button
								onclick={handleDeselectAll}
								class="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-600"
							>
								<X class="w-4 h-4" />
								Clear
							</button>
						{/if}
					</div>
				</div>

				<div class="flex-1 overflow-y-auto p-6">
					{#if refreshingSegments}
						<div class="flex flex-col items-center justify-center py-12">
							<div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4"></div>
							<p class="text-slate-600 dark:text-slate-400">Refreshing segments...</p>
						</div>
					{:else if activity}
						<SegmentList
							segments={activity.segment_efforts || []}
							{selectedSegments}
							{segmentElevationGains}
							useImperial={activity.athlete?.measurement_preference === 'feet'}
							on:segmentToggle={handleSegmentToggle}
							on:selectAllInstances={handleSelectAllInstances}
							on:segmentHover={handleSegmentHover}
						/>
					{/if}
				</div>
			</div>

			<!-- Map with stats -->
			<div class="flex-1 flex flex-col overflow-hidden">
				<!-- Map -->
				<div class="flex-1 min-h-0">
					{#if browser && activity}
						<MapView {activity} {selectedSegments} {hoveredSegment} {hoverPoint} />
					{:else}
						<div class="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
							<p class="text-slate-500 dark:text-slate-400">Loading map...</p>
						</div>
					{/if}
				</div>

				<!-- Elevation Chart -->
				{#if browser && activity?.streams?.altitude}
				<div class="h-64 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-2">
						<ElevationChart 
							{activity} 
							{selectedSegments}
							{hoveredSegment}						layout="desktop"							on:hoverPoint={(e) => hoverPoint = e.detail}
						/>
					</div>
				{/if}
				
				<!-- Stats comparison and action buttons at bottom -->
				<div class="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6">
					<div class="grid grid-cols-[1fr,200px] gap-8 items-start">
						<StatsComparison {activity} {selectedSegments} {removedStats} />
							<div class="flex flex-col gap-3 min-w-[200px]">
								<button
								onclick={() => handleDownload('fit')}
								disabled={processing || selectedSegments.length === 0}
							class="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
							>
								<Download class="w-4 h-4" />
								Download FIT
</button>
								
								<!-- Separator -->
								<div class="border-t border-slate-300 dark:border-slate-600 my-1"></div>
								
								<button
									onclick={handleUpload}
									disabled={processing || selectedSegments.length === 0}
								class="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
								>
									<Upload class="w-4 h-4" />
									Upload to Strava
								</button>
							</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>


<UploadModal 
	isOpen={showUploadModal} 
	onClose={(confirmed) => closeUploadModal(confirmed)}
	step={uploadStep}
	progress={uploadProgress}
	message={uploadMessage}
	error={uploadError}
	newActivityUrl={newActivityUrl}
	attemptNumber={attemptNumber}
	secondsRemaining={secondsRemaining}
/>
