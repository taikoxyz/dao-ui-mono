<script lang="ts">
	import { getAccount } from '@wagmi/core';
	import { config } from '$lib/wagmi';
	import { adminStore } from '../stores/admin';
	import { isTargetInDrill, hasPinged, pingDrill } from '../services/drill-admin';
	import type { Address } from 'viem';
	import { isAddressEqual } from 'viem';

	interface Props {
		drillNonce: bigint;
		targets: string[];
		onPingSuccess?: () => void;
	}

	let { drillNonce, targets, onPingSuccess }: Props = $props();

	let connectedAddress = $state<Address | undefined>($adminStore.address);
	let isTarget = $state(false);
	let alreadyPinged = $state(false);
	let isLoading = $state(true);
	let isPinging = $state(false);
	let error = $state<string | null>(null);
	let txHash = $state<string | null>(null);

	async function checkStatus() {
		isLoading = true;
		error = null;

		try {
			// Get connected wallet
			const account = getAccount(config);
			connectedAddress = account.address;

			console.log('PingButton - Checking status for wallet:', connectedAddress);
			console.log('PingButton - Drill nonce:', drillNonce);
			console.log('PingButton - Targets:', targets);

			if (!connectedAddress) {
				isTarget = false;
				alreadyPinged = false;
				isLoading = false;
				return;
			}

			// Check if connected wallet is a target
			const targetCheck = targets.some((target) =>
				isAddressEqual(target as Address, connectedAddress)
			);

			console.log('PingButton - Is target (local check):', targetCheck);

			// Double check with contract
			if (targetCheck) {
				isTarget = await isTargetInDrill(drillNonce, connectedAddress);
				console.log('PingButton - Is target (contract check):', isTarget);

				if (isTarget) {
					// Check if already pinged
					alreadyPinged = await hasPinged(drillNonce, connectedAddress);
					console.log('PingButton - Already pinged:', alreadyPinged);
				}
			} else {
				isTarget = false;
				alreadyPinged = false;
			}
		} catch (err) {
			console.error('Error checking ping status:', err);
			error = 'Failed to check status';
		} finally {
			isLoading = false;
		}
	}

	async function handlePing() {
		if (!connectedAddress || isPinging || alreadyPinged) return;

		isPinging = true;
		error = null;
		txHash = null;

		try {
			const result = await pingDrill(drillNonce);

			if (result.success) {
				txHash = result.hash;
				alreadyPinged = true;

				// Notify parent of success
				if (onPingSuccess) {
					setTimeout(() => {
						onPingSuccess();
					}, 2000);
				}
			} else {
				error = result.error || 'Failed to ping drill';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to ping drill';
		} finally {
			isPinging = false;
		}
	}

	// Watch for admin store changes (which handles wallet connection)
	$effect(() => {
		connectedAddress = $adminStore.address;
		if (connectedAddress || drillNonce) {
			checkStatus();
		}
	});
</script>

{#if isLoading}
	<!-- Loading state -->
	<div class="flex items-center gap-2 text-sm opacity-60">
		<span class="loading loading-spinner loading-sm"></span>
		Checking eligibility...
	</div>
{:else if !connectedAddress}
	<!-- No wallet connected -->
	<div class="text-sm opacity-60">Connect wallet to ping</div>
{:else if isTarget}
	<!-- Is a target for this drill -->
	<div class="flex flex-col gap-2">
		{#if alreadyPinged}
			<div class="alert alert-success">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<div>
					<h3 class="font-bold">Already Pinged!</h3>
					<div class="text-xs">You have successfully pinged this drill</div>
					{#if txHash}
						<div class="text-xs opacity-70">Tx: {txHash.slice(0, 10)}...</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="alert alert-warning">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<div>
					<h3 class="font-bold">Action Required!</h3>
					<div class="text-xs">
						You are a target for this drill. Please ping to confirm participation.
					</div>
				</div>
			</div>

			{#if error}
				<div class="alert alert-error">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{error}</span>
				</div>
			{/if}

			{#if txHash}
				<div class="alert alert-success">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<div>
						<p>Ping successful!</p>
						<p class="text-xs opacity-70">Tx: {txHash.slice(0, 10)}...</p>
					</div>
				</div>
			{/if}

			<button class="btn btn-primary btn-lg" onclick={handlePing} disabled={isPinging}>
				{#if isPinging}
					<span class="loading loading-spinner"></span>
					Pinging...
				{:else}
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
							d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
						/>
					</svg>
					Ping Drill
				{/if}
			</button>
		{/if}
	</div>
{/if}
