<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Mountain, TrendingUp, Copy, Lock } from 'lucide-svelte';
	import type { SegmentEffort } from '$lib/strava';
	import { COLORS } from '$lib/constants/colors';

	interface Props {
		segments: SegmentEffort[];
		selectedSegments: number[];
		useImperial?: boolean;
		segmentElevationGains?: number[];
	}

	let {
		segments,
		selectedSegments,
		useImperial = false,
		segmentElevationGains = []
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		segmentToggle: { index: number; selected: boolean };
		selectAllInstances: { segmentId: number };
		segmentHover: number[] | null;
	}>();

	let touchTimer: number | null = null;
	let activeTouch = $state<number | null>(null);

	function handleToggle(index: number, checked: boolean) {
		dispatch('segmentToggle', { index, selected: checked });
	}

	function handleSelectAllInstances(segmentId: number, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		dispatch('selectAllInstances', { segmentId });
	}

	function handleMouseEnter(index: number) {
		dispatch('segmentHover', [index]);
	}

	function handleMouseLeave() {
		dispatch('segmentHover', null);
	}

	// Touch handlers for mobile
	function handleTouchStart(index: number, event: TouchEvent) {
		// Clear any existing timer
		if (touchTimer) {
			clearTimeout(touchTimer);
		}

		// Start a timer for long press (300ms)
		touchTimer = setTimeout(() => {
			activeTouch = index;
			dispatch('segmentHover', [index]);
		}, 300) as unknown as number;
	}

	function handleTouchEnd() {
		// Clear timer if touch ends before long press
		if (touchTimer) {
			clearTimeout(touchTimer);
			touchTimer = null;
		}

		// Clear hover after a delay to see the effect
		setTimeout(() => {
			if (activeTouch !== null) {
				dispatch('segmentHover', null);
				activeTouch = null;
			}
		}, 2000);
	}

	function handleTouchMove() {
		// Cancel hover if user scrolls
		if (touchTimer) {
			clearTimeout(touchTimer);
			touchTimer = null;
		}
		if (activeTouch !== null) {
			dispatch('segmentHover', null);
			activeTouch = null;
		}
	}

	function handleAllButtonMouseEnter(segmentId: number, event: MouseEvent) {
		event.stopPropagation();
		const indices: number[] = [];
		segments.forEach((segment, index) => {
			if (segment.segment.id === segmentId) {
				indices.push(index);
			}
		});
		dispatch('segmentHover', indices);
	}

	function handleAllButtonMouseLeave(event: MouseEvent) {
		event.stopPropagation();
		// When leaving the "All" button, restore the single segment hover for the parent label
		const label = (event.target as HTMLElement).closest('label');
		if (label) {
			const segmentIndex = parseInt(label.getAttribute('data-segment-index') || '0');
			dispatch('segmentHover', [segmentIndex]);
		}
	}

	function formatDistance(meters: number): string {
		if (useImperial) {
			const miles = meters / 1609.34;
			return miles.toFixed(1) + ' mi';
		}
		return (meters / 1000).toFixed(1) + ' km';
	}

	function formatElevation(meters: number): string {
		if (useImperial) {
			return Math.round(meters * 3.28084) + ' ft';
		}
		return Math.round(meters) + 'm';
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Count instances of each segment
	function getInstanceCount(segmentId: number): number {
		return segments.filter((s) => s.segment.id === segmentId).length;
	}
</script>

<div class="space-y-2">
	{#if segments.length === 0}
		<div class="text-center py-12">
			<Mountain class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
			<p class="text-slate-600 dark:text-slate-400">No matched segments found in this activity</p>
		</div>
	{:else}
		{#each segments as segment, index}
			{@const instanceCount = getInstanceCount(segment.segment.id)}
			<label
				class="block p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
				class:ring-2={activeTouch === index}
				class:ring-primary-500={activeTouch === index}
				onmouseenter={() => handleMouseEnter(index)}
				onmouseleave={handleMouseLeave}
				ontouchstart={(e) => handleTouchStart(index, e)}
				ontouchend={handleTouchEnd}
				ontouchmove={handleTouchMove}
				ontouchcancel={handleTouchEnd}
				data-segment-index={index}
			>
				<div class="flex items-start gap-3">
					<input
						type="checkbox"
						checked={selectedSegments.includes(index)}
						onchange={(e) => handleToggle(index, e.currentTarget.checked)}
						class="mt-1 w-4 h-4 rounded accent-primary-600 dark:accent-primary-500 opacity-90 dark:opacity-80"
						style="accent-color: {COLORS.baseHex};"
					/>
					<div class="flex-1">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-1.5 flex-1">
								<h3 class="font-semibold text-slate-900 dark:text-slate-100">{segment.name}</h3>
								{#if segment.segment.private}
									<span
										class="inline-block"
										title="Private segment - Only you can see and select this segment"
									>
										<Lock class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
									</span>
								{/if}
							</div>
							{#if instanceCount > 1}
								<button
									onclick={(e) => handleSelectAllInstances(segment.segment.id, e)}
									onmouseenter={(e) => handleAllButtonMouseEnter(segment.segment.id, e)}
									onmouseleave={handleAllButtonMouseLeave}
									class="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors whitespace-nowrap flex-shrink-0"
									title="Select all {instanceCount} instances"
								>
									<Copy class="w-3 h-3" />
									All {instanceCount}x
								</button>
							{/if}
						</div>
						<div class="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
							<span>{formatDistance(segment.distance)}</span>
							<span class="flex items-center gap-1">
								<TrendingUp class="w-3 h-3" />
								{formatElevation(segmentElevationGains[index] || 0)}
							</span>
							<span>{formatTime(segment.elapsed_time)}</span>
						</div>
					</div>
				</div>
			</label>
		{/each}
	{/if}
</div>
