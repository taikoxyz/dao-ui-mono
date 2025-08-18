<script lang="ts">
	import '../css/app.css';
	import Header from '../components/Header.svelte';

	let { children } = $props();
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<Header />
	<main>
		{@render children?.()}
	</main>
</div>
