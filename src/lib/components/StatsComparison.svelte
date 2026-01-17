<script lang="ts">
	import { Activity, Clock, TrendingUp } from 'lucide-svelte';

	interface Props {
		activity: any;
		selectedSegments: number[];
		removedStats: { distance: number; elevation: number; time: number };
	}

	let { activity, selectedSegments, removedStats }: Props = $props();

	// Determine if using imperial units (default to metric if not available)
	let useImperial = $derived(activity?.athlete?.measurement_preference === 'feet');

	function formatDistance(meters: number): string {
		if (useImperial) {
			const miles = meters / 1609.34;
			return miles.toFixed(1) + ' mi';
		}
		return (meters / 1000).toFixed(1) + ' km';
	}

	function formatElevation(meters: number): string {
		if (useImperial) {
			const feet = meters * 3.28084;
			return Math.round(feet) + ' ft';
		}
		return Math.round(meters) + ' m';
	}

	function formatTime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		if (hours > 0) {
			return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div class="grid grid-cols-2 gap-8">
	<!-- Before -->
	<div>
		<h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Before</h3>
		<div class="space-y-3">
			<div class="flex items-center gap-3">
				<Activity class="w-5 h-5 text-slate-400 dark:text-slate-500" />
				<div>
					<div class="text-sm text-slate-600 dark:text-slate-400">Distance</div>
					<div class="font-semibold text-slate-900 dark:text-slate-100">
						{formatDistance(activity.distance)}
					</div>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<TrendingUp class="w-5 h-5 text-slate-400 dark:text-slate-500" />
				<div>
					<div class="text-sm text-slate-600 dark:text-slate-400">Elevation Gain</div>
					<div class="font-semibold text-slate-900 dark:text-slate-100">
						{formatElevation(activity.total_elevation_gain)}
					</div>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<Clock class="w-5 h-5 text-slate-400 dark:text-slate-500" />
				<div>
					<div class="text-sm text-slate-600 dark:text-slate-400">Moving Time</div>
					<div class="font-semibold text-slate-900 dark:text-slate-100">
						{formatTime(activity.moving_time)}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- After -->
	<div>
		<h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">After</h3>
		{#if selectedSegments.length > 0}
			<div class="space-y-3">
				<div class="flex items-center gap-3">
					<Activity class="w-5 h-5 text-primary-600 dark:text-primary-500" />
					<div>
						<div class="text-sm text-slate-600 dark:text-slate-400">Distance</div>
						<div class="font-semibold text-primary-600 dark:text-primary-500">
							{formatDistance(activity.distance - removedStats.distance)}
						</div>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<TrendingUp class="w-5 h-5 text-primary-600 dark:text-primary-500" />
					<div>
						<div class="text-sm text-slate-600 dark:text-slate-400">Elevation Gain</div>
						<div class="font-semibold text-primary-600 dark:text-primary-500">
							{formatElevation(activity.total_elevation_gain - removedStats.elevation)}
						</div>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<Clock class="w-5 h-5 text-primary-600 dark:text-primary-500" />
					<div>
						<div class="text-sm text-slate-600 dark:text-slate-400">Moving Time</div>
						<div class="font-semibold text-primary-600 dark:text-primary-500">
							{formatTime(activity.moving_time - removedStats.time)}
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="space-y-3">
				<div class="flex items-center gap-3">
					<Activity class="w-5 h-5 text-slate-300 dark:text-slate-600" />
					<div>
						<div class="text-sm text-slate-600 dark:text-slate-400">Distance</div>
						<div class="font-semibold text-slate-400 dark:text-slate-500">—</div>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<TrendingUp class="w-5 h-5 text-slate-300 dark:text-slate-600" />
					<div>
						<div class="text-sm text-slate-600 dark:text-slate-400">Elevation Gain</div>
						<div class="font-semibold text-slate-400 dark:text-slate-500">—</div>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<Clock class="w-5 h-5 text-slate-300 dark:text-slate-600" />
					<div>
						<div class="text-sm text-slate-600 dark:text-slate-400">Moving Time</div>
						<div class="font-semibold text-slate-400 dark:text-slate-500">—</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
