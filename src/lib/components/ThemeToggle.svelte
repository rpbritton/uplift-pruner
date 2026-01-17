<script lang="ts">
	import { Moon, Sun } from 'lucide-svelte';
	import { theme } from '$lib/stores/theme';
	import { onMount } from 'svelte';
	
	let isDark = $state(false);
	
	onMount(() => {
		const unsubscribe = theme.subscribe(value => {
			isDark = value === 'dark';
		});
		return unsubscribe;
	});
	
	function toggleTheme() {
		theme.toggle();
	}
</script>

<div class="flex items-center gap-3">
	<Sun class="w-4 h-4 text-slate-500 dark:text-slate-600" />
	<button
		onclick={toggleTheme}
		class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
		class:bg-primary-600={isDark}
		class:bg-slate-300={!isDark}
		role="switch"
		aria-checked={isDark}
		title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	>
		<span
			class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
			class:translate-x-6={isDark}
			class:translate-x-1={!isDark}
		></span>
	</button>
	<Moon class="w-4 h-4 text-slate-500 dark:text-slate-400" />
</div>
