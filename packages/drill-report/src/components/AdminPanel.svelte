<script lang="ts">
	import { isAdmin } from '../stores/admin';
	import { getDrillNonce, getDrillTargets } from '../services/drill-admin';
	import { onMount } from 'svelte';
	import type { Address } from 'viem';

	let admin = $state($isAdmin);
	let drillNonce = $state<bigint | null>(null);
	let targets = $state<Address[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		admin = $isAdmin;
	});

	async function loadDrillInfo() {
		if (!admin) return;

		loading = true;
		error = null;

		try {
			// Get current drill nonce
			const nonce = await getDrillNonce();
			drillNonce = nonce;

			// Get targets for current drill
			if (nonce > 0n) {
				const drillTargets = await getDrillTargets(nonce);
				targets = drillTargets;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load drill information';
			console.error('Error loading drill info:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (admin) {
			loadDrillInfo();
		}

		// Listen for drill started events from AdminNavbar
		const handleDrillStarted = () => {
			loadDrillInfo();
		};
		window.addEventListener('drillStarted', handleDrillStarted);

		return () => {
			window.removeEventListener('drillStarted', handleDrillStarted);
		};
	});

	// Reload when admin status changes
	$effect(() => {
		if (admin) {
			loadDrillInfo();
		}
	});

	function formatAddress(address: Address): string {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}
</script>

{#if admin}
	<div class="card bg-base-200 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">
				Admin Panel
				<div class="badge badge-primary">Admin Access</div>
			</h2>

			{#if loading}
				<div class="flex justify-center p-4">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if error}
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
			{:else}
				<div class="stats stats-vertical lg:stats-horizontal shadow">
					<div class="stat">
						<div class="stat-title">Current Drill Nonce</div>
						<div class="stat-value">{drillNonce !== null ? drillNonce.toString() : 'N/A'}</div>
						<div class="stat-desc">Active drill ID</div>
					</div>

					<div class="stat">
						<div class="stat-title">Target Addresses</div>
						<div class="stat-value">{targets.length}</div>
						<div class="stat-desc">Addresses in current drill</div>
					</div>
				</div>

				{#if targets.length > 0}
					<div class="divider">Drill Targets</div>
					<div class="overflow-x-auto">
						<table class="table-zebra table">
							<thead>
								<tr>
									<th>#</th>
									<th>Address</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each targets as target, index}
									<tr>
										<td>{index + 1}</td>
										<td class="font-mono">{formatAddress(target)}</td>
										<td>
											<button
												class="btn btn-xs btn-ghost"
												onclick={() => navigator.clipboard.writeText(target)}
											>
												Copy
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<div class="card-actions mt-4 justify-end">
					<button class="btn btn-primary" onclick={loadDrillInfo}>
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
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Refresh
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
