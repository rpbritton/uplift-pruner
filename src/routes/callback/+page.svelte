<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let loading = true;
	let error = '';

	onMount(async () => {
		// Parse OAuth callback parameters
		const params = new URLSearchParams(window.location.search);
		const code = params.get('code');
		const state = params.get('state');
		const errorParam = params.get('error');

		if (errorParam) {
			error = 'Authentication failed. Please try again.';
			loading = false;
			return;
		}

		if (!code) {
			error = 'Missing authorization code.';
			loading = false;
			return;
		}

		try {
			// Exchange code for tokens
			const response = await fetch('/api/auth/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code, state })
			});

			if (!response.ok) {
				throw new Error('Token exchange failed');
			}

			// Redirect to activity selection
			goto('/select');
		} catch (err) {
			error = 'Failed to authenticate. Please try again.';
			loading = false;
		}
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
	<div class="text-center">
		{#if loading}
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
			<p class="text-slate-600 dark:text-slate-400">Connecting to Strava...</p>
		{:else if error}
			<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md">
				<p class="text-red-800 dark:text-red-300 mb-4">{error}</p>
				<a href="/" class="text-primary-600 dark:text-primary-400 hover:underline">Return to home</a>
			</div>
		{/if}
	</div>
</div>
