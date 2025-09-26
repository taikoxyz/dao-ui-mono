<script lang="ts">
	import '../css/app.css';
	import Header from '../components/Header.svelte';
	import AdminNavbar from '../components/AdminNavbar.svelte';
	import { onMount } from 'svelte';
	import { initializeAppKit } from '$lib/wagmi';

	let { children } = $props();

	onMount(() => {
		// Initialize AppKit once at the app level
		initializeAppKit();

		// Force admin check after AppKit is initialized
		setTimeout(async () => {
			const { getAccount } = await import('@wagmi/core');
			const { config } = await import('$lib/wagmi');
			const { adminStore } = await import('../stores/admin');

			const account = getAccount(config);
			console.log('Layout - checking wallet after init:', account);
			if (account.address) {
				adminStore.checkAdmin(account.address);
			}
		}, 2000);
	});
</script>

<div class="bg-base-100 min-h-screen">
	<Header />
	<AdminNavbar />
	<main class="container mx-auto">
		{@render children?.()}
	</main>
</div>
