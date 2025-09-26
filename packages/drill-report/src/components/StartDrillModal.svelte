<script lang="ts">
	import { startDrill } from '../services/drill-admin';
	import { adminStore } from '../stores/admin';
	import type { Address } from 'viem';
	import { isAddressEqual } from 'viem';
	import securityCouncilProfiles from '../../../ui/src/data/security-council-profiles.json';

	interface Props {
		show: boolean;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { show = $bindable(), onClose, onSuccess }: Props = $props();

	let selectedTargets = $state<Set<string>>(new Set());
	let includeMyself = $state(false);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let txHash = $state<string | null>(null);

	let connectedAddress = $state<Address | undefined>(undefined);

	// Create a map of addresses to names from the profiles
	const profiles = securityCouncilProfiles.map((profile: any) => ({
		address: profile.address.toLowerCase(),
		name: profile.name,
	}));

	// Get connected address when modal shows
	$effect(() => {
		if (show && $adminStore.address) {
			connectedAddress = $adminStore.address;
		}
	});

	function toggleTarget(address: string) {
		const newSet = new Set(selectedTargets);
		if (newSet.has(address)) {
			newSet.delete(address);
		} else {
			newSet.add(address);
		}
		selectedTargets = newSet;
	}

	function selectAll() {
		selectedTargets = new Set(profiles.map(p => p.address));
	}

	function deselectAll() {
		selectedTargets = new Set();
	}

	async function handleStartDrill() {
		// Build the final targets list
		let finalTargets = Array.from(selectedTargets);

		// Add connected wallet if requested and not already included
		if (includeMyself && connectedAddress) {
			const alreadyIncluded = finalTargets.some(target =>
				isAddressEqual(target as Address, connectedAddress)
			);

			if (!alreadyIncluded) {
				finalTargets.push(connectedAddress as string);
			}
		}

		if (finalTargets.length === 0) {
			error = 'Please select at least one target';
			return;
		}

		if (finalTargets.length > 12) {
			error = 'Maximum 12 targets allowed';
			return;
		}

		isSubmitting = true;
		error = null;
		txHash = null;

		try {
			const result = await startDrill(finalTargets as Address[]);

			if (result.success) {
				txHash = result.hash;
				setTimeout(() => {
					onSuccess();
					handleClose();
				}, 2000);
			} else {
				error = result.error || 'Failed to start drill';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to start drill';
		} finally {
			isSubmitting = false;
		}
	}

	function handleClose() {
		if (!isSubmitting) {
			selectedTargets = new Set();
			includeMyself = false;
			error = null;
			txHash = null;
			onClose();
		}
	}
</script>

{#if show}
	<div class="modal modal-open">
		<div class="modal-box max-w-3xl">
			<h3 class="text-lg font-bold">Start New Drill</h3>

			{#if error}
				<div class="alert alert-error mt-4">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{error}</span>
				</div>
			{/if}

			{#if txHash}
				<div class="alert alert-success mt-4">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<p>Drill started successfully!</p>
						<p class="text-sm">Transaction: {txHash.slice(0, 10)}...</p>
					</div>
				</div>
			{/if}

			<div class="mt-4">
				{#if connectedAddress}
					<div class="mb-4">
						<label class="label cursor-pointer justify-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
							<input
								type="checkbox"
								class="checkbox checkbox-primary"
								bind:checked={includeMyself}
								disabled={isSubmitting}
							/>
							<div class="flex flex-col">
								<span class="font-medium">Include myself as target</span>
								<span class="text-xs font-mono opacity-60">
									{connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
								</span>
							</div>
						</label>
					</div>
				{/if}

				<div class="flex justify-between items-center mb-2">
					<p class="text-sm">Select Security Council members for the drill ({selectedTargets.size + (includeMyself ? 1 : 0)}/12 selected)</p>
					<div class="btn-group">
						<button class="btn btn-xs" onclick={selectAll} disabled={isSubmitting}>
							Select All
						</button>
						<button class="btn btn-xs" onclick={deselectAll} disabled={isSubmitting}>
							Clear
						</button>
					</div>
				</div>

				<div class="max-h-96 overflow-y-auto border rounded-lg p-2">
					<div class="grid grid-cols-2 gap-2">
						{#each profiles as profile}
							<label class="label cursor-pointer justify-start gap-2">
								<input
									type="checkbox"
									class="checkbox checkbox-primary"
									checked={selectedTargets.has(profile.address)}
									onchange={() => toggleTarget(profile.address)}
									disabled={isSubmitting}
								/>
								<div class="flex flex-col">
									<span class="font-medium">{profile.name}</span>
									<span class="text-xs font-mono opacity-60">
										{profile.address.slice(0, 6)}...{profile.address.slice(-4)}
									</span>
								</div>
							</label>
						{/each}
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button
					class="btn btn-primary"
					onclick={handleStartDrill}
					disabled={isSubmitting || (selectedTargets.size === 0 && !includeMyself)}
				>
					{#if isSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
						Starting Drill...
					{:else}
						Start Drill
					{/if}
				</button>
				<button
					class="btn"
					onclick={handleClose}
					disabled={isSubmitting}
				>
					Cancel
				</button>
			</div>
		</div>
		<button onclick={handleClose} class="modal-backdrop" disabled={isSubmitting}>Close</button>
	</div>
{/if}