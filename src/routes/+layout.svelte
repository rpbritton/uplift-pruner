<script>
	import '../app.css';
	import { theme } from '$lib/stores/theme';
	import Toast from '$lib/components/Toast.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		theme.init();
	});
</script>

<slot />
<Toast />
