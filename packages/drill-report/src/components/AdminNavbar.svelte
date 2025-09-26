<script lang="ts">
	import { isAdmin, adminStore } from '../stores/admin';
	import StartDrillModal from './StartDrillModal.svelte';
	import { onMount } from 'svelte';

	let admin = $state($isAdmin);
	let adminStatus = $state($adminStore);
	let showStartDrillModal = $state(false);

	$effect(() => {
		admin = $isAdmin;
		adminStatus = $adminStore;
	});

	function handleDrillSuccess() {
		showStartDrillModal = false;
		// Could trigger a global refresh here if needed
		window.dispatchEvent(new CustomEvent('drillStarted'));
	}
</script>

{#if admin}
	<div class="bg-success/10 border-success/20 border-t">
		<div class="navbar container mx-auto min-h-0 py-2">
			<div class="flex-1">
				<div class="text-success flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span class="font-medium">You are an admin</span>
				</div>
			</div>
			<div class="flex-none">
				<button class="btn btn-success btn-sm" onclick={() => (showStartDrillModal = true)}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Start New Drill
				</button>
			</div>
		</div>
	</div>

	<StartDrillModal
		bind:show={showStartDrillModal}
		onClose={() => (showStartDrillModal = false)}
		onSuccess={handleDrillSuccess}
	/>
{/if}
