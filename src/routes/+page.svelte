<script lang="ts">
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
</script>

<svelte:head>
	<title>Uplift Pruner - Remove uplift segments from Strava activities</title>
	<meta name="description" content="Remove uplift segments from your Strava activities. Free, open source, and privacy-focused." />
</svelte:head>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
	<div class="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16 w-full">
		<!-- Header -->
		<div class="text-center mb-12 sm:mb-16">
			<div class="inline-flex items-center gap-2 sm:gap-3 mb-4">
				<img src="/icon.svg" alt="Uplift Pruner" class="w-14 h-14 sm:w-20 sm:h-20" />
				<h1 class="text-3xl sm:text-5xl font-bold text-slate-900 dark:text-slate-100">Uplift Pruner</h1>
			</div>
			<p class="text-base sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto px-4">
				Remove uplift segments from your Strava activities.
			</p>
		</div>

		<!-- How it works -->
		<div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 mb-8">
			<h2 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4 sm:mb-6">How it works</h2>
			<ol class="space-y-3 sm:space-y-4 text-sm sm:text-base text-slate-700 dark:text-slate-300">
				<li class="flex gap-3 sm:gap-4">
					<span
						class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center font-semibold text-sm"
						>1</span
					>
					<span>Connect your Strava account</span>
				</li>
				<li class="flex gap-3 sm:gap-4">
					<span
						class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center font-semibold text-sm"
						>2</span
					>
					<span>Select an activity and choose which uplift segments to remove</span>
				</li>
				<li class="flex gap-3 sm:gap-4">
					<span
						class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center font-semibold text-sm"
						>3</span
					>
					<span>Download the cleaned FIT file or upload it directly to Strava</span>
				</li>
			</ol>
		</div>

		<!-- CTA -->
		<div class="text-center">
			<div class="mb-4 text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto px-4">
				We'll access your activities and segments to process the data you select. <a href="https://github.com/rpbritton/uplift-pruner/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap">Learn more</a>
			</div>
			<a href="/api/auth/connect" data-sveltekit-reload>
				<img
					src="/btn_strava_connect_with_orange.svg"
					alt="Connect with Strava"
					class="inline-block h-10 sm:h-12 hover:opacity-90 transition-opacity"
				/>
			</a>
		</div>
	</div>

	<!-- Footer -->
	<div class="mt-auto pb-6 sm:pb-8 text-center">
		<div class="mb-3 text-xs text-slate-400 dark:text-slate-500">
			Powered by <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Strava</a>
			·
			<a href="https://www.strava.com/settings/apps" target="_blank" rel="noopener noreferrer" class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Manage Apps</a>
		</div>
		<div class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-400 dark:text-slate-500">
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
