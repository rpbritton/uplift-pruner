<script lang="ts">
	import ActivityInput from '$lib/components/ActivityInput.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { goto, replaceState } from '$app/navigation';
	import { LogOut, User, ExternalLink, X } from 'lucide-svelte';
	import type { Athlete } from '$lib/strava';
	import { page } from '$app/stores';
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let loading = false;
	let error = $state('');
	let athlete = $state<Athlete | null>(null);

	// Use $effect to reactively check for error in URL
	$effect(() => {
		const errorParam = $page.url.searchParams.get('error');
		if (errorParam) {
			error = decodeURIComponent(errorParam);
			// Clean up URL using SvelteKit's replaceState
			replaceState('/select', {});
		}
	});

	function handleActivitySelected(event: CustomEvent<string>) {
		const activityId = event.detail;
		// Navigate directly - edit page will handle loading
		goto(`/edit?id=${activityId}`);
	}

	function handleAthleteLoaded(event: CustomEvent<any>) {
		athlete = event.detail;
	}

	async function handleLogout() {
		// Clear cookies by calling logout endpoint
		await fetch('/api/auth/logout', { method: 'POST' });
		// Clear session storage
		sessionStorage.clear();
		// Redirect to home
		goto('/');
	}
</script>

<svelte:head>
	<title>Select Activity - Uplift Pruner</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
	<div class="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
		<!-- Header -->
		<div
			class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8"
		>
			<div class="flex items-center gap-2 sm:gap-3">
				<img src="/icon.svg" alt="Uplift Pruner" class="w-12 h-12 sm:w-16 sm:h-16" />
				<h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
					Uplift Pruner
				</h1>
			</div>
			{#if athlete}
				<div
					class="flex items-center gap-2 sm:gap-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2 self-stretch sm:self-auto"
				>
					<div class="flex items-center gap-2 flex-1 sm:flex-initial min-w-0">
						{#if athlete.profile_medium}
							<img
								src={athlete.profile_medium}
								alt="Profile"
								class="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
							/>
						{:else}
							<div
								class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0"
							>
								<User class="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400" />
							</div>
						{/if}
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate"
							>{athlete.firstname} {athlete.lastname}</span
						>
					</div>
					<div class="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
					<button
						onclick={handleLogout}
						class="flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-red-600 transition-colors flex-shrink-0"
					>
						<LogOut class="w-4 h-4" />
						<span class="text-sm font-medium">Logout</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- Info box -->
		<div
			class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 mb-6 sm:mb-8"
		>
			<p class="text-sm sm:text-base text-slate-700 dark:text-slate-300 mb-4">
				Remove uplift segments from your Strava activities.
			</p>
			<div class="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
				<div class="text-center">
					<div class="font-semibold text-primary-600 dark:text-primary-400 mb-1">1. Select</div>
					<div class="text-slate-600 dark:text-slate-400">Choose an activity</div>
				</div>
				<div class="text-center">
					<div class="font-semibold text-primary-600 dark:text-primary-400 mb-1">2. Edit</div>
					<div class="text-slate-600 dark:text-slate-400">Pick segments to remove</div>
				</div>
				<div class="text-center">
					<div class="font-semibold text-primary-600 dark:text-primary-400 mb-1">3. Save</div>
					<div class="text-slate-600 dark:text-slate-400">Download or upload</div>
				</div>
			</div>
		</div>

		<!-- Error Message -->
		{#if error}
			<div
				transition:slide={{ duration: 300, easing: quintOut }}
				class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 sm:mb-8 flex items-start justify-between"
			>
				<p class="text-sm text-red-800 dark:text-red-300 flex-1">{error}</p>
				<button
					onclick={() => (error = '')}
					class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors ml-4 flex-shrink-0"
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		{/if}

		<!-- Activity Selection -->
		<div
			class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6"
		>
			<div class="flex items-center justify-between mb-4 gap-2">
				<h2 class="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
					Select Activity
				</h2>
				<a
					href="https://www.strava.com/athlete/training"
					target="_blank"
					rel="noopener noreferrer"
					class="text-xs sm:text-sm text-slate-500 hover:text-primary-600 transition-colors flex items-center gap-1 flex-shrink-0"
					title="View all activities on Strava"
				>
					<ExternalLink class="w-4 h-4" />
					<span class="hidden sm:inline">View on Strava</span>
				</a>
			</div>
			<ActivityInput
				on:activitySelected={handleActivitySelected}
				on:athleteLoaded={handleAthleteLoaded}
			/>

			{#if loading}
				<div class="text-center mt-8">
					<div
						class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"
					></div>
					<p class="text-sm sm:text-base text-slate-600 dark:text-slate-400">Loading activity...</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Footer info -->
	<div class="mt-auto pb-6 sm:pb-8 text-center">
		<div class="mb-3 text-xs text-slate-400 dark:text-slate-500">
			Powered by <a
				href="https://www.strava.com"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Strava</a
			>
			·
			<a
				href="https://www.strava.com/settings/apps"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Manage Apps</a
			>
		</div>
		<div
			class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-400 dark:text-slate-500"
		>
			<ThemeToggle />
			<a
				href="https://buymeacoffee.com/rbritton"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
			>
				Donate
			</a>
			<a
				href="https://github.com/rpbritton/uplift-pruner/blob/main/PRIVACY.md"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
			>
				Privacy
			</a>
			<a
				href="https://github.com/rpbritton/uplift-pruner"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
			>
				Source
			</a>
		</div>
	</div>
</div>
