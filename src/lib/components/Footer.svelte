<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
</script>

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
