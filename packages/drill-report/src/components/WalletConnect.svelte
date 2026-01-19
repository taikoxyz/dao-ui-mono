<script lang="ts">
	import { onMount } from 'svelte';
	import { initializeAppKit } from '$lib/wagmi';

	let container: HTMLDivElement;
	let isInitialized = $state(false);
	let retryCount = 0;

	function createButton() {
		if (!container || !window.customElements.get('appkit-button')) {
			if (retryCount < 10) {
				retryCount++;
				setTimeout(createButton, 500);
			}
			return;
		}

		// Clear container and add button
		container.innerHTML = '';
		const button = document.createElement('appkit-button');
		container.appendChild(button);
		isInitialized = true;
	}

	onMount(() => {
		// Initialize AppKit
		initializeAppKit();

		// Try to create the button
		setTimeout(createButton, 300);

		return () => {
			// Cleanup
			if (container) {
				container.innerHTML = '';
			}
		};
	});
</script>

<div bind:this={container} class="wallet-button-container">
	{#if !isInitialized}
		<button class="btn btn-primary" disabled> Loading wallet... </button>
	{/if}
</div>

<style>
	.wallet-button-container {
		display: inline-block;
	}
</style>
