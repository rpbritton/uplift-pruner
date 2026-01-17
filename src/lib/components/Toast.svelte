<script lang="ts">
	import { toasts } from '$lib/stores/toast';
	import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	const iconMap = {
		success: CheckCircle,
		error: XCircle,
		warning: AlertTriangle,
		info: Info
	};

	const colorMap = {
		success: 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
		error: 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
		warning: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
		info: 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
	};
</script>

<div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-md">
	{#each $toasts as toast (toast.id)}
		<div
			transition:fly={{ x: 300, duration: 300 }}
			class="flex items-start gap-3 p-4 rounded-lg border shadow-lg {colorMap[toast.type]}"
		>
			<svelte:component this={iconMap[toast.type]} class="w-5 h-5 flex-shrink-0 mt-0.5" />
			<p class="flex-1 text-sm font-medium">{toast.message}</p>
			<button
				onclick={() => toasts.dismiss(toast.id)}
				class="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
				aria-label="Dismiss"
			>
				<X class="w-4 h-4" />
			</button>
		</div>
	{/each}
</div>
