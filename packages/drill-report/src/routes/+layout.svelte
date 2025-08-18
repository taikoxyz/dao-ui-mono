<script lang="ts">
	import '../css/app.css';
	import Header from '../components/Header.svelte';

	let { children } = $props();
</script>

<div class="bg-base-100 min-h-screen">
	<Header />
	<main class="container mx-auto">
		{@render children?.()}
	</main>
</div>
