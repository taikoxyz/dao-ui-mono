<script lang="ts">
	import '../css/app.css';
	import Header from '../components/Header.svelte';
	import AdminNavbar from '../components/AdminNavbar.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { initializeAppKit } from '$lib/wagmi';
	import { adminStore } from '../stores/admin';

	let { children } = $props();

	onMount(() => {
		// Initialize AppKit once at the app level
		initializeAppKit();

		// Initialize admin store watcher
		adminStore.init();
	});

	onDestroy(() => {
		// Cleanup admin store watcher
		adminStore.cleanup();
	});
</script>

<div class="bg-base-100 min-h-screen">
	<Header />
	<AdminNavbar />
	<main class="container mx-auto">
		{@render children?.()}
	</main>
</div>
